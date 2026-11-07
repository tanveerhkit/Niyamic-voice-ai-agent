"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  ChevronRight,
  Headphones,
  MessageSquare,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { useRealSessions } from "@/lib/live-store";
import {
  computeAgentPerformance,
  computeDailyValues,
  computeOverview,
  computeTransferReasons,
  computeVolumeSeries,
  type Overview,
} from "@/lib/analytics";
import type { SessionRecord } from "@/lib/types";
import { formatHandleTime } from "@/lib/utils";
import { refreshRecordedSessions, useActiveCalls } from "@/lib/voice-api";
import {
  AgentPerformanceList,
  LiveNowCard,
  MetricCard,
  PageHeader,
  SessionTable,
  TransferReasonList,
} from "@/components/dashboard";
import { Badge, Panel, SectionTitle } from "@/components/ui";
import { ContainmentTrend, SessionsChart } from "@/components/charts";

const VOICE_STATE: Record<string, string> = {
  listening: "AI listening",
  idle: "AI listening",
  thinking: "AI thinking",
  speaking: "AI speaking",
};

const DAY = 86_400_000;
const PERIOD_DAYS = 30;
const SPARK_DAYS = 14;

/** Sessions that started between `fromDay` and `toDay` days before `endMs`. */
function withinDays(sessions: SessionRecord[], endMs: number, fromDay: number, toDay: number) {
  return sessions.filter((session) => {
    const age = endMs - new Date(session.startedAt).getTime();
    return age >= fromDay * DAY && age < toDay * DAY;
  });
}

