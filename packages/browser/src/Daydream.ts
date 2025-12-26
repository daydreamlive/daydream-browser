import type { BroadcastOptions, PlayerOptions } from "./types";
import { Broadcast } from "./Broadcast";
import { Player } from "./Player";

export function createBroadcast(options: BroadcastOptions): Broadcast {
  const { whipUrl, stream, reconnect, video, onStats, statsIntervalMs } =
    options;

  return new Broadcast({
    whipUrl,
    stream,
    reconnect,
    whipConfig: {
      videoBitrate: video?.bitrate,
      maxFramerate: video?.maxFramerate,
      onStats,
      statsIntervalMs,
    },
  });
}

export function createPlayer(whepUrl: string, options?: PlayerOptions): Player {
  return new Player({
    whepUrl,
    reconnect: options?.reconnect,
    whepConfig: {
      onStats: options?.onStats,
      statsIntervalMs: options?.statsIntervalMs,
    },
  });
}
