"use client";

import { useEffect, useRef } from "react";

export type WaveState = "listening" | "thinking" | "speaking" | "assistive" | "muted" | "human";

interface PaletteConfig {
  color: string;
  energy: number;
  motion: number;
}

const PALETTE: Record<WaveState, PaletteConfig> = {
  speaking: { color: "#221e1c", energy: 1.0, motion: 1.0 },
  human: { color: "#3f6b63", energy: 0.95, motion: 0.95 },
  thinking: { color: "#6b5a7d", energy: 0.55, motion: 1.3 },
  assistive: { color: "#a9762a", energy: 0.42, motion: 0.75 },
  listening: { color: "#221e1c", energy: 0.38, motion: 0.55 },
  muted: { color: "#96908a", energy: 0.12, motion: 0.2 },
};

// Original art coordinate system constants
const ART_W = 442;
const ART_H = 397;
const ARC_CX = 225;
const ARC_CY = 215;
const ARC_START_DEG = -183;
const ARC_END_DEG = -54;
const ARC_START_RAD = (ARC_START_DEG * Math.PI) / 180;
const ARC_END_RAD = (ARC_END_DEG * Math.PI) / 180;

const ARC_RADII = [105, 113, 121, 129, 137, 145, 153, 161, 169, 177, 185, 193];
const BAR_COUNT = 64;

// Global singleton cached body image so it only decodes once
let cachedBodyImg: HTMLImageElement | null = null;
function getBodyImage(): HTMLImageElement | null {
  if (!cachedBodyImg && typeof window !== "undefined") {
    cachedBodyImg = new Image();
    cachedBodyImg.src = "/niyamic-body.png?v=3";
  }
  return cachedBodyImg;
}

