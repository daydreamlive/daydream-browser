"use client";

import { useEffect } from "react";
import { useCompositor, type Ctx2D } from "@daydreamlive/react";

export const SOURCE_ID = "plasma";

export function usePlasmaSource() {
  const compositor = useCompositor();

  useEffect(() => {
    compositor.register(SOURCE_ID, {
      kind: "custom",
      onFrame: (ctx: Ctx2D, timestamp: number) => {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        const t = timestamp * 0.001;

        const imageData = ctx.createImageData(w, h);
        const data = imageData.data;
        const step = 2;

        for (let y = 0; y < h; y += step) {
          for (let x = 0; x < w; x += step) {
            // Classic plasma formula
            const v1 = Math.sin(x * 0.02 + t);
            const v2 = Math.sin((y * 0.02 + t) * 0.5);
            const v3 = Math.sin((x * 0.02 + y * 0.02 + t) * 0.5);
            const cx = x + Math.sin(t * 0.3) * 100;
            const cy = y + Math.cos(t * 0.4) * 100;
            const v4 = Math.sin(
              Math.sqrt((cx - w / 2) ** 2 + (cy - h / 2) ** 2) * 0.03,
            );

            const v = (v1 + v2 + v3 + v4) / 4;

            // Map to color
            const hue = ((v + 1) * 180 + t * 30) % 360;
            const sat = 80;
            const light = 50 + v * 20;

            // HSL to RGB
            const c = (1 - Math.abs((2 * light) / 100 - 1)) * (sat / 100);
            const x2 = c * (1 - Math.abs(((hue / 60) % 2) - 1));
            const m = light / 100 - c / 2;

            let r = 0,
              g = 0,
              b = 0;
            if (hue < 60) {
              r = c;
              g = x2;
            } else if (hue < 120) {
              r = x2;
              g = c;
            } else if (hue < 180) {
              g = c;
              b = x2;
            } else if (hue < 240) {
              g = x2;
              b = c;
            } else if (hue < 300) {
              r = x2;
              b = c;
            } else {
              r = c;
              b = x2;
            }

            // Fill block
            for (let dy = 0; dy < step && y + dy < h; dy++) {
              for (let dx = 0; dx < step && x + dx < w; dx++) {
                const i = ((y + dy) * w + (x + dx)) * 4;
                data[i] = ((r + m) * 255) | 0;
                data[i + 1] = ((g + m) * 255) | 0;
                data[i + 2] = ((b + m) * 255) | 0;
                data[i + 3] = 255;
              }
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);
      },
    });

    return () => {
      compositor.unregister(SOURCE_ID);
    };
  }, [compositor]);
}
