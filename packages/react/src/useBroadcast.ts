import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Broadcast,
  BroadcastOptions,
  BroadcastState,
  DaydreamError,
  ReconnectInfo,
} from "@daydreamlive/browser";

/**
 * Options for the useBroadcast hook.
 * Same as BroadcastOptions but without `stream` (passed to `start()`) and `onResponse` (pre-configured).
 */
export type UseBroadcastOptions = Omit<BroadcastOptions, "stream" | "onResponse">;

/**
 * Factory function type for creating Broadcast instances.
 * @internal
 */
export type BroadcastFactory = (options: BroadcastOptions) => Broadcast;

/**
 * Status returned by the useBroadcast hook.
 * Discriminated union based on the `state` property.
 *
 * @example
 * ```tsx
 * const { status } = useBroadcast({ whipUrl });
 *
 * if (status.state === "live") {
 *   console.log("Playback URL:", status.whepUrl);
 * } else if (status.state === "error") {
 *   console.error("Error:", status.error);
 * }
 * ```
 */
export type UseBroadcastStatus =
  | { state: "idle" }
  | { state: "connecting" }
  | { state: "live"; whepUrl: string }
  | { state: "reconnecting"; whepUrl: string; reconnectInfo: ReconnectInfo }
  | { state: "ended" }
  | { state: "error"; error: DaydreamError };

/**
 * Return value of the useBroadcast hook.
 */
export interface UseBroadcastReturn {
  /** Current broadcast status. */
  status: UseBroadcastStatus;
  /** Start broadcasting with the given MediaStream. */
  start: (stream: MediaStream) => Promise<void>;
  /** Stop broadcasting. */
  stop: () => Promise<void>;
  /** Set the maximum frame rate for the video track. */
  setMaxFramerate: (fps?: number) => void;
}

/**
 * React hook for managing a WebRTC broadcast session.
 *
 * Provides reactive state management, automatic cleanup, and a simple API
 * for starting and stopping broadcasts.
 *
 * @param options - Broadcast configuration options
 * @param factory - Factory function for creating Broadcast instances
 * @returns Broadcast status and control functions
 *
 * @example
 * ```tsx
 * function BroadcastComponent() {
 *   const { status, start, stop } = useBroadcast({ whipUrl: "..." });
 *
 *   const handleStart = async () => {
 *     const stream = await navigator.mediaDevices.getUserMedia({ video: true });
 *     await start(stream);
 *   };
 *
 *   return (
 *     <div>
 *       <p>Status: {status.state}</p>
 *       {status.state === "idle" && <button onClick={handleStart}>Start</button>}
 *       {status.state === "live" && <button onClick={stop}>Stop</button>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @internal Use the re-exported `useBroadcast` from the package root instead.
 */
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
      broadcastRef.current = null;
    }

    setStatus({ state: "connecting" });

    const broadcast = factoryRef.current({
      stream,
      ...optionsRef.current,
    });

    broadcastRef.current = broadcast;

    broadcast.on("stateChange", (newState) => {
      // Guard against events from stopped broadcast
      if (broadcastRef.current !== broadcast) return;
      if (newState === "live" || newState === "reconnecting") {
        whepUrlRef.current = broadcast.whepUrl;
      }
      updateStatus(newState);
    });

    broadcast.on("error", (err) => {
      if (broadcastRef.current !== broadcast) return;
      updateStatus("error", err);
    });

    broadcast.on("reconnect", (info) => {
      if (broadcastRef.current !== broadcast) return;
      setStatus({
        state: "reconnecting",
        whepUrl: whepUrlRef.current!,
        reconnectInfo: info,
      });
    });

    try {
      await broadcast.connect();
      if (broadcastRef.current !== broadcast) return;
      whepUrlRef.current = broadcast.whepUrl;
      updateStatus(broadcast.state);
    } catch (err) {
      if (broadcastRef.current !== broadcast) return;
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
