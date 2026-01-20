import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useBroadcast } from "../src/useBroadcast";
import {
  createMockBroadcast,
  createMockError,
  createMockMediaStream,
} from "./mocks";

describe("useBroadcast", () => {
  const defaultOptions = {
    whipUrl: "https://example.com/whip",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with idle state", () => {
    const mockBroadcast = createMockBroadcast();
    const factory = vi.fn(() => mockBroadcast);

    const { result } = renderHook(() => useBroadcast(defaultOptions, factory));

    expect(result.current.status.state).toBe("idle");
  });

  it("should transition to connecting when start is called", async () => {
    const mockBroadcast = createMockBroadcast();
    const factory = vi.fn(() => mockBroadcast);
    const mockStream = createMockMediaStream();

    const { result } = renderHook(() => useBroadcast(defaultOptions, factory));

    await act(async () => {
      result.current.start(mockStream);
    });

    expect(factory).toHaveBeenCalledWith(
      expect.objectContaining({
        whipUrl: defaultOptions.whipUrl,
        stream: mockStream,
      }),
    );
  });

  it("should transition to live state after successful connect", async () => {
    const mockBroadcast = createMockBroadcast();
    mockBroadcast._whepUrl = "https://example.com/whep/123";
    mockBroadcast._state = "live";

    const factory = vi.fn(() => mockBroadcast);
    const mockStream = createMockMediaStream();

    const { result } = renderHook(() => useBroadcast(defaultOptions, factory));

    await act(async () => {
      await result.current.start(mockStream);
    });

    expect(result.current.status.state).toBe("live");
    if (result.current.status.state === "live") {
      expect(result.current.status.whepUrl).toBe(
        "https://example.com/whep/123",
      );
    }
  });

  it("should handle stateChange events", async () => {
    const mockBroadcast = createMockBroadcast();
    mockBroadcast._whepUrl = "https://example.com/whep/123";
    mockBroadcast._state = "live";

    const factory = vi.fn(() => mockBroadcast);
    const mockStream = createMockMediaStream();

    const { result } = renderHook(() => useBroadcast(defaultOptions, factory));

    await act(async () => {
      await result.current.start(mockStream);
    });

    // Simulate state change to ended
    act(() => {
      mockBroadcast.emit("stateChange", "ended");
    });

    expect(result.current.status.state).toBe("ended");
  });

  it("should handle reconnect events", async () => {
    const mockBroadcast = createMockBroadcast();
    mockBroadcast._whepUrl = "https://example.com/whep/123";
    mockBroadcast._state = "live";

    const factory = vi.fn(() => mockBroadcast);
    const mockStream = createMockMediaStream();

    const { result } = renderHook(() => useBroadcast(defaultOptions, factory));

    await act(async () => {
      await result.current.start(mockStream);
    });

    const reconnectInfo = { attempt: 1, maxAttempts: 5, delayMs: 1000 };

    act(() => {
      mockBroadcast.emit("reconnect", reconnectInfo);
    });

    expect(result.current.status.state).toBe("reconnecting");
    if (result.current.status.state === "reconnecting") {
      expect(result.current.status.reconnectInfo).toEqual(reconnectInfo);
      expect(result.current.status.whepUrl).toBe(
        "https://example.com/whep/123",
      );
    }
  });

  it("should handle error events", async () => {
    const mockBroadcast = createMockBroadcast();
    mockBroadcast._state = "live";
    mockBroadcast._whepUrl = "https://example.com/whep/123";

    const factory = vi.fn(() => mockBroadcast);
    const mockStream = createMockMediaStream();

    const { result } = renderHook(() => useBroadcast(defaultOptions, factory));

    await act(async () => {
      await result.current.start(mockStream);
    });

    const mockError = createMockError("NETWORK_ERROR", "Connection lost");

    act(() => {
      mockBroadcast.emit("error", mockError);
    });

    expect(result.current.status.state).toBe("error");
    if (result.current.status.state === "error") {
      expect(result.current.status.error.code).toBe("NETWORK_ERROR");
    }
  });

  it("should handle connection failure", async () => {
    const mockBroadcast = createMockBroadcast();
    const mockError = createMockError("CONNECTION_FAILED", "Failed to connect");
    mockBroadcast.connect.mockRejectedValue(mockError);

    const factory = vi.fn(() => mockBroadcast);
    const mockStream = createMockMediaStream();

    const { result } = renderHook(() => useBroadcast(defaultOptions, factory));

    await act(async () => {
      try {
        await result.current.start(mockStream);
      } catch {
        // Expected to throw
      }
    });

    expect(result.current.status.state).toBe("error");
    if (result.current.status.state === "error") {
      expect(result.current.status.error.code).toBe("CONNECTION_FAILED");
    }
  });

  it("should reset to idle when stop is called", async () => {
    const mockBroadcast = createMockBroadcast();
    mockBroadcast._state = "live";
    mockBroadcast._whepUrl = "https://example.com/whep/123";

    const factory = vi.fn(() => mockBroadcast);
    const mockStream = createMockMediaStream();

    const { result } = renderHook(() => useBroadcast(defaultOptions, factory));

    await act(async () => {
      await result.current.start(mockStream);
    });

    await act(async () => {
      await result.current.stop();
    });

    expect(result.current.status.state).toBe("idle");
    expect(mockBroadcast.stop).toHaveBeenCalled();
  });

  it("should call setMaxFramerate on broadcast", async () => {
    const mockBroadcast = createMockBroadcast();
    mockBroadcast._state = "live";
    mockBroadcast._whepUrl = "https://example.com/whep/123";

    const factory = vi.fn(() => mockBroadcast);
    const mockStream = createMockMediaStream();

    const { result } = renderHook(() => useBroadcast(defaultOptions, factory));

    await act(async () => {
      await result.current.start(mockStream);
    });

    act(() => {
      result.current.setMaxFramerate(30);
    });

    expect(mockBroadcast.setMaxFramerate).toHaveBeenCalledWith(30);
  });

  it("should stop broadcast on unmount", async () => {
    const mockBroadcast = createMockBroadcast();
    mockBroadcast._state = "live";
    mockBroadcast._whepUrl = "https://example.com/whep/123";

    const factory = vi.fn(() => mockBroadcast);
    const mockStream = createMockMediaStream();

    const { result, unmount } = renderHook(() =>
      useBroadcast(defaultOptions, factory),
    );

    await act(async () => {
      await result.current.start(mockStream);
    });

    unmount();

    expect(mockBroadcast.stop).toHaveBeenCalled();
  });

  it("should stop previous broadcast when starting new one", async () => {
    const mockBroadcast1 = createMockBroadcast();
    mockBroadcast1._state = "live";
    mockBroadcast1._whepUrl = "https://example.com/whep/1";

    const mockBroadcast2 = createMockBroadcast();
    mockBroadcast2._state = "live";
    mockBroadcast2._whepUrl = "https://example.com/whep/2";

    let callCount = 0;
    const factory = vi.fn(() => {
      callCount++;
      return callCount === 1 ? mockBroadcast1 : mockBroadcast2;
    });

    const mockStream = createMockMediaStream();

    const { result } = renderHook(() => useBroadcast(defaultOptions, factory));

    await act(async () => {
      await result.current.start(mockStream);
    });

    await act(async () => {
      await result.current.start(mockStream);
    });

    expect(mockBroadcast1.stop).toHaveBeenCalled();
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it("should ignore events from stopped broadcast", async () => {
    const mockBroadcast1 = createMockBroadcast();
    mockBroadcast1._state = "live";
    mockBroadcast1._whepUrl = "https://example.com/whep/1";

    const mockBroadcast2 = createMockBroadcast();
    mockBroadcast2._state = "live";
    mockBroadcast2._whepUrl = "https://example.com/whep/2";

    let callCount = 0;
    const factory = vi.fn(() => {
      callCount++;
      return callCount === 1 ? mockBroadcast1 : mockBroadcast2;
    });

    const mockStream = createMockMediaStream();

    const { result } = renderHook(() => useBroadcast(defaultOptions, factory));

    await act(async () => {
      await result.current.start(mockStream);
    });

    await act(async () => {
      await result.current.start(mockStream);
    });

    // Emit event from old broadcast - should be ignored
    act(() => {
      mockBroadcast1.emit("stateChange", "ended");
    });

    // Should still be live from broadcast2
    expect(result.current.status.state).toBe("live");
  });
});
