"use client";

import { useEffect, useRef } from "react";
import { useCompositor, type Ctx2D } from "@daydreamlive/react";

interface Point {
  x: number;
  y: number;
  hue: number;
}

export const SOURCE_ID = "spirograph";

export function useSpirographSource() {
  const compositor = useCompositor();
  const trailRef = useRef<Point[]>([]);
  const angleRef = useRef(0);

  useEffect(() => {
    compositor.register(SOURCE_ID, {
      kind: "custom",
      onFrame: (ctx: Ctx2D, timestamp: number) => {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        const t = timestamp * 0.001;
        const cx = w / 2;
        const cy = h / 2;

        // Fade background
        ctx.fillStyle = "rgba(5, 5, 12, 0.03)";
        ctx.fillRect(0, 0, w, h);

        // Spirograph parameters (change over time)
        const R = 150; // Fixed circle radius
        const r = 50 + Math.sin(t * 0.1) * 30; // Rolling circle radius
        const d = 80 + Math.cos(t * 0.15) * 40; // Drawing point distance

        // Draw multiple points per frame for smooth curves
        for (let i = 0; i < 5; i++) {
          angleRef.current += 0.05;
          const a = angleRef.current;

          const x =
            cx + (R - r) * Math.cos(a) + d * Math.cos(((R - r) / r) * a);
          const y =
            cy + (R - r) * Math.sin(a) - d * Math.sin(((R - r) / r) * a);

          trailRef.current.push({
            x,
            y,
            hue: (a * 20 + t * 30) % 360,
          });
        }

        // Limit trail
        if (trailRef.current.length > 2000) {
          trailRef.current = trailRef.current.slice(-2000);
        }

        // Draw trail
        ctx.lineWidth = 2;
        for (let i = 1; i < trailRef.current.length; i++) {
          const p0 = trailRef.current[i - 1];
          const p1 = trailRef.current[i];
          const alpha = i / trailRef.current.length;

          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.strokeStyle = `hsla(${p1.hue}, 80%, 55%, ${alpha})`;
          ctx.stroke();
        }
      },
    });

    return () => {
      compositor.unregister(SOURCE_ID);
      trailRef.current = [];
    };
  }, [compositor]);
}
