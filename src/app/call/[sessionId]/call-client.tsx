"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Headphones,
  Loader2,
  Mic,
  MicOff,
  Pause,
  PhoneOff,
  Play,
  RotateCcw,
  Settings2,
  ShieldAlert,
  Sparkles,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { agentById, seedAgents } from "@/lib/agents";
import { useAgent } from "@/lib/agent-store";
import { useCallEngine } from "@/hooks/use-call-engine";
import {
  applyAcceptHandoff,
  applyCustomerTurn,
  applyFastForwardToEscalation,
  applyHumanTurn,
  applyReturnToAI,
} from "@/lib/live-actions";
import { resetLive } from "@/lib/live-store";
import { HANDOFF_TURNS } from "@/lib/call-script";
import type { Language, LiveSession } from "@/lib/types";
import { cn, formatDuration, LANGUAGE_NATIVE, LANGUAGE_SHORT, sleep } from "@/lib/utils";
import { AgentAvatar, LanguageTag, LivePill, RiskBadge } from "@/components/brand";
import { Badge, Button, Panel, Progress } from "@/components/ui";
import { Waveform } from "@/components/live/waveform";
import { Transcript } from "@/components/live/transcript";
import { Logo } from "@/components/brand";

function CallControl({
  icon,
  label,
  onClick,
  active,
  danger,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex flex-col items-center gap-1.5 disabled:pointer-events-none disabled:opacity-40"
    >
      <span
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full border transition-all",
          danger
            ? "border-red/30 bg-red/12 text-red hover:bg-red/20"
            : active
              ? "border-accent/30 bg-accent/12 text-accent"
              : "border-line bg-white/[0.035] text-muted hover:border-line-strong hover:bg-white/[0.06] hover:text-ink",
        )}
      >
        {icon}
      </span>
      <span className="text-[9.5px] text-muted-2 group-hover:text-muted">{label}</span>
    </button>
  );
}

function statusCopy(session: LiveSession, agentName: string) {
  if (session.status === "ended") return "Call ended";
  if (session.status === "human_active") return "Sara is in control";
  if (session.status === "escalating") return "Connecting a specialist";
  if (session.status === "connecting") return "Connecting audio";
  if (session.paused) return "Call paused";
  if (session.agentState === "speaking") return `${agentName} is speaking`;
  if (session.agentState === "thinking") return "Checking policy";
  return "Listening";
}

