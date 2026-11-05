"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronRight, Minus } from "lucide-react";
import { cn, formatDuration, formatRelative, LANGUAGE_SHORT } from "@/lib/utils";
import { agentName } from "@/lib/seed";
import type { SessionRecord } from "@/lib/types";
import { AgentAvatar, LanguageTag } from "./brand";
import { Badge, Panel, Progress } from "./ui";
import { Sparkline } from "./charts";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-5 pb-6 md:flex-row md:items-end">
      <div className="max-w-2xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent/80">{eyebrow}</p>
        <h1 className="mt-2 text-[27px] font-medium leading-[1.12] tracking-[-0.035em] text-ink md:text-[32px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  suffix,
  detail,
  trend,
  trendLabel,
  spark,
  tone = "accent",
  icon,
}: {
  label: string;
  value: string;
  suffix?: string;
  detail: string;
  trend?: number;
  trendLabel?: string;
  spark?: number[];
  tone?: "accent" | "cyan" | "amber" | "violet" | "red";
  icon?: React.ReactNode;
}) {
  const tones = {
    accent: "#c9f76f",
    cyan: "#6fe3f5",
    amber: "#ffb84d",
    violet: "#b6a4ff",
    red: "#ff6b6b",
  };
  const trendUp = (trend ?? 0) > 0;
  const trendFlat = (trend ?? 0) === 0;

  return (
    <Panel className="relative overflow-hidden p-4">
      <div className="flex items-start justify-between">
        <p className="text-[11.5px] font-medium text-muted">{label}</p>
        {icon ? <span className="text-muted-2">{icon}</span> : null}
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-[27px] font-semibold leading-none tracking-[-0.045em] text-ink">
          {value}
        </span>
        {suffix ? <span className="text-[12px] text-muted-2">{suffix}</span> : null}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {typeof trend === "number" ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 font-mono text-[9.5px]",
                trendFlat
                  ? "bg-white/[0.05] text-muted"
                  : trendUp
                    ? "bg-green/10 text-green"
                    : "bg-red/10 text-red",
              )}
            >
              {trendFlat ? (
                <Minus className="h-2.5 w-2.5" />
              ) : trendUp ? (
                <ArrowUpRight className="h-2.5 w-2.5" />
              ) : (
                <ArrowDownRight className="h-2.5 w-2.5" />
              )}
              {Math.abs(trend).toFixed(1)}%
            </span>
          ) : null}
          <span className="truncate text-[10px] text-muted-2">{trendLabel ?? detail}</span>
        </div>
        {spark ? <Sparkline values={spark} tone={tones[tone]} /> : null}
      </div>
    </Panel>
  );
}

export function SessionStatusBadge({ session }: { session: SessionRecord }) {
  if (session.status === "abandoned") return <Badge tone="red" dot>Abandoned</Badge>;
  if (session.status === "transferred") return <Badge tone="amber" dot>Transferred</Badge>;
  return <Badge tone="green" dot>Resolved</Badge>;
}

export function HandledByBadge({ session }: { session: SessionRecord }) {
  if (session.handledBy === "hybrid") return <Badge tone="human">AI + Human</Badge>;
  if (session.handledBy === "human") return <Badge tone="human">Human</Badge>;
  return <Badge tone="accent">AI</Badge>;
}

