"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Download,
  Gauge,
  Headphones,
  Languages,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Timer,
  TriangleAlert,
  Users,
} from "lucide-react";
import { useAllSessions } from "@/lib/live-store";
import {
  computeAgentPerformance,
  computeInsights,
  computeIntentMix,
  computeLanguageMix,
  computeOverview,
  computeSentimentMix,
  computeTransferReasons,
  computeVolumeSeries,
} from "@/lib/analytics";
import { formatDuration, formatHandleTime, LANGUAGE_SHORT } from "@/lib/utils";
import { PageHeader, SessionStatusBadge } from "@/components/dashboard";
import { Badge, Button, Panel, Progress, SectionTitle } from "@/components/ui";
import {
  ContainmentTrend,
  Donut,
  IntentBars,
  SessionsChart,
} from "@/components/charts";

export default function AnalyticsPage() {
  const sessions = useAllSessions();
  const [chartMode, setChartMode] = useState<"volume" | "containment">("volume");

  const overview = useMemo(() => computeOverview(sessions), [sessions]);
  const volume = useMemo(() => computeVolumeSeries(sessions, 14), [sessions]);
  const reasons = useMemo(() => computeTransferReasons(sessions), [sessions]);
  const languages = useMemo(() => computeLanguageMix(sessions), [sessions]);
  const sentiment = useMemo(() => computeSentimentMix(sessions), [sessions]);
  const intents = useMemo(() => computeIntentMix(sessions, 7), [sessions]);
  const performance = useMemo(() => computeAgentPerformance(sessions), [sessions]);
  const insights = useMemo(() => computeInsights(sessions), [sessions]);
  const abandoned = useMemo(
    () => sessions.filter((session) => session.status === "abandoned").slice(0, 4),
    [sessions],
  );

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

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-7 lg:py-8">
      <PageHeader
        eyebrow="05 — Analytics · last 30 days · mock dataset"
        title={
          <>
            Where AI holds, and where it <span className="font-serif italic text-accent">hands off</span>.
          </>
        }
        description="Containment, escalation drivers, language performance, and the exact sessions that need attention. Every metric is traceable to a transcript."
        actions={
          <>
            <Button variant="outline">
              <CalendarDays className="h-3.5 w-3.5" />
              Last 30 days
            </Button>
            <Button variant="secondary">
              <Download className="h-3.5 w-3.5" />
              Export report
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Panel className="p-3.5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-2">Containment</p>
            <ShieldCheck className="h-3.5 w-3.5 text-accent" />
          </div>
          <p className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-ink">
            {overview.containmentRate.toFixed(1)}
            <span className="ml-0.5 text-[12px] font-normal text-muted-2">%</span>
          </p>
          <div className="mt-1.5 flex items-center gap-1 text-[9.5px] text-green">
            <ArrowUpRight className="h-2.5 w-2.5" /> 2.1 pts vs. last month
          </div>
        </Panel>
        <Panel className="p-3.5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-2">Transfer rate</p>
            <Headphones className="h-3.5 w-3.5 text-amber" />
          </div>
          <p className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-ink">
            {overview.transferRate.toFixed(1)}
            <span className="ml-0.5 text-[12px] font-normal text-muted-2">%</span>
          </p>
          <div className="mt-1.5 flex items-center gap-1 text-[9.5px] text-green">
            <ArrowDownRight className="h-2.5 w-2.5" /> 0.8 pts lower
          </div>
        </Panel>
        <Panel className="p-3.5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-2">Avg. handle</p>
            <Timer className="h-3.5 w-3.5 text-cyan" />
          </div>
          <p className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-ink">
            {formatHandleTime(overview.avgDurationSec)}
          </p>
          <div className="mt-1.5 flex items-center gap-1 text-[9.5px] text-muted-2">
            <MessageSquare className="h-2.5 w-2.5" /> {overview.total.toLocaleString()} sessions
          </div>
        </Panel>
        <Panel className="p-3.5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-2">CSAT</p>
            <Sparkles className="h-3.5 w-3.5 text-violet" />
          </div>
          <p className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-ink">
            {overview.avgCsat.toFixed(1)}
            <span className="ml-0.5 text-[12px] font-normal text-muted-2">/ 5</span>
          </p>
          <div className="mt-1.5 flex items-center gap-1 text-[9.5px] text-green">
            <ArrowUpRight className="h-2.5 w-2.5" /> 0.2 vs. last month
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
        <Panel className="overflow-hidden">
          <div className="flex flex-col justify-between gap-3 p-4 pb-0 sm:flex-row sm:items-start">
            <SectionTitle
              title="Sessions & containment"
              description="Daily view of the last 14 days."
            />
            <div className="flex rounded-none border border-line bg-surface p-0.5">
              <button
                type="button"
                onClick={() => setChartMode("volume")}
                className={`rounded-none px-2.5 py-1 text-[10.5px] font-medium transition-colors ${
                  chartMode === "volume" ? "bg-surface-3 text-ink" : "text-muted hover:text-ink"
                }`}
              >
                Volume
              </button>
              <button
                type="button"
                onClick={() => setChartMode("containment")}
                className={`rounded-none px-2.5 py-1 text-[10.5px] font-medium transition-colors ${
                  chartMode === "containment" ? "bg-surface-3 text-ink" : "text-muted hover:text-ink"
                }`}
              >
                Containment
              </button>
            </div>
          </div>
          <div className="px-2 pb-3">
            {chartMode === "volume" ? (
              <SessionsChart data={volume} height={270} />
            ) : (
              <ContainmentTrend data={volume} height={270} />
            )}
          </div>
        </Panel>

        <Panel className="flex flex-col p-4">
          <SectionTitle
            title="Why calls escalate"
            description="Transfer reasons · share of all handoffs."
            action={<TriangleAlert className="h-4 w-4 text-amber" />}
          />
          <div className="mt-4 space-y-3.5">
            {reasons.slice(0, 5).map((reason, index) => (
              <div key={reason.reason}>
                <div className="mb-1.5 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] text-muted-2">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[11.5px] text-ink">{reason.reason}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-[10px] text-ink">{Math.round(reason.share)}%</span>
                    <span className="ml-2 font-mono text-[8.5px] text-muted-2">{reason.count}</span>
                  </div>
                </div>
                <Progress
                  value={reason.share}
                  tone={index === 0 ? "amber" : index === 1 ? "cyan" : index === 2 ? "violet" : "accent"}
                />
              </div>
            ))}
          </div>
          <div className="mt-auto pt-4">
            <div className="rounded-none border border-amber/15 bg-amber/[0.04] p-3">
              <p className="text-[10.5px] leading-relaxed text-amber/90">
                Policy exceptions are the largest driver. That is a product decision — not a model
                limitation.
              </p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel className="p-4">
          <SectionTitle title="Language performance" description="Detected language vs. containment." />
          <div className="mt-3 grid grid-cols-[140px_minmax(0,1fr)] items-center gap-3">
            <Donut data={languageDonut} centerValue={`${overview.total.toLocaleString()}`} centerLabel="calls" />
            <div className="space-y-3">
              {languages.map((item, index) => (
                <div key={item.language}>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: ["#221e1c", "#6b5a7d", "#3f6b63"][index] }}
                    />
                    <span className="flex-1 text-[11px] text-ink">{item.label}</span>
                    <span className="font-mono text-[9px] text-muted-2">
                      {LANGUAGE_SHORT[item.language]}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Progress value={item.containment} className="h-1" tone={item.containment > 75 ? "accent" : "amber"} />
                    <span className="w-9 text-right font-mono text-[9px] text-muted">
                      {item.containment.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel className="p-4">
          <SectionTitle title="Sentiment" description="Post-call classification." />
          <div className="mt-3 grid grid-cols-[140px_minmax(0,1fr)] items-center gap-3">
            <Donut
              data={sentimentDonut}
              centerValue={overview.avgCsat.toFixed(1)}
              centerLabel="avg CSAT"
            />
            <div className="space-y-3">
              {sentiment.map((item, index) => (
                <div key={item.sentiment}>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: ["#4a6b45", "#96908a", "#a33a2a"][index] }}
                    />
                    <span className="flex-1 text-[11px] text-ink">{item.label}</span>
                    <span className="font-mono text-[9px] text-muted">{item.share.toFixed(0)}%</span>
                  </div>
                  <Progress
                    value={item.share}
                    className="mt-1 h-1"
                    tone={index === 0 ? "green" : index === 1 ? "cyan" : "red"}
                  />
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel className="p-4 md:col-span-2 xl:col-span-1">
          <SectionTitle title="Intent heatmap" description="Volume and escalation rate." />
          <div className="mt-2">
            <IntentBars data={intents} height={190} />
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
            <span className="text-[9.5px] text-muted-2">Highest escalation</span>
            <span className="font-mono text-[9.5px] text-amber">
              {[...intents].sort((a, b) => b.escalationRate - a.escalationRate)[0]?.intent ?? "—"}
            </span>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <SectionTitle
              title="Agent performance"
              description="Containment, transfers, and CSAT by active agent."
            />
            <Link href="/agents" className="text-[10px] text-muted hover:text-ink">
              Manage agents
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  {["Agent", "Sessions", "Containment", "Transfers", "CSAT", "Avg. handle", "Top escalation"].map(
                    (header) => (
                      <th
                        key={header}
                        className="px-4 py-2 font-mono text-[9px] font-normal uppercase tracking-[0.12em] text-muted-2 first:pl-5"
                      >
                        {header}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {performance.map((item) => (
                  <tr key={item.agent.id} className="border-b border-line/60 last:border-0">
                    <td className="py-2.5 pl-5 pr-4">
                      <Link href={`/agents/${item.agent.id}`} className="flex items-center gap-2">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br text-[8px] font-semibold ${
                            item.agent.color === "lime"
                              ? "from-[#efece7] to-[#c6bcb0] text-[#221e1c]"
                              : item.agent.color === "cyan"
                                ? "from-[#e3e9e6] to-[#a6bab2] text-[#1f2a27]"
                                : item.agent.color === "violet"
                                  ? "from-[#eae4ee] to-[#bba9c6] text-[#2b2233]"
                                  : "from-[#f1e6d8] to-[#cdae8a] text-[#33271a]"
                          }`}
                        >
                          {item.agent.name.slice(0, 1)}
                        </span>
                        <span className="text-[11.5px] text-ink">{item.agent.name}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[10px] text-muted">
                      {item.sessions.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Progress value={item.containment} className="h-1 w-14" />
                        <span className="font-mono text-[10px] text-accent">
                          {item.containment.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[10px] text-amber">
                      {item.transferRate.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[10px] text-ink">
                      {item.csat.toFixed(1)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[10px] text-muted">
                      {formatDuration(item.avgHandleSec)}
                    </td>
                    <td className="px-4 py-2.5 text-[9.5px] text-muted">{item.topEscalation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-2 px-4 py-2.5">
            <p className="text-[9.5px] text-muted-2">
              {performance.length} active agents · {overview.total.toLocaleString()} sessions
            </p>
            <p className="font-mono text-[8.5px] uppercase tracking-[0.08em] text-muted-2">
              Zain · draft · excluded
            </p>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel className="p-4">
            <SectionTitle
              title="Where AI needs help"
              description="Ranked by measurable impact."
              action={<Gauge className="h-4 w-4 text-muted-2" />}
            />
            <div className="mt-3 space-y-2.5">
              {insights.map((insight) => (
                <div key={insight.title} className="rounded-none border border-line bg-surface-2/50 p-3">
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        insight.tone === "risk" ? "bg-red" : insight.tone === "warning" ? "bg-amber" : "bg-cyan"
                      }`}
                    />
                    <div>
                      <p className="text-[10.5px] font-medium leading-snug text-ink">{insight.title}</p>
                      <p className="mt-1 text-[9.5px] leading-relaxed text-muted">{insight.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-4">
            <SectionTitle
              title="Failed & abandoned"
              description={`${overview.abandoned} sessions · ${overview.abandonmentRate.toFixed(1)}%`}
              action={<TriangleAlert className="h-3.5 w-3.5 text-red" />}
            />
            <div className="mt-3 space-y-2">
              {abandoned.map((session) => (
                <Link
                  key={session.id}
                  href={`/sessions/${session.id}`}
                  className="flex items-center gap-2.5 rounded-none border border-line bg-surface-2 px-2.5 py-2 transition-colors hover:border-line-strong"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10.5px] text-ink">{session.customerName}</span>
                    <span className="block truncate font-mono text-[8px] text-muted-2">
                      {session.intent} · {formatDuration(session.durationSec)}
                    </span>
                  </span>
                  <SessionStatusBadge session={session} />
                  <ChevronRight className="h-3 w-3 text-muted-2" />
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-none border border-line bg-surface-2 px-4 py-2.5">
        <p className="flex items-center gap-2 text-[9.5px] text-muted-2">
          <Users className="h-3 w-3 text-accent/60" />
          1,284 simulated sessions · 30-day window · all metrics derived from the same dataset
        </p>
        <div className="flex items-center gap-2">
          <Badge tone="outline">
            <Languages className="mr-0.5 h-2.5 w-2.5" /> EN · UR · HI
          </Badge>
          <Badge tone="outline">Mock analytics</Badge>
        </div>
      </div>
    </div>
  );
}
