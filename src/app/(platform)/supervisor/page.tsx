"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Headphones,
  Inbox,
  Loader2,
  MessageSquare,
  Mic,
  PhoneOff,
  Play,
  Send,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";
import { agentById, seedAgents } from "@/lib/agents";
import { HANDOFF_TURNS } from "@/lib/call-script";
import {
  applyAcceptHandoff,
  applyCustomerTurn,
  applyHumanTurn,
  applyReturnToAI,
  finishSession,
} from "@/lib/live-actions";
import { readLive, useLiveSessions, writeLive } from "@/lib/live-store";
import type { LiveSession } from "@/lib/types";
import {
  cn,
  formatDuration,
  formatRelative,
  LANGUAGE_NATIVE,
  LANGUAGE_SHORT,
  sleep,
} from "@/lib/utils";
import { AgentAvatar, LanguageTag, RiskBadge } from "@/components/brand";
import { PageHeader } from "@/components/dashboard";
import { Badge, Button, EmptyState, Panel, Textarea } from "@/components/ui";
import { Transcript } from "@/components/live/transcript";

function queueState(session: LiveSession) {
  if (session.status === "escalating") {
    return { label: "Waiting", tone: "amber" as const };
  }
  if (session.status === "human_active") {
    return { label: "Human", tone: "cyan" as const };
  }
  if (session.status === "connecting") {
    return { label: "Connecting", tone: "neutral" as const };
  }
  return { label: "AI active", tone: "accent" as const };
}

function SessionCard({
  session,
  now,
  selected,
  onSelect,
  onAccept,
}: {
  session: LiveSession;
  now: number;
  selected: boolean;
  onSelect: () => void;
  onAccept: () => void;
}) {
  const state = queueState(session);
  const elapsed = Math.floor((now - session.startedAt) / 1000);
  const agent = agentById(session.agentId) ?? seedAgents[0];

  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition-colors",
        selected
          ? "border-accent/30 bg-accent/[0.04]"
          : "border-line bg-surface-2 hover:border-line-strong hover:bg-surface-2",
      )}
    >
      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className="flex items-start gap-2.5">
          <span className="relative">
            <AgentAvatar name={session.customerName} color="cyan" size="sm" />
            {session.status === "escalating" ? (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-bg bg-amber" />
            ) : null}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[12px] font-medium text-ink">{session.customerName}</p>
              <Badge tone={state.tone} dot>
                {state.label}
              </Badge>
            </div>
            <p className="mt-0.5 truncate font-mono text-[8.5px] uppercase tracking-[0.08em] text-muted-2">
              {session.id} · {agent.name}
            </p>
          </div>
        </div>
        <p className="mt-2 truncate text-[10.5px] text-muted">{session.intent}</p>
        <div className="mt-2 flex items-center gap-2">
          <LanguageTag language={session.language} variant="compact" />
          <span className="font-mono text-[8.5px] text-muted-2">{formatDuration(elapsed)}</span>
          <span className="ml-auto">
            <RiskBadge risk={session.risk} />
          </span>
        </div>
      </button>
      {session.status === "escalating" ? (
        <Button variant="primary" size="sm" className="mt-2.5 w-full" onClick={onAccept}>
          <Headphones className="h-3 w-3" />
          Accept handoff
        </Button>
      ) : null}
    </div>
  );
}

