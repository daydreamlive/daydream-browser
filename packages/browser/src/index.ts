import type { BroadcastOptions, WHIPResponseResult } from "./types";
import { Broadcast, createBroadcast as baseCreateBroadcast } from "./Broadcast";
import { Player, createPlayer as baseCreatePlayer } from "./Player";
import type { PlayerOptions } from "./types";

export const livepeerResponseHandler = (
  response: Response,
): WHIPResponseResult => ({
  whepUrl: response.headers.get("livepeer-playback-url") ?? undefined,
});

export type LivepeerBroadcastOptions = Omit<BroadcastOptions, "onResponse">;

export function createBroadcast(options: LivepeerBroadcastOptions): Broadcast {
  return baseCreateBroadcast({
    ...options,
    onResponse: livepeerResponseHandler,
  });
}

export function createPlayer(whepUrl: string, options?: PlayerOptions): Player {
  return baseCreatePlayer(whepUrl, options);
}

export {
  BaseDaydreamError,
  NetworkError,
  ConnectionError,
  StreamNotFoundError,
  UnauthorizedError,
} from "./errors";

export type {
  BroadcastOptions,
  PlayerOptions,
  BroadcastState,
  PlayerState,
  ReconnectConfig,
  VideoConfig,
  BroadcastEventMap,
  PlayerEventMap,
  DaydreamError,
  DaydreamErrorCode,
  WHIPResponseResult,
} from "./types";

export {
  DEFAULT_ICE_SERVERS,
  DEFAULT_VIDEO_BITRATE,
  DEFAULT_AUDIO_BITRATE,
} from "./types";

export { Broadcast, type BroadcastConfig } from "./Broadcast";
export { Player, type PlayerConfig } from "./Player";
