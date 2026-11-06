import type {
  Agent,
  Handoff,
  Language,
  Sentiment,
  SessionRecord,
  SessionSummary,
  Speaker,
  Turn,
} from "./types";

export const DEMO_NOW_MS = Date.parse("2026-11-05T16:20:00.000Z");
export const DEMO_NOW = new Date(DEMO_NOW_MS);

const iso = (ms: number) => new Date(ms).toISOString();
const hoursAgo = (h: number) => DEMO_NOW_MS - h * 3_600_000;

let turnSeq = 0;
const turn = (
  role: Speaker,
  text: string,
  at: number,
  extra: Partial<Turn> = {},
): Turn => ({
  id: `t_${++turnSeq}`,
  role,
  text,
  at,
  ...extra,
});

const detail = (
  id: string,
  agentId: string,
  customerName: string,
  language: Language,
  startedAt: number,
  durationSec: number,
  status: SessionRecord["status"],
  outcome: SessionRecord["outcome"],
  sentiment: Sentiment,
  intent: string,
  handledBy: SessionRecord["handledBy"],
  csat: number,
  transcript: Turn[],
  summary: SessionSummary,
  transferReason?: string,
  handoffs?: Handoff[],
): SessionRecord => ({
  id,
  agentId,
  customerName,
  language,
  startedAt: iso(startedAt),
  durationSec,
  status,
  outcome,
  sentiment,
  intent,
  handledBy,
  transferReason,
  csat,
  turnCount: transcript.length,
  transcript,
  summary,
  handoffs,
});

const start2481 = hoursAgo(2.2);

const transcript2481: Turn[] = [
  turn("ai", "Thanks for calling Niyamic Echo support. This is Ayesha. How can I help you today?", 0, { confidence: 0.98 }),
  turn("customer", "Hi, I was charged twice for the same order this month.", 8, { language: "en" }),
  turn("ai", "I'm sorry about that — duplicate charges are frustrating. I can look into it. Could you share your order number?", 15, { confidence: 0.96 }),
  turn("customer", "It's 4821. I've already called twice about this.", 24),
  turn("ai", "I can see order 4821: two charges of $49.00 on November 3rd. One looks like a duplicate. I can start a refund for that.", 33, { confidence: 0.91 }),
  turn("customer", "I want the whole order cancelled, and the refund back to my card.", 45),
  turn("ai", "I understand. Cancelling the order and refunding to your card needs a specialist. I'll bring in a colleague now — you won't need to repeat any of this.", 54, { confidence: 0.58 }),
  turn("system", "Sara Malik joined the call", 63),
  turn("human", "Hi Zara, I'm Sara. I have the full context — duplicate charge on order 4821. I can cancel the order and process the refund to your card today.", 69),
  turn("customer", "Thank you. How long will it take?", 84),
  turn("human", "Three to five business days. I'll email the confirmation as soon as it's done.", 92),
  turn("customer", "Perfect, thank you.", 103),
  turn("ai", "You're all set, Zara. Sara has processed the cancellation and refund. Is there anything else I can help with?", 112, { confidence: 0.94 }),
  turn("customer", "No, that's all. Thanks.", 124),
  turn("ai", "Thanks for calling Niyamic Echo. Have a great day.", 130, { confidence: 0.99 }),
];

const summary2481: SessionSummary = {
  headline: "Duplicate charge resolved with a warm, context-rich handoff.",
  intent: "Duplicate charge · order 4821",
  outcome: "Refund initiated",
  sentiment: "positive",
  resolution: "Resolved by human · AI closed the call",
  bullets: [
    "AI verified order 4821 and identified a $49.00 duplicate charge in 33 seconds.",
    "Escalated at 0.58 confidence because cancellation plus card refund is a policy exception.",
    "Sara joined with the full transcript; the customer did not repeat any details.",
    "Refund issued for $49.00; control returned to AI for confirmation and close.",
  ],
  keyMoments: [
    { at: 8, label: "Intent detected: duplicate charge", type: "intent" },
    { at: 33, label: "Order lookup · 4821", type: "tool" },
    { at: 54, label: "Confidence dropped to 0.58", type: "risk" },
    { at: 63, label: "Sara Malik joined the call", type: "handoff" },
    { at: 130, label: "Resolved · refund initiated", type: "resolution" },
  ],
  recommendation:
    "Let the AI issue duplicate-charge refunds up to $100 when the order is verified. This would have contained the call without a handoff.",
};