export default function SupervisorPage() {
  const sessions = useLiveSessions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [available, setAvailable] = useState(true);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const live = useMemo(
    () =>
      sessions
        .filter((session) => session.status !== "ended")
        .sort((a, b) => {
          const rank = { escalating: 0, human_active: 1, ai_active: 2, connecting: 3, ended: 4 };
          return rank[a.status] - rank[b.status] || b.startedAt - a.startedAt;
        }),
    [sessions],
  );

  const selected = live.find((session) => session.id === selectedId) ?? live[0] ?? null;
  const agent = selected ? agentById(selected.agentId) ?? seedAgents[0] : seedAgents[0];
  const elapsed = selected ? Math.floor(((selected.endedAt ?? now) - selected.startedAt) / 1000) : 0;

  const waiting = live.filter((session) => session.status === "escalating").length;
  const activeHuman = live.filter((session) => session.status === "human_active").length;

  const mutate = (updater: (session: LiveSession) => LiveSession) => {
    if (!selected) return;
    const current = readLive(selected.id);
    if (!current) return;
    writeLive(updater(current));
  };

  const accept = () => {
    mutate(applyAcceptHandoff);
  };

  const send = (text?: string) => {
    const value = (text ?? message).trim();
    if (!value || !selected || selected.control !== "human") return;
    mutate((session) => applyHumanTurn(session, value));
    setMessage("");
  };

  const returnToAI = () => {
    mutate(applyReturnToAI);
  };

  const endCall = () => {
    mutate(finishSession);
  };

  const playHandoff = async () => {
    if (!selected) return;
    setPlaying(true);
    const id = selected.id;
    const current = readLive(id);
    if (current?.status === "escalating") writeLive(applyAcceptHandoff(current));
    await sleep(1000);
    for (const item of HANDOFF_TURNS) {
      const session = readLive(id);
      if (!session) break;
      writeLive(
        item.role === "human"
          ? applyHumanTurn(session, item.text)
          : applyCustomerTurn(session, item.text, item.language ?? session.language),
      );
      await sleep(1500);
    }
    const session = readLive(id);
    if (session) writeLive(applyReturnToAI(session));
    setPlaying(false);
  };

  const startDemoCall = () => {
    const id = `SES-LIVE-${Date.now().toString(36).toUpperCase()}`;
    window.open(`/call/${id}?agent=ag_ayesha`, "_blank", "noopener");
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-7 lg:py-8">
      <PageHeader
        eyebrow="04 — Human desk · live handoff"
        title={
          <>
            Take over without missing a <span className="font-serif italic text-cyan">beat</span>.
          </>
        }
        description="When the AI escalates, the call is already warm. The transcript, intent, confidence, and tool results arrive before you say hello."
        actions={
          <>
            <button
              type="button"
              onClick={() => setAvailable((value) => !value)}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-[12px] font-medium transition-colors",
                available
                  ? "border-green/25 bg-green/10 text-green"
                  : "border-line bg-surface-2 text-muted",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", available ? "bg-green" : "bg-muted-2")} />
              {available ? "Available" : "Busy"}
            </button>
            <Button variant="secondary" onClick={startDemoCall}>
              <Play className="h-3.5 w-3.5" />
              Start test call
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Panel className="p-3.5">
          <div className="flex items-center gap-2 text-muted-2">
            <Inbox className="h-3.5 w-3.5" />
            <span className="font-mono text-[9px] uppercase tracking-[0.14em]">Waiting</span>
          </div>
          <p className={cn("mt-2 text-[22px] font-semibold tracking-[-0.04em]", waiting ? "text-amber" : "text-ink")}>
            {waiting}
          </p>
          <p className="text-[10px] text-muted-2">handoffs in queue</p>
        </Panel>
        <Panel className="p-3.5">
          <div className="flex items-center gap-2 text-muted-2">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-mono text-[9px] uppercase tracking-[0.14em]">Avg. wait</span>
          </div>
          <p className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-ink">0:38</p>
          <p className="text-[10px] text-muted-2">from request to join</p>
        </Panel>
        <Panel className="p-3.5">
          <div className="flex items-center gap-2 text-muted-2">
            <Headphones className="h-3.5 w-3.5" />
            <span className="font-mono text-[9px] uppercase tracking-[0.14em]">In progress</span>
          </div>
          <p className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-ink">{activeHuman}</p>
          <p className="text-[10px] text-muted-2">human-led sessions</p>
        </Panel>
        <Panel className="p-3.5">
          <div className="flex items-center gap-2 text-muted-2">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="font-mono text-[9px] uppercase tracking-[0.14em]">Resolved</span>
          </div>
          <p className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-ink">14</p>
          <p className="text-[10px] text-muted-2">today · 4.8 CSAT</p>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Panel className="flex max-h-[760px] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <p className="text-[13px] font-medium text-ink">Live queue</p>
              <p className="mt-0.5 text-[10px] text-muted">Escalations first, then active calls.</p>
            </div>
            <Badge tone={waiting ? "amber" : "outline"} dot>
              {waiting} waiting
            </Badge>
          </div>
          <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto p-3">
            {live.length === 0 ? (
              <EmptyState
                icon={<Inbox className="h-5 w-5" />}
                title="No live calls yet"
                description="Start a customer call. When Ayesha escalates, it lands here with the full context package."
                action={
                  <Button variant="primary" size="sm" onClick={startDemoCall}>
                    <Play className="h-3 w-3" />
                    Open customer window
                  </Button>
                }
              />
            ) : (
              live.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  now={now}
                  selected={selected?.id === session.id}
                  onSelect={() => setSelectedId(session.id)}
                  onAccept={() => {
                    setSelectedId(session.id);
                    const current = readLive(session.id);
                    if (current) writeLive(applyAcceptHandoff(current));
                  }}
                />
              ))
            )}
          </div>
          <div className="border-t border-line px-4 py-2.5">
            <p className="flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-muted-2">
              <Zap className="h-2.5 w-2.5 text-accent/60" />
              LiveKit room · same session as customer
            </p>
          </div>
        </Panel>

        {selected ? (
          <div className="min-w-0 space-y-4">
            <Panel className="overflow-hidden">
              <div className="flex flex-col justify-between gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <AgentAvatar name={selected.customerName} color="cyan" size="md" />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14px] font-medium text-ink">{selected.customerName}</p>
                      <Badge tone={queueState(selected).tone} dot>
                        {queueState(selected).label}
                      </Badge>
                      <RiskBadge risk={selected.risk} />
                    </div>
                    <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-2">
                      {selected.id} · {agent.name} · {LANGUAGE_NATIVE[selected.language]} ·{" "}
                      {formatDuration(elapsed)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/call/${selected.id}?agent=${selected.agentId}`} target="_blank">
                    <Button variant="secondary" size="sm">
                      <ArrowUpRight className="h-3 w-3" />
                      Customer view
                    </Button>
                  </Link>
                  {selected.status === "human_active" ? (
                    <Button variant="outline" size="sm" onClick={returnToAI}>
                      <ArrowLeftRight className="h-3 w-3" />
                      Return to AI
                    </Button>
                  ) : null}
                  <Button variant="danger" size="sm" onClick={endCall}>
                    <PhoneOff className="h-3 w-3" />
                    End
                  </Button>
                </div>
              </div>

              {selected.status === "escalating" ? (
                <div className="flex flex-col justify-between gap-3 border-b border-amber/20 bg-amber/[0.045] px-4 py-3 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber/25 bg-amber/10 text-amber">
                      <ShieldAlert className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <p className="text-[11.5px] font-medium text-amber">Ayesha is holding the call</p>
                      <p className="mt-0.5 text-[10.5px] leading-relaxed text-amber/80">
                        {selected.handoff?.reason ?? "Escalation requested"} · context package ready.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={playHandoff} disabled={playing}>
                      {playing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                      Play handoff
                    </Button>
                    <Button variant="primary" size="sm" onClick={accept}>
                      <Headphones className="h-3 w-3" />
                      Accept handoff
                    </Button>
                  </div>
                </div>
              ) : null}

              {selected.status === "human_active" ? (
                <div className="flex flex-col justify-between gap-3 border-b border-cyan/20 bg-cyan/[0.045] px-4 py-3 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan/25 bg-cyan/10 text-cyan">
                      <Headphones className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <p className="text-[11.5px] font-medium text-cyan">You have control</p>
                      <p className="mt-0.5 text-[10.5px] leading-relaxed text-cyan/80">
                        Ayesha is assisting silently. The customer can hear you now.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={playHandoff} disabled={playing}>
                      {playing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                      Play script
                    </Button>
                    <Button variant="outline" size="sm" onClick={returnToAI}>
                      <ArrowLeftRight className="h-3 w-3" />
                      Return to AI
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div className="min-w-0 border-b border-line lg:border-b-0 lg:border-r">
                  <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-3.5 w-3.5 text-muted-2" />
                      <p className="text-[11px] font-medium text-ink">Conversation</p>
                    </div>
                    <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-muted-2">
                      {selected.transcript.length} turns · live
                    </span>
                  </div>
                  <Transcript session={selected} className="h-[360px]" />
                  <div className="border-t border-line p-3">
                    {selected.control === "human" ? (
                      <>
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {HANDOFF_TURNS.filter((turn) => turn.role === "human").map((turn) => (
                            <button
                              key={turn.text}
                              type="button"
                              onClick={() => send(turn.text)}
                              className="max-w-full truncate rounded-full border border-line bg-surface px-2.5 py-1 text-[9.5px] text-muted transition-colors hover:border-line-strong hover:text-ink"
                            >
                              {turn.text.slice(0, 55)}...
                            </button>
                          ))}
                        </div>
                        <div className="flex items-end gap-2">
                          <Textarea
                            value={message}
                            onChange={(event) => setMessage(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                send();
                              }
                            }}
                            placeholder="Speak as Sara..."
                            className="min-h-10 h-10 resize-none py-2.5"
                          />
                          <Button variant="primary" size="md" onClick={() => send()} disabled={!message.trim()}>
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <p className="mt-2 flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-muted-2">
                          <Mic className="h-2.5 w-2.5" />
                          Live takeover · message appears as spoken · AI is silent
                        </p>
                      </>
                    ) : (
                      <div className="flex items-center justify-between rounded-lg border border-line bg-surface-2/50 px-3 py-2.5">
                        <p className="text-[10px] text-muted">
                          {selected.status === "escalating"
                            ? "Accept the handoff to take control."
                            : "AI is handling this call. Monitor or wait for escalation."}
                        </p>
                        {selected.status === "escalating" ? (
                          <Button variant="primary" size="sm" onClick={accept}>
                            Accept
                          </Button>
                        ) : (
                          <Badge tone="accent" dot>
                            AI active
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <aside className="p-3">
                  <div className="rounded-xl border border-line bg-surface-2/50 p-3">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-accent" />
                      <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-accent">
                        AI context
                      </p>
                    </div>
                    <p className="mt-2 text-[10.5px] leading-relaxed text-muted">
                      Customer reports a duplicate ${"49.00"} charge on order 4821. AI verified two
                      captures and identified one duplicate.
                    </p>
                    <div className="mt-2.5 space-y-1.5 border-t border-line pt-2 text-[9.5px]">
                      <div className="flex justify-between">
                        <span className="text-muted-2">Confidence</span>
                        <span className={selected.confidence < 0.65 ? "text-amber" : "text-accent"}>
                          {selected.confidence.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-2">Language</span>
                        <span className="text-ink">{LANGUAGE_SHORT[selected.language]}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-2">Tools</span>
                        <span className="text-ink">{selected.toolCalls.length} called</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 rounded-xl border border-amber/20 bg-amber/[0.04] p-3">
                    <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-amber">
                      Needs human
                    </p>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-amber/90">
                      Cancel the order and refund to the card. Policy exception — outside AI authority.
                    </p>
                  </div>

                  <div className="mt-2 rounded-xl border border-line bg-surface-2/50 p-3">
                    <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-2">
                      Suggested reply
                    </p>
                    <button
                      type="button"
                      onClick={() => send(HANDOFF_TURNS[0].text)}
                      className="mt-1.5 w-full text-left text-[10px] leading-relaxed text-muted transition-colors hover:text-ink"
                    >
                      &ldquo;Hi Zara, I&apos;m Sara. I have the full context...&rdquo;
                    </button>
                    <button
                      type="button"
                      className="mt-2 flex items-center gap-1 text-[9px] font-medium text-cyan hover:underline"
                      onClick={() => {
                        if (!selected) return;
                        const current = readLive(selected.id);
                        if (current) writeLive(applyCustomerTurn(current, HANDOFF_TURNS[1].text, "en"));
                      }}
                      disabled={selected.control !== "human"}
                    >
                      Simulate customer reply <ArrowUpRight className="h-2.5 w-2.5" />
                    </button>
                  </div>

                  <div className="mt-2 rounded-xl border border-line bg-surface-2/50 p-3">
                    <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-2">
                      Handoff record
                    </p>
                    <div className="mt-1.5 space-y-1 text-[9.5px] text-muted">
                      <p className="flex items-center justify-between gap-3">
                        <span className="shrink-0">Reason</span>
                        <span className="max-w-[150px] break-words text-right leading-snug text-ink">
                          {selected.handoff?.reason ?? "—"}
                        </span>
                      </p>
                      <p className="flex items-center justify-between">
                        <span>Requested</span>
                        <span className="text-ink">
                          {selected.handoff ? formatRelative(new Date(selected.handoff.requestedAt).toISOString()) : "—"}
                        </span>
                      </p>
                      <p className="flex items-center justify-between">
                        <span>Agent</span>
                        <span className="text-ink">{selected.handoff?.supervisor ?? "—"}</span>
                      </p>
                    </div>
                  </div>
                </aside>
              </div>
            </Panel>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-4 py-2.5">
              <div className="flex items-center gap-2 text-[9.5px] text-muted-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green" />
                Customer is hearing {selected.control === "human" ? "Sara" : "Ayesha"} ·{" "}
                {formatDuration(elapsed)} elapsed
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="outline">{selected.id}</Badge>
                <Link href="/sessions" className="text-[9.5px] text-muted hover:text-ink">
                  Session log
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <Panel className="flex min-h-[540px] items-center justify-center">
            <div className="max-w-md px-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface-2 text-muted">
                <Headphones className="h-5 w-5" />
              </div>
              <h2 className="mt-4 font-display text-[22px] font-normal tracking-[-0.02em] text-ink">The desk is quiet.</h2>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
                Start a customer call in a new window. When the AI hits a policy edge or the customer
                asks for a person, the handoff appears here with the full conversation attached.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button variant="primary" size="sm" onClick={startDemoCall}>
                  <Play className="h-3 w-3" />
                  Open customer window
                </Button>
                <Link href="/">
                  <Button variant="secondary" size="sm">
                    Back to dashboard
                  </Button>
                </Link>
              </div>
            </div>
          </Panel>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-4 py-2.5">
        <p className="flex items-center gap-2 text-[9.5px] text-muted-2">
          <Zap className="h-3 w-3 text-accent/60" />
          Handoff keeps the LiveKit room alive. Context is transferred as a structured event, not a
          warm transfer call.
        </p>
        <Badge tone="outline">Supervisor console</Badge>
      </div>
    </div>
  );
}
