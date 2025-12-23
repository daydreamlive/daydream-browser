import type {
  BroadcasterOptions,
  BroadcasterState,
  BroadcasterEvents,
} from "../types";
import { WHIPClient } from "./WHIPClient";

type EventHandler<T extends keyof BroadcasterEvents> = BroadcasterEvents[T];

export class DaydreamBroadcaster {
  private options: BroadcasterOptions;
  private whipClient: WHIPClient | null = null;
  private _state: BroadcasterState = "idle";
  private _whepUrl: string | null = null;
  private listeners: Map<
    keyof BroadcasterEvents,
    Set<EventHandler<keyof BroadcasterEvents>>
  > = new Map();
  private reconnectAttempts = 0;
  private currentStream: MediaStream | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private disconnectedGraceTimeout: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(options: BroadcasterOptions) {
    this.options = options;
  }

  get state(): BroadcasterState {
    return this._state;
  }

  get whepUrl(): string | null {
    return this._whepUrl;
  }

  on<E extends keyof BroadcasterEvents>(
    event: E,
    handler: BroadcasterEvents[E],
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners
      .get(event)!
      .add(handler as EventHandler<keyof BroadcasterEvents>);
  }

  off<E extends keyof BroadcasterEvents>(
    event: E,
    handler: BroadcasterEvents[E],
  ): void {
    this.listeners
      .get(event)
      ?.delete(handler as EventHandler<keyof BroadcasterEvents>);
  }

  private emit<E extends keyof BroadcasterEvents>(
    event: E,
    ...args: Parameters<BroadcasterEvents[E]>
  ): void {
    this.listeners.get(event)?.forEach((handler) => {
      (handler as (...args: Parameters<BroadcasterEvents[E]>) => void)(...args);
    });
  }

  private setState(state: BroadcasterState): void {
    this._state = state;
  }

  async publish(stream: MediaStream): Promise<void> {
    if (this._state === "connected" || this._state === "connecting") {
      throw new Error("Already publishing");
    }

    this.stopped = false;
    this.currentStream = stream;
    this.reconnectAttempts = 0;

    await this.doConnect(stream);
  }

  private async doConnect(stream: MediaStream): Promise<void> {
    if (this.stopped) return;

    this.setState("connecting");
    this.emit("connecting");

    try {
      this.whipClient = new WHIPClient({
        url: this.options.whipUrl,
        iceServers: this.options.iceServers,
        videoBitrate: this.options.videoBitrate,
        audioBitrate: this.options.audioBitrate,
        maxFramerate: this.options.maxFramerate,
        onStats: this.options.onStats,
        statsIntervalMs: this.options.statsIntervalMs,
      });

      const { whepUrl } = await this.whipClient.connect(stream);
      this._whepUrl = whepUrl;

      this.setupConnectionMonitoring();

      this.setState("connected");
      this.emit("connected", { whepUrl: whepUrl ?? "" });
    } catch (error) {
      this.setState("error");
      this.emit(
        "error",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  private setupConnectionMonitoring(): void {
    const pc = this.whipClient?.getPeerConnection();
    if (!pc) return;

    pc.onconnectionstatechange = () => {
      if (this.stopped) return;

      const state = pc.connectionState;

      if (state === "connected") {
        this.clearGraceTimeout();
        return;
      }

      if (state === "disconnected") {
        this.clearGraceTimeout();
        this.whipClient?.restartIce();

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

  private scheduleReconnect(): void {
    if (this.stopped) return;

    const reconnectConfig = this.options.reconnect;
    if (!reconnectConfig?.enabled || !this.currentStream) {
      this.setState("disconnected");
      this.emit("disconnected", "Connection lost");
      return;
    }

    const maxAttempts = reconnectConfig.maxAttempts ?? 3;

    if (this.reconnectAttempts >= maxAttempts) {
      this.setState("disconnected");
      this.emit("disconnected", "Max reconnection attempts reached");
      return;
    }

    this.clearReconnectTimeout();

    const delay = this.calculateReconnectDelay(
      this.reconnectAttempts,
      reconnectConfig.baseDelay ?? 1000,
    );
    this.reconnectAttempts++;

    this.emit("reconnecting", this.reconnectAttempts);

    this.reconnectTimeout = setTimeout(async () => {
      if (this.stopped || !this.currentStream) return;

      try {
        await this.whipClient?.disconnect();
        await this.doConnect(this.currentStream);
        this.reconnectAttempts = 0;
      } catch {
        this.scheduleReconnect();
      }
    }, delay);
  }

  private calculateReconnectDelay(attempt: number, baseDelay: number): number {
    return baseDelay * Math.pow(2, attempt);
  }

  async replaceTrack(track: MediaStreamTrack): Promise<void> {
    if (this._state !== "connected") {
      throw new Error("Not connected");
    }

    await this.whipClient?.replaceTrack(track);
  }

  setMaxFramerate(fps?: number): void {
    this.whipClient?.setMaxFramerate(fps);
  }

  async unpublish(): Promise<void> {
    this.stopped = true;
    this.clearGraceTimeout();
    this.clearReconnectTimeout();

    if (this._state === "idle") {
      return;
    }

    await this.whipClient?.disconnect();
    this.whipClient = null;
    this._whepUrl = null;
    this.currentStream = null;
    this.setState("disconnected");
    this.emit("disconnected");
  }

  destroy(): void {
    this.stopped = true;
    this.clearGraceTimeout();
    this.clearReconnectTimeout();

    this.whipClient?.disconnect();
    this.whipClient = null;
    this._whepUrl = null;
    this.currentStream = null;
    this.listeners.clear();
    this.setState("idle");
  }
}
