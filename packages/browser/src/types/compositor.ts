/**
 * 2D rendering context type, supporting both regular canvas and OffscreenCanvas.
 */
export type Ctx2D =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

/**
 * How to fit the source content within the output canvas.
 * - `contain`: Scale to fit entirely within bounds (may have letterboxing)
 * - `cover`: Scale to fill bounds completely (may crop edges)
 */
export type FitMode = "contain" | "cover";

/**
 * Content hint for the video track, indicating the type of content.
 * - `detail`: Optimize for sharp details (e.g., text, screen sharing)
 * - `motion`: Optimize for smooth motion (e.g., video, animation)
 * - `""`: No hint (browser default)
 */
export type ContentHint = "detail" | "motion" | "";

/**
 * A video element source for the compositor.
 */
export type VideoSource = {
  kind: "video";
  /** The HTMLVideoElement to capture frames from. */
  element: HTMLVideoElement;
  /** How to fit the video within the output canvas. */
  fit?: FitMode;
  /** Content hint for encoding optimization. */
  contentHint?: ContentHint;
};

/**
 * A canvas element source for the compositor.
 */
export type CanvasSource = {
  kind: "canvas";
  /** The HTMLCanvasElement to capture frames from. */
  element: HTMLCanvasElement;
  /** How to fit the canvas within the output canvas. */
  fit?: FitMode;
  /** Content hint for encoding optimization. */
  contentHint?: ContentHint;
};

/**
 * A source that can be registered with the compositor.
 * Either a video element or a canvas element.
 */
export type Source = VideoSource | CanvasSource;

/**
 * Size configuration for the compositor output.
 */
export type Size = {
  /** Output width in logical pixels. */
  width: number;
  /** Output height in logical pixels. */
  height: number;
  /** Device pixel ratio for high-DPI rendering. Capped at 2. */
  dpr: number;
};

/**
 * Options for creating a compositor instance.
 *
 * @example
 * ```ts
 * const compositor = createCompositor({
 *   width: 1280,
 *   height: 720,
 *   fps: 30,
 * });
 * ```
 */
export interface CompositorOptions {
  /** Output width in logical pixels. Defaults to 512. */
  width?: number;
  /** Output height in logical pixels. Defaults to 512. */
  height?: number;
  /** Rendering frame rate. Defaults to 30. */
  fps?: number;
  /** Device pixel ratio. Defaults to window.devicePixelRatio, capped at 2. */
  dpr?: number;
  /** Frame rate for sending to the stream (can differ from rendering fps). */
  sendFps?: number;
  /** Continue rendering when the page is hidden. Defaults to true. */
  keepalive?: boolean;
  /** Automatically unlock audio context on user interaction. Defaults to true. */
  autoUnlockAudio?: boolean;
  /** Events that trigger audio unlock. Defaults to ["pointerdown", "click", "touchstart", "keydown"]. */
  unlockEvents?: string[];
  /** Disable silent audio track (used for keeping audio context alive). */
  disableSilentAudio?: boolean;
  /** Callback when sendFps changes (e.g., due to visibility changes). */
  onSendFpsChange?: (fps: number) => void;
}

/**
 * Event names emitted by the compositor.
 */
export type CompositorEvent = "activated" | "registered" | "unregistered";

/**
 * Event map for Compositor class events.
 * Use with `compositor.on(event, callback)`.
 */
export interface CompositorEventMap {
  /** Emitted when a source is activated or deactivated. */
  activated: (id: string | null, source: Source | undefined) => void;
  /** Emitted when a source is registered. */
  registered: (id: string, source: Source) => void;
  /** Emitted when a source is unregistered. */
  unregistered: (id: string) => void;
}

/**
 * Interface for the Compositor class.
 * Manages multiple video/canvas sources and composites them into a single output stream.
 */
export interface Compositor {
  // Source Registry
  /** Register a source with a unique ID. */
  register(id: string, source: Source): void;
  /** Unregister a source by ID. */
  unregister(id: string): void;
  /** Get a registered source by ID. */
  get(id: string): Source | undefined;
  /** Check if a source is registered. */
  has(id: string): boolean;
  /** List all registered sources. */
  list(): Array<{ id: string; source: Source }>;

  // Active source management
  /** Activate a registered source for rendering. */
  activate(id: string): void;
  /** Deactivate the current source. */
  deactivate(): void;
  /** ID of the currently active source, or null if none. */
  readonly activeId: string | null;

  // Output stream
  /** The composited output MediaStream. */
  readonly stream: MediaStream;

  // Settings
  /** Resize the output canvas. */
  resize(width: number, height: number, dpr?: number): void;
  /** Current output size. */
  readonly size: Size;
  /** Set the rendering frame rate. */
  setFps(fps: number): void;
  /** Current rendering frame rate. */
  readonly fps: number;
  /** Set the frame rate for sending to the stream. */
  setSendFps(fps: number): void;
  /** Current send frame rate. */
  readonly sendFps: number;

  // Audio
  /** Add an audio track to the output stream. */
  addAudioTrack(track: MediaStreamTrack): void;
  /** Remove an audio track by track ID. */
  removeAudioTrack(trackId: string): void;
  /** Manually unlock the audio context. Returns true if successful. */
  unlockAudio(): Promise<boolean>;

  // Lifecycle
  /** Destroy the compositor and release all resources. */
  destroy(): void;

  // Events
  /** Subscribe to compositor events. Returns an unsubscribe function. */
  on<E extends CompositorEvent>(
    event: E,
    cb: CompositorEventMap[E],
  ): () => void;
}
