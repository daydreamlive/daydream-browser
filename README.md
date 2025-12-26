# daydream-browser

WebRTC streaming SDK for [Daydream](https://daydream.live) — real-time AI video processing.

## Packages

| Package                                       | Description                             |
| --------------------------------------------- | --------------------------------------- |
| [`@daydreamlive/browser`](./packages/browser) | Core WebRTC client (framework-agnostic) |
| [`@daydreamlive/react`](./packages/react)     | React hooks                             |

## Quick Start

```bash
npm install @daydreamlive/browser
# or with React
npm install @daydreamlive/react
```

See [examples/nextjs](./examples/nextjs) for a full working example.

## Architecture

```
Backend (your server)          Browser
┌─────────────────────┐       ┌──────────────────────────┐
│  daydream-sdk       │       │  @daydreamlive/browser   │
│  - createStream()   │──────▶│  - WHIP (broadcast)      │
│  - updateStream()   │       │  - WHEP (playback)       │
└─────────────────────┘       └──────────────────────────┘
        │                              │
        └──────── whipUrl ─────────────┘
```

## License

MIT
