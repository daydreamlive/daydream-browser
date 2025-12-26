import { createBroadcast, createPlayer } from "@daydreamlive/browser";
import {
  useBroadcast as baseUseBroadcast,
  type UseBroadcastOptions,
  type UseBroadcastReturn,
} from "./useBroadcast";
import {
  usePlayer as baseUsePlayer,
  type UsePlayerOptions,
  type UsePlayerReturn,
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
  UsePlayerOptions,
  UsePlayerReturn,
};
