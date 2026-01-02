import type { Ctx2D, FitMode, Size, Source } from "../../types";

export interface RendererOptions {
  width: number;
  height: number;
  dpr: number;
  crossfadeMs: number;
  keepalive: boolean;
}

export interface Renderer {
  readonly captureCanvas: HTMLCanvasElement;
  readonly offscreenCtx: Ctx2D;
  readonly size: Size;

  setActiveSource(source: Source | null): (() => void) | void;
  renderFrame(timestamp: number): void;
  resize(width: number, height: number, dpr: number): void;
  setCrossfadeMs(ms: number): void;
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
  let crossfadeMs = options.crossfadeMs;
  let keepalive = options.keepalive;

  // Canvases
  let captureCanvas: HTMLCanvasElement | null = null;
  let captureCtx: Ctx2D | null = null;
  let offscreen: OffscreenCanvas | HTMLCanvasElement | null = null;
  let offscreenCtx: Ctx2D | null = null;
  // Secondary canvas for crossfade blending (custom sources)
  let crossfadeCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
  let crossfadeCtx: Ctx2D | null = null;

  // Source state
  let currentSource: Source | null = null;
  let pendingSource: Source | null = null;
  let crossfadeStart: number | null = null;
  let cleanupFn: (() => void) | void = undefined;

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

    // Create crossfade canvas for blending custom sources
    try {
      const cfCanvas = new OffscreenCanvas(pxW, pxH);
      crossfadeCanvas = cfCanvas;
      const cfCtx = cfCanvas.getContext("2d", { alpha: true }) as Ctx2D | null;
      if (cfCtx) {
        cfCtx.imageSmoothingEnabled = true;
        crossfadeCtx = cfCtx;
      }
    } catch {
      const cfCanvas = document.createElement("canvas");
      cfCanvas.width = pxW;
      cfCanvas.height = pxH;
      const cfCtx = cfCanvas.getContext("2d", { alpha: true }) as Ctx2D | null;
      if (cfCtx) {
        cfCtx.imageSmoothingEnabled = true;
        crossfadeCanvas = cfCanvas;
        crossfadeCtx = cfCtx;
      }
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
    if (source.kind === "canvas") {
      const c = source.element;
      return (c.width || 0) > 0 && (c.height || 0) > 0;
    }
    return true; // custom sources are always ready
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

  function blitSource(source: Source, alpha: number, timestamp: number): void {
    if (!offscreenCtx) return;
    const ctx = offscreenCtx;

    if (source.kind === "custom") {
      // For custom sources during crossfade, render to secondary canvas then blend
      if (alpha < 1 && crossfadeCtx && crossfadeCanvas) {
        // Clear crossfade canvas
        crossfadeCtx.clearRect(
          0,
          0,
          crossfadeCtx.canvas.width,
          crossfadeCtx.canvas.height,
        );
        // Render custom source to crossfade canvas
        if (source.onFrame) source.onFrame(crossfadeCtx, timestamp);
        // Blend onto main canvas with alpha
        const prev = ctx.globalAlpha;
        try {
          ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
          ctx.drawImage(crossfadeCanvas as CanvasImageSource, 0, 0);
        } finally {
          ctx.globalAlpha = prev;
        }
      } else {
        // Full opacity - render directly
        if (source.onFrame) source.onFrame(ctx, timestamp);
      }
      return;
    }

    const el = source.element;
    const rect = getDrawRect(el, source.fit ?? "contain");
    if (!rect) return;

    const prev = ctx.globalAlpha;
    try {
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.drawImage(
        el as CanvasImageSource,
        rect.dx,
        rect.dy,
        rect.dw,
        rect.dh,
      );
    } finally {
      ctx.globalAlpha = prev;
    }
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

    setActiveSource(source: Source | null): (() => void) | void {
      // Cleanup previous custom source
      if (cleanupFn) {
        cleanupFn();
        cleanupFn = undefined;
      }

      if (source === null) {
        currentSource = null;
        pendingSource = null;
        crossfadeStart = null;
        return;
      }

      pendingSource = source;
      crossfadeStart = null;

      // Initialize custom source
      if (source.kind === "custom" && source.onStart) {
        const cleanup = source.onStart(offscreenCtx!);
        cleanupFn = cleanup || undefined;
        return cleanupFn;
      }
    },

    renderFrame(timestamp: number): void {
      const off = offscreenCtx;
      const cap = captureCtx;
      const capCanvas = captureCanvas;
      if (!off || !cap || !capCanvas) return;

      // Check if pending source is ready to start crossfade
      if (pendingSource && isSourceReady(pendingSource)) {
        if (crossfadeStart === null) crossfadeStart = timestamp;
      }

      off.globalCompositeOperation = "source-over";

      const willDraw = !!(
        (pendingSource && isSourceReady(pendingSource)) ||
        currentSource
      );

      if (willDraw) {
        off.fillStyle = "#000";
        off.fillRect(0, 0, off.canvas.width, off.canvas.height);
      }

      // Handle crossfade
      const fading = pendingSource && crossfadeStart !== null && currentSource;
      if (fading) {
        const t = Math.min(1, (timestamp - crossfadeStart!) / crossfadeMs);
        blitSource(currentSource!, 1 - t, timestamp);
        blitSource(pendingSource!, t, timestamp);

        if (t >= 1) {
          currentSource = pendingSource;
          pendingSource = null;
          crossfadeStart = null;
        }
      } else if (pendingSource && !currentSource) {
        if (isSourceReady(pendingSource)) {
          blitSource(pendingSource, 1, timestamp);
          currentSource = pendingSource;
          pendingSource = null;
          crossfadeStart = null;
        }
      } else if (currentSource) {
        blitSource(currentSource, 1, timestamp);
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

      if (crossfadeCanvas instanceof HTMLCanvasElement) {
        crossfadeCanvas.width = pxW;
        crossfadeCanvas.height = pxH;
      } else if (crossfadeCanvas instanceof OffscreenCanvas) {
        crossfadeCanvas.width = pxW;
        crossfadeCanvas.height = pxH;
      }

      rectCache = new WeakMap();
    },

    setCrossfadeMs(ms: number): void {
      crossfadeMs = Math.max(0, ms);
    },

    setKeepalive(enabled: boolean): void {
      keepalive = enabled;
    },

    destroy(): void {
      if (cleanupFn) {
        cleanupFn();
        cleanupFn = undefined;
      }
      currentSource = null;
      pendingSource = null;
      captureCanvas = null;
      captureCtx = null;
      offscreen = null;
      offscreenCtx = null;
      crossfadeCanvas = null;
      crossfadeCtx = null;
    },
  };
}
