import { CALL_SCRIPT } from "./call-script";
import { uid } from "./utils";
import { buildLiveSummary, liveToRecord } from "./session-content";
import type { Handoff, LiveSession, Speaker, Turn } from "./types";

export function elapsedSeconds(session: LiveSession, now = Date.now()) {
  return Math.max(0, Math.floor((now - session.startedAt) / 1000));
}

function append(
  session: LiveSession,
  role: Speaker,
  text: string,
  extra: Partial<Turn> = {},
): Turn[] {
  const turn: Turn = {
    id: uid("turn"),
    role,
    text,
    at: elapsedSeconds(session),
    ...extra,
  };
  return [...session.transcript, turn];
}

export function applyManualTransfer(session: LiveSession): LiveSession {
  if (session.status === "escalating" || session.status === "human_active" || session.status === "ended") {
    return session;
  }
  const handoff: Handoff = {
    status: "requested",
    reason: "Customer requested a human",
    requestedAt: Date.now(),
  };
  return {
    ...session,
    partial: undefined,
    transcript: append(
      session,
      "ai",
      "Of course — I'll connect you with a specialist now. They'll have our full conversation.",
    ),
    status: "escalating",
    agentState: "listening",
    risk: "high",
    handoff,
    reasoning: "Manual transfer · sharing full context",
  };
}

export function applyFastForwardToEscalation(session: LiveSession): LiveSession {
  if (
    session.status === "human_active" ||
    session.status === "escalating" ||
    session.status === "ended"
  ) {
    return session;
  }

  const now = Date.now();
  const startedAt = now - 66_000;
  const times = [1, 9, 16, 24, 33, 42, 51, 60];
  const transcript: Turn[] = [];
  let turnIndex = 0;

  for (const event of CALL_SCRIPT) {
    if (event.type === "handoff") break;
    if (event.type === "ai" || event.type === "customer") {
      transcript.push({
        id: uid("turn"),
        role: event.type === "ai" ? "ai" : "customer",
        text: event.text,
        at: times[turnIndex] ?? 60,
        language: event.language ?? session.language,
        ...(event.type === "ai" && event.confidence !== undefined
          ? { confidence: event.confidence }
          : {}),
      });
      turnIndex += 1;
    }
  }

  const toolEvent = CALL_SCRIPT.find((event) => event.type === "tool");
  const toolCalls =
    toolEvent && toolEvent.type === "tool"
      ? [
          {
            id: uid("tool"),
            tool: toolEvent.tool,
            label: toolEvent.label,
            result: toolEvent.result,
            status: "done" as const,
            at: 38,
          },
        ]
      : [];

  return {
    ...session,
    startedAt,
    status: "ai_active",
    control: "ai",
    phase: "call",
    step: 9,
    partial: undefined,
    nextAt: now + 200,
    confidence: 0.58,
    risk: "high",
    agentState: "thinking",
    reasoning: "Policy exception · escalation required",
    transcript,
    toolCalls,
  };
}

export function applyAcceptHandoff(
  session: LiveSession,
  supervisor = "Sara Malik",
): LiveSession {
  if (session.status !== "escalating") return session;
  const now = Date.now();
  const existing: Handoff = session.handoff ?? {
    status: "requested",
    reason: "Escalation requested",
    requestedAt: now,
  };
  return {
    ...session,
    status: "human_active",
    control: "human",
    agentState: "assistive",
    risk: "medium",
    handoff: {
      ...existing,
      status: "accepted",
      acceptedAt: now,
      supervisor,
    },
    transcript: append(session, "system", `${supervisor} joined the call`),
    reasoning: "Human has control · AI is assisting silently",
  };
}

export function applyHumanTurn(session: LiveSession, text: string): LiveSession {
  if (session.control !== "human") return session;
  return {
    ...session,
    transcript: append(session, "human", text),
  };
}

export function applyCustomerTurn(session: LiveSession, text: string, language?: LiveSession["language"]): LiveSession {
  return {
    ...session,
    transcript: append(session, "customer", text, language ? { language } : {}),
  };
}

export function applyReturnToAI(session: LiveSession): LiveSession {
  if (session.status !== "human_active") return session;
  const now = Date.now();
  return {
    ...session,
    status: "ai_active",
    control: "ai",
    phase: "closing",
    step: 0,
    nextAt: now + 600,
    agentState: "listening",
    risk: "low",
    reasoning: "Control returned to AI · closing the loop",
    handoff: session.handoff
      ? { ...session.handoff, status: "completed", completedAt: now }
      : undefined,
    transcript: append(session, "system", "Control returned to Ayesha"),
  };
}

export function finishSession(session: LiveSession): LiveSession {
  if (session.status === "ended") return session;
  const endedAt = Date.now();
  const withEnd = { ...session, endedAt };
  const summary = session.summary ?? buildLiveSummary(withEnd);
  const record = liveToRecord({ ...withEnd, summary });
  return {
    ...withEnd,
    status: "ended",
    phase: "ended",
    agentState: "muted",
    partial: undefined,
    summary,
    record,
    reasoning: "Call ended · summary generated",
    nextAt: Number.MAX_SAFE_INTEGER,
  };
}
