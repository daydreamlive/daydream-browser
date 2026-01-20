import { vi } from "vitest";
import type {
  Broadcast,
  BroadcastState,
  BroadcastEventMap,
  Player,
  PlayerState,
  PlayerEventMap,
  ReconnectInfo,
  DaydreamError,
} from "@daydreamlive/browser";

type EventHandler<T extends Record<string, (...args: unknown[]) => void>> = {
  [K in keyof T]?: Set<T[K]>;
};

export function createMockBroadcast(
  initialState: BroadcastState = "connecting",
): Broadcast & {
  emit: <E extends keyof BroadcastEventMap>(
    event: E,
    ...args: Parameters<BroadcastEventMap[E]>
  ) => void;
  _state: BroadcastState;
  _whepUrl: string | null;
} {
  let state: BroadcastState = initialState;
  let whepUrl: string | null = null;
  const handlers: EventHandler<BroadcastEventMap> = {};

  const mock = {
    get state() {
      return state;
    },
    set _state(s: BroadcastState) {
      state = s;
    },
    get whepUrl() {
      return whepUrl;
    },
    set _whepUrl(url: string | null) {
      whepUrl = url;
    },
    get stream() {
      return new MediaStream();
    },
    get reconnectInfo(): ReconnectInfo | null {
      return null;
    },

    connect: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    setMaxFramerate: vi.fn(),
    replaceStream: vi.fn().mockResolvedValue(undefined),

    on: vi.fn(
      <E extends keyof BroadcastEventMap>(
        event: E,
        handler: BroadcastEventMap[E],
      ) => {
        if (!handlers[event]) {
          handlers[event] = new Set();
        }
        handlers[event]!.add(handler);
        return () => {
          handlers[event]?.delete(handler);
        };
      },
    ),

    emit: <E extends keyof BroadcastEventMap>(
      event: E,
      ...args: Parameters<BroadcastEventMap[E]>
    ) => {
      handlers[event]?.forEach((handler) => {
        (handler as (...args: Parameters<BroadcastEventMap[E]>) => void)(
          ...args,
        );
      });
    },

    clearListeners: vi.fn(() => {
      Object.keys(handlers).forEach((key) => {
        delete handlers[key as keyof BroadcastEventMap];
      });
    }),
  };

  return mock as unknown as Broadcast & {
    emit: <E extends keyof BroadcastEventMap>(
      event: E,
      ...args: Parameters<BroadcastEventMap[E]>
    ) => void;
    _state: BroadcastState;
    _whepUrl: string | null;
  };
}

export function createMockPlayer(
  initialState: PlayerState = "connecting",
): Player & {
  emit: <E extends keyof PlayerEventMap>(
    event: E,
    ...args: Parameters<PlayerEventMap[E]>
  ) => void;
  _state: PlayerState;
  _stream: MediaStream | null;
} {
  let state: PlayerState = initialState;
  let stream: MediaStream | null = null;
  const handlers: EventHandler<PlayerEventMap> = {};

  const mock = {
    get state() {
      return state;
    },
    set _state(s: PlayerState) {
      state = s;
    },
    get stream() {
      return stream;
    },
    set _stream(s: MediaStream | null) {
      stream = s;
    },
    get reconnectInfo(): ReconnectInfo | null {
      return null;
    },

    connect: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    attachTo: vi.fn(),

    on: vi.fn(
      <E extends keyof PlayerEventMap>(
        event: E,
        handler: PlayerEventMap[E],
      ) => {
        if (!handlers[event]) {
          handlers[event] = new Set();
        }
        handlers[event]!.add(handler);
        return () => {
          handlers[event]?.delete(handler);
        };
      },
    ),

    emit: <E extends keyof PlayerEventMap>(
      event: E,
      ...args: Parameters<PlayerEventMap[E]>
    ) => {
      handlers[event]?.forEach((handler) => {
        (handler as (...args: Parameters<PlayerEventMap[E]>) => void)(...args);
      });
    },

    clearListeners: vi.fn(() => {
      Object.keys(handlers).forEach((key) => {
        delete handlers[key as keyof PlayerEventMap];
      });
    }),
  };

  return mock as unknown as Player & {
    emit: <E extends keyof PlayerEventMap>(
      event: E,
      ...args: Parameters<PlayerEventMap[E]>
    ) => void;
    _state: PlayerState;
    _stream: MediaStream | null;
  };
}

export function createMockError(
  code: DaydreamError["code"] = "CONNECTION_FAILED",
  message = "Mock error",
): DaydreamError {
  const error = new Error(message) as DaydreamError;
  error.code = code;
  return error;
}

export function createMockMediaStream(): MediaStream {
  return {
    id: "mock-stream-id",
    active: true,
    getVideoTracks: () => [],
    getAudioTracks: () => [],
    getTracks: () => [],
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    clone: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaStream;
}