export function SessionTable({
  sessions,
  limit,
}: {
  sessions: SessionRecord[];
  limit?: number;
}) {
  const rows = limit ? sessions.slice(0, limit) : sessions;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            {["Customer", "Agent", "Intent", "Language", "Handling", "Duration", "CSAT", "When", ""].map(
              (header) => (
                <th
                  key={header}
                  className="px-4 py-2.5 font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-muted-2 first:pl-5 last:pr-4"
                >
                  {header}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((session) => (
            <tr
              key={session.id}
              className="group border-b border-line/60 transition-colors last:border-0 hover:bg-white/[0.025]"
            >
              <td className="py-2.5 pl-5 pr-4">
                <Link href={`/sessions/${session.id}`} className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-white/[0.035] font-mono text-[9px] text-muted">
                    {session.customerName
                      .split(" ")
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-medium text-ink">
                      {session.customerName}
                    </span>
                    <span className="block font-mono text-[9px] text-muted-2">{session.id}</span>
                  </span>
                </Link>
              </td>
              <td className="px-4 py-2.5 text-[11.5px] text-muted">{agentName(session.agentId)}</td>
              <td className="max-w-[160px] px-4 py-2.5">
                <span className="block truncate text-[11.5px] text-ink/85">{session.intent}</span>
                <span className="mt-0.5 block">
                  <SessionStatusBadge session={session} />
                </span>
              </td>
              <td className="px-4 py-2.5">
                <LanguageTag language={session.language} variant="compact" />
              </td>
              <td className="px-4 py-2.5">
                <HandledByBadge session={session} />
              </td>
              <td className="px-4 py-2.5 font-mono text-[10.5px] text-muted">
                {formatDuration(session.durationSec)}
              </td>
              <td className="px-4 py-2.5 font-mono text-[10.5px] text-muted">
                {session.csat ? session.csat.toFixed(1) : "—"}
              </td>
              <td className="px-4 py-2.5 font-mono text-[9.5px] text-muted-2">
                {formatRelative(session.startedAt)}
              </td>
              <td className="py-2.5 pl-2 pr-4 text-right">
                <Link
                  href={`/sessions/${session.id}`}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-2 opacity-0 transition-all hover:bg-white/[0.06] hover:text-ink group-hover:opacity-100"
                  aria-label="Open session"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TransferReasonList({
  reasons,
}: {
  reasons: Array<{ reason: string; count: number; share: number }>;
}) {
  const tones = ["accent", "cyan", "amber", "violet", "red"] as const;

  return (
    <div className="space-y-3">
      {reasons.slice(0, 5).map((reason, index) => (
        <div key={reason.reason}>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="truncate text-[11.5px] text-muted">{reason.reason}</span>
            <span className="font-mono text-[10px] text-ink">{Math.round(reason.share)}%</span>
          </div>
          <Progress value={reason.share} tone={tones[index % tones.length]} />
        </div>
      ))}
    </div>
  );
}

export function AgentPerformanceList({
  performance,
}: {
  performance: Array<{
    agent: { id: string; name: string; color: "lime" | "cyan" | "violet" | "amber"; role: string };
    sessions: number;
    containment: number;
    transferRate: number;
    csat: number;
  }>;
}) {
  return (
    <div className="space-y-1">
      {performance.map((item) => (
        <Link
          key={item.agent.id}
          href={`/agents/${item.agent.id}`}
          className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[0.03]"
        >
          <AgentAvatar name={item.agent.name} color={item.agent.color} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[12px] font-medium text-ink">{item.agent.name}</p>
              <span className="font-mono text-[10px] text-accent">{item.containment.toFixed(0)}%</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <Progress value={item.containment} className="h-1" />
              <span className="shrink-0 font-mono text-[9px] text-muted-2">
                {item.sessions.toLocaleString()} calls
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function LiveNowCard({
  sessions,
}: {
  sessions: Array<{
    id: string;
    agentId: string;
    customerName: string;
    language: "en" | "ur" | "hi";
    elapsedSec: number;
    risk: "low" | "medium" | "high";
    state: string;
  }>;
}) {
  return (
    <div className="space-y-2">
      {sessions.map((session) => (
        <div
          key={session.id}
          className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.022] px-3 py-2.5"
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red opacity-40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11.5px] font-medium text-ink">
              {session.customerName}
              <span className="ml-1.5 font-normal text-muted-2">· {agentName(session.agentId)}</span>
            </p>
            <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-2">
              {LANGUAGE_SHORT[session.language]} · {formatDuration(session.elapsedSec)} · {session.state}
            </p>
          </div>
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              session.risk === "high" ? "bg-red" : session.risk === "medium" ? "bg-amber" : "bg-green",
            )}
          />
        </div>
      ))}
    </div>
  );
}
