import type { PlayerOptions, PlayerState, PlayerEvents } from "../types";
import { WHEPClient } from "./WHEPClient";

type EventHandler<T extends keyof PlayerEvents> = PlayerEvents[T];

export class DaydreamPlayer {
  private options: PlayerOptions;
  private whepClient: WHEPClient | null = null;
  private _state: PlayerState = "idle";
  private _stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private listeners: Map<
    keyof PlayerEvents,
    Set<EventHandler<keyof PlayerEvents>>
  > = new Map();
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private disconnectedGraceTimeout: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(options: PlayerOptions) {
    this.options = options;
    if (options.videoElement) {
      this.videoElement = options.videoElement;
    }
  }

  get state(): PlayerState {
    return this._state;
  }

  get stream(): MediaStream | null {
    return this._stream;
  }

  on<E extends keyof PlayerEvents>(event: E, handler: PlayerEvents[E]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as EventHandler<keyof PlayerEvents>);
  }

  off<E extends keyof PlayerEvents>(event: E, handler: PlayerEvents[E]): void {
    this.listeners
      .get(event)
      ?.delete(handler as EventHandler<keyof PlayerEvents>);
  }

  private emit<E extends keyof PlayerEvents>(
    event: E,
    ...args: Parameters<PlayerEvents[E]>
  ): void {
    this.listeners.get(event)?.forEach((handler) => {
      (handler as (...args: Parameters<PlayerEvents[E]>) => void)(...args);
    });
  }

  private setState(state: PlayerState): void {
    this._state = state;
  }

  attachTo(element: HTMLVideoElement): void {
    this.videoElement = element;
    if (this._stream) {
      element.srcObject = this._stream;
    }
  }

  async play(): Promise<void> {
    if (this._state === "connected" || this._state === "playing") {
      if (this.videoElement && this.videoElement.paused) {
        await this.videoElement.play();
        this.setState("playing");
        this.emit("playing");
      }
      return;
    }

    this.stopped = false;
    this.reconnectAttempts = 0;

    await this.doConnect();
  }

  private async doConnect(): Promise<void> {
    if (this.stopped) return;

    this.setState("connecting");
    this.emit("connecting");

    try {
      this.whepClient = new WHEPClient({
        url: this.options.whepUrl,
        iceServers: this.options.iceServers,
        onStats: this.options.onStats,
        statsIntervalMs: this.options.statsIntervalMs,
      });

      this._stream = await this.whepClient.connect();

      this.setupConnectionMonitoring();

      this.setState("connected");
      this.emit("connected");

      if (this.videoElement) {
        this.videoElement.srcObject = this._stream;
        this.setupVideoEvents();

        if (this.options.autoplay !== false) {
          try {
            await this.videoElement.play();
            this.setState("playing");
            this.emit("playing");
          } catch {
            // Autoplay blocked
          }
        }
      }
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
    const pc = this.whepClient?.getPeerConnection();
    if (!pc) return;

    pc.oniceconnectionstatechange = () => {
      if (this.stopped) return;

      const state = pc.iceConnectionState;

      if (state === "connected" || state === "completed") {
        this.clearGraceTimeout();
        return;
      }

      if (state === "disconnected") {
        this.clearGraceTimeout();
        this.whepClient?.restartIce();

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

  private scheduleReconnect(): void {
    if (this.stopped) return;

    const reconnectConfig = this.options.reconnect;
    if (!reconnectConfig?.enabled) {
      this.setState("ended");
      this.emit("ended");
      return;
    }

    const maxAttempts = reconnectConfig.maxAttempts ?? 10;

    if (this.reconnectAttempts >= maxAttempts) {
      this.setState("ended");
      this.emit("ended");
      return;
    }

    this.clearReconnectTimeout();

    const delay = this.calculateReconnectDelay(
      this.reconnectAttempts,
      reconnectConfig.baseDelay ?? 300,
    );
    this.reconnectAttempts++;

    this.emit("reconnecting", this.reconnectAttempts);

    this.reconnectTimeout = setTimeout(async () => {
      if (this.stopped) return;

      try {
        await this.whepClient?.disconnect();
        await this.doConnect();
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

  private setupVideoEvents(): void {
    if (!this.videoElement) return;

    this.videoElement.onplay = () => {
      this.setState("playing");
      this.emit("playing");
    };

    this.videoElement.onpause = () => {
      this.setState("paused");
      this.emit("paused");
    };

    this.videoElement.onended = () => {
      this.setState("ended");
      this.emit("ended");
    };
  }

  pause(): void {
    if (this.videoElement && !this.videoElement.paused) {
      this.videoElement.pause();
      this.setState("paused");
      this.emit("paused");
    }
  }

  stop(): void {
    this.stopped = true;
    this.clearGraceTimeout();
    this.clearReconnectTimeout();

    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.srcObject = null;
    }

    this.whepClient?.disconnect();
    this.whepClient = null;
    this._stream = null;
    this.setState("idle");
  }

  destroy(): void {
    this.stop();
    this.videoElement = null;
    this.listeners.clear();
  }
}
