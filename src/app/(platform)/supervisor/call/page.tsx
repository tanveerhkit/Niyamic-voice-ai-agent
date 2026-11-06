"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Room, RoomEvent } from "livekit-client";
import {
  RoomAudioRenderer,
  RoomContext,
  useAudioPlayback,
  useLocalParticipant,
  useSpeakingParticipants,
} from "@livekit/components-react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  Headphones,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
} from "lucide-react";
import {
  type ActiveCall,
  HANDOFF_TOPIC,
  type HandoffContext,
  refreshActiveCalls,
  useActiveCalls,
  voiceApi,
} from "@/lib/voice-api";
import { cn, formatDuration } from "@/lib/utils";
import { AgentAvatar } from "@/components/brand";
import { PageHeader } from "@/components/dashboard";
import { Badge, Button, EmptyState, Panel } from "@/components/ui";

/** The person taking calls from the Supervisor page; the scripted demo uses the same name. */
const SPECIALIST_NAME = "Sara Malik";

type Phase = "connecting" | "connected" | "ended";

function OnCall({
  phase,
  call,
  roomName,
  context,
  joinedAt,
  error,
  busy,
  onReturn,
  onEnd,
}: {
  phase: Phase;
  call: ActiveCall | undefined;
  roomName: string;
  context: HandoffContext | null;
  joinedAt: number;
  error: string | null;
  busy: boolean;
  onReturn: () => void;
  onEnd: () => void;
}) {
  const { canPlayAudio, startAudio } = useAudioPlayback();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const callerSpeaking = useSpeakingParticipants().some((participant) =>
    participant.identity.startsWith("customer-"),
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const connected = phase === "connected";
  const customerName = call?.customerName ?? "Caller";
  const agentName = call?.agentName ?? "The agent";
  const reason = context?.reason || call?.handoffReason;
  const summary = context?.summary || call?.handoffSummary;
  const team = context?.team || call?.transferTeam;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Panel className="flex min-h-[520px] flex-col overflow-hidden">
        <div className="flex flex-col justify-between gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <AgentAvatar name={customerName} color="cyan" size="md" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[14px] font-medium text-ink">{customerName}</p>
                <Badge tone={connected ? "cyan" : "neutral"} dot>
                  {connected ? "You're on the call" : "Joining"}
                </Badge>
              </div>
              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-2">
                {roomName} · {agentName}
              </p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 font-mono text-[12px] text-ink">
            <span className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-cyan" : "bg-muted-2")} />
            {connected ? formatDuration(Math.max(0, Math.floor((now - joinedAt) / 1000))) : "--:--"}
          </span>
        </div>

        {connected && !canPlayAudio ? (
          <div className="flex flex-col justify-between gap-3 border-b border-amber/20 bg-amber/[0.05] px-4 py-3 sm:flex-row sm:items-center">
            <p className="text-[11px] text-amber">Your browser paused the caller&apos;s audio.</p>
            <Button variant="primary" size="sm" onClick={() => void startAudio()}>
              <Volume2 className="h-3 w-3" />
              Turn on audio
            </Button>
          </div>
        ) : null}

        {error ? (
          <div className="flex items-start gap-2.5 border-b border-red/20 bg-red/[0.04] px-4 py-3">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red" />
            <p className="text-[11px] leading-relaxed text-red">{error}</p>
          </div>
        ) : null}

        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
          <span className={cn("rounded-full p-1 ring-cyan/25 transition-shadow", callerSpeaking && "ring-4")}>
            <AgentAvatar name={customerName} color="cyan" size="xl" />
          </span>
          <h1 className="mt-4 font-display text-[22px] font-light tracking-[-0.02em] text-ink">
            {connected ? (callerSpeaking ? `${customerName} is speaking` : `Talking with ${customerName}`) : "Joining the call"}
          </h1>
          <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-muted">
            {connected
              ? `${agentName} stays silent while you're on the call. Return the call when you're done and ${agentName} picks it up again.`
              : "Connecting your microphone..."}
          </p>
          {!connected ? <Loader2 className="mt-4 h-4 w-4 animate-spin text-muted-2" /> : null}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-line bg-surface-2 px-4 py-4">
          <Button
            variant={isMicrophoneEnabled ? "secondary" : "subtle"}
            onClick={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
            disabled={!connected}
          >
            {isMicrophoneEnabled ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
            {isMicrophoneEnabled ? "Mute" : "Unmute"}
          </Button>
          <Button variant="outline" onClick={onReturn} disabled={!connected || busy}>
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Return to {agentName}
          </Button>
          <Button variant="danger" onClick={onEnd} disabled={!connected || busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PhoneOff className="h-3.5 w-3.5" />}
            End call
          </Button>
        </div>
      </Panel>

      <Panel className="flex max-h-[760px] flex-col overflow-hidden">
        <div className="border-b border-line p-4">
          <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-2">Handoff</p>
          <div className="mt-2 space-y-1.5 text-[10.5px]">
            <p className="flex justify-between gap-3">
              <span className="shrink-0 text-muted-2">Reason</span>
              <span className="text-right text-ink">{reason ?? "Specialist joined the call"}</span>
            </p>
            {team ? (
              <p className="flex justify-between gap-3">
                <span className="shrink-0 text-muted-2">Team</span>
                <span className="text-right text-ink">{team}</span>
              </p>
            ) : null}
          </div>
          {summary ? (
            <p className="mt-3 border-t border-line pt-3 text-[11px] leading-relaxed text-muted">{summary}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <MessageSquare className="h-3.5 w-3.5 text-muted-2" />
          <p className="text-[11px] font-medium text-ink">Conversation with {agentName}</p>
        </div>
        <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-4">
          {!context ? (
            <p className="pt-6 text-center text-[11px] text-muted">
              {connected ? "Waiting for the conversation from the agent..." : "Loads when you join."}
            </p>
          ) : context.turns.length === 0 ? (
            <p className="pt-6 text-center text-[11px] text-muted">No conversation yet.</p>
          ) : (
            context.turns.map((turn, index) => (
              <div key={index}>
                <p
                  className={cn(
                    "mb-1 text-[10px] font-medium",
                    turn.role === "ai" ? "text-accent" : "text-ink/70",
                  )}
                >
                  {turn.role === "ai" ? agentName : customerName}
                </p>
                <div
                  className={cn(
                    "border px-3 py-2 text-[11.5px] leading-relaxed text-ink/90",
                    turn.role === "ai" ? "border-accent/10 bg-accent/[0.045]" : "border-line bg-surface",
                  )}
                >
                  {turn.text}
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}

function SpecialistCall({ roomName }: { roomName: string }) {
  const router = useRouter();
  const [room] = useState(() => new Room({ adaptiveStream: true, dynacast: true }));
  const [phase, setPhase] = useState<Phase>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<HandoffContext | null>(null);
  const [joinedAt, setJoinedAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const leavingRef = useRef(false);
  const call = useActiveCalls().calls.find((item) => item.id === roomName);

  useEffect(() => {
    let cancelled = false;
    room.registerTextStreamHandler(HANDOFF_TOPIC, async (reader) => {
      try {
        setContext(JSON.parse(await reader.readAll()) as HandoffContext);
      } catch {
        // ignore a malformed handoff; the specialist can still talk to the caller
      }
    });
    const onDisconnected = () => {
      if (!cancelled && !leavingRef.current) setPhase("ended");
    };
    room.on(RoomEvent.Disconnected, onDisconnected);

    const join = async () => {
      try {
        const connection = await voiceApi.joinCall(roomName, SPECIALIST_NAME);
        if (cancelled) return;
        await room.connect(connection.serverUrl, connection.participantToken);
        if (cancelled) return;
        try {
          await room.localParticipant.setMicrophoneEnabled(true);
        } catch {
          setError("Microphone access is blocked, so the caller can't hear you. Allow the microphone and rejoin.");
        }
        setJoinedAt(Date.now());
        setPhase("connected");
        refreshActiveCalls();
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not join the call.");
        setPhase("ended");
      }
    };
    void join();

    return () => {
      cancelled = true;
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.unregisterTextStreamHandler(HANDOFF_TOPIC);
      void room.disconnect();
    };
  }, [room, roomName]);

  const returnToAgent = async () => {
    leavingRef.current = true;
    setBusy(true);
    await room.disconnect();
    refreshActiveCalls();
    router.push("/supervisor");
  };

  const endCall = async () => {
    leavingRef.current = true;
    setBusy(true);
    try {
      await voiceApi.endCall(roomName);
    } catch (err) {
      leavingRef.current = false;
      setBusy(false);
      setError(err instanceof Error ? err.message : "Could not end the call.");
      return;
    }
    await room.disconnect();
    refreshActiveCalls();
    router.push("/supervisor");
  };

  return (
    <RoomContext.Provider value={room}>
      <PageHeader
        title="Live call"
        description={call ? `${call.customerName} · ${call.agentName}` : roomName}
        actions={
          <Link href="/supervisor">
            <Button variant="secondary">
              <ArrowLeft className="h-3.5 w-3.5" />
              Queue
            </Button>
          </Link>
        }
      />
      {phase === "ended" ? (
        <Panel className="flex min-h-[420px] items-center justify-center">
          <EmptyState
            icon={error ? <AlertTriangle className="h-5 w-5" /> : <PhoneOff className="h-5 w-5" />}
            title={error ? "Couldn't join the call" : "Call ended"}
            description={error ?? "The caller hung up."}
            action={
              <Link href="/supervisor">
                <Button variant="primary" size="sm">
                  <Headphones className="h-3 w-3" />
                  Back to queue
                </Button>
              </Link>
            }
          />
        </Panel>
      ) : (
        <OnCall
          phase={phase}
          call={call}
          roomName={roomName}
          context={context}
          joinedAt={joinedAt}
          error={error}
          busy={busy}
          onReturn={() => void returnToAgent()}
          onEnd={() => void endCall()}
        />
      )}
      <RoomAudioRenderer />
    </RoomContext.Provider>
  );
}

function SpecialistCallPage() {
  const roomName = useSearchParams().get("room");

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-7 lg:py-8">
      {roomName ? (
        <SpecialistCall key={roomName} roomName={roomName} />
      ) : (
        <Panel className="flex min-h-[420px] items-center justify-center">
          <EmptyState
            icon={<Headphones className="h-5 w-5" />}
            title="No call selected"
            description="Pick a call from the Supervisor queue."
            action={
              <Link href="/supervisor">
                <Button variant="primary" size="sm">
                  Open queue
                </Button>
              </Link>
            }
          />
        </Panel>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SpecialistCallPage />
    </Suspense>
  );
}
