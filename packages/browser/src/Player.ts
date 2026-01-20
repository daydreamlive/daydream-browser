import type {
  DaydreamError,
  ReconnectConfig,
  ReconnectInfo,
} from "./types/common";
import type {
  PlayerEventMap,
  PlayerOptions,
  PlayerState,
} from "./types/player";
import { WHEPClient, type WHEPClientConfig } from "./internal/WHEPClient";
import { ConnectionError } from "./errors";
import { TypedEventEmitter } from "./internal/TypedEventEmitter";
import { createStateMachine, type StateMachine } from "./internal/StateMachine";

const PLAYER_TRANSITIONS: Record<PlayerState, PlayerState[]> = {
  connecting: ["playing", "buffering", "error"],
  playing: ["buffering", "ended"],
  buffering: ["playing", "ended"],
  ended: [],
  error: ["connecting"],
};

/**
 * Low-level configuration for the Player class.
 * For most use cases, prefer using {@link createPlayer} with {@link PlayerOptions}.
 */
export interface PlayerConfig {
  /** WHEP endpoint URL for receiving the stream. */
  whepUrl: string;
  /** Reconnection behavior configuration. */
  reconnect?: ReconnectConfig;
  /** Advanced WHEP client configuration. */
  whepConfig?: Partial<WHEPClientConfig>;
}

/**
 * Manages a WebRTC playback session using WHEP protocol.
 *
 * Handles connection establishment, reconnection logic, and stream management.
 * Emits events for state changes, errors, and reconnection attempts.
 *
 * @example
 * ```ts
 * const player = new Player({
 *   whepUrl: "https://example.com/whep/stream-id",
 * });
 *
 * player.on("stateChange", (state) => console.log("State:", state));
 * await player.connect();
 * player.attachTo(videoElement);
 * ```
 *
 * @see {@link createPlayer} for a simpler factory function
 */
export class Player extends TypedEventEmitter<PlayerEventMap> {
  private readonly stateMachine: StateMachine<PlayerState>;
  private _stream: MediaStream | null = null;
  private readonly whepUrl: string;
  private readonly reconnectConfig: ReconnectConfig;
  private readonly whepConfig: Partial<WHEPClientConfig> | undefined;
  private whepClient: WHEPClient;

  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private disconnectedGraceTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Creates a new Player instance.
   * @param config - Player configuration
   */
  constructor(config: PlayerConfig) {
    super();
    this.whepUrl = config.whepUrl;
    this.whepConfig = config.whepConfig;
    this.reconnectConfig = {
      enabled: config.reconnect?.enabled ?? true,
      maxAttempts: config.reconnect?.maxAttempts ?? 30,
      baseDelayMs: config.reconnect?.baseDelayMs ?? 200,
    };

    this.whepClient = new WHEPClient({
      url: config.whepUrl,
      ...this.whepConfig,
    });

    this.stateMachine = createStateMachine<PlayerState>(
      "connecting",
      PLAYER_TRANSITIONS,
      (_from, to) => this.emit("stateChange", to),
    );
  }

  /** Current player state. */
  get state(): PlayerState {
    return this.stateMachine.current;
  }

  /** The received MediaStream, or null if not connected. */
  get stream(): MediaStream | null {
    return this._stream;
  }

  /** Information about the current reconnection attempt, or null if not buffering. */
  get reconnectInfo(): ReconnectInfo | null {
    if (this.state !== "buffering") return null;
    const baseDelay = this.reconnectConfig.baseDelayMs ?? 200;
    const delay = this.calculateReconnectDelay(
      this.reconnectAttempts - 1,
      baseDelay,
    );
    return {
      attempt: this.reconnectAttempts,
      maxAttempts: this.reconnectConfig.maxAttempts ?? 30,
      delayMs: delay,
    };
  }

  /**
   * Establishes the WebRTC connection and starts receiving the stream.
   * @throws {DaydreamError} If connection fails after all retry attempts
   */
  async connect(): Promise<void> {
    try {
      this._stream = await this.whepClient.connect();
      this.setupConnectionMonitoring();
      this.stateMachine.transition("playing");
      this.reconnectAttempts = 0;
    } catch (error) {
      if (
        this.reconnectConfig.enabled &&
        this.reconnectAttempts < (this.reconnectConfig.maxAttempts ?? 30)
      ) {
        this.scheduleReconnect();
        return;
      }
      this.stateMachine.transition("error");
      const daydreamError =
        error instanceof Error
          ? error
          : new ConnectionError("Failed to connect", error);
      this.emit("error", daydreamError as DaydreamError);
      throw daydreamError;
    }
  }

