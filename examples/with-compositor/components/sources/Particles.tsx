"use client";

import { useEffect, useRef } from "react";
import { useSource } from "@daydreamlive/react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
}

export const SOURCE_ID = "particles";

export function useParticlesSource() {
  const { ref } = useSource<HTMLCanvasElement>(SOURCE_ID, { kind: "canvas" });
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 256, y: 256 });
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
      const t = timestamp * 0.001;

      // Fade background
      ctx.fillStyle = "rgba(10, 10, 15, 0.15)";
      ctx.fillRect(0, 0, w, h);

      // Move mouse in a pattern
      mouseRef.current.x = w / 2 + Math.sin(t * 0.8) * 150;
      mouseRef.current.y = h / 2 + Math.cos(t * 1.2) * 150;

      // Spawn new particles
      for (let i = 0; i < 3; i++) {
        particlesRef.current.push({
          x: mouseRef.current.x,
          y: mouseRef.current.y,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4 - 2,
          life: 1,
          maxLife: 60 + Math.random() * 40,
          size: 3 + Math.random() * 5,
          hue: (t * 50 + Math.random() * 60) % 360,
        });
      }

      // Update and draw particles
      particlesRef.current = particlesRef.current.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // gravity
        p.vx *= 0.99;
        p.life -= 1 / p.maxLife;

        if (p.life <= 0) return false;

        const alpha = p.life;
        const size = p.size * p.life;

        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${alpha})`;
        ctx.fill();

        return true;
      });

      // Limit particles
      if (particlesRef.current.length > 500) {
        particlesRef.current = particlesRef.current.slice(-500);
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      particlesRef.current = [];
    };
  }, [ref]);

  return <canvas ref={ref} style={{ display: "none" }} />;
}
