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

export interface BroadcastOptions {
  whipUrl: string;
  stream: MediaStream;
  reconnect?: ReconnectConfig;
  video?: VideoConfig;
  onStats?: (report: RTCStatsReport) => void;
  statsIntervalMs?: number;
}

export interface PlayerOptions {
  reconnect?: ReconnectConfig;
  onStats?: (report: RTCStatsReport) => void;
  statsIntervalMs?: number;
}

export interface ReconnectConfig {
  enabled?: boolean;
  maxAttempts?: number;
  baseDelayMs?: number;
}

export interface VideoConfig {
  bitrate?: number;
  maxFramerate?: number;
}

export interface BroadcastEventMap {
  stateChange: (state: BroadcastState) => void;
  error: (error: DaydreamError) => void;
}

export interface PlayerEventMap {
  stateChange: (state: PlayerState) => void;
  error: (error: DaydreamError) => void;
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

export const DEFAULT_VIDEO_BITRATE = 2_000_000;
export const DEFAULT_AUDIO_BITRATE = 64_000;
