"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { Source, FitMode, ContentHint } from "@daydreamlive/browser";
import { useCompositor } from "./useCompositor";

/**
 * Options for the useSource hook.
 */
export interface UseSourceOptions {
  /** Type of source element: "video" for HTMLVideoElement, "canvas" for HTMLCanvasElement. */
  kind: "video" | "canvas";
  /** Content hint for encoding optimization. */
  contentHint?: ContentHint;
  /** How to fit the source content within the output canvas. Only applies to video sources. */
  fit?: FitMode;
}

/**
 * Return value of the useSource hook.
 */
export interface UseSourceReturn<
  T extends HTMLVideoElement | HTMLCanvasElement,
> {
  /** Ref to attach to the source element. */
  ref: React.RefObject<T>;
  /** Whether this source is currently active. Reactive. */
  isActive: boolean;
  /** Activate this source for rendering. */
  activate: () => void;
  /** Deactivate this source (if it's currently active). */
  deactivate: () => void;
}

/**
 * React hook for managing a compositor source.
 *
 * Automatically registers the source element with the compositor and provides
 * methods for activation/deactivation. Cleans up on unmount.
 *
 * @typeParam T - The element type (HTMLVideoElement or HTMLCanvasElement)
 * @param id - Unique identifier for this source
 * @param options - Source configuration
 * @returns Source state and control functions
 *
 * @example
 * ```tsx
 * function CameraSource() {
 *   const { ref, isActive, activate } = useSource<HTMLVideoElement>("camera", {
 *     kind: "video",
 *     fit: "cover",
 *   });
 *
 *   useEffect(() => {
 *     navigator.mediaDevices.getUserMedia({ video: true })
 *       .then(stream => {
 *         if (ref.current) {
 *           ref.current.srcObject = stream;
 *           activate();
 *         }
 *       });
 *   }, [activate]);
 *
 *   return <video ref={ref} autoPlay muted />;
 * }
 * ```
 */
export function useSource<
  T extends HTMLVideoElement | HTMLCanvasElement =
    | HTMLVideoElement
    | HTMLCanvasElement,
>(id: string, options: UseSourceOptions): UseSourceReturn<T> {
  const compositor = useCompositor();
  const compositorRef = useRef(compositor);
  compositorRef.current = compositor;

  const ref = useRef<T>(null);
  const [isActive, setIsActive] = useState(false);
  const registeredRef = useRef(false);
  const idRef = useRef(id);
  idRef.current = id;

  const { kind, contentHint, fit } = options;

  const optionsRef = useRef({ kind, contentHint, fit });
  optionsRef.current = { kind, contentHint, fit };

  const registerSource = useCallback((element: T) => {
    const { kind, contentHint, fit } = optionsRef.current;
    const source =
      kind === "video"
        ? {
            kind: "video" as const,
            element: element as HTMLVideoElement,
            contentHint,
            fit,
          }
        : {
            kind: "canvas" as const,
            element: element as HTMLCanvasElement,
            contentHint,
          };

    compositorRef.current.register(idRef.current, source);
    registeredRef.current = true;
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    registerSource(element);
  }, [id, kind, contentHint, fit, registerSource]);

  useEffect(() => {
    const currentId = id;
    return () => {
      if (registeredRef.current) {
        registeredRef.current = false;
        setIsActive(false);
        compositorRef.current.unregister(currentId);
      }
    };
  }, [id]);

  useEffect(() => {
    setIsActive(compositor.activeId === id);
  }, [compositor.activeId, id]);

  const activate = useCallback(() => {
    const element = ref.current;
    if (!element) return;

    if (!registeredRef.current) {
      registerSource(element);
    }

    compositorRef.current.activate(idRef.current);
    setIsActive(true);
  }, [registerSource]);

  const deactivate = useCallback(() => {
    if (compositorRef.current.activeId === idRef.current) {
      compositorRef.current.deactivate();
      setIsActive(false);
    }
  }, []);

  return useMemo(
    () => ({
      ref,
      isActive,
      activate,
      deactivate,
    }),
    [isActive, activate, deactivate],
  );
}
