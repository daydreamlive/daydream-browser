import { useState, useRef, useCallback, useEffect } from "react";
import { useBroadcaster, usePlayer } from "@daydreamlive/react";
import { Daydream } from "daydream-sdk";

interface StreamInfo {
  id: string;
  whepUrl: string;
}

interface BroadcasterPanelProps {
  apiKey: string;
  onStreamCreated: (info: StreamInfo) => void;
  onStreamStopped: () => void;
}

function BroadcasterPanel({
  apiKey,
  onStreamCreated,
  onStreamStopped,
}: BroadcasterPanelProps) {
  const [whipUrl, setWhipUrl] = useState("");
  const [streamId, setStreamId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { state, whepUrl, error, publish, unpublish } = useBroadcaster({
    whipUrl,
    reconnect: { enabled: true, maxAttempts: 3, baseDelay: 1000 },
  });

  useEffect(() => {
    if (whepUrl && streamId) {
      onStreamCreated({ id: streamId, whepUrl });
    }
  }, [whepUrl, streamId, onStreamCreated]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 500, height: 500 },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.error("Failed to get camera:", err);
      throw err;
    }
  }, []);

  const handleStart = useCallback(async () => {
    if (!apiKey) {
      setCreateError("API key is required");
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const stream = await startCamera();

      const sdk = new Daydream({ bearer: apiKey });
      const response = await sdk.streams.create({
        pipeline: "streamdiffusion",
        params: {
          modelId: "stabilityai/sdxl-turbo",
          prompt: "Dragon, fantasy, epic, high quality, detailed",
          negativePrompt:
            "low quality, blurry, pixelated, distorted, ugly, bad, low resolution, low quality, blurry, pixelated, distorted, ugly, bad, low resolution",
        },
      });

      setWhipUrl(response.whipUrl);
      setStreamId(response.id);

      publish(stream);
    } catch (err) {
      console.error("Failed to create stream:", err);
      setCreateError(err instanceof Error ? err.message : String(err));
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    } finally {
      setIsCreating(false);
    }
  }, [apiKey, startCamera, publish]);

  const handleStop = useCallback(async () => {
    await unpublish();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setWhipUrl("");
    setStreamId("");
    onStreamStopped();
  }, [unpublish, onStreamStopped]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const displayState = isCreating ? "creating" : state;

  return (
    <div className="card">
      <h2>Broadcaster</h2>

      <div className="video-container">
        <video ref={videoRef} autoPlay muted playsInline />
        <span className={`status ${displayState}`}>{displayState}</span>
      </div>

      <div className="controls">
        <button
          className="primary"
          onClick={handleStart}
          disabled={
            !apiKey ||
            isCreating ||
            state === "connecting" ||
            state === "connected"
          }
        >
          {isCreating
            ? "Creating Stream..."
            : state === "connected"
            ? "Publishing"
            : "Start Streaming"}
        </button>
        <button
          className="danger"
          onClick={handleStop}
          disabled={state === "idle" && !isCreating}
        >
          Stop
        </button>
      </div>

      {streamId && (
        <div className="info">
          <div className="info-label">Stream ID</div>
          <div className="info-value">{streamId}</div>
        </div>
      )}

      {(error || createError) && (
        <div className="error-message">{error?.message || createError}</div>
      )}
    </div>
  );
}

interface PlayerPanelProps {
  apiKey: string;
  streamInfo: StreamInfo | null;
}

function PlayerPanel({ apiKey, streamInfo }: PlayerPanelProps) {
  const [prompt, setPrompt] = useState(
    "Dragon, fantasy, epic, high quality, detailed",
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const whepUrl = streamInfo?.whepUrl ?? "";

  const { state, error, play, stop, videoRef } = usePlayer({
    whepUrl,
    autoplay: true,
    reconnect: { enabled: true, maxAttempts: 10, baseDelay: 300 },
  });

  useEffect(() => {
    if (whepUrl && state === "idle") {
      play();
    }
  }, [whepUrl, state, play]);

  const handleUpdatePrompt = useCallback(async () => {
    if (!apiKey || !streamInfo?.id) return;

    setIsUpdating(true);
    setUpdateError(null);

    try {
      const sdk = new Daydream({ bearer: apiKey });
      await sdk.streams.update({
        id: streamInfo.id,
        body: {
          pipeline: "streamdiffusion",
          params: {
            modelId: "stabilityai/sdxl-turbo",
            prompt,
          },
        },
      });
    } catch (err) {
      console.error("Failed to update prompt:", err);
      setUpdateError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsUpdating(false);
    }
  }, [apiKey, streamInfo?.id, prompt]);

  return (
    <div className="card">
      <h2>Player</h2>

      <div className="video-container">
        <video
          ref={videoRef as React.RefObject<HTMLVideoElement>}
          autoPlay
          playsInline
          muted
        />
        <span className={`status ${state}`}>{state}</span>
      </div>

      {streamInfo && (
        <>
          <div className="input-group">
            <label>Prompt</label>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter prompt..."
              onKeyDown={(e) => e.key === "Enter" && handleUpdatePrompt()}
            />
          </div>

          <div className="controls">
            <button
              className="primary"
              onClick={handleUpdatePrompt}
              disabled={!prompt || isUpdating}
            >
              {isUpdating ? "Updating..." : "Update Prompt"}
            </button>
            <button
              className="danger"
              onClick={stop}
              disabled={state === "idle"}
            >
              Stop
            </button>
          </div>
        </>
      )}

      {!streamInfo && (
        <div className="info">
          <div className="info-label">Waiting for stream...</div>
          <div className="info-value" style={{ color: "#6b7280" }}>
            Start broadcasting to see the output here
          </div>
        </div>
      )}

      {(error || updateError) && (
        <div className="error-message">{error?.message || updateError}</div>
      )}
    </div>
  );
}

export default function App() {
  const [apiKey, setApiKey] = useState("");
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);

  const handleStreamCreated = useCallback((info: StreamInfo) => {
    setStreamInfo(info);
  }, []);

  const handleStreamStopped = useCallback(() => {
    setStreamInfo(null);
  }, []);

  return (
    <div className="container">
      <h1>Daydream SDK</h1>

      <div className="card" style={{ marginBottom: "2rem" }}>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label>API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your Daydream API key..."
          />
          <p className="input-hint warning">
            Keep this key safe and do not share it with anyone.
          </p>
        </div>
      </div>

      <div className="grid">
        <BroadcasterPanel
          apiKey={apiKey}
          onStreamCreated={handleStreamCreated}
          onStreamStopped={handleStreamStopped}
        />
        <PlayerPanel apiKey={apiKey} streamInfo={streamInfo} />
      </div>
    </div>
  );
}
