"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useTransition,
} from "react";
import {
  CompositorProvider,
  useCompositor,
  useBroadcast,
  usePlayer,
} from "@daydreamlive/react";
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

function ExampleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 text-xs rounded-lg border transition-colors cursor-pointer ${
        active
          ? "bg-zinc-900 text-white border-zinc-900"
          : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
      }`}
    >
      {children}
    </button>
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

function ThreeSource({
  exampleId,
  onCanvasReady,
  iframeRef,
}: {
  exampleId: string;
  onCanvasReady?: (ready: boolean) => void;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}) {
  const compositor = useCompositor();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const registeredRef = useRef(false);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    registeredRef.current = false;
    onCanvasReady?.(false);

    let video: HTMLVideoElement | null = null;
    let stream: MediaStream | null = null;

    const hideStats = () => {
      if (!iframe.contentDocument) return;
      try {
        const doc = iframe.contentDocument;

        const style = doc.createElement("style");
        style.textContent = `
          #stats, .stats, [id^="stats"], #info {
            display: none !important;
          }
        `;
        doc.head.appendChild(style);

        const hideSmallCanvasContainers = () => {
          doc.querySelectorAll("canvas").forEach((canvas) => {
            if (canvas.width < 200 && canvas.height < 100) {
              const parent = canvas.parentElement;
              if (parent && parent !== doc.body) {
                parent.style.display = "none";
              } else {
                canvas.style.display = "none";
              }
            }
          });

          doc.querySelectorAll("body > div").forEach((div) => {
            const rect = div.getBoundingClientRect();
            if (rect.width < 200 && rect.height < 100 && rect.top < 50) {
              (div as HTMLElement).style.display = "none";
            }
          });
        };

        hideSmallCanvasContainers();
        setTimeout(hideSmallCanvasContainers, 500);
        setTimeout(hideSmallCanvasContainers, 1000);
      } catch {
        // ignore
      }
    };

    const pollForCanvas = () => {
      if (!iframe.contentDocument) return null;

      try {
        const canvases = iframe.contentDocument.querySelectorAll("canvas");
        let largest: HTMLCanvasElement | null = null;
        let maxArea = 0;

        canvases.forEach((canvas) => {
          const area = canvas.width * canvas.height;
          if (area > maxArea) {
            maxArea = area;
            largest = canvas;
          }
        });

        if (largest && maxArea > 10000) {
          return largest;
        }
      } catch {
        return null;
      }
      return null;
    };

    const registerCanvas = async (canvas: HTMLCanvasElement) => {
      if (registeredRef.current) return;
      registeredRef.current = true;

      stream = canvas.captureStream(30);
      video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      videoRef.current = video;

      try {
        await video.play();
      } catch {
        // ignore
      }

      compositor.register("three", {
        kind: "video",
        element: video,
        fit: "cover",
      });
      compositor.activate("three");
      onCanvasReady?.(true);
    };

    let pollInterval: ReturnType<typeof setInterval>;

    const handleLoad = () => {
      hideStats();
      pollInterval = setInterval(() => {
        const canvas = pollForCanvas();
        if (canvas) {
          clearInterval(pollInterval);
          registerCanvas(canvas);
        }
      }, 100);
    };

    iframe.addEventListener("load", handleLoad);

    return () => {
      iframe.removeEventListener("load", handleLoad);
      clearInterval(pollInterval);
      if (registeredRef.current) {
        compositor.unregister("three");
      }
      if (video) {
        video.pause();
        video.srcObject = null;
      }
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [exampleId, compositor, onCanvasReady, iframeRef]);

  return null;
}

function ThreeDemoInner() {
  const compositor = useCompositor();
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [started, setStarted] = useState(false);
  const [examples, setExamples] = useState<string[]>([]);
  const [activeExample, setActiveExample] = useState<string>("");
  const [prompt, setPrompt] = useState("3d render, high quality, cinematic");
  const [isPending, startTransition] = useTransition();
  const [videoReady, setVideoReady] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    fetch("/examples.json")
      .then((res) => res.json())
      .then((list: string[]) => {
        setExamples(list);
        if (list.length > 0) {
          setActiveExample((prev) => prev || list[0]);
        }
      })
      .catch(() => {});
  }, []);

  const {
    status: broadcastStatus,
    start,
    stop,
  } = useBroadcast({
    whipUrl: streamInfo?.whipUrl ?? "",
    reconnect: { enabled: true, maxAttempts: 5, baseDelayMs: 1000 },
    video: {
      bitrate: 200_000,
      maxFramerate: 30,
    },
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
  } = usePlayer({
    whepUrl,
    autoPlay: true,
    reconnect: { enabled: true, maxAttempts: 10, baseDelayMs: 300 },
  });

  const playerState = playerStatus.state;
  const playerError =
    playerStatus.state === "error" ? playerStatus.error : null;

  useEffect(() => {
    let cancelled = false;

    createStream({ prompt })
      .then((info) => {
        if (!cancelled) {
          setStreamInfo(info);
        }
      })
      .catch((err) => {
        console.error("Failed to create stream:", err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (started && whepUrl) {
      play().catch(() => {});
    } else if (!started) {
      stopPlayer();
      setVideoReady(false);
    }
  }, [started, whepUrl, play, stopPlayer]);

  const handleStart = useCallback(async () => {
    const stream = compositor.stream;
    if (!stream) return;
    setStarted(true);
    try {
      await start(stream);
    } catch (err) {
      console.error("Failed to start broadcast:", err);
    }
  }, [compositor.stream, start]);

  const handleStop = useCallback(async () => {
    setStarted(false);
    setStreamInfo(null);
    try {
      await stop();
    } catch (err) {
      console.error("Failed to stop broadcast:", err);
    }
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

  const isReady = streamInfo && compositor.stream;
  const isLive = broadcastState === "live";
  const isConnecting =
    broadcastState === "connecting" || broadcastState === "reconnecting";

  const formatLabel = (id: string) => {
    return id
      .replace("webgl_", "")
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  return (
    <>
      {activeExample && (
        <ThreeSource
          exampleId={activeExample}
          onCanvasReady={setCanvasReady}
          iframeRef={iframeRef}
        />
      )}
      <main className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <header className="mb-6">
            <h1 className="text-sm font-medium text-zinc-900 mb-1">
              @daydreamlive/react - Three.js
            </h1>
            <p className="text-xs text-zinc-400">
              Stream three.js examples with AI processing
            </p>
          </header>

          <div className="flex flex-wrap gap-1.5 mb-6 max-h-32 overflow-y-auto">
            {examples.map((id) => (
              <ExampleButton
                key={id}
                active={activeExample === id}
                onClick={() => {
                  setCanvasReady(false);
                  setActiveExample(id);
                }}
              >
                {formatLabel(id)}
              </ExampleButton>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
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
                <span className="text-xs text-zinc-400">{broadcastState}</span>
              </div>

              <div className="aspect-square bg-zinc-900 rounded-lg overflow-hidden relative">
                {activeExample && (
                  <iframe
                    ref={iframeRef}
                    key={activeExample}
                    src={`/three/examples/${activeExample}.html`}
                    className="w-full h-full border-0"
                  />
                )}
                {!canvasReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                    <Spinner />
                  </div>
                )}
              </div>
            </div>
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
    </>
  );
}

export function ThreeDemo() {
  return (
    <CompositorProvider
      width={512}
      height={512}
      fps={30}
      disableSilentAudio={false}
    >
      <ThreeDemoInner />
    </CompositorProvider>
  );
}
