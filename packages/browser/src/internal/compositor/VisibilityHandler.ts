export interface VisibilityHandlerOptions {
  onHidden: () => void;
  onVisible: () => void;
  backgroundRenderFn: () => void;
}

export interface VisibilityHandler {
  start(): void;
  stop(): void;
  readonly isHidden: boolean;
}

export function createVisibilityHandler(
  options: VisibilityHandlerOptions,
): VisibilityHandler {
  let isHidden = false;
  let backgroundIntervalId: number | null = null;
  let visibilityListener: (() => void) | null = null;
  let started = false;

  function onVisibilityChange(): void {
    if (typeof document === "undefined") return;

    const hidden = document.visibilityState === "hidden";

    if (hidden && !isHidden) {
      isHidden = true;
      options.onHidden();

      // Start background interval rendering
      if (backgroundIntervalId == null) {
        backgroundIntervalId = setInterval(() => {
          options.backgroundRenderFn();
        }, 1000) as unknown as number;
      }
    } else if (!hidden && isHidden) {
      isHidden = false;

      // Stop background interval
      if (backgroundIntervalId != null) {
        clearInterval(backgroundIntervalId);
        backgroundIntervalId = null;
      }

      options.onVisible();
    }
  }

  return {
    get isHidden(): boolean {
      return isHidden;
    },

    start(): void {
      if (started) return;
      if (typeof document === "undefined") return;

      started = true;
      visibilityListener = onVisibilityChange;
      document.addEventListener("visibilitychange", visibilityListener);

      // Check initial state
      onVisibilityChange();
    },

    stop(): void {
      if (!started) return;
      started = false;

      if (typeof document !== "undefined" && visibilityListener) {
        try {
          document.removeEventListener("visibilitychange", visibilityListener);
        } catch {
          // Failed to remove visibility listener
        }
        visibilityListener = null;
      }

      if (backgroundIntervalId != null) {
        clearInterval(backgroundIntervalId);
        backgroundIntervalId = null;
      }

      isHidden = false;
    },
  };
}
