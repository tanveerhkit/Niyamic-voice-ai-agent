"use client";

import { useMemo, useState } from "react";
import { Download, MessageSquare, Search, X } from "lucide-react";
import { useAllSessions } from "@/lib/live-store";
import { agentName } from "@/lib/seed";
import type { Language, SessionRecord } from "@/lib/types";
import { LANGUAGE_NATIVE } from "@/lib/utils";
import { PageHeader, SessionTable } from "@/components/dashboard";
import { Button, EmptyState, Input, Panel, Select, Tabs } from "@/components/ui";

type StatusFilter = "all" | "completed" | "transferred" | "abandoned";

function downloadCsv(sessions: SessionRecord[]) {
  const header = [
    "id",
    "customer",
    "agent",
    "intent",
    "language",
    "status",
    "handled_by",
    "duration_sec",
    "csat",
    "started_at",
  ];
  const rows = sessions.map((session) => [
    session.id,
    session.customerName,
    agentName(session.agentId),
    session.intent,
    session.language,
    session.status,
    session.handledBy,
    session.durationSec,
    session.csat ?? "",
    session.startedAt,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "niyamic-sessions.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function SessionsPage() {
  const sessions = useAllSessions();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [language, setLanguage] = useState<"all" | Language>("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(24);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return sessions.filter((session) => {
      if (status !== "all" && session.status !== status) return false;
      if (language !== "all" && session.language !== language) return false;
      if (!value) return true;
      return (
        session.customerName.toLowerCase().includes(value) ||
        session.id.toLowerCase().includes(value) ||
        session.intent.toLowerCase().includes(value) ||
        agentName(session.agentId).toLowerCase().includes(value)
      );
    });
  }, [sessions, status, language, query]);

  const counts = useMemo(
    () => ({
      all: sessions.length,
      completed: sessions.filter((session) => session.status === "completed").length,
      transferred: sessions.filter((session) => session.status === "transferred").length,
      abandoned: sessions.filter((session) => session.status === "abandoned").length,
    }),
    [sessions],
  );

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-7 lg:py-8">
      <PageHeader
        title="Sessions"
        actions={
          <Button variant="outline" onClick={() => downloadCsv(filtered)}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        }
      />

      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 xl:flex-row xl:items-center xl:justify-between">
          <Tabs
            items={[
              { id: "all", label: `All · ${counts.all}` },
              { id: "completed", label: `Resolved · ${counts.completed}` },
              { id: "transferred", label: `Transferred · ${counts.transferred}` },
              { id: "abandoned", label: `Abandoned · ${counts.abandoned}` },
            ]}
            value={status}
            onChange={setStatus}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-2" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search customer, intent, ID..."
                className="h-9 w-full pl-8 text-[11.5px] sm:w-[240px]"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-2 hover:text-ink"
                  aria-label="Clear search"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>
            <div className="w-full sm:w-[150px]">
              <Select
                value={language}
                onChange={(event) => setLanguage(event.target.value as "all" | Language)}
                className="h-9 text-[11.5px]"
              >
                <option value="all">All languages</option>
                <option value="en">{LANGUAGE_NATIVE.en}</option>
                <option value="ur">{LANGUAGE_NATIVE.ur}</option>
                <option value="hi">{LANGUAGE_NATIVE.hi}</option>
              </Select>
            </div>
          </div>
        </div>

        {filtered.length ? (
          <>
            <div className="border-b border-line px-4 py-2">
              <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-2">
                Showing {Math.min(limit, filtered.length)} of {filtered.length} sessions
              </p>
            </div>
            <SessionTable sessions={filtered.slice(0, limit)} />
            {limit < filtered.length ? (
              <div className="border-t border-line p-4 text-center">
                <Button variant="secondary" size="sm" onClick={() => setLimit((value) => value + 24)}>
                  Load more sessions
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <EmptyState
            icon={<MessageSquare className="h-5 w-5" />}
            title="No sessions match these filters"
            description="Try a different status, language, or search term."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setStatus("all");
                  setLanguage("all");
                  setQuery("");
                }}
              >
                Clear filters
              </Button>
            }
          />
        )}
      </Panel>
    </div>
  );
}
