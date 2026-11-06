"""Dataset storage and retrieval for the voice agent.

Spreadsheets (.xlsx, .xls, .csv) are parsed into structured records. Every short
cell value is indexed under normalised keys, so an order number, customer ID,
invoice, phone number or full name resolves by exact match — no embeddings, no
approximate answers for amounts and balances.

PDFs are split into page-tagged chunks and searched with SQLite FTS5 (BM25).
"""

from __future__ import annotations

import json
import math
import re
import sqlite3
import time
import uuid
from contextlib import contextmanager
from datetime import date, datetime
from pathlib import Path
from typing import Any, Iterator

import numpy as np
import pandas as pd
from pypdf import PdfReader

from config import settings

SPREADSHEET_EXTENSIONS = {".xlsx", ".xls", ".csv"}
DOCUMENT_EXTENSIONS = {".pdf"}
SUPPORTED_EXTENSIONS = SPREADSHEET_EXTENSIONS | DOCUMENT_EXTENSIONS

UPLOAD_DIR = settings.data_dir / "uploads"
DB_PATH = settings.data_dir / "knowledge.db"

MAX_INDEXED_CELL_CHARS = 80
CHUNK_CHARS = 900
CHUNK_OVERLAP = 150
MAX_RECORD_MATCHES = 15

# Matches in columns whose name contains one of these rank above incidental matches
# (for example an amount column that happens to equal the order number).
IDENTIFIER_HINTS = (
    "id", "order", "invoice", "reference", "ref", "account", "customer",
    "phone", "mobile", "email", "name", "number", "no", "code", "sku",
)

STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "does", "for", "from",
    "how", "i", "if", "in", "is", "it", "me", "my", "of", "on", "or", "our", "please",
    "tell", "that", "the", "this", "to", "was", "what", "when", "where", "which", "who",
    "why", "will", "with", "you", "your",
}

SCHEMA = """
create table if not exists datasets (
    id text primary key,
    name text not null,
    filename text not null,
    kind text not null,
    status text not null,
    error text,
    size_bytes integer not null default 0,
    record_count integer not null default 0,
    chunk_count integer not null default 0,
    page_count integer not null default 0,
    sheets text not null default '[]',
    created_at real not null,
    updated_at real not null
);

create table if not exists records (
    id integer primary key,
    dataset_id text not null,
    sheet text not null,
    row_number integer not null,
    data text not null
);
create index if not exists records_dataset on records (dataset_id);

create table if not exists record_values (
    record_id integer not null,
    dataset_id text not null,
    column_name text not null,
    value_key text not null
);
create index if not exists record_values_key on record_values (value_key);
create index if not exists record_values_dataset on record_values (dataset_id);

create virtual table if not exists chunks using fts5 (
    dataset_id unindexed,
    page unindexed,
    text,
    tokenize = 'porter unicode61'
);
"""


class DatasetError(Exception):
    """Raised for a file the user uploaded that cannot be processed."""


# --------------------------------------------------------------------------- #
# Database                                                                    #
# --------------------------------------------------------------------------- #


def init_storage() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    with _connect() as con:
        con.execute("pragma journal_mode = wal")
        con.executescript(SCHEMA)
        # A crash mid-ingest would otherwise leave a dataset "processing" forever.
        con.execute(
            "update datasets set status = 'failed', error = 'Processing was interrupted. Upload the file again.' "
            "where status = 'processing' and updated_at < ?",
            (time.time() - 600,),
        )


@contextmanager
def _connect() -> Iterator[sqlite3.Connection]:
    con = sqlite3.connect(DB_PATH, timeout=15)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def _iso(timestamp: float) -> str:
    return datetime.fromtimestamp(timestamp).astimezone().isoformat(timespec="seconds")


def _dataset_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "filename": row["filename"],
        "kind": row["kind"],
        "status": row["status"],
        "error": row["error"],
        "sizeBytes": row["size_bytes"],
        "recordCount": row["record_count"],
        "chunkCount": row["chunk_count"],
        "pageCount": row["page_count"],
        "sheets": json.loads(row["sheets"]),
        "createdAt": _iso(row["created_at"]),
        "updatedAt": _iso(row["updated_at"]),
    }