const start2479 = hoursAgo(5.4);
const transcript2479: Turn[] = [
  turn("ai", "Niyamic Echo billing, this is Omar. What can I clear up for you?", 0, { confidence: 0.97 }),
  turn("customer", "Mera refund abhi tak nahi aaya. Teen din ho gaye hain.", 7, { language: "hi" }),
  turn("ai", "Main samajh sakta hoon — teen din wait karna frustrating hai. Aap ka order number bata dijiye, main status check karta hoon.", 14, { confidence: 0.94, language: "hi" }),
  turn("customer", "Order 5520.", 23),
  turn("ai", "I can see the refund was initiated on November 1st, but it is stuck in review because the amount is above the AI approval limit.", 31, { confidence: 0.72 }),
  turn("customer", "So what happens now?", 41),
  turn("ai", "I can't release it myself — it needs a billing specialist. I'll transfer you now with the full history.", 48, { confidence: 0.41 }),
  turn("system", "Sara Malik joined the call", 57),
  turn("human", "Hi Rohan, I've reviewed the refund. I'm releasing it today; it will land in three to five business days.", 63),
  turn("customer", "Okay, thank you.", 74),
  turn("human", "I've also added a note so you don't have to explain this again.", 81),
  turn("ai", "You're all set. Is there anything else I can help with?", 90, { confidence: 0.95 }),
  turn("customer", "No, that's it.", 98),
  turn("ai", "Thanks for calling Niyamic Echo.", 103),
];

const summary2479: SessionSummary = {
  headline: "Refund stuck above the AI approval limit — escalated and released.",
  intent: "Refund status · order 5520",
  outcome: "Refund released",
  sentiment: "neutral",
  resolution: "Resolved by human specialist",
  bullets: [
    "Detected Hindi and continued the call in the customer's language.",
    "Found the refund in review in 31 seconds; amount exceeded the AI approval limit.",
    "Handoff included the order, refund status, and approval context.",
    "Specialist released the refund and logged a CRM note.",
  ],
  keyMoments: [
    { at: 7, label: "Language detected: Hindi", type: "intent" },
    { at: 31, label: "Refund lookup · in review", type: "tool" },
    { at: 48, label: "Policy exception detected", type: "risk" },
    { at: 57, label: "Human specialist joined", type: "handoff" },
    { at: 103, label: "Refund released · case closed", type: "resolution" },
  ],
  recommendation:
    "Add a 'refund stuck in review' tool that lets the AI see the review owner and expected release date. That alone would cut this escalation path in half.",
};

const start2474 = DEMO_NOW_MS - 26 * 3_600_000;
const transcript2474: Turn[] = [
  turn("ai", "Niyamic Echo support se baat kar rahi hoon, main Ayesha. Kaise madad kar sakti hoon?", 0, { confidence: 0.96, language: "ur" }),
  turn("customer", "Mera order 4412 teen din se deliver nahi hua.", 8, { language: "ur" }),
  turn("ai", "Main dekh rahi hoon... Order 4412 ka carrier scan do din se update nahi hua. Main trace open kar rahi hoon aur aap ko SMS par update bhej doongi.", 17, { confidence: 0.89, language: "ur" }),
  turn("customer", "Theek hai, shukriya.", 29, { language: "ur" }),
  turn("ai", "Aap ka order kal tak deliver ho jana chahiye. Agar nahi hua to main replacement arrange kar doongi. Kuch aur?", 36, { confidence: 0.93, language: "ur" }),
  turn("customer", "Nahi, bas.", 47, { language: "ur" }),
  turn("ai", "Shukriya. Niyamic Echo ko call karne ka shukriya.", 52, { confidence: 0.98, language: "ur" }),
];

