import { seedAgents } from "./agents";
import { DEMO_NOW_MS } from "./seed";
import type { Agent, ChartPoint, Language, Sentiment, SessionRecord } from "./types";

const DAY = 86_400_000;

export interface Overview {
  total: number;
  contained: number;
  transferred: number;
  abandoned: number;
  containmentRate: number;
  transferRate: number;
  abandonmentRate: number;
  resolutionRate: number;
  avgDurationSec: number;
  avgCsat: number;
  totalMinutes: number;
}

export function computeOverview(sessions: SessionRecord[]): Overview {
  const total = sessions.length;
  const contained = sessions.filter((s) => s.handledBy === "ai" && s.status === "completed").length;
  const transferred = sessions.filter((s) => s.status === "transferred").length;
  const abandoned = sessions.filter((s) => s.status === "abandoned").length;
  const resolved = sessions.filter((s) => s.status !== "abandoned").length;
  const rated = sessions.filter((s) => typeof s.csat === "number");
  const avgDurationSec = Math.round(
    sessions.reduce((sum, s) => sum + s.durationSec, 0) / Math.max(1, total),
  );
  const avgCsat = rated.length
    ? rated.reduce((sum, s) => sum + (s.csat ?? 0), 0) / rated.length
    : 0;

  return {
    total,
    contained,
    transferred,
    abandoned,
    containmentRate: (contained / Math.max(1, total)) * 100,
    transferRate: (transferred / Math.max(1, total)) * 100,
    abandonmentRate: (abandoned / Math.max(1, total)) * 100,
    resolutionRate: (resolved / Math.max(1, total)) * 100,
    avgDurationSec,
    avgCsat,
    totalMinutes: Math.round(sessions.reduce((sum, s) => sum + s.durationSec, 0) / 60),
  };
}

export function computeVolumeSeries(
  sessions: SessionRecord[],
  days = 14,
  endMs = DEMO_NOW_MS,
): ChartPoint[] {
  const end = new Date(endMs);
  end.setUTCHours(0, 0, 0, 0);
  const endDay = end.getTime();

  const buckets: ChartPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const start = endDay - i * DAY;
    const date = new Date(start);
    buckets.push({
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      total: 0,
      transferred: 0,
      contained: 0,
    });
  }

  for (const session of sessions) {
    const day = new Date(session.startedAt);
    day.setUTCHours(0, 0, 0, 0);
    const index = Math.round((day.getTime() - (endDay - (days - 1) * DAY)) / DAY);
    if (index < 0 || index >= days) continue;
    buckets[index].total += 1;
    if (session.status === "transferred") buckets[index].transferred += 1;
    if (session.handledBy === "ai" && session.status === "completed") {
      buckets[index].contained += 1;
    }
  }

  return buckets;
}

/**
 * One value per day that had sessions, oldest first, over the `days` days up to `endMs`.
 * Undefined when fewer than two days had sessions, since there is no trend to draw.
 */
export function computeDailyValues(
  sessions: SessionRecord[],
  value: (day: SessionRecord[]) => number,
  days: number,
  endMs: number,
): number[] | undefined {
  const byAge = new Map<number, SessionRecord[]>();
  for (const session of sessions) {
    const age = Math.floor((endMs - new Date(session.startedAt).getTime()) / DAY);
    if (age < 0 || age >= days) continue;
    byAge.set(age, [...(byAge.get(age) ?? []), session]);
  }
  const values = [...byAge.entries()].sort((a, b) => b[0] - a[0]).map(([, day]) => value(day));
  return values.length > 1 ? values : undefined;
}

export function computeLanguageMix(sessions: SessionRecord[]) {
  const languages: Language[] = ["en", "hi", "ur"];
  const labels: Record<Language, string> = { en: "English", hi: "Hindi", ur: "Urdu" };
  return languages.map((language) => {
    const subset = sessions.filter((s) => s.language === language);
    const contained = subset.filter(
      (s) => s.handledBy === "ai" && s.status === "completed",
    ).length;
    return {
      language,
      label: labels[language],
      count: subset.length,
      share: (subset.length / Math.max(1, sessions.length)) * 100,
      containment: (contained / Math.max(1, subset.length)) * 100,
    };
  });
}

