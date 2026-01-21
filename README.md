# daydream-browser

WebRTC streaming SDK for [Daydream](https://daydream.live) — real-time AI video processing.

## Packages

| Package                                       | Description        |
| --------------------------------------------- | ------------------ |
| [`@daydreamlive/browser`](./packages/browser) | Core WebRTC client |
| [`@daydreamlive/react`](./packages/react)     | React hooks        |

## Quick Start

```bash
npm install @daydreamlive/browser
npm install @daydreamlive/react
```

## Examples

| Example | Description | Demo |
| ------- | ----------- | ---- |
| [with-react](./examples/with-react) | Basic React hooks usage | [Live Demo](https://daydream-browser-kohl.preview.livepeer.monster) |
| [with-compositor](./examples/with-compositor) | Canvas composition + streaming | [Live Demo](https://daydream-browser-zeta.preview.livepeer.monster) |
| [with-screen-share](./examples/with-screen-share) | Screen capture with AI processing | [Live Demo](https://with-screen-share-lime.preview.livepeer.monster) |
| [with-three](./examples/with-three) | Three.js canvas streaming | [Live Demo](https://with-three-git-main.preview.livepeer.monster) |
| [with-vanilla](./examples/with-vanilla) | Pure JS without React | — |

## Architecture

```
Backend (your server)          Browser
┌─────────────────────┐       ┌──────────────────────────┐
│  @daydreamlive/sdk  │       │  @daydreamlive/browser   │
│  - createStream()   │──────▶│  - WHIP (broadcast)      │
│  - updateStream()   │       │  - WHEP (playback)       │
└─────────────────────┘       └──────────────────────────┘
        │                              │
        └──────── whipUrl ─────────────┘
```

## License

MIT
