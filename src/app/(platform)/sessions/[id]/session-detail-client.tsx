"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Download,
  FlaskConical,
  MessageSquare,
} from "lucide-react";
import { agentById, seedAgents } from "@/lib/agents";
import { useAgent } from "@/lib/agent-store";
import { useAllSessions } from "@/lib/live-store";
import { getSeedSession } from "@/lib/seed";
import { fallbackSummary, fallbackTranscript } from "@/lib/session-content";
import type { SessionRecord, Turn } from "@/lib/types";
import {
  cn,
  formatDateTime,
  formatDuration,
  formatRelative,
  LANGUAGE_NATIVE,
  LANGUAGE_SHORT,
} from "@/lib/utils";
import { AgentAvatar, LanguageTag } from "@/components/brand";
import { PageHeader, SessionStatusBadge, HandledByBadge } from "@/components/dashboard";
import { Badge, Button, EmptyState, Panel, SectionTitle } from "@/components/ui";
import { RecordingPlayer } from "@/components/live/recording-player";

function sentimentTone(sentiment: SessionRecord["sentiment"]) {
  if (sentiment === "positive") return "green" as const;
  if (sentiment === "negative") return "red" as const;
  return "neutral" as const;
}

function speakerMeta(role: Turn["role"]) {
  if (role === "ai") return { label: "Ayesha", tone: "text-accent", bubble: "border-accent/10 bg-accent/[0.04]" };
  if (role === "human") return { label: "Sara Malik", tone: "text-cyan", bubble: "border-cyan/15 bg-cyan/[0.05]" };
  if (role === "customer") return { label: "Customer", tone: "text-ink/70", bubble: "border-line bg-surface" };
  return { label: "System", tone: "text-muted", bubble: "" };
}

