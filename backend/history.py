"""Call history: one record per finished voice call.

The caller's browser builds the record when a call ends (transcript, handoffs, data
lookups) and posts it here, so dashboards on any device see every real call. Records
are stored whole as JSON, keyed by session ID.
"""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from typing import Any, Iterator

from config import settings

DB_PATH = settings.data_dir / "history.db"

# Oldest calls are dropped past this many, so the disk can't fill up.
MAX_SESSIONS = 5000

SCHEMA = """
create table if not exists sessions (
    id text primary key,
    started_at text not null,
    data text not null
);
create index if not exists sessions_started on sessions (started_at);
"""


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


def init_storage() -> None:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    with _connect() as con:
        con.execute("pragma journal_mode = wal")
        con.executescript(SCHEMA)


def save(record: dict[str, Any]) -> None:
    """Store a call record, replacing an earlier copy of the same session."""
    with _connect() as con:
        con.execute(
            "insert into sessions (id, started_at, data) values (?, ?, ?) "
            "on conflict (id) do update set started_at = excluded.started_at, data = excluded.data",
            (record["id"], record["startedAt"], json.dumps(record, ensure_ascii=False)),
        )
        con.execute(
            "delete from sessions where id not in (select id from sessions order by started_at desc limit ?)",
            (MAX_SESSIONS,),
        )


def recent(limit: int) -> list[dict[str, Any]]:
    """The latest call records, newest first."""
    with _connect() as con:
        rows = con.execute(
            "select data from sessions order by started_at desc limit ?", (limit,)
        ).fetchall()
    return [json.loads(row["data"]) for row in rows]
