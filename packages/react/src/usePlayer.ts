import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type RefObject,
} from "react";
import {
  DaydreamPlayer,
  type PlayerOptions,
  type PlayerState,
} from "@daydreamlive/client";

export interface UsePlayerOptions extends Omit<PlayerOptions, "videoElement"> {}

export interface UsePlayerReturn {
  state: PlayerState;
  stream: MediaStream | null;
  error: Error | null;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  videoRef: RefObject<HTMLVideoElement | null>;
}

export function usePlayer(options: UsePlayerOptions): UsePlayerReturn {
  const [state, setState] = useState<PlayerState>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const playerRef = useRef<DaydreamPlayer | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    return () => {
      playerRef.current?.destroy();
    };
  }, []);

  const play = useCallback(async () => {
    setError(null);

    if (playerRef.current) {
      if (playerRef.current.state === "paused") {
        await videoRef.current?.play();
        return;
      }
      playerRef.current.destroy();
    }

    const playerOptions: PlayerOptions = {
      ...optionsRef.current,
    };

    if (videoRef.current) {
      playerOptions.videoElement = videoRef.current;
    }

    const player = new DaydreamPlayer(playerOptions);
    playerRef.current = player;

    player.on("connecting", () => setState("connecting"));
    player.on("connected", () => {
      setState("connected");
      setStream(player.stream);
    });
    player.on("playing", () => setState("playing"));
    player.on("paused", () => setState("paused"));
    player.on("ended", () => {
      setState("ended");
      setStream(null);
    });
    player.on("error", (err) => {
      setState("error");
      setError(err);
    });
    player.on("reconnecting", () => setState("connecting"));

    await player.play();
  }, []);

  const pause = useCallback(() => {
    playerRef.current?.pause();
  }, []);

  const stop = useCallback(() => {
    playerRef.current?.stop();
    setStream(null);
  }, []);

  return {
    state,
    stream,
    error,
    play,
    pause,
    stop,
    videoRef,
  };
}
