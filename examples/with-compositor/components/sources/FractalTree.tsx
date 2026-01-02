"use client";

import { useEffect } from "react";
import { useCompositor, type Ctx2D } from "@daydreamlive/react";

export const SOURCE_ID = "fractal";

export function useFractalTreeSource() {
  const compositor = useCompositor();

  useEffect(() => {
    compositor.register(SOURCE_ID, {
      kind: "custom",
      onFrame: (ctx: Ctx2D, timestamp: number) => {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        const t = timestamp * 0.001;

        ctx.fillStyle = "#0a0a0f";
        ctx.fillRect(0, 0, w, h);

        const drawBranch = (
          x: number,
          y: number,
          length: number,
          angle: number,
          depth: number,
          hue: number,
        ) => {
          if (depth <= 0 || length < 2) return;

          const endX = x + Math.cos(angle) * length;
          const endY = y + Math.sin(angle) * length;

          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(endX, endY);
          ctx.strokeStyle = `hsl(${hue}, 70%, ${40 + depth * 5}%)`;
          ctx.lineWidth = depth * 0.8;
          ctx.stroke();

          const windSway = Math.sin(t * 2 + depth * 0.5) * 0.1;
          const branchAngle = 0.4 + Math.sin(t * 0.5) * 0.15;

          drawBranch(
            endX,
            endY,
            length * 0.7,
            angle - branchAngle + windSway,
            depth - 1,
            hue + 15,
          );
          drawBranch(
            endX,
            endY,
            length * 0.7,
            angle + branchAngle + windSway,
            depth - 1,
            hue + 15,
          );

          // Extra branch for fuller tree
          if (depth > 4) {
            drawBranch(
              endX,
              endY,
              length * 0.5,
              angle + windSway,
              depth - 2,
              hue + 30,
            );
          }
        };

        // Draw tree from bottom center
        const baseHue = (t * 20) % 360;
        drawBranch(w / 2, h - 20, 100, -Math.PI / 2, 10, baseHue);
      },
    });

    return () => {
      compositor.unregister(SOURCE_ID);
    };
  }, [compositor]);
}
