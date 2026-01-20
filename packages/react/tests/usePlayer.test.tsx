import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePlayer } from "../src/usePlayer";
import { createMockPlayer, createMockError, createMockMediaStream } from "./mocks";

describe("usePlayer", () => {
  const defaultOptions = {
    whepUrl: "https://example.com/whep/123",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with idle state", () => {
    const mockPlayer = createMockPlayer();
    const factory = vi.fn(() => mockPlayer);

    const { result } = renderHook(() => usePlayer(defaultOptions, factory));

    expect(result.current.status.state).toBe("idle");
  });

  it("should provide a videoRef", () => {
    const mockPlayer = createMockPlayer();
    const factory = vi.fn(() => mockPlayer);

    const { result } = renderHook(() => usePlayer(defaultOptions, factory));

    expect(result.current.videoRef).toBeDefined();
    expect(result.current.videoRef.current).toBeNull();
  });

  it("should not play when whepUrl is null", async () => {
    const mockPlayer = createMockPlayer();
    const factory = vi.fn(() => mockPlayer);

    const { result } = renderHook(() =>
      usePlayer({ whepUrl: null }, factory),
    );

    await act(async () => {
      await result.current.play();
    });

    expect(factory).not.toHaveBeenCalled();
    expect(result.current.status.state).toBe("idle");
  });

  it("should transition to connecting when play is called", async () => {
    const mockPlayer = createMockPlayer();
    mockPlayer._state = "playing";
    mockPlayer._stream = createMockMediaStream();

    const factory = vi.fn(() => mockPlayer);

    const { result } = renderHook(() => usePlayer(defaultOptions, factory));

    await act(async () => {
      await result.current.play();
    });

    expect(factory).toHaveBeenCalledWith(
      defaultOptions.whepUrl,
      expect.any(Object),
    );
  });

  it("should transition to playing state after successful connect", async () => {
    const mockPlayer = createMockPlayer();
    mockPlayer._state = "playing";
    mockPlayer._stream = createMockMediaStream();

    const factory = vi.fn(() => mockPlayer);

    const { result } = renderHook(() => usePlayer(defaultOptions, factory));

    await act(async () => {
      await result.current.play();
    });

    expect(result.current.status.state).toBe("playing");
  });

  it("should handle stateChange events", async () => {
    const mockPlayer = createMockPlayer();
    mockPlayer._state = "playing";
    mockPlayer._stream = createMockMediaStream();

    const factory = vi.fn(() => mockPlayer);

    const { result } = renderHook(() => usePlayer(defaultOptions, factory));

    await act(async () => {
      await result.current.play();
    });

    act(() => {
      mockPlayer.emit("stateChange", "ended");
    });

    expect(result.current.status.state).toBe("ended");
  });

  it("should handle reconnect events", async () => {
    const mockPlayer = createMockPlayer();
    mockPlayer._state = "playing";
    mockPlayer._stream = createMockMediaStream();

    const factory = vi.fn(() => mockPlayer);

    const { result } = renderHook(() => usePlayer(defaultOptions, factory));

    await act(async () => {
      await result.current.play();
    });

    const reconnectInfo = { attempt: 1, maxAttempts: 30, delayMs: 200 };

    act(() => {
      mockPlayer.emit("reconnect", reconnectInfo);
    });

    expect(result.current.status.state).toBe("buffering");
    if (result.current.status.state === "buffering") {
      expect(result.current.status.reconnectInfo).toEqual(reconnectInfo);
    }
  });

  it("should handle error events", async () => {
    const mockPlayer = createMockPlayer();
    mockPlayer._state = "playing";
    mockPlayer._stream = createMockMediaStream();

    const factory = vi.fn(() => mockPlayer);

    const { result } = renderHook(() => usePlayer(defaultOptions, factory));

    await act(async () => {
      await result.current.play();
    });

    const mockError = createMockError("NETWORK_ERROR", "Connection lost");

    act(() => {
      mockPlayer.emit("error", mockError);
    });

    expect(result.current.status.state).toBe("error");
    if (result.current.status.state === "error") {
      expect(result.current.status.error.code).toBe("NETWORK_ERROR");
    }
  });

  it("should handle connection failure", async () => {
    const mockPlayer = createMockPlayer();
    const mockError = createMockError("CONNECTION_FAILED", "Failed to connect");
    mockPlayer.connect.mockRejectedValue(mockError);

    const factory = vi.fn(() => mockPlayer);

    const { result } = renderHook(() => usePlayer(defaultOptions, factory));

    await act(async () => {
      try {
        await result.current.play();
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
    const mockPlayer = createMockPlayer();
    mockPlayer._state = "playing";
    mockPlayer._stream = createMockMediaStream();

    const factory = vi.fn(() => mockPlayer);

    const { result } = renderHook(() => usePlayer(defaultOptions, factory));

    await act(async () => {
      await result.current.play();
    });

    await act(async () => {
      await result.current.stop();
    });

    expect(result.current.status.state).toBe("idle");
    expect(mockPlayer.stop).toHaveBeenCalled();
  });

  it("should stop player on unmount", async () => {
    const mockPlayer = createMockPlayer();
    mockPlayer._state = "playing";
    mockPlayer._stream = createMockMediaStream();

    const factory = vi.fn(() => mockPlayer);

    const { result, unmount } = renderHook(() =>
      usePlayer(defaultOptions, factory),
    );

    await act(async () => {
      await result.current.play();
    });

    unmount();

    expect(mockPlayer.stop).toHaveBeenCalled();
  });

  it("should stop previous player when starting new one", async () => {
    const mockPlayer1 = createMockPlayer();
    mockPlayer1._state = "playing";
    mockPlayer1._stream = createMockMediaStream();

    const mockPlayer2 = createMockPlayer();
    mockPlayer2._state = "playing";
    mockPlayer2._stream = createMockMediaStream();

    let callCount = 0;
    const factory = vi.fn(() => {
      callCount++;
      return callCount === 1 ? mockPlayer1 : mockPlayer2;
    });

    const { result } = renderHook(() => usePlayer(defaultOptions, factory));

    await act(async () => {
      await result.current.play();
    });

    await act(async () => {
      await result.current.play();
    });

    expect(mockPlayer1.stop).toHaveBeenCalled();
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it("should ignore events from stopped player", async () => {
    const mockPlayer1 = createMockPlayer();
    mockPlayer1._state = "playing";
    mockPlayer1._stream = createMockMediaStream();

    const mockPlayer2 = createMockPlayer();
    mockPlayer2._state = "playing";
    mockPlayer2._stream = createMockMediaStream();

    let callCount = 0;
    const factory = vi.fn(() => {
      callCount++;
      return callCount === 1 ? mockPlayer1 : mockPlayer2;
    });

    const { result } = renderHook(() => usePlayer(defaultOptions, factory));

    await act(async () => {
      await result.current.play();
    });

    await act(async () => {
      await result.current.play();
    });

    // Emit event from old player - should be ignored
    act(() => {
      mockPlayer1.emit("stateChange", "ended");
    });

    // Should still be playing from player2
    expect(result.current.status.state).toBe("playing");
  });

  it("should pass options to factory", async () => {
    const mockPlayer = createMockPlayer();
    mockPlayer._state = "playing";
    mockPlayer._stream = createMockMediaStream();

    const factory = vi.fn(() => mockPlayer);

    const options = {
      whepUrl: "https://example.com/whep/123",
      reconnect: { enabled: true, maxAttempts: 10 },
      iceServers: [{ urls: "stun:stun.example.com" }],
      connectionTimeout: 5000,
      skipIceGathering: true,
    };

    const { result } = renderHook(() => usePlayer(options, factory));

    await act(async () => {
      await result.current.play();
    });

    expect(factory).toHaveBeenCalledWith(options.whepUrl, {
      reconnect: options.reconnect,
      iceServers: options.iceServers,
      connectionTimeout: options.connectionTimeout,
      skipIceGathering: options.skipIceGathering,
      onStats: undefined,
      statsIntervalMs: undefined,
    });
  });
});
