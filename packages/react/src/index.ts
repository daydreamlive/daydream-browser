/**
 * @daydreamlive/react - React hooks and components for WebRTC broadcasting and playback.
 *
 * @example
 * ```tsx
 * import { useBroadcast, usePlayer, CompositorProvider, useCompositor, useSource } from "@daydreamlive/react";
 *
 * // Broadcasting
 * const { status, start, stop } = useBroadcast({ whipUrl: "..." });
 *
 * // Playback
 * const { status, play, videoRef } = usePlayer({ whepUrl: "..." });
 *
 * // Compositor with React
 * <CompositorProvider width={1280} height={720}>
 *   <SourceComponent />
 * </CompositorProvider>
 * ```
 *
 * @packageDocumentation
 */

import { createBroadcast, createPlayer } from "@daydreamlive/browser";
import {
  useBroadcast as baseUseBroadcast,
  type UseBroadcastOptions,
  type UseBroadcastReturn,
  type UseBroadcastStatus,
} from "./useBroadcast";
import {
  usePlayer as baseUsePlayer,
  type UsePlayerOptions,
  type UsePlayerReturn,
  type UsePlayerStatus,
} from "./usePlayer";

/**
 * React hook for managing a WebRTC broadcast session.
 *
 * @param options - Broadcast configuration including WHIP URL
 * @returns Broadcast status and control functions
 *
 * @example
 * ```tsx
 * function BroadcastComponent() {
 *   const { status, start, stop } = useBroadcast({
 *     whipUrl: "https://livepeer.studio/webrtc/...",
 *   });
 *
 *   const handleStart = async () => {
 *     const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
 *     await start(stream);
 *   };
 *
 *   return (
 *     <div>
 *       <p>Status: {status.state}</p>
 *       {status.state === "live" && <p>Playback URL: {status.whepUrl}</p>}
 *       <button onClick={status.state === "idle" ? handleStart : stop}>
 *         {status.state === "idle" ? "Start" : "Stop"}
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useBroadcast(options: UseBroadcastOptions): UseBroadcastReturn {
  return baseUseBroadcast(options, createBroadcast);
}

/**
 * React hook for managing a WebRTC playback session.
 *
 * @param options - Player configuration including WHEP URL
 * @returns Player status, control functions, and video element ref
 *
 * @example
 * ```tsx
 * function PlayerComponent({ whepUrl }) {
 *   const { status, play, stop, videoRef } = usePlayer({
 *     whepUrl,
 *     autoPlay: true,
 *   });
 *
 *   useEffect(() => {
 *     if (whepUrl) play();
 *   }, [whepUrl, play]);
 *
 *   return (
 *     <div>
 *       <video ref={videoRef} autoPlay muted playsInline />
 *       <p>Status: {status.state}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function usePlayer(options: UsePlayerOptions): UsePlayerReturn {
  return baseUsePlayer(options, createPlayer);
}

export type {
  UseBroadcastOptions,
  UseBroadcastReturn,
  UseBroadcastStatus,
  UsePlayerOptions,
  UsePlayerReturn,
  UsePlayerStatus,
};

export {
  BaseDaydreamError,
  NetworkError,
  ConnectionError,
  StreamNotFoundError,
  UnauthorizedError,
} from "@daydreamlive/browser";

export {
  DEFAULT_ICE_SERVERS,
  DEFAULT_VIDEO_BITRATE,
  DEFAULT_AUDIO_BITRATE,
} from "@daydreamlive/browser";

export {
  createCompositor,
  livepeerResponseHandler,
  Broadcast,
  Player,
} from "@daydreamlive/browser";

export type {
  AudioConfig,
  BroadcastState,
  BroadcastOptions,
  BroadcastConfig,
  BroadcastEventMap,
  LivepeerBroadcastOptions,
  VideoConfig,
  WHIPResponseResult,
  PlayerState,
  PlayerOptions,
  PlayerConfig,
  PlayerEventMap,
  ReconnectConfig,
  ReconnectInfo,
  DaydreamError,
  DaydreamErrorCode,
  // Compositor types
  Compositor,
  CompositorOptions,
  CompositorEvent,
  CompositorEventMap,
  Source,
  VideoSource,
  CanvasSource,
  Size,
  FitMode,
  ContentHint,
  Ctx2D,
} from "@daydreamlive/browser";

export {
  CompositorProvider,
  useCompositor,
  type CompositorApi,
  type CompositorProviderProps,
} from "./useCompositor";

export {
  useSource,
  type UseSourceOptions,
  type UseSourceReturn,
} from "./useSource";
