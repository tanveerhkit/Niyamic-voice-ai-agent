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
        },
      }),
    }),
};

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
