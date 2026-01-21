# Vanilla JS Example

Pure JavaScript implementation without React — demonstrates the core `@daydreamlive/browser` API.

## Features

- Express server with `@daydreamlive/sdk` for backend
- Vanilla JS frontend with `@daydreamlive/browser`
- No framework dependencies

## Setup

1. Create a `.env` file:

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
│                     Express Server                           │
│  server.js                                                   │
│  - POST /api/streams    → @daydreamlive/sdk createStream    │
│  - PATCH /api/streams/:id → @daydreamlive/sdk updateStream  │
└───────────────────────────┬─────────────────────────────────┘
                            │ JSON { id, whipUrl }
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Browser Client                           │
│  src/main.js                                                 │
│  - createBroadcast()  → @daydreamlive/browser               │
│  - createPlayer()     → @daydreamlive/browser               │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
with-vanilla/
├── server.js          # Express server + SDK
├── src/
│   └── main.js        # Browser SDK source (bundled by esbuild)
├── public/
│   ├── index.html
│   └── main.js        # Bundled output
└── package.json
```
