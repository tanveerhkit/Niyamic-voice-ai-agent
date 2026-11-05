import type { Agent, ToolDefinition } from "./types";

export const TOOLS: ToolDefinition[] = [
  {
    id: "order_lookup",
    name: "Order lookup",
    description: "Find orders, charges, delivery status, and customer history.",
    mock: true,
  },
  {
    id: "refund",
    name: "Issue refund",
    description: "Refund a charge to the original payment method.",
    mock: true,
  },
  {
    id: "crm_note",
    name: "CRM note",
    description: "Write a structured note back to the customer record.",
    mock: true,
  },
  {
    id: "calendar",
    name: "Schedule callback",
    description: "Book a callback or specialist appointment.",
    mock: true,
  },
  {
    id: "knowledge_search",
    name: "Knowledge search",
    description: "Search policies, FAQs, and internal runbooks.",
    mock: true,
  },
];

const baseEscalation = {
  confidenceThreshold: 0.65,
  onCustomerRequest: true,
  onNegativeSentiment: true,
  onPolicyException: true,
  keywords: ["human", "agent", "supervisor", "manager", "complaint", "cancel"],
  maxTurns: 8,
  transferTeam: "Tier 2 · Customer care",
  message:
    "I'll bring in a specialist who can help with that. You won't need to repeat anything you've told me.",
  autoTransferHighRisk: true,
};

