import type { BroadcastOptions, WHIPResponseResult } from "./types/broadcast";
import type { PlayerOptions } from "./types/player";
import { Broadcast, createBroadcast as baseCreateBroadcast } from "./Broadcast";
import { Player, createPlayer as baseCreatePlayer } from "./Player";

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
  AudioConfig,
  DaydreamError,
  DaydreamErrorCode,
  ReconnectConfig,
  ReconnectInfo,
  VideoConfig,
  BroadcastEventMap,
  BroadcastOptions,
  BroadcastState,
  WHIPResponseResult,
  PlayerEventMap,
  PlayerOptions,
  PlayerState,
  CanvasSource,
  Compositor,
  CompositorEvent,
  CompositorEventMap,
  CompositorOptions,
  ContentHint,
  Ctx2D,
  FitMode,
  Size,
  Source,
  VideoSource,
} from "./types";

export {
  DEFAULT_AUDIO_BITRATE,
  DEFAULT_ICE_SERVERS,
  DEFAULT_VIDEO_BITRATE,
} from "./types";

export { Broadcast, type BroadcastConfig } from "./Broadcast";
export { Player, type PlayerConfig } from "./Player";
export { createCompositor } from "./Compositor";