const summary2474: SessionSummary = {
  headline: "Delivery delay handled end-to-end in Urdu.",
  intent: "Order not delivered · order 4412",
  outcome: "Carrier trace opened",
  sentiment: "positive",
  resolution: "Resolved by AI",
  bullets: [
    "Detected Urdu at the start of the call and stayed in language throughout.",
    "Found no carrier scan for 48 hours and opened a trace automatically.",
    "Set an SMS follow-up and offered a replacement if delivery slips again.",
    "Contained without human involvement in 52 seconds.",
  ],
  keyMoments: [
    { at: 8, label: "Language detected: Urdu", type: "intent" },
    { at: 17, label: "Carrier trace opened", type: "tool" },
    { at: 52, label: "Resolved · follow-up scheduled", type: "resolution" },
  ],
  recommendation: "This is the containment pattern to replicate. Add the same trace flow to Hindi delivery calls.",
};

const start2468 = DEMO_NOW_MS - 37 * 3_600_000;
const transcript2468: Turn[] = [
  turn("ai", "Hi, this is Maya from Niyamic Echo onboarding. Ready to get you set up?", 0, { confidence: 0.97 }),
  turn("customer", "Yes — I need to add my second agent and connect a phone number.", 7),
  turn("ai", "Great. I can see your workspace is on Growth, so the second agent is included. I'll walk you through it. First, open Settings → Agents.", 15, { confidence: 0.92 }),
  turn("customer", "Done.", 25),
  turn("ai", "Now choose 'Create agent', pick a template, and name it. I'll wait.", 29, { confidence: 0.95 }),
  turn("customer", "Okay, it's created.", 41),
  turn("ai", "Nice. The last step is number assignment, which needs an owner role. I'll send your admin a one-click link.", 47, { confidence: 0.88 }),
  turn("customer", "Perfect.", 56),
  turn("ai", "You're set. I'll check in tomorrow to make sure the first calls look good.", 60, { confidence: 0.96 }),
];

const summary2468: SessionSummary = {
  headline: "Onboarding completed with one admin follow-up.",
  intent: "Onboarding · second agent setup",
  outcome: "Setup complete",
  sentiment: "positive",
  resolution: "Resolved by AI · admin follow-up sent",
  bullets: [
    "Guided the customer through creating a second agent.",
    "Recognized number assignment required an owner role and sent a one-click link.",
    "Scheduled a next-day check-in automatically.",
    "Contained with a 4.7 CSAT.",
  ],
  keyMoments: [
    { at: 15, label: "Guided setup · step 1", type: "intent" },
    { at: 47, label: "Owner-role check detected", type: "risk" },
    { at: 60, label: "Setup complete", type: "resolution" },
  ],
  recommendation: "Turn the owner-role handoff link into a reusable tool. It recurs in 18% of onboarding calls.",
};

const start2461 = DEMO_NOW_MS - 51 * 3_600_000;
const transcript2461: Turn[] = [
  turn("ai", "Niyamic Echo billing, this is Omar. What can I clear up for you?", 0, { confidence: 0.95 }),
  turn("customer", "I want to cancel my subscription. This is the third time I've had to call.", 6, { language: "ur" }),
  turn("ai", "I'm sorry you've had to call three times. I can help with the cancellation. Before I do, can I ask what went wrong?", 14, { confidence: 0.71, language: "ur" }),
  turn("customer", "The invoices are always wrong. I'm done.", 24, { language: "ur" }),
  turn("ai", "That's a fair reason to be frustrated. Cancellation is straightforward, but I want to make sure your final invoice is corrected too. That needs a specialist.", 32, { confidence: 0.55 }),
  turn("system", "Sara Malik joined the call", 42),
  turn("human", "Hi Sana, I'm Sara. I can see the last three invoices and the correction history. Let's fix the final invoice and cancel the plan today.", 48),
  turn("customer", "Fine. I want it in writing.", 60),
  turn("human", "Absolutely. I'll send the cancellation confirmation and the corrected invoice before we hang up.", 66),
  turn("ai", "Sara has sent both documents. Is there anything else I can help with?", 78, { confidence: 0.91 }),
  turn("customer", "No.", 86),
  turn("ai", "Thanks for calling Niyamic Echo.", 89),
];

