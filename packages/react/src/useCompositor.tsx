"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  createCompositor,
  type Compositor,
  type CompositorOptions,
  type Size,
  type Source,
} from "@daydreamlive/browser";

export interface CompositorApi {
  // Registry
  register(id: string, source: Source): void;
  unregister(id: string): void;
  get(id: string): Source | undefined;
  has(id: string): boolean;
  list(): Array<{ id: string; source: Source }>;

  /**
   * Register a source, activate it, and return an unregister function.
   * Convenience method that combines register + activate with automatic cleanup.
   *
   * @example
   * ```tsx
   * useEffect(() => {
   *   const unregister = compositor.use("camera", {
   *     kind: "video",
   *     element: videoRef.current,
   *     fit: "cover",
   *   });
   *   return unregister;
   * }, [compositor]);
   * ```
   */
  use(id: string, source: Source): () => void;

  // Active source
  /**
   * Activate a registered source.
   * @param id - The source ID to activate
   */
  activate(id: string): void;
  deactivate(): void;
  readonly activeId: string | null;

  // Output (reactive)
  readonly stream: MediaStream | null;
  readonly size: Size;
  setSize(width: number, height: number, dpr?: number): void;

  // FPS (reactive)
  readonly fps: number;
  setFps(fps: number): void;
  readonly sendFps: number;
  setSendFps(fps: number): void;

  // Audio
  addAudioTrack(track: MediaStreamTrack): void;
  removeAudioTrack(trackId: string): void;
  unlockAudio(): Promise<boolean>;

  // Events
  on: Compositor["on"];
}

const CompositorContext = createContext<CompositorApi | null>(null);

export interface CompositorProviderProps
  extends PropsWithChildren,
    Partial<Omit<CompositorOptions, "onSendFpsChange">> {}

export function CompositorProvider({
  children,
  width = 512,
  height = 512,
  fps: initialFps = 30,
  sendFps: initialSendFps,
  dpr,
  crossfadeMs = 500,
  keepalive,
  autoUnlockAudio,
  unlockEvents,
  disableSilentAudio = true,
}: CompositorProviderProps) {
  const compositorRef = useRef<Compositor | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [size, setSize] = useState<Size>({
    width,
    height,
    dpr: Math.min(
      2,
      dpr ?? (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1),
    ),
  });
  const [fps, setFpsState] = useState(initialFps);
  const [sendFps, setSendFpsState] = useState(initialSendFps ?? initialFps);

  // Create compositor once
  useLayoutEffect(() => {
    const compositor = createCompositor({
      width,
      height,
      fps: initialFps,
      sendFps: initialSendFps,
      dpr,
      crossfadeMs,
      keepalive,
      autoUnlockAudio,
      unlockEvents,
      disableSilentAudio,
      onSendFpsChange: (newFps) => setSendFpsState(newFps),
    });

    compositorRef.current = compositor;
    setStream(compositor.stream);
    setSize(compositor.size);

    return () => {
      compositor.destroy();
      compositorRef.current = null;
    };
  }, []);

  // Sync size changes
  useEffect(() => {
    const compositor = compositorRef.current;
    if (!compositor) return;

    compositor.resize(size.width, size.height, size.dpr);
    setStream(compositor.stream);
  }, [size.width, size.height, size.dpr]);

  // Sync fps changes
  useEffect(() => {
    const compositor = compositorRef.current;
    if (!compositor) return;

    compositor.setFps(fps);
    setStream(compositor.stream);
  }, [fps]);

  // Sync sendFps changes
  useEffect(() => {
    const compositor = compositorRef.current;
    if (!compositor) return;

    compositor.setSendFps(sendFps);
  }, [sendFps]);

  // Memoized API
  const api = useMemo<CompositorApi>(
    () => ({
      // Registry
      register: (id, source) => compositorRef.current?.register(id, source),
      unregister: (id) => compositorRef.current?.unregister(id),
      get: (id) => compositorRef.current?.get(id),
      has: (id) => compositorRef.current?.has(id) ?? false,
      list: () => compositorRef.current?.list() ?? [],
      use: (id, source) => {
        compositorRef.current?.register(id, source);
        compositorRef.current?.activate(id);
        return () => compositorRef.current?.unregister(id);
      },

      // Active source
      activate: (id) => compositorRef.current?.activate(id),
      deactivate: () => compositorRef.current?.deactivate(),
      get activeId() {
        return compositorRef.current?.activeId ?? null;
      },

      // Stream & size
      stream,
      size,
      setSize: (w, h, d) =>
        setSize({ width: w, height: h, dpr: d ?? size.dpr }),

      // FPS
      fps,
      setFps: setFpsState,
      sendFps,
      setSendFps: setSendFpsState,

      // Audio
      addAudioTrack: (t) => compositorRef.current?.addAudioTrack(t),
      removeAudioTrack: (id) => compositorRef.current?.removeAudioTrack(id),
      unlockAudio: () =>
        compositorRef.current?.unlockAudio() ?? Promise.resolve(false),

      // Events
      on: (event, cb) => compositorRef.current?.on(event, cb) ?? (() => {}),
    }),
    [stream, size, fps, sendFps],
  );

  return (
    <CompositorContext.Provider value={api}>
      {children}
    </CompositorContext.Provider>
  );
}

export function useCompositor(): CompositorApi {
  const ctx = useContext(CompositorContext);
  if (!ctx) {
    throw new Error("useCompositor must be used within <CompositorProvider>");
  }
  return ctx;
}
