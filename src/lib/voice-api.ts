"use client";

import { useCallback, useEffect, useState } from "react";
import type { Agent } from "./types";

/** Base URL of the Python backend (`backend/api.py`). */
export const VOICE_API_URL = (process.env.NEXT_PUBLIC_VOICE_API_URL || "http://localhost:8000").replace(
  /\/$/,
  "",
);

export interface ProviderStatus {
  configured: boolean;
  detail: string | null;
}

export interface DataStats {
  total: number;
  ready: number;
  records: number;
  chunks: number;
}

export interface VoiceHealth {
  status: "ok";
  /** How far this machine's clock is behind (+) or ahead (-) of LiveKit's. */
  clockSkewSeconds: number;
  voice: {
    ready: boolean;
    providers: {
      livekit: ProviderStatus;
      azureOpenAI: ProviderStatus;
      deepgram: ProviderStatus;
      smallestAI: ProviderStatus;
    };
  };
  data: DataStats;
}

export type DatasetStatus = "processing" | "ready" | "failed";

export interface Dataset {
  id: string;
  name: string;
  filename: string;
  kind: "spreadsheet" | "document";
  status: DatasetStatus;
  error: string | null;
  sizeBytes: number;
  recordCount: number;
  chunkCount: number;
  pageCount: number;
  sheets: Array<{ name: string; rows: number; columns: string[] }>;
  createdAt: string;
  updatedAt: string;
}

export type CellValue = string | number | boolean;

export interface DatasetPreview {
  dataset: Dataset;
  sheets: Array<{ name: string; columns: string[]; rows: Array<Record<string, CellValue>> }>;
  chunks: Array<{ page: number; text: string }>;
}

export interface RecordMatch {
  source: string;
  sheet: string;
  row: number;
  match: "exact" | "partial";
  matchedColumn: string | null;
  fields: Record<string, CellValue>;
}

export interface DocumentMatch {
  source: string;
  page: number;
  text: string;
  score: number;
}

export interface SearchResult {
  query: string;
  records: RecordMatch[];
  documents: DocumentMatch[];
}

/** Where a call stands in a human handoff, as reported by the voice agent. */
export type CallHandoff = "requested" | "accepted" | "missed";

export interface ActiveCall {
  id: string;
  agentId: string;
  agentName: string;
  customerName: string;
  /** LiveKit agent state: initializing, listening, thinking, speaking, or connecting. */
  agentState: string;
  elapsedSec: number;
  handoff: CallHandoff | null;
  handoffReason: string | null;
  handoffSummary: string | null;
  transferTeam: string | null;
  specialistName: string | null;
}

/** Participant identity prefix of a human specialist who joined a call. */
export const SPECIALIST_PREFIX = "specialist-";

/** Text-stream topic the voice agent uses to send the conversation so far to a joining specialist. */
export const HANDOFF_TOPIC = "agent.handoff";

/** Participant attributes the voice agent sets to describe a handoff. */
export const HANDOFF_ATTRIBUTES = {
  state: "niyamic.handoff",
  reason: "niyamic.handoff_reason",
  summary: "niyamic.handoff_summary",
  team: "niyamic.handoff_team",
  specialist: "niyamic.specialist",
} as const;

export interface HandoffContext {
  reason: string;
  summary: string;
  team: string;
  turns: Array<{ role: "ai" | "customer"; text: string }>;
}

export interface CallConnection {
  serverUrl: string;
  participantToken: string;
  roomName: string;
  participantIdentity: string;
}

export class VoiceApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${VOICE_API_URL}${path}`, init);
  } catch {
    throw new VoiceApiError(`Can't reach the voice backend at ${VOICE_API_URL}.`, 0);
  }
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      // keep the generic message
    }
    throw new VoiceApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function fileBody(file: File) {
  const body = new FormData();
  body.append("file", file);
  return body;
}

export const voiceApi = {
  health: () => request<VoiceHealth>("/api/health"),
  datasets: () => request<{ datasets: Dataset[]; stats: DataStats }>("/api/datasets"),
  upload: (file: File) => request<Dataset>("/api/datasets", { method: "POST", body: fileBody(file) }),
  replace: (id: string, file: File) =>
    request<Dataset>(`/api/datasets/${id}`, { method: "PUT", body: fileBody(file) }),
  remove: (id: string) => request<void>(`/api/datasets/${id}`, { method: "DELETE" }),
  preview: (id: string) => request<DatasetPreview>(`/api/datasets/${id}/preview`),
  search: (query: string) => request<SearchResult>(`/api/search?q=${encodeURIComponent(query)}`),
  activeCalls: () => request<{ calls: ActiveCall[] }>("/api/calls"),
  token: (agent: Agent, participantName = "Customer") =>
    request<CallConnection>("/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantName,
        agent: {
          id: agent.id,
          name: agent.name,
          role: agent.role,
          persona: agent.persona,
          tone: agent.tone,
          greeting: agent.greeting,
          systemPrompt: agent.systemPrompt,
          knowledge: agent.knowledge,
          languages: agent.languages,
          escalation: agent.escalation,
        },
      }),
    }),
  joinCall: (roomName: string, name: string) =>
    request<CallConnection>(`/api/calls/${encodeURIComponent(roomName)}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  endCall: (roomName: string) =>
    request<void>(`/api/calls/${encodeURIComponent(roomName)}/end`, { method: "POST" }),
};

// One poller shared by every component that shows live calls (the sidebar badge, Overview,
// Supervisor), so mounting several of them doesn't multiply requests.
type CallsState = { calls: ActiveCall[]; fetchedAt: number };
const CALLS_INTERVAL_MS = 3000;
const CALLS_OFFLINE_INTERVAL_MS = 30_000;
let callsState: CallsState = { calls: [], fetchedAt: 0 };
const callsListeners = new Set<(state: CallsState) => void>();
let callsTimer: ReturnType<typeof setTimeout> | undefined;
let callsGeneration = 0;

function pollCalls() {
  clearTimeout(callsTimer);
  const generation = ++callsGeneration;
  const settle = (calls: ActiveCall[], nextMs: number) => {
    if (generation !== callsGeneration || !callsListeners.size) return;
    callsState = { calls, fetchedAt: Date.now() };
    callsListeners.forEach((listener) => listener(callsState));
    callsTimer = setTimeout(pollCalls, nextMs);
  };
  voiceApi.activeCalls().then(
    (result) => settle(result.calls, CALLS_INTERVAL_MS),
    () => settle([], CALLS_OFFLINE_INTERVAL_MS),
  );
}

/** Fetch live calls now instead of waiting for the next poll, for example after joining one. */
export function refreshActiveCalls() {
  if (callsListeners.size) pollCalls();
}

/** Real LiveKit calls in progress. Polls slowly while the backend is unreachable. */
export function useActiveCalls() {
  const [state, setState] = useState<CallsState>(callsState);

  useEffect(() => {
    callsListeners.add(setState);
    if (callsListeners.size === 1) pollCalls();
    return () => {
      callsListeners.delete(setState);
      if (!callsListeners.size) {
        clearTimeout(callsTimer);
        callsGeneration++;
      }
    };
  }, []);

  return state;
}

/** Backend status, or an error when the backend is not running. */
export function useVoiceHealth() {
  const [health, setHealth] = useState<VoiceHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    () =>
      voiceApi
        .health()
        .then(
          (result) => {
            setHealth(result);
            setError(null);
          },
          (err: unknown) => {
            setHealth(null);
            setError(err instanceof Error ? err.message : "Voice backend unavailable.");
          },
        )
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => {
    setLoading(true);
    return load();
  }, [load]);

  return { health, error, loading, refresh };
}
