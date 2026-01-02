# Next.js Example

This demo shows how to use the Daydream SDK with Next.js:

- **Backend**: `@daydreamlive/sdk` via Server Actions
- **Frontend**: `@daydreamlive/browser` for WebRTC streaming

## Setup

1. Create a `.env.local` file:

```bash
DAYDREAM_API_KEY=your_api_key_here
```

2. Install dependencies:

```bash
npm install
```

3. Build the SDK packages:

```bash
cd ../..
npm run build --workspaces
```

4. Run the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Next.js Server                        │
│  Server Actions (src/app/actions.ts)                    │
│  - createStream()  → @daydreamlive/sdk                  │
│  - updateStream()  → @daydreamlive/sdk                  │
└───────────────────────┬─────────────────────────────────┘
                        │ whipUrl, whepUrl
                        ▼
┌─────────────────────────────────────────────────────────┐
│                   Browser Client                        │
│  - useBroadcast({ whipUrl })  → @daydreamlive/browser   │
│  - usePlayer(whepUrl)         → @daydreamlive/browser   │
└─────────────────────────────────────────────────────────┘
```
