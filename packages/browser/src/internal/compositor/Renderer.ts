import type { Ctx2D, FitMode, Size, Source } from "../../types";

export interface RendererOptions {
  width: number;
  height: number;
  dpr: number;
  keepalive: boolean;
}

export interface Renderer {
  readonly captureCanvas: HTMLCanvasElement;
  readonly offscreenCtx: Ctx2D;
  readonly size: Size;

  setActiveSource(source: Source | null): void;
  renderFrame(timestamp: number): void;
  resize(width: number, height: number, dpr: number): void;
  setKeepalive(enabled: boolean): void;
  isSourceReady(source: Source): boolean;
  destroy(): void;
}

type RectCache = {
  canvasW: number;
  canvasH: number;
  sourceW: number;
  sourceH: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  fit: FitMode;
};

export function createRenderer(options: RendererOptions): Renderer {
  let size: Size = {
    width: options.width,
    height: options.height,
    dpr: Math.min(2, options.dpr),
  };
  let keepalive = options.keepalive;

  // Canvases
  let captureCanvas: HTMLCanvasElement | null = null;
  let captureCtx: Ctx2D | null = null;
  let offscreen: OffscreenCanvas | HTMLCanvasElement | null = null;
  let offscreenCtx: Ctx2D | null = null;

  // Source state
  let currentSource: Source | null = null;

  // Rendering state
  let frameIndex = 0;
  let rectCache = new WeakMap<
    HTMLCanvasElement | HTMLVideoElement,
    RectCache
  >();

  function initCanvas(): void {
    const canvas = document.createElement("canvas");
    canvas.style.display = "none";

    const pxW = Math.round(size.width * size.dpr);
    const pxH = Math.round(size.height * size.dpr);
    const outW = Math.round(size.width);
    const outH = Math.round(size.height);

    canvas.width = outW;
    canvas.height = outH;

    const ctx = canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    }) as Ctx2D | null;

    if (!ctx) throw new Error("2D context not available");

    captureCanvas = canvas;
    captureCtx = ctx;

    // Create offscreen canvas for DPR scaling
    try {
      const off = new OffscreenCanvas(pxW, pxH);
      offscreen = off;
      const offCtx = off.getContext("2d", { alpha: false }) as Ctx2D | null;
      if (!offCtx) throw new Error("2D context not available for Offscreen");
      offCtx.imageSmoothingEnabled = true;
      offscreenCtx = offCtx;
    } catch {
      // Fallback to HTMLCanvasElement
      const off = document.createElement("canvas");
      off.width = pxW;
      off.height = pxH;
      const offCtx = off.getContext("2d", { alpha: false }) as Ctx2D | null;
      if (!offCtx)
        throw new Error("2D context not available for Offscreen fallback");
      offCtx.imageSmoothingEnabled = true;
      offscreen = off;
      offscreenCtx = offCtx;
    }

    // Initial fill
    offscreenCtx!.fillStyle = "#111";
    offscreenCtx!.fillRect(0, 0, pxW, pxH);
    captureCtx!.drawImage(
      offscreen as CanvasImageSource,
      0,
      0,
      pxW,
      pxH,
      0,
      0,
      outW,
      outH,
    );
  }

  function isSourceReady(source: Source): boolean {
    if (source.kind === "video") {
      const v = source.element;
      return (
        typeof v.readyState === "number" &&
        v.readyState >= 2 &&
        (v.videoWidth || 0) > 0 &&
        (v.videoHeight || 0) > 0
      );
    }
    // canvas
    const c = source.element;
    return (c.width || 0) > 0 && (c.height || 0) > 0;
  }

  function getDrawRect(
    el: HTMLCanvasElement | HTMLVideoElement,
    fit: FitMode,
  ): { dx: number; dy: number; dw: number; dh: number } | null {
    const canvas = offscreenCtx?.canvas;
    if (!canvas) return null;

    const canvasW = canvas.width;
    const canvasH = canvas.height;
    const sourceW = (el as HTMLVideoElement).videoWidth ?? el.width;
    const sourceH = (el as HTMLVideoElement).videoHeight ?? el.height;

    if (!sourceW || !sourceH) return null;

    const cached = rectCache.get(el);
    if (
      cached &&
      cached.canvasW === canvasW &&
      cached.canvasH === canvasH &&
      cached.sourceW === sourceW &&
      cached.sourceH === sourceH &&
      cached.fit === fit
    ) {
      return { dx: cached.dx, dy: cached.dy, dw: cached.dw, dh: cached.dh };
    }

    const scale =
      fit === "cover"
        ? Math.max(canvasW / sourceW, canvasH / sourceH)
        : Math.min(canvasW / sourceW, canvasH / sourceH);

    const dw = Math.floor(sourceW * scale);
    const dh = Math.floor(sourceH * scale);
    const dx = Math.floor((canvasW - dw) / 2);
    const dy = Math.floor((canvasH - dh) / 2);

    rectCache.set(el, {
      canvasW,
      canvasH,
      sourceW,
      sourceH,
      dx,
      dy,
      dw,
      dh,
      fit,
    });

    return { dx, dy, dw, dh };
  }

  function blitSource(source: Source): void {
    if (!offscreenCtx) return;
    const ctx = offscreenCtx;

    const el = source.element;
    const rect = getDrawRect(el, source.fit ?? "contain");
    if (!rect) return;

    ctx.drawImage(
      el as CanvasImageSource,
      rect.dx,
      rect.dy,
      rect.dw,
      rect.dh,
    );
  }

  // Initialize canvas on creation
  initCanvas();

  return {
    get captureCanvas(): HTMLCanvasElement {
      return captureCanvas!;
    },

    get offscreenCtx(): Ctx2D {
      return offscreenCtx!;
    },

    get size(): Size {
      return { ...size };
    },

    isSourceReady,

    setActiveSource(source: Source | null): void {
      currentSource = source;
    },

    renderFrame(_timestamp: number): void {
      const off = offscreenCtx;
      const cap = captureCtx;
      const capCanvas = captureCanvas;
      if (!off || !cap || !capCanvas) return;

      off.globalCompositeOperation = "source-over";

      if (currentSource && isSourceReady(currentSource)) {
        off.fillStyle = "#000";
        off.fillRect(0, 0, off.canvas.width, off.canvas.height);
        blitSource(currentSource);
      }

      // Keepalive pixel flicker
      if (keepalive) {
        const w = off.canvas.width;
        const h = off.canvas.height;
        const prevAlpha = off.globalAlpha;
        const prevFill = off.fillStyle;
        try {
          off.globalAlpha = 0.08;
          off.fillStyle = frameIndex % 2 ? "#101010" : "#0e0e0e";
          off.fillRect(w - 16, h - 16, 16, 16);
        } finally {
          off.globalAlpha = prevAlpha;
          off.fillStyle = prevFill;
        }
      }

      frameIndex++;

      // Blit offscreen to capture canvas
      cap.drawImage(
        off.canvas,
        0,
        0,
        off.canvas.width,
        off.canvas.height,
        0,
        0,
        capCanvas.width,
        capCanvas.height,
      );
    },

    resize(width: number, height: number, dpr: number): void {
      const nextDpr = Math.min(2, dpr);
      if (
        size.width === width &&
        size.height === height &&
        size.dpr === nextDpr
      ) {
        return;
      }

      size = { width, height, dpr: nextDpr };

      const pxW = Math.round(width * nextDpr);
      const pxH = Math.round(height * nextDpr);
      const outW = Math.round(width);
      const outH = Math.round(height);

      if (captureCanvas) {
        captureCanvas.width = outW;
        captureCanvas.height = outH;
      }

      if (offscreen instanceof HTMLCanvasElement) {
        offscreen.width = pxW;
        offscreen.height = pxH;
      } else if (offscreen instanceof OffscreenCanvas) {
        offscreen.width = pxW;
        offscreen.height = pxH;
      }

      rectCache = new WeakMap();
    },

    setKeepalive(enabled: boolean): void {
      keepalive = enabled;
    },

    destroy(): void {
      currentSource = null;
      captureCanvas = null;
      captureCtx = null;
      offscreen = null;
      offscreenCtx = null;
    },
  };
}
