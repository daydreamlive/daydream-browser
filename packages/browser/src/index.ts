import type { BroadcastOptions, WHIPResponseResult } from "./types/broadcast";
import type { PlayerOptions } from "./types/player";
import { Broadcast, createBroadcast as baseCreateBroadcast } from "./Broadcast";
import { Player, createPlayer as baseCreatePlayer } from "./Player";

/**
 * Response handler for Livepeer WHIP endpoints.
 * Extracts the playback URL from the `livepeer-playback-url` header.
 *
 * @param response - The WHIP response
 * @returns Object containing the WHEP playback URL
 */
export const livepeerResponseHandler = (
  response: Response,
): WHIPResponseResult => ({
  whepUrl: response.headers.get("livepeer-playback-url") ?? undefined,
});

/**
 * Broadcast options for Livepeer, with the response handler pre-configured.
 */
export type LivepeerBroadcastOptions = Omit<BroadcastOptions, "onResponse">;

/**
 * Creates a Broadcast instance configured for Livepeer.
 * Automatically extracts the playback URL from the response.
 *
 * @param options - Broadcast options (without onResponse)
 * @returns A new Broadcast instance
 *
 * @example
 * ```ts
 * const broadcast = createBroadcast({
 *   whipUrl: "https://livepeer.studio/webrtc/...",
 *   stream: mediaStream,
 * });
 *
 * await broadcast.connect();
 * console.log("Playback URL:", broadcast.whepUrl);
 * ```
 */
export function createBroadcast(options: LivepeerBroadcastOptions): Broadcast {
  return baseCreateBroadcast({
    ...options,
    onResponse: livepeerResponseHandler,
  });
}

/**
 * Creates a Player instance for receiving a WebRTC stream.
 *
 * @param whepUrl - WHEP endpoint URL
 * @param options - Optional player configuration
 * @returns A new Player instance
 *
 * @example
 * ```ts
 * const player = createPlayer("https://livepeer.studio/webrtc/...");
 *
 * await player.connect();
 * player.attachTo(videoElement);
 * ```
 */
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
