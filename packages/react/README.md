# @daydreamlive/react

React hooks for Daydream WebRTC streaming.

## Install

```bash
npm install @daydreamlive/react
```

## Usage

### useBroadcast

```tsx
import { useBroadcast } from "@daydreamlive/react";

function Broadcaster({ whipUrl }: { whipUrl: string }) {
  const { status, start, stop } = useBroadcast({
    whipUrl,
    reconnect: { enabled: true },
  });

  const handleStart = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    await start(stream);
  };

  return (
    <div>
      <p>State: {status.state}</p>
      {status.state === "live" && <p>WHEP URL: {status.whepUrl}</p>}
      {status.state === "error" && <p>Error: {status.error.message}</p>}
      <button onClick={handleStart} disabled={status.state === "live"}>
        Start
      </button>
      <button onClick={stop}>Stop</button>
    </div>
  );
}
```

### usePlayer

```tsx
import { usePlayer } from "@daydreamlive/react";

function Player({ whepUrl }: { whepUrl: string }) {
  const { status, play, stop, videoRef } = usePlayer(whepUrl, {
    autoPlay: true,
    reconnect: { enabled: true },
  });

  return (
    <div>
      <p>State: {status.state}</p>
      {status.state === "error" && <p>Error: {status.error.message}</p>}
      <video ref={videoRef} autoPlay playsInline muted />
      <button onClick={play} disabled={status.state === "playing"}>
        Play
      </button>
      <button onClick={stop}>Stop</button>
    </div>
  );
}
```

## API

### `useBroadcast(options)`

Returns: `{ status, start, stop, setMaxFramerate }`

- `status`: `UseBroadcastStatus` - Discriminated union with `state` property
  - `{ state: "idle" }`
  - `{ state: "connecting" }`
  - `{ state: "live", whepUrl: string }`
  - `{ state: "reconnecting", whepUrl: string, reconnectInfo: ReconnectInfo }`
  - `{ state: "ended" }`
  - `{ state: "error", error: DaydreamError }`
- `start(stream: MediaStream)`: Start broadcasting
- `stop()`: Stop broadcasting
- `setMaxFramerate(fps?: number)`: Set max framerate

### `usePlayer(whepUrl, options?)`

Returns: `{ status, play, stop, videoRef }`

- `status`: `UsePlayerStatus` - Discriminated union with `state` property
  - `{ state: "idle" }`
  - `{ state: "connecting" }`
  - `{ state: "playing" }`
  - `{ state: "buffering", reconnectInfo: ReconnectInfo }`
  - `{ state: "ended" }`
  - `{ state: "error", error: DaydreamError }`
- `play()`: Start playing
- `stop()`: Stop playing
- `videoRef`: Ref to attach to `<video>` element

## License

MIT