const summary2461: SessionSummary = {
  headline: "Cancellation saved into a correction and a clean exit.",
  intent: "Cancel subscription · invoice dispute",
  outcome: "Plan cancelled · invoice corrected",
  sentiment: "negative",
  resolution: "Resolved by human · documents sent",
  bullets: [
    "Detected frustration in the first 10 seconds and lowered confidence.",
    "Recognized the invoice dispute required the billing specialist.",
    "Human corrected the final invoice and sent cancellation confirmation in writing.",
    "Handoff reason: negative sentiment plus policy exception.",
  ],
  keyMoments: [
    { at: 6, label: "Escalation trigger: third call", type: "risk" },
    { at: 32, label: "Invoice dispute detected", type: "intent" },
    { at: 42, label: "Human specialist joined", type: "handoff" },
    { at: 89, label: "Cancelled with written confirmation", type: "resolution" },
  ],
  recommendation:
    "Surface repeat-contact count before the greeting. If Ayesha had known this was call three, she could have opened with an apology and skipped discovery.",
};

const start2455 = DEMO_NOW_MS - 70 * 3_600_000;
const transcript2455: Turn[] = [
  turn("ai", "Thanks for calling Niyamic Echo support. This is Ayesha. How can I help?", 0, { confidence: 0.95 }),
  turn("customer", "My card keeps failing on checkout. I've tried three times.", 7, { language: "hi" }),
  turn("ai", "I'm sorry — let's get that payment through. I can see two declined attempts on your account. The bank is returning a generic decline code.", 16, { confidence: 0.68 }),
  turn("customer", "So it's your system then?", 26),
  turn("ai", "It could be the bank or the card details. I can retry with a different method, or connect you to billing. Which would you prefer?", 33, { confidence: 0.52 }),
  turn("customer", "I don't have time for this.", 43),
  turn("system", "Customer disconnected", 47),
];

const summary2455: SessionSummary = {
  headline: "Payment failure ended in abandonment before a resolution.",
  intent: "Payment failed · checkout",
  outcome: "Abandoned",
  sentiment: "negative",
  resolution: "Unresolved · customer disconnected",
  bullets: [
    "Two declined attempts detected; bank returned a generic decline code.",
    "AI offered a retry or a billing transfer, but the customer disengaged.",
    "No callback was offered before the disconnect.",
    "This is the highest-priority gap in the current escalation policy.",
  ],
  keyMoments: [
    { at: 7, label: "Intent detected: payment failure", type: "intent" },
    { at: 16, label: "Decline code lookup", type: "tool" },
    { at: 33, label: "Confidence dropped to 0.52", type: "risk" },
    { at: 47, label: "Customer disconnected", type: "handoff" },
  ],
  recommendation:
    "When confidence drops below 0.55 on a payment call, offer a callback before asking the customer to choose. This abandonment was preventable.",
};

