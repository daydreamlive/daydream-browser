export type BroadcasterState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";
export type PlayerState =
  | "idle"
  | "connecting"
  | "connected"
  | "playing"
  | "paused"
  | "ended"
  | "error";

export interface ReconnectConfig {
  enabled: boolean;
  maxAttempts?: number;
  baseDelay?: number;
}

export interface BroadcasterOptions {
  whipUrl: string;
  iceServers?: RTCIceServer[];
  reconnect?: ReconnectConfig;
  videoBitrate?: number;
  audioBitrate?: number;
  maxFramerate?: number;
  onStats?: (report: RTCStatsReport) => void;
  statsIntervalMs?: number;
}

export interface PlayerOptions {
  whepUrl: string;
  videoElement?: HTMLVideoElement;
  autoplay?: boolean;
  iceServers?: RTCIceServer[];
  reconnect?: ReconnectConfig;
  onStats?: (report: RTCStatsReport) => void;
  statsIntervalMs?: number;
}

export interface BroadcasterEvents {
  connecting: () => void;
  connected: (info: { whepUrl: string }) => void;
  disconnected: (reason?: string) => void;
  error: (error: Error) => void;
  reconnecting: (attempt: number) => void;
}

export interface PlayerEvents {
  connecting: () => void;
  connected: () => void;
  playing: () => void;
  paused: () => void;
  error: (error: Error) => void;
  ended: () => void;
  reconnecting: (attempt: number) => void;
}

export interface WHIPClientOptions {
  url: string;
  iceServers?: RTCIceServer[];
  videoBitrate?: number;
  audioBitrate?: number;
  maxFramerate?: number;
  onStats?: (report: RTCStatsReport) => void;
  statsIntervalMs?: number;
}

export interface WHEPClientOptions {
  url: string;
  iceServers?: RTCIceServer[];
  onStats?: (report: RTCStatsReport) => void;
  statsIntervalMs?: number;
}

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

export const DEFAULT_VIDEO_BITRATE = 300000;
export const DEFAULT_AUDIO_BITRATE = 64000;
