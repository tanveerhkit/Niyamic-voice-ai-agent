"use client";

import { useEffect, useRef } from "react";

type WaveState = "listening" | "thinking" | "speaking" | "assistive" | "muted" | "human";

const PALETTE: Record<WaveState, { color: string; energy: number; motion: number }> = {
  speaking: { color: "#221e1c", energy: 1, motion: 1 },
  human: { color: "#3f6b63", energy: 0.92, motion: 0.9 },
  thinking: { color: "#6b5a7d", energy: 0.5, motion: 1.35 },
  assistive: { color: "#a9762a", energy: 0.38, motion: 0.7 },
  listening: { color: "#221e1c", energy: 0.42, motion: 0.55 },
  muted: { color: "#96908a", energy: 0.12, motion: 0.22 },
};

/**
 * Radial "sound halo" waveform: concentric rippling rings, a slowly drifting
 * ring of tone bars and sparse particles. Bars ease toward their target
 * amplitude every frame, so motion stays fluid even when the state changes.
 * The empty core leaves room for an avatar at the centre.
 */
export function Waveform({
  state,
  active = true,
  className,
}: {
  state: WaveState;
  active?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const { color, energy, motion } = PALETTE[state];

    let size = 0;
    let frame = 0;
    let started = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      size = Math.max(1, rect.width);
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const barCount = 96;
    const levels = new Float32Array(barCount);

    // Composite sine field: three slow harmonics, no noise, so bars never
    // flicker between adjacent frames.
    const field = (angle: number, t: number) => {
      const value =
        Math.sin(angle * 3 + t * 1.15) * 0.44 +
        Math.sin(angle * 5 - t * 1.6) * 0.24 +
        Math.sin(angle * 8 + t * 2.2) * 0.11;
      const angular = 0.3 + 0.7 * (0.5 + 0.5 * Math.cos(angle - 3.9));
      return { value: 0.5 + 0.5 * value, angular };
    };

    const draw = (now: number) => {
      const t = reduced ? 0 : ((now - started) / 1000) * motion;
      const cx = size / 2;
      const cy = size / 2;
      const R = size / 2 - 3;

      ctx.clearRect(0, 0, size, size);
      ctx.lineCap = "butt";

      // --- rippling rings -------------------------------------------------
      const rings = 7;
      for (let ring = 0; ring < rings; ring++) {
        const base = R * (0.5 + (ring / (rings - 1)) * 0.46);
        const drift = t * 0.28 + ring * 0.62;
        const wobble = R * (0.008 + ring * 0.0012);

        ctx.beginPath();
        const steps = 220;
        for (let s = 0; s <= steps; s++) {
          const a = (s / steps) * Math.PI * 2;
          const rr =
            base +
            Math.sin(a * 3 + drift) * wobble +
            Math.sin(a * 7 - drift * 0.6) * wobble * 0.34;
          const x = cx + Math.cos(a) * rr;
          const y = cy + Math.sin(a) * rr;
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.15 - (ring / rings) * 0.075;
        ctx.lineWidth = 0.75;
        ctx.stroke();
      }

      // --- drifting particles --------------------------------------------
      for (let d = 0; d < 26; d++) {
        const a = d * 2.39996 + t * 0.06 + Math.sin(d * 1.7) * 0.08;
        const rr = R * (0.6 + (((d * 37) % 100) / 100) * 0.33);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 0.9 + (d % 3) * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.16 + (d % 4) * 0.04;
        ctx.fill();
      }

      // --- tone bars along the arc ---------------------------------------
      const inner = R * 0.47;
      ctx.lineCap = "round";
      for (let i = 0; i < barCount; i++) {
        const angle = (i / barCount) * Math.PI * 2;
        const { value, angular } = field(angle, t);
        const target = active ? value * angular * energy : value * angular * energy * 0.25;
        levels[i] += (target - levels[i]) * (active ? 0.075 : 1);

        const level = levels[i];
        const outer = inner + 2 + level * R * 0.34;
        const bend = 0.014 + level * 0.012;
        const a0 = angle - bend;
        const a1 = angle + bend;

        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a0) * inner, cy + Math.sin(a0) * inner);
        ctx.lineTo(cx + Math.cos(a1) * outer, cy + Math.sin(a1) * outer);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.26 + level * 0.5;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      // --- outer calibration ring ----------------------------------------
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.035);
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.985, 0, Math.PI * 2);
      ctx.setLineDash([1, 7]);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.24;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // --- rotating highlight sweep --------------------------------------
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.72, t * 0.22 - 0.5, t * 0.22 + 0.55);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.16;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      ctx.globalAlpha = 1;
    };

    if (active && !reduced) {
      const loop = (now: number) => {
        draw(now);
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    } else {
      // Warm the bars up so the frozen state still reads as a waveform.
      for (let pass = 0; pass < 24; pass++) draw(started + pass * 16);
      draw(started);
    }

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [state, active]);

  return (
    <canvas
      ref={ref}
      className={className}
      style={{ display: "block", width: "100%", height: "100%" }}
      aria-hidden
    />
  );
}
