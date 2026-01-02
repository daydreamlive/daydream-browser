"use client";

import { useEffect, useRef } from "react";
import { useCompositor, type Ctx2D } from "@daydreamlive/react";

interface Ripple {
  x: number;
  y: number;
  time: number;
  hue: number;
}

export const SOURCE_ID = "ripples";

export function useRipplesSource() {
  const compositor = useCompositor();
  const ripplesRef = useRef<Ripple[]>([]);
  const lastSpawnRef = useRef(0);

  useEffect(() => {
    compositor.register(SOURCE_ID, {
      kind: "custom",
      onFrame: (ctx: Ctx2D, timestamp: number) => {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        const t = timestamp * 0.001;

        // Spawn new ripple periodically
        if (t - lastSpawnRef.current > 0.8) {
          lastSpawnRef.current = t;
          ripplesRef.current.push({
            x: w * 0.2 + Math.random() * w * 0.6,
            y: h * 0.2 + Math.random() * h * 0.6,
            time: t,
            hue: Math.random() * 360,
          });
        }

        // Remove old ripples
        ripplesRef.current = ripplesRef.current.filter((r) => t - r.time < 4);

        // Calculate interference pattern
        const imageData = ctx.createImageData(w, h);
        const data = imageData.data;
        const step = 3;

        for (let y = 0; y < h; y += step) {
          for (let x = 0; x < w; x += step) {
            let totalHeight = 0;
            let hueSum = 0;
            let count = 0;

            for (const ripple of ripplesRef.current) {
              const dx = x - ripple.x;
              const dy = y - ripple.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const age = t - ripple.time;
              const waveSpeed = 100;
              const wavePos = age * waveSpeed;

              // Wave amplitude decreases with distance and age
              const amplitude = Math.max(0, 1 - age * 0.3) / (1 + dist * 0.01);
              const wavelength = 30;
              const height =
                amplitude *
                Math.sin(((dist - wavePos) * (Math.PI * 2)) / wavelength);

              totalHeight += height;
              hueSum += ripple.hue * amplitude;
              count += amplitude;
            }

            // Map height to color
            const normalized = (totalHeight + 1) / 2;
            const hue = count > 0 ? hueSum / count : 200;
            const lightness = 30 + normalized * 40;

            // HSL to RGB
            const c = (1 - Math.abs((2 * lightness) / 100 - 1)) * 0.7;
            const x2 = c * (1 - Math.abs(((hue / 60) % 2) - 1));
            const m = lightness / 100 - c / 2;

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