# --------------------------------------------------------------------------- #
# Dataset lifecycle                                                           #
# --------------------------------------------------------------------------- #


def kind_for(filename: str) -> str:
    extension = Path(filename).suffix.lower()
    if extension in SPREADSHEET_EXTENSIONS:
        return "spreadsheet"
    if extension in DOCUMENT_EXTENSIONS:
        return "document"
    raise DatasetError(
        f"Unsupported file type '{extension or filename}'. Upload .xlsx, .xls, .csv or .pdf files."
    )


def file_path(dataset_id: str, filename: str) -> Path:
    return UPLOAD_DIR / f"{dataset_id}{Path(filename).suffix.lower()}"


def create_dataset(filename: str, size_bytes: int) -> dict[str, Any]:
    kind = kind_for(filename)
    dataset_id = f"ds_{uuid.uuid4().hex[:12]}"
    now = time.time()
    with _connect() as con:
        con.execute(
            "insert into datasets (id, name, filename, kind, status, size_bytes, created_at, updated_at) "
            "values (?, ?, ?, ?, 'processing', ?, ?, ?)",
            (dataset_id, Path(filename).name, Path(filename).name, kind, size_bytes, now, now),
        )
    return get_dataset(dataset_id)


def begin_replace(dataset_id: str, filename: str, size_bytes: int) -> dict[str, Any]:
    kind = kind_for(filename)
    existing = get_dataset(dataset_id)
    old_path = file_path(dataset_id, existing["filename"])
    if old_path.exists():
        old_path.unlink()
    with _connect() as con:
        con.execute(
            "update datasets set name = ?, filename = ?, kind = ?, status = 'processing', error = null, "
            "size_bytes = ?, updated_at = ? where id = ?",
            (Path(filename).name, Path(filename).name, kind, size_bytes, time.time(), dataset_id),
        )
    return get_dataset(dataset_id)


def get_dataset(dataset_id: str) -> dict[str, Any]:
    with _connect() as con:
        row = con.execute("select * from datasets where id = ?", (dataset_id,)).fetchone()
    if row is None:
        raise KeyError(dataset_id)
    return _dataset_dict(row)


def list_datasets() -> list[dict[str, Any]]:
    with _connect() as con:
        rows = con.execute("select * from datasets order by updated_at desc").fetchall()
    return [_dataset_dict(row) for row in rows]


def delete_dataset(dataset_id: str) -> None:
    dataset = get_dataset(dataset_id)
    with _connect() as con:
        _clear_dataset_rows(con, dataset_id)
        con.execute("delete from datasets where id = ?", (dataset_id,))
    path = file_path(dataset_id, dataset["filename"])
    if path.exists():
        path.unlink()


def _clear_dataset_rows(con: sqlite3.Connection, dataset_id: str) -> None:
    con.execute("delete from record_values where dataset_id = ?", (dataset_id,))
    con.execute("delete from records where dataset_id = ?", (dataset_id,))
    con.execute("delete from chunks where dataset_id = ?", (dataset_id,))


def _mark_failed(dataset_id: str, message: str) -> None:
    with _connect() as con:
        con.execute(
            "update datasets set status = 'failed', error = ?, updated_at = ? where id = ?",
            (message, time.time(), dataset_id),
        )


def process_dataset(dataset_id: str) -> None:
    """Parse the stored file and atomically swap its rows into the index."""
    dataset = get_dataset(dataset_id)
    path = file_path(dataset_id, dataset["filename"])
    try:
        if dataset["kind"] == "spreadsheet":
            sheets = _parse_spreadsheet(path, Path(dataset["filename"]).stem)
            _store_spreadsheet(dataset_id, sheets)
        else:
            pages = _extract_pdf_pages(path)
            _store_document(dataset_id, pages)
    except DatasetError as exc:
        _mark_failed(dataset_id, str(exc))
    except Exception as exc:  # noqa: BLE001 - surface any parser failure to the user
        _mark_failed(dataset_id, f"Could not process this file: {exc}")


# --------------------------------------------------------------------------- #
# Spreadsheets                                                                #
# --------------------------------------------------------------------------- #


