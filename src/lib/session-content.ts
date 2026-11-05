import { agentName, getSeedSession } from "./seed";
import type {
  Agent,
  KeyMoment,
  LiveSession,
  SessionRecord,
  SessionSummary,
  Turn,
} from "./types";

export function buildLiveSummary(live: LiveSession): SessionSummary {
  const hasHandoff = Boolean(live.handoff?.acceptedAt);
  const resolvedAt = live.transcript.length
    ? live.transcript[live.transcript.length - 1].at
    : Math.floor((Date.now() - live.startedAt) / 1000);

  const aiConfidences = live.transcript
    .filter((turn) => turn.role === "ai" && typeof turn.confidence === "number")
    .map((turn) => turn.confidence as number);
  const minConfidence = aiConfidences.length
    ? Math.min(...aiConfidences)
    : live.confidence;
  const handoffReason = live.handoff?.reason ?? "Policy exception";
  const handoffAt = live.handoff
    ? Math.max(0, Math.floor((live.handoff.requestedAt - live.startedAt) / 1000))
    : null;
  const supervisor = live.handoff?.supervisor ?? "Sara Malik";
  const policyLed = minConfidence < 0.65;

  const keyMoments: KeyMoment[] = [];
  if (live.toolCalls[0]) {
    keyMoments.push({ at: live.toolCalls[0].at, label: live.toolCalls[0].label, type: "tool" });
  }
  if (hasHandoff) {
    keyMoments.push({
      at: handoffAt ?? 45,
      label: policyLed
        ? `Confidence dropped to ${minConfidence.toFixed(2)}`
        : "Customer requested a human",
      type: "risk",
    });
    keyMoments.push({
      at: handoffAt ?? 45,
      label: `${supervisor} joined the call`,
      type: "handoff",
    });
  }
  keyMoments.push({ at: resolvedAt, label: "Resolved · refund initiated", type: "resolution" });

  return {
    headline: hasHandoff
      ? "Duplicate charge resolved with a warm, context-rich handoff."
      : "Duplicate charge resolved by AI.",
    intent: "Duplicate charge · order 4821",
    outcome: hasHandoff ? "Refund initiated" : "Refund initiated by AI",
    sentiment: "positive",
    resolution: hasHandoff
      ? "Resolved by human · AI closed the call"
      : "Resolved by AI",
    bullets: [
      "AI verified order 4821 and identified a $49.00 duplicate charge.",
      hasHandoff
        ? policyLed
          ? `Escalated at ${minConfidence.toFixed(2)} confidence — ${handoffReason}.`
          : `Transferred at the customer's request; confidence stayed at ${minConfidence.toFixed(2)}.`
        : `Resolved without escalation at ${minConfidence.toFixed(2)} confidence.`,
      hasHandoff
        ? `${supervisor} joined with the full transcript; the customer did not repeat any details.`
        : "AI resolved the request and confirmed the refund in the same call.",
      hasHandoff
        ? "Refund issued for $49.00; control returned to AI for confirmation and close."
        : "Refund issued for $49.00 and the customer confirmed the next steps.",
    ],
    keyMoments,
    recommendation: hasHandoff
      ? policyLed
        ? "Let the AI issue duplicate-charge refunds up to $100 when the order is verified. This would have contained the call without a handoff."
        : "The customer asked for a human even though the AI had authority. Keep the join instant and context-rich — that is the product win."
      : "Keep this path. The AI resolved the request without human involvement and maintained a positive tone.",
  };
}

export function liveToRecord(live: LiveSession): SessionRecord {
  const endedAt = live.endedAt ?? Date.now();
  const handoff = live.handoff?.acceptedAt ? live.handoff : undefined;
  return {
    id: live.id,
    agentId: live.agentId,
    customerName: live.customerName,
    language: live.language,
    startedAt: new Date(live.startedAt).toISOString(),
    durationSec: Math.max(1, Math.floor((endedAt - live.startedAt) / 1000)),
    status: handoff ? "transferred" : "completed",
    outcome: "resolved",
    sentiment: "positive",
    intent: "Duplicate charge",
    handledBy: handoff ? "hybrid" : "ai",
    transferReason: handoff?.reason,
    csat: handoff ? 4.8 : 4.7,
    turnCount: live.transcript.length,
    summary: live.summary ?? buildLiveSummary(live),
    transcript: live.transcript,
    handoffs: live.handoff ? [live.handoff] : undefined,
  };
}

