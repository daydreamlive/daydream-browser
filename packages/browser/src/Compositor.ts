import { createRegistry } from "./internal/compositor/Registry";
import { createRenderer, type Renderer } from "./internal/compositor/Renderer";
import { createScheduler, type Scheduler } from "./internal/compositor/Scheduler";
import { createAudioManager, type AudioManager } from "./internal/compositor/AudioManager";
import { createVisibilityHandler, type VisibilityHandler } from "./internal/compositor/VisibilityHandler";
import { TypedEventEmitter } from "./internal/TypedEventEmitter";
import type {
  Compositor as ICompositor,
  CompositorEventMap,
  CompositorOptions,
  Size,
  Source,
} from "./types/compositor";
import type { SourceRegistry } from "./internal/compositor/Registry";

export class Compositor extends TypedEventEmitter<CompositorEventMap> implements ICompositor {
  private readonly registry: SourceRegistry;
  private readonly renderer: Renderer;
  private readonly scheduler: Scheduler;
  private readonly audioManager: AudioManager;
  private readonly visibilityHandler: VisibilityHandler;

  private _activeId: string | null = null;
  private _fps: number;
  private _sendFps: number;
  private lastVisibleSendFps: number | null = null;
  private outputStream: MediaStream | null = null;
  private destroyed = false;

  constructor(options: CompositorOptions = {}) {
    super();

    const width = options.width ?? 512;
    const height = options.height ?? 512;
    this._fps = Math.max(1, options.fps ?? 30);
    this._sendFps = Math.max(1, options.sendFps ?? this._fps);
    const dpr = Math.min(
      2,
      options.dpr ??
        (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1),
    );
    const keepalive = options.keepalive ?? true;

    // Create subsystems
    this.registry = createRegistry({
      onRegister: (id, source) => this.emit("registered", id, source),
      onUnregister: (id) => this.emit("unregistered", id),
    });

    this.renderer = createRenderer({
      width,
      height,
      dpr,
      keepalive,
    });

    this.scheduler = createScheduler({
      fps: this._fps,
      sendFps: this._sendFps,
      onFrame: (timestamp) => this.renderer.renderFrame(timestamp),
      onSendFpsChange: (fps) => {
        this._sendFps = fps;
        options.onSendFpsChange?.(fps);
        this.applyVideoTrackConstraints();
      },
    });

    this.audioManager = createAudioManager({
      autoUnlock: options.autoUnlockAudio ?? true,
      unlockEvents:
        options.unlockEvents && options.unlockEvents.length > 0
          ? options.unlockEvents
          : ["pointerdown", "click", "touchstart", "keydown"],
      disableSilentAudio: options.disableSilentAudio ?? false,
    });

    this.visibilityHandler = createVisibilityHandler({
      onHidden: () => {
        if (this.lastVisibleSendFps == null) this.lastVisibleSendFps = this._sendFps;
        if (this._sendFps !== 5) {
          this.scheduler.setSendFps(5);
          this._sendFps = 5;
        }
      },
      onVisible: () => {
        if (this.lastVisibleSendFps != null && this._sendFps !== this.lastVisibleSendFps) {
          this.scheduler.setSendFps(this.lastVisibleSendFps);
          this._sendFps = this.lastVisibleSendFps;
        }
        this.lastVisibleSendFps = null;
      },
      backgroundRenderFn: () => {
        this.renderer.renderFrame(performance.now());
        this.requestVideoTrackFrame();
      },
    });

    // Initialize
    this.outputStream = this.createOutputStream();
    this.audioManager.setOutputStream(this.outputStream);
    this.visibilityHandler.start();
  }

  // ============================================================================
  // Source Registry
  // ============================================================================

  register(id: string, source: Source): void {
    if (this.destroyed) return;
    this.registry.register(id, source);
  }

  unregister(id: string): void {
    if (this.destroyed) return;
    const wasActive = this._activeId === id;
    this.registry.unregister(id);

    if (wasActive) {
      this._activeId = null;
      this.renderer.setActiveSource(null);
      this.scheduler.stop();
      this.emit("activated", null, undefined);
    }
  }

  get(id: string): Source | undefined {
    return this.registry.get(id);
  }

  has(id: string): boolean {
    return this.registry.has(id);
  }

  list(): Array<{ id: string; source: Source }> {
    return this.registry.list();
  }

  // ============================================================================
  // Active Source Management
  // ============================================================================

  activate(id: string): void {
    if (this.destroyed) return;

    const source = this.registry.get(id);
    if (!source) {
      throw new Error(`Source "${id}" not registered`);
    }

    this._activeId = id;
    this.renderer.setActiveSource(source);

    // Start scheduler with video element if applicable
    const videoEl = source.kind === "video" ? source.element : undefined;
    this.scheduler.start(videoEl);

    this.emit("activated", id, source);
  }

