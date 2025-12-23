import type { WHIPClientOptions } from "../types";
import {
  DEFAULT_ICE_SERVERS,
  DEFAULT_VIDEO_BITRATE,
  DEFAULT_AUDIO_BITRATE,
} from "../types";

function preferH264(sdp: string): string {
  const lines = sdp.split("\r\n");
  const mLineIndex = lines.findIndex((line) => line.startsWith("m=video"));
  if (mLineIndex === -1) return sdp;

  const codecRegex = /a=rtpmap:(\d+) H264(\/\d+)+/;
  const codecLine = lines.find((line) => codecRegex.test(line));
  if (!codecLine) return sdp;

  const match = codecRegex.exec(codecLine);
  const codecPayload = match?.[1];
  if (!codecPayload) return sdp;

  const mLine = lines[mLineIndex];
  if (!mLine) return sdp;

  const mLineElements = mLine.split(" ");
  const reorderedMLine = [
    ...mLineElements.slice(0, 3),
    codecPayload,
    ...mLineElements.slice(3).filter((payload) => payload !== codecPayload),
  ];
  lines[mLineIndex] = reorderedMLine.join(" ");
  return lines.join("\r\n");
}

export class WHIPClient {
  private url: string;
  private iceServers: RTCIceServer[];
  private videoBitrate: number;
  private audioBitrate: number;
  private maxFramerate?: number;
  private onStats?: (report: RTCStatsReport) => void;
  private statsIntervalMs: number;

  private pc: RTCPeerConnection | null = null;
  private resourceUrl: string | null = null;
  private whepUrl: string | null = null;
  private abortController: AbortController | null = null;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private videoSender: RTCRtpSender | null = null;
  private audioSender: RTCRtpSender | null = null;

  constructor(options: WHIPClientOptions) {
    this.url = options.url;
    this.iceServers = options.iceServers ?? DEFAULT_ICE_SERVERS;
    this.videoBitrate = options.videoBitrate ?? DEFAULT_VIDEO_BITRATE;
    this.audioBitrate = options.audioBitrate ?? DEFAULT_AUDIO_BITRATE;
    this.maxFramerate = options.maxFramerate;
    this.onStats = options.onStats;
    this.statsIntervalMs = options.statsIntervalMs ?? 5000;
  }

  async connect(stream: MediaStream): Promise<{ whepUrl: string | null }> {
    this.cleanup();

    this.pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 10,
    });

    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];

    if (videoTrack) {
      if (videoTrack.contentHint === "") {
        videoTrack.contentHint = "motion";
      }
      this.videoSender = this.pc.addTrack(videoTrack, stream);
    }

    if (audioTrack) {
      this.audioSender = this.pc.addTrack(audioTrack, stream);
    }

    this.setCodecPreferences();
    await this.applyBitrateConstraints();

    const offer = await this.pc.createOffer();
    const enhancedSdp = preferH264(offer.sdp ?? "");
    await this.pc.setLocalDescription({ type: "offer", sdp: enhancedSdp });

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
        throw new Error(
          `WHIP connection failed: ${response.status} ${response.statusText} ${errorText}`,
        );
      }

      const location = response.headers.get("location");
      if (location) {
        this.resourceUrl = new URL(location, this.url).toString();
      }

      this.whepUrl = response.headers.get("livepeer-playback-url");

      const answerSdp = await response.text();
      await this.pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      await this.applyBitrateConstraints();
      this.startStatsTimer();

      return { whepUrl: this.whepUrl };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private setCodecPreferences(): void {
    if (!this.pc) return;

    try {
      const transceiver = this.pc
        .getTransceivers()
        .find((t) => t.sender.track?.kind === "video");
      if (!transceiver?.setCodecPreferences) return;

      const caps = RTCRtpSender.getCapabilities("video");
      if (!caps?.codecs?.length) return;

      const h264Codecs = caps.codecs.filter((c) =>
        c.mimeType.toLowerCase().includes("h264"),
      );
      if (h264Codecs.length) {
        transceiver.setCodecPreferences(h264Codecs);
      }
    } catch {
      // Codec preferences not supported
    }
  }

  private async applyBitrateConstraints(): Promise<void> {
    if (!this.pc) return;

    const senders = this.pc.getSenders();
    for (const sender of senders) {
      if (!sender.track) continue;

      const params = sender.getParameters();
      if (!params.encodings) params.encodings = [{}];

      const encoding = params.encodings[0];
      if (!encoding) continue;

      if (sender.track.kind === "video") {
        encoding.maxBitrate = this.videoBitrate;
        if (this.maxFramerate && this.maxFramerate > 0) {
          encoding.maxFramerate = this.maxFramerate;
        }
        params.degradationPreference = "maintain-resolution";
      } else if (sender.track.kind === "audio") {
        encoding.maxBitrate = this.audioBitrate;
      }

      try {
        await sender.setParameters(params);
      } catch {
        // Parameters not supported
      }
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

  async replaceTrack(track: MediaStreamTrack): Promise<void> {
    if (!this.pc) {
      throw new Error("Not connected");
    }

    const sender = track.kind === "video" ? this.videoSender : this.audioSender;
    if (!sender) {
      throw new Error(`No sender found for track kind: ${track.kind}`);
    }

    await sender.replaceTrack(track);
    await this.applyBitrateConstraints();
  }

  setMaxFramerate(fps?: number): void {
    this.maxFramerate = fps;
    void this.applyBitrateConstraints();
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

    this.videoSender = null;
    this.audioSender = null;
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
    this.resourceUrl = null;
    this.whepUrl = null;
  }

  getWhepUrl(): string | null {
    return this.whepUrl;
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
