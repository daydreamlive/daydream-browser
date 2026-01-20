import { vi } from "vitest";

// Mock MediaStream for jsdom
class MockMediaStream {
  id = "mock-stream-id";
  active = true;
  private tracks: MediaStreamTrack[] = [];

  getVideoTracks() {
    return this.tracks.filter((t) => t.kind === "video");
  }
  getAudioTracks() {
    return this.tracks.filter((t) => t.kind === "audio");
  }
  getTracks() {
    return [...this.tracks];
  }
  addTrack(track: MediaStreamTrack) {
    this.tracks.push(track);
  }
  removeTrack(track: MediaStreamTrack) {
    const idx = this.tracks.indexOf(track);
    if (idx >= 0) this.tracks.splice(idx, 1);
  }
  clone() {
    return new MockMediaStream();
  }
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();
}

// Mock RTCPeerConnection
class MockRTCPeerConnection {
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  iceConnectionState = "new";
  iceGatheringState = "new";
  connectionState = "new";
  oniceconnectionstatechange: (() => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  ontrack: ((event: unknown) => void) | null = null;

  async createOffer() {
    return { type: "offer", sdp: "mock-sdp" };
  }
  async createAnswer() {
    return { type: "answer", sdp: "mock-sdp" };
  }
  async setLocalDescription(desc: RTCSessionDescriptionInit) {
    this.localDescription = desc;
  }
  async setRemoteDescription(desc: RTCSessionDescriptionInit) {
    this.remoteDescription = desc;
  }
  addTransceiver() {
    return { sender: { replaceTrack: vi.fn(), setParameters: vi.fn(), getParameters: () => ({ encodings: [{}] }) } };
  }
  getSenders() {
    return [];
  }
  getTransceivers() {
    return [];
  }
  close() {}
  restartIce() {}
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
}

// Assign to global
globalThis.MediaStream = MockMediaStream as unknown as typeof MediaStream;
globalThis.RTCPeerConnection = MockRTCPeerConnection as unknown as typeof RTCPeerConnection;