export const detailedSessions: SessionRecord[] = [
  detail(
    "SES-2481",
    "ag_ayesha",
    "Zara Ahmed",
    "en",
    start2481,
    284,
    "transferred",
    "resolved",
    "positive",
    "Duplicate charge",
    "hybrid",
    4.8,
    transcript2481,
    summary2481,
    "Policy exception · cancellation + card refund",
    [
      {
        status: "completed",
        reason: "Policy exception · cancellation + card refund",
        requestedAt: start2481 + 54_000,
        acceptedAt: start2481 + 63_000,
        completedAt: start2481 + 112_000,
        supervisor: "Sara Malik",
        note: "AI confidence 0.58. Customer requested a human. Full transcript shared before join.",
      },
    ],
  ),
  detail(
    "SES-2479",
    "ag_omar",
    "Rohan Mehta",
    "hi",
    start2479,
    412,
    "transferred",
    "escalated",
    "neutral",
    "Refund status",
    "hybrid",
    4.1,
    transcript2479,
    summary2479,
    "Policy exception · refund above AI limit",
    [
      {
        status: "completed",
        reason: "Policy exception · refund above AI limit",
        requestedAt: start2479 + 48_000,
        acceptedAt: start2479 + 57_000,
        completedAt: start2479 + 90_000,
        supervisor: "Sara Malik",
        note: "Refund amount exceeded the $75 AI approval threshold.",
      },
    ],
  ),
  detail(
    "SES-2474",
    "ag_ayesha",
    "Fatima Noor",
    "ur",
    start2474,
    198,
    "completed",
    "resolved",
    "positive",
    "Order not delivered",
    "ai",
    4.9,
    transcript2474,
    summary2474,
  ),
  detail(
    "SES-2468",
    "ag_maya",
    "Arjun Kapoor",
    "en",
    start2468,
    221,
    "completed",
    "resolved",
    "positive",
    "Onboarding",
    "ai",
    4.7,
    transcript2468,
    summary2468,
  ),
  detail(
    "SES-2461",
    "ag_omar",
    "Sana Khan",
    "ur",
    start2461,
    356,
    "transferred",
    "resolved",
    "negative",
    "Cancel subscription",
    "hybrid",
    3.8,
    transcript2461,
    summary2461,
    "Negative sentiment · invoice dispute",
    [
      {
        status: "completed",
        reason: "Negative sentiment · invoice dispute",
        requestedAt: start2461 + 32_000,
        acceptedAt: start2461 + 42_000,
        completedAt: start2461 + 78_000,
        supervisor: "Sara Malik",
        note: "Repeat contact plus negative sentiment triggered escalation.",
      },
    ],
  ),
  detail(
    "SES-2455",
    "ag_ayesha",
    "Vikram Singh",
    "hi",
    start2455,
    47,
    "abandoned",
    "unresolved",
    "negative",
    "Payment failed",
    "ai",
    2.4,
    transcript2455,
    summary2455,
  ),
];

/* ------------------------------------------------------------------ */
/* Generated history — deterministic so server and client agree.      */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weighted<T>(pairs: Array<[T, number]>, r: number): T {
  const total = pairs.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = r * total;
  for (const [value, weight] of pairs) {
    cursor -= weight;
    if (cursor <= 0) return value;
  }
  return pairs[pairs.length - 1][0];
}

const CUSTOMERS = [
  "Aarav Sharma", "Meera Patel", "Hassan Raza", "Sana Iqbal", "Priya Nair",
  "Daniyal Khan", "Aisha Siddiqui", "Rahul Verma", "Noor Fatima", "Kabir Malhotra",
  "Zoya Sheikh", "Aditya Rao", "Ibrahim Qureshi", "Ananya Iyer", "Bilal Ahmed",
  "Sneha Kulkarni", "Usman Tariq", "Neha Gupta", "Farhan Ali", "Riya Desai",
  "Hamza Malik", "Kavya Menon", "Imran Shah", "Pooja Reddy", "Tariq Jameel",
  "Ishita Bose", "Salman Yousuf", "Nikhil Joshi", "Mahnoor Ali", "Devika Nair",
];

const INTENTS: Array<[string, number]> = [
  ["Duplicate charge", 22],
  ["Refund status", 16],
  ["Order not delivered", 14],
  ["Cancel subscription", 11],
  ["Payment failed", 10],
  ["Onboarding", 9],
  ["Plan upgrade", 7],
  ["Technical issue", 6],
  ["Address change", 5],
];

const TRANSFER_REASONS: Array<[string, number]> = [
  ["Policy exception", 34],
  ["Customer request", 28],
  ["Low confidence", 19],
  ["Negative sentiment", 12],
  ["Tool failure", 7],
];

const FIRST_NAME = (name: string) => name.split(" ")[0];

