"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Database,
  Eye,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { cn, formatRelative } from "@/lib/utils";
import {
  voiceApi,
  type CellValue,
  type Dataset,
  type DatasetPreview,
  type SearchResult,
} from "@/lib/voice-api";
import { PageHeader } from "@/components/dashboard";
import { Badge, Button, EmptyState, Input, Modal, Panel, SectionTitle, Tabs } from "@/components/ui";

const ACCEPT = ".xlsx,.xls,.csv,.pdf";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function plural(count: number, word: string) {
  return `${count.toLocaleString()} ${word}${count === 1 ? "" : "s"}`;
}

function contentsLabel(dataset: Dataset) {
  if (dataset.status !== "ready") return "—";
  if (dataset.kind === "spreadsheet") {
    return `${plural(dataset.recordCount, "row")} · ${plural(dataset.sheets.length, "sheet")}`;
  }
  return `${plural(dataset.chunkCount, "passage")} · ${plural(dataset.pageCount, "page")}`;
}

// Identifier columns keep their raw digits ("4821", not "4,821").
const IDENTIFIER_COLUMN = /\b(id|no|number|code|ref|reference|phone|mobile)\b|^(row|order|invoice)$/i;

function formatCell(value: CellValue | undefined, column = "") {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "number" && !IDENTIFIER_COLUMN.test(column)) return value.toLocaleString();
  return String(value);
}

function StatusBadge({ dataset }: { dataset: Dataset }) {
  if (dataset.status === "processing") {
    return (
      <Badge tone="amber">
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        Processing
      </Badge>
    );
  }
  if (dataset.status === "failed") {
    return (
      <Badge tone="red" dot>
        Failed
      </Badge>
    );
  }
  return (
    <Badge tone="green" dot>
      Ready
    </Badge>
  );
}

