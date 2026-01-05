"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { Source, FitMode, ContentHint } from "@daydreamlive/browser";
import { useCompositor } from "./useCompositor";

export interface UseSourceOptions {
  kind: "video" | "canvas";
  contentHint?: ContentHint;
  fit?: FitMode;
}

export interface UseSourceReturn<
  T extends HTMLVideoElement | HTMLCanvasElement,
> {
  ref: React.RefObject<T>;
  isActive: boolean;
  activate: () => void;
  deactivate: () => void;
}

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
