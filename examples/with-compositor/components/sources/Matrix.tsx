"use client";

import { useEffect, useRef } from "react";
import { useCompositor, type Ctx2D } from "@daydreamlive/react";

interface Drop {
  x: number;
  y: number;
  speed: number;
  length: number;
  chars: string[];
}

export const SOURCE_ID = "matrix";

const CHARS =
  "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789";
const FONT_SIZE = 14;

export function useMatrixSource() {
  const compositor = useCompositor();
  const dropsRef = useRef<Drop[]>([]);
  const initializedRef = useRef(false);

  useEffect(() => {
    compositor.register(SOURCE_ID, {
      kind: "custom",
      onFrame: (ctx: Ctx2D) => {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        const cols = Math.floor(w / FONT_SIZE);

        // Initialize drops
        if (!initializedRef.current) {
          initializedRef.current = true;
          dropsRef.current = Array.from({ length: cols }, (_, i) => ({
            x: i * FONT_SIZE,
            y: Math.random() * -h,
            speed: 3 + Math.random() * 5,
            length: 10 + Math.floor(Math.random() * 20),
            chars: Array.from(
              { length: 30 },
              () => CHARS[Math.floor(Math.random() * CHARS.length)],
            ),
          }));
        }

        // Fade background
        ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
        ctx.fillRect(0, 0, w, h);

        ctx.font = `${FONT_SIZE}px monospace`;

        // Update and draw drops
        dropsRef.current.forEach((drop) => {
          drop.y += drop.speed;

          // Draw characters
          for (let i = 0; i < drop.length; i++) {
            const y = drop.y - i * FONT_SIZE;
            if (y < 0 || y > h) continue;

            const alpha = 1 - i / drop.length;
            if (i === 0) {
              ctx.fillStyle = "#fff";
            } else {
              ctx.fillStyle = `rgba(0, 255, 70, ${alpha})`;
            }

            // Randomly change characters
            if (Math.random() < 0.02) {
              drop.chars[i] = CHARS[Math.floor(Math.random() * CHARS.length)];
            }

            ctx.fillText(drop.chars[i % drop.chars.length], drop.x, y);
          }

          // Reset when off screen
          if (drop.y - drop.length * FONT_SIZE > h) {
            drop.y = Math.random() * -200;
            drop.speed = 3 + Math.random() * 5;
            drop.length = 10 + Math.floor(Math.random() * 20);
          }
        });
      },
    });

    return () => {
      compositor.unregister(SOURCE_ID);
    };
  }, [compositor]);
}
