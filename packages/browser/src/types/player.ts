import type { DaydreamError, ReconnectConfig, ReconnectInfo } from "./common";

/**
 * Possible states of a player session.
 * - `connecting`: Initial connection in progress
 * - `playing`: Successfully connected and receiving stream
 * - `buffering`: Connection interrupted, attempting to reconnect
 * - `ended`: Playback has been stopped
 * - `error`: An error occurred during connection
 */
export type PlayerState =
  | "connecting"
  | "playing"
  | "buffering"
  | "ended"
  | "error";

/**
 * Options for creating a player session.
 *
 * @example
 * ```ts
 * const player = createPlayer("https://livepeer.studio/webrtc/...", {
 *   reconnect: { maxAttempts: 10 },
 * });
 * ```
 */
export interface PlayerOptions {
  /** Reconnection behavior configuration. */
  reconnect?: ReconnectConfig;
  /** Custom ICE servers for WebRTC connection. */
  iceServers?: RTCIceServer[];
  /** Timeout in milliseconds for the initial connection. */
  connectionTimeout?: number;
  /** Skip ICE gathering to speed up connection (may not work with all servers). */
  skipIceGathering?: boolean;
  /** Callback invoked periodically with WebRTC stats. */
  onStats?: (report: RTCStatsReport) => void;
  /** Interval in milliseconds for stats collection. */
  statsIntervalMs?: number;
}

/**
 * Event map for Player class events.
 * Use with `player.on(event, callback)`.
 */
export interface PlayerEventMap {
  /** Emitted when the player state changes. */
  stateChange: (state: PlayerState) => void;
  /** Emitted when an error occurs. */
  error: (error: DaydreamError) => void;
  /** Emitted when a reconnection attempt starts. */
  reconnect: (info: ReconnectInfo) => void;
}
