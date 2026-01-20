import type {
  AudioConfig,
  DaydreamError,
  ReconnectConfig,
  ReconnectInfo,
  VideoConfig,
} from "./common";

export type BroadcastState =
  | "connecting"
  | "live"
  | "reconnecting"
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

export interface BroadcastEventMap {
  stateChange: (state: BroadcastState) => void;
  error: (error: DaydreamError) => void;
  reconnect: (info: ReconnectInfo) => void;
}
