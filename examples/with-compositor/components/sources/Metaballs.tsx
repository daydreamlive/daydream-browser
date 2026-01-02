"use client";

import { useEffect, useRef } from "react";
import { useCompositor, type Ctx2D } from "@daydreamlive/react";

interface Blob {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export const SOURCE_ID = "metaballs";

export function useMetaballsSource() {
  const compositor = useCompositor();
  const blobsRef = useRef<Blob[]>([]);
  const initializedRef = useRef(false);

  useEffect(() => {
    compositor.register(SOURCE_ID, {
      kind: "custom",
      onFrame: (ctx: Ctx2D, timestamp: number) => {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        const t = timestamp * 0.001;

        // Initialize blobs on first frame
        if (!initializedRef.current) {
          initializedRef.current = true;
          blobsRef.current = Array.from({ length: 6 }, () => ({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 3,
            vy: (Math.random() - 0.5) * 3,
            radius: 60 + Math.random() * 40,
          }));
        }

        // Update blob positions
        blobsRef.current.forEach((blob) => {
          blob.x += blob.vx;
          blob.y += blob.vy;

          if (blob.x < blob.radius || blob.x > w - blob.radius) blob.vx *= -1;
          if (blob.y < blob.radius || blob.y > h - blob.radius) blob.vy *= -1;

          blob.x = Math.max(blob.radius, Math.min(w - blob.radius, blob.x));
          blob.y = Math.max(blob.radius, Math.min(h - blob.radius, blob.y));
        });

        // Create image data for metaball calculation
        const imageData = ctx.createImageData(w, h);
        const data = imageData.data;
        const threshold = 1.0;

        for (let y = 0; y < h; y += 2) {
          for (let x = 0; x < w; x += 2) {
            let sum = 0;

            for (const blob of blobsRef.current) {
              const dx = x - blob.x;
              const dy = y - blob.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              sum += (blob.radius * blob.radius) / (dist * dist + 1);
            }

            if (sum > threshold) {
              const hue = (sum * 30 + t * 50) % 360 | 0;
              const lightness = Math.min(70, 40 + sum * 10) | 0;

              // Convert HSL to RGB
              const c = ((1 - Math.abs((2 * lightness) / 100 - 1)) * 80) / 100;
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

              const idx = (y * w + x) * 4;
              const color = [
                ((r + m) * 255) | 0,
                ((g + m) * 255) | 0,
                ((b + m) * 255) | 0,
              ];

              // Fill 2x2 block
              for (let dy = 0; dy < 2 && y + dy < h; dy++) {
                for (let dx = 0; dx < 2 && x + dx < w; dx++) {
                  const i = ((y + dy) * w + (x + dx)) * 4;
                  data[i] = color[0];
                  data[i + 1] = color[1];
                  data[i + 2] = color[2];
                  data[i + 3] = 255;
                }
              }
            } else {
              // Fill 2x2 block with background
              for (let dy = 0; dy < 2 && y + dy < h; dy++) {
                for (let dx = 0; dx < 2 && x + dx < w; dx++) {
                  const i = ((y + dy) * w + (x + dx)) * 4;
                  data[i] = 10;
                  data[i + 1] = 10;
                  data[i + 2] = 15;
                  data[i + 3] = 255;
                }
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
