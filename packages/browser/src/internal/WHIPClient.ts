import {
  DEFAULT_ICE_SERVERS,
  DEFAULT_VIDEO_BITRATE,
  DEFAULT_AUDIO_BITRATE,
  type WHIPResponseResult,
} from "../types";
import { ConnectionError, NetworkError } from "../errors";
import {
  type PeerConnectionFactory,
  type FetchFn,
  type TimerProvider,
  defaultPeerConnectionFactory,
  defaultFetch,
  defaultTimerProvider,
} from "./dependencies";

const PLAYBACK_ID_PATTERN = /([/+])([^/+?]+)$/;
const PLAYBACK_ID_PLACEHOLDER = "__PLAYBACK_ID__";

export interface RedirectCache {
  get(key: string): URL | undefined;
  set(key: string, value: URL): void;
}

class LRURedirectCache implements RedirectCache {
  private cache = new Map<string, URL>();
  private readonly maxSize: number;

  constructor(maxSize = 10) {
    this.maxSize = maxSize;
  }

  get(key: string): URL | undefined {
    const cached = this.cache.get(key);
    if (cached) {
      this.cache.delete(key);
      this.cache.set(key, cached);
    }
    return cached;
  }

  set(key: string, value: URL): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, value);
  }
}

export interface WHIPClientConfig {
  url: string;
  iceServers?: RTCIceServer[];
  videoBitrate?: number;
  audioBitrate?: number;
  maxFramerate?: number;
  connectionTimeout?: number;
  skipIceGathering?: boolean;
  onStats?: (report: RTCStatsReport) => void;
  statsIntervalMs?: number;
  onResponse?: (response: Response) => WHIPResponseResult | void;
  peerConnectionFactory?: PeerConnectionFactory;
  fetch?: FetchFn;
  timers?: TimerProvider;
  redirectCache?: RedirectCache;
}

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

const sharedRedirectCache = new LRURedirectCache();

const DEFAULT_CONNECTION_TIMEOUT = 10000;

export class WHIPClient {
  private readonly url: string;
  private readonly iceServers: RTCIceServer[];
  private readonly videoBitrate: number;
  private readonly audioBitrate: number;
  private readonly connectionTimeout: number;
  private readonly onStats?: (report: RTCStatsReport) => void;
  private readonly statsIntervalMs: number;
  private readonly onResponse?: (
    response: Response,
  ) => WHIPResponseResult | void;
  private readonly pcFactory: PeerConnectionFactory;
  private readonly fetch: FetchFn;
  private readonly timers: TimerProvider;
  private readonly redirectCache: RedirectCache;
  private readonly skipIceGathering: boolean;

  private maxFramerate?: number;
  private pc: RTCPeerConnection | null = null;
  private resourceUrl: string | null = null;
  private abortController: AbortController | null = null;
  private statsTimer: number | null = null;
  private videoSender: RTCRtpSender | null = null;
  private audioSender: RTCRtpSender | null = null;
  private videoTransceiver: RTCRtpTransceiver | null = null;
  private audioTransceiver: RTCRtpTransceiver | null = null;
  private iceGatheringTimer: number | null = null;

  constructor(config: WHIPClientConfig) {
    this.url = config.url;
    this.iceServers = config.iceServers ?? DEFAULT_ICE_SERVERS;
    this.videoBitrate = config.videoBitrate ?? DEFAULT_VIDEO_BITRATE;
    this.audioBitrate = config.audioBitrate ?? DEFAULT_AUDIO_BITRATE;
    this.connectionTimeout = config.connectionTimeout ?? DEFAULT_CONNECTION_TIMEOUT;
    this.maxFramerate = config.maxFramerate;
    this.onStats = config.onStats;
    this.statsIntervalMs = config.statsIntervalMs ?? 5000;
    this.onResponse = config.onResponse;
    this.pcFactory =
      config.peerConnectionFactory ?? defaultPeerConnectionFactory;
    this.fetch = config.fetch ?? defaultFetch;
    this.timers = config.timers ?? defaultTimerProvider;
    this.redirectCache = config.redirectCache ?? sharedRedirectCache;
    this.skipIceGathering = config.skipIceGathering ?? true;
  }

