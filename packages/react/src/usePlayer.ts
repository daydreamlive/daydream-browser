import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type {
  Player,
  PlayerOptions,
  PlayerState,
  DaydreamError,
  ReconnectInfo,
} from "@daydreamlive/browser";

/**
 * Options for the usePlayer hook.
 * Extends PlayerOptions with WHEP URL and autoPlay settings.
 */
export type UsePlayerOptions = PlayerOptions & {
  /** WHEP endpoint URL. Set to null to disable playback. */
  whepUrl: string | null;
  /** Whether to automatically start playback when connected. Defaults to true. */
  autoPlay?: boolean;
};

/**
 * Factory function type for creating Player instances.
 * @internal
 */
export type PlayerFactory = (
  whepUrl: string,
  options?: PlayerOptions,
) => Player;

/**
 * Status returned by the usePlayer hook.
 * Discriminated union based on the `state` property.
 *
 * @example
 * ```tsx
 * const { status } = usePlayer({ whepUrl });
 *
 * if (status.state === "buffering") {
 *   console.log("Reconnecting:", status.reconnectInfo.attempt);
 * } else if (status.state === "error") {
 *   console.error("Error:", status.error);
 * }
 * ```
 */
export type UsePlayerStatus =
  | { state: "idle" }
  | { state: "connecting" }
  | { state: "playing" }
  | { state: "buffering"; reconnectInfo: ReconnectInfo }
  | { state: "ended" }
  | { state: "error"; error: DaydreamError };

/**
 * Return value of the usePlayer hook.
 */
export interface UsePlayerReturn {
  /** Current player status. */
  status: UsePlayerStatus;
  /** Start playback. */
  play: () => Promise<void>;
  /** Stop playback. */
  stop: () => Promise<void>;
  /** Ref to attach to a video element for displaying the stream. */
  videoRef: RefObject<HTMLVideoElement | null>;
}

/**
 * React hook for managing a WebRTC playback session.
 *
 * Provides reactive state management, automatic cleanup, and a video element ref
 * for displaying the received stream.
 *
 * @param options - Player configuration options including WHEP URL
 * @param factory - Factory function for creating Player instances
 * @returns Player status, control functions, and video element ref
 *
 * @example
 * ```tsx
 * function PlayerComponent({ whepUrl }) {
 *   const { status, play, stop, videoRef } = usePlayer({ whepUrl });
 *
 *   useEffect(() => {
 *     if (whepUrl) play();
 *   }, [whepUrl, play]);
 *
 *   return (
 *     <div>
 *       <video ref={videoRef} autoPlay muted />
 *       <p>Status: {status.state}</p>
 *     </div>
 *   );
 * }
 * ```
 *
 * @internal Use the re-exported `usePlayer` from the package root instead.
 */
export function usePlayer(
  options: UsePlayerOptions,
  factory: PlayerFactory,
): UsePlayerReturn {
  const [status, setStatus] = useState<UsePlayerStatus>({ state: "idle" });
  const playerRef = useRef<Player | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const optionsRef = useRef(options);
  const factoryRef = useRef(factory);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    factoryRef.current = factory;
  }, [factory]);

  useEffect(() => {
    return () => {
      playerRef.current?.stop();
    };
  }, []);

  const updateStatus = useCallback(
    (newState: PlayerState, error?: DaydreamError) => {
      switch (newState) {
        case "connecting":
          setStatus({ state: "connecting" });
          break;
        case "playing":
          setStatus({ state: "playing" });
          break;
        case "buffering":
          // reconnectInfo will be set by the reconnect event
          break;
        case "ended":
          setStatus({ state: "ended" });
          break;
        case "error":
          setStatus({ state: "error", error: error! });
          break;
      }
    },
    [],
  );

  const play = useCallback(async () => {
    const currentWhepUrl = optionsRef.current.whepUrl;
    if (!currentWhepUrl) {
      return;
    }

    if (playerRef.current) {
      await playerRef.current.stop();
      playerRef.current = null;
    }

    setStatus({ state: "connecting" });

    const player = factoryRef.current(currentWhepUrl, {
      reconnect: optionsRef.current?.reconnect,
      iceServers: optionsRef.current?.iceServers,
      connectionTimeout: optionsRef.current?.connectionTimeout,
      skipIceGathering: optionsRef.current?.skipIceGathering,
      onStats: optionsRef.current?.onStats,
      statsIntervalMs: optionsRef.current?.statsIntervalMs,
    });

    playerRef.current = player;

    player.on("stateChange", (newState) => {
      // Guard against events from stopped player
      if (playerRef.current !== player) return;
      updateStatus(newState);
      // Re-attach stream after reconnect
      if (newState === "playing" && videoRef.current && player.stream) {
        if (videoRef.current.srcObject !== player.stream) {
          player.attachTo(videoRef.current);
        }
      }
    });

    player.on("error", (err) => {
      if (playerRef.current !== player) return;
      updateStatus("error", err);
    });

    player.on("reconnect", (info) => {
      if (playerRef.current !== player) return;
      setStatus({ state: "buffering", reconnectInfo: info });
    });

    try {
      await player.connect();
      if (playerRef.current !== player) return;
      updateStatus(player.state);

      if (videoRef.current) {
        player.attachTo(videoRef.current);
        if (optionsRef.current?.autoPlay !== false) {
          try {
            await videoRef.current.play();
          } catch {
            // Autoplay blocked
          }
        }
      }
    } catch (err) {
      if (playerRef.current !== player) return;
      setStatus({ state: "error", error: err as DaydreamError });
      throw err;
    }
  }, [updateStatus]);

  const stop = useCallback(async () => {
    await playerRef.current?.stop();
    playerRef.current = null;
    setStatus({ state: "idle" });
  }, []);

  return {
    status,
    play,
    stop,
    videoRef,
  };
}
