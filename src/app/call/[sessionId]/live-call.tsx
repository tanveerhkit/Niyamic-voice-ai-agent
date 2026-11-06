"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { type Participant, ParticipantKind, Room, RoomEvent } from "livekit-client";
import {
  RoomAudioRenderer,
  RoomContext,
  useAudioPlayback,
  useDataChannel,
  useLocalParticipant,
  useMediaDeviceSelect,
  useRemoteParticipants,
  useRoomContext,
  useSpeakingParticipants,
  useTrackVolume,
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
  Headphones,
  Loader2,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  RotateCcw,
  Volume2,
  X,
} from "lucide-react";
import type { Agent, Handoff, KeyMoment, Language, SessionRecord, Turn } from "@/lib/types";
import { saveCompleted } from "@/lib/live-store";
import { HANDOFF_ATTRIBUTES, SPECIALIST_PREFIX, useVoiceHealth, voiceApi } from "@/lib/voice-api";
import { cn, formatDuration } from "@/lib/utils";
import { AgentAvatar, LivePill, Logo } from "@/components/brand";
import { Button, Label, Panel, Progress, Select } from "@/components/ui";
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
  handoffs: Handoff[];
}

const EMPTY_SNAPSHOT: CallSnapshot = { turns: [], tools: [], customer: null, handoffs: [] };

const MISSED_NOTE = "No specialist joined in time; the caller was offered a call back.";

/** Folds a change in the voice agent's handoff attributes into the call's handoff log. */
function nextHandoffs(log: Handoff[], attributes: Record<string, string>, now: number): Handoff[] {
  const state = attributes[HANDOFF_ATTRIBUTES.state] ?? "";
  const last = log.at(-1);
  const open = last && !last.completedAt && !last.note ? last : undefined;
  const rest = open ? log.slice(0, -1) : log;
  const reason = attributes[HANDOFF_ATTRIBUTES.reason] || open?.reason || "Transfer requested";

  if (state === "requested") {
    return open ? log : [...log, { status: "requested", reason, requestedAt: now }];
  }
  if (state === "accepted") {
    if (open?.status === "accepted") return log;
    return [
      ...rest,
      {
        requestedAt: open?.requestedAt ?? now,
        status: "accepted",
        reason,
        acceptedAt: now,
        supervisor: attributes[HANDOFF_ATTRIBUTES.specialist] || "Specialist",
      },
    ];
  }
  if (state === "missed" && open?.status === "requested") {
    return [...rest, { ...open, note: MISSED_NOTE }];
  }
  if (!state && open?.status === "accepted") {
    return [...rest, { ...open, status: "completed", completedAt: now }];
  }
  return log;
}

/** Transcript markers for each handoff step, timed from the start of the call. */
function handoffTurns(handoffs: Handoff[], startedAt: number, agentName: string): LiveTurn[] {
  const at = (time: number) => Math.max(0, Math.round((time - startedAt) / 1000));
  return handoffs.flatMap((handoff, index) => {
    const turns: LiveTurn[] = [
      {
        id: `handoff-${index}-requested`,
        role: "system",
        text: `Transfer requested · ${handoff.reason}${handoff.note ? " · no specialist joined" : ""}`,
        at: at(handoff.requestedAt),
        final: true,
      },
    ];
    if (handoff.acceptedAt) {
      turns.push({
        id: `handoff-${index}-accepted`,
        role: "system",
        text: `${handoff.supervisor ?? "Specialist"} joined the call`,
        at: at(handoff.acceptedAt),
        final: true,
      });
    }
    if (handoff.completedAt) {
      turns.push({
        id: `handoff-${index}-completed`,
        role: "system",
        text: `Call returned to ${agentName}`,
        at: at(handoff.completedAt),
        final: true,
      });
    }
    return turns;
  });
}

