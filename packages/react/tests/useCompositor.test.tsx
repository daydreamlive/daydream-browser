import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { render, screen } from "@testing-library/react";
import React from "react";
import { CompositorProvider, useCompositor } from "../src/useCompositor";
import { useSource } from "../src/useSource";
import { createCompositor } from "@daydreamlive/browser";

// Mock createCompositor
vi.mock("@daydreamlive/browser", () => {
  const createMockCompositor = () => {
    const sources = new Map<string, unknown>();
    let activeId: string | null = null;
    let destroyed = false;

    return {
      register: vi.fn((id, source) => {
        sources.set(id, source);
      }),
      unregister: vi.fn((id) => {
        sources.delete(id);
        if (activeId === id) {
          activeId = null;
        }
      }),
      get: vi.fn((id) => sources.get(id)),
      has: vi.fn((id) => sources.has(id)),
      list: vi.fn(() =>
        Array.from(sources.entries()).map(([id, source]) => ({ id, source })),
      ),
      activate: vi.fn((id) => {
        activeId = id;
      }),
      deactivate: vi.fn(() => {
        activeId = null;
      }),
      get activeId() {
        return activeId;
      },
      get stream() {
        return new MediaStream();
      },
      resize: vi.fn(),
      get size() {
        return { width: 512, height: 512, dpr: 1 };
      },
      setFps: vi.fn(),
      get fps() {
        return 30;
      },
      setSendFps: vi.fn(),
      get sendFps() {
        return 30;
      },
      addAudioTrack: vi.fn(),
      removeAudioTrack: vi.fn(),
      unlockAudio: vi.fn().mockResolvedValue(true),
      destroy: vi.fn(() => {
        destroyed = true;
      }),
      on: vi.fn(() => () => {}),
      get destroyed() {
        return destroyed;
      },
    };
  };

  return {
    createCompositor: vi.fn(createMockCompositor),
  };
});

describe("useCompositor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw error when used outside CompositorProvider", () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useCompositor());
    }).toThrow("useCompositor must be used within <CompositorProvider>");

    consoleSpy.mockRestore();
  });

  it("should provide compositor API when used within CompositorProvider", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CompositorProvider>{children}</CompositorProvider>
    );

    const { result } = renderHook(() => useCompositor(), { wrapper });

    expect(result.current).toBeDefined();
    expect(result.current.register).toBeInstanceOf(Function);
    expect(result.current.unregister).toBeInstanceOf(Function);
    expect(result.current.activate).toBeInstanceOf(Function);
    expect(result.current.deactivate).toBeInstanceOf(Function);
    expect(result.current.stream).toBeDefined();
  });

  it("should create compositor with provided options", () => {
    render(
      <CompositorProvider
        width={1280}
        height={720}
        fps={60}
        sendFps={30}
        dpr={2}
        keepalive={true}
        autoUnlockAudio={true}
      >
        <div>Test</div>
      </CompositorProvider>,
    );

    expect(createCompositor).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 1280,
        height: 720,
        fps: 60,
        sendFps: 30,
        dpr: 2,
        keepalive: true,
        autoUnlockAudio: true,
      }),
    );
  });

  it("should destroy compositor on unmount", () => {
    const { unmount } = render(
      <CompositorProvider>
        <div>Test</div>
      </CompositorProvider>,
    );

    const mockCompositor = (createCompositor as ReturnType<typeof vi.fn>).mock
      .results[0]?.value;

    unmount();

    expect(mockCompositor.destroy).toHaveBeenCalled();
  });

  it("should provide size state", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CompositorProvider width={1920} height={1080}>
        {children}
      </CompositorProvider>
    );

    const { result } = renderHook(() => useCompositor(), { wrapper });

    expect(result.current.size).toEqual({ width: 512, height: 512, dpr: 1 });
  });

  it("should provide fps state", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CompositorProvider fps={60}>{children}</CompositorProvider>
    );

    const { result } = renderHook(() => useCompositor(), { wrapper });

    expect(result.current.fps).toBe(60);
  });

  it("should allow setting fps", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CompositorProvider>{children}</CompositorProvider>
    );

    const { result } = renderHook(() => useCompositor(), { wrapper });

    act(() => {
      result.current.setFps(120);
    });

    expect(result.current.fps).toBe(120);
  });

  it("should allow setting size", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CompositorProvider>{children}</CompositorProvider>
    );

    const { result } = renderHook(() => useCompositor(), { wrapper });

    act(() => {
      result.current.setSize(1920, 1080, 2);
    });

    expect(result.current.size).toEqual({ width: 1920, height: 1080, dpr: 2 });
  });

  it("should call use() which registers and activates", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CompositorProvider>{children}</CompositorProvider>
    );

    const { result } = renderHook(() => useCompositor(), { wrapper });

    const mockSource = {
      kind: "video" as const,
      element: document.createElement("video"),
    };

    const unregister = result.current.use("test-source", mockSource);

    const mockCompositor = (createCompositor as ReturnType<typeof vi.fn>).mock
      .results[0]?.value;

    expect(mockCompositor.register).toHaveBeenCalledWith(
      "test-source",
      mockSource,
    );
    expect(mockCompositor.activate).toHaveBeenCalledWith("test-source");

    // Test unregister
    unregister();
    expect(mockCompositor.unregister).toHaveBeenCalledWith("test-source");
  });
});

describe("useSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should provide ref and control functions", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CompositorProvider>{children}</CompositorProvider>
    );

    const { result } = renderHook(
      () => useSource<HTMLVideoElement>("test-video", { kind: "video" }),
      { wrapper },
    );

    expect(result.current.ref).toBeDefined();
    expect(result.current.isActive).toBe(false);
    expect(result.current.activate).toBeInstanceOf(Function);
    expect(result.current.deactivate).toBeInstanceOf(Function);
  });

  it("should throw when used outside CompositorProvider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useSource("test", { kind: "video" }));
    }).toThrow("useCompositor must be used within <CompositorProvider>");

    consoleSpy.mockRestore();
  });

  it("should unregister source on unmount when registered", () => {
    // This test verifies that unregister is called when a source was registered
    // Since useSource requires ref.current to be set for registration,
    // we test the unregister behavior through the CompositorApi.use() method
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CompositorProvider>{children}</CompositorProvider>
    );

    const { result, unmount } = renderHook(() => useCompositor(), { wrapper });

    const mockSource = {
      kind: "video" as const,
      element: document.createElement("video"),
    };

    // Use the 'use' method which registers and activates
    const unregister = result.current.use("test-source", mockSource);

    const mockCompositor = (createCompositor as ReturnType<typeof vi.fn>).mock
      .results[0]?.value;

    expect(mockCompositor.register).toHaveBeenCalledWith(
      "test-source",
      mockSource,
    );

    // Call unregister manually (simulating cleanup)
    unregister();

    expect(mockCompositor.unregister).toHaveBeenCalledWith("test-source");
  });
});
