import { vi } from "vitest";
import type {
  PeerConnectionFactory,
  FetchFn,
  TimerProvider,
  MediaStreamFactory,
} from "../src/internal/dependencies";

export interface MockPeerConnection {
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  iceGatheringState: RTCIceGatheringState;
  localDescription: RTCSessionDescription | null;
  onconnectionstatechange: (() => void) | null;
  oniceconnectionstatechange: (() => void) | null;
  ontrack: ((event: RTCTrackEvent) => void) | null;
  addTrack: ReturnType<typeof vi.fn>;
  addTransceiver: ReturnType<typeof vi.fn>;
  createOffer: ReturnType<typeof vi.fn>;
  setLocalDescription: ReturnType<typeof vi.fn>;
  setRemoteDescription: ReturnType<typeof vi.fn>;
  getSenders: ReturnType<typeof vi.fn>;
  getTransceivers: ReturnType<typeof vi.fn>;
  getStats: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  restartIce: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

export function createMockPeerConnection(): MockPeerConnection {
  return {
    connectionState: "new",
    iceConnectionState: "new",
    iceGatheringState: "complete",
    localDescription: { sdp: "mock-offer-sdp", type: "offer" } as RTCSessionDescription,
    onconnectionstatechange: null,
    oniceconnectionstatechange: null,
    ontrack: null,
    addTrack: vi.fn().mockReturnValue({ track: null }),
    addTransceiver: vi.fn().mockReturnValue({
      sender: { track: null },
      setCodecPreferences: vi.fn(),
    }),
    createOffer: vi.fn().mockResolvedValue({ sdp: "mock-offer-sdp", type: "offer" }),
    setLocalDescription: vi.fn().mockResolvedValue(undefined),
    setRemoteDescription: vi.fn().mockResolvedValue(undefined),
    getSenders: vi.fn().mockReturnValue([]),
    getTransceivers: vi.fn().mockReturnValue([]),
    getStats: vi.fn().mockResolvedValue(new Map()),
    close: vi.fn(),
    restartIce: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

export function createMockPeerConnectionFactory(
  mockPc?: MockPeerConnection,
): PeerConnectionFactory & { mockPc: MockPeerConnection } {
  const pc = mockPc ?? createMockPeerConnection();
  return {
    create: () => pc as unknown as RTCPeerConnection,
    mockPc: pc,
  };
}

export interface MockMediaStreamTrack {
  kind: "video" | "audio";
  contentHint: string;
  stop: ReturnType<typeof vi.fn>;
}

export function createMockMediaStreamTrack(
  kind: "video" | "audio",
): MockMediaStreamTrack {
  return {
    kind,
    contentHint: "",
    stop: vi.fn(),
  };
}

export function createMockMediaStream(): MediaStream {
  const videoTrack = createMockMediaStreamTrack("video");
  const audioTrack = createMockMediaStreamTrack("audio");
  return {
    getVideoTracks: () => [videoTrack as unknown as MediaStreamTrack],
    getAudioTracks: () => [audioTrack as unknown as MediaStreamTrack],
    getTracks: () => [
      videoTrack as unknown as MediaStreamTrack,
      audioTrack as unknown as MediaStreamTrack,
    ],
    addTrack: vi.fn(),
  } as unknown as MediaStream;
}

export function createMockMediaStreamFactory(): MediaStreamFactory & { mockStream: MediaStream } {
  const mockStream = createMockMediaStream();
  return {
    create: () => mockStream,
    mockStream,
  };
}

export interface MockResponse {
  ok: boolean;
  status: number;
  statusText: string;
  url: string;
  headers: Headers;
  text: ReturnType<typeof vi.fn>;
}

export function createMockResponse(options: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
}): MockResponse {
  const headers = new Headers(options.headers ?? {});
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    statusText: options.statusText ?? "OK",
    url: options.url ?? "https://server/whip",
    headers,
    text: vi.fn().mockResolvedValue(options.body ?? "mock-answer-sdp"),
  };
}

export interface MockFetch {
  (input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  mockResolvedValue: (value: MockResponse) => void;
  mockRejectedValue: (error: Error) => void;
  mockClear: () => void;
  calls: Array<{ input: RequestInfo | URL; init?: RequestInit }>;
}

export function createMockFetch(): MockFetch {
  let resolvedValue: MockResponse | null = null;
  let rejectedError: Error | null = null;
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];

  const fetchFn = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    if (rejectedError) {
      throw rejectedError;
    }
    return resolvedValue as unknown as Response;
  };

  (fetchFn as MockFetch).mockResolvedValue = (value: MockResponse) => {
    resolvedValue = value;
    rejectedError = null;
  };

  (fetchFn as MockFetch).mockRejectedValue = (error: Error) => {
    rejectedError = error;
    resolvedValue = null;
  };

  (fetchFn as MockFetch).mockClear = () => {
    calls.length = 0;
  };

  (fetchFn as MockFetch).calls = calls;

  return fetchFn as MockFetch;
}

export interface FakeTimers extends TimerProvider {
  timers: Map<number, { callback: () => void; delay: number; type: "timeout" | "interval"; remaining: number }>;
  advanceTimersByTime: (ms: number) => Promise<void>;
  runAllTimers: () => Promise<void>;
}

export function createFakeTimers(): FakeTimers {
  let nextId = 1;
  const timers = new Map<number, { callback: () => void; delay: number; type: "timeout" | "interval"; remaining: number }>();

  const fakeTimers: FakeTimers = {
    timers,
    setTimeout: (callback: () => void, delay: number) => {
      const id = nextId++;
      timers.set(id, { callback, delay, type: "timeout", remaining: delay });
      return id;
    },
    clearTimeout: (id: number) => {
      timers.delete(id);
    },
    setInterval: (callback: () => void, delay: number) => {
      const id = nextId++;
      timers.set(id, { callback, delay, type: "interval", remaining: delay });
      return id;
    },
    clearInterval: (id: number) => {
      timers.delete(id);
    },
    advanceTimersByTime: async (ms: number) => {
      for (const [id, timer] of timers.entries()) {
        timer.remaining -= ms;
        if (timer.remaining <= 0) {
          await Promise.resolve().then(() => timer.callback());
          if (timer.type === "timeout") {
            timers.delete(id);
          } else {
            timer.remaining = timer.delay;
          }
        }
      }
      await Promise.resolve();
    },
    runAllTimers: async () => {
      const toRun = Array.from(timers.entries());
      for (const [id, timer] of toRun) {
        await Promise.resolve().then(() => timer.callback());
        if (timer.type === "timeout") {
          timers.delete(id);
        }
      }
      await Promise.resolve();
    },
  };

  return fakeTimers;
}
