# Daydream Browser Client SDK

> ⚠️ **Under active development** — API may change without notice.

JavaScript SDK for real-time AI video streaming.

## Packages

| Package                | Description           |
| ---------------------- | --------------------- |
| `@daydreamlive/client` | Core WHIP/WHEP client |
| `@daydreamlive/react`  | React hooks           |

## Install

```bash
npm install @daydreamlive/client
npm install @daydreamlive/react  # for React
```

## Quick Start

### Vanilla JS

```js
import { DaydreamBroadcaster, DaydreamPlayer } from "@daydreamlive/client";

// Broadcast
const broadcaster = new DaydreamBroadcaster({ whipUrl });
broadcaster.on("connected", () => console.log("Live"));
await broadcaster.publish(mediaStream);

// Play
const player = new DaydreamPlayer({ whepUrl, videoElement });
player.on("playing", () => console.log("Playing"));
await player.play();
```

### React

```tsx
import { useBroadcaster, usePlayer } from "@daydreamlive/react";

function Broadcaster({ whipUrl }) {
  const { state, publish, stop } = useBroadcaster({ whipUrl });
  // ...
}

function Player({ whepUrl }) {
  const { state, videoRef } = usePlayer({ whepUrl, autoplay: true });
  return <video ref={videoRef} />;
}
```

## Development

```bash
npm install
npm run build
```

## License

MIT
