"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Room, RoomEvent } from "livekit-client";
import {
  RoomAudioRenderer,
  RoomContext,
  StartAudio,
  useDataChannel,
  useLocalParticipant,
  useTranscriptions,
  useVoiceAssistant,
} from "@livekit/components-react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Database,
  Loader2,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  RotateCcw,
  X,
} from "lucide-react";
import type { Agent, Language, SessionRecord, Turn } from "@/lib/types";
import { saveCompleted } from "@/lib/live-store";
import { useVoiceHealth, voiceApi } from "@/lib/voice-api";
import { cn, formatDuration } from "@/lib/utils";
import { AgentAvatar, LivePill, Logo } from "@/components/brand";
import { Button, Panel } from "@/components/ui";
import { Waveform, type WaveState } from "@/components/live/waveform";

const TOOL_TOPIC = "agent.tool";
const AGENT_JOIN_TIMEOUT_MS = 20_000;

interface ToolEvent {
  id: string;
  label: string;
  status: "running" | "done";
  result?: string;
  customer?: string | null;
  ms?: number;
  at: number;
}

interface LiveTurn extends Turn {
  final: boolean;
}

type Phase = "ready" | "connecting" | "connected" | "ended";

interface CallSnapshot {
  turns: LiveTurn[];
  tools: ToolEvent[];
  customer: string | null;
}

const EMPTY_SNAPSHOT: CallSnapshot = { turns: [], tools: [], customer: null };

const STATE_COPY: Record<string, { label: string; wave: WaveState }> = {
  listening: { label: "Listening", wave: "listening" },
  idle: { label: "Listening", wave: "listening" },
  thinking: { label: "Thinking", wave: "thinking" },
  speaking: { label: "Speaking", wave: "speaking" },
  failed: { label: "Agent error", wave: "muted" },
};

function toLanguage(code: string | undefined): Language {
  if (code?.startsWith("hi")) return "hi";
  if (code?.startsWith("ur")) return "ur";
  return "en";
}

function buildRecord({
  id,
  agent,
  startedAt,
  endedAt,
  turns,
  tools,
  customer,
}: {
  id: string;
  agent: Agent;
  startedAt: number;
  endedAt: number;
  turns: LiveTurn[];
  tools: ToolEvent[];
  customer: string | null;
}): SessionRecord {
  const answered = turns.some((turn) => turn.role === "customer");
  const lookups = tools.filter((tool) => tool.label.startsWith("Record lookup"));
  const searches = tools.filter((tool) => tool.label.startsWith("Document search"));
  const intent = lookups.length ? "Order inquiry" : searches.length ? "Policy question" : "General inquiry";
  const completed = tools.filter((tool) => tool.status === "done");
  const bullets = completed.map((tool) => `${tool.label}: ${tool.result ?? "done"}`);
  if (!bullets.length) bullets.push(answered ? "Answered without a data lookup." : "The caller did not speak.");

  return {
    id,
    agentId: agent.id,
    customerName: customer ?? "Caller",
    language: turns.find((turn) => turn.role === "customer")?.language ?? "en",
    startedAt: new Date(startedAt).toISOString(),
    durationSec: Math.max(1, Math.round((endedAt - startedAt) / 1000)),
    status: answered ? "completed" : "abandoned",
    outcome: answered ? "resolved" : "unresolved",
    sentiment: "neutral",
    intent,
    handledBy: "ai",
    turnCount: turns.length,
    live: true,
    transcript: turns.map(({ id, role, text, at, language }) => ({ id, role, text, at, language })),
    summary: {
      headline: customer ? `${intent} for ${customer}` : intent,
      intent,
      outcome: answered ? "Answered by AI" : "No conversation",
      sentiment: "neutral",
      resolution: answered ? "Completed" : "No response",
      bullets,
      keyMoments: completed.map((tool) => ({
        at: Math.max(0, Math.round((tool.at - startedAt) / 1000)),
        label: tool.label,
        type: "tool" as const,
      })),
      recommendation: "",
    },
  };
}

function CallControl({
  icon,
  label,
  onClick,
  active,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className="group flex flex-col items-center gap-1.5">
      <span
        className={cn(
          "flex h-11 w-11 items-center justify-center border transition-all",
          danger
            ? "border-red/30 bg-red/12 text-red hover:bg-red/20"
            : active
              ? "border-accent/30 bg-accent/12 text-accent"
              : "border-line bg-surface-2 text-muted hover:border-line-strong hover:bg-surface-3 hover:text-ink",
        )}
      >
        {icon}
      </span>
      <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-muted-2 group-hover:text-muted">
        {label}
      </span>
    </button>
  );
}

