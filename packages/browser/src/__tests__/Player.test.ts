import { describe, it, expect, beforeEach, vi } from "vitest";
import { Player } from "../Player";
import type { PlayerState } from "../types";
import { createMockMediaStream } from "./mocks";

const mockMediaStream = createMockMediaStream();

vi.mock("../internal/WHEPClient", () => {
  return {
    WHEPClient: vi.fn().mockImplementation(() => ({
      connect: vi.fn().mockResolvedValue(mockMediaStream),
      disconnect: vi.fn().mockResolvedValue(undefined),
      getPeerConnection: vi.fn().mockReturnValue(null),
      restartIce: vi.fn(),
      getStream: vi.fn().mockReturnValue(mockMediaStream),
    })),
  };
});

describe("Player", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with connecting state", () => {
      const player = new Player({
        whepUrl: "https://server/whep",
      });

      expect(player.state).toBe("connecting");
    });

    it("should have null stream initially", () => {
      const player = new Player({
        whepUrl: "https://server/whep",
      });

      expect(player.stream).toBeNull();
    });
  });

  describe("connect", () => {
    it("should emit stateChange event when playing", async () => {
      const stateChanges: PlayerState[] = [];

      const player = new Player({
        whepUrl: "https://server/whep",
      });

      player.on("stateChange", (state) => stateChanges.push(state));

      await player.connect();

      expect(stateChanges).toContain("playing");
      expect(player.state).toBe("playing");
    });

    it("should set stream after successful connection", async () => {
      const player = new Player({
        whepUrl: "https://server/whep",
      });

      await player.connect();

      expect(player.stream).toBe(mockMediaStream);
    });
  });

  describe("stop", () => {
    it("should emit stateChange to ended", async () => {
      const stateChanges: PlayerState[] = [];

      const player = new Player({
        whepUrl: "https://server/whep",
      });

      await player.connect();

      player.on("stateChange", (state) => stateChanges.push(state));

      await player.stop();

      expect(stateChanges).toContain("ended");
      expect(player.state).toBe("ended");
    });

    it("should clear stream after stop", async () => {
      const player = new Player({
        whepUrl: "https://server/whep",
      });

      await player.connect();
      expect(player.stream).not.toBeNull();

      await player.stop();
      expect(player.stream).toBeNull();
    });

    it("should be async and return Promise", async () => {
      const player = new Player({
        whepUrl: "https://server/whep",
      });

      await player.connect();

      const result = player.stop();
      expect(result).toBeInstanceOf(Promise);
      await result;
    });
  });

  describe("attachTo", () => {
    it("should set srcObject on video element", async () => {
      const player = new Player({
        whepUrl: "https://server/whep",
      });

      await player.connect();

      const video = document.createElement("video");
      player.attachTo(video);

      expect(video.srcObject).toBe(mockMediaStream);
    });

    it("should not throw if stream is null", () => {
      const player = new Player({
        whepUrl: "https://server/whep",
      });

      const video = document.createElement("video");

      expect(() => player.attachTo(video)).not.toThrow();
    });
  });

  describe("reconnect config", () => {
    it("should use default reconnect config", () => {
      const player = new Player({
        whepUrl: "https://server/whep",
      });

      expect(player).toBeDefined();
    });

    it("should accept custom reconnect config", () => {
      const player = new Player({
        whepUrl: "https://server/whep",
        reconnect: {
          enabled: false,
          maxAttempts: 20,
          baseDelayMs: 100,
        },
      });

      expect(player).toBeDefined();
    });
  });
});
