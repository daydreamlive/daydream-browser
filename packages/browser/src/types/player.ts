import type { DaydreamError, ReconnectConfig, ReconnectInfo } from "./common";

export type PlayerState =
  | "connecting"
  | "playing"
  | "buffering"
  | "ended"
  | "error";

export interface PlayerOptions {
  reconnect?: ReconnectConfig;
  iceServers?: RTCIceServer[];
  connectionTimeout?: number;
  skipIceGathering?: boolean;
  onStats?: (report: RTCStatsReport) => void;
  statsIntervalMs?: number;
}

export interface PlayerEventMap {
  stateChange: (state: PlayerState) => void;
  error: (error: DaydreamError) => void;
  reconnect: (info: ReconnectInfo) => void;
}
