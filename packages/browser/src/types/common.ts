/**
 * Configuration for automatic reconnection behavior.
 */
export interface ReconnectConfig {
  /** Whether automatic reconnection is enabled. Defaults to `true`. */
  enabled?: boolean;
  /** Maximum number of reconnection attempts before giving up. */
  maxAttempts?: number;
  /** Base delay in milliseconds between reconnection attempts. Used for exponential backoff. */
  baseDelayMs?: number;
}

/**
 * Information about the current reconnection attempt.
 * Emitted with the `reconnect` event.
 */
export interface ReconnectInfo {
  /** Current attempt number (1-indexed). */
  attempt: number;
  /** Maximum number of attempts before giving up. */
  maxAttempts: number;
  /** Delay in milliseconds before this reconnection attempt. */
  delayMs: number;
}

/**
 * Video encoding configuration.
 */
export interface VideoConfig {
  /** Target video bitrate in bits per second. Defaults to 300,000 (300 kbps). */
  bitrate?: number;
  /** Maximum frame rate for the video track. */
  maxFramerate?: number;
}

/**
 * Audio encoding configuration.
 */
export interface AudioConfig {
  /** Target audio bitrate in bits per second. Defaults to 64,000 (64 kbps). */
  bitrate?: number;
}

/**
 * Error interface for all Daydream SDK errors.
 * Extends the standard Error with a code and optional cause.
 */
export interface DaydreamError extends Error {
  /** Error code identifying the type of error. */
  code: DaydreamErrorCode;
  /** The underlying cause of the error, if any. */
  cause?: unknown;
}

/**
 * Error codes for Daydream SDK errors.
 * - `NETWORK_ERROR`: Network-related failure (e.g., fetch failed)
 * - `CONNECTION_FAILED`: WebRTC connection failed to establish
 * - `STREAM_NOT_FOUND`: The requested stream does not exist
 * - `UNAUTHORIZED`: Authentication or authorization failed
 * - `UNKNOWN`: An unexpected error occurred
 */
export type DaydreamErrorCode =
  | "NETWORK_ERROR"
  | "CONNECTION_FAILED"
  | "STREAM_NOT_FOUND"
  | "UNAUTHORIZED"
  | "UNKNOWN";

/**
 * Default ICE servers used for WebRTC connections.
 * Includes Google and Cloudflare STUN servers.
 */
export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

/** Default video bitrate in bits per second (300 kbps). */
export const DEFAULT_VIDEO_BITRATE = 300_000;

/** Default audio bitrate in bits per second (64 kbps). */
export const DEFAULT_AUDIO_BITRATE = 64_000;
