export interface SchedulerOptions {
  fps: number;
  sendFps: number;
  onFrame: (timestamp: number) => void;
  onSendFpsChange?: (fps: number) => void;
}

export interface Scheduler {
  start(videoElement?: HTMLVideoElement): void;
  stop(): void;
  setFps(fps: number): void;
  setSendFps(fps: number): void;
  readonly isRunning: boolean;
  readonly fps: number;
  readonly sendFps: number;
}

export function createScheduler(options: SchedulerOptions): Scheduler {
  let fps = Math.max(1, options.fps);
  let sendFps = Math.max(1, options.sendFps);
  const onFrame = options.onFrame;
  const onSendFpsChange = options.onSendFpsChange;

  let isRunning = false;
  let lastFrameAt = 0;

  // RAF scheduling
  let rafId: number | null = null;
  let rafFallbackActive = false;

  // Video frame callback scheduling
  let videoFrameRequestId: number | null = null;
  let videoFrameSource: HTMLVideoElement | null = null;

  function getTimestamp(): number {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
  }

  function shouldRenderFrame(): boolean {
    const now = getTimestamp();
    const minIntervalMs = 1000 / Math.max(1, sendFps);
    if (lastFrameAt !== 0 && now - lastFrameAt < minIntervalMs) {
      return false;
    }
    return true;
  }

  function renderIfNeeded(): void {
    if (!shouldRenderFrame()) return;
    const timestamp = getTimestamp();
    onFrame(timestamp);
    lastFrameAt = timestamp;
  }

  function scheduleWithRaf(isFallback: boolean): void {
    if (isFallback) {
      if (rafFallbackActive) return;
      rafFallbackActive = true;
    }

    const loop = (): void => {
      renderIfNeeded();
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
  }

  function scheduleWithVideoFrame(videoEl: HTMLVideoElement): void {
    if (typeof videoEl.requestVideoFrameCallback !== "function") {
      scheduleWithRaf(false);
      return;
    }

    videoFrameSource = videoEl;

    const cb = (): void => {
      renderIfNeeded();
      if (videoFrameSource === videoEl) {
        try {
          videoFrameRequestId = videoEl.requestVideoFrameCallback(cb);
        } catch {
          // Failed to request video frame callback
        }
      }
    };

    try {
      videoFrameRequestId = videoEl.requestVideoFrameCallback(cb);
    } catch {
      // Failed to start video frame callback
    }

    // Also schedule RAF as fallback for non-video frames
    scheduleWithRaf(true);
  }

  function cancelSchedulers(): void {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    rafFallbackActive = false;

    if (videoFrameRequestId && videoFrameSource) {
      try {
        if (typeof videoFrameSource.cancelVideoFrameCallback === "function") {
          videoFrameSource.cancelVideoFrameCallback(videoFrameRequestId);
        }
      } catch {
        // Failed to cancel video frame callback
      }
    }
    videoFrameRequestId = null;
    videoFrameSource = null;
  }

  return {
    get isRunning(): boolean {
      return isRunning;
    },

    get fps(): number {
      return fps;
    },

    get sendFps(): number {
      return sendFps;
    },

    start(videoElement?: HTMLVideoElement): void {
      if (isRunning) {
        cancelSchedulers();
      }

      isRunning = true;
      lastFrameAt = 0;

      if (
        videoElement &&
        typeof videoElement.requestVideoFrameCallback === "function"
      ) {
        scheduleWithVideoFrame(videoElement);
      } else {
        scheduleWithRaf(false);
      }
    },

    stop(): void {
      isRunning = false;
      cancelSchedulers();
    },

    setFps(newFps: number): void {
      fps = Math.max(1, newFps);
    },

    setSendFps(newSendFps: number): void {
      const next = Math.max(1, newSendFps);
      if (sendFps === next) return;
      sendFps = next;
      onSendFpsChange?.(sendFps);
    },
  };
}