/** Percentage change, or undefined when there is nothing to compare against. */
function percentChange(current: number, previous: number | undefined) {
  return previous ? ((current - previous) / previous) * 100 : undefined;
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export default function HomePage() {
  const { sessions: calls, loaded, offline } = useRealSessions();
  const activeCalls = useActiveCalls();
  const [chartMode, setChartMode] = useState<"volume" | "containment">("volume");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  // A call that just ended shows up without waiting for the next history poll.
  const activeCount = activeCalls.calls.length;
  useEffect(() => {
    refreshRecordedSessions();
  }, [activeCount]);

  // The 30-day window moves once a minute, not with every clock tick.
  const periodEnd = now - (now % 60_000);
  const current = useMemo(() => withinDays(calls, periodEnd, 0, PERIOD_DAYS), [calls, periodEnd]);
  const previous = useMemo(
    () => withinDays(calls, periodEnd, PERIOD_DAYS, PERIOD_DAYS * 2),
    [calls, periodEnd],
  );
  const overview = useMemo(() => computeOverview(current), [current]);
  const prior = useMemo<Overview | null>(
    () => (previous.length ? computeOverview(previous) : null),
    [previous],
  );
  const volume = useMemo(
    () => computeVolumeSeries(current, PERIOD_DAYS, periodEnd),
    [current, periodEnd],
  );
  const reasons = useMemo(() => computeTransferReasons(current), [current]);
  const performance = useMemo(
    () => computeAgentPerformance(current).filter((item) => item.sessions > 0),
    [current],
  );
  const sparks = useMemo(() => {
    const daily = (value: (day: Overview) => number) =>
      computeDailyValues(current, (day) => value(computeOverview(day)), SPARK_DAYS, periodEnd);
    return {
      containment: daily((day) => day.containmentRate),
      transfers: daily((day) => day.transferRate),
      handleTime: daily((day) => day.avgDurationSec),
    };
  }, [current, periodEnd]);

  const voiceRows = activeCalls.calls.map((call) => ({
    id: call.id,
    agentId: call.agentId,
    agentLabel: call.agentName,
    customerName: call.customerName,
    language: "en" as const,
    elapsedSec: call.elapsedSec + Math.max(0, Math.floor((now - activeCalls.fetchedAt) / 1000)),
    state:
      call.handoff === "requested"
        ? "Awaiting human"
        : call.specialistName
          ? "Human active"
          : (VOICE_STATE[call.agentState] ?? "Connecting"),
  }));
  const liveCount = voiceRows.length;
  const liveRows = voiceRows.slice(0, 3);

  const hasCalls = overview.total > 0;
  const transfers = overview.transferred;
  const escalations = reasons.reduce((sum, reason) => sum + reason.count, 0);
  const handleDelta = prior ? overview.avgDurationSec - prior.avgDurationSec : 0;
  // Rates and averages mean nothing without calls, so they show a dash instead of 0.
  const rate = (value: string) => (hasCalls ? value : "—");
  const trendOf = (value: (overview: Overview) => number) =>
    hasCalls && prior ? value(overview) - value(prior) : undefined;
  const fromPrior = (value: (overview: Overview) => number) =>
    hasCalls && prior ? `from ${value(prior).toFixed(1)}% prior 30d` : undefined;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-7 lg:py-8">
      <PageHeader
        title="Home"
        description={
          offline
            ? "Couldn't load call history from the voice backend, so only calls recorded in this browser are shown."
            : undefined
        }
        actions={<Badge tone="outline">Last 30 days</Badge>}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Conversations"
          value={loaded ? overview.total.toLocaleString() : "—"}
          detail="30-day total"
          trend={hasCalls ? percentChange(overview.total, prior?.total) : undefined}
          trendLabel={hasCalls && prior ? "vs. prior 30d" : undefined}
          spark={hasCalls ? volume.slice(-SPARK_DAYS).map((point) => point.total) : undefined}
          icon={<MessageSquare className="h-4 w-4" />}
        />
        <MetricCard
          label="AI containment"
          value={rate(overview.containmentRate.toFixed(1))}
          suffix={hasCalls ? "%" : undefined}
          detail="Resolved without a handoff"
          trend={trendOf((o) => o.containmentRate)}
          trendLabel={fromPrior((o) => o.containmentRate)}
          spark={sparks.containment}
          tone="accent"
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <MetricCard
          label="Human transfers"
          value={rate(overview.transferRate.toFixed(1))}
          suffix={hasCalls ? "%" : undefined}
          detail={plural(transfers, "transfer")}
          trend={trendOf((o) => o.transferRate)}
          trendLabel={fromPrior((o) => o.transferRate)}
          spark={sparks.transfers}
          tone="amber"
          icon={<Headphones className="h-4 w-4" />}
        />
        <MetricCard
          label="Avg. handle time"
          value={rate(formatHandleTime(overview.avgDurationSec))}
          detail="Across all calls"
          trend={hasCalls ? percentChange(overview.avgDurationSec, prior?.avgDurationSec) : undefined}
          trendLabel={
            hasCalls && prior
              ? handleDelta === 0
                ? "same as prior 30d"
                : `${Math.abs(handleDelta)}s ${handleDelta < 0 ? "faster" : "slower"}`
              : undefined
          }
          spark={sparks.handleTime}
          tone="cyan"
          icon={<Timer className="h-4 w-4" />}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.62fr)_minmax(340px,1fr)]">
        <div className="space-y-4">
          <Panel className="overflow-hidden">
            <div className="flex flex-col justify-between gap-3 p-5 pb-1 sm:flex-row sm:items-start">
              <SectionTitle title="Conversation volume" />
              <div className="flex items-center gap-3">
                <div className="hidden items-center gap-3 md:flex">
                  <span className="flex items-center gap-1.5 text-[10px] text-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" /> AI contained
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] text-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber" /> Transferred
                  </span>
                </div>
                <div className="flex rounded-none border border-line bg-surface p-0.5">
                  <button
                    type="button"
                    onClick={() => setChartMode("volume")}
                    className={`rounded-none px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors ${
                      chartMode === "volume" ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"
                    }`}
                  >
                    Volume
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMode("containment")}
                    className={`rounded-none px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors ${
                      chartMode === "containment"
                        ? "bg-accent text-accent-ink"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    Containment
                  </button>
                </div>
              </div>
            </div>
            <div className="px-2 pb-3">
              {chartMode === "volume" ? (
                <SessionsChart data={volume} />
              ) : (
                <ContainmentTrend data={volume} height={248} />
              )}
            </div>
            <div className="grid grid-cols-3 border-t border-line">
              <div className="border-r border-line px-5 py-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-2">
                  AI contained
                </p>
                <p className="mt-1 text-[15px] font-medium text-ink">
                  {overview.contained.toLocaleString()}
                  {hasCalls ? (
                    <span className="ml-1.5 font-mono text-[9.5px] text-accent">
                      {overview.containmentRate.toFixed(1)}%
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="border-r border-line px-5 py-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-2">
                  Transferred
                </p>
                <p className="mt-1 text-[15px] font-medium text-ink">
                  {transfers.toLocaleString()}
                  {hasCalls ? (
                    <span className="ml-1.5 font-mono text-[9.5px] text-amber">
                      {overview.transferRate.toFixed(1)}%
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="px-5 py-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-2">
                  Resolution rate
                </p>
                <p className="mt-1 text-[15px] font-medium text-ink">
                  {rate(overview.resolutionRate.toFixed(1))}
                  {hasCalls ? <span className="ml-0.5 text-[10px] text-muted-2">%</span> : null}
                </p>
              </div>
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <SectionTitle title="Recent sessions" />
              <Link
                href="/sessions"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-muted transition-colors hover:text-ink"
              >
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="border-t border-line">
              {calls.length ? (
                <SessionTable sessions={calls} limit={7} />
              ) : (
                <p className="px-5 py-8 text-center text-[11px] text-muted">
                  {loaded ? "No calls yet. Finished customer calls appear here." : "Loading calls…"}
                </p>
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SectionTitle title="Live calls" />
                <Badge tone={liveCount ? "red" : "outline"} dot={liveCount > 0}>
                  {liveCount}
                </Badge>
              </div>
              <Link
                href="/supervisor"
                className="inline-flex items-center gap-1 text-[10.5px] font-medium text-muted transition-colors hover:text-ink"
              >
                Supervisor <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            {liveRows.length ? (
              <LiveNowCard sessions={liveRows} />
            ) : (
              <p className="border border-dashed border-line px-3 py-5 text-center text-[11px] text-muted">
                No calls in progress
              </p>
            )}
          </Panel>

          <Panel className="p-4">
            <SectionTitle
              title="Escalation reasons"
              action={<Badge tone="outline">{escalations}</Badge>}
            />
            <div className="mt-4">
              {reasons.length ? (
                <TransferReasonList reasons={reasons} />
              ) : (
                <p className="text-[11px] text-muted">No calls were escalated in the last 30 days.</p>
              )}
            </div>
          </Panel>

          <Panel className="p-4">
            <SectionTitle
              title="Agent performance"
              action={
                <Link href="/analytics" className="text-[10.5px] text-muted hover:text-ink">
                  Analytics
                </Link>
              }
            />
            <div className="mt-3">
              {performance.length ? (
                <AgentPerformanceList performance={performance} />
              ) : (
                <p className="text-[11px] text-muted">No agent has taken a call in the last 30 days.</p>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