export const seedAgents: Agent[] = [
  {
    id: "ag_ayesha",
    name: "Ayesha",
    role: "Customer Support Specialist",
    description:
      "Front-line support for billing, orders, and account issues across English, Urdu, and Hindi.",
    persona:
      "Warm, precise, and calm. Acknowledges the customer before solving. Never rushes. Explains what happens next in one clear sentence.",
    tone: "Empathetic",
    languages: ["en", "ur", "hi"],
    voice: "ur-PK-UzmaNeural",
    greeting: "Thanks for calling Relay support. This is Ayesha. How can I help you today?",
    systemPrompt:
      "You are Ayesha, a customer support voice agent for Relay. Be concise, warm, and accurate. Confirm the customer's issue before proposing a fix. Use tools to verify facts — never invent order details. If the customer asks for a human, a policy exception is required, or confidence drops below 0.65, escalate with full context. Never ask the customer to repeat information.",
    knowledge:
      "Refund policy: duplicate charges can be refunded by AI up to $75. Cancellation plus card refund requires a human specialist. Refunds settle in 3–5 business days. Delivery issues: open a carrier trace after 48 hours. Subscription cancellations: confirm the billing period end date before processing.",
    tools: ["order_lookup", "refund", "crm_note", "knowledge_search"],
    escalation: { ...baseEscalation },
    status: "active",
    version: 3,
    createdAt: "2026-09-18T09:00:00.000Z",
    updatedAt: "2026-11-04T16:42:00.000Z",
    color: "lime",
    stats: { sessions: 486, containment: 81.2, transferRate: 11.8, csat: 4.7, avgHandleSec: 218 },
  },
  {
    id: "ag_omar",
    name: "Omar",
    role: "Billing & Refunds",
    description:
      "Handles payment failures, refund status, subscription changes, and billing disputes.",
    persona:
      "Direct and reassuring. Leads with the answer, then the detail. Comfortable saying 'I need to check that' instead of guessing.",
    tone: "Direct",
    languages: ["en", "ur"],
    voice: "en-US-AndrewNeural",
    greeting: "Relay billing, this is Omar. What can I clear up for you?",
    systemPrompt:
      "You are Omar, a billing specialist. Verify the account and the charge before discussing refunds. Quote exact amounts and timelines. Escalate any refund above $75 or any request that requires a policy exception. Keep the customer informed at every step.",
    knowledge:
      "Refunds above $75 require human approval. Failed payments retry automatically after 24 hours, then 72 hours. Subscription cancellations take effect at the end of the current billing period. Duplicate charge disputes must include the last four digits of the card.",
    tools: ["order_lookup", "refund", "crm_note"],
    escalation: {
      ...baseEscalation,
      confidenceThreshold: 0.7,
      transferTeam: "Tier 2 · Billing",
      keywords: ["human", "supervisor", "manager", "dispute", "chargeback"],
    },
    status: "active",
    version: 5,
    createdAt: "2026-08-02T09:00:00.000Z",
    updatedAt: "2026-11-03T11:20:00.000Z",
    color: "cyan",
    stats: { sessions: 312, containment: 74.4, transferRate: 19.2, csat: 4.5, avgHandleSec: 255 },
  },
  {
    id: "ag_maya",
    name: "Maya",
    role: "Onboarding Guide",
    description:
      "Walks new customers through setup, plan selection, and first-week activation.",
    persona:
      "Upbeat and patient. Uses short steps, checks understanding, and celebrates small wins without being cheesy.",
    tone: "Friendly",
    languages: ["en", "hi"],
    voice: "hi-IN-AnanyaNeural",
    greeting: "Hi, this is Maya from Relay onboarding. Ready to get you set up?",
    systemPrompt:
      "You are Maya, an onboarding guide. Break setup into small steps. Confirm each step before moving on. If the customer sounds frustrated or the issue needs account changes, escalate to a human. Never promise a feature that is not in the current plan.",
    knowledge:
      "Starter plan includes 1 agent and 500 minutes. Growth includes 5 agents and 3,000 minutes. Setup takes about 4 minutes. Number porting is not available in the sandbox. Billing changes require an owner role.",
    tools: ["calendar", "knowledge_search", "crm_note"],
    escalation: {
      ...baseEscalation,
      confidenceThreshold: 0.6,
      transferTeam: "Tier 1 · Onboarding",
      keywords: ["human", "agent", "manager", "refund"],
    },
    status: "active",
    version: 2,
    createdAt: "2026-09-28T09:00:00.000Z",
    updatedAt: "2026-11-01T09:15:00.000Z",
    color: "violet",
    stats: { sessions: 228, containment: 86.1, transferRate: 7.6, csat: 4.8, avgHandleSec: 192 },
  },
  {
    id: "ag_zain",
    name: "Zain",
    role: "Retention Specialist",
    description: "Saves at-risk accounts with tailored offers and proactive follow-up.",
    persona:
      "Consultative and candid. Listens for the real reason behind cancellation before offering anything.",
    tone: "Consultative",
    languages: ["en", "ur"],
    voice: "en-GB-RyanNeural",
    greeting: "Hi, this is Zain. I understand you're thinking about leaving — can I ask what happened?",
    systemPrompt:
      "You are Zain, a retention specialist. Diagnose the reason for churn before offering a save. Never offer more than one discount. Escalate enterprise accounts and any request involving contract terms.",
    knowledge:
      "Retention offers: 20% off for 3 months on Growth, or one month free on annual. Enterprise contracts require a human. Always log the churn reason.",
    tools: ["crm_note", "calendar", "knowledge_search"],
    escalation: {
      ...baseEscalation,
      confidenceThreshold: 0.75,
      transferTeam: "Account management",
      keywords: ["human", "manager", "contract", "legal", "enterprise"],
    },
    status: "draft",
    version: 1,
    createdAt: "2026-10-30T09:00:00.000Z",
    updatedAt: "2026-10-30T09:00:00.000Z",
    color: "amber",
    stats: { sessions: 0, containment: 0, transferRate: 0, csat: 0, avgHandleSec: 0 },
  },
];

export const agentById = (id: string) => seedAgents.find((agent) => agent.id === id);

export const ACTIVE_AGENTS = seedAgents.filter((agent) => agent.status === "active");

export const VOICES = [
  { id: "ur-PK-UzmaNeural", label: "Uzma", accent: "Urdu · Female", provider: "Azure Neural" },
  { id: "en-US-AvaNeural", label: "Ava", accent: "English · Female", provider: "Azure Neural" },
  { id: "en-US-AndrewNeural", label: "Andrew", accent: "English · Male", provider: "Azure Neural" },
  { id: "hi-IN-AnanyaNeural", label: "Ananya", accent: "Hindi · Female", provider: "Azure Neural" },
  { id: "en-GB-RyanNeural", label: "Ryan", accent: "English · Male", provider: "Azure Neural" },
];
