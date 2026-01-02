"use client";

import { useEffect } from "react";
import { useCompositor, type Ctx2D } from "@daydreamlive/react";

export const SOURCE_ID = "geometry";

export function useGeometrySource() {
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

        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(0, 0, w, h);

        // Rotating hexagons
        const layers = 5;
        for (let layer = 0; layer < layers; layer++) {
          const radius = 40 + layer * 50;
          const sides = 6;
          const rotation =
            t * (layer % 2 === 0 ? 0.5 : -0.3) + (layer * Math.PI) / 6;
          const hue = (layer * 60 + t * 30) % 360;

          ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${0.8 - layer * 0.1})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i <= sides; i++) {
            const angle = (i * 2 * Math.PI) / sides + rotation;
            const x = cx + radius * Math.cos(angle);
            const y = cy + radius * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }

        // Orbiting circles
        const orbitCount = 8;
        for (let i = 0; i < orbitCount; i++) {
          const orbitAngle = (i * 2 * Math.PI) / orbitCount + t * 1.5;
          const orbitRadius = 180;
          const x = cx + orbitRadius * Math.cos(orbitAngle);
          const y = cy + orbitRadius * Math.sin(orbitAngle);
          const circleRadius = 12 + Math.sin(t * 3 + i) * 4;
          const hue = (i * 45 + t * 50) % 360;

          ctx.beginPath();
          ctx.arc(x, y, circleRadius, 0, Math.PI * 2);
          ctx.fillStyle = `hsl(${hue}, 70%, 55%)`;
          ctx.fill();
        }

        // Center pulsing star
        const starPoints = 8;
        const innerRadius = 20 + Math.sin(t * 4) * 8;
        const outerRadius = 50 + Math.sin(t * 2) * 10;
        ctx.beginPath();
        for (let i = 0; i < starPoints * 2; i++) {
          const angle = (i * Math.PI) / starPoints - Math.PI / 2 + t;
          const r = i % 2 === 0 ? outerRadius : innerRadius;
          const x = cx + r * Math.cos(angle);
          const y = cy + r * Math.sin(angle);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = `hsl(${(t * 60) % 360}, 80%, 65%)`;
        ctx.fill();
      },
    });

    return () => {
      compositor.unregister(SOURCE_ID);
    };
  }, [compositor]);
}
