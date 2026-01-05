export type BroadcastState =
  | "connecting"
  | "live"
  | "reconnecting"
  | "ended"
  | "error";

export type PlayerState =
  | "connecting"
  | "playing"
  | "buffering"
  | "ended"
  | "error";

export interface WHIPResponseResult {
  whepUrl?: string;
}

export interface BroadcastOptions {
  whipUrl: string;
  stream: MediaStream;
  reconnect?: ReconnectConfig;
  video?: VideoConfig;
  audio?: AudioConfig;
  iceServers?: RTCIceServer[];
  connectionTimeout?: number;
  onStats?: (report: RTCStatsReport) => void;
  statsIntervalMs?: number;
  onResponse?: (response: Response) => WHIPResponseResult | void;
}

export interface PlayerOptions {
  reconnect?: ReconnectConfig;
  iceServers?: RTCIceServer[];
  connectionTimeout?: number;
  skipIceGathering?: boolean;
  onStats?: (report: RTCStatsReport) => void;
  statsIntervalMs?: number;
}

export interface ReconnectConfig {
  enabled?: boolean;
  maxAttempts?: number;
  baseDelayMs?: number;
}

export interface ReconnectInfo {
  attempt: number;
  maxAttempts: number;
  delayMs: number;
}

export interface VideoConfig {
  bitrate?: number;
  maxFramerate?: number;
}

export interface AudioConfig {
  bitrate?: number;
}

export interface BroadcastEventMap {
  stateChange: (state: BroadcastState) => void;
  error: (error: DaydreamError) => void;
  reconnect: (info: ReconnectInfo) => void;
}

export interface PlayerEventMap {
  stateChange: (state: PlayerState) => void;
  error: (error: DaydreamError) => void;
  reconnect: (info: ReconnectInfo) => void;
}

export interface DaydreamError extends Error {
  code: DaydreamErrorCode;
  cause?: unknown;
}

export type DaydreamErrorCode =
  | "NETWORK_ERROR"
  | "CONNECTION_FAILED"
  | "STREAM_NOT_FOUND"
  | "UNAUTHORIZED"
  | "UNKNOWN";

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

export const DEFAULT_VIDEO_BITRATE = 300_000;
export const DEFAULT_AUDIO_BITRATE = 64_000;

// ============================================================================
// Compositor Types
// ============================================================================

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