function generateSessions(count: number): SessionRecord[] {
  const random = mulberry32(20261105);
  const records: SessionRecord[] = [];

  for (let i = 0; i < count; i++) {
    const language = weighted<Language>(
      [
        ["en", 62],
        ["hi", 23],
        ["ur", 15],
      ],
      random(),
    );

    const agentId = weighted<string>(
      language === "hi"
        ? [
            ["ag_ayesha", 65],
            ["ag_maya", 35],
          ]
        : language === "ur"
          ? [
              ["ag_ayesha", 55],
              ["ag_omar", 45],
            ]
          : [
              ["ag_ayesha", 40],
              ["ag_omar", 30],
              ["ag_maya", 30],
            ],
      random(),
    );

    const handleRoll = random();
    const handleKind = handleRoll < 0.784 ? "ai" : handleRoll < 0.926 ? "hybrid" : "abandoned";

    const intent = weighted(INTENTS, random());
    const dayOffset = Math.floor(random() * 30);
    const secondOffset = Math.floor(random() * 86_400);
    const startedMs = DEMO_NOW_MS - dayOffset * 86_400_000 - secondOffset;

    const sentiment: Sentiment =
      handleKind === "abandoned"
        ? weighted<Sentiment>([["negative", 55], ["neutral", 35], ["positive", 10]], random())
        : handleKind === "hybrid"
          ? weighted<Sentiment>([["negative", 22], ["neutral", 50], ["positive", 28]], random())
          : weighted<Sentiment>([["negative", 8], ["neutral", 30], ["positive", 62]], random());

    const durationSec =
      handleKind === "abandoned"
        ? 30 + Math.floor(random() * 150)
        : handleKind === "hybrid"
          ? 240 + Math.floor(random() * 380)
          : 90 + Math.floor(random() * 240);

    const csat =
      handleKind === "abandoned"
        ? random() < 0.45
          ? Math.round((2 + random() * 1.4) * 10) / 10
          : undefined
        : handleKind === "hybrid"
          ? Math.round((3.6 + random() * 1.2) * 10) / 10
          : Math.round((4.2 + random() * 0.8) * 10) / 10;

    const transferReason =
      handleKind === "hybrid" ? weighted(TRANSFER_REASONS, random()) : undefined;

    records.push({
      id: `SES-${3200 + i}`,
      agentId,
      customerName: CUSTOMERS[Math.floor(random() * CUSTOMERS.length)],
      language,
      startedAt: iso(startedMs),
      durationSec,
      status:
        handleKind === "abandoned"
          ? "abandoned"
          : handleKind === "hybrid"
            ? "transferred"
            : "completed",
      outcome:
        handleKind === "abandoned"
          ? "unresolved"
          : handleKind === "hybrid"
            ? "escalated"
            : "resolved",
      sentiment,
      intent,
      handledBy: handleKind === "hybrid" ? "hybrid" : "ai",
      transferReason,
      csat,
      turnCount: 8 + Math.floor(random() * 16),
    });
  }

  return records;
}

export const seedSessions: SessionRecord[] = [...detailedSessions, ...generateSessions(1278)].sort(
  (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
);

export const seedSessionById = new Map(seedSessions.map((session) => [session.id, session]));

export const getSeedSession = (id: string) => seedSessionById.get(id) ?? null;

export function getAgentForSession(agentId: string, agents: Agent[]) {
  return agents.find((agent) => agent.id === agentId);
}

export const agentName = (agentId: string) => {
  const names: Record<string, string> = {
    ag_ayesha: "Ayesha",
    ag_omar: "Omar",
    ag_maya: "Maya",
    ag_zain: "Zain",
  };
  return names[agentId] ?? "Agent";
};

export const firstName = FIRST_NAME;

export const demoLiveSessions = [
  {
    id: "SES-LIVE-7F2",
    agentId: "ag_ayesha",
    customerName: "Imran S.",
    language: "ur" as Language,
    elapsedSec: 142,
    risk: "medium" as const,
    state: "AI active",
  },
  {
    id: "SES-LIVE-9C1",
    agentId: "ag_omar",
    customerName: "Kavya M.",
    language: "hi" as Language,
    elapsedSec: 88,
    risk: "low" as const,
    state: "AI active",
  },
  {
    id: "SES-LIVE-3A8",
    agentId: "ag_maya",
    customerName: "Noah R.",
    language: "en" as Language,
    elapsedSec: 316,
    risk: "high" as const,
    state: "Transferring",
  },
];

export const demoNowLabel = new Date(DEMO_NOW_MS).toLocaleDateString("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});
