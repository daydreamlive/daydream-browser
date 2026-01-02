"use client";

import { useEffect } from "react";
import { useCompositor, type Ctx2D } from "@daydreamlive/react";

export const SOURCE_ID = "kaleidoscope";

export function useKaleidoscopeSource() {
  const compositor = useCompositor();

  useEffect(() => {
    compositor.register(SOURCE_ID, {
      kind: "custom",
      onFrame: (ctx: Ctx2D, timestamp: number) => {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        const t = timestamp * 0.001;
        const cx = w / 2;
        const cy = h / 2;

        ctx.fillStyle = "#050508";
        ctx.fillRect(0, 0, w, h);

        const segments = 12;
        const angleStep = (Math.PI * 2) / segments;

        ctx.save();
        ctx.translate(cx, cy);

        for (let seg = 0; seg < segments; seg++) {
          ctx.save();
          ctx.rotate(seg * angleStep);

          // Mirror every other segment
          if (seg % 2 === 1) {
            ctx.scale(-1, 1);
          }

          // Draw patterns in this segment
          for (let i = 0; i < 5; i++) {
            const dist = 50 + i * 40 + Math.sin(t * 2 + i) * 20;
            const size = 15 + Math.sin(t * 3 + i * 0.5) * 8;
            const hue = (seg * 30 + i * 20 + t * 40) % 360;

            // Circles
            ctx.beginPath();
            ctx.arc(dist, 0, size, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${hue}, 75%, 55%, 0.8)`;
            ctx.fill();

            // Lines
            ctx.beginPath();
            ctx.moveTo(dist - size, -size / 2);
            ctx.lineTo(dist + size, size / 2);
            ctx.strokeStyle = `hsla(${(hue + 60) % 360}, 70%, 60%, 0.6)`;
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          // Rotating shapes
          const rotAngle = t + seg * 0.2;
          ctx.save();
          ctx.translate(120, 0);
          ctx.rotate(rotAngle);

          ctx.beginPath();
          for (let j = 0; j < 6; j++) {
            const a = (j * Math.PI * 2) / 6;
            const r = 25;
            const x = Math.cos(a) * r;
            const y = Math.sin(a) * r;
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fillStyle = `hsla(${(t * 60 + seg * 30) % 360}, 80%, 50%, 0.7)`;
          ctx.fill();

          ctx.restore();
          ctx.restore();
        }

        ctx.restore();

        // Center decoration
        ctx.beginPath();
        ctx.arc(cx, cy, 30 + Math.sin(t * 4) * 10, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${(t * 80) % 360}, 80%, 60%)`;
        ctx.fill();
      },
    });

    return () => {
      compositor.unregister(SOURCE_ID);
    };
  }, [compositor]);
}