export function fallbackTranscript(session: SessionRecord): Turn[] {
  const lang = session.language;
  const open =
    lang === "ur"
      ? "Niyamic-Voice-AI-Agent support se baat kar rahi hoon, main Ayesha. Kaise madad kar sakti hoon?"
      : lang === "hi"
        ? "Niyamic-Voice-AI-Agent support, main Ayesha. Main aap ki kaise madad kar sakti hoon?"
        : "Thanks for calling Niyamic-Voice-AI-Agent support. This is Ayesha. How can I help you today?";

  const turns: Turn[] = [
    { id: `${session.id}_t1`, role: "ai", text: open, at: 0, confidence: 0.96 },
    {
      id: `${session.id}_t2`,
      role: "customer",
      text: `I'm calling about ${session.intent.toLowerCase()}.`,
      at: 8,
      language: lang,
    },
    {
      id: `${session.id}_t3`,
      role: "ai",
      text:
        session.status === "abandoned"
          ? "I understand. Let me check what I can do. I'm not fully sure I have the right answer here, so I can bring in a specialist."
          : "Let me pull that up and verify the details before I suggest anything.",
      at: 16,
      confidence: session.status === "abandoned" ? 0.52 : 0.84,
    },
    {
      id: `${session.id}_t4`,
      role: "customer",
      text:
        session.status === "abandoned"
          ? "I don't have time for this."
          : "Okay, thank you. That would help.",
      at: 26,
    },
  ];

  if (session.status === "transferred") {
    turns.push(
      {
        id: `${session.id}_t5`,
        role: "ai",
        text: "I can see what's happening. This needs a specialist to approve, so I'll bring in a colleague with the full context.",
        at: 38,
        confidence: 0.58,
      },
      {
        id: `${session.id}_t6`,
        role: "system",
        text: "Sara Malik joined the call",
        at: 46,
      },
      {
        id: `${session.id}_t7`,
        role: "human",
        text: "Hi, I'm Sara. I have the full context. Let me take it from here and get this resolved for you.",
        at: 52,
      },
      {
        id: `${session.id}_t8`,
        role: "customer",
        text: "That's a relief. Thank you.",
        at: 64,
      },
      {
        id: `${session.id}_t9`,
        role: "ai",
        text: "Sara has taken care of it. Is there anything else I can help with?",
        at: 76,
        confidence: 0.94,
      },
    );
  } else if (session.status === "abandoned") {
    turns.push({
      id: `${session.id}_t5`,
      role: "system",
      text: "Customer disconnected",
      at: Math.max(20, session.durationSec),
    });
  } else {
    turns.push(
      {
        id: `${session.id}_t5`,
        role: "ai",
        text: "I've verified the details and made the change. You'll receive a confirmation shortly.",
        at: 34,
        confidence: 0.93,
      },
      {
        id: `${session.id}_t6`,
        role: "customer",
        text: "Perfect, thank you.",
        at: 44,
      },
      {
        id: `${session.id}_t7`,
        role: "ai",
        text: "Thanks for calling Niyamic-Voice-AI-Agent. Have a great day.",
        at: 50,
        confidence: 0.98,
      },
    );
  }

  return turns;
}

export function fallbackSummary(session: SessionRecord): SessionSummary {
  const isAbandoned = session.status === "abandoned";
  const isTransferred = session.status === "transferred";
  return {
    headline: isAbandoned
      ? `${session.intent} ended without a resolution.`
      : isTransferred
        ? `${session.intent} resolved with specialist support.`
        : `${session.intent} resolved by AI.`,
    intent: session.intent,
    outcome: isAbandoned
      ? "Unresolved"
      : isTransferred
        ? "Resolved after transfer"
        : "Resolved by AI",
    sentiment: session.sentiment,
    resolution: isAbandoned
      ? "Customer disconnected · follow-up recommended"
      : isTransferred
        ? `Resolved by ${session.transferReason ?? "human specialist"}`
        : "Resolved by AI",
    bullets: isAbandoned
      ? [
          "AI recognized the request but confidence fell below the escalation threshold.",
          "No callback was offered before the customer disconnected.",
          "This session is a candidate for a policy or knowledge improvement.",
        ]
      : isTransferred
        ? [
            `AI handled discovery and verified the customer's ${session.intent.toLowerCase()} request.`,
            `Escalated because of ${session.transferReason?.toLowerCase() ?? "a policy exception"}.`,
            "The specialist joined with full transcript and customer context.",
            "Resolution confirmed and the call closed cleanly.",
          ]
        : [
            `AI identified the customer's ${session.intent.toLowerCase()} request.`,
            "Verified the relevant account details with a tool call.",
            "Resolved without escalation and confirmed next steps.",
          ],
    keyMoments: [
      { at: 8, label: `Intent detected: ${session.intent}`, type: "intent" },
      ...(isTransferred
        ? [
            { at: 38, label: "Confidence dropped below threshold", type: "risk" as const },
            { at: 46, label: "Human specialist joined", type: "handoff" as const },
          ]
        : []),
      {
        at: Math.max(30, session.durationSec - 12),
        label: isAbandoned ? "Customer disconnected" : "Call resolved",
        type: isAbandoned ? ("risk" as const) : ("resolution" as const),
      },
    ],
    recommendation: isAbandoned
      ? "Add an automatic callback offer when confidence drops below 0.55. This abandonment was preventable."
      : isTransferred
        ? "Extend AI authority for this policy path. The escalation was driven by a rule, not a capability gap."
        : "Keep this path. The AI resolved the request without human involvement and maintained a positive tone.",
  };
}

export function getSessionContent(id: string) {
  const seed = getSeedSession(id);
  if (!seed) return null;
  return {
    session: seed,
    transcript: seed.transcript ?? fallbackTranscript(seed),
    summary: seed.summary ?? fallbackSummary(seed),
  };
}

export function statusLabel(session: SessionRecord) {
  if (session.status === "abandoned") return "Abandoned";
  if (session.status === "transferred") return "Transferred";
  return "Resolved";
}

export function statusTone(session: SessionRecord) {
  if (session.status === "abandoned") return "red" as const;
  if (session.status === "transferred") return "amber" as const;
  return "green" as const;
}

export function agentLabel(agentId: string, agents: Agent[]) {
  return agents.find((agent) => agent.id === agentId)?.name ?? agentName(agentId);
}
