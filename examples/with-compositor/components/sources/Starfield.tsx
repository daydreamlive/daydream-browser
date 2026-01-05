"use client";

import { useEffect, useRef } from "react";
import { useSource } from "@daydreamlive/react";

interface Star {
  x: number;
  y: number;
  z: number;
  pz: number;
}

export const SOURCE_ID = "starfield";

export function useStarfieldSource() {
  const { ref } = useSource<HTMLCanvasElement>(SOURCE_ID, { kind: "canvas" });
  const starsRef = useRef<Star[]>([]);
  const initializedRef = useRef(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animate = (timestamp: number) => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const t = timestamp * 0.001;

      // Initialize stars
      if (!initializedRef.current) {
        initializedRef.current = true;
        starsRef.current = Array.from({ length: 800 }, () => ({
          x: (Math.random() - 0.5) * w * 2,
          y: (Math.random() - 0.5) * h * 2,
          z: Math.random() * w,
          pz: 0,
        }));
      }

      // Dark background with slight fade for trails
      ctx.fillStyle = "rgba(0, 0, 10, 0.2)";
      ctx.fillRect(0, 0, w, h);

      const speed = 10 + Math.sin(t * 0.5) * 5;

      starsRef.current.forEach((star) => {
        // Store previous z for trail
        star.pz = star.z;

        // Move star towards viewer
        star.z -= speed;

        // Reset if too close
        if (star.z < 1) {
          star.x = (Math.random() - 0.5) * w * 2;
          star.y = (Math.random() - 0.5) * h * 2;
          star.z = w;
          star.pz = w;
        }

        // Project to 2D
        const sx = (star.x / star.z) * w + cx;
        const sy = (star.y / star.z) * h + cy;
        const px = (star.x / star.pz) * w + cx;
        const py = (star.y / star.pz) * h + cy;

        // Size based on depth
        const size = Math.max(1, (1 - star.z / w) * 6);

        // Brightness based on depth
        const brightness = 1 - star.z / w;
        const hue = (star.z * 0.5 + t * 50) % 360;

        // Draw trail
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.strokeStyle = `hsla(${hue}, 60%, ${50 + brightness * 40}%, ${
          brightness * 0.8
        })`;
        ctx.lineWidth = size;
        ctx.stroke();

        // Draw star point
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(0, 0%, ${70 + brightness * 30}%)`;
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
