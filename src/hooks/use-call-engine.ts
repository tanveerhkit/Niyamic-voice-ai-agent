"use client";

import { useCallback, useEffect, useRef } from "react";
import { CALL_SCRIPT, CLOSING_SCRIPT } from "@/lib/call-script";
import { createLiveSession, useLiveSession } from "@/lib/live-store";
import {
  applyManualTransfer,
  elapsedSeconds,
  finishSession,
} from "@/lib/live-actions";
import { uid } from "@/lib/utils";
import type { LiveSession, Turn } from "@/lib/types";

export function useCallEngine(sessionId: string, agentId: string) {
  const { session, ready, update } = useLiveSession(sessionId, () =>
    createLiveSession(sessionId, agentId),
  );
  const latest = useRef<LiveSession | null>(null);

  useEffect(() => {
    latest.current = session;
  }, [session]);

  useEffect(() => {
    const timer = setInterval(() => {
      const s = latest.current;
      if (!s) return;
      const now = Date.now();

      if (s.status === "connecting") {
        if (now >= s.nextAt) {
          update((value) => ({
            ...value,
            status: "ai_active",
            agentState: "listening",
            nextAt: now,
            reasoning: "Connected · listening",
          }));
        }
        return;
      }

      if (s.paused || s.status !== "ai_active" || s.phase === "ended") return;

      const runningTool = s.toolCalls.find((tool) => tool.status === "running");
      if (runningTool && now >= s.nextAt) {
        update((value) => ({
          ...value,
          toolCalls: value.toolCalls.map((tool) =>
            tool.status === "running" ? { ...tool, status: "done" } : tool,
          ),
          nextAt: now + 450,
        }));
        return;
      }

      if (s.partial) {
        const partial = s.partial;
        const shown = Math.min(
          partial.text.length,
          Math.floor((now - partial.startedAt) / 24),
        );
        if (shown >= partial.text.length) {
          const turn: Turn = {
            id: uid("turn"),
            role: partial.role,
            text: partial.text,
            at: Math.floor((now - s.startedAt) / 1000),
            language: partial.language,
            confidence: partial.confidence,
          };
          update((value) => ({
            ...value,
            transcript: [...value.transcript, turn],
            partial: undefined,
            agentState: "listening",
            nextAt: now + 620,
            reasoning: "Listening for the next turn",
          }));
        } else if (shown !== partial.shown) {
          update((value) => ({ ...value, partial: { ...partial, shown } }));
        }
        return;
      }

      if (now < s.nextAt) return;

      const script = s.phase === "closing" ? CLOSING_SCRIPT : CALL_SCRIPT;
      const event = script[s.step];

      if (!event) {
        if (s.phase === "closing") update(finishSession);
        return;
      }

      if (event.type === "ai") {
        update((value) => ({
          ...value,
          partial: {
            role: "ai",
            text: event.text,
            shown: 0,
            startedAt: now,
            language: event.language ?? value.language,
            confidence: event.confidence ?? value.confidence,
          },
          agentState: "speaking",
          confidence: event.confidence ?? value.confidence,
          risk: event.risk ?? value.risk,
          reasoning: event.reasoning ?? "Generating response",
          step: value.step + 1,
        }));
      } else if (event.type === "customer") {
        update((value) => ({
          ...value,
          partial: {
            role: "customer",
            text: event.text,
            shown: 0,
            startedAt: now,
            language: event.language ?? value.language,
          },
          agentState: "listening",
          step: value.step + 1,
          reasoning: "Transcribing customer audio",
        }));
      } else if (event.type === "tool") {
        update((value) => ({
          ...value,
          toolCalls: [
            ...value.toolCalls,
            {
              id: uid("tool"),
              tool: event.tool,
              label: event.label,
              result: event.result,
              status: "running",
              at: elapsedSeconds(value),
            },
          ],
          agentState: "thinking",
          step: value.step + 1,
          nextAt: now + 950,
          reasoning: event.label,
        }));
      } else if (event.type === "handoff") {
        update((value) => ({
          ...value,
          status: "escalating",
          risk: "high",
          confidence: Math.min(value.confidence, 0.58),
          handoff: {
            status: "requested",
            reason: event.reason,
            requestedAt: now,
          },
          agentState: "listening",
          step: value.step + 1,
          nextAt: Number.MAX_SAFE_INTEGER,
          reasoning: "Sharing context with available specialists",
        }));
      }
    }, 110);

    return () => clearInterval(timer);
  }, [update]);

  const togglePause = useCallback(() => {
    update((s) => {
      if (s.status === "ended") return s;
      if (s.paused) {
        const delta = Date.now() - (s.pausedAt ?? Date.now());
        return {
          ...s,
          paused: false,
          pausedAt: undefined,
          nextAt: s.nextAt + delta,
          partial: s.partial
            ? { ...s.partial, startedAt: s.partial.startedAt + delta }
            : undefined,
        };
      }
      return { ...s, paused: true, pausedAt: Date.now() };
    });
  }, [update]);

  const toggleMic = useCallback(() => {
    update((s) => ({ ...s, micMuted: !s.micMuted }));
  }, [update]);

  const transfer = useCallback(() => {
    update(applyManualTransfer);
  }, [update]);

  const end = useCallback(() => {
    update(finishSession);
  }, [update]);

  return { session, ready, update, togglePause, toggleMic, transfer, end };
}
