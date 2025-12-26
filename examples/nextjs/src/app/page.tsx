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

function BroadcasterPanel({
  streamInfo,
  onStreamCreated,
  onWhepUrlChange,
}: {
  streamInfo: StreamInfo | null;
  onStreamCreated: (info: StreamInfo) => void;
  onWhepUrlChange: (url: string | null) => void;
}) {
  const [prompt, setPrompt] = useState("cyberpunk, high quality");
  const [isPending, startTransition] = useTransition();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { state, whepUrl, error, start, stop } = useBroadcast({
    whipUrl: streamInfo?.whipUrl ?? "",
    reconnect: { enabled: true, maxAttempts: 5, baseDelayMs: 1000 },
  });

  useEffect(() => {
    onWhepUrlChange(whepUrl);
  }, [whepUrl, onWhepUrlChange]);

  const handleCreate = useCallback(async () => {
    startTransition(async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 512, height: 512 },
          audio: true,
        });
        streamRef.current = mediaStream;

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }

        const info = await createStream({ prompt });
        onStreamCreated(info);
      } catch (err) {
        console.error("Failed to create stream:", err);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      }
    });
  }, [prompt, onStreamCreated]);

  useEffect(() => {
    if (streamInfo && streamRef.current && state === "idle") {
      start(streamRef.current).catch(console.error);
    }
  }, [streamInfo, start, state]);

  const handleStop = useCallback(async () => {
    await stop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
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

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

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
          onClick={handleCreate}
          disabled={isConnecting || isPending}
          className="w-full px-4 py-2.5 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {isPending ? "Creating..." : isConnecting ? "Connecting..." : "Start"}
        </button>
      )}

      {error && <p className="text-xs text-red-600">{error.message}</p>}
    </div>
  );
}

function PlayerPanel({ whepUrl }: { whepUrl: string | null }) {
  const { state, error, videoRef } = usePlayer(whepUrl, {
    autoPlay: true,
    reconnect: { enabled: true, maxAttempts: 10, baseDelayMs: 300 },
  });

  const isPlaying = state === "playing";

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

      <div className="aspect-square bg-zinc-900 rounded-lg overflow-hidden">
        {!whepUrl ? (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-xs text-zinc-600">waiting...</span>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error.message}</p>}
    </div>
  );
}

export default function Home() {
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [whepUrl, setWhepUrl] = useState<string | null>(null);

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
            onStreamCreated={setStreamInfo}
            onWhepUrlChange={setWhepUrl}
          />
          <PlayerPanel whepUrl={whepUrl} />
        </div>
      </div>
    </main>
  );
}