export function computeSentimentMix(sessions: SessionRecord[]) {
  const sentiments: Sentiment[] = ["positive", "neutral", "negative"];
  return sentiments.map((sentiment) => ({
    sentiment,
    label: sentiment[0].toUpperCase() + sentiment.slice(1),
    count: sessions.filter((s) => s.sentiment === sentiment).length,
    share:
      (sessions.filter((s) => s.sentiment === sentiment).length / Math.max(1, sessions.length)) *
      100,
  }));
}

export function computeTransferReasons(sessions: SessionRecord[]) {
  const counts = new Map<string, number>();
  for (const session of sessions) {
    if (!session.transferReason) continue;
    counts.set(session.transferReason, (counts.get(session.transferReason) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  return [...counts.entries()]
    .map(([reason, count]) => ({
      reason,
      count,
      share: (count / Math.max(1, total)) * 100,
    }))
    .sort((a, b) => b.count - a.count);
}

export function computeIntentMix(sessions: SessionRecord[], limit = 6) {
  const counts = new Map<string, { count: number; transferred: number; abandoned: number }>();
  for (const session of sessions) {
    const current = counts.get(session.intent) ?? { count: 0, transferred: 0, abandoned: 0 };
    current.count += 1;
    if (session.status === "transferred") current.transferred += 1;
    if (session.status === "abandoned") current.abandoned += 1;
    counts.set(session.intent, current);
  }
  return [...counts.entries()]
    .map(([intent, value]) => ({
      intent,
      ...value,
      escalationRate: (value.transferred / Math.max(1, value.count)) * 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export interface AgentPerformance {
  agent: Agent;
  sessions: number;
  containment: number;
  transferRate: number;
  csat: number;
  avgHandleSec: number;
  topEscalation: string;
}

export function computeAgentPerformance(sessions: SessionRecord[]): AgentPerformance[] {
  return seedAgents
    .filter((agent) => agent.status === "active")
    .map((agent) => {
      const subset = sessions.filter((s) => s.agentId === agent.id);
      const contained = subset.filter(
        (s) => s.handledBy === "ai" && s.status === "completed",
      ).length;
      const transferred = subset.filter((s) => s.status === "transferred").length;
      const rated = subset.filter((s) => typeof s.csat === "number");
      const reasons = computeTransferReasons(subset);
      return {
        agent,
        sessions: subset.length,
        containment: (contained / Math.max(1, subset.length)) * 100,
        transferRate: (transferred / Math.max(1, subset.length)) * 100,
        csat: rated.length
          ? rated.reduce((sum, s) => sum + (s.csat ?? 0), 0) / rated.length
          : 0,
        avgHandleSec: Math.round(
          subset.reduce((sum, s) => sum + s.durationSec, 0) / Math.max(1, subset.length),
        ),
        topEscalation: reasons[0]?.reason ?? "—",
      };
    })
    .sort((a, b) => b.sessions - a.sessions);
}

export function computeInsights(sessions: SessionRecord[]) {
  const reasons = computeTransferReasons(sessions);
  const languages = computeLanguageMix(sessions);
  const intents = computeIntentMix(sessions, 10);
  const overview = computeOverview(sessions);
  const worstLanguage = [...languages].sort((a, b) => a.containment - b.containment)[0];
  const worstIntent = [...intents].sort((a, b) => b.escalationRate - a.escalationRate)[0];

  return [
    {
      tone: "risk" as const,
      title: `${reasons[0]?.reason ?? "Policy exceptions"} drive ${Math.round(reasons[0]?.share ?? 0)}% of transfers`,
      body: "Consider raising the AI approval limit or adding a guided approval step.",
      action: "Review policy",
    },
    {
      tone: "warning" as const,
      title: `${worstLanguage.label} has the lowest containment`,
      body: `${worstLanguage.containment.toFixed(1)}% for ${worstLanguage.label} vs. ${overview.containmentRate.toFixed(1)}% overall.`,
      action: "Open language report",
    },
    {
      tone: "info" as const,
      title: `"${worstIntent.intent}" escalates ${Math.round(worstIntent.escalationRate)}% of the time`,
      body: "Adding a tool or narrower policy could resolve more of these without a handoff.",
      action: "Improve knowledge",
    },
  ];
}

export function formatTrend(value: number, suffix = "%") {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}${suffix}`;
}
