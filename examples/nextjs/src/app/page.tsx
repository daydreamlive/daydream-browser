"use client";

import { useState, useRef, useCallback, useEffect, useTransition } from "react";
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

function BroadcasterPanel({
  streamInfo,
  mediaStream,
  onWhepUrlChange,
  onStarted,
}: {
  streamInfo: StreamInfo | null;
  mediaStream: MediaStream | null;
  onWhepUrlChange: (url: string | null) => void;
  onStarted: () => void;
}) {
  const [prompt, setPrompt] = useState("cyberpunk, high quality");
  const [isPending, startTransition] = useTransition();
  const videoRef = useRef<HTMLVideoElement>(null);

  const { state, whepUrl, error, start, stop } = useBroadcast({
    whipUrl: streamInfo?.whipUrl ?? "",
    reconnect: { enabled: true, maxAttempts: 5, baseDelayMs: 1000 },
  });

  useEffect(() => {
    onWhepUrlChange(whepUrl);
  }, [whepUrl, onWhepUrlChange]);

  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  const handleStart = useCallback(async () => {
    if (!mediaStream) return;
    onStarted();
    try {
      await start(mediaStream);
    } catch (err) {
      console.error("Failed to start broadcast:", err);
    }
  }, [mediaStream, start, onStarted]);

  const handleStop = useCallback(async () => {
    await stop();
  }, [stop]);

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

  const isReady = streamInfo && mediaStream;
  const isLive = state === "live";
  const isConnecting = state === "connecting" || state === "reconnecting";

  return (
    <div className="space-y-4">
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

      {isLive ? (
        <div className="space-y-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUpdatePrompt()}
            className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900"
            placeholder="prompt"
          />
          <div className="flex gap-2">
            <button
              onClick={handleUpdatePrompt}
              disabled={isPending}
              className="flex-1 px-3 py-2 text-sm text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isPending ? "..." : "Update"}
            </button>
            <button
              onClick={handleStop}
              className="px-3 py-2 text-sm text-red-600 border border-zinc-200 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
            >
              Stop
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleStart}
          disabled={!isReady || isConnecting}
          className="w-full px-4 py-2.5 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {!isReady ? "Preparing..." : isConnecting ? "Connecting..." : "Start"}
        </button>
      )}

      {error && <p className="text-xs text-red-600">{error.message}</p>}
    </div>
  );
}

function PlayerPanel({
  whepUrl,
  started,
}: {
  whepUrl: string | null;
  started: boolean;
}) {
  const { state, error, videoRef, play, stop } = usePlayer(whepUrl, {
    autoPlay: true,
    reconnect: { enabled: true, maxAttempts: 10, baseDelayMs: 300 },
  });
  const [videoReady, setVideoReady] = useState(false);

  const isPlaying = state === "playing";
  const showSpinner = started && !videoReady;

  const handlePlaying = useCallback(() => {
    setVideoReady(true);
  }, []);

  useEffect(() => {
    if (started && whepUrl) {
      play().catch(() => {});
    } else if (!started) {
      stop();
      setVideoReady(false);
    }
  }, [started, whepUrl, play, stop]);

  return (
    <div className="space-y-4">
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
          onPlaying={handlePlaying}
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

      {error && <p className="text-xs text-red-600">{error.message}</p>}
    </div>
  );
}

export default function Home() {
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [whepUrl, setWhepUrl] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

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

  useEffect(() => {
    return () => {
      mediaStream?.getTracks().forEach((t) => t.stop());
    };
  }, [mediaStream]);

  const handleStarted = useCallback(() => {
    setStarted(true);
  }, []);

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <header className="mb-12">
          <h1 className="text-sm font-medium text-zinc-900 mb-1">
            @daydreamlive/browser
          </h1>
          <p className="text-xs text-zinc-400">
            WebRTC streaming for real-time AI video
          </p>
        </header>

        <div className="grid grid-cols-2 gap-8">
          <BroadcasterPanel
            streamInfo={streamInfo}
            mediaStream={mediaStream}
            onWhepUrlChange={setWhepUrl}
            onStarted={handleStarted}
          />
          <PlayerPanel whepUrl={whepUrl} started={started} />
        </div>
      </div>
    </main>
  );
}
