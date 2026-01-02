"use client";

import { useEffect, useRef } from "react";
import { useCompositor, type Ctx2D } from "@daydreamlive/react";

interface FlowParticle {
  x: number;
  y: number;
  hue: number;
}

export const SOURCE_ID = "flowfield";

// Simple noise function
function noise2D(x: number, y: number, t: number): number {
  const sin1 = Math.sin(x * 0.01 + t);
  const sin2 = Math.sin(y * 0.01 + t * 0.7);
  const sin3 = Math.sin((x + y) * 0.01 + t * 0.5);
  return (sin1 + sin2 + sin3) / 3;
}

export function useFlowFieldSource() {
  const compositor = useCompositor();
  const particlesRef = useRef<FlowParticle[]>([]);
  const initializedRef = useRef(false);

  useEffect(() => {
    compositor.register(SOURCE_ID, {
      kind: "custom",
      onFrame: (ctx: Ctx2D, timestamp: number) => {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        const t = timestamp * 0.0005;

        // Initialize particles on first frame
        if (!initializedRef.current) {
          initializedRef.current = true;
          particlesRef.current = Array.from({ length: 2000 }, () => ({
            x: Math.random() * w,
            y: Math.random() * h,
            hue: Math.random() * 360,
          }));
        }

        // Fade background (slower fade for trail effect)
        ctx.fillStyle = "rgba(8, 8, 15, 0.02)";
        ctx.fillRect(0, 0, w, h);

        particlesRef.current.forEach((p) => {
          // Get flow direction from noise
          const angle = noise2D(p.x, p.y, t) * Math.PI * 4;
          const speed = 3;

          // Move particle
          p.x += Math.cos(angle) * speed;
          p.y += Math.sin(angle) * speed;

          // Wrap around
          if (p.x < 0) p.x = w;
          if (p.x > w) p.x = 0;
          if (p.y < 0) p.y = h;
          if (p.y > h) p.y = 0;

          // Update hue based on position
          p.hue = (p.x / w) * 180 + (p.y / h) * 180 + t * 100;

          // Draw particle (larger and brighter)
          ctx.fillStyle = `hsl(${p.hue % 360}, 80%, 60%)`;
          ctx.fillRect(p.x - 1, p.y - 1, 3, 3);
        });
      },
    });

    return () => {
      compositor.unregister(SOURCE_ID);
      particlesRef.current = [];
    };
  }, [compositor]);
}