def _clean_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, np.generic):
        value = value.item()
    if isinstance(value, str):
        text = value.strip()
        return text or None
    if isinstance(value, bool):
        return value
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return int(value) if value.is_integer() else round(value, 6)
    if isinstance(value, (pd.Timestamp, datetime)):
        if pd.isna(value):
            return None
        if (value.hour, value.minute, value.second) == (0, 0, 0):
            return value.date().isoformat()
        return value.isoformat(sep=" ", timespec="minutes")
    if isinstance(value, date):
        return value.isoformat()
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    return value


def _looks_like_header(row: list[Any], width: int) -> bool:
    values = [value for value in row if value is not None]
    if len(values) < max(1, math.ceil(width * 0.5)):
        return False
    return all(isinstance(value, str) and not re.fullmatch(r"[\d.,\s-]+", value) for value in values)


def _unique_headers(row: list[Any]) -> list[str]:
    headers: list[str] = []
    seen: dict[str, int] = {}
    for index, value in enumerate(row):
        name = re.sub(r"\s+", " ", str(value)).strip() if value is not None else ""
        name = name or f"Column {index + 1}"
        count = seen.get(name.lower(), 0)
        seen[name.lower()] = count + 1
        headers.append(name if count == 0 else f"{name} {count + 1}")
    return headers


def _frame_to_records(frame: pd.DataFrame) -> tuple[list[str], list[tuple[int, dict[str, Any]]]]:
    frame = frame.dropna(how="all").dropna(axis=1, how="all")
    if frame.empty:
        return [], []

    row_numbers = [int(index) + 1 for index in frame.index]
    rows = [[_clean_value(value) for value in row] for row in frame.itertuples(index=False, name=None)]
    width = len(rows[0])

    header_index = next(
        (index for index, row in enumerate(rows[:10]) if _looks_like_header(row, width)), None
    )
    if header_index is None:
        headers = [f"Column {index + 1}" for index in range(width)]
        data_start = 0
    else:
        headers = _unique_headers(rows[header_index])
        data_start = header_index + 1

    records: list[tuple[int, dict[str, Any]]] = []
    for row_number, row in zip(row_numbers[data_start:], rows[data_start:]):
        record = {header: value for header, value in zip(headers, row) if value is not None}
        if record:
            records.append((row_number, record))
    return headers, records


def _parse_spreadsheet(
    path: Path, display_name: str
) -> list[tuple[str, list[str], list[tuple[int, dict[str, Any]]]]]:
    if path.suffix.lower() == ".csv":
        frames = {
            display_name: pd.read_csv(
                path,
                header=None,
                dtype=str,
                keep_default_na=False,
                na_values=[""],
                sep=None,
                engine="python",
                encoding_errors="replace",
            )
        }
    else:
        frames = pd.read_excel(path, sheet_name=None, header=None)

    sheets = []
    for sheet_name, frame in frames.items():
        headers, records = _frame_to_records(frame)
        if records:
            sheets.append((str(sheet_name), headers, records))
    if not sheets:
        raise DatasetError("No rows found in this file.")
    return sheets


def _lookup_keys(value: Any) -> set[str]:
    """Normalised keys for exact matching.

    `a:` is the lowercase alphanumeric form ("ORD-4821" -> "ord4821"), `d:` the digits
    ("ORD-4821" -> "4821"), and `p:` the last ten digits so phone numbers match with
    or without a country code or leading zero.
    """
    text = str(value).strip().lower()
    if not text or len(text) > MAX_INDEXED_CELL_CHARS:
        return set()
    keys: set[str] = set()
    alnum = re.sub(r"[\W_]+", "", text)
    if alnum:
        keys.add(f"a:{alnum}")
    digits = re.sub(r"\D", "", text)
    if len(digits) >= 3:
        keys.add(f"d:{digits.lstrip('0') or '0'}")
        if len(digits) >= 10:
            keys.add(f"p:{digits[-10:]}")
    return keys


