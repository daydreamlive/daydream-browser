import { describe, it, expect, beforeEach, vi } from "vitest";
import { WHIPClient } from "../internal/WHIPClient";
import { ConnectionError, NetworkError } from "../errors";
import {
  createMockPeerConnectionFactory,
  createMockMediaStream,
  createMockFetch,
  createMockResponse,
  createFakeTimers,
  type MockFetch,
} from "./mocks";

describe("WHIPClient", () => {
  let mockPcFactory: ReturnType<typeof createMockPeerConnectionFactory>;
  let mockFetch: MockFetch;
  let fakeTimers: ReturnType<typeof createFakeTimers>;
  let mockStream: MediaStream;

  beforeEach(() => {
    mockPcFactory = createMockPeerConnectionFactory();
    mockFetch = createMockFetch();
    fakeTimers = createFakeTimers();
    mockStream = createMockMediaStream();
  });

  describe("connect", () => {
    it("should establish connection successfully", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          ok: true,
          url: "https://server/whip/resource",
          headers: { location: "/resource/123" },
          body: "mock-answer-sdp",
        }),
      );

      const client = new WHIPClient({
        url: "https://server/whip",
        peerConnectionFactory: mockPcFactory,
        fetch: mockFetch,
        timers: fakeTimers,
      });

      const result = await client.connect(mockStream);

      expect(mockPcFactory.mockPc.createOffer).toHaveBeenCalled();
      expect(mockPcFactory.mockPc.setLocalDescription).toHaveBeenCalled();
      expect(mockFetch.calls).toHaveLength(1);
      expect(mockFetch.calls[0]?.input).toBe("https://server/whip");
      expect(mockFetch.calls[0]?.init?.method).toBe("POST");
      expect(mockPcFactory.mockPc.setRemoteDescription).toHaveBeenCalledWith({
        type: "answer",
        sdp: "mock-answer-sdp",
      });
      expect(result.whepUrl).toBeNull();
    });

    it("should return whepUrl from onResponse handler", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          ok: true,
          headers: { "livepeer-playback-url": "https://player/whep/abc" },
          body: "mock-answer-sdp",
        }),
      );

      const client = new WHIPClient({
        url: "https://server/whip",
        peerConnectionFactory: mockPcFactory,
        fetch: mockFetch,
        timers: fakeTimers,
        onResponse: (response) => ({
          whepUrl: response.headers.get("livepeer-playback-url") ?? undefined,
        }),
      });

      const result = await client.connect(mockStream);

      expect(result.whepUrl).toBe("https://player/whep/abc");
    });

    it("should throw ConnectionError on HTTP error", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 403,
          statusText: "Forbidden",
          body: "Access denied",
        }),
      );

      const client = new WHIPClient({
        url: "https://server/whip",
        peerConnectionFactory: mockPcFactory,
        fetch: mockFetch,
        timers: fakeTimers,
      });

      await expect(client.connect(mockStream)).rejects.toThrow(ConnectionError);
    });

    it("should throw NetworkError on timeout", async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValue(abortError);

      const client = new WHIPClient({
        url: "https://server/whip",
        peerConnectionFactory: mockPcFactory,
        fetch: mockFetch,
        timers: fakeTimers,
      });

      await expect(client.connect(mockStream)).rejects.toThrow(NetworkError);
    });

    it("should throw NetworkError on network failure", async () => {
      mockFetch.mockRejectedValue(new Error("Network failure"));

      const client = new WHIPClient({
        url: "https://server/whip",
        peerConnectionFactory: mockPcFactory,
        fetch: mockFetch,
        timers: fakeTimers,
      });

      await expect(client.connect(mockStream)).rejects.toThrow(NetworkError);
    });

    it("should add tracks from MediaStream", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ ok: true, body: "mock-answer-sdp" }),
      );

      const client = new WHIPClient({
        url: "https://server/whip",
        peerConnectionFactory: mockPcFactory,
        fetch: mockFetch,
        timers: fakeTimers,
      });

      await client.connect(mockStream);

      expect(mockPcFactory.mockPc.addTrack).toHaveBeenCalledTimes(2);
    });
  });

  describe("disconnect", () => {
    it("should send DELETE request to resource URL", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          ok: true,
          headers: { location: "https://server/whip/resource/123" },
          body: "mock-answer-sdp",
        }),
      );

      const client = new WHIPClient({
        url: "https://server/whip",
        peerConnectionFactory: mockPcFactory,
        fetch: mockFetch,
        timers: fakeTimers,
      });

      await client.connect(mockStream);
      mockFetch.mockClear();
      mockFetch.mockResolvedValue(createMockResponse({ ok: true }));

      await client.disconnect();

      expect(mockFetch.calls).toHaveLength(1);
      expect(mockFetch.calls[0]?.input).toBe("https://server/whip/resource/123");
      expect(mockFetch.calls[0]?.init?.method).toBe("DELETE");
    });

    it("should close peer connection", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ ok: true, body: "mock-answer-sdp" }),
      );

      const client = new WHIPClient({
        url: "https://server/whip",
        peerConnectionFactory: mockPcFactory,
        fetch: mockFetch,
        timers: fakeTimers,
      });

      await client.connect(mockStream);
      await client.disconnect();

      expect(mockPcFactory.mockPc.close).toHaveBeenCalled();
    });
  });

  describe("isConnected", () => {
    it("should return false when not connected", () => {
      const client = new WHIPClient({
        url: "https://server/whip",
        peerConnectionFactory: mockPcFactory,
        fetch: mockFetch,
        timers: fakeTimers,
      });

      expect(client.isConnected()).toBe(false);
    });

    it("should return true when connection state is connected", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ ok: true, body: "mock-answer-sdp" }),
      );
      mockPcFactory.mockPc.connectionState = "connected";

      const client = new WHIPClient({
        url: "https://server/whip",
        peerConnectionFactory: mockPcFactory,
        fetch: mockFetch,
        timers: fakeTimers,
      });

      await client.connect(mockStream);

      expect(client.isConnected()).toBe(true);
    });
  });

  describe("getPeerConnection", () => {
    it("should return null before connect", () => {
      const client = new WHIPClient({
        url: "https://server/whip",
        peerConnectionFactory: mockPcFactory,
        fetch: mockFetch,
        timers: fakeTimers,
      });

      expect(client.getPeerConnection()).toBeNull();
    });

    it("should return peer connection after connect", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ ok: true, body: "mock-answer-sdp" }),
      );

      const client = new WHIPClient({
        url: "https://server/whip",
        peerConnectionFactory: mockPcFactory,
        fetch: mockFetch,
        timers: fakeTimers,
      });

      await client.connect(mockStream);

      expect(client.getPeerConnection()).toBe(mockPcFactory.mockPc);
    });
  });

  describe("stats collection", () => {
    it("should call onStats periodically when provided", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ ok: true, body: "mock-answer-sdp" }),
      );

      const onStats = vi.fn();
      const client = new WHIPClient({
        url: "https://server/whip",
        peerConnectionFactory: mockPcFactory,
        fetch: mockFetch,
        timers: fakeTimers,
        onStats,
        statsIntervalMs: 1000,
      });

      await client.connect(mockStream);
      await fakeTimers.advanceTimersByTime(1000);

      expect(onStats).toHaveBeenCalled();
    });
  });
});
