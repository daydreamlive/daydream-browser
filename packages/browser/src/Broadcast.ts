import type {
  DaydreamError,
  ReconnectConfig,
  ReconnectInfo,
} from "./types/common";
import type {
  BroadcastEventMap,
  BroadcastOptions,
  BroadcastState,
} from "./types/broadcast";
import { WHIPClient, type WHIPClientConfig } from "./internal/WHIPClient";
import { ConnectionError } from "./errors";
import { TypedEventEmitter } from "./internal/TypedEventEmitter";
import { createStateMachine, type StateMachine } from "./internal/StateMachine";

const BROADCAST_TRANSITIONS: Record<BroadcastState, BroadcastState[]> = {
  connecting: ["live", "error"],
  live: ["reconnecting", "ended"],
  reconnecting: ["live", "ended"],
  ended: [],
  error: ["connecting"],
};

export interface BroadcastConfig {
  whipUrl: string;
  stream: MediaStream;
  reconnect?: ReconnectConfig;
  whipConfig?: Partial<WHIPClientConfig>;
}

export class Broadcast extends TypedEventEmitter<BroadcastEventMap> {
  private _whepUrl: string | null = null;
  private readonly stateMachine: StateMachine<BroadcastState>;
  private currentStream: MediaStream;
  private readonly reconnectConfig: ReconnectConfig;
  private readonly whipClient: WHIPClient;

  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private disconnectedGraceTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(config: BroadcastConfig) {
    super();
    this.currentStream = config.stream;
    this.reconnectConfig = {
      enabled: config.reconnect?.enabled ?? true,
      maxAttempts: config.reconnect?.maxAttempts ?? 5,
      baseDelayMs: config.reconnect?.baseDelayMs ?? 1000,
    };

    this.whipClient = new WHIPClient({
      url: config.whipUrl,
      ...config.whipConfig,
    });

    this.stateMachine = createStateMachine<BroadcastState>(
      "connecting",
      BROADCAST_TRANSITIONS,
      (_from, to) => this.emit("stateChange", to),
    );
  }

  get state(): BroadcastState {
    return this.stateMachine.current;
  }

  get whepUrl(): string | null {
    return this._whepUrl;
  }

  get stream(): MediaStream {
    return this.currentStream;
  }

  get reconnectInfo(): ReconnectInfo | null {
    if (this.state !== "reconnecting") return null;
    const baseDelay = this.reconnectConfig.baseDelayMs ?? 1000;
    const delay = baseDelay * Math.pow(2, this.reconnectAttempts - 1);
    return {
      attempt: this.reconnectAttempts,
      maxAttempts: this.reconnectConfig.maxAttempts ?? 5,
      delayMs: delay,
    };
  }

  async connect(): Promise<void> {
    try {
      const result = await this.whipClient.connect(this.currentStream);
      if (result.whepUrl) {
        this._whepUrl = result.whepUrl;
      }
      this.setupConnectionMonitoring();
      this.stateMachine.transition("live");
    } catch (error) {
      this.stateMachine.transition("error");
      const daydreamError =
        error instanceof Error
          ? error
          : new ConnectionError("Failed to connect", error);
      this.emit("error", daydreamError as DaydreamError);
      throw daydreamError;
    }
  }

  async stop(): Promise<void> {
    this.stateMachine.force("ended");
    this.clearTimeouts();

    await this.whipClient.disconnect();
    this.clearListeners();
  }

  setMaxFramerate(fps?: number): void {
    this.whipClient.setMaxFramerate(fps);
  }

  async replaceStream(newStream: MediaStream): Promise<void> {
    if (!this.whipClient.isConnected()) {
      this.currentStream = newStream;
      return;
    }

    const videoTrack = newStream.getVideoTracks()[0];
    const audioTrack = newStream.getAudioTracks()[0];

    try {
      if (videoTrack) {
        await this.whipClient.replaceTrack(videoTrack);
      }
      if (audioTrack) {
        await this.whipClient.replaceTrack(audioTrack);
      }
      this.currentStream = newStream;
    } catch {
      this.currentStream = newStream;
      this.scheduleReconnect();
    }
  }

  private setupConnectionMonitoring(): void {
    const pc = this.whipClient.getPeerConnection();
    if (!pc) return;

    pc.oniceconnectionstatechange = () => {
      if (this.state === "ended") return;

      const iceState = pc.iceConnectionState;

      if (iceState === "connected" || iceState === "completed") {
        this.clearGraceTimeout();
        if (this.state === "reconnecting") {
          this.stateMachine.transition("live");
          this.reconnectAttempts = 0;
        }
        return;
      }

      if (iceState === "disconnected") {
        this.clearGraceTimeout();
        this.whipClient.restartIce();

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

    const maxAttempts = this.reconnectConfig.maxAttempts ?? 5;

    if (this.reconnectAttempts >= maxAttempts) {
      this.stateMachine.transition("ended");
      return;
    }

    this.clearReconnectTimeout();
    this.stateMachine.transition("reconnecting");

    const baseDelay = this.reconnectConfig.baseDelayMs ?? 1000;
    const delay = baseDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    this.emit("reconnect", {
      attempt: this.reconnectAttempts,
      maxAttempts: this.reconnectConfig.maxAttempts ?? 5,
      delayMs: delay,
    });

    this.reconnectTimeout = setTimeout(async () => {
      if (this.state === "ended") return;

      try {
        await this.whipClient.disconnect();
        const result = await this.whipClient.connect(this.currentStream);
        if (result.whepUrl) {
          this._whepUrl = result.whepUrl;
        }
        this.setupConnectionMonitoring();
        this.stateMachine.transition("live");
        this.reconnectAttempts = 0;
      } catch {
        this.scheduleReconnect();
      }
    }, delay);
  }
}

export function createBroadcast(options: BroadcastOptions): Broadcast {
  const {
    whipUrl,
    stream,
    reconnect,
    video,
    audio,
    iceServers,
    connectionTimeout,
    onStats,
    statsIntervalMs,
    onResponse,
  } = options;

  return new Broadcast({
    whipUrl,
    stream,
    reconnect,
    whipConfig: {
      iceServers,
      videoBitrate: video?.bitrate,
      audioBitrate: audio?.bitrate,
      maxFramerate: video?.maxFramerate,
      connectionTimeout,
      onStats,
      statsIntervalMs,
      onResponse,
    },
  });
}