  async connect(stream: MediaStream): Promise<{ whepUrl: string | null }> {
    this.cleanup();

    this.pc = this.pcFactory.create({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 10,
    });

    this.videoTransceiver = this.pc.addTransceiver("video", {
      direction: "sendonly",
    });
    this.audioTransceiver = this.pc.addTransceiver("audio", {
      direction: "sendonly",
    });
    this.videoSender = this.videoTransceiver.sender;
    this.audioSender = this.audioTransceiver.sender;

    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];

    if (videoTrack) {
      if (videoTrack.contentHint === "") {
        videoTrack.contentHint = "motion";
      }
      await this.videoSender.replaceTrack(videoTrack);
    }

    if (audioTrack) {
      await this.audioSender.replaceTrack(audioTrack);
    }

    this.setCodecPreferences();
    await this.applyBitrateConstraints();

    const offer = await this.pc.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false,
    });
    const enhancedSdp = preferH264(offer.sdp ?? "");
    await this.pc.setLocalDescription({ type: "offer", sdp: enhancedSdp });

    if (!this.skipIceGathering) {
      await this.waitForIceGathering();
    }

    this.abortController = new AbortController();
    const timeoutId = this.timers.setTimeout(
      () => this.abortController?.abort(),
      this.connectionTimeout,
    );

    try {
      const fetchUrl = this.getUrlWithCachedRedirect();

      const response = await this.fetch(fetchUrl, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: this.pc.localDescription!.sdp,
        signal: this.abortController.signal,
      });

      this.timers.clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new ConnectionError(
          `WHIP connection failed: ${response.status} ${response.statusText} ${errorText}`,
        );
      }

      this.cacheRedirectIfNeeded(fetchUrl, response.url);

      const location = response.headers.get("location");
      if (location) {
        this.resourceUrl = new URL(location, this.url).toString();
      }

      const responseResult = this.onResponse?.(response);

      const answerSdp = await response.text();
      await this.pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      await this.applyBitrateConstraints();
      this.startStatsTimer();

      return { whepUrl: responseResult?.whepUrl ?? null };
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

  private setCodecPreferences(): void {
    if (!this.videoTransceiver?.setCodecPreferences) return;

    try {
      const caps = RTCRtpSender.getCapabilities("video");
      if (!caps?.codecs?.length) return;

      const h264Codecs = caps.codecs.filter((c) =>
        c.mimeType.toLowerCase().includes("h264"),
      );
      if (h264Codecs.length) {
        this.videoTransceiver.setCodecPreferences(h264Codecs);
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
        encoding.scaleResolutionDownBy = 1.0;
        encoding.priority = "high";
        encoding.networkPriority = "high";
        params.degradationPreference = "maintain-resolution";
      } else if (sender.track.kind === "audio") {
        encoding.maxBitrate = this.audioBitrate;
        encoding.priority = "medium";
        encoding.networkPriority = "medium";
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

  async replaceTrack(track: MediaStreamTrack): Promise<void> {
    if (!this.pc) {
      throw new ConnectionError("Not connected");
    }

    const sender = track.kind === "video" ? this.videoSender : this.audioSender;
    if (!sender) {
      throw new ConnectionError(
        `No sender found for track kind: ${track.kind}`,
      );
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
    this.videoTransceiver = null;
    this.audioTransceiver = null;
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
    this.resourceUrl = null;
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

  isConnected(): boolean {
    return this.pc !== null && this.pc.connectionState === "connected";
  }

  private getUrlWithCachedRedirect(): string {
    const originalUrl = new URL(this.url);
    const playbackIdMatch = originalUrl.pathname.match(PLAYBACK_ID_PATTERN);
    const playbackId = playbackIdMatch?.[2];

    const cachedTemplate = this.redirectCache.get(this.url);
    if (!cachedTemplate || !playbackId) {
      return this.url;
    }

    const redirectedUrl = new URL(cachedTemplate);
    redirectedUrl.pathname = cachedTemplate.pathname.replace(
      PLAYBACK_ID_PLACEHOLDER,
      playbackId,
    );
    return redirectedUrl.toString();
  }

  private cacheRedirectIfNeeded(requestUrl: string, responseUrl: string): void {
    if (requestUrl === responseUrl) return;

    try {
      const actualRedirect = new URL(responseUrl);
      const template = new URL(actualRedirect);
      template.pathname = template.pathname.replace(
        PLAYBACK_ID_PATTERN,
        `$1${PLAYBACK_ID_PLACEHOLDER}`,
      );
      this.redirectCache.set(this.url, template);
    } catch {
      // Invalid URL, skip caching
    }
  }
}
