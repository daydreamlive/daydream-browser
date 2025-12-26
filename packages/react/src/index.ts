import { createBroadcast, createPlayer } from "@daydreamlive/browser";
import {
  useBroadcast as baseUseBroadcast,
  usePlayer as baseUsePlayer,
  type UseBroadcastOptions,
  type UseBroadcastReturn,
  type UsePlayerOptions,
  type UsePlayerReturn,
} from "./core";

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