def _store_spreadsheet(
    dataset_id: str, sheets: list[tuple[str, list[str], list[tuple[int, dict[str, Any]]]]]
) -> None:
    summary = [
        {"name": name, "rows": len(records), "columns": headers} for name, headers, records in sheets
    ]
    total = sum(len(records) for _, _, records in sheets)
    with _connect() as con:
        _clear_dataset_rows(con, dataset_id)
        for sheet_name, _headers, records in sheets:
            for row_number, record in records:
                cursor = con.execute(
                    "insert into records (dataset_id, sheet, row_number, data) values (?, ?, ?, ?)",
                    (dataset_id, sheet_name, row_number, json.dumps(record, ensure_ascii=False)),
                )
                record_id = cursor.lastrowid
                con.executemany(
                    "insert into record_values (record_id, dataset_id, column_name, value_key) "
                    "values (?, ?, ?, ?)",
                    [
                        (record_id, dataset_id, column, key)
                        for column, value in record.items()
                        for key in _lookup_keys(value)
                    ],
                )
        con.execute(
            "update datasets set status = 'ready', error = null, record_count = ?, chunk_count = 0, "
            "page_count = 0, sheets = ?, updated_at = ? where id = ?",
            (total, json.dumps(summary, ensure_ascii=False), time.time(), dataset_id),
        )


# --------------------------------------------------------------------------- #
# Documents                                                                   #
# --------------------------------------------------------------------------- #


def _extract_pdf_pages(path: Path) -> list[str]:
    try:
        reader = PdfReader(path)
        if reader.is_encrypted:
            reader.decrypt("")
        pages = [page.extract_text() or "" for page in reader.pages]
    except Exception as exc:  # noqa: BLE001
        raise DatasetError(f"Could not read this PDF: {exc}") from exc
    if sum(len(page.strip()) for page in pages) < 20:
        raise DatasetError("No extractable text found. Scanned PDFs need OCR before upload.")
    return pages


def _chunk_pages(pages: list[str]) -> list[tuple[int, str]]:
    chunks: list[tuple[int, str]] = []
    for page_number, raw in enumerate(pages, start=1):
        text = re.sub(r"\s+", " ", raw).strip()
        start = 0
        while start < len(text):
            end = min(len(text), start + CHUNK_CHARS)
            if end < len(text):
                floor = start + CHUNK_CHARS // 2
                cut = text.rfind(". ", floor, end)
                if cut == -1:
                    cut = text.rfind(" ", floor, end)
                if cut != -1:
                    end = cut + 1
            chunks.append((page_number, text[start:end].strip()))
            if end >= len(text):
                break
            start = max(end - CHUNK_OVERLAP, start + 1)
            space = text.find(" ", start, end)
            if space != -1:
                start = space + 1
    return [(page, chunk) for page, chunk in chunks if chunk]


def _store_document(dataset_id: str, pages: list[str]) -> None:
    chunks = _chunk_pages(pages)
    with _connect() as con:
        _clear_dataset_rows(con, dataset_id)
        con.executemany(
            "insert into chunks (dataset_id, page, text) values (?, ?, ?)",
            [(dataset_id, page, text) for page, text in chunks],
        )
        con.execute(
            "update datasets set status = 'ready', error = null, record_count = 0, chunk_count = ?, "
            "page_count = ?, sheets = '[]', updated_at = ? where id = ?",
            (len(chunks), len(pages), time.time(), dataset_id),
        )


# --------------------------------------------------------------------------- #
# Retrieval                                                                   #
# --------------------------------------------------------------------------- #


def _is_identifier_column(column: str) -> bool:
    words = re.findall(r"[a-z]+", column.lower())
    return any(hint in words or column.lower().startswith(hint) for hint in IDENTIFIER_HINTS)


