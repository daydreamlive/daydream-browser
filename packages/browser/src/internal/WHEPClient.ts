import { DEFAULT_ICE_SERVERS } from "../types";
import { ConnectionError, NetworkError } from "../errors";
import {
  type PeerConnectionFactory,
  type FetchFn,
  type TimerProvider,
  type MediaStreamFactory,
  defaultPeerConnectionFactory,
  defaultFetch,
  defaultTimerProvider,
  defaultMediaStreamFactory,
} from "./dependencies";

export interface WHEPClientConfig {
  url: string;
  iceServers?: RTCIceServer[];
  connectionTimeout?: number;
  skipIceGathering?: boolean;
  onStats?: (report: RTCStatsReport) => void;
  statsIntervalMs?: number;
  peerConnectionFactory?: PeerConnectionFactory;
  fetch?: FetchFn;
  timers?: TimerProvider;
  mediaStreamFactory?: MediaStreamFactory;
}

const DEFAULT_CONNECTION_TIMEOUT = 10000;

export class WHEPClient {
  private readonly url: string;
  private readonly iceServers: RTCIceServer[];
  private readonly connectionTimeout: number;
  private readonly skipIceGathering: boolean;
  private readonly onStats?: (report: RTCStatsReport) => void;
  private readonly statsIntervalMs: number;
  private readonly pcFactory: PeerConnectionFactory;
  private readonly fetch: FetchFn;
  private readonly timers: TimerProvider;
  private readonly mediaStreamFactory: MediaStreamFactory;

  private pc: RTCPeerConnection | null = null;
  private resourceUrl: string | null = null;
  private stream: MediaStream | null = null;
  private abortController: AbortController | null = null;
  private statsTimer: number | null = null;
  private iceGatheringTimer: number | null = null;

  constructor(config: WHEPClientConfig) {
    this.url = config.url;
    this.iceServers = config.iceServers ?? DEFAULT_ICE_SERVERS;
    this.connectionTimeout =
      config.connectionTimeout ?? DEFAULT_CONNECTION_TIMEOUT;
    this.skipIceGathering = config.skipIceGathering ?? true;
    this.onStats = config.onStats;
    this.statsIntervalMs = config.statsIntervalMs ?? 5000;
    this.pcFactory =
      config.peerConnectionFactory ?? defaultPeerConnectionFactory;
    this.fetch = config.fetch ?? defaultFetch;
    this.timers = config.timers ?? defaultTimerProvider;
    this.mediaStreamFactory =
      config.mediaStreamFactory ?? defaultMediaStreamFactory;
  }

  async connect(): Promise<MediaStream> {
    this.cleanup();

    this.pc = this.pcFactory.create({
      iceServers: this.iceServers,
    });

    this.pc.addTransceiver("video", { direction: "recvonly" });
    this.pc.addTransceiver("audio", { direction: "recvonly" });

    this.stream = this.mediaStreamFactory.create();

    this.pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        this.stream = remoteStream;
      } else if (this.stream) {
        this.stream.addTrack(event.track);
      }
    };

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    if (!this.skipIceGathering) {
      await this.waitForIceGathering();
    }

    this.abortController = new AbortController();
    const timeoutId = this.timers.setTimeout(
      () => this.abortController?.abort(),
      this.connectionTimeout,
    );

    try {
      const response = await this.fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: this.pc.localDescription!.sdp,
        signal: this.abortController.signal,
      });

      this.timers.clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new ConnectionError(
          `WHEP connection failed: ${response.status} ${response.statusText} ${errorText}`,
        );
      }

      const location = response.headers.get("location");
      if (location) {
        this.resourceUrl = new URL(location, this.url).toString();
      }

      const answerSdp = await response.text();
      await this.pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      this.startStatsTimer();

      return this.stream;
    } catch (error) {
      this.timers.clearTimeout(timeoutId);
      if (error instanceof ConnectionError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new NetworkError("Connection timeout");
      }
      throw new NetworkError("Failed to establish connection", error);
    }
  }

  private waitForIceGathering(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.pc) {
        resolve();
        return;
      }

      if (this.pc.iceGatheringState === "complete") {
        resolve();
        return;
      }

      const onStateChange = () => {
        if (this.pc?.iceGatheringState === "complete") {
          this.pc.removeEventListener("icegatheringstatechange", onStateChange);
          if (this.iceGatheringTimer !== null) {
            this.timers.clearTimeout(this.iceGatheringTimer);
            this.iceGatheringTimer = null;
          }
          resolve();
        }
      };

      this.pc.addEventListener("icegatheringstatechange", onStateChange);

      this.iceGatheringTimer = this.timers.setTimeout(() => {
        this.pc?.removeEventListener("icegatheringstatechange", onStateChange);
        this.iceGatheringTimer = null;
        resolve();
      }, 1000);
    });
  }

  private startStatsTimer(): void {
    if (!this.onStats || !this.pc) return;

    this.stopStatsTimer();

    this.statsTimer = this.timers.setInterval(async () => {
      if (!this.pc) return;
      try {
        const report = await this.pc.getStats();
        this.onStats?.(report);
      } catch {
        // Stats collection failed
      }
    }, this.statsIntervalMs);
  }

  private stopStatsTimer(): void {
    if (this.statsTimer !== null) {
      this.timers.clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
  }

  private cleanup(): void {
    this.stopStatsTimer();

    if (this.iceGatheringTimer !== null) {
      this.timers.clearTimeout(this.iceGatheringTimer);
      this.iceGatheringTimer = null;
    }

    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch {
        // Ignore abort errors
      }
      this.abortController = null;
    }

    if (this.pc) {
      // Clear event handlers
      this.pc.oniceconnectionstatechange = null;
      this.pc.onconnectionstatechange = null;
      this.pc.ontrack = null;

      try {
        this.pc.getTransceivers().forEach((t) => {
          try {
            t.stop();
          } catch {
            // Ignore stop errors
          }
        });
      } catch {
        // Ignore transceiver errors
      }

      try {
        this.pc.close();
      } catch {
        // Ignore close errors
      }
      this.pc = null;
    }
  }

  async disconnect(): Promise<void> {
    if (this.resourceUrl) {
      try {
        await this.fetch(this.resourceUrl, { method: "DELETE" });
      } catch {
        // Ignore delete errors
      }
    }

    this.cleanup();
    this.stream = null;
    this.resourceUrl = null;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  getPeerConnection(): RTCPeerConnection | null {
    return this.pc;
  }

  restartIce(): void {
    if (this.pc) {
      try {
        this.pc.restartIce();
      } catch {
        // ICE restart not supported
      }
    }
  }
}
