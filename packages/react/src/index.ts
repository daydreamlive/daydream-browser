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

export type {
  AudioConfig,
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