def lookup_records(reference: str, limit: int = MAX_RECORD_MATCHES) -> list[dict[str, Any]]:
    """Find spreadsheet rows whose cells exactly match `reference`.

    Falls back to a partial name match ("Zara" -> "Zara Ahmed") only when nothing
    matches exactly.
    """
    keys = _lookup_keys(reference)
    scores: dict[int, tuple[int, str, str]] = {}
    with _connect() as con:
        if keys:
            placeholders = ",".join("?" * len(keys))
            rows = con.execute(
                f"select rv.record_id, rv.column_name, rv.value_key from record_values rv "
                f"join datasets d on d.id = rv.dataset_id "
                f"where d.status = 'ready' and rv.value_key in ({placeholders})",
                tuple(keys),
            ).fetchall()
            for row in rows:
                score = (2 if row["value_key"].startswith("a:") else 1) + (
                    3 if _is_identifier_column(row["column_name"]) else 0
                )
                if score > scores.get(row["record_id"], (0, "", ""))[0]:
                    scores[row["record_id"]] = (score, row["column_name"], "exact")

        if not scores:
            tokens = [
                token
                for token in re.findall(r"[^\W\d_]{3,}", reference.lower())
                if token not in STOPWORDS
            ]
            matched: set[int] | None = None
            for token in tokens:
                ids = {
                    row["record_id"]
                    for row in con.execute(
                        "select rv.record_id from record_values rv join datasets d on d.id = rv.dataset_id "
                        "where d.status = 'ready' and rv.value_key like ?",
                        (f"a:%{token}%",),
                    )
                }
                matched = ids if matched is None else matched & ids
            for record_id in matched or set():
                scores[record_id] = (1, "", "partial")

        if not scores:
            return []

        ranked = sorted(scores.items(), key=lambda item: (-item[1][0], item[0]))[:limit]
        ids = [record_id for record_id, _ in ranked]
        placeholders = ",".join("?" * len(ids))
        rows = {
            row["id"]: row
            for row in con.execute(
                f"select r.id, r.sheet, r.row_number, r.data, d.name from records r "
                f"join datasets d on d.id = r.dataset_id where r.id in ({placeholders})",
                tuple(ids),
            )
        }

    results = []
    for record_id, (_score, column, match) in ranked:
        row = rows.get(record_id)
        if row is None:
            continue
        results.append(
            {
                "source": row["name"],
                "sheet": row["sheet"],
                "row": row["row_number"],
                "match": match,
                "matchedColumn": column or None,
                "fields": json.loads(row["data"]),
            }
        )
    return results


def search_documents(query: str, limit: int = 4) -> list[dict[str, Any]]:
    """BM25 full-text search over uploaded PDF chunks."""
    terms = [
        term
        for term in dict.fromkeys(re.findall(r"\w+", query.lower()))
        if len(term) > 1 and term not in STOPWORDS
    ]
    if not terms:
        return []
    expression = " OR ".join(f'"{term}"' for term in terms)
    with _connect() as con:
        rows = con.execute(
            "select chunks.page, chunks.text, d.name, bm25(chunks) as score from chunks "
            "join datasets d on d.id = chunks.dataset_id "
            "where chunks match ? and d.status = 'ready' order by score limit ?",
            (expression, limit),
        ).fetchall()
    return [
        {"source": row["name"], "page": row["page"], "text": row["text"], "score": round(-row["score"], 3)}
        for row in rows
    ]


def preview_dataset(dataset_id: str, limit: int = 25) -> dict[str, Any]:
    dataset = get_dataset(dataset_id)
    with _connect() as con:
        if dataset["kind"] == "spreadsheet":
            sheets = []
            for sheet in dataset["sheets"]:
                rows = con.execute(
                    "select row_number, data from records where dataset_id = ? and sheet = ? "
                    "order by id limit ?",
                    (dataset_id, sheet["name"], limit),
                ).fetchall()
                sheets.append(
                    {
                        "name": sheet["name"],
                        "columns": sheet["columns"],
                        "rows": [{"row": row["row_number"], **json.loads(row["data"])} for row in rows],
                    }
                )
            return {"dataset": dataset, "sheets": sheets, "chunks": []}

        rows = con.execute(
            "select page, text from chunks where dataset_id = ? order by rowid limit ?",
            (dataset_id, limit),
        ).fetchall()
        return {
            "dataset": dataset,
            "sheets": [],
            "chunks": [{"page": row["page"], "text": row["text"]} for row in rows],
        }


def stats() -> dict[str, int]:
    with _connect() as con:
        row = con.execute(
            "select count(*) as total, "
            "coalesce(sum(status = 'ready'), 0) as ready, "
            "coalesce(sum(case when status = 'ready' then record_count end), 0) as records, "
            "coalesce(sum(case when status = 'ready' then chunk_count end), 0) as chunks "
            "from datasets"
        ).fetchone()
    return {key: int(row[key]) for key in ("total", "ready", "records", "chunks")}
