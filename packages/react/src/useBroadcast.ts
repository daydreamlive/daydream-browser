import { useCallback, useEffect, useRef, useState } from "react";
import {
  createBroadcast,
  type Broadcast,
  type BroadcastState,
  type DaydreamError,
  type ReconnectConfig,
  type VideoConfig,
} from "@daydreamlive/browser";

export interface UseBroadcastOptions {
  whipUrl: string;
  reconnect?: ReconnectConfig;
  video?: VideoConfig;
  onStats?: (report: RTCStatsReport) => void;
  statsIntervalMs?: number;
}

export interface UseBroadcastReturn {
  state: BroadcastState | "idle";
  whepUrl: string | null;
  error: DaydreamError | null;
  start: (stream: MediaStream) => Promise<void>;
  stop: () => Promise<void>;
}

export function useBroadcast(options: UseBroadcastOptions): UseBroadcastReturn {
  const [state, setState] = useState<BroadcastState | "idle">("idle");
  const [whepUrl, setWhepUrl] = useState<string | null>(null);
  const [error, setError] = useState<DaydreamError | null>(null);
  const broadcastRef = useRef<Broadcast | null>(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    return () => {
      broadcastRef.current?.stop();
    };
  }, []);

  const start = useCallback(async (stream: MediaStream) => {
    setError(null);

    if (broadcastRef.current) {
      await broadcastRef.current.stop();
    }

    try {
      const broadcast = createBroadcast({
        stream,
        ...optionsRef.current,
      });

      broadcastRef.current = broadcast;

      broadcast.on("stateChange", (newState) => {
        setState(newState);
        if (newState === "live") {
          setWhepUrl(broadcast.whepUrl);
        }
      });

      broadcast.on("error", (err) => {
        setError(err);
      });

      await broadcast.connect();
      setState(broadcast.state);
      setWhepUrl(broadcast.whepUrl);
    } catch (err) {
      setError(err as DaydreamError);
      setState("error");
      throw err;
    }
  }, []);

  const stop = useCallback(async () => {
    await broadcastRef.current?.stop();
    broadcastRef.current = null;
    setWhepUrl(null);
    setState("idle");
  }, []);

  return {
    state,
    whepUrl,
    error,
    start,
    stop,
  };
}
