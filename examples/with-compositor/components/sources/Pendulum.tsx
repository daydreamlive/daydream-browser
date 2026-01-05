"use client";

import { useEffect, useRef } from "react";
import { useSource } from "@daydreamlive/react";

interface PendulumState {
  angle: number;
  length: number;
  phase: number;
}

export const SOURCE_ID = "pendulum";

export function usePendulumSource() {
  const { ref } = useSource<HTMLCanvasElement>(SOURCE_ID, { kind: "canvas" });
  const pendulumRef = useRef<PendulumState[]>([]);
  const initializedRef = useRef(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animate = (timestamp: number) => {
      const w = canvas.width;
      const h = canvas.height;
      const t = timestamp * 0.001;

      // Initialize pendulums
      if (!initializedRef.current) {
        initializedRef.current = true;
        const count = 15;
        pendulumRef.current = Array.from({ length: count }, (_, i) => ({
          angle: 0,
          length: 100 + i * 15,
          phase: (i * Math.PI * 2) / count,
        }));
      }

      // Dark background
      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, w, h);

      const cx = w / 2;
      const startY = 50;

      // Update and draw pendulums
      pendulumRef.current.forEach((p, i) => {
        // Simple harmonic motion with different frequencies
        const frequency = 0.5 + i * 0.03;
        p.angle = Math.sin(t * frequency + p.phase) * 0.8;

        const bobX = cx + Math.sin(p.angle) * p.length;
        const bobY = startY + Math.cos(p.angle) * p.length;

        const hue = (i * 24 + t * 20) % 360;

        // Draw string
        ctx.beginPath();
        ctx.moveTo(cx, startY);
        ctx.lineTo(bobX, bobY);
        ctx.strokeStyle = `hsla(${hue}, 60%, 40%, 0.5)`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw bob
        ctx.beginPath();
        ctx.arc(bobX, bobY, 12, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${hue}, 70%, 55%)`;
        ctx.fill();

        // Glow effect
        ctx.beginPath();
        ctx.arc(bobX, bobY, 16, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.3)`;
        ctx.fill();
      });

      // Draw pivot point
      ctx.beginPath();
      ctx.arc(cx, startY, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [ref]);

  return <canvas ref={ref} style={{ display: "none" }} />;
}
