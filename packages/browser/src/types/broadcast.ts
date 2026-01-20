import type {
  AudioConfig,
  DaydreamError,
  ReconnectConfig,
  ReconnectInfo,
  VideoConfig,
} from "./common";

/**
 * Possible states of a broadcast session.
 * - `connecting`: Initial connection in progress
 * - `live`: Successfully connected and streaming
 * - `reconnecting`: Connection lost, attempting to reconnect
 * - `ended`: Broadcast has been stopped
 * - `error`: An error occurred during connection
 */
export type BroadcastState =
  | "connecting"
  | "live"
  | "reconnecting"
  | "ended"
  | "error";

/**
 * Result extracted from a WHIP response.
 */
export interface WHIPResponseResult {
  /** The WHEP playback URL for viewers to connect to this broadcast. */
  whepUrl?: string;
}

/**
 * Options for creating a broadcast session.
 *
 * @example
 * ```ts
 * const broadcast = createBroadcast({
 *   whipUrl: "https://livepeer.studio/webrtc/...",
 *   stream: await navigator.mediaDevices.getUserMedia({ video: true, audio: true }),
 *   video: { bitrate: 1_000_000 },
 * });
 * ```
 */
export interface BroadcastOptions {
  /** WHIP endpoint URL for publishing the stream. */
  whipUrl: string;
  /** MediaStream to broadcast (typically from getUserMedia or canvas). */
  stream: MediaStream;
  /** Reconnection behavior configuration. */
  reconnect?: ReconnectConfig;
  /** Video encoding settings. */
  video?: VideoConfig;
  /** Audio encoding settings. */
  audio?: AudioConfig;
  /** Custom ICE servers for WebRTC connection. */
  iceServers?: RTCIceServer[];
  /** Timeout in milliseconds for the initial connection. */
  connectionTimeout?: number;
  /** Callback invoked periodically with WebRTC stats. */
  onStats?: (report: RTCStatsReport) => void;
  /** Interval in milliseconds for stats collection. */
  statsIntervalMs?: number;
  /** Callback to extract data from the WHIP response (e.g., playback URL). */
  onResponse?: (response: Response) => WHIPResponseResult | void;
}

/**
 * Event map for Broadcast class events.
 * Use with `broadcast.on(event, callback)`.
 */
export interface BroadcastEventMap {
  /** Emitted when the broadcast state changes. */
  stateChange: (state: BroadcastState) => void;
  /** Emitted when an error occurs. */
  error: (error: DaydreamError) => void;
  /** Emitted when a reconnection attempt starts. */
  reconnect: (info: ReconnectInfo) => void;
}
