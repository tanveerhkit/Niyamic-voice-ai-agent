"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Headphones,
  Languages,
  MessageSquare,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Timer,
  Users,
} from "lucide-react";
import { useAllSessions, useLiveSessions } from "@/lib/live-store";
import {
  computeAgentPerformance,
  computeInsights,
  computeLanguageMix,
  computeOverview,
  computeSentimentMix,
  computeTransferReasons,
  computeVolumeSeries,
} from "@/lib/analytics";
import { demoLiveSessions, demoNowLabel } from "@/lib/seed";
import { formatHandleTime } from "@/lib/utils";
import {
  AgentPerformanceList,
  LiveNowCard,
  MetricCard,
  SessionTable,
  TransferReasonList,
} from "@/components/dashboard";
import { StartCallButton } from "@/components/start-call";
import { Badge, Button, Panel, SectionTitle } from "@/components/ui";
import { ContainmentTrend, Donut, SessionsChart } from "@/components/charts";

export default function OverviewPage() {
  const sessions = useAllSessions();
  const liveSessions = useLiveSessions();
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
  const languages = useMemo(() => computeLanguageMix(sessions), [sessions]);
  const sentiment = useMemo(() => computeSentimentMix(sessions), [sessions]);
  const performance = useMemo(() => computeAgentPerformance(sessions), [sessions]);
  const insights = useMemo(() => computeInsights(sessions), [sessions]);

  const active = liveSessions.filter((session) => session.status !== "ended").slice(0, 3);
  const liveRows = active.length
    ? active.map((session) => ({
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
      }))
    : demoLiveSessions;

  const languageDonut = languages.map((item, index) => ({
    name: item.label,
    value: item.count,
    color: ["#221e1c", "#6b5a7d", "#3f6b63"][index] ?? "#221e1c",
  }));

  const sentimentDonut = sentiment.map((item, index) => ({
    name: item.label,
    value: item.count,
    color: ["#4a6b45", "#96908a", "#a33a2a"][index] ?? "#4a6b45",
  }));

  const transfers = Math.round((overview.transferRate / 100) * overview.total);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-5 lg:px-7 lg:py-6">
      <section className="panel-ink relative overflow-hidden">
        <div className="grid-bg-dark pointer-events-none absolute inset-0 opacity-70" />
        <div className="relative grid gap-10 p-6 md:p-10 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-14 lg:p-12">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/50">
                AI-native voice operations
              </p>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
                {demoNowLabel}
              </p>
            </div>

            <h1 className="mt-8 max-w-[720px] font-display text-[42px] font-light leading-[1.02] tracking-[-0.035em] text-[#f8f7f6] md:text-[62px] lg:text-[68px]">
              Every conversation,
              <br />
              <span className="italic text-white/55">handled.</span>
            </h1>

            <p className="mt-6 max-w-[520px] text-[13px] leading-[1.8] text-white/55">
              AI runs the call until it has a reason not to. Humans take over in the same
              session — with the full transcript, intent, and context already in hand.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="md"
                className="border-white/25 bg-white/5 text-[#f8f7f6] hover:border-white hover:bg-white hover:text-ink"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Last 30 days
              </Button>
              <StartCallButton />
            </div>
          </div>

          <div className="self-end border border-white/15">
            <p className="border-b border-white/15 px-4 py-3 font-mono text-[8.5px] uppercase tracking-[0.2em] text-white/40">
              Decision loop
            </p>
            {[
              { n: "01", t: "Listen", d: "Streaming STT · language auto-detect" },
              { n: "02", t: "Decide", d: "Policy, confidence and risk gates" },
              { n: "03", t: "Hand off", d: "Human joins with the full context" },
            ].map((step, index) => (
              <div
                key={step.n}
                className={`flex items-start gap-4 px-4 py-4 ${index > 0 ? "border-t border-white/15" : ""}`}
              >
                <span className="mt-0.5 font-mono text-[9px] tracking-[0.1em] text-white/35">
                  {step.n}
                </span>
                <div>
                  <p className="font-display text-[19px] font-light leading-tight text-[#f8f7f6]">
                    {step.t}
                  </p>
                  <p className="mt-1 font-mono text-[8.5px] uppercase leading-relaxed tracking-[0.1em] text-white/40">
                    {step.d}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
              <SectionTitle
                title="Conversation volume"
                description="Daily sessions split by how they were handled."
              />
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
                  <span className="ml-1.5 font-mono text-[9.5px] text-green">healthy</span>
                </p>
              </div>
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <SectionTitle
                title="Recent sessions"
                description="Every call is stored with transcript, summary, and handoff record."
              />
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
                <SectionTitle title="Live now" />
                <Badge tone="red" dot>
                  {liveRows.length} calls
                </Badge>
              </div>
              <Link
                href="/supervisor"
                className="inline-flex items-center gap-1 text-[10.5px] font-medium text-muted transition-colors hover:text-ink"
              >
                Supervisor <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <LiveNowCard sessions={liveRows} />
            <Link href="/supervisor" className="mt-3 block">
              <div className="flex items-center justify-between rounded-none border border-dashed border-line-strong bg-surface-2 px-3 py-2.5 transition-colors hover:bg-surface-3">
                <div className="flex items-center gap-2">
                  <Headphones className="h-3.5 w-3.5 text-cyan" />
                  <span className="text-[11px] text-muted">Human desk is staffed</span>
                </div>
                <span className="font-mono text-[9px] text-green">2 available</span>
              </div>
            </Link>
          </Panel>

          <Panel className="p-4">
            <SectionTitle
              title="Why calls escalate"
              description="Transfer reasons across the last 30 days."
              action={<Badge tone="outline">{transfers}</Badge>}
            />
            <div className="mt-4">
              <TransferReasonList reasons={reasons} />
            </div>
            <Link
              href="/analytics"
              className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[11px] text-muted transition-colors hover:text-ink"
            >
              <span>Policy exceptions are the top driver</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </Panel>

          <Panel className="p-4">
            <SectionTitle
              title="Agent performance"
              description="Containment by active agent."
              action={<Users className="h-4 w-4 text-muted-2" />}
            />
            <div className="mt-3">
              <AgentPerformanceList performance={performance} />
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel className="p-4">
          <SectionTitle
            title="Language mix"
            description="Detected automatically during the call."
            action={<Languages className="h-4 w-4 text-muted-2" />}
          />
          <div className="mt-2 grid grid-cols-[140px_minmax(0,1fr)] items-center gap-3">
            <Donut data={languageDonut} centerValue={overview.total.toLocaleString()} centerLabel="sessions" />
            <div className="space-y-2.5">
              {languages.map((item, index) => (
                <div key={item.language} className="flex items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: ["#221e1c", "#6b5a7d", "#3f6b63"][index] }}
                  />
                  <span className="flex-1 text-[11px] text-muted">{item.label}</span>
                  <span className="font-mono text-[10px] text-ink">{item.share.toFixed(0)}%</span>
                  <span className="w-10 text-right font-mono text-[9px] text-muted-2">
                    {item.containment.toFixed(0)}% c.
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel className="p-4">
          <SectionTitle
            title="Customer sentiment"
            description="Post-call classification from the summary."
            action={<Sparkles className="h-4 w-4 text-muted-2" />}
          />
          <div className="mt-2 grid grid-cols-[140px_minmax(0,1fr)] items-center gap-3">
            <Donut
              data={sentimentDonut}
              centerValue={overview.avgCsat.toFixed(1)}
              centerLabel="avg CSAT"
            />
            <div className="space-y-2.5">
              {sentiment.map((item, index) => (
                <div key={item.sentiment} className="flex items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: ["#4a6b45", "#96908a", "#a33a2a"][index] }}
                  />
                  <span className="flex-1 text-[11px] text-muted">{item.label}</span>
                  <span className="font-mono text-[10px] text-ink">{item.share.toFixed(0)}%</span>
                </div>
              ))}
              <div className="border-t border-line pt-2">
                <p className="text-[10px] leading-relaxed text-muted-2">
                  Negative sentiment triggers a transfer when the customer asks for a human.
                </p>
              </div>
            </div>
          </div>
        </Panel>

        <Panel className="p-4 md:col-span-2 xl:col-span-1">
          <SectionTitle
            title="Needs attention"
            description="Where the agent is asking for help."
            action={
              <Link href="/analytics" className="text-[10.5px] text-muted hover:text-ink">
                Analytics
              </Link>
            }
          />
          <div className="mt-3 space-y-3">
            {insights.map((insight) => (
              <div key={insight.title} className="rounded-none border border-line bg-surface-2/60 p-3">
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-none ${
                      insight.tone === "risk"
                        ? "bg-red/10 text-red"
                        : insight.tone === "warning"
                          ? "bg-amber/10 text-amber"
                          : "bg-cyan/10 text-cyan"
                    }`}
                  >
                    <CircleDollarSign className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11.5px] font-medium leading-snug text-ink">{insight.title}</p>
                    <p className="mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-muted">
                      {insight.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-none border border-line bg-surface-2 px-4 py-3">
        <div className="flex items-center gap-2 text-[10.5px] text-muted-2">
          <PhoneCall className="h-3.5 w-3.5 text-muted-2" />
          <span>
            Demo dataset: 1,284 simulated sessions · all times in local timezone · sandbox runtime
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="outline">LiveKit</Badge>
          <Badge tone="outline">Azure STT</Badge>
          <Badge tone="outline">Human transfer</Badge>
        </div>
      </div>
    </div>
  );
}
