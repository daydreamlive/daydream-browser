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
} from "@daydreamlive/browser";

export interface UsePlayerOptions {
  reconnect?: ReconnectConfig;
  autoPlay?: boolean;
  onStats?: (report: RTCStatsReport) => void;
  statsIntervalMs?: number;
}

export type PlayerFactory = (
  whepUrl: string,
  options?: PlayerOptions,
) => Player;

export interface UsePlayerReturn {
  state: PlayerState | "idle";
  error: DaydreamError | null;
  play: () => Promise<void>;
  stop: () => void;
  videoRef: RefObject<HTMLVideoElement | null>;
}

export function usePlayer(
  whepUrl: string | null,
  options: UsePlayerOptions | undefined,
  factory: PlayerFactory,
): UsePlayerReturn {
  const [state, setState] = useState<PlayerState | "idle">("idle");
  const [error, setError] = useState<DaydreamError | null>(null);
  const playerRef = useRef<Player | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const optionsRef = useRef(options);
  const whepUrlRef = useRef(whepUrl);
  const prevWhepUrlRef = useRef<string | null>(null);
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

  const play = useCallback(async () => {
    const currentWhepUrl = whepUrlRef.current;
    if (!currentWhepUrl) {
      return;
    }

    setError(null);

    if (playerRef.current) {
      playerRef.current.stop();
    }

    try {
      const player = factoryRef.current(currentWhepUrl, {
        reconnect: optionsRef.current?.reconnect,
        onStats: optionsRef.current?.onStats,
        statsIntervalMs: optionsRef.current?.statsIntervalMs,
      });

      playerRef.current = player;

      player.on("stateChange", (newState) => {
        setState(newState);
      });

      player.on("error", (err) => {
        setError(err);
      });

      await player.connect();
      setState(player.state);

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
      setError(err as DaydreamError);
      setState("error");
      throw err;
    }
  }, []);

  const stop = useCallback(() => {
    playerRef.current?.stop();
    playerRef.current = null;
    setState("idle");
  }, []);

  useEffect(() => {
    const urlChanged = whepUrl !== prevWhepUrlRef.current;
    prevWhepUrlRef.current = whepUrl;

    if (urlChanged && whepUrl && optionsRef.current?.autoPlay !== false) {
      play().catch(() => {});
    }
  }, [whepUrl, play]);

  return {
    state,
    error,
    play,
    stop,
    videoRef,
  };
}