function withHandoffs(turns: LiveTurn[], handoffs: Handoff[], startedAt: number, agentName: string) {
  if (!handoffs.length) return turns;
  return [...turns, ...handoffTurns(handoffs, startedAt, agentName)].sort((a, b) => a.at - b.at);
}

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
  handoffs,
}: {
  id: string;
  agent: Agent;
  startedAt: number;
  endedAt: number;
  turns: LiveTurn[];
  tools: ToolEvent[];
  customer: string | null;
  handoffs: Handoff[];
}): SessionRecord {
  const answered = turns.some((turn) => turn.role === "customer");
  const lookups = tools.filter((tool) => tool.label.startsWith("Record lookup"));
  const searches = tools.filter((tool) => tool.label.startsWith("Document search"));
  const intent = lookups.length ? "Order inquiry" : searches.length ? "Policy question" : "General inquiry";
  const completed = tools.filter((tool) => tool.status === "done");
  const joined = handoffs.find((handoff) => handoff.acceptedAt);
  const seconds = (time: number) => Math.max(0, Math.round((time - startedAt) / 1000));

  const bullets = completed.map((tool) => `${tool.label}: ${tool.result ?? "done"}`);
  if (!bullets.length && !handoffs.length) {
    bullets.push(answered ? "Answered without a data lookup." : "The caller did not speak.");
  }
  for (const handoff of handoffs) {
    bullets.push(
      handoff.acceptedAt
        ? `Handed to ${handoff.supervisor ?? "a specialist"}: ${handoff.reason}. Their conversation isn't transcribed.`
        : `Transfer requested (${handoff.reason}), but no specialist joined.`,
    );
  }

  const keyMoments: KeyMoment[] = [
    ...completed.map((tool) => ({ at: seconds(tool.at), label: tool.label, type: "tool" as const })),
    ...handoffs.flatMap((handoff) => [
      { at: seconds(handoff.requestedAt), label: `Transfer requested · ${handoff.reason}`, type: "handoff" as const },
      ...(handoff.acceptedAt
        ? [{ at: seconds(handoff.acceptedAt), label: `${handoff.supervisor} joined`, type: "handoff" as const }]
        : []),
    ]),
  ].sort((a, b) => a.at - b.at);

  return {
    id,
    agentId: agent.id,
    customerName: customer ?? "Caller",
    language: turns.find((turn) => turn.role === "customer")?.language ?? "en",
    startedAt: new Date(startedAt).toISOString(),
    durationSec: Math.max(1, Math.round((endedAt - startedAt) / 1000)),
    status: joined ? "transferred" : answered ? "completed" : "abandoned",
    outcome: handoffs.length ? "escalated" : answered ? "resolved" : "unresolved",
    sentiment: "neutral",
    intent,
    handledBy: joined ? "hybrid" : "ai",
    transferReason: handoffs[0]?.reason,
    handoffs: handoffs.length ? handoffs : undefined,
    turnCount: turns.length,
    live: true,
    transcript: withHandoffs(turns, handoffs, startedAt, agent.name).map(({ id, role, text, at, language }) => ({
      id,
      role,
      text,
      at,
      language,
    })),
    summary: {
      headline: customer ? `${intent} for ${customer}` : intent,
      intent,
      outcome: joined
        ? `Transferred to ${joined.supervisor ?? "a specialist"}`
        : handoffs.length
          ? "Specialist requested"
          : answered
            ? "Answered by AI"
            : "No conversation",
      sentiment: "neutral",
      resolution: joined ? "Handed to a specialist" : handoffs.length ? "Call back offered" : answered ? "Completed" : "No response",
      bullets,
      keyMoments,
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

function supportsOutputSelection() {
  return typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
}

function DeviceSelect({
  label,
  devices,
  activeDeviceId,
  onChange,
}: {
  label: string;
  devices: MediaDeviceInfo[];
  activeDeviceId: string;
  onChange: (deviceId: string) => Promise<void>;
}) {
  return (
    <div>
      <Label className="mb-1.5">{label}</Label>
      <Select
        value={activeDeviceId || "default"}
        onChange={(event) => void onChange(event.target.value)}
        className="h-8 truncate text-[11px]"
      >
        {devices.length ? (
          devices.map((device, index) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `${label} ${index + 1}`}
            </option>
          ))
        ) : (
          <option value="default">Default</option>
        )}
      </Select>
    </div>
  );
}

function AudioPanel({ agentVolume }: { agentVolume: number }) {
  const mics = useMediaDeviceSelect({ kind: "audioinput" });
  const speakers = useMediaDeviceSelect({ kind: "audiooutput" });
  const canSelectOutput = supportsOutputSelection();
  const matchedRef = useRef(false);
  const { devices: micDevices, activeDeviceId: micId } = mics;
  const { devices: speakerDevices, activeDeviceId: speakerId, setActiveMediaDevice: setSpeaker } = speakers;

  // Play through the same headset as the microphone when there is one. On Windows a headset
  // is often only the "communications" device, while the browser plays to the default output.
  useEffect(() => {
    if (matchedRef.current || !canSelectOutput || !micDevices.length || !speakerDevices.length) return;
    matchedRef.current = true;
    const mic = micDevices.find((device) => device.deviceId === (micId || "default")) ?? micDevices[0];
    const match = speakerDevices.find(
      (device) =>
        device.groupId === mic.groupId && device.deviceId !== "default" && device.deviceId !== "communications",
    );
    if (match && match.deviceId !== speakerId) void setSpeaker(match.deviceId);
  }, [canSelectOutput, micDevices, micId, speakerDevices, speakerId, setSpeaker]);

  const level = Math.min(100, Math.round(agentVolume * 400));

  return (
    <Panel className="p-4">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-2">Audio</p>
      <div className="mt-3 space-y-3">
        <DeviceSelect
          label="Microphone"
          devices={micDevices}
          activeDeviceId={micId}
          onChange={mics.setActiveMediaDevice}
        />
        {canSelectOutput ? (
          <DeviceSelect label="Speaker" devices={speakerDevices} activeDeviceId={speakerId} onChange={setSpeaker} />
        ) : null}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] text-muted">Agent voice</span>
            <span className={cn("font-mono text-[9px]", level > 4 ? "text-green" : "text-muted-2")}>
              {level > 4 ? "Receiving" : "Silent"}
            </span>
          </div>
          <Progress value={level} tone={level > 4 ? "green" : "accent"} className="h-1" />
        </div>
      </div>
    </Panel>
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
  const room = useRoomContext();
  const { state, agent: agentParticipant, audioTrack, agentAttributes } = useVoiceAssistant();
  const agentVolume = useTrackVolume(audioTrack);
  const { canPlayAudio, startAudio } = useAudioPlayback();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const transcriptions = useTranscriptions();
  const specialist = useRemoteParticipants().find((participant) =>
    participant.identity.startsWith(SPECIALIST_PREFIX),
  );
  const specialistSpeaking = useSpeakingParticipants().some((participant) =>
    participant.identity.startsWith(SPECIALIST_PREFIX),
  );
  const { health } = useVoiceHealth();
  const [tools, setTools] = useState<ToolEvent[]>([]);
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onAttributes = (_changed: Record<string, string>, participant: Participant) => {
      if (participant.kind !== ParticipantKind.AGENT) return;
      setHandoffs((log) => nextHandoffs(log, participant.attributes, Date.now()));
    };
    room.on(RoomEvent.ParticipantAttributesChanged, onAttributes);
    return () => {
      room.off(RoomEvent.ParticipantAttributesChanged, onAttributes);
    };
  }, [room]);

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
  const handoffState = agentAttributes?.[HANDOFF_ATTRIBUTES.state] ?? "";
  const team = agentAttributes?.[HANDOFF_ATTRIBUTES.team] || "a specialist";
  const specialistName = specialist?.name || agentAttributes?.[HANDOFF_ATTRIBUTES.specialist] || "Specialist";
  const copy = specialist
    ? { label: specialistSpeaking ? "Speaking" : "On the call", wave: "human" as WaveState }
    : agentParticipant
      ? (STATE_COPY[state] ?? { label: "Connecting", wave: "muted" as WaveState })
      : { label: "Waiting for agent", wave: "muted" as WaveState };
  const timeline = useMemo(
    () => withHandoffs(turns, handoffs, startedAt, agent.name),
    [turns, handoffs, startedAt, agent.name],
  );

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [timeline]);

  useEffect(() => {
    snapshotRef.current = () => ({ turns, tools, customer, handoffs });
  }, [snapshotRef, turns, tools, customer, handoffs]);

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

        <AudioPanel agentVolume={agentVolume} />

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
          {!canPlayAudio ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#f8f7f6]/85 p-4 backdrop-blur-sm">
              <div className="panel-raised w-full max-w-sm p-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-accent/25 bg-accent/10">
                  <Volume2 className="h-5 w-5 text-accent" />
                </div>
                <h2 className="mt-3 font-display text-[22px] font-light tracking-[-0.02em] text-ink">
                  Turn on audio
                </h2>
                <p className="mt-1 text-[11.5px] text-muted">Your browser paused the agent&apos;s voice.</p>
                <Button variant="primary" className="mt-4 w-full" onClick={() => void startAudio()}>
                  <Volume2 className="h-3.5 w-3.5" />
                  Turn on audio
                </Button>
              </div>
            </div>
          ) : null}
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

          {specialist ? (
            <div className="flex items-start gap-2.5 border-b border-cyan/20 bg-cyan/[0.05] px-4 py-3">
              <Headphones className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan" />
              <p className="text-[11px] leading-relaxed text-cyan">
                {specialistName} from {team} is on the call. {agent.name} is listening in silence.
              </p>
            </div>
          ) : handoffState === "requested" ? (
            <div className="flex items-start gap-2.5 border-b border-amber/20 bg-amber/[0.05] px-4 py-3">
              <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-amber" />
              <p className="text-[11px] leading-relaxed text-amber">
                Connecting you to {team}. {agent.name} stays on the line until they join.
              </p>
            </div>
          ) : handoffState === "missed" ? (
            <div className="flex items-start gap-2.5 border-b border-amber/20 bg-amber/[0.05] px-4 py-3">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" />
              <p className="text-[11px] leading-relaxed text-amber">
                No one from {team} was free to join. A specialist will call you back.
              </p>
            </div>
          ) : null}

          <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
            <div className="relative flex h-[310px] w-[330px] items-center justify-center sm:h-[350px] sm:w-[390px]">
              <Waveform
                state={copy.wave}
                active={Boolean(specialist) || (Boolean(agentParticipant) && state !== "failed")}
                className="absolute inset-0"
              />
            </div>
            <div className="mt-5 text-center">
              <h1 className="font-display text-[22px] font-light tracking-[-0.02em] text-ink">
                {specialist ? specialistName : agent.name}
              </h1>
              <p className="mt-0.5 text-[10.5px] text-muted">{specialist ? team : agent.role}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 border border-accent/25 bg-accent/[0.07] px-2.5 py-1 font-mono text-[8.5px] uppercase tracking-[0.12em] text-accent">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                {copy.label}
              </span>
            </div>
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
            {timeline.length === 0 ? (
              <p className="pt-10 text-center text-[11.5px] text-muted">Waiting for the conversation...</p>
            ) : (
              timeline.map((turn) =>
                turn.role === "system" ? (
                  <div key={turn.id} className="flex items-center gap-2 py-1">
                    <span className="h-px flex-1 bg-line" />
                    <span className="max-w-[80%] border border-line bg-surface-2 px-2.5 py-1 text-center font-mono text-[8.5px] uppercase tracking-[0.1em] text-muted-2">
                      {turn.text}
                    </span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                ) : (
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
                ),
              )
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
    const { turns, tools, customer, handoffs } = snapshotRef.current();
    const result = buildRecord({
      id: sessionId,
      agent,
      startedAt,
      endedAt: Date.now(),
      turns,
      tools,
      customer,
      handoffs,
    });
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
    // Unlock audio playback while we still hold the click's user gesture.
    void room.startAudio().catch(() => undefined);
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