function InCall({
  agent,
  startedAt,
  snapshotRef,
  onEnd,
}: {
  agent: Agent;
  startedAt: number;
  snapshotRef: React.RefObject<() => CallSnapshot>;
  onEnd: () => void;
}) {
  const { state, agent: agentParticipant } = useVoiceAssistant();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const transcriptions = useTranscriptions();
  const { health } = useVoiceHealth();
  const [tools, setTools] = useState<ToolEvent[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useDataChannel(TOOL_TOPIC, (message) => {
    try {
      const event = JSON.parse(new TextDecoder().decode(message.payload)) as Omit<ToolEvent, "at">;
      setTools((current) => {
        const existing = current.find((item) => item.id === event.id);
        if (existing) return current.map((item) => (item.id === event.id ? { ...existing, ...event } : item));
        return [...current, { ...event, at: Date.now() }];
      });
    } catch {
      // ignore malformed events
    }
  });

  const turns = useMemo<LiveTurn[]>(
    () =>
      transcriptions
        .filter((item) => item.text.trim())
        .map((item) => {
          const isCaller = item.participantInfo.identity === localParticipant.identity;
          const attributes = item.streamInfo.attributes ?? {};
          return {
            id: item.streamInfo.id,
            role: isCaller ? "customer" : "ai",
            text: item.text.trim(),
            at: Math.max(0, Math.round((item.streamInfo.timestamp - startedAt) / 1000)),
            language: toLanguage(attributes["lk.transcription_language"]),
            final: attributes["lk.transcription_final"] !== "false",
          };
        }),
    [transcriptions, localParticipant.identity, startedAt],
  );

  const customer = [...tools].reverse().find((tool) => tool.customer)?.customer ?? null;
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const agentMissing = !agentParticipant && now - startedAt > AGENT_JOIN_TIMEOUT_MS;
  const copy = agentParticipant
    ? (STATE_COPY[state] ?? { label: "Connecting", wave: "muted" as WaveState })
    : { label: "Waiting for agent", wave: "muted" as WaveState };

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  useEffect(() => {
    snapshotRef.current = () => ({ turns, tools, customer });
  }, [snapshotRef, turns, tools, customer]);

  const pipeline = [
    { label: "Speech to text", provider: "Deepgram", detail: health?.voice.providers.deepgram.detail },
    { label: "Reasoning", provider: "Azure OpenAI", detail: health?.voice.providers.azureOpenAI.detail },
    { label: "Text to speech", provider: "Smallest AI", detail: health?.voice.providers.smallestAI.detail },
  ];

  return (
    <div className="mx-auto grid w-full max-w-[1560px] flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[270px_minmax(0,1fr)] lg:p-4 xl:grid-cols-[270px_minmax(0,1fr)_360px]">
      <aside className="order-2 space-y-3 lg:order-1">
        <Panel className="p-4">
          <div className="flex items-center gap-3">
            <AgentAvatar name={agent.name} color={agent.color} size="lg" status="active" />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ink">{agent.name}</p>
              <p className="truncate text-[10.5px] text-muted">{agent.role}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
            <span className="text-[9px] uppercase tracking-[0.12em] text-muted-2">Caller</span>
            <span className="text-[11px] font-medium text-ink">{customer ?? "Not identified"}</span>
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-2">Data lookups</p>
            <Database className="h-3 w-3 text-muted-2" />
          </div>
          <div className="mt-2.5 space-y-2">
            {tools.length === 0 ? (
              <p className="text-[10px] text-muted-2">No lookups yet.</p>
            ) : (
              tools.map((tool) => (
                <div key={tool.id} className="border border-line bg-surface px-2.5 py-2">
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
                  {tool.result ? (
                    <p className="mt-1 text-[9.5px] leading-relaxed text-muted-2">
                      {tool.result}
                      {typeof tool.ms === "number" ? ` · ${tool.ms}ms` : ""}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel className="p-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-2">Pipeline</p>
          <div className="mt-3 space-y-2">
            {pipeline.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted">{item.label}</span>
                <span className="truncate text-right text-[10px] text-ink">
                  {item.provider}
                  {item.detail ? <span className="text-muted-2"> · {item.detail}</span> : null}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </aside>

      <main className="order-1 min-w-0 lg:order-2">
        <Panel className="relative flex h-full min-h-[600px] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <LivePill />
            <span className="flex items-center gap-1.5 font-mono text-[12px] text-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-green" />
              {formatDuration(elapsed)}
            </span>
          </div>

          {agentMissing ? (
            <div className="flex items-start gap-2.5 border-b border-amber/20 bg-amber/[0.05] px-4 py-3">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" />
              <p className="text-[11px] leading-relaxed text-amber">
                The voice agent hasn&apos;t joined. Check that the agent worker is running.
              </p>
            </div>
          ) : null}

          <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
            <div className="relative flex h-[310px] w-[330px] items-center justify-center sm:h-[350px] sm:w-[390px]">
              <Waveform
                state={copy.wave}
                active={Boolean(agentParticipant) && state !== "failed"}
                className="absolute inset-0"
              />
            </div>
            <div className="mt-5 text-center">
              <h1 className="font-display text-[22px] font-light tracking-[-0.02em] text-ink">{agent.name}</h1>
              <p className="mt-0.5 text-[10.5px] text-muted">{agent.role}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 border border-accent/25 bg-accent/[0.07] px-2.5 py-1 font-mono text-[8.5px] uppercase tracking-[0.12em] text-accent">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                {copy.label}
              </span>
            </div>
            <StartAudio
              label="Enable audio"
              className="mt-4 border border-line bg-surface px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink"
            />
          </div>

          <div className="border-t border-line bg-surface-2 px-4 py-4">
            <div className="flex items-center justify-center gap-8">
              <CallControl
                icon={isMicrophoneEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                label={isMicrophoneEnabled ? "Mute" : "Unmute"}
                onClick={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
                active={!isMicrophoneEnabled}
              />
              <CallControl icon={<PhoneOff className="h-4 w-4" />} label="End call" onClick={onEnd} danger />
            </div>
          </div>
        </Panel>
      </main>

      <section className="order-3 min-w-0">
        <Panel className="flex h-full min-h-[420px] flex-col overflow-hidden">
          <div className="border-b border-line px-3.5 py-3">
            <p className="text-[11.5px] font-medium text-ink">Transcript</p>
          </div>
          <div
            ref={transcriptRef}
            className="scrollbar-thin h-[520px] flex-1 space-y-3 overflow-y-auto p-4 xl:h-[calc(100vh-160px)]"
          >
            {turns.length === 0 ? (
              <p className="pt-10 text-center text-[11.5px] text-muted">Waiting for the conversation...</p>
            ) : (
              turns.map((turn) => (
                <div key={turn.id}>
                  <div className="mb-1 flex items-center gap-1.5">
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        turn.role === "ai" ? "text-accent" : "text-ink/70",
                      )}
                    >
                      {turn.role === "ai" ? agent.name : customer ?? "Caller"}
                    </span>
                    <span className="ml-auto font-mono text-[8px] text-muted-2">{formatDuration(turn.at)}</span>
                  </div>
                  <div
                    className={cn(
                      "border px-3 py-2 text-[11.5px] leading-relaxed text-ink/90",
                      turn.role === "ai" ? "border-accent/10 bg-accent/[0.045]" : "border-line bg-surface",
                      !turn.final && "opacity-70",
                    )}
                  >
                    {turn.text}
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>
    </div>
  );
}

export function LiveCall({ sessionId, agent }: { sessionId: string; agent: Agent }) {
  const router = useRouter();
  const [room] = useState(() => new Room({ adaptiveStream: true, dynacast: true }));
  const [phase, setPhase] = useState<Phase>("ready");
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [record, setRecord] = useState<SessionRecord | null>(null);
  const { health, error: healthError } = useVoiceHealth();
  const phaseRef = useRef<Phase>("ready");
  const snapshotRef = useRef<() => CallSnapshot>(() => EMPTY_SNAPSHOT);

  const moveTo = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  const finish = useCallback(() => {
    if (phaseRef.current !== "connected") return;
    phaseRef.current = "ended";
    const { turns, tools, customer } = snapshotRef.current();
    const result = buildRecord({ id: sessionId, agent, startedAt, endedAt: Date.now(), turns, tools, customer });
    saveCompleted(result);
    setRecord(result);
    setPhase("ended");
    void room.disconnect();
  }, [agent, room, sessionId, startedAt]);

  // Ending from either side (End call, agent leaves, network drop, leaving the page)
  // goes through `finish`, so the session is always logged once.
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  }, [finish]);

  useEffect(() => {
    const onDisconnected = () => finishRef.current();
    room.on(RoomEvent.Disconnected, onDisconnected);
    return () => {
      void room.disconnect();
      room.off(RoomEvent.Disconnected, onDisconnected);
    };
  }, [room]);

  const start = async () => {
    moveTo("connecting");
    setError(null);
    try {
      const connection = await voiceApi.token(agent);
      await room.connect(connection.serverUrl, connection.participantToken);
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
      } catch {
        throw new Error("Microphone access is blocked. Allow the microphone for this site and try again.");
      }
      setStartedAt(Date.now());
      moveTo("connected");
    } catch (err) {
      await room.disconnect();
      setError(err instanceof Error ? err.message : "Could not start the call.");
      moveTo("ready");
    }
  };

  const missing = health
    ? Object.entries({
        LiveKit: health.voice.providers.livekit.configured,
        "Azure OpenAI": health.voice.providers.azureOpenAI.configured,
        Deepgram: health.voice.providers.deepgram.configured,
        "Smallest AI": health.voice.providers.smallestAI.configured,
      })
        .filter(([, configured]) => !configured)
        .map(([name]) => name)
    : [];

  return (
    <RoomContext.Provider value={room}>
      <div className="flex min-h-screen flex-col bg-bg">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Logo compact />
            <span className="hidden h-4 w-px bg-line sm:block" />
            <span className="hidden font-mono text-[9px] uppercase tracking-[0.16em] text-muted sm:inline">
              Customer call
            </span>
          </div>
          <Link href="/">
            <Button variant="ghost" size="icon-sm" aria-label="Exit call">
              <X className="h-4 w-4" />
            </Button>
          </Link>
        </header>

        {phase === "connected" || phase === "ended" ? (
          <InCall agent={agent} startedAt={startedAt} snapshotRef={snapshotRef} onEnd={finish} />
        ) : (
          <div className="flex flex-1 items-center justify-center p-4">
            <Panel className="w-full max-w-md p-6 text-center">
              <div className="flex justify-center">
                <AgentAvatar name={agent.name} color={agent.color} size="xl" />
              </div>
              <h1 className="mt-4 font-display text-[24px] font-light tracking-[-0.02em] text-ink">
                Call {agent.name}
              </h1>
              <p className="mt-1 text-[11.5px] text-muted">{agent.role}</p>

              {healthError ? (
                <p className="mt-4 border border-red/30 bg-red/[0.05] px-3 py-2 text-[11px] text-red">
                  {healthError}
                </p>
              ) : missing.length ? (
                <p className="mt-4 border border-amber/30 bg-amber/[0.05] px-3 py-2 text-[11px] text-amber">
                  Voice calling needs credentials for {missing.join(", ")}.{" "}
                  <Link href="/integrations" className="underline underline-offset-2">
                    Integrations
                  </Link>
                </p>
              ) : null}

              {error ? (
                <p className="mt-4 border border-red/30 bg-red/[0.05] px-3 py-2 text-[11px] text-red">{error}</p>
              ) : null}

              <Button
                variant="primary"
                size="lg"
                className="mt-6 w-full"
                onClick={() => void start()}
                disabled={phase === "connecting" || !health?.voice.ready}
              >
                {phase === "connecting" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Phone className="h-4 w-4" />
                )}
                {phase === "connecting" ? "Connecting" : "Start call"}
              </Button>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-2">
                Uses your microphone
              </p>
            </Panel>
          </div>
        )}

        <RoomAudioRenderer />
      </div>

      {phase === "ended" && record ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#f8f7f6]/90 p-4 backdrop-blur-xl">
          <div className="panel-raised w-full max-w-lg overflow-hidden">
            <div className="border-b border-line px-6 py-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-accent/25 bg-accent/10">
                <CheckCircle2 className="h-5 w-5 text-accent" />
              </div>
              <h2 className="mt-3 font-display text-[26px] font-light tracking-[-0.02em] text-ink">Call ended</h2>
            </div>
            <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
              <div className="px-3 py-3 text-center">
                <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-2">Duration</p>
                <p className="mt-1 text-[14px] font-medium text-ink">{formatDuration(record.durationSec)}</p>
              </div>
              <div className="px-3 py-3 text-center">
                <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-2">Caller</p>
                <p className="mt-1 truncate text-[14px] font-medium text-ink">{record.customerName}</p>
              </div>
              <div className="px-3 py-3 text-center">
                <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-2">Turns</p>
                <p className="mt-1 text-[14px] font-medium text-ink">{record.turnCount}</p>
              </div>
            </div>
            <div className="p-4">
              <Link href={`/sessions/${record.id}`}>
                <Button variant="primary" className="w-full">
                  View session
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const id = `SES-LIVE-${Date.now().toString(36).toUpperCase()}`;
                    router.replace(`/call/${id}?agent=${agent.id}&mode=live`);
                  }}
                >
                  <RotateCcw className="h-3 w-3" />
                  Start another
                </Button>
                <Link href="/">
                  <Button variant="secondary" size="sm" className="w-full">
                    <ArrowLeft className="h-3 w-3" />
                    Overview
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </RoomContext.Provider>
  );
}
