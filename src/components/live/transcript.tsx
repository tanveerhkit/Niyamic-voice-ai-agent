"use client";

import { useEffect, useRef } from "react";
import { Bot, Headphones, UserRound } from "lucide-react";
import type { LiveSession } from "@/lib/types";
import { cn, LANGUAGE_SHORT } from "@/lib/utils";

function formatAt(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const roleMeta = {
  ai: { label: "Ayesha", icon: Bot, color: "text-accent", bubble: "border-accent/10 bg-accent/[0.045]" },
  human: {
    label: "Sara",
    icon: Headphones,
    color: "text-cyan",
    bubble: "border-cyan/15 bg-cyan/[0.055]",
  },
  customer: {
    label: "Customer",
    icon: UserRound,
    color: "text-ink/70",
    bubble: "border-line bg-surface",
  },
  system: { label: "System", icon: Bot, color: "text-muted", bubble: "" },
};

export function Transcript({
  session,
  className,
}: {
  session: LiveSession;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const partial = session.partial;

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [session.transcript.length, partial?.shown]);

  return (
    <div ref={ref} className={cn("scrollbar-thin overflow-y-auto", className)}>
      <div className="space-y-3 p-4">
        {session.transcript.length === 0 && !partial ? (
          <div className="flex h-40 flex-col items-center justify-center text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface-2 text-muted-2">
              <Bot className="h-4 w-4" />
            </span>
            <p className="mt-3 text-[11.5px] text-muted">Connecting audio...</p>
            <p className="mt-0.5 font-mono text-[9px] text-muted-2">Live transcript will appear here</p>
          </div>
        ) : null}

        {session.transcript.map((turn) => {
          if (turn.role === "system") {
            return (
              <div key={turn.id} className="flex items-center gap-2 py-1">
                <span className="h-px flex-1 bg-line" />
                <span className="rounded-full border border-line bg-surface-2 px-2.5 py-1 font-mono text-[8.5px] uppercase tracking-[0.1em] text-muted-2">
                  {turn.text}
                </span>
                <span className="h-px flex-1 bg-line" />
              </div>
            );
          }

          const meta = roleMeta[turn.role as "ai" | "human" | "customer"];
          const Icon = meta.icon;
          return (
            <div key={turn.id} className="float-in">
              <div className="mb-1 flex items-center gap-1.5">
                <Icon className={cn("h-3 w-3", meta.color)} />
                <span className={cn("text-[10px] font-medium", meta.color)}>{meta.label}</span>
                {turn.language ? (
                  <span className="font-mono text-[8px] uppercase text-muted-2">
                    {LANGUAGE_SHORT[turn.language]}
                  </span>
                ) : null}
                <span className="ml-auto font-mono text-[8px] text-muted-2">{formatAt(turn.at)}</span>
              </div>
              <div className={cn("rounded-xl border px-3 py-2 text-[11.5px] leading-relaxed text-ink/90", meta.bubble)}>
                {turn.text}
              </div>
            </div>
          );
        })}

        {partial ? (
          <div className="float-in">
            <div className="mb-1 flex items-center gap-1.5">
              {partial.role === "ai" ? (
                <Bot className="h-3 w-3 text-accent" />
              ) : (
                <UserRound className="h-3 w-3 text-ink/70" />
              )}
              <span
                className={cn(
                  "text-[10px] font-medium",
                  partial.role === "ai" ? "text-accent" : "text-ink/70",
                )}
              >
                {partial.role === "ai" ? "Ayesha" : "Customer"}
              </span>
              <span className="flex items-center gap-1 font-mono text-[8px] uppercase text-muted-2">
                <span className="h-1 w-1 animate-pulse rounded-full bg-accent" />
                live
              </span>
            </div>
            <div
              className={cn(
                "rounded-xl border px-3 py-2 text-[11.5px] leading-relaxed text-ink/90",
                partial.role === "ai"
                  ? "border-accent/10 bg-accent/[0.045]"
                  : "border-line bg-surface",
              )}
            >
              {partial.text.slice(0, partial.shown)}
              <span className="ml-0.5 inline-block h-3 w-[2px] translate-y-[2px] animate-pulse bg-accent" />
            </div>
          </div>
        ) : null}

        {session.paused ? (
          <div className="rounded-lg border border-amber/20 bg-amber/[0.05] px-3 py-2 text-center text-[10px] text-amber">
            Call paused · mock audio is silent
          </div>
        ) : null}
      </div>
    </div>
  );
}