function TranscriptRow({ turn }: { turn: Turn }) {
  if (turn.role === "system") {
    return (
      <div className="flex items-center gap-2 py-1">
        <span className="h-px flex-1 bg-line" />
        <span className="rounded-full border border-line bg-surface-2 px-2.5 py-1 font-mono text-[8.5px] uppercase tracking-[0.1em] text-muted-2">
          {turn.text}
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>
    );
  }

  const meta = speakerMeta(turn.role);
  return (
    <div className="flex gap-2.5">
      <div className="w-9 shrink-0 pt-0.5 text-right font-mono text-[8.5px] text-muted-2">
        {formatDuration(turn.at)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1.5">
          <span className={cn("text-[10px] font-medium", meta.tone)}>{meta.label}</span>
          {turn.language ? (
            <span className="font-mono text-[8px] uppercase text-muted-2">{LANGUAGE_SHORT[turn.language]}</span>
          ) : null}
          {turn.confidence ? (
            <span className="font-mono text-[8px] text-muted-2">{turn.confidence.toFixed(2)}</span>
          ) : null}
        </div>
        <div className={cn("rounded-none border px-3 py-2 text-[11.5px] leading-relaxed text-ink/90", meta.bubble)}>
          {turn.text}
        </div>
      </div>
    </div>
  );
}

function exportSession(session: SessionRecord) {
  const blob = new Blob([JSON.stringify(session, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${session.id}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const sessions = useAllSessions();
  const record = sessions.find((session) => session.id === id) ?? getSeedSession(id);
  const agent = useAgent(record?.agentId ?? "ag_ayesha") ?? agentById(record?.agentId ?? "ag_ayesha") ?? seedAgents[0];

  const content = useMemo(() => {
    if (!record) return null;
    return {
      transcript: record.transcript ?? fallbackTranscript(record),
      summary: record.summary ?? fallbackSummary(record),
    };
  }, [record]);

  if (!record || !content) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <EmptyState
          icon={<MessageSquare className="h-5 w-5" />}
          title="Session not found"
          description="This session may have been deleted."
          action={
            <Link href="/sessions">
              <Button variant="primary">Back to sessions</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const { transcript, summary } = content;

  // Demo records created from the session catalog don't carry an explicit
  // handoff object. Derive one so the log never contradicts a transferred call.
  const derivedHandoff =
    !record.handoffs?.length && (record.status === "transferred" || record.handledBy !== "ai");
  const handoffAtSec = Math.max(10, Math.min(46, record.durationSec - 20));
  const returnedAtSec = Math.max(handoffAtSec + 30, record.durationSec - 12);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-7 lg:py-8">
      <div className="mb-4 flex items-center gap-2 text-[11px] text-muted-2">
        <Link href="/sessions" className="inline-flex items-center gap-1 hover:text-ink">
          <ArrowLeft className="h-3 w-3" />
          Sessions
        </Link>
        <span>/</span>
        <span className="font-mono text-ink">{record.id}</span>
      </div>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {record.customerName}
            <SessionStatusBadge session={record} />
            <Badge tone={sentimentTone(record.sentiment)}>{record.sentiment}</Badge>
          </span>
        }
        description={`${record.intent} · ${agent.name} · ${LANGUAGE_NATIVE[record.language]} · ${formatDuration(record.durationSec)}`}
        actions={
          <>
            <Button variant="outline" onClick={() => exportSession(record)}>
              <Download className="h-3.5 w-3.5" />
              Export JSON
            </Button>
            <Link href={`/agents/${agent.id}/sandbox`}>
              <Button variant="secondary">
                <FlaskConical className="h-3.5 w-3.5" />
                Open in sandbox
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Panel className="overflow-hidden">
            <div className="border-b border-line px-5 py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-accent">
                    AI summary
                  </p>
                  <h2 className="mt-1.5 max-w-2xl font-display text-[25px] font-light leading-snug tracking-[-0.025em] text-ink">
                    {summary.headline}
                  </h2>
                </div>
                <Badge tone={record.status === "abandoned" ? "red" : record.status === "transferred" ? "amber" : "green"} dot>
                  {summary.resolution}
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <div>
                  <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-2">Intent</p>
                  <p className="mt-1 text-[11.5px] font-medium text-ink">{summary.intent}</p>
                </div>
                <div>
                  <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-2">Outcome</p>
                  <p className="mt-1 text-[11.5px] font-medium text-ink">{summary.outcome}</p>
                </div>
                <div>
                  <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-2">Handled by</p>
                  <p className="mt-1 text-[11.5px] font-medium text-ink">
                    {record.handledBy === "hybrid" ? "AI + Human" : "AI"}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-2">CSAT</p>
                  <p className="mt-1 text-[11.5px] font-medium text-ink">
                    {record.csat ? `${record.csat.toFixed(1)} / 5` : "Not rated"}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div>
                  <p className="font-display text-[17px] font-normal tracking-[-0.015em] text-ink">What happened</p>
                  <ul className="mt-2 space-y-2">
                    {summary.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2 text-[11.5px] leading-relaxed text-muted">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-green/20 bg-green/[0.08] text-green">
                          <Check className="h-2.5 w-2.5" />
                        </span>
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-none border border-line bg-surface-2/50 p-3">
                  <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-2">
                    Key moments
                  </p>
                  <div className="mt-3 space-y-0">
                    {summary.keyMoments.map((moment, index) => (
                      <div key={`${moment.at}-${moment.label}`} className="flex gap-2.5">
                        <div className="flex flex-col items-center">
                          <span
                            className={cn(
                              "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                              moment.type === "handoff"
                                ? "bg-cyan"
                                : moment.type === "risk"
                                  ? "bg-amber"
                                  : moment.type === "resolution"
                                    ? "bg-green"
                                    : "bg-accent",
                            )}
                          />
                          {index < summary.keyMoments.length - 1 ? (
                            <span className="my-0.5 w-px flex-1 bg-line" />
                          ) : null}
                        </div>
                        <div className="pb-2.5">
                          <p className="text-[9.5px] leading-snug text-ink/85">{moment.label}</p>
                          <p className="font-mono text-[8px] text-muted-2">{formatDuration(moment.at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-muted-2" />
                <p className="text-[12px] font-medium text-ink">Transcript</p>
                <Badge tone="outline">{transcript.length} turns</Badge>
              </div>
              <div className="flex items-center gap-2">
                <LanguageTag language={record.language} variant="compact" />
                <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-muted-2">
                  {formatDuration(record.durationSec)}
                </span>
              </div>
            </div>
            <div className="scrollbar-thin max-h-[620px] space-y-3 overflow-y-auto p-4">
              {transcript.map((turn) => (
                <TranscriptRow key={turn.id} turn={turn} />
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel className="p-4">
            <SectionTitle title="Details" />
            <div className="mt-3 space-y-2 text-[10.5px]">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="text-muted">Session</span>
                <span className="font-mono text-ink">{record.id}</span>
              </div>
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="text-muted">Agent</span>
                <Link href={`/agents/${agent.id}`} className="flex items-center gap-1.5 text-ink hover:text-accent">
                  <AgentAvatar name={agent.name} color={agent.color} size="xs" />
                  {agent.name}
                </Link>
              </div>
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="text-muted">Started</span>
                <span className="text-ink">{formatDateTime(record.startedAt)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="text-muted">Duration</span>
                <span className="font-mono text-ink">{formatDuration(record.durationSec)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="text-muted">Language</span>
                <LanguageTag language={record.language} />
              </div>
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="text-muted">Handled by</span>
                <HandledByBadge session={record} />
              </div>
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="text-muted">Turns</span>
                <span className="font-mono text-ink">{record.turnCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">CSAT</span>
                <span className="font-mono text-ink">{record.csat ? record.csat.toFixed(1) : "—"}</span>
              </div>
            </div>
          </Panel>

          <Panel className="p-4">
            <SectionTitle title="Handoff log" />
            {record.handoffs && record.handoffs.length ? (
              <div className="mt-3 space-y-3">
                {record.handoffs.map((handoff, index) => (
                  <div key={index} className="rounded-none border border-cyan/20 bg-cyan/[0.035] p-3">
                    <div className="flex items-center justify-between">
                      <Badge tone="cyan" dot>
                        {handoff.status}
                      </Badge>
                      <span className="font-mono text-[8.5px] text-muted-2">
                        {handoff.supervisor ?? "Specialist"}
                      </span>
                    </div>
                    <p className="mt-2 text-[10.5px] leading-relaxed text-ink/85">{handoff.reason}</p>
                    <div className="mt-2 space-y-1 border-t border-line pt-2 font-mono text-[8.5px] text-muted-2">
                      <p>requested {formatRelative(new Date(handoff.requestedAt).toISOString())}</p>
                      {handoff.acceptedAt ? (
                        <p>accepted {new Date(handoff.acceptedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
                      ) : null}
                      {handoff.completedAt ? (
                        <p>returned {new Date(handoff.completedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
                      ) : null}
                    </div>
                    {handoff.note ? (
                      <p className="mt-2 text-[9.5px] leading-relaxed text-muted">{handoff.note}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : derivedHandoff ? (
              <div className="mt-3 space-y-3">
                <div className="rounded-none border border-cyan/20 bg-cyan/[0.035] p-3">
                  <div className="flex items-center justify-between">
                    <Badge tone="cyan" dot>
                      completed
                    </Badge>
                    <span className="font-mono text-[8.5px] text-muted-2">Sara Malik</span>
                  </div>
                  <p className="mt-2 text-[10.5px] leading-relaxed text-ink/85">
                    {record.transferReason ?? "Policy exception"}
                  </p>
                  <div className="mt-2 space-y-1 border-t border-line pt-2 font-mono text-[8.5px] text-muted-2">
                    <p>requested {formatDuration(handoffAtSec)} into the call</p>
                    <p>accepted {formatDuration(handoffAtSec + 8)}</p>
                    <p>returned {formatDuration(returnedAtSec)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2 rounded-none border border-line bg-surface-2/50 p-3">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green" />
                <p className="text-[10.5px] text-muted">No handoff</p>
              </div>
            )}
          </Panel>

          <Panel className="p-4">
            <SectionTitle
              title="Recommendation"
              action={
                <Link
                  href={`/agents/${agent.id}`}
                  className="inline-flex items-center gap-1 text-[10px] text-muted hover:text-ink"
                >
                  Edit agent <ArrowUpRight className="h-2.5 w-2.5" />
                </Link>
              }
            />
            <p className="mt-2 text-[10.5px] leading-relaxed text-muted">{summary.recommendation}</p>
          </Panel>

          <Panel className="p-4">
            <SectionTitle title="Recording" />
            <div className="mt-3">
              <RecordingPlayer durationSec={record.durationSec} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
