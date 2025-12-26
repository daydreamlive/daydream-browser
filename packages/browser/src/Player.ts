import type {
  PlayerState,
  PlayerEventMap,
  PlayerOptions,
  ReconnectConfig,
  DaydreamError,
} from "./types";
import { WHEPClient, type WHEPClientConfig } from "./internal/WHEPClient";
import { ConnectionError } from "./errors";
import { TypedEventEmitter } from "./internal/TypedEventEmitter";

export interface PlayerConfig {
  whepUrl: string;
  reconnect?: ReconnectConfig;
  whepConfig?: Partial<WHEPClientConfig>;
}

export class Player extends TypedEventEmitter<PlayerEventMap> {
  private _state: PlayerState = "connecting";
  private _stream: MediaStream | null = null;
  private readonly whepUrl: string;
  private readonly reconnectConfig: ReconnectConfig;
  private readonly whepConfig: Partial<WHEPClientConfig> | undefined;
  private whepClient: WHEPClient;

  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private disconnectedGraceTimeout: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private readyResolve: (() => void) | null = null;
  private readyReject: ((error: Error) => void) | null = null;
  private readyPromise: Promise<void>;

  constructor(config: PlayerConfig) {
    super();
    this.whepUrl = config.whepUrl;
    this.whepConfig = config.whepConfig;
    this.reconnectConfig = {
      enabled: config.reconnect?.enabled ?? true,
      maxAttempts: config.reconnect?.maxAttempts ?? 10,
      baseDelayMs: config.reconnect?.baseDelayMs ?? 300,
    };

    this.whepClient = new WHEPClient({
      url: config.whepUrl,
      ...this.whepConfig,
    });

    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
  }

  get state(): PlayerState {
    return this._state;
  }

  get stream(): MediaStream | null {
    return this._stream;
  }

  get ready(): Promise<void> {
    return this.readyPromise;
  }

  async connect(): Promise<void> {
    try {
      this._stream = await this.whepClient.connect();
      this.setupConnectionMonitoring();
      this.setState("playing");
      this.readyResolve?.();
    } catch (error) {
      this.setState("error");
      const daydreamError =
        error instanceof Error
          ? error
          : new ConnectionError("Failed to connect", error);
      this.emit("error", daydreamError as DaydreamError);
      this.readyReject?.(daydreamError);
      throw daydreamError;
    }
  }

  private setState(state: PlayerState): void {
    if (this._state !== state) {
      this._state = state;
      this.emit("stateChange", state);
    }
  }

  attachTo(video: HTMLVideoElement): void {
    if (this._stream) {
      video.srcObject = this._stream;
    }
  }

  stop(): void {
    this.stopped = true;
    this.clearTimeouts();

    this.whepClient.disconnect();
    this._stream = null;
    this.setState("ended");
    this.clearListeners();
  }

  private setupConnectionMonitoring(): void {
    const pc = this.whepClient.getPeerConnection();
    if (!pc) return;

    pc.oniceconnectionstatechange = () => {
      if (this.stopped) return;

      const state = pc.iceConnectionState;

      if (state === "connected" || state === "completed") {
        this.clearGraceTimeout();
        if (this._state === "buffering") {
          this.setState("playing");
          this.reconnectAttempts = 0;
        }
        return;
      }

      if (state === "disconnected") {
        this.clearGraceTimeout();
        this.whepClient.restartIce();

        this.disconnectedGraceTimeout = setTimeout(() => {
          if (this.stopped) return;
          const currentState = pc.iceConnectionState;
          if (currentState === "disconnected") {
            this.scheduleReconnect();
          }
        }, 2000);
        return;
      }

      if (state === "failed" || state === "closed") {
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
    if (this.stopped) return;

    if (!this.reconnectConfig.enabled) {
      this.setState("ended");
      return;
    }

    const maxAttempts = this.reconnectConfig.maxAttempts ?? 10;

    if (this.reconnectAttempts >= maxAttempts) {
      this.setState("ended");
      return;
    }

    this.clearReconnectTimeout();
    this.setState("buffering");

    const baseDelay = this.reconnectConfig.baseDelayMs ?? 300;
    const delay = this.calculateReconnectDelay(
      this.reconnectAttempts,
      baseDelay
    );
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(async () => {
      if (this.stopped) return;

      try {
        await this.whepClient.disconnect();
        this.whepClient = new WHEPClient({ url: this.whepUrl, ...this.whepConfig });
        this._stream = await this.whepClient.connect();
        this.setupConnectionMonitoring();
        this.setState("playing");
        this.reconnectAttempts = 0;
      } catch {
        this.scheduleReconnect();
      }
    }, delay);
  }

  private calculateReconnectDelay(attempt: number, baseDelay: number): number {
    const linearPhaseEndCount = 10;
    const maxDelay = 60000;

    if (attempt === 0) return 500;
    if (attempt <= linearPhaseEndCount) return baseDelay;

    const exponentialAttempt = attempt - linearPhaseEndCount;
    const delay = 500 * Math.pow(2, exponentialAttempt - 1);
    return Math.min(delay, maxDelay);
  }
}

export function createPlayer(whepUrl: string, options?: PlayerOptions): Player {
  return new Player({
    whepUrl,
    reconnect: options?.reconnect,
    whepConfig: {
      onStats: options?.onStats,
      statsIntervalMs: options?.statsIntervalMs,
    },
  });
}

