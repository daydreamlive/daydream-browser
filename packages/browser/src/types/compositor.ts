export type Ctx2D =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

export type FitMode = "contain" | "cover";

export type ContentHint = "detail" | "motion" | "";

export type VideoSource = {
  kind: "video";
  element: HTMLVideoElement;
  fit?: FitMode;
  contentHint?: ContentHint;
};

export type CanvasSource = {
  kind: "canvas";
  element: HTMLCanvasElement;
  fit?: FitMode;
  contentHint?: ContentHint;
};

export type Source = VideoSource | CanvasSource;

export type Size = {
  width: number;
  height: number;
  dpr: number;
};

export interface CompositorOptions {
  width?: number;
  height?: number;
  fps?: number;
  dpr?: number;
  sendFps?: number;
  keepalive?: boolean;
  autoUnlockAudio?: boolean;
  unlockEvents?: string[];
  disableSilentAudio?: boolean;
  onSendFpsChange?: (fps: number) => void;
}

export type CompositorEvent = "activated" | "registered" | "unregistered";

export interface CompositorEventMap {
  activated: (id: string | null, source: Source | undefined) => void;
  registered: (id: string, source: Source) => void;
  unregistered: (id: string) => void;
}

export interface Compositor {
  // Source Registry
  register(id: string, source: Source): void;
  unregister(id: string): void;
  get(id: string): Source | undefined;
  has(id: string): boolean;
  list(): Array<{ id: string; source: Source }>;

  // Active source management
  activate(id: string): void;
  deactivate(): void;
  readonly activeId: string | null;

  // Output stream
  readonly stream: MediaStream;

  // Settings
  resize(width: number, height: number, dpr?: number): void;
  readonly size: Size;
  setFps(fps: number): void;
  readonly fps: number;
  setSendFps(fps: number): void;
  readonly sendFps: number;

  // Audio
  addAudioTrack(track: MediaStreamTrack): void;
  removeAudioTrack(trackId: string): void;
  unlockAudio(): Promise<boolean>;

  // Lifecycle
  destroy(): void;

  // Events
  on<E extends CompositorEvent>(
    event: E,
    cb: CompositorEventMap[E],
  ): () => void;
}
