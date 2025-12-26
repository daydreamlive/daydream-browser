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
  const { state, whepUrl, error, start, stop } = useBroadcast({
    whipUrl,
    reconnect: { enabled: true },
  });

  const handleStart = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    await start(stream);
  };

  return (
    <div>
      <p>State: {state}</p>
      <button onClick={handleStart} disabled={state === "live"}>
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
  const { state, error, videoRef } = usePlayer(whepUrl, {
    autoPlay: true,
    reconnect: { enabled: true },
  });

  return <video ref={videoRef} autoPlay playsInline muted />;
}
```

## API

### `useBroadcast(options)`

Returns: `{ state, whepUrl, error, start, stop }`

### `usePlayer(whepUrl, options?)`

Returns: `{ state, error, play, stop, videoRef }`

## License

MIT
