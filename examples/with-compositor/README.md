# Compositor Example

Canvas-based source composition with real-time AI video streaming.

**[Live Demo](https://daydream-browser-zeta.preview.livepeer.monster)**

## Features

- Multiple canvas sources (particles, metaballs, flow fields, etc.)
- Hot-swap between sources without interrupting the stream
- Real-time prompt updates during streaming

## Setup

1. Create a `.env.local` file:

```bash
DAYDREAM_API_KEY=your_api_key_here
```

2. Install dependencies:

```bash
npm install
```

3. Run the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Components                         │
│  Canvas Sources (Balls, Particles, Metaballs, ...)          │
│  └─ useSource() → registers with CompositorProvider         │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                   CompositorProvider                         │
│  - Manages canvas sources                                    │
│  - Outputs composited MediaStream                            │
│  - useCompositor() → { stream, activate, sources }          │
└───────────────────────────┬─────────────────────────────────┘
                            │ MediaStream
┌───────────────────────────▼─────────────────────────────────┐
│                      useBroadcast()                          │
│  - WHIP broadcast to Daydream                                │
│  - Returns whepUrl for AI-processed output                   │
└───────────────────────────┬─────────────────────────────────┘
                            │ whepUrl
┌───────────────────────────▼─────────────────────────────────┐
│                       usePlayer()                            │
│  - WHEP playback of AI-processed stream                      │
└─────────────────────────────────────────────────────────────┘
```
