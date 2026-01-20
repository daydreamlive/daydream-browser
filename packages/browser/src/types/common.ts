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
