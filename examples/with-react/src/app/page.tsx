"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useTransition,
} from "react";
import { useBroadcast, usePlayer } from "@daydreamlive/react";
import { createStream, updateStream, type StreamInfo } from "./actions";

function StatusDot({ active, color }: { active: boolean; color: string }) {
  return (
    <span
      className={`w-2 h-2 rounded-full ${color} ${
        active ? "animate-pulse" : ""
      }`}
    />
  );
}

function Spinner() {
  return (
    <svg
      className="w-6 h-6 animate-spin text-zinc-500"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function InputPanel({
  videoRef,
  state,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  state: string;
}) {
  const isLive = state === "live";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusDot
            active={isLive}
            color={isLive ? "bg-red-500" : "bg-zinc-300"}
          />
          <span className="text-xs uppercase tracking-wide text-zinc-500">
            Input
          </span>
        </div>
        <span className="text-xs text-zinc-400">{state}</span>
      </div>

      <div className="aspect-square bg-zinc-900 rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
}

function OutputPanel({
  videoRef,
  state,
  started,
  videoReady,
  onPlaying,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  state: string;
  started: boolean;
  videoReady: boolean;
  onPlaying: () => void;
}) {
  const isPlaying = state === "playing";
  const showSpinner = started && !videoReady;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusDot
            active={isPlaying}
            color={isPlaying ? "bg-emerald-500" : "bg-zinc-300"}
          />
          <span className="text-xs uppercase tracking-wide text-zinc-500">
            Output
          </span>
        </div>
        <span className="text-xs text-zinc-400">{state}</span>
      </div>

      <div className="aspect-square bg-zinc-900 rounded-lg overflow-hidden relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onPlaying={onPlaying}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            videoReady ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
            showSpinner ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <Spinner />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [started, setStarted] = useState(false);
  const [prompt, setPrompt] = useState("cyberpunk, high quality");
  const [isPending, startTransition] = useTransition();
  const [videoReady, setVideoReady] = useState(false);

  const inputVideoRef = useRef<HTMLVideoElement>(null);

  const { status: broadcastStatus, start, stop } = useBroadcast({
    whipUrl: streamInfo?.whipUrl ?? "",
    reconnect: { enabled: true, maxAttempts: 5, baseDelayMs: 1000 },
  });

  const broadcastState = broadcastStatus.state;
  const whepUrl =
    broadcastStatus.state === "live" ||
    broadcastStatus.state === "reconnecting"
      ? broadcastStatus.whepUrl
      : null;
  const broadcastError =
    broadcastStatus.state === "error" ? broadcastStatus.error : null;

  const {
    status: playerStatus,
    videoRef: playerVideoRef,
    play,
    stop: stopPlayer,
  } = usePlayer(whepUrl, {
    autoPlay: true,
    reconnect: { enabled: true, maxAttempts: 10, baseDelayMs: 300 },
  });

  const playerState = playerStatus.state;
  const playerError =
    playerStatus.state === "error" ? playerStatus.error : null;

  // Create stream and get media on mount
  useEffect(() => {
    let cancelled = false;

    createStream({ prompt: "cyberpunk, high quality" })
      .then((info) => {
        if (!cancelled) {
          setStreamInfo(info);
        }
      })
      .catch((err) => {
        console.error("Failed to create stream:", err);
      });

    navigator.mediaDevices
      .getUserMedia({ video: { width: 512, height: 512 }, audio: true })
      .then((stream) => {
        if (!cancelled) {
          setMediaStream(stream);
        } else {
          stream.getTracks().forEach((t) => t.stop());
        }
      })
      .catch((err) => {
        console.error("Failed to get media:", err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Cleanup media stream on unmount
  useEffect(() => {
    return () => {
      mediaStream?.getTracks().forEach((t) => t.stop());
    };
  }, [mediaStream]);

  // Connect input video to media stream
  useEffect(() => {
    if (inputVideoRef.current && mediaStream) {
      inputVideoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  // Handle player lifecycle
  useEffect(() => {
    if (started && whepUrl) {
      play().catch(() => {});
    } else if (!started) {
      stopPlayer();
      setVideoReady(false);
    }
  }, [started, whepUrl, play, stopPlayer]);

  const handleStart = useCallback(async () => {
    if (!mediaStream) return;
    setStarted(true);
    try {
      await start(mediaStream);
    } catch (err) {
      console.error("Failed to start broadcast:", err);
    }
  }, [mediaStream, start]);

  const handleStop = useCallback(async () => {
    setStarted(false);
    setStreamInfo(null);
    try {
      await stop();
    } catch (err) {
      console.error("Failed to stop broadcast:", err);
    }
    // Create new stream for next session after stop completes
    try {
      const info = await createStream({ prompt });
      setStreamInfo(info);
    } catch (err) {
      console.error("Failed to create stream:", err);
    }
  }, [stop, prompt]);

  const handleUpdatePrompt = useCallback(() => {
    if (!streamInfo) return;
    startTransition(async () => {
      try {
        await updateStream(streamInfo.id, { prompt });
      } catch (err) {
        console.error("Failed to update prompt:", err);
      }
    });
  }, [streamInfo, prompt]);

  const handlePlaying = useCallback(() => {
    setVideoReady(true);
  }, []);

  const isReady = streamInfo && mediaStream;
  const isLive = broadcastState === "live";
  const isConnecting =
    broadcastState === "connecting" || broadcastState === "reconnecting";

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <header className="mb-8">
          <h1 className="text-sm font-medium text-zinc-900 mb-1">
            @daydreamlive/browser
          </h1>
          <p className="text-xs text-zinc-400">
            WebRTC streaming for real-time AI video
          </p>
        </header>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <InputPanel videoRef={inputVideoRef} state={broadcastState} />
          <OutputPanel
            videoRef={playerVideoRef}
            state={playerState}
            started={started}
            videoReady={videoReady}
            onPlaying={handlePlaying}
          />
        </div>

        <div className="space-y-3">
          {isLive ? (
            <div className="flex gap-3">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUpdatePrompt()}
                className="flex-1 px-3 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900"
                placeholder="prompt"
              />
              <button
                onClick={handleUpdatePrompt}
                disabled={isPending}
                className="px-4 py-2.5 text-sm text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isPending ? "..." : "Update"}
              </button>
              <button
                onClick={handleStop}
                className="px-4 py-2.5 text-sm text-red-600 border border-zinc-200 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
              >
                Stop
              </button>
            </div>
          ) : (
            <button
              onClick={handleStart}
              disabled={!isReady || isConnecting}
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {!isReady
                ? "Preparing..."
                : isConnecting
                  ? "Connecting..."
                  : "Start"}
            </button>
          )}

          {broadcastError && (
            <p className="text-xs text-red-600">{broadcastError.message}</p>
          )}
          {playerError && (
            <p className="text-xs text-red-600">{playerError.message}</p>
          )}
        </div>
      </div>
    </main>
  );
}
