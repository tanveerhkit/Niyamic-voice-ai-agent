"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Headphones,
  MessageSquare,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { useAllSessions, useLiveSessions } from "@/lib/live-store";
import {
  computeAgentPerformance,
  computeOverview,
  computeTransferReasons,
  computeVolumeSeries,
} from "@/lib/analytics";
import { formatHandleTime } from "@/lib/utils";
import { useActiveCalls } from "@/lib/voice-api";
import {
  AgentPerformanceList,
  LiveNowCard,
  MetricCard,
  PageHeader,
  SessionTable,
  TransferReasonList,
} from "@/components/dashboard";
import { Badge, Button, Panel, SectionTitle } from "@/components/ui";
import { ContainmentTrend, SessionsChart } from "@/components/charts";

const VOICE_STATE: Record<string, string> = {
  listening: "AI listening",
  idle: "AI listening",
  thinking: "AI thinking",
  speaking: "AI speaking",
};

export default function OverviewPage() {
  const sessions = useAllSessions();
  const liveSessions = useLiveSessions();
  const activeCalls = useActiveCalls();
  const [chartMode, setChartMode] = useState<"volume" | "containment">("volume");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const overview = useMemo(() => computeOverview(sessions), [sessions]);
  const volume = useMemo(() => computeVolumeSeries(sessions, 14), [sessions]);
  const reasons = useMemo(() => computeTransferReasons(sessions), [sessions]);
  const performance = useMemo(() => computeAgentPerformance(sessions), [sessions]);

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
  const scriptedRows = liveSessions
    .filter((session) => session.status !== "ended")
    .map((session) => ({
      id: session.id,
      agentId: session.agentId,
      customerName: session.customerName,
      language: session.language,
      elapsedSec: Math.floor((now - session.startedAt) / 1000),
      risk: session.risk,
      state:
        session.status === "escalating"
          ? "Awaiting human"
          : session.status === "human_active"
            ? "Human active"
            : "AI active",
    }));
  const liveCount = voiceRows.length + scriptedRows.length;
  const liveRows = [...voiceRows, ...scriptedRows].slice(0, 3);

  const transfers = Math.round((overview.transferRate / 100) * overview.total);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-7 lg:py-8">
      <PageHeader
        title="Overview"
        actions={
          <Button variant="outline">
            <CalendarDays className="h-3.5 w-3.5" />
            Last 30 days
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Conversations"
          value={overview.total.toLocaleString()}
          detail="30-day total"
          trend={12.4}
          trendLabel="vs. prior 30d"
          spark={[72, 88, 81, 96, 92, 110, 104, 118]}
          icon={<MessageSquare className="h-4 w-4" />}
        />
        <MetricCard
          label="AI containment"
          value={overview.containmentRate.toFixed(1)}
          suffix="%"
          detail="Resolved without a handoff"
          trend={2.1}
          trendLabel="up from 76.3%"
          spark={[74, 76, 75.5, 77, 76.8, 78, 77.6, 78.4]}
          tone="accent"
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <MetricCard
          label="Human transfers"
          value={overview.transferRate.toFixed(1)}
          suffix="%"
          detail={`${transfers} transfers`}
          trend={-0.8}
          trendLabel="down from 15%"
          spark={[16, 15.2, 15.8, 14.9, 15.1, 14.4, 14.7, 14.2]}
          tone="amber"
          icon={<Headphones className="h-4 w-4" />}
        />
        <MetricCard
          label="Avg. handle time"
          value={formatHandleTime(overview.avgDurationSec)}
          detail="Across all sessions"
          trend={-4.2}
          trendLabel="18s faster"
          spark={[246, 238, 242, 231, 228, 226, 225, 222]}
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
                  <span className="ml-1.5 font-mono text-[9.5px] text-accent">
                    {overview.containmentRate.toFixed(1)}%
                  </span>
                </p>
              </div>
              <div className="border-r border-line px-5 py-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-2">
                  Transferred
                </p>
                <p className="mt-1 text-[15px] font-medium text-ink">
                  {transfers.toLocaleString()}
                  <span className="ml-1.5 font-mono text-[9.5px] text-amber">
                    {overview.transferRate.toFixed(1)}%
                  </span>
                </p>
              </div>
              <div className="px-5 py-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-2">
                  Resolution rate
                </p>
                <p className="mt-1 text-[15px] font-medium text-ink">
                  {overview.resolutionRate.toFixed(1)}
                  <span className="ml-0.5 text-[10px] text-muted-2">%</span>
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
              <SessionTable sessions={sessions} limit={7} />
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
              action={<Badge tone="outline">{transfers}</Badge>}
            />
            <div className="mt-4">
              <TransferReasonList reasons={reasons} />
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
              <AgentPerformanceList performance={performance} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
