"use client";

import { useEffect, useRef } from "react";
import { useSource } from "@daydreamlive/react";

interface VoronoiPoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hue: number;
}

export const SOURCE_ID = "voronoi";

export function useVoronoiSource() {
  const { ref } = useSource<HTMLCanvasElement>(SOURCE_ID, { kind: "canvas" });
  const pointsRef = useRef<VoronoiPoint[]>([]);
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

      // Initialize points
      if (!initializedRef.current) {
        initializedRef.current = true;
        pointsRef.current = Array.from({ length: 20 }, (_, i) => ({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          hue: (i * 18) % 360,
        }));
      }

      // Update points
      pointsRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        p.x = Math.max(0, Math.min(w, p.x));
        p.y = Math.max(0, Math.min(h, p.y));
        p.hue = (p.hue + 0.2) % 360;
      });

      // Draw Voronoi using pixel sampling (simplified)
      const imageData = ctx.createImageData(w, h);
      const data = imageData.data;
      const step = 4; // Sample every 4 pixels for performance

      for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
          let minDist = Infinity;
          let closestPoint = pointsRef.current[0];

          // Find closest point
          for (const p of pointsRef.current) {
            const dx = x - p.x;
            const dy = y - p.y;
            const dist = dx * dx + dy * dy;
            if (dist < minDist) {
              minDist = dist;
              closestPoint = p;
            }
          }

          // Color based on closest point
          const hue = closestPoint.hue;
          const dist = Math.sqrt(minDist);
          const lightness = Math.max(20, 60 - dist * 0.15);

          // HSL to RGB conversion
          const c = (1 - Math.abs((2 * lightness) / 100 - 1)) * 0.8;
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

      // Draw cell centers
      pointsRef.current.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
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
