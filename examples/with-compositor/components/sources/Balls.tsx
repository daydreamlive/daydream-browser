"use client";

import { useEffect, useRef } from "react";
import { useSource } from "@daydreamlive/react";

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

export const SOURCE_ID = "balls";

export function useBallsSource() {
  const { ref } = useSource<HTMLCanvasElement>(SOURCE_ID, { kind: "canvas" });
  const ballsRef = useRef<Ball[]>([]);
  const initializedRef = useRef(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animate = () => {
      const w = canvas.width;
      const h = canvas.height;

      // Initialize balls on first frame
      if (!initializedRef.current) {
        initializedRef.current = true;
        ballsRef.current = Array.from({ length: 12 }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 8,
          radius: 20 + Math.random() * 30,
          color: `hsl(${Math.random() * 360}, 70%, 60%)`,
        }));
      }

      ctx.fillStyle = "#111827";
      ctx.fillRect(0, 0, w, h);

      ballsRef.current.forEach((ball) => {
        ball.x += ball.vx;
        ball.y += ball.vy;

        if (ball.x < ball.radius || ball.x > w - ball.radius) {
          ball.vx *= -1;
          ball.x = Math.max(ball.radius, Math.min(w - ball.radius, ball.x));
        }
        if (ball.y < ball.radius || ball.y > h - ball.radius) {
          ball.vy *= -1;
          ball.y = Math.max(ball.radius, Math.min(h - ball.radius, ball.y));
        }

        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = ball.color;
        ctx.fill();
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [ref]);

  return <canvas ref={ref} style={{ display: "none" }} />;
}
