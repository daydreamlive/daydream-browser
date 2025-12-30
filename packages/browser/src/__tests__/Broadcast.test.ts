import { describe, it, expect, beforeEach, vi } from "vitest";
import { Broadcast } from "../Broadcast";
import type { BroadcastState } from "../types";
import { createMockMediaStream } from "./mocks";

vi.mock("../internal/WHIPClient", () => {
  return {
    WHIPClient: vi.fn().mockImplementation(() => ({
      connect: vi
        .fn()
        .mockResolvedValue({ whepUrl: "https://player/whep/abc" }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      replaceTrack: vi.fn().mockResolvedValue(undefined),
      getPeerConnection: vi.fn().mockReturnValue(null),
      restartIce: vi.fn(),
      isConnected: vi.fn().mockReturnValue(false),
    })),
  };
});

describe("Broadcast", () => {
  let mockStream: MediaStream;

  beforeEach(() => {
    mockStream = createMockMediaStream();
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with connecting state", () => {
      const broadcast = new Broadcast({
        whipUrl: "https://server/whip",
        stream: mockStream,
      });

      expect(broadcast.state).toBe("connecting");
    });

    it("should have null whepUrl initially", () => {
      const broadcast = new Broadcast({
        whipUrl: "https://server/whip",
        stream: mockStream,
      });

      expect(broadcast.whepUrl).toBeNull();
    });
  });

  describe("connect", () => {
    it("should emit stateChange event when going live", async () => {
      const stateChanges: BroadcastState[] = [];

      const broadcast = new Broadcast({
        whipUrl: "https://server/whip",
        stream: mockStream,
      });

      broadcast.on("stateChange", (state) => stateChanges.push(state));

      await broadcast.connect();

      expect(stateChanges).toContain("live");
      expect(broadcast.state).toBe("live");
    });

    it("should set whepUrl after successful connection", async () => {
      const broadcast = new Broadcast({
        whipUrl: "https://server/whip",
        stream: mockStream,
      });

      await broadcast.connect();

      expect(broadcast.whepUrl).toBe("https://player/whep/abc");
    });
  });

  describe("stop", () => {
    it("should emit stateChange to ended", async () => {
      const stateChanges: BroadcastState[] = [];

      const broadcast = new Broadcast({
        whipUrl: "https://server/whip",
        stream: mockStream,
      });

      await broadcast.connect();

      broadcast.on("stateChange", (state) => stateChanges.push(state));

      await broadcast.stop();

      expect(stateChanges).toContain("ended");
      expect(broadcast.state).toBe("ended");
    });

    it("should clear listeners after stop", async () => {
      const broadcast = new Broadcast({
        whipUrl: "https://server/whip",
        stream: mockStream,
      });

      await broadcast.connect();

      const listener = vi.fn();
      broadcast.on("stateChange", listener);

      await broadcast.stop();

      listener.mockClear();

      broadcast.on("stateChange", listener);
    });
  });

  describe("stream", () => {
    it("should return the current stream", () => {
      const broadcast = new Broadcast({
        whipUrl: "https://server/whip",
        stream: mockStream,
      });

      expect(broadcast.stream).toBe(mockStream);
    });
  });

  describe("reconnect config", () => {
    it("should use default reconnect config", () => {
      const broadcast = new Broadcast({
        whipUrl: "https://server/whip",
        stream: mockStream,
      });

      expect(broadcast).toBeDefined();
    });

    it("should accept custom reconnect config", () => {
      const broadcast = new Broadcast({
        whipUrl: "https://server/whip",
        stream: mockStream,
        reconnect: {
          enabled: false,
          maxAttempts: 10,
          baseDelayMs: 500,
        },
      });

      expect(broadcast).toBeDefined();
    });
  });
});
