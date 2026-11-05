"use client";

import { useEffect, useRef } from "react";

export function Waveform({
  state,
  active = true,
  height = 96,
  className,
}: {
  state: "listening" | "thinking" | "speaking" | "assistive" | "muted" | "human";
  active?: boolean;
  height?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let frame = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      canvas.width = Math.max(1, rect.width * dpr);
      canvas.height = Math.max(1, rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const color =
      state === "speaking"
        ? "#c9f76f"
        : state === "human"
          ? "#6fe3f5"
          : state === "thinking"
            ? "#b6a4ff"
            : state === "assistive"
              ? "#ffb84d"
              : state === "muted"
                ? "#5f6570"
                : "rgba(255,255,255,0.34)";

    const amplitude =
      state === "speaking" ? 0.95 : state === "human" ? 0.9 : state === "thinking" ? 0.32 : state === "assistive" ? 0.22 : state === "muted" ? 0.05 : 0.3;

    const started = performance.now();

    const draw = (now: number) => {
      const t = (now - started) / 1000;
      ctx.clearRect(0, 0, width, height);
      if (!active) return;

      const bars = Math.max(28, Math.floor(width / 7));
      const gap = 3.2;
      const barWidth = Math.max(2, (width - gap * (bars - 1)) / bars);
      const maxHeight = height * 0.78;

      ctx.shadowColor = color;
      ctx.shadowBlur = state === "speaking" || state === "human" ? 12 : 0;

      for (let i = 0; i < bars; i++) {
        const position = i / Math.max(1, bars - 1);
        const edge = Math.sin(Math.PI * position);
        const wave =
          Math.sin(i * 0.42 + t * 2.3) * 0.55 +
          Math.sin(i * 0.93 - t * 3.4) * 0.28 +
          Math.sin(i * 0.19 + t * 1.35) * 0.17;
        const noise = 0.55 + 0.45 * Math.abs(wave);
        const centerBias = state === "speaking" ? 0.45 + edge * 0.55 : 0.4 + edge * 0.6;
        const barHeight = Math.max(
          2,
          noise * amplitude * maxHeight * centerBias,
        );
        const x = i * (barWidth + gap);
        const y = height / 2 - barHeight / 2;
        ctx.globalAlpha = 0.28 + edge * 0.72;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    };

    const loop = (now: number) => {
      draw(now);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [state, active, height]);

  return <canvas ref={ref} style={{ height }} className={className} aria-hidden />;
}
