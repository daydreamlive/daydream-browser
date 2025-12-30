import { describe, it, expect, beforeEach } from "vitest";
import { WHEPClient } from "../src/internal/WHEPClient";
import { ConnectionError, NetworkError } from "../src/errors";
import {
  createMockPeerConnectionFactory,
  createMockFetch,
  createMockResponse,
  createFakeTimers,
  createMockMediaStreamFactory,
  type MockFetch,
} from "./mocks";

describe("WHEPClient", () => {
  let mockPcFactory: ReturnType<typeof createMockPeerConnectionFactory>;
  let mockFetch: MockFetch;
  let fakeTimers: ReturnType<typeof createFakeTimers>;
  let mockMediaStreamFactory: ReturnType<typeof createMockMediaStreamFactory>;

  beforeEach(() => {
    mockPcFactory = createMockPeerConnectionFactory();
    mockFetch = createMockFetch();
    fakeTimers = createFakeTimers();
    mockMediaStreamFactory = createMockMediaStreamFactory();
  });

  describe("connect", () => {
    it("should establish connection and return MediaStream", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          ok: true,
          headers: { location: "/resource/123" },
          body: "mock-answer-sdp",
        }),
      );

      const client = new WHEPClient({
        url: "https://server/whep",
        peerConnectionFactory: mockPcFactory,
        fetch: mockFetch,
        timers: fakeTimers,
        mediaStreamFactory: mockMediaStreamFactory,
      });

      const stream = await client.connect();

      expect(stream).toBe(mockMediaStreamFactory.mockStream);
      expect(mockPcFactory.mockPc.createOffer).toHaveBeenCalled();
      expect(mockPcFactory.mockPc.setLocalDescription).toHaveBeenCalled();
      expect(mockFetch.calls).toHaveLength(1);
      expect(mockFetch.calls[0]?.input).toBe("https://server/whep");
      expect(mockFetch.calls[0]?.init?.method).toBe("POST");
      expect(mockPcFactory.mockPc.setRemoteDescription).toHaveBeenCalledWith({
        type: "answer",
        sdp: "mock-answer-sdp",
      });
    });

    it("should add recvonly transceivers", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ ok: true, body: "mock-answer-sdp" }),
      );

      const client = new WHEPClient({
        url: "https://server/whep",
        peerConnectionFactory: mockPcFactory,
        fetch: mockFetch,
        timers: fakeTimers,
        mediaStreamFactory: mockMediaStreamFactory,
      });

      await client.connect();

      expect(mockPcFactory.mockPc.addTransceiver).toHaveBeenCalledWith(
        "video",
        {
          direction: "recvonly",
        },
      );
      expect(mockPcFactory.mockPc.addTransceiver).toHaveBeenCalledWith(
        "audio",
        {
          direction: "recvonly",
        },
      );
    });

    it("should throw ConnectionError on HTTP error", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 404,
          statusText: "Not Found",
          body: "Stream not found",
        }),
      );

      const client = new WHEPClient({
        url: "https://server/whep",
        peerConnectionFactory: mockPcFactory,
        fetch: mockFetch,
        timers: fakeTimers,
        mediaStreamFactory: mockMediaStreamFactory,
      });

      await expect(client.connect()).rejects.toThrow(ConnectionError);
    });

    it("should throw NetworkError on timeout", async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValue(abortError);

      const client = new WHEPClient({
        url: "https://server/whep",
        peerConnectionFactory: mockPcFactory,
        fetch: mockFetch,
        timers: fakeTimers,
        mediaStreamFactory: mockMediaStreamFactory,
      });

      await expect(client.connect()).rejects.toThrow(NetworkError);
    });

    it("should throw NetworkError on network failure", async () => {
      mockFetch.mockRejectedValue(new Error("Network failure"));

      const client = new WHEPClient({
        url: "https://server/whep",
        peerConnectionFactory: mockPcFactory,
        fetch: mockFetch,
        timers: fakeTimers,
        mediaStreamFactory: mockMediaStreamFactory,
      });

      await expect(client.connect()).rejects.toThrow(NetworkError);
    });
  });

  describe("disconnect", () => {
    it("should send DELETE request to resource URL", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          ok: true,
          headers: { location: "/resource/123" },
          body: "mock-answer-sdp",
        }),
      );

      const client = new WHEPClient({
        url: "https://server/whep",
        peerConnectionFactory: mockPcFactory,
        fetch: mockFetch,
        timers: fakeTimers,
        mediaStreamFactory: mockMediaStreamFactory,
      });

      await client.connect();
      mockFetch.mockClear();
      mockFetch.mockResolvedValue(createMockResponse({ ok: true }));

      await client.disconnect();

      expect(mockFetch.calls).toHaveLength(1);
      expect(mockFetch.calls[0]?.input).toBe("https://server/resource/123");
      expect(mockFetch.calls[0]?.init?.method).toBe("DELETE");
    });

    it("should close peer connection", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ ok: true, body: "mock-answer-sdp" }),
      );

      const client = new WHEPClient({
        url: "https://server/whep",
        peerConnectionFactory: mockPcFactory,
        fetch: mockFetch,
        timers: fakeTimers,
        mediaStreamFactory: mockMediaStreamFactory,
      });

      await client.connect();
      await client.disconnect();

      expect(mockPcFactory.mockPc.close).toHaveBeenCalled();
    });

    it("should clear stream reference", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ ok: true, body: "mock-answer-sdp" }),
      );

      const client = new WHEPClient({
        url: "https://server/whep",
        peerConnectionFactory: mockPcFactory,
        fetch: mockFetch,
        timers: fakeTimers,
        mediaStreamFactory: mockMediaStreamFactory,
      });

      await client.connect();
      expect(client.getStream()).not.toBeNull();

      await client.disconnect();
      expect(client.getStream()).toBeNull();
    });
  });

  describe("getStream", () => {
    it("should return null before connect", () => {
      const client = new WHEPClient({
        url: "https://server/whep",
        peerConnectionFactory: mockPcFactory,
        fetch: mockFetch,
        timers: fakeTimers,
        mediaStreamFactory: mockMediaStreamFactory,
      });

      expect(client.getStream()).toBeNull();
    });
  });

  describe("getPeerConnection", () => {
    it("should return null before connect", () => {
      const client = new WHEPClient({
        url: "https://server/whep",
        peerConnectionFactory: mockPcFactory,
        fetch: mockFetch,
        timers: fakeTimers,
        mediaStreamFactory: mockMediaStreamFactory,
      });

      expect(client.getPeerConnection()).toBeNull();
    });

    it("should return peer connection after connect", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ ok: true, body: "mock-answer-sdp" }),
      );

      const client = new WHEPClient({
        url: "https://server/whep",
        peerConnectionFactory: mockPcFactory,
        fetch: mockFetch,
        timers: fakeTimers,
        mediaStreamFactory: mockMediaStreamFactory,
      });

      await client.connect();

      expect(client.getPeerConnection()).toBe(mockPcFactory.mockPc);
    });
  });
});