  deactivate(): void {
    if (this.destroyed) return;

    this._activeId = null;
    this.renderer.setActiveSource(null);
    this.scheduler.stop();
    this.emit("activated", null, undefined);
  }

  get activeId(): string | null {
    return this._activeId;
  }

  // ============================================================================
  // Output Stream
  // ============================================================================

  get stream(): MediaStream {
    return this.outputStream!;
  }

  // ============================================================================
  // Settings
  // ============================================================================

  resize(width: number, height: number, dpr?: number): void {
    if (this.destroyed) return;

    const effectiveDpr = Math.min(
      2,
      dpr ??
        (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1),
    );

    this.renderer.resize(width, height, effectiveDpr);
    this.recreateStream();
  }

  get size(): Size {
    return this.renderer.size;
  }

  setFps(fps: number): void {
    if (this.destroyed) return;

    const next = Math.max(1, fps);
    if (this._fps === next) return;

    this._fps = next;
    this.scheduler.setFps(next);
    this.recreateStream();
  }

  get fps(): number {
    return this._fps;
  }

  setSendFps(fps: number): void {
    if (this.destroyed) return;

    const next = Math.max(1, fps);
    if (this._sendFps === next) return;

    this._sendFps = next;
    this.scheduler.setSendFps(next);
  }

  get sendFps(): number {
    return this._sendFps;
  }

  // ============================================================================
  // Audio
  // ============================================================================

  addAudioTrack(track: MediaStreamTrack): void {
    if (this.destroyed) return;
    this.audioManager.addTrack(track);
  }

  removeAudioTrack(trackId: string): void {
    if (this.destroyed) return;
    this.audioManager.removeTrack(trackId);
  }

  unlockAudio(): Promise<boolean> {
    if (this.destroyed) return Promise.resolve(false);
    return this.audioManager.unlock();
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.scheduler.stop();
    this.visibilityHandler.stop();
    this.audioManager.destroy();
    this.renderer.destroy();
    this.registry.clear();

    // Stop video tracks
    if (this.outputStream) {
      try {
        this.outputStream.getVideoTracks().forEach((t) => {
          try {
            t.stop();
          } catch {
            // Failed to stop video track
          }
        });
      } catch {
        // Failed to get video tracks
      }
    }

    this.outputStream = null;
    this.clearListeners();
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private createOutputStream(): MediaStream {
    const stream = this.renderer.captureCanvas.captureStream(this._fps);

    // Set video track content hint
    try {
      const vtrack = stream.getVideoTracks()[0];
      if (vtrack && vtrack.contentHint !== undefined) {
        vtrack.contentHint = "detail";
      }
    } catch {
      // Failed to set video track content hint
    }

    return stream;
  }

  private recreateStream(): void {
    const newStream = this.createOutputStream();
    const prev = this.outputStream;

    // Transfer audio tracks
    if (prev && prev !== newStream) {
      try {
        prev.getAudioTracks().forEach((t) => {
          try {
            newStream.addTrack(t);
          } catch {
            // Failed to transfer audio track
          }
        });
      } catch {
        // Failed to get audio tracks
      }
    }

    this.outputStream = newStream;
    this.audioManager.setOutputStream(newStream);
    this.applyVideoTrackConstraints();

    // Stop old video tracks
    if (prev && prev !== newStream) {
      try {
        prev.getVideoTracks().forEach((t) => {
          try {
            t.stop();
          } catch {
            // Failed to stop video track
          }
        });
      } catch {
        // Failed to get video tracks
      }
    }
  }

  private applyVideoTrackConstraints(): void {
    try {
      const track = this.outputStream?.getVideoTracks()[0];
      const canvas = this.renderer.captureCanvas;
      if (!track || !canvas) return;

      const constraints: MediaTrackConstraints = {
        width: canvas.width,
        height: canvas.height,
        frameRate: Math.max(1, this._sendFps || this._fps),
      };

      try {
        if ((track as MediaStreamTrack & { contentHint?: string }).contentHint !== undefined) {
          (track as MediaStreamTrack & { contentHint?: string }).contentHint = "detail";
        }
      } catch {
        // Failed to set content hint
      }

      track.applyConstraints(constraints).catch(() => {
        // Failed to apply constraints
      });
    } catch {
      // Error in applyVideoTrackConstraints
    }
  }

  private requestVideoTrackFrame(): void {
    const track = this.outputStream?.getVideoTracks()[0];
    if (track && typeof (track as MediaStreamTrack & { requestFrame?: () => void }).requestFrame === "function") {
      try {
        (track as MediaStreamTrack & { requestFrame: () => void }).requestFrame();
      } catch {
        // Failed to request video frame
      }
    }
  }
}

export function createCompositor(options: CompositorOptions = {}): Compositor {
  return new Compositor(options);
}