function KindIcon({ kind }: { kind: Dataset["kind"] }) {
  const Icon = kind === "spreadsheet" ? FileSpreadsheet : FileText;
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-line bg-surface-2 text-muted">
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

function PreviewModal({ dataset, onClose }: { dataset: Dataset | null; onClose: () => void }) {
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<string>("");

  useEffect(() => {
    if (!dataset) return;
    let cancelled = false;
    voiceApi.preview(dataset.id).then(
      (result) => {
        if (cancelled) return;
        setPreview(result);
        setSheet(result.sheets[0]?.name ?? "");
      },
      (err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load preview.");
      },
    );
    return () => {
      cancelled = true;
      setPreview(null);
      setError(null);
    };
  }, [dataset]);

  const activeSheet = preview?.sheets.find((item) => item.name === sheet) ?? preview?.sheets[0];

  return (
    <Modal
      open={Boolean(dataset)}
      onClose={onClose}
      title={dataset?.filename ?? ""}
      description={dataset ? contentsLabel(dataset) : undefined}
      size="lg"
    >
      {error ? <p className="text-[12px] text-red">{error}</p> : null}
      {!preview && !error ? (
        <div className="flex items-center gap-2 py-10 text-[12px] text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading preview...
        </div>
      ) : null}

      {preview && preview.sheets.length ? (
        <div className="space-y-3">
          {preview.sheets.length > 1 ? (
            <Tabs
              items={preview.sheets.map((item) => ({ id: item.name, label: item.name }))}
              value={activeSheet?.name ?? ""}
              onChange={setSheet}
              className="w-fit"
            />
          ) : null}
          {activeSheet ? (
            <div className="scrollbar-thin max-h-[420px] overflow-auto border border-line">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 bg-surface-2">
                  <tr>
                    <th className="px-3 py-2 font-mono text-[8.5px] font-normal uppercase tracking-[0.12em] text-muted-2">
                      Row
                    </th>
                    {activeSheet.columns.map((column) => (
                      <th
                        key={column}
                        className="whitespace-nowrap px-3 py-2 font-mono text-[8.5px] font-normal uppercase tracking-[0.12em] text-muted-2"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeSheet.rows.map((row) => (
                    <tr key={String(row.row)} className="border-t border-line/70">
                      <td className="px-3 py-2 font-mono text-[10px] text-muted-2">{formatCell(row.row, "row")}</td>
                      {activeSheet.columns.map((column) => (
                        <td key={column} className="whitespace-nowrap px-3 py-2 text-[11.5px] text-ink">
                          {formatCell(row[column], column)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {preview && preview.chunks.length ? (
        <div className="scrollbar-thin max-h-[440px] space-y-2 overflow-y-auto">
          {preview.chunks.map((chunk, index) => (
            <div key={index} className="border border-line bg-surface-2/50 p-3">
              <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-2">
                Page {chunk.page}
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink/90">{chunk.text}</p>
            </div>
          ))}
        </div>
      ) : null}
    </Modal>
  );
}

function LookupPanel({ disabled }: { disabled: boolean }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const run = async () => {
    const value = query.trim();
    if (!value) return;
    setSearching(true);
    setError(null);
    try {
      setResult(await voiceApi.search(value));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <Panel className="flex flex-col p-4">
      <SectionTitle title="Test lookup" />
      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void run();
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-2" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Order number, customer, or question"
            className="h-9 pl-8 text-[12px]"
            disabled={disabled}
          />
        </div>
        <Button type="submit" variant="primary" disabled={disabled || searching || !query.trim()}>
          {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Search"}
        </Button>
      </form>

      {error ? <p className="mt-3 text-[11px] text-red">{error}</p> : null}

      {result ? (
        <div className="scrollbar-thin mt-4 max-h-[560px] space-y-4 overflow-y-auto">
          <div>
            <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-2">
              Records · {result.records.length}
            </p>
            {result.records.length === 0 ? (
              <p className="mt-2 text-[11px] text-muted">No matching rows.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {result.records.map((record) => (
                  <div
                    key={`${record.source}-${record.sheet}-${record.row}`}
                    className="border border-line bg-surface-2/50 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-mono text-[9px] uppercase tracking-[0.08em] text-muted">
                        {record.sheet} · row {record.row}
                      </p>
                      {record.match === "partial" ? <Badge tone="amber">Partial</Badge> : null}
                    </div>
                    <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
                      {Object.entries(record.fields).map(([key, value]) => (
                        <div key={key} className="contents">
                          <dt
                            className={cn(
                              "text-[10.5px] text-muted-2",
                              key === record.matchedColumn && "font-medium text-ink",
                            )}
                          >
                            {key}
                          </dt>
                          <dd className="truncate text-[10.5px] text-ink">{formatCell(value, key)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-2">
              Document passages · {result.documents.length}
            </p>
            {result.documents.length === 0 ? (
              <p className="mt-2 text-[11px] text-muted">No matching passages.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {result.documents.map((passage, index) => (
                  <div key={index} className="border border-line bg-surface-2/50 p-3">
                    <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted">
                      {passage.source} · page {passage.page}
                    </p>
                    <p className="mt-1.5 line-clamp-5 text-[11px] leading-relaxed text-ink/90">
                      {passage.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

export default function DataPage() {
  const [datasets, setDatasets] = useState<Dataset[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [previewing, setPreviewing] = useState<Dataset | null>(null);
  const [deleting, setDeleting] = useState<Dataset | null>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<Dataset | null>(null);

  const load = useCallback(
    () =>
      voiceApi.datasets().then(
        (result) => {
          setDatasets(result.datasets);
          setLoadError(null);
        },
        (err: unknown) => setLoadError(err instanceof Error ? err.message : "Could not load datasets."),
      ),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const processing = datasets?.some((dataset) => dataset.status === "processing") ?? false;
  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => void load(), 1500);
    return () => clearInterval(timer);
  }, [processing, load]);

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    setNotice(null);
    setUploading((current) => [...current, ...files.map((file) => file.name)]);
    const failures: string[] = [];
    await Promise.all(
      files.map(async (file) => {
        try {
          await voiceApi.upload(file);
        } catch (err) {
          failures.push(`${file.name}: ${err instanceof Error ? err.message : "upload failed"}`);
        } finally {
          setUploading((current) => {
            const index = current.indexOf(file.name);
            return index === -1 ? current : [...current.slice(0, index), ...current.slice(index + 1)];
          });
        }
      }),
    );
    if (failures.length) setNotice(failures.join(" "));
    await load();
  };

  const replaceFile = async (dataset: Dataset, file: File) => {
    setNotice(null);
    try {
      await voiceApi.replace(dataset.id, file);
    } catch (err) {
      setNotice(`${file.name}: ${err instanceof Error ? err.message : "replace failed"}`);
    }
    await load();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    try {
      await voiceApi.remove(target.id);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Delete failed.");
    }
    await load();
  };

  const offline = Boolean(loadError) && datasets === null;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-7 lg:py-8">
      <PageHeader
        title="Data"
        description="Spreadsheets and documents the voice agent answers from."
        actions={
          <Button variant="primary" onClick={() => uploadInput.current?.click()} disabled={offline}>
            <Upload className="h-3.5 w-3.5" />
            Upload files
          </Button>
        }
      />

      <input
        ref={uploadInput}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => {
          void uploadFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      <input
        ref={replaceInput}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          const target = replaceTarget.current;
          event.target.value = "";
          if (file && target) void replaceFile(target, file);
        }}
      />

      {offline ? (
        <Panel>
          <EmptyState
            icon={<Database className="h-5 w-5" />}
            title="Data service unavailable"
            description={`${loadError} Start it with: uvicorn api:app --port 8000 (from the backend folder).`}
            action={
              <Button variant="secondary" size="sm" onClick={() => void load()}>
                <RefreshCw className="h-3 w-3" />
                Retry
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Panel className="overflow-hidden">
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void uploadFiles(Array.from(event.dataTransfer.files));
              }}
              className={cn(
                "m-4 flex flex-col items-center justify-center border border-dashed px-6 py-7 text-center transition-colors",
                dragging ? "border-ink bg-surface-2" : "border-line-strong bg-surface-2/40",
              )}
            >
              <Upload className="h-4 w-4 text-muted" />
              <p className="mt-2 text-[12.5px] text-ink">
                Drop files here, or{" "}
                <button
                  type="button"
                  onClick={() => uploadInput.current?.click()}
                  className="font-medium underline underline-offset-2"
                >
                  browse
                </button>
              </p>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-2">
                Excel · CSV · PDF · up to 25 MB
              </p>
            </div>

            {notice ? (
              <p className="mx-4 mb-3 border border-red/30 bg-red/[0.05] px-3 py-2 text-[11px] text-red">{notice}</p>
            ) : null}

            <div className="overflow-x-auto border-t border-line">
              <table className="w-full min-w-[680px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line">
                    {["File", "Contents", "Status", "Updated", ""].map((header) => (
                      <th
                        key={header}
                        className="px-4 py-3 font-mono text-[8px] font-normal uppercase tracking-[0.16em] text-muted-2 first:pl-5"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {uploading.map((name, index) => (
                    <tr key={`uploading-${name}-${index}`} className="border-b border-line/60">
                      <td className="py-3 pl-5 pr-4 text-[12px] text-ink">{name}</td>
                      <td className="px-4 py-3 text-[11px] text-muted-2">—</td>
                      <td className="px-4 py-3">
                        <Badge tone="neutral">
                          <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          Uploading
                        </Badge>
                      </td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3" />
                    </tr>
                  ))}
                  {(datasets ?? []).map((dataset) => (
                    <tr key={dataset.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2/50">
                      <td className="py-3 pl-5 pr-4">
                        <div className="flex items-center gap-3">
                          <KindIcon kind={dataset.kind} />
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-medium text-ink">{dataset.filename}</p>
                            <p className="font-mono text-[9px] text-muted-2">
                              {dataset.kind === "spreadsheet" ? "Spreadsheet" : "Document"} ·{" "}
                              {formatBytes(dataset.sizeBytes)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-muted">
                        {contentsLabel(dataset)}
                        {dataset.kind === "spreadsheet" && dataset.status === "ready" ? (
                          <p className="truncate font-mono text-[9px] text-muted-2">
                            {dataset.sheets.map((sheet) => sheet.name).join(", ")}
                          </p>
                        ) : null}
                      </td>
                      <td className="max-w-[220px] px-4 py-3">
                        <StatusBadge dataset={dataset} />
                        {dataset.error ? (
                          <p className="mt-1 text-[10px] leading-snug text-red">{dataset.error}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-mono text-[9.5px] text-muted-2">
                        {formatRelative(dataset.updatedAt)}
                      </td>
                      <td className="py-3 pl-2 pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Preview ${dataset.filename}`}
                            title="Preview"
                            disabled={dataset.status !== "ready"}
                            onClick={() => setPreviewing(dataset)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Replace ${dataset.filename}`}
                            title="Replace file"
                            disabled={dataset.status === "processing"}
                            onClick={() => {
                              replaceTarget.current = dataset;
                              replaceInput.current?.click();
                            }}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete ${dataset.filename}`}
                            title="Delete"
                            className="hover:text-red"
                            onClick={() => setDeleting(dataset)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {datasets && datasets.length === 0 && uploading.length === 0 ? (
                <EmptyState
                  icon={<Database className="h-5 w-5" />}
                  title="No data yet"
                  description="Upload an order sheet or policy document to ground the agent's answers."
                />
              ) : null}
              {datasets === null && !loadError ? (
                <div className="flex items-center gap-2 px-5 py-6 text-[12px] text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </div>
              ) : null}
            </div>
          </Panel>

          <LookupPanel disabled={!datasets?.some((dataset) => dataset.status === "ready")} />
        </div>
      )}

      <PreviewModal dataset={previewing} onClose={() => setPreviewing(null)} />

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete file?"
        description={
          deleting
            ? `${deleting.filename} will be removed and the agent will stop using its data.`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={() => void confirmDelete()}>
              Delete
            </Button>
          </>
        }
      />
    </div>
  );
}
