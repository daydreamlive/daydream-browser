# @daydreamlive/browser

WebRTC client for Daydream. Framework-agnostic, zero dependencies.

## Install

```bash
npm install @daydreamlive/browser
```

## Usage

### Broadcast

```typescript
import { createBroadcast } from "@daydreamlive/browser";

const stream = await navigator.mediaDevices.getUserMedia({ video: true });

const broadcast = createBroadcast({
  whipUrl: "https://...", // from your backend via @daydreamlive/sdk
  stream,
});

broadcast.on("stateChange", (state) => {
  console.log(state); // 'connecting' | 'live' | 'reconnecting' | 'ended' | 'error'
});

await broadcast.connect();

// WHEP URL is available after connection
console.log(broadcast.whepUrl);

// Stop
await broadcast.stop();
```

### Player

```typescript
import { createPlayer } from "@daydreamlive/browser";

const player = createPlayer(whepUrl);

player.on("stateChange", (state) => {
  console.log(state); // 'connecting' | 'playing' | 'buffering' | 'ended' | 'error'
});

await player.connect();
player.attachTo(document.querySelector("video"));

// Stop
player.stop();
```

## API

### `createBroadcast(options)`

| Option      | Type              | Description                 |
| ----------- | ----------------- | --------------------------- |
| `whipUrl`   | `string`          | WHIP endpoint URL           |
| `stream`    | `MediaStream`     | Media stream to broadcast   |
| `reconnect` | `ReconnectConfig` | Reconnection settings       |
| `video`     | `VideoConfig`     | Bitrate, framerate settings |

### `createPlayer(whepUrl, options?)`

| Option      | Type              | Description           |
| ----------- | ----------------- | --------------------- |
| `reconnect` | `ReconnectConfig` | Reconnection settings |

## License

MIT
