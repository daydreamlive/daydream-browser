import { DEFAULT_ICE_SERVERS } from "../types";
import { ConnectionError, NetworkError } from "../errors";

export interface WHEPClientConfig {
  url: string;
  iceServers?: RTCIceServer[];
  onStats?: (report: RTCStatsReport) => void;
  statsIntervalMs?: number;
}

export class WHEPClient {
  private url: string;
  private iceServers: RTCIceServer[];
  private onStats?: (report: RTCStatsReport) => void;
  private statsIntervalMs: number;

  private pc: RTCPeerConnection | null = null;
  private resourceUrl: string | null = null;
  private stream: MediaStream | null = null;
  private abortController: AbortController | null = null;
  private statsTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: WHEPClientConfig) {
    this.url = config.url;
    this.iceServers = config.iceServers ?? DEFAULT_ICE_SERVERS;
    this.onStats = config.onStats;
    this.statsIntervalMs = config.statsIntervalMs ?? 5000;
  }

  async connect(): Promise<MediaStream> {
    this.cleanup();

    this.pc = new RTCPeerConnection({
      iceServers: this.iceServers,
    });

    this.pc.addTransceiver("video", { direction: "recvonly" });
    this.pc.addTransceiver("audio", { direction: "recvonly" });

    this.stream = new MediaStream();

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

    await this.waitForIceGathering();

    this.abortController = new AbortController();
    const timeoutId = setTimeout(() => this.abortController?.abort(), 10000);

    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: this.pc.localDescription!.sdp,
        signal: this.abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new ConnectionError(
          `WHEP connection failed: ${response.status} ${response.statusText} ${errorText}`
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
      clearTimeout(timeoutId);
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
          clearTimeout(timerId);
          resolve();
        }
      };

      this.pc.addEventListener("icegatheringstatechange", onStateChange);

      const timerId = setTimeout(() => {
        this.pc?.removeEventListener("icegatheringstatechange", onStateChange);
        resolve();
      }, 2000);
    });
  }

  private startStatsTimer(): void {
    if (!this.onStats || !this.pc) return;

    this.stopStatsTimer();

    this.statsTimer = setInterval(async () => {
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
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
  }

  private cleanup(): void {
    this.stopStatsTimer();

    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch {
        // Ignore abort errors
      }
      this.abortController = null;
    }

    if (this.pc) {
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
        await fetch(this.resourceUrl, { method: "DELETE" });
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

