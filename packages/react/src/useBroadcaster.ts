import { useState, useCallback, useRef, useEffect } from "react";
import {
  DaydreamBroadcaster,
  type BroadcasterOptions,
  type BroadcasterState,
} from "@daydreamlive/client";

export interface UseBroadcasterOptions
  extends Omit<BroadcasterOptions, "whipUrl"> {
  whipUrl?: string;
}

export interface UseBroadcasterReturn {
  state: BroadcasterState;
  whepUrl: string | null;
  error: Error | null;
  publish: (stream: MediaStream) => void;
  unpublish: () => Promise<void>;
  replaceTrack: (track: MediaStreamTrack) => Promise<void>;
  setMaxFramerate: (fps?: number) => void;
}

export function useBroadcaster(
  options: UseBroadcasterOptions,
): UseBroadcasterReturn {
  const [state, setState] = useState<BroadcasterState>("idle");
  const [whepUrl, setWhepUrl] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [pendingStream, setPendingStream] = useState<MediaStream | null>(null);
  const broadcasterRef = useRef<DaydreamBroadcaster | null>(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    return () => {
      broadcasterRef.current?.destroy();
    };
  }, []);

  const doPublish = useCallback(
    async (stream: MediaStream, whipUrl: string) => {
      setError(null);

      if (broadcasterRef.current) {
        broadcasterRef.current.destroy();
      }

      const broadcasterOptions: BroadcasterOptions = {
        ...optionsRef.current,
        whipUrl,
      };

      const broadcaster = new DaydreamBroadcaster(broadcasterOptions);
      broadcasterRef.current = broadcaster;

      broadcaster.on("connecting", () => setState("connecting"));
      broadcaster.on("connected", ({ whepUrl }) => {
        setState("connected");
        setWhepUrl(whepUrl);
      });
      broadcaster.on("disconnected", () => {
        setState("disconnected");
        setWhepUrl(null);
      });
      broadcaster.on("error", (err) => {
        setState("error");
        setError(err);
      });
      broadcaster.on("reconnecting", () => setState("connecting"));

      await broadcaster.publish(stream);
    },
    [],
  );

  useEffect(() => {
    if (options.whipUrl && pendingStream) {
      doPublish(pendingStream, options.whipUrl);
      setPendingStream(null);
    }
  }, [options.whipUrl, pendingStream, doPublish]);

  const publish = useCallback(
    (stream: MediaStream) => {
      const url = optionsRef.current.whipUrl;
      if (url) {
        doPublish(stream, url);
      } else {
        setPendingStream(stream);
      }
    },
    [doPublish],
  );

  const unpublish = useCallback(async () => {
    setPendingStream(null);
    await broadcasterRef.current?.unpublish();
    setWhepUrl(null);
  }, []);

  const replaceTrack = useCallback(async (track: MediaStreamTrack) => {
    await broadcasterRef.current?.replaceTrack(track);
  }, []);

  const setMaxFramerate = useCallback((fps?: number) => {
    broadcasterRef.current?.setMaxFramerate(fps);
  }, []);

  return {
    state,
    whepUrl,
    error,
    publish,
    unpublish,
    replaceTrack,
    setMaxFramerate,
  };
}
