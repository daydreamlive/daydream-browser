"use client";

import { useEffect, useRef } from "react";
import { useCompositor, type Ctx2D } from "@daydreamlive/react";

export const SOURCE_ID = "life";

const CELL_SIZE = 8;

export function useGameOfLifeSource() {
  const compositor = useCompositor();
  const gridRef = useRef<boolean[][]>([]);
  const frameCountRef = useRef(0);
  const gridSizeRef = useRef({ cols: 0, rows: 0 });

  useEffect(() => {
    const countNeighbors = (
      grid: boolean[][],
      x: number,
      y: number,
      cols: number,
      rows: number,
    ) => {
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ny = (y + dy + rows) % rows;
          const nx = (x + dx + cols) % cols;
          if (grid[ny]?.[nx]) count++;
        }
      }
      return count;
    };

    compositor.register(SOURCE_ID, {
      kind: "custom",
      onFrame: (ctx: Ctx2D, timestamp: number) => {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        const t = timestamp * 0.001;

        const cols = Math.floor(w / CELL_SIZE);
        const rows = Math.floor(h / CELL_SIZE);

        // Re-initialize grid if size changed
        if (
          gridSizeRef.current.cols !== cols ||
          gridSizeRef.current.rows !== rows
        ) {
          gridSizeRef.current = { cols, rows };
          gridRef.current = Array.from({ length: rows }, () =>
            Array.from({ length: cols }, () => Math.random() > 0.7),
          );
        }

        ctx.fillStyle = "#0a0a0f";
        ctx.fillRect(0, 0, w, h);

        frameCountRef.current++;

        // Update every 3 frames
        if (frameCountRef.current % 3 === 0) {
          const newGrid = gridRef.current.map((row, y) =>
            row.map((cell, x) => {
              const neighbors = countNeighbors(
                gridRef.current,
                x,
                y,
                cols,
                rows,
              );
              if (cell) {
                return neighbors === 2 || neighbors === 3;
              } else {
                return neighbors === 3;
              }
            }),
          );
          gridRef.current = newGrid;

          // Randomly add some cells to keep it alive
          if (frameCountRef.current % 60 === 0) {
            for (let i = 0; i < 30; i++) {
              const rx = Math.floor(Math.random() * cols);
              const ry = Math.floor(Math.random() * rows);
              if (gridRef.current[ry]) {
                gridRef.current[ry][rx] = true;
              }
            }
          }
        }

        // Draw grid
        gridRef.current.forEach((row, y) => {
          row.forEach((cell, x) => {
            if (cell) {
              const hue = ((x + y) * 5 + t * 30) % 360;
              ctx.fillStyle = `hsl(${hue}, 70%, 55%)`;
              ctx.fillRect(
                x * CELL_SIZE + 1,
                y * CELL_SIZE + 1,
                CELL_SIZE - 2,
                CELL_SIZE - 2,
              );
            }
          });
        });
      },
    });

    return () => {
      compositor.unregister(SOURCE_ID);
    };
  }, [compositor]);
}
