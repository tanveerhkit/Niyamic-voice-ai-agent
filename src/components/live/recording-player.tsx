"use client";

import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";
import { Badge } from "@/components/ui";

export function RecordingPlayer({ durationSec }: { durationSec: number }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setProgress((value) => {
        if (value >= 100) {
          setPlaying(false);
          return 100;
        }
        return value + 0.55;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [playing]);

  const bars = 56;
  const elapsed = Math.round((progress / 100) * durationSec);

  return (
    <div className="rounded-none border border-line bg-surface-2/50 p-3">
      <div className="flex items-center justify-between">
        <Badge tone="outline">Recording</Badge>
        <button
          type="button"
          onClick={() => {
            if (progress >= 100) setProgress(0);
            setPlaying((value) => !value);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-ink transition-transform hover:scale-105"
          aria-label={playing ? "Pause recording" : "Play recording"}
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="mt-3 flex h-10 items-end gap-[3px]">
        {Array.from({ length: bars }).map((_, index) => {
          const height =
            4 +
            Math.abs(
              Math.sin(index * 0.48) * 16 + Math.sin(index * 1.17) * 8 + Math.cos(index * 0.21) * 6,
            );
          const filled = (index / bars) * 100 <= progress;
          return (
            <span
              key={index}
              className={cn(
                "flex-1 rounded-full transition-colors",
                filled ? "bg-accent/80" : "bg-ink/15",
              )}
              style={{ height: `${height.toFixed(1)}px` }}
            />
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between font-mono text-[9px] text-muted-2">
        <span>{formatDuration(elapsed)}</span>
        <span>{formatDuration(durationSec)}</span>
      </div>

      {progress >= 100 ? (
        <button
          type="button"
          onClick={() => {
            setProgress(0);
            setPlaying(true);
          }}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-none border border-line py-1.5 text-[10px] text-muted hover:text-ink"
        >
          <RotateCcw className="h-3 w-3" />
          Replay
        </button>
      ) : null}
    </div>
  );
}
