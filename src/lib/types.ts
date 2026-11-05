export type Language = "en" | "ur" | "hi";
export type AgentStatus = "active" | "draft" | "paused";
export type AgentColor = "lime" | "cyan" | "violet" | "amber";
export type Sentiment = "positive" | "neutral" | "negative";
export type RiskLevel = "low" | "medium" | "high";
export type AgentState = "listening" | "thinking" | "speaking" | "assistive" | "muted";
export type Speaker = "ai" | "customer" | "human" | "system";
export type HandledBy = "ai" | "human" | "hybrid";

export type ToolId = "order_lookup" | "refund" | "crm_note" | "calendar" | "knowledge_search";

export interface ToolDefinition {
  id: ToolId;
  name: string;
  description: string;
  mock: boolean;
}

export interface EscalationConfig {
  confidenceThreshold: number;
  onCustomerRequest: boolean;
  onNegativeSentiment: boolean;
  onPolicyException: boolean;
  keywords: string[];
  maxTurns: number;
  transferTeam: string;
  message: string;
  autoTransferHighRisk: boolean;
}

export interface AgentStats {
  sessions: number;
  containment: number;
  transferRate: number;
  csat: number;
  avgHandleSec: number;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  persona: string;
  tone: string;
  languages: Language[];
  voice: string;
  greeting: string;
  systemPrompt: string;
  knowledge: string;
  tools: ToolId[];
  escalation: EscalationConfig;
  status: AgentStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  color: AgentColor;
  stats: AgentStats;
}

export interface Turn {
  id: string;
  role: Speaker;
  text: string;
  at: number;
  language?: Language;
  confidence?: number;
}

export interface ToolCall {
  id: string;
  tool: ToolId;
  label: string;
  result: string;
  status: "running" | "done";
  at: number;
}

export type HandoffStatus = "requested" | "accepted" | "completed";

export interface Handoff {
  status: HandoffStatus;
  reason: string;
  requestedAt: number;
  acceptedAt?: number;
  completedAt?: number;
  supervisor?: string;
  note?: string;
}

export type KeyMomentType = "intent" | "tool" | "risk" | "handoff" | "resolution";

export interface KeyMoment {
  at: number;
  label: string;
  type: KeyMomentType;
}

export interface SessionSummary {
  headline: string;
  intent: string;
  outcome: string;
  sentiment: Sentiment;
  resolution: string;
  bullets: string[];
  keyMoments: KeyMoment[];
  recommendation: string;
}

export type SessionStatus = "completed" | "transferred" | "abandoned";

export interface SessionRecord {
  id: string;
  agentId: string;
  customerName: string;
  language: Language;
  startedAt: string;
  durationSec: number;
  status: SessionStatus;
  outcome: "resolved" | "escalated" | "unresolved";
  sentiment: Sentiment;
  intent: string;
  handledBy: HandledBy;
  transferReason?: string;
  csat?: number;
  turnCount: number;
  summary?: SessionSummary;
  transcript?: Turn[];
  handoffs?: Handoff[];
}

export type LiveStatus = "connecting" | "ai_active" | "escalating" | "human_active" | "ended";
export type CallPhase = "call" | "handoff" | "closing" | "ended";

export interface PartialTurn {
  role: "ai" | "customer";
  text: string;
  shown: number;
  startedAt: number;
  language?: Language;
  confidence?: number;
}

export interface Latency {
  stt: number;
  llm: number;
  tts: number;
}

export interface LiveSession {
  id: string;
  agentId: string;
  customerName: string;
  language: Language;
  startedAt: number;
  endedAt?: number;
  status: LiveStatus;
  control: "ai" | "human";
  agentState: AgentState;
  risk: RiskLevel;
  confidence: number;
  intent: string;
  sentiment: Sentiment;
  transcript: Turn[];
  partial?: PartialTurn;
  toolCalls: ToolCall[];
  handoff?: Handoff;
  summary?: SessionSummary;
  paused: boolean;
  pausedAt?: number;
  micMuted: boolean;
  nextAt: number;
  step: number;
  phase: CallPhase;
  latency: Latency;
  reasoning?: string;
  record?: SessionRecord;
}

export interface ChartPoint {
  label: string;
  total: number;
  transferred: number;
  contained: number;
}