function CallScreen() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
  const searchParams = useSearchParams();
  const agentId = searchParams.get("agent") ?? "ag_ayesha";
  const agent = useAgent(agentId) ?? agentById(agentId) ?? seedAgents[0];
  const router = useRouter();
  const { session, ready, update, togglePause, toggleMic, transfer, end } = useCallEngine(
    sessionId,
    agent.id,
  );

  const [now, setNow] = useState(() => Date.now());
  const [demoOpen, setDemoOpen] = useState(false);
  const [autoAccept, setAutoAccept] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!autoAccept) return;
    if (session?.status !== "escalating") return;
    const timeout = setTimeout(() => {
      update(applyAcceptHandoff);
      setAutoAccept(false);
    }, 900);
    return () => clearTimeout(timeout);
  }, [autoAccept, session?.status, update]);

  useEffect(() => {
    if (!autoPlay || session?.status !== "human_active") return;
    let cancelled = false;
    (async () => {
      for (const item of HANDOFF_TURNS) {
        await sleep(1500);
        if (cancelled) return;
        update((value) =>
          item.role === "human"
            ? applyHumanTurn(value, item.text)
            : applyCustomerTurn(value, item.text, item.language ?? value.language),
        );
      }
      await sleep(1500);
      if (cancelled) return;
      update(applyReturnToAI);
      setAutoPlay(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [autoPlay, session?.status, update]);

  const elapsed = session ? Math.max(0, Math.floor(((session.endedAt ?? now) - session.startedAt) / 1000)) : 0;

  const detectedLanguages = useMemo(() => {
    const set = new Set<Language>();
    if (session) {
      set.add(session.language);
      session.transcript.forEach((turn) => {
        if (turn.language) set.add(turn.language);
      });
    }
    return [...set];
  }, [session]);

  if (!ready || !session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Logo />
        <div className="flex items-center gap-2 text-[12px] text-muted">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          Establishing secure mock session...
        </div>
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-2">
          LiveKit room · mock runtime
        </p>
      </div>
    );
  }

  const ended = session.status === "ended";
  const escalating = session.status === "escalating";
  const humanActive = session.status === "human_active";
  const confidenceTone =
    session.confidence >= 0.8 ? "accent" : session.confidence >= 0.65 ? "amber" : "red";
  const latency = session.latency;
  const latencyTotal = latency.stt + latency.llm + latency.tts;

  const skipToEscalation = () => {
    update(applyFastForwardToEscalation);
  };

  const restart = () => {
    resetLive(sessionId);
    const id = `SES-LIVE-${Date.now().toString(36).toUpperCase()}`;
    router.replace(`/call/${id}?agent=${agentId}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Logo compact />
          <span className="hidden h-4 w-px bg-line sm:block" />
          <div className="hidden items-center gap-2 sm:flex">
            <Badge tone="amber" dot>
              Customer call
            </Badge>
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-2">
              mock mode
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 text-[10px] text-green md:flex">
            <Activity className="h-3 w-3" />
            Excellent
          </span>
          <Link href="/supervisor" target="_blank">
            <Button variant="secondary" size="sm">
              <Headphones className="h-3.5 w-3.5" />
              Supervisor view
            </Button>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="icon-sm" aria-label="Exit call">
              <X className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1560px] flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[270px_minmax(0,1fr)] xl:grid-cols-[270px_minmax(0,1fr)_360px] lg:p-4">
        <aside className="order-2 space-y-3 lg:order-1">
          <Panel className="p-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <AgentAvatar name={humanActive ? "Sara Malik" : agent.name} color={humanActive ? "cyan" : agent.color} size="lg" status="active" />
                {humanActive ? (
                  <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-bg bg-cyan text-[8px] font-bold text-[#041619]">
                    AI
                  </span>
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink">
                  {humanActive ? "Sara Malik" : agent.name}
                </p>
                <p className="text-[10.5px] text-muted">
                  {humanActive ? "Human specialist" : agent.role}
                </p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <LanguageTag language={session.language} variant="compact" />
                  <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-muted-2">
                    {humanActive ? "human-led" : "AI-led"}
                  </span>
                </div>
              </div>
            </div>
            {humanActive ? (
              <div className="mt-3 rounded-lg border border-cyan/20 bg-cyan/[0.05] px-2.5 py-2">
                <p className="text-[10px] leading-relaxed text-cyan/90">
                  Ayesha is assisting silently with policy checks. Full transcript is shared.
                </p>
              </div>
            ) : null}
          </Panel>

          <Panel className="p-4">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-2">
                Live context
              </p>
              <RiskBadge risk={session.risk} />
            </div>
            <div className="mt-3 space-y-2.5">
              <div>
                <p className="text-[9px] uppercase tracking-[0.12em] text-muted-2">Intent</p>
                <p className="mt-0.5 text-[11.5px] font-medium text-ink">{session.intent}</p>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[9px] uppercase tracking-[0.12em] text-muted-2">Confidence</p>
                  <span
                    className={cn(
                      "font-mono text-[10px]",
                      confidenceTone === "accent"
                        ? "text-accent"
                        : confidenceTone === "amber"
                          ? "text-amber"
                          : "text-red",
                    )}
                  >
                    {session.confidence.toFixed(2)}
                  </span>
                </div>
                <Progress value={session.confidence * 100} tone={confidenceTone} className="mt-1.5" />
              </div>
              <div className="flex items-center justify-between border-t border-line pt-2.5">
                <span className="text-[9px] uppercase tracking-[0.12em] text-muted-2">Detected</span>
                <div className="flex items-center gap-1">
                  {detectedLanguages.map((language) => (
                    <span
                      key={language}
                      className="rounded border border-line bg-white/[0.03] px-1.5 py-0.5 font-mono text-[8.5px] text-muted"
                      title={LANGUAGE_NATIVE[language]}
                    >
                      {LANGUAGE_SHORT[language]}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-line pt-2.5">
                <span className="text-[9px] uppercase tracking-[0.12em] text-muted-2">Sentiment</span>
                <span className="text-[10.5px] capitalize text-ink">{session.sentiment}</span>
              </div>
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-2">
                Pipeline latency
              </p>
              <span className="font-mono text-[9px] text-green">{latencyTotal}ms</span>
            </div>
            <div className="mt-3 space-y-2">
              {[
                { label: "Azure STT", value: latency.stt, tone: "cyan" as const },
                { label: "LLM", value: latency.llm, tone: "accent" as const },
                { label: "Azure TTS", value: latency.tts, tone: "violet" as const },
              ].map((item) => (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] text-muted">{item.label}</span>
                    <span className="font-mono text-[9px] text-ink">{item.value}ms</span>
                  </div>
                  <Progress value={(item.value / 750) * 100} tone={item.tone} className="h-1" />
                </div>
              ))}
            </div>
            <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.1em] text-muted-2">
              simulated · livekit + azure pending
            </p>
          </Panel>

          <Panel className="p-4">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-2">Tools</p>
              <Wrench className="h-3 w-3 text-muted-2" />
            </div>
            <div className="mt-2.5 space-y-2">
              {session.toolCalls.length === 0 ? (
                <p className="text-[10px] leading-relaxed text-muted-2">
                  No tools called yet. The agent will verify the order before responding.
                </p>
              ) : (
                session.toolCalls.map((tool) => (
                  <div key={tool.id} className="rounded-lg border border-line bg-white/[0.025] px-2.5 py-2">
                    <div className="flex items-center gap-1.5">
                      {tool.status === "running" ? (
                        <Loader2 className="h-2.5 w-2.5 animate-spin text-cyan" />
                      ) : (
                        <Check className="h-2.5 w-2.5 text-green" />
                      )}
                      <p className="truncate font-mono text-[8.5px] uppercase tracking-[0.08em] text-muted">
                        {tool.label}
                      </p>
                    </div>
                    <p className="mt-1 text-[9.5px] leading-relaxed text-muted-2">{tool.result}</p>
                  </div>
                ))
              )}
            </div>
          </Panel>

          {session.handoff ? (
            <Panel className="border-cyan/20 p-4">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-cyan">Handoff</p>
                <Badge tone={humanActive ? "cyan" : "amber"} dot>
                  {session.handoff.status}
                </Badge>
              </div>
              <p className="mt-2 text-[10.5px] leading-relaxed text-ink/85">{session.handoff.reason}</p>
              <div className="mt-2 border-t border-line pt-2 font-mono text-[8.5px] text-muted-2">
                <p>context: transcript + intent + confidence</p>
                {session.handoff.supervisor ? <p className="mt-0.5">joined: {session.handoff.supervisor}</p> : null}
              </div>
            </Panel>
          ) : null}
        </aside>

        <main className="order-1 min-w-0 lg:order-2">
          <Panel className="relative flex h-full min-h-[600px] flex-col overflow-hidden">
            <div className="dot-bg pointer-events-none absolute inset-0 opacity-40" />
            <div className="relative flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-2">
                {ended ? (
                  <Badge tone="neutral">Ended</Badge>
                ) : (
                  <LivePill label={humanActive ? "Human live" : "Live"} />
                )}
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-2">
                  {session.id}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 font-mono text-[12px] text-ink">
                  <span className={cn("h-1.5 w-1.5 rounded-full", session.paused ? "bg-amber" : "bg-green")} />
                  {formatDuration(elapsed)}
                </span>
                <span className="hidden items-center gap-1 text-[9px] text-muted-2 sm:flex">
                  <Activity className="h-3 w-3 text-green" /> 48ms jitter
                </span>
              </div>
            </div>

            <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-8">
              <div className="relative flex items-center justify-center">
                <div
                  className={cn(
                    "absolute h-44 w-44 rounded-full blur-3xl transition-colors duration-700",
                    humanActive
                      ? "bg-cyan/15"
                      : session.agentState === "speaking"
                        ? "bg-accent/15"
                        : "bg-white/[0.035]",
                  )}
                />
                <div
                  className={cn(
                    "absolute h-32 w-32 rounded-full border transition-colors duration-700",
                    humanActive
                      ? "border-cyan/20"
                      : session.agentState === "speaking"
                        ? "border-accent/25"
                        : "border-line",
                  )}
                />
                <div className="breathe absolute h-28 w-28 rounded-full bg-white/[0.02]" />
                <div className="relative">
                  <AgentAvatar
                    name={humanActive ? "Sara Malik" : agent.name}
                    color={humanActive ? "cyan" : agent.color}
                    size="xl"
                  />
                  {humanActive ? (
                    <span className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#0c0e11] bg-surface-2">
                      <AgentAvatar name={agent.name} color={agent.color} size="xs" />
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 text-center">
                <h1 className="text-[17px] font-medium tracking-[-0.02em] text-ink">
                  {humanActive ? "Sara Malik" : agent.name}
                </h1>
                <p className="mt-0.5 text-[10.5px] text-muted">
                  {humanActive ? "Human specialist · joined with full context" : agent.role}
                </p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium",
                      humanActive
                        ? "border-cyan/25 bg-cyan/[0.07] text-cyan"
                        : escalating
                          ? "border-amber/25 bg-amber/[0.07] text-amber"
                          : "border-accent/25 bg-accent/[0.07] text-accent",
                    )}
                  >
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                    {statusCopy(session, agent.name)}
                  </span>
                  {session.paused ? <Badge tone="amber">Paused</Badge> : null}
                </div>
              </div>

              <div className="mt-6 w-full max-w-[560px]">
                <Waveform
                  state={
                    humanActive
                      ? "human"
                      : session.agentState === "speaking"
                        ? "speaking"
                        : session.agentState
                  }
                  active={!ended && !session.paused}
                  height={86}
                />
              </div>

              <div className="mt-3 flex min-h-8 items-center justify-center gap-2 text-center">
                <Sparkles className="h-3 w-3 shrink-0 text-muted-2" />
                <p className="max-w-md text-[10.5px] leading-relaxed text-muted">
                  {session.reasoning ?? "Listening for the next turn"}
                </p>
              </div>

              {humanActive ? (
                <div className="mt-4 flex items-center gap-2 rounded-full border border-cyan/20 bg-cyan/[0.05] px-3 py-1.5">
                  <Headphones className="h-3 w-3 text-cyan" />
                  <p className="text-[10px] text-cyan/90">
                    Sara joined · Ayesha is assisting silently · context shared
                  </p>
                </div>
              ) : null}
            </div>

            <div className="relative border-t border-line bg-black/20 px-4 py-4">
              <div className="flex items-center justify-center gap-5 sm:gap-8">
                <CallControl
                  icon={session.micMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  label={session.micMuted ? "Unmute" : "Mute"}
                  onClick={toggleMic}
                  active={session.micMuted}
                  disabled={ended}
                />
                <CallControl
                  icon={session.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  label={session.paused ? "Resume" : "Pause"}
                  onClick={togglePause}
                  active={session.paused}
                  disabled={ended}
                />
                <CallControl
                  icon={<Headphones className="h-4 w-4" />}
                  label={humanActive ? "Human active" : "Transfer"}
                  onClick={transfer}
                  disabled={ended || escalating || humanActive}
                />
                <CallControl
                  icon={<PhoneOff className="h-4 w-4" />}
                  label="End call"
                  onClick={end}
                  danger
                  disabled={ended}
                />
              </div>
            </div>

            <AnimatePresence>
              {escalating ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 flex items-center justify-center bg-[#070809]/80 p-4 backdrop-blur-md"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="panel-raised w-full max-w-md p-5 text-center"
                  >
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-amber/25 bg-amber/10">
                      <Loader2 className="h-5 w-5 animate-spin text-amber" />
                    </div>
                    <h2 className="mt-4 text-[16px] font-medium text-ink">
                      Connecting you to a specialist
                    </h2>
                    <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
                      Ayesha is sharing the full conversation with Sara. You won&apos;t need to repeat
                      anything.
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-3 rounded-xl border border-line bg-white/[0.02] px-3 py-2.5">
                      <AgentAvatar name={agent.name} color={agent.color} size="sm" />
                      <div className="flex items-center gap-1">
                        {[0, 1, 2].map((index) => (
                          <span
                            key={index}
                            className="h-1 w-1 animate-bounce rounded-full bg-muted"
                            style={{ animationDelay: `${index * 120}ms` }}
                          />
                        ))}
                      </div>
                      <AgentAvatar name="Sara Malik" color="cyan" size="sm" />
                    </div>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <Link href="/supervisor" target="_blank" className="flex-1">
                        <Button variant="secondary" size="sm" className="w-full">
                          <Headphones className="h-3.5 w-3.5" />
                          Open supervisor
                        </Button>
                      </Link>
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        onClick={() => update(applyAcceptHandoff)}
                      >
                        Simulate accept
                      </Button>
                    </div>
                    <p className="mt-3 font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-2">
                      context package · transcript · intent · confidence · tools
                    </p>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </Panel>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2 font-mono text-[8.5px] uppercase tracking-[0.1em] text-muted-2">
              <Zap className="h-3 w-3 text-accent/60" />
              LiveKit room · Azure STT + TTS · mock audio
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="outline">Barge-in: on</Badge>
              <Badge tone="outline">VAD: on</Badge>
            </div>
          </div>
        </main>

        <section className="order-3 min-w-0">
          <Panel className="flex h-full min-h-[420px] flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-3.5 py-3">
              <div className="flex items-center gap-2">
                <p className="text-[11.5px] font-medium text-ink">Live transcript</p>
                <Badge tone="outline" className="px-1.5 py-0 text-[8.5px]">
                  {detectedLanguages.map((language) => LANGUAGE_SHORT[language]).join(" · ")}
                </Badge>
              </div>
              <span className="flex items-center gap-1 font-mono text-[8.5px] uppercase tracking-[0.1em] text-muted-2">
                <span className="h-1 w-1 animate-pulse rounded-full bg-accent" />
                auto-scroll
              </span>
            </div>
            <Transcript session={session} className="h-[520px] flex-1 xl:h-[calc(100vh-210px)]" />
            <div className="border-t border-line px-3.5 py-2.5">
              <div className="flex items-center justify-between text-[9px] text-muted-2">
                <span className="flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3" />
                  PII masked in summary
                </span>
                <Link href="/sessions" className="flex items-center gap-0.5 hover:text-ink">
                  Session log <ChevronRight className="h-2.5 w-2.5" />
                </Link>
              </div>
            </div>
          </Panel>
        </section>
      </div>

      {!ended ? (
        <div className="fixed bottom-4 right-4 z-40">
          <AnimatePresence>
            {demoOpen ? (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.99 }}
                className="panel-raised mb-2 w-[270px] p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-2">
                    Demo controls
                  </p>
                  <button
                    type="button"
                    onClick={() => setDemoOpen(false)}
                    className="text-muted-2 hover:text-ink"
                    aria-label="Close demo controls"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  <Button variant="secondary" size="sm" className="w-full justify-start" onClick={skipToEscalation}>
                    <Sparkles className="h-3 w-3" />
                    Skip to escalation
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setAutoAccept(true)}
                    disabled={!escalating}
                  >
                    <Headphones className="h-3 w-3" />
                    Auto-accept handoff
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setAutoPlay(true)}
                    disabled={!humanActive || autoPlay}
                  >
                    <Play className="h-3 w-3" />
                    {autoPlay ? "Playing handoff..." : "Auto-play handoff"}
                  </Button>
                  <Link href="/supervisor" target="_blank" className="block">
                    <Button variant="secondary" size="sm" className="w-full justify-start">
                      <Headphones className="h-3 w-3" />
                      Open supervisor window
                    </Button>
                  </Link>
                  <div className="my-1 h-px bg-line" />
                  <Button variant="ghost" size="sm" className="w-full justify-start" onClick={restart}>
                    <RotateCcw className="h-3 w-3" />
                    Restart call
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-red hover:text-red"
                    onClick={end}
                  >
                    <PhoneOff className="h-3 w-3" />
                    End &amp; generate summary
                  </Button>
                </div>
                <p className="mt-2 border-t border-line pt-2 text-[8.5px] leading-relaxed text-muted-2">
                  Mock controls only. Real transfer happens in the supervisor window.
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDemoOpen((value) => !value)}
            className="shadow-2xl"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Demo controls
          </Button>
        </div>
      ) : null}

      <AnimatePresence>
        {ended ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#070809]/85 p-4 backdrop-blur-xl"
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="panel-raised w-full max-w-lg overflow-hidden"
            >
              <div className="border-b border-line bg-gradient-to-b from-accent/[0.06] to-transparent px-6 py-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-accent/25 bg-accent/10">
                  <CheckCircle2 className="h-5 w-5 text-accent" />
                </div>
                <h2 className="mt-3 text-[20px] font-medium tracking-[-0.02em] text-ink">Call resolved</h2>
                <p className="mt-1 text-[11.5px] text-muted">
                  Summary, transcript, and handoff record are ready.
                </p>
              </div>
              <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
                <div className="px-3 py-3 text-center">
                  <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-2">Duration</p>
                  <p className="mt-1 text-[14px] font-medium text-ink">{formatDuration(elapsed)}</p>
                </div>
                <div className="px-3 py-3 text-center">
                  <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-2">Handled by</p>
                  <p className="mt-1 text-[14px] font-medium text-ink">
                    {session.handoff?.acceptedAt ? "AI + Human" : "AI"}
                  </p>
                </div>
                <div className="px-3 py-3 text-center">
                  <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-2">Outcome</p>
                  <p className="mt-1 text-[14px] font-medium text-green">Resolved</p>
                </div>
              </div>
              <div className="p-4">
                <Link href={`/sessions/${session.id}`}>
                  <Button variant="primary" className="w-full">
                    View session summary
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button variant="secondary" size="sm" onClick={restart}>
                    <RotateCcw className="h-3 w-3" />
                    Start another
                  </Button>
                  <Link href="/">
                    <Button variant="secondary" size="sm" className="w-full">
                      <ArrowLeft className="h-3 w-3" />
                      Dashboard
                    </Button>
                  </Link>
                </div>
                <p className="mt-3 text-center font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-2">
                  {session.id} · summary generated from transcript
                </p>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default function CallPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        </div>
      }
    >
      <CallScreen />
    </Suspense>
  );
}
