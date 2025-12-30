export interface PeerConnectionFactory {
  create(config: RTCConfiguration): RTCPeerConnection;
}

export interface FetchFn {
  (input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface TimerProvider {
  setTimeout(callback: () => void, ms: number): number;
  clearTimeout(id: number): void;
  setInterval(callback: () => void, ms: number): number;
  clearInterval(id: number): void;
}

export interface MediaStreamFactory {
  create(): MediaStream;
}

export const defaultMediaStreamFactory: MediaStreamFactory = {
  create: () => new MediaStream(),
};

export const defaultPeerConnectionFactory: PeerConnectionFactory = {
  create: (config) => new RTCPeerConnection(config),
};

export const defaultFetch: FetchFn = globalThis.fetch.bind(globalThis);

export const defaultTimerProvider: TimerProvider = {
  setTimeout: (cb, ms) => globalThis.setTimeout(cb, ms) as unknown as number,
  clearTimeout: (id) => globalThis.clearTimeout(id),
  setInterval: (cb, ms) => globalThis.setInterval(cb, ms) as unknown as number,
  clearInterval: (id) => globalThis.clearInterval(id),
};

