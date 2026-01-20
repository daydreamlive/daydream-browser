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

/**
 * API provided by the CompositorProvider context.
 * Combines compositor functionality with React state management.
 *
 * @example
 * ```tsx
 * function VideoSource() {
 *   const compositor = useCompositor();
 *   const videoRef = useRef<HTMLVideoElement>(null);
 *
 *   useEffect(() => {
 *     if (videoRef.current) {
 *       compositor.register("camera", { kind: "video", element: videoRef.current });
 *       compositor.activate("camera");
 *     }
 *     return () => compositor.unregister("camera");
 *   }, [compositor]);
 *
 *   return <video ref={videoRef} />;
 * }
 * ```
 */
export interface CompositorApi {
  // Registry
  /** Register a source with a unique ID. */
  register(id: string, source: Source): void;
  /** Unregister a source by ID. */
  unregister(id: string): void;
  /** Get a registered source by ID. */
  get(id: string): Source | undefined;
  /** Check if a source is registered. */
  has(id: string): boolean;
  /** List all registered sources. */
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
  /** Deactivate the current source. */
  deactivate(): void;
  /** ID of the currently active source, or null if none. */
  readonly activeId: string | null;

  // Output (reactive)
  /** The composited output MediaStream. Reactive - updates when stream changes. */
  readonly stream: MediaStream | null;
  /** Current output size. Reactive - updates when size changes. */
  readonly size: Size;
  /** Resize the output canvas. */
  setSize(width: number, height: number, dpr?: number): void;

  // FPS (reactive)
  /** Current rendering frame rate. Reactive. */
  readonly fps: number;
  /** Set the rendering frame rate. */
  setFps(fps: number): void;
  /** Current send frame rate. Reactive. */
  readonly sendFps: number;
  /** Set the send frame rate. */
  setSendFps(fps: number): void;

  // Audio
  /** Add an audio track to the output stream. */
  addAudioTrack(track: MediaStreamTrack): void;
  /** Remove an audio track by track ID. */
  removeAudioTrack(trackId: string): void;
  /** Manually unlock the audio context. */
  unlockAudio(): Promise<boolean>;

  // Events
  /** Subscribe to compositor events. */
  on: Compositor["on"];
}

const CompositorContext = createContext<CompositorApi | null>(null);

/**
 * Props for the CompositorProvider component.
 * Inherits all CompositorOptions except onSendFpsChange (managed internally).
 */
export interface CompositorProviderProps
  extends PropsWithChildren,
    Partial<Omit<CompositorOptions, "onSendFpsChange">> {}

/**
 * React context provider for the Compositor.
 * Creates and manages a Compositor instance, providing it to child components via context.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <CompositorProvider width={1280} height={720} fps={30}>
 *       <VideoSource />
 *       <BroadcastButton />
 *     </CompositorProvider>
 *   );
 * }
 * ```
 */
export function CompositorProvider({
  children,
  width = 512,
  height = 512,
  fps: initialFps = 30,
  sendFps: initialSendFps,
  dpr,
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

/**
 * Hook to access the Compositor API from context.
 * Must be used within a CompositorProvider.
 *
 * @returns The CompositorApi for managing sources and output
 * @throws {Error} If used outside of CompositorProvider
 *
 * @example
 * ```tsx
 * function BroadcastButton() {
 *   const compositor = useCompositor();
 *   const { start } = useBroadcast({ whipUrl: "..." });
 *
 *   const handleClick = async () => {
 *     if (compositor.stream) {
 *       await start(compositor.stream);
 *     }
 *   };
 *
 *   return <button onClick={handleClick}>Start Broadcast</button>;
 * }
 * ```
 */
export function useCompositor(): CompositorApi {
  const ctx = useContext(CompositorContext);
  if (!ctx) {
    throw new Error("useCompositor must be used within <CompositorProvider>");
  }
  return ctx;
}
