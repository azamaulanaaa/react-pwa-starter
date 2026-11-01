// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useCamera } from "@/hooks/engines/use-camera.ts";
import type { ImageSize, JpegCanvasFactory } from "@/lib/image.ts";

function fakeTrack(): MediaStreamTrack {
  return { kind: "video", stop: vi.fn() } as unknown as MediaStreamTrack;
}

function fakeStream(tracks: MediaStreamTrack[]): MediaStream {
  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((track) => track.kind === "video"),
  } as unknown as MediaStream;
}

function fakeVideo(videoWidth: number, videoHeight: number): HTMLVideoElement {
  return {
    width: 0,
    height: 0,
    videoWidth,
    videoHeight,
    srcObject: null,
  } as unknown as HTMLVideoElement;
}

describe("useCamera", () => {
  it("does not start the camera before a user gesture", () => {
    const getUserMedia = vi.fn(async () => fakeStream([fakeTrack()]));

    renderHook(() => useCamera({ mediaDevices: { getUserMedia } }));

    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("stops the camera track when the screen closes", async () => {
    const track = fakeTrack();
    const getUserMedia = vi.fn(async () => fakeStream([track]));
    const { result, unmount } = renderHook(() =>
      useCamera({ mediaDevices: { getUserMedia } }),
    );

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("ready");
    unmount();
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it("reports a denied permission", async () => {
    const getUserMedia = vi.fn(async () => {
      throw Object.assign(new Error("Permission denied"), {
        name: "NotAllowedError",
      });
    });
    const { result } = renderHook(() =>
      useCamera({ mediaDevices: { getUserMedia } }),
    );

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("denied");
    expect(result.current.stream).toBeNull();
  });

  it("stops the track when the stream has no video track", async () => {
    const track = {
      kind: "audio",
      stop: vi.fn(),
    } as unknown as MediaStreamTrack;
    const getUserMedia = vi.fn(async () => fakeStream([track]));
    const { result } = renderHook(() =>
      useCamera({ mediaDevices: { getUserMedia } }),
    );

    await act(async () => {
      await result.current.start();
    });

    expect(track.stop).toHaveBeenCalledOnce();
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("not_found");
  });

  it("reports a capture failure when the camera is off", async () => {
    const { result } = renderHook(() =>
      useCamera({ mediaDevices: { getUserMedia: vi.fn() } }),
    );

    let caught: unknown;

    await act(async () => {
      try {
        await result.current.capture();
      } catch (cause) {
        caught = cause;
      }
    });

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe(
      "The capture failed. The camera is not on.",
    );
    expect(result.current.error).toBe("capture_failed");
  });

  it("uses the video frame size, not the element size", async () => {
    const getUserMedia = vi.fn(async () => fakeStream([fakeTrack()]));
    const sizes: ImageSize[] = [];
    const createCanvas: JpegCanvasFactory = (size) => {
      sizes.push(size);

      return {
        draw: () => {},
        encode: async () => new Blob(["jpeg"], { type: "image/jpeg" }),
      };
    };
    const { result } = renderHook(() =>
      useCamera({ mediaDevices: { getUserMedia }, image: { createCanvas } }),
    );

    result.current.videoRef.current = fakeVideo(1280, 720);

    await act(async () => {
      await result.current.start();
    });

    let blob: Blob | undefined;

    await act(async () => {
      blob = await result.current.capture();
    });

    expect(sizes).toEqual([{ width: 720, height: 405 }]);
    expect(blob?.type).toBe("image/jpeg");
  });

  it("rejects a capture when the video frame is empty", async () => {
    const getUserMedia = vi.fn(async () => fakeStream([fakeTrack()]));
    const { result } = renderHook(() =>
      useCamera({ mediaDevices: { getUserMedia } }),
    );

    result.current.videoRef.current = fakeVideo(0, 0);

    await act(async () => {
      await result.current.start();
    });

    let caught: unknown;

    await act(async () => {
      try {
        await result.current.capture();
      } catch (cause) {
        caught = cause;
      }
    });

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe(
      "The capture failed. The camera frame is not ready.",
    );
    expect(result.current.error).toBe("capture_failed");
  });

  it("stops the camera when the caller calls stop", async () => {
    const track = fakeTrack();
    const getUserMedia = vi.fn(async () => fakeStream([track]));
    const { result } = renderHook(() =>
      useCamera({ mediaDevices: { getUserMedia } }),
    );

    await act(async () => {
      await result.current.start();
    });
    act(() => result.current.stop());

    expect(track.stop).toHaveBeenCalledOnce();
    expect(result.current.status).toBe("idle");
    expect(result.current.stream).toBeNull();
  });
});
