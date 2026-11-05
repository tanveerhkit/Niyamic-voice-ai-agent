import type { Language, RiskLevel, ToolId } from "./types";

export type ScriptEvent =
  | {
      type: "ai";
      text: string;
      confidence?: number;
      language?: Language;
      risk?: RiskLevel;
      reasoning?: string;
    }
  | { type: "customer"; text: string; language?: Language }
  | { type: "tool"; tool: ToolId; label: string; result: string }
  | { type: "handoff"; reason: string };

export const CALL_SCRIPT: ScriptEvent[] = [
  {
    type: "ai",
    text: "Thanks for calling Niyamic-Voice-AI-Agent support. This is Ayesha. How can I help you today?",
    confidence: 0.97,
    reasoning: "Greeting · language set to English",
  },
  {
    type: "customer",
    text: "Hi, I was charged twice for the same order this month.",
    language: "en",
  },
  {
    type: "ai",
    text: "I'm sorry about that — duplicate charges are frustrating. I can look into it. Could you share your order number?",
    confidence: 0.95,
    reasoning: "Empathy · requesting order ID",
  },
  {
    type: "customer",
    text: "It's 4821. Do baar charge ho gaya hai — I've called twice already.",
    language: "ur",
  },
  {
    type: "ai",
    text: "Main samajh gayi. Order 4821 par do charges hain — ek duplicate lag raha hai. Let me verify the details.",
    confidence: 0.89,
    language: "ur",
    reasoning: "Language switch · Urdu detected",
  },
  {
    type: "tool",
    tool: "order_lookup",
    label: "Order lookup · #4821",
    result: "2 captures of $49.00 · Nov 3 · one flagged duplicate",
  },
  {
    type: "ai",
    text: "I can see two charges of $49.00 on November 3rd. One is a duplicate. I can start a refund for that amount.",
    confidence: 0.9,
    reasoning: "Policy check · duplicate charge ≤ $75",
  },
  {
    type: "customer",
    text: "I want the whole order cancelled and the refund back to my card. And I'd like to speak to a person.",
    language: "en",
  },
  {
    type: "ai",
    text: "I understand. Cancelling the order and refunding to your card needs a specialist. I'll bring in a colleague now — you won't need to repeat any of this.",
    confidence: 0.58,
    risk: "medium",
    reasoning: "Policy exception · escalation required",
  },
  {
    type: "handoff",
    reason: "Customer request + policy exception",
  },
];

export const CLOSING_SCRIPT: ScriptEvent[] = [
  {
    type: "ai",
    text: "You're all set, Zara. Sara has processed the cancellation and refund. Is there anything else I can help with?",
    confidence: 0.95,
    reasoning: "Confirmation · human action verified",
  },
  {
    type: "customer",
    text: "No, that's all. Thanks.",
    language: "en",
  },
  {
    type: "ai",
    text: "Thanks for calling Niyamic-Voice-AI-Agent. Have a great day.",
    confidence: 0.99,
    reasoning: "Close · call resolved",
  },
];

export const HANDOFF_TURNS: Array<{
  role: "human" | "customer";
  text: string;
  language?: Language;
}> = [
  {
    role: "human",
    text: "Hi Zara, I'm Sara. I have the full context — duplicate charge on order 4821. I can cancel the order and process the refund to your card today.",
  },
  {
    role: "customer",
    text: "Thank you. How long will it take?",
    language: "en",
  },
  {
    role: "human",
    text: "Three to five business days. I'll email the confirmation as soon as it's done.",
  },
  {
    role: "customer",
    text: "Perfect, thank you.",
    language: "en",
  },
];
