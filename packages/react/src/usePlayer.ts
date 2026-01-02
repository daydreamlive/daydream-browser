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
  ReconnectConfig,
  ReconnectInfo,
} from "@daydreamlive/browser";

export interface UsePlayerOptions {
  reconnect?: ReconnectConfig;
  iceServers?: RTCIceServer[];
  connectionTimeout?: number;
  autoPlay?: boolean;
  onStats?: (report: RTCStatsReport) => void;
  statsIntervalMs?: number;
}

export type PlayerFactory = (
  whepUrl: string,
  options?: PlayerOptions,
) => Player;

export type UsePlayerStatus =
  | { state: "idle" }
  | { state: "connecting" }
  | { state: "playing" }
  | { state: "buffering"; reconnectInfo: ReconnectInfo }
  | { state: "ended" }
  | { state: "error"; error: DaydreamError };

export interface UsePlayerReturn {
  status: UsePlayerStatus;
  play: () => Promise<void>;
  stop: () => Promise<void>;
  videoRef: RefObject<HTMLVideoElement | null>;
}

export function usePlayer(
  whepUrl: string | null,
  options: UsePlayerOptions | undefined,
  factory: PlayerFactory,
): UsePlayerReturn {
  const [status, setStatus] = useState<UsePlayerStatus>({ state: "idle" });
  const playerRef = useRef<Player | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const optionsRef = useRef(options);
  const whepUrlRef = useRef(whepUrl);
  const factoryRef = useRef(factory);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    factoryRef.current = factory;
  }, [factory]);

  useEffect(() => {
    whepUrlRef.current = whepUrl;
  }, [whepUrl]);

  useEffect(() => {
    return () => {
      playerRef.current?.stop();
    };
  }, []);

  const updateStatus = useCallback((newState: PlayerState, error?: DaydreamError) => {
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
  }, []);

  const play = useCallback(async () => {
    const currentWhepUrl = whepUrlRef.current;
    if (!currentWhepUrl) {
      return;
    }

    if (playerRef.current) {
      await playerRef.current.stop();
    }

    setStatus({ state: "connecting" });

    try {
      const player = factoryRef.current(currentWhepUrl, {
        reconnect: optionsRef.current?.reconnect,
        iceServers: optionsRef.current?.iceServers,
        connectionTimeout: optionsRef.current?.connectionTimeout,
        onStats: optionsRef.current?.onStats,
        statsIntervalMs: optionsRef.current?.statsIntervalMs,
      });

      playerRef.current = player;

      player.on("stateChange", (newState) => {
        updateStatus(newState);
        // Re-attach stream after reconnect
        if (newState === "playing" && videoRef.current && player.stream) {
          if (videoRef.current.srcObject !== player.stream) {
            player.attachTo(videoRef.current);
          }
        }
      });

      player.on("error", (err) => {
        updateStatus("error", err);
      });

      player.on("reconnect", (info) => {
        setStatus({ state: "buffering", reconnectInfo: info });
      });

      await player.connect();
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