/**
 * Niyamic Brand Audio Waveform Visualizer.
 *
 * Renders the Niyamic "n" mark with disintegration particles, concentric
 * acoustic ripple arcs, and dynamic, ultra-smooth audio waveform bars
 * that oscillate along the arc with fluid harmonics and physical easing.
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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const { color, energy, motion } = PALETTE[state];

    // Offscreen canvas for tinting the base mark cleanly
    const offCanvas = document.createElement("canvas");
    offCanvas.width = ART_W;
    offCanvas.height = ART_H;
    const offCtx = offCanvas.getContext("2d");

    let width = 0;
    let height = 0;
    let animationFrame = 0;
    const started = performance.now();
    let lastTime = started;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const bodyImg = getBodyImage();

    // Bars state arrays
    const levels = new Float32Array(BAR_COUNT);
    const smoothed = new Float32Array(BAR_COUNT);

    // Dynamic wave equation synthesized smoothly without jitter
    const calculateField = (norm: number, t: number, curEnergy: number) => {
      const theta = ARC_START_RAD + norm * (ARC_END_RAD - ARC_START_RAD);

      // Multi-harmonic traveling waves along the arc
      const w1 = Math.sin(theta * 3.4 + t * 1.55);
      const w2 = Math.sin(theta * 6.8 - t * 2.3 + 1.1);
      const w3 = Math.sin(theta * 11.2 + t * 3.4 + 2.3);
      const w4 = Math.sin(theta * 1.8 + t * 0.85);

      const dynamicWave = 0.48 + 0.3 * w1 + 0.16 * w2 + 0.08 * w3 + 0.12 * w4;

      // Realistic speech cadence pulse (breathing & voice bursts)
      const speechCadence =
        state === "speaking" || state === "human"
          ? 0.76 + 0.24 * Math.sin(t * 2.6) * Math.cos(t * 1.15)
          : 1.0;

      // Baseline resonant envelope based on reference artwork
      const p1 = Math.exp(-Math.pow((norm - 0.1) / 0.055, 2)) * 19;
      const p2 = Math.exp(-Math.pow((norm - 0.25) / 0.068, 2)) * 37;
      const p3 = Math.exp(-Math.pow((norm - 0.39) / 0.065, 2)) * 30;
      const p4 = Math.exp(-Math.pow((norm - 0.64) / 0.07, 2)) * 11;
      const tail = norm < 0.88 ? 1.0 : Math.max(0.15, (1.0 - norm) * 8.3);

      const baseAmp = (2.6 + p1 + p2 + p3 + p4) * tail;

      if (!active) {
        return baseAmp * 0.32;
      }

      return baseAmp * (0.35 + 0.65 * dynamicWave * curEnergy * speechCadence);
    };

    const draw = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const t = reduced ? 0 : ((now - started) / 1000) * motion;

      ctx.clearRect(0, 0, width, height);

      // Fit 442 x 397 into canvas with graceful padding
      const scale = Math.min(width / ART_W, height / ART_H) * 0.94;
      const offsetX = (width - ART_W * scale) / 2;
      const offsetY = (height - ART_H * scale) / 2;

      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      // --- 1. Draw Tinted Niyamic Base Mark & Particles -------------------
      if (bodyImg && bodyImg.complete && bodyImg.naturalWidth > 0 && offCtx) {
        offCtx.clearRect(0, 0, ART_W, ART_H);
        offCtx.drawImage(bodyImg, 0, 0, ART_W, ART_H);

        // Tint with current state color if not default dark ink
        if (color !== "#221e1c") {
          offCtx.save();
          offCtx.globalCompositeOperation = "source-in";
          offCtx.fillStyle = color;
          offCtx.fillRect(0, 0, ART_W, ART_H);
          offCtx.restore();
        }

        ctx.drawImage(offCanvas, 0, 0, ART_W, ART_H);
      }

      // --- 2. Concentric Ripple Arcs --------------------------------------
      ctx.save();
      ctx.lineCap = "round";
      for (let i = 0; i < ARC_RADII.length; i++) {
        const baseR = ARC_RADII[i];
        // Subtle breathing phase ripple traveling outward
        const ripple =
          active && !reduced ? Math.sin(t * 1.6 - i * 0.45) * 0.75 * energy : 0;
        const r = baseR + ripple;

        const arcAlpha =
          (0.12 + 0.05 * Math.sin(t * 1.1 + i * 0.35)) * (active ? 1.0 : 0.6);

        ctx.beginPath();
        ctx.arc(ARC_CX, ARC_CY, r, ARC_START_RAD, ARC_END_RAD);
        ctx.strokeStyle = color;
        ctx.globalAlpha = Math.max(0.04, Math.min(0.3, arcAlpha));
        ctx.lineWidth = 0.85;
        ctx.stroke();
      }
      ctx.restore();

      // --- 3. Compute Eased & Spatially Smoothed Wave Heights --------------
      const easeFactor = active ? Math.min(1.0, dt * 10.5) : 0.08;
      for (let i = 0; i < BAR_COUNT; i++) {
        const norm = i / (BAR_COUNT - 1);
        const target = calculateField(norm, t, energy);
        levels[i] += (target - levels[i]) * easeFactor;
      }

      // 3-Tap Spatial smoothing pass (Gaussian convolution across neighbor bars)
      // This mathematically guarantees that the wave profile never has sharp jagged spikes.
      for (let i = 0; i < BAR_COUNT; i++) {
        const prev = i > 0 ? levels[i - 1] : levels[i];
        const curr = levels[i];
        const next = i < BAR_COUNT - 1 ? levels[i + 1] : levels[i];
        smoothed[i] = prev * 0.22 + curr * 0.56 + next * 0.22;
      }

      // --- 4. Draw Audio Waveform Bars ------------------------------------
      ctx.save();
      ctx.lineCap = "round";

      for (let i = 0; i < BAR_COUNT; i++) {
        const norm = i / (BAR_COUNT - 1);
        const angle = ARC_START_RAD + norm * (ARC_END_RAD - ARC_START_RAD);

        // Centerline radius gently arches outward in the middle
        const rCenter = 138 + 13 * Math.sin(norm * Math.PI);
        const halfHeight = smoothed[i];

        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        // Radial bar extending inward and outward
        const x1 = ARC_CX + cosA * (rCenter - halfHeight);
        const y1 = ARC_CY + sinA * (rCenter - halfHeight);
        const x2 = ARC_CX + cosA * (rCenter + halfHeight);
        const y2 = ARC_CY + sinA * (rCenter + halfHeight);

        // Alpha scales gently with amplitude
        const alpha = Math.min(0.95, 0.45 + (halfHeight / 38) * 0.5);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 2.2;
        ctx.stroke();

        // Delicate floating acoustic dots beyond major peaks
        if (halfHeight > 24) {
          const dotDist = rCenter + halfHeight + 6.5 + Math.sin(t * 2.2 + i) * 2;
          const dotX = ARC_CX + cosA * dotDist;
          const dotY = ARC_CY + sinA * dotDist;

          ctx.beginPath();
          ctx.arc(dotX, dotY, 1.25, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = Math.min(0.8, alpha * 0.85);
          ctx.fill();
        }
      }
      ctx.restore();

      ctx.restore();
    };

    if (active && !reduced) {
      const loop = (now: number) => {
        draw(now);
        animationFrame = requestAnimationFrame(loop);
      };
      animationFrame = requestAnimationFrame(loop);
    } else {
      // Warm up smoothing buffer so the resting waveform is smooth
      for (let pass = 0; pass < 30; pass++) {
        draw(started + pass * 16);
      }
      draw(started);
    }

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, [state, active]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: "block", width: "100%", height: "100%" }}
      aria-hidden
    />
  );
}
