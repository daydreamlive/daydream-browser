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

export function useBroadcast(options: UseBroadcastOptions): UseBroadcastReturn {
  return baseUseBroadcast(options, createBroadcast);
}

export function usePlayer(
  whepUrl: string | null,
  options?: UsePlayerOptions,
): UsePlayerReturn {
  return baseUsePlayer(whepUrl, options, createPlayer);
}

export type {
  UseBroadcastOptions,
  UseBroadcastReturn,
  UseBroadcastStatus,
  UsePlayerOptions,
  UsePlayerReturn,
  UsePlayerStatus,
};

export type {
  BroadcastState,
  PlayerState,
  ReconnectConfig,
  ReconnectInfo,
  VideoConfig,
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
  CustomSource,
  Size,
  FitMode,
  ContentHint,
} from "@daydreamlive/browser";

export {
  CompositorProvider,
  useCompositor,
  type CompositorApi,
  type CompositorProviderProps,
} from "./useCompositor";
