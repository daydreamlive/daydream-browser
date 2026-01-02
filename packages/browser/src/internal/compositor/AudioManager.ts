export interface AudioManagerOptions {
  autoUnlock: boolean;
  unlockEvents: string[];
  disableSilentAudio: boolean;
}

export interface AudioManager {
  setOutputStream(stream: MediaStream): void;
  addTrack(track: MediaStreamTrack): void;
  removeTrack(trackId: string): void;
  unlock(): Promise<boolean>;
  destroy(): void;
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export function createAudioManager(options: AudioManagerOptions): AudioManager {
  let outputStream: MediaStream | null = null;

  // Audio context and silent track
  let audioCtx: AudioContext | null = null;
  let silentOsc: OscillatorNode | null = null;
  let silentGain: GainNode | null = null;
  let audioDst: MediaStreamAudioDestinationNode | null = null;
  let silentAudioTrack: MediaStreamTrack | null = null;

  // External tracks
  const externalAudioTrackIds = new Set<string>();
  const externalAudioEndHandlers = new Map<string, (ev: Event) => void>();

  // Auto unlock
  let audioUnlockHandler: ((ev: Event) => void) | null = null;
  let audioUnlockAttached = false;
  let audioStateListenerAttached = false;

  function ensureSilentAudioTrack(): void {
    if (options.disableSilentAudio) return;
    if (!outputStream) return;

    const alreadyHasAudio = outputStream.getAudioTracks().length > 0;
    if (alreadyHasAudio) return;

    if (silentAudioTrack && silentAudioTrack.readyState === "live") {
      try {
        outputStream.addTrack(silentAudioTrack);
      } catch {
        // Failed to add silent track
      }
      return;
    }

    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      audioCtx = new AudioContextClass({
        sampleRate: 48000,
      });
      try {
        audioCtx.resume().catch(() => {
          // Failed to resume AudioContext
        });
      } catch {
        // Error calling resume
      }
      attachAudioCtxStateListener();
    }

    const ac = audioCtx;
    if (!ac) return;

    silentOsc = ac.createOscillator();
    silentGain = ac.createGain();
    audioDst = ac.createMediaStreamDestination();

    silentGain.gain.setValueAtTime(0.0001, ac.currentTime);
    silentOsc.frequency.setValueAtTime(440, ac.currentTime);
    silentOsc.type = "sine";
    silentOsc.connect(silentGain);
    silentGain.connect(audioDst);
    silentOsc.start();

    const track = audioDst.stream.getAudioTracks()[0];
    if (track) {
      silentAudioTrack = track;
      try {
        outputStream.addTrack(track);
      } catch {
        // Failed to add track to stream
      }
    }
  }

  function removeSilentAudioTrack(): void {
    try {
      if (outputStream && silentAudioTrack) {
        try {
          outputStream.removeTrack(silentAudioTrack);
        } catch {
          // Failed to remove silent track
        }
      }
      if (silentOsc) {
        try {
          silentOsc.stop();
        } catch {
          // Failed to stop oscillator
        }
        try {
          silentOsc.disconnect();
        } catch {
          // Failed to disconnect oscillator
        }
      }
      if (silentGain) {
        try {
          silentGain.disconnect();
        } catch {
          // Failed to disconnect gain
        }
      }
      silentOsc = null;
      silentGain = null;
      audioDst = null;
      silentAudioTrack = null;
      if (audioCtx) {
        try {
          audioCtx.close();
        } catch {
          // Failed to close AudioContext
        }
      }
      audioCtx = null;
    } catch {
      // Error in removeSilentAudioTrack
    }
  }

  function rebuildSilentAudioTrack(): void {
    if (options.disableSilentAudio) return;
    if (!outputStream) return;
    if (externalAudioTrackIds.size > 0) return;

    if (silentAudioTrack) {
      try {
        outputStream.removeTrack(silentAudioTrack);
      } catch {
        // Failed to remove silent track
      }
    }

    if (silentOsc) {
      try {
        silentOsc.stop();
      } catch {
        // Failed to stop oscillator
      }
      try {
        silentOsc.disconnect();
      } catch {
        // Failed to disconnect oscillator
      }
    }
    if (silentGain) {
      try {
        silentGain.disconnect();
      } catch {
        // Failed to disconnect gain
      }
    }
    silentOsc = null;
    silentGain = null;
    audioDst = null;
    silentAudioTrack = null;

    const ac = audioCtx;
    if (!ac || ac.state !== "running") return;

    attachAudioCtxStateListener();

    silentOsc = ac.createOscillator();
    silentGain = ac.createGain();
    audioDst = ac.createMediaStreamDestination();

    silentGain.gain.setValueAtTime(0.0001, ac.currentTime);
    silentOsc.frequency.setValueAtTime(440, ac.currentTime);
    silentOsc.type = "sine";
    silentOsc.connect(silentGain);
    silentGain.connect(audioDst);
    silentOsc.start();

    const track = audioDst.stream.getAudioTracks()[0];
    if (track) {
      silentAudioTrack = track;
      try {
        outputStream.addTrack(track);
      } catch {
        // Failed to add track to stream
      }
    }
  }

