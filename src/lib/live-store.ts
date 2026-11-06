"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { seedSessions } from "./seed";
import type { Language, LiveSession, SessionRecord } from "./types";

const LIVE_PREFIX = "relay.live.";
const COMPLETED_PREFIX = "relay.session.";
const HEARTBEAT_PREFIX = "relay.heartbeat.";
const CHANNEL = "relay.live.v1";

// A scripted call counts as live only while a tab is showing it. Leaving or closing the
// tab clears its heartbeat at once; the timeout covers crashed tabs and background tabs
// whose timers the browser throttles to once a minute.
const HEARTBEAT_MS = 10_000;
const STALE_AFTER_MS = 3 * 60_000;
const NEW_CALL_GRACE_MS = 15_000;

type Listener = (session: LiveSession) => void;
type ChannelMessage = {
  tabId: string;
  type: "session" | "completed";
  session?: LiveSession;
};

const sessionListeners = new Map<string, Set<Listener>>();
const globalListeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;
let tabId = "";

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function notifyGlobal() {
  globalListeners.forEach((listener) => listener());
}

function emit(session: LiveSession) {
  sessionListeners.get(session.id)?.forEach((listener) => listener(session));
  notifyGlobal();
}

function ensureChannel() {
  if (!canUse() || channel) return;
  tabId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event: MessageEvent<ChannelMessage>) => {
    const data = event.data;
    if (!data || data.tabId === tabId) return;
    if (data.type === "session" && data.session) {
      const session = data.session;
      localStorage.setItem(LIVE_PREFIX + session.id, JSON.stringify(session));
      emit(session);
    } else if (data.type === "completed") {
      notifyGlobal();
    }
  };

  window.addEventListener("storage", (event) => {
    if (!event.key || !event.newValue) return;
    if (event.key.startsWith(LIVE_PREFIX)) {
      try {
        emit(JSON.parse(event.newValue) as LiveSession);
      } catch {
        // ignore malformed demo data
      }
    }
    if (event.key.startsWith(COMPLETED_PREFIX)) notifyGlobal();
  });
}

export function readLive(id: string): LiveSession | null {
  if (!canUse()) return null;
  const raw = localStorage.getItem(LIVE_PREFIX + id);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LiveSession;
  } catch {
    return null;
  }
}

export function writeLive(session: LiveSession) {
  if (!canUse()) return;
  ensureChannel();
  localStorage.setItem(LIVE_PREFIX + session.id, JSON.stringify(session));
  if (session.status === "ended") {
    const record = session.record;
    if (record) localStorage.setItem(COMPLETED_PREFIX + record.id, JSON.stringify(record));
  }
  channel?.postMessage({ tabId, type: "session", session } satisfies ChannelMessage);
  emit(session);
}

export function removeLive(id: string) {
  if (!canUse()) return;
  localStorage.removeItem(LIVE_PREFIX + id);
  notifyGlobal();
}

function isOpen(session: LiveSession, now = Date.now()) {
  if (now - session.startedAt < NEW_CALL_GRACE_MS) return true;
  const beat = Number(localStorage.getItem(HEARTBEAT_PREFIX + session.id));
  return beat > 0 && now - beat < STALE_AFTER_MS;
}

/** Scripted calls currently open in a tab. Abandoned calls are kept but not listed. */
export function listLive(): LiveSession[] {
  if (!canUse()) return [];
  const sessions: LiveSession[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(LIVE_PREFIX)) continue;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? "") as LiveSession;
      if (parsed?.id && isOpen(parsed)) sessions.push(parsed);
    } catch {
      // ignore
    }
  }
  return sessions.sort((a, b) => b.startedAt - a.startedAt);
}

export function listCompleted(): SessionRecord[] {
  if (!canUse()) return [];
  const records: SessionRecord[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(COMPLETED_PREFIX)) continue;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? "") as SessionRecord;
      if (parsed?.id) records.push(parsed);
    } catch {
      // ignore
    }
  }
  return records;
}

export function saveCompleted(record: SessionRecord) {
  if (!canUse()) return;
  localStorage.setItem(COMPLETED_PREFIX + record.id, JSON.stringify(record));
  notifyGlobal();
}

