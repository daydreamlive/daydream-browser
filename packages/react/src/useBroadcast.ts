import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AudioConfig,
  Broadcast,
  BroadcastOptions,
  BroadcastState,
  DaydreamError,
  ReconnectConfig,
  ReconnectInfo,
  VideoConfig,
} from "@daydreamlive/browser";

export interface UseBroadcastOptions {
  whipUrl: string;
  reconnect?: ReconnectConfig;
  video?: VideoConfig;
  audio?: AudioConfig;
  iceServers?: RTCIceServer[];
  connectionTimeout?: number;
  onStats?: (report: RTCStatsReport) => void;
  statsIntervalMs?: number;
}

export type BroadcastFactory = (options: BroadcastOptions) => Broadcast;

export type UseBroadcastStatus =
  | { state: "idle" }
  | { state: "connecting" }
  | { state: "live"; whepUrl: string }
  | { state: "reconnecting"; whepUrl: string; reconnectInfo: ReconnectInfo }
  | { state: "ended" }
  | { state: "error"; error: DaydreamError };

export interface UseBroadcastReturn {
  status: UseBroadcastStatus;
  start: (stream: MediaStream) => Promise<void>;
  stop: () => Promise<void>;
  setMaxFramerate: (fps?: number) => void;
}

export function useBroadcast(
  options: UseBroadcastOptions,
  factory: BroadcastFactory,
): UseBroadcastReturn {
  const [status, setStatus] = useState<UseBroadcastStatus>({ state: "idle" });
  const broadcastRef = useRef<Broadcast | null>(null);
  const whepUrlRef = useRef<string | null>(null);
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
      broadcastRef.current?.stop();
    };
  }, []);

  const updateStatus = useCallback((newState: BroadcastState, error?: DaydreamError) => {
    const whepUrl = whepUrlRef.current;
    switch (newState) {
      case "connecting":
        setStatus({ state: "connecting" });
        break;
      case "live":
        setStatus({ state: "live", whepUrl: whepUrl! });
        break;
      case "reconnecting":
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

  const start = useCallback(async (stream: MediaStream) => {
    if (broadcastRef.current) {
      await broadcastRef.current.stop();
    }

    setStatus({ state: "connecting" });

    try {
      const broadcast = factoryRef.current({
        stream,
        ...optionsRef.current,
      });

      broadcastRef.current = broadcast;

      broadcast.on("stateChange", (newState) => {
        if (newState === "live" || newState === "reconnecting") {
          whepUrlRef.current = broadcast.whepUrl;
        }
        updateStatus(newState);
      });

      broadcast.on("error", (err) => {
        updateStatus("error", err);
      });

      broadcast.on("reconnect", (info) => {
        setStatus({
          state: "reconnecting",
          whepUrl: whepUrlRef.current!,
          reconnectInfo: info,
        });
      });

      await broadcast.connect();
      whepUrlRef.current = broadcast.whepUrl;
      updateStatus(broadcast.state);
    } catch (err) {
      setStatus({ state: "error", error: err as DaydreamError });
      throw err;
    }
  }, [updateStatus]);

  const stop = useCallback(async () => {
    await broadcastRef.current?.stop();
    broadcastRef.current = null;
    whepUrlRef.current = null;
    setStatus({ state: "idle" });
  }, []);

  const setMaxFramerate = useCallback((fps?: number) => {
    broadcastRef.current?.setMaxFramerate(fps);
  }, []);

  return {
    status,
    start,
    stop,
    setMaxFramerate,
  };
}