  function attachAudioCtxStateListener(): void {
    const ac = audioCtx;
    if (!ac || audioStateListenerAttached) return;

    const onStateChange = (): void => {
      try {
        if (audioCtx && audioCtx.state === "running") {
          rebuildSilentAudioTrack();
          cleanupAudioAutoUnlock();
        }
      } catch {
        // Error in state change handler
      }
    };

    try {
      (ac as AudioContext & { onstatechange: (() => void) | null }).onstatechange = onStateChange;
      audioStateListenerAttached = true;
    } catch {
      // Failed to attach state listener
    }
  }

  function setupAudioAutoUnlock(): void {
    if (!options.autoUnlock) return;
    if (typeof document === "undefined") return;
    if (audioUnlockAttached) return;

    const handler = (): void => {
      unlock();
    };

    audioUnlockHandler = handler;
    options.unlockEvents.forEach((evt) => {
      try {
        document.addEventListener(evt, handler, { capture: true });
      } catch {
        // Failed to add unlock listener
      }
    });
    audioUnlockAttached = true;
  }

  function cleanupAudioAutoUnlock(): void {
    if (!audioUnlockAttached) return;
    if (typeof document !== "undefined" && audioUnlockHandler) {
      options.unlockEvents.forEach((evt) => {
        try {
          document.removeEventListener(evt, audioUnlockHandler!, {
            capture: true,
          });
        } catch {
          // Failed to remove unlock listener
        }
      });
    }
    audioUnlockAttached = false;
    audioUnlockHandler = null;
  }

  async function unlock(): Promise<boolean> {
    try {
      if (typeof window === "undefined") return false;

      if (!audioCtx || audioCtx.state === "closed") {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return false;

        audioCtx = new AudioContextClass({
          sampleRate: 48000,
        });
      }

      const ac = audioCtx;
      if (!ac) return false;

      try {
        await ac.resume();
      } catch {
        // Failed to resume AudioContext
      }

      attachAudioCtxStateListener();

      if (ac.state === "running") {
        rebuildSilentAudioTrack();
        cleanupAudioAutoUnlock();
        return true;
      }

      return false;
    } catch {
      // Error in unlock
      return false;
    }
  }

  // Setup auto unlock on creation
  setupAudioAutoUnlock();

  return {
    setOutputStream(stream: MediaStream): void {
      outputStream = stream;
      ensureSilentAudioTrack();
    },

    addTrack(track: MediaStreamTrack): void {
      if (!outputStream) return;

      try {
        // Remove silent track when adding external audio
        if (silentAudioTrack) {
          try {
            outputStream.removeTrack(silentAudioTrack);
          } catch {
            // Failed to remove silent track
          }
        }

        const exists = outputStream
          .getAudioTracks()
          .some((t) => t.id === track.id);
        if (!exists) {
          outputStream.addTrack(track);
        }
        externalAudioTrackIds.add(track.id);

        // Setup ended handler
        const onEnded = (): void => {
          try {
            if (!outputStream) return;
            outputStream.getAudioTracks().forEach((t) => {
              if (t.id === track.id) {
                try {
                  outputStream!.removeTrack(t);
                } catch {
                  // Failed to remove ended track
                }
              }
            });
            externalAudioTrackIds.delete(track.id);
            externalAudioEndHandlers.delete(track.id);

            if (outputStream.getAudioTracks().length === 0) {
              ensureSilentAudioTrack();
            }
          } catch {
            // Error in track ended handler
          }
          try {
            track.removeEventListener("ended", onEnded);
          } catch {
            // Failed to remove ended listener
          }
        };

        track.addEventListener("ended", onEnded);
        externalAudioEndHandlers.set(track.id, onEnded);
      } catch {
        // Error in addTrack
      }
    },

    removeTrack(trackId: string): void {
      if (!outputStream) return;

      outputStream.getAudioTracks().forEach((t) => {
        if (t.id === trackId) {
          outputStream!.removeTrack(t);
        }
      });

      externalAudioTrackIds.delete(trackId);

      const handler = externalAudioEndHandlers.get(trackId);
      const tracks = outputStream.getAudioTracks();
      const tr = tracks.find((t) => t.id === trackId);
      if (tr && handler) {
        try {
          tr.removeEventListener("ended", handler);
        } catch {
          // Failed to remove ended listener
        }
      }
      externalAudioEndHandlers.delete(trackId);

      if (outputStream.getAudioTracks().length === 0) {
        ensureSilentAudioTrack();
      }
    },

    unlock,

    destroy(): void {
      cleanupAudioAutoUnlock();

      try {
        if (audioCtx && (audioCtx as AudioContext & { onstatechange: (() => void) | null }).onstatechange) {
          (audioCtx as AudioContext & { onstatechange: (() => void) | null }).onstatechange = null;
        }
      } catch {
        // Failed to clear state change handler
      }
      audioStateListenerAttached = false;

      // Cleanup external track handlers
      externalAudioEndHandlers.forEach((handler, id) => {
        try {
          const tr = outputStream?.getAudioTracks().find((t) => t.id === id);
          if (tr) tr.removeEventListener("ended", handler);
        } catch {
          // Failed to cleanup track handler
        }
      });
      externalAudioEndHandlers.clear();
      externalAudioTrackIds.clear();

      removeSilentAudioTrack();
      outputStream = null;
    },
  };
}