  /**
   * Attaches the received stream to a video element.
   * @param video - The HTMLVideoElement to display the stream
   */
  attachTo(video: HTMLVideoElement): void {
    if (this._stream) {
      video.srcObject = this._stream;
    }
  }

  /**
   * Stops playback and disconnects.
   * After calling this, the instance cannot be reused.
   */
  async stop(): Promise<void> {
    this.stateMachine.force("ended");
    this.clearTimeouts();

    await this.whepClient.disconnect();
    this._stream = null;
    this.clearListeners();
  }

  private setupConnectionMonitoring(): void {
    const pc = this.whepClient.getPeerConnection();
    if (!pc) return;

    pc.oniceconnectionstatechange = () => {
      if (this.state === "ended") return;

      const iceState = pc.iceConnectionState;

      if (iceState === "connected" || iceState === "completed") {
        this.clearGraceTimeout();
        if (this.state === "buffering") {
          this.stateMachine.transition("playing");
          this.reconnectAttempts = 0;
        }
        return;
      }

      if (iceState === "disconnected") {
        this.clearGraceTimeout();
        this.whepClient.restartIce();

        this.disconnectedGraceTimeout = setTimeout(() => {
          if (this.state === "ended") return;
          const currentState = pc.iceConnectionState;
          if (currentState === "disconnected") {
            this.scheduleReconnect();
          }
        }, 2000);
        return;
      }

      if (iceState === "failed" || iceState === "closed") {
        this.clearGraceTimeout();
        this.scheduleReconnect();
      }
    };
  }

  private clearGraceTimeout(): void {
    if (this.disconnectedGraceTimeout) {
      clearTimeout(this.disconnectedGraceTimeout);
      this.disconnectedGraceTimeout = null;
    }
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private clearTimeouts(): void {
    this.clearGraceTimeout();
    this.clearReconnectTimeout();
  }

  private scheduleReconnect(): void {
    if (this.state === "ended") return;

    if (!this.reconnectConfig.enabled) {
      this.stateMachine.transition("ended");
      return;
    }

    const maxAttempts = this.reconnectConfig.maxAttempts ?? 30;

    if (this.reconnectAttempts >= maxAttempts) {
      this.stateMachine.transition("ended");
      return;
    }

    this.clearReconnectTimeout();
    this.stateMachine.transition("buffering");

    const baseDelay = this.reconnectConfig.baseDelayMs ?? 200;
    const delay = this.calculateReconnectDelay(
      this.reconnectAttempts,
      baseDelay,
    );
    this.reconnectAttempts++;

    this.emit("reconnect", {
      attempt: this.reconnectAttempts,
      maxAttempts: this.reconnectConfig.maxAttempts ?? 30,
      delayMs: delay,
    });

    this.reconnectTimeout = setTimeout(async () => {
      if (this.state === "ended") return;

      try {
        await this.whepClient.disconnect();
        this.whepClient = new WHEPClient({
          url: this.whepUrl,
          ...this.whepConfig,
        });
        this._stream = await this.whepClient.connect();
        this.setupConnectionMonitoring();
        this.stateMachine.transition("playing");
        this.reconnectAttempts = 0;
      } catch {
        this.scheduleReconnect();
      }
    }, delay);
  }

  private calculateReconnectDelay(attempt: number, baseDelay: number): number {
    const linearPhaseEndCount = 10;
    const maxDelay = 60000;

    if (attempt === 0) return 0;
    if (attempt <= linearPhaseEndCount) return baseDelay;

    const exponentialAttempt = attempt - linearPhaseEndCount;
    const delay = 500 * Math.pow(2, exponentialAttempt - 1);
    return Math.min(delay, maxDelay);
  }
}

/**
 * Creates a new Player instance with the given WHEP URL and options.
 *
 * This is the recommended way to create a player session.
 *
 * @param whepUrl - WHEP endpoint URL for receiving the stream
 * @param options - Optional player configuration
 * @returns A new Player instance
 *
 * @example
 * ```ts
 * const player = createPlayer("https://livepeer.studio/webrtc/...");
 *
 * player.on("stateChange", (state) => {
 *   if (state === "playing") {
 *     player.attachTo(videoElement);
 *   }
 * });
 *
 * await player.connect();
 * ```
 */
export function createPlayer(whepUrl: string, options?: PlayerOptions): Player {
  return new Player({
    whepUrl,
    reconnect: options?.reconnect,
    whepConfig: {
      iceServers: options?.iceServers,
      connectionTimeout: options?.connectionTimeout,
      skipIceGathering: options?.skipIceGathering,
      onStats: options?.onStats,
      statsIntervalMs: options?.statsIntervalMs,
    },
  });
}
