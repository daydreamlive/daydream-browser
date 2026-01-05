"use client";

import { useEffect, useRef } from "react";
import { useSource } from "@daydreamlive/react";

interface Point {
  x: number;
  y: number;
  hue: number;
}

export const SOURCE_ID = "lissajous";

export function useLissajousSource() {
  const { ref } = useSource<HTMLCanvasElement>(SOURCE_ID, { kind: "canvas" });
  const trailRef = useRef<Point[]>([]);
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
      const cx = w / 2;
      const cy = h / 2;

      // Fade background
      ctx.fillStyle = "rgba(5, 5, 10, 0.08)";
      ctx.fillRect(0, 0, w, h);

      // Lissajous parameters (slowly changing)
      const a = 3 + Math.sin(t * 0.1) * 2;
      const b = 2 + Math.cos(t * 0.13) * 2;
      const delta = t * 0.3;

      // Calculate current point
      const amplitude = 200;
      const x = cx + amplitude * Math.sin(a * t * 2 + delta);
      const y = cy + amplitude * Math.sin(b * t * 2);

      // Add to trail
      trailRef.current.push({
        x,
        y,
        hue: (t * 50) % 360,
      });

      // Limit trail length
      if (trailRef.current.length > 300) {
        trailRef.current.shift();
      }

      // Draw trail
      ctx.lineWidth = 3;
      ctx.lineCap = "round";

      for (let i = 1; i < trailRef.current.length; i++) {
        const p0 = trailRef.current[i - 1];
        const p1 = trailRef.current[i];
        const alpha = i / trailRef.current.length;

        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.strokeStyle = `hsla(${p1.hue}, 75%, 55%, ${alpha})`;
        ctx.lineWidth = 2 + alpha * 4;
        ctx.stroke();
      }

      // Draw current point
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${(t * 50) % 360}, 80%, 60%)`;
      ctx.fill();

      // Draw reference info
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.font = "12px monospace";
      ctx.fillText(`a: ${a.toFixed(2)}  b: ${b.toFixed(2)}`, 10, 20);

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      trailRef.current = [];
    };
  }, [ref]);

  return <canvas ref={ref} style={{ display: "none" }} />;
}