export function getCompleted(id: string): SessionRecord | null {
  if (!canUse()) return null;
  const raw = localStorage.getItem(COMPLETED_PREFIX + id);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionRecord;
  } catch {
    return null;
  }
}

export function resetLive(id: string) {
  if (!canUse()) return;
  localStorage.removeItem(LIVE_PREFIX + id);
  localStorage.removeItem(COMPLETED_PREFIX + id);
  notifyGlobal();
}

export function subscribe(id: string, listener: Listener) {
  ensureChannel();
  if (!sessionListeners.has(id)) sessionListeners.set(id, new Set());
  sessionListeners.get(id)!.add(listener);
  return () => {
    sessionListeners.get(id)?.delete(listener);
  };
}

export function subscribeAll(listener: () => void) {
  ensureChannel();
  globalListeners.add(listener);
  return () => {
    globalListeners.delete(listener);
  };
}

/** Marks a scripted call as open for as long as the calling component is mounted. */
export function useLiveHeartbeat(id: string) {
  useEffect(() => {
    if (!canUse()) return;
    const key = HEARTBEAT_PREFIX + id;
    const beat = () => localStorage.setItem(key, String(Date.now()));
    const stop = () => localStorage.removeItem(key);
    beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    window.addEventListener("pagehide", stop);
    window.addEventListener("pageshow", beat);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", stop);
      window.removeEventListener("pageshow", beat);
      stop();
      notifyGlobal();
    };
  }, [id]);
}

export function useLiveSession(
  id: string,
  create: () => LiveSession,
): {
  session: LiveSession | null;
  ready: boolean;
  update: (updater: (session: LiveSession) => LiveSession) => LiveSession | null;
} {
  const [session, setSession] = useState<LiveSession | null>(null);
  const [ready, setReady] = useState(false);
  const sessionRef = useRef<LiveSession | null>(null);
  const createRef = useRef(create);

  useEffect(() => {
    ensureChannel();
    let current = readLive(id);
    if (!current) {
      current = createRef.current();
      writeLive(current);
    }
    sessionRef.current = current;
    setSession(current);
    setReady(true);
    return subscribe(id, (next) => {
      sessionRef.current = next;
      setSession(next);
    });
  }, [id]);

  const update = useCallback((updater: (session: LiveSession) => LiveSession) => {
    const current = sessionRef.current ?? readLive(id);
    if (!current) return null;
    const next = updater(current);
    sessionRef.current = next;
    setSession(next);
    writeLive(next);
    return next;
  }, [id]);

  return { session, ready, update };
}

export function useLiveSessions() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);

  useEffect(() => {
    ensureChannel();
    const load = () => setSessions(listLive());
    load();
    const interval = setInterval(load, 1200);
    const unsubscribe = subscribeAll(load);
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  return sessions;
}

const EMPTY_SESSIONS: SessionRecord[] = [];

export function useAllSessions(extra: SessionRecord[] = EMPTY_SESSIONS) {
  const [local, setLocal] = useState<SessionRecord[]>([]);

  useEffect(() => {
    ensureChannel();
    const load = () => setLocal(listCompleted());
    load();
    const unsubscribe = subscribeAll(load);
    return unsubscribe;
  }, []);

  return useMemo(() => {
    const map = new Map<string, SessionRecord>();
    for (const record of [...seedSessions, ...extra, ...local]) {
      map.set(record.id, record);
    }
    return [...map.values()].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
  }, [extra, local]);
}

export function createLiveSession(
  id: string,
  agentId: string,
  language: Language = "en",
): LiveSession {
  return {
    id,
    agentId,
    customerName: "Zara Ahmed",
    language,
    startedAt: Date.now(),
    status: "connecting",
    control: "ai",
    agentState: "listening",
    risk: "low",
    confidence: 0.95,
    intent: "Duplicate charge · order 4821",
    sentiment: "neutral",
    transcript: [],
    toolCalls: [],
    paused: false,
    micMuted: false,
    nextAt: Date.now() + 900,
    step: 0,
    phase: "call",
    latency: { stt: 240, llm: 680, tts: 310 },
  };
}
