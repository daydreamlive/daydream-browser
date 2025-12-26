import type {
  BroadcastState,
  BroadcastEventMap,
  ReconnectConfig,
  DaydreamError,
} from "./types";
import { WHIPClient, type WHIPClientConfig } from "./internal/WHIPClient";
import { ConnectionError } from "./errors";
import { TypedEventEmitter } from "./internal/TypedEventEmitter";

export interface BroadcastConfig {
  whipUrl: string;
  stream: MediaStream;
  reconnect?: ReconnectConfig;
  whipConfig?: Partial<WHIPClientConfig>;
}

export class Broadcast extends TypedEventEmitter<BroadcastEventMap> {
  private _whepUrl: string | null = null;
  private _state: BroadcastState = "connecting";
  private readonly stream: MediaStream;
  private readonly reconnectConfig: ReconnectConfig;
  private readonly whipClient: WHIPClient;

  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private disconnectedGraceTimeout: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private readyResolve: (() => void) | null = null;
  private readyReject: ((error: Error) => void) | null = null;
  private readyPromise: Promise<void>;

  constructor(config: BroadcastConfig) {
    super();
    this.stream = config.stream;
    this.reconnectConfig = {
      enabled: config.reconnect?.enabled ?? true,
      maxAttempts: config.reconnect?.maxAttempts ?? 5,
      baseDelayMs: config.reconnect?.baseDelayMs ?? 1000,
    };

    this.whipClient = new WHIPClient({
      url: config.whipUrl,
      ...config.whipConfig,
    });

    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
  }

  get state(): BroadcastState {
    return this._state;
  }

  get whepUrl(): string | null {
    return this._whepUrl;
  }

  get ready(): Promise<void> {
    return this.readyPromise;
  }

  async connect(): Promise<void> {
    try {
      const result = await this.whipClient.connect(this.stream);
      if (result.whepUrl) {
        this._whepUrl = result.whepUrl;
      }
      this.setupConnectionMonitoring();
      this.setState("live");
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

  private setState(state: BroadcastState): void {
    if (this._state !== state) {
      this._state = state;
      this.emit("stateChange", state);
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.clearTimeouts();

    await this.whipClient.disconnect();
    this.setState("ended");
    this.clearListeners();
  }

  private setupConnectionMonitoring(): void {
    const pc = this.whipClient.getPeerConnection();
    if (!pc) return;

    pc.onconnectionstatechange = () => {
      if (this.stopped) return;

      const state = pc.connectionState;

      if (state === "connected") {
        this.clearGraceTimeout();
        if (this._state === "reconnecting") {
          this.setState("live");
          this.reconnectAttempts = 0;
        }
        return;
      }

      if (state === "disconnected") {
        this.clearGraceTimeout();
        this.whipClient.restartIce();

        this.disconnectedGraceTimeout = setTimeout(() => {
          if (this.stopped) return;
          const currentState = pc.connectionState;
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

    const maxAttempts = this.reconnectConfig.maxAttempts ?? 5;

    if (this.reconnectAttempts >= maxAttempts) {
      this.setState("ended");
      return;
    }

    this.clearReconnectTimeout();
    this.setState("reconnecting");

    const baseDelay = this.reconnectConfig.baseDelayMs ?? 1000;
    const delay = baseDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(async () => {
      if (this.stopped) return;

      try {
        await this.whipClient.disconnect();
        const result = await this.whipClient.connect(this.stream);
        if (result.whepUrl) {
          this._whepUrl = result.whepUrl;
        }
        this.setupConnectionMonitoring();
        this.setState("live");
        this.reconnectAttempts = 0;
      } catch {
        this.scheduleReconnect();
      }
    }, delay);
  }
}
