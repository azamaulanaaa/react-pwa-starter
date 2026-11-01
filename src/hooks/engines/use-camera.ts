import { useCallback, useEffect, useRef, useState } from "react";

import { encodeJpeg, type JpegOptions } from "@/lib/image.ts";

export type CameraStatus = "idle" | "starting" | "ready" | "error";

export type CameraError =
  "denied" | "not_found" | "busy" | "unavailable" | "capture_failed";

export type CameraMediaDevices = {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
};

export type UseCameraOptions = {
  /** A test can replace the media devices. */
  mediaDevices?: CameraMediaDevices | null;
  /** A test can replace the frame capture. */
  capture?: (video: HTMLVideoElement) => Promise<Blob>;
  /** The image options for the default frame capture. */
  image?: JpegOptions;
};

function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function mapCameraError(cause: unknown): CameraError {
  const name =
    typeof cause === "object" && cause !== null
      ? (cause as { name?: unknown }).name
      : undefined;

  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "denied";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "not_found";
    case "NotReadableError":
    case "TrackStartError":
      return "busy";
    default:
      return "unavailable";
  }
}

/**
 * Controls the user camera.
 * The hook starts the camera only when the caller calls `start`.
 * The hook stops every track on unmount and on a failed start.
 */
export function useCamera(options: UseCameraOptions = {}) {
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<CameraError | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startingRef = useRef(false);
  const disposedRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const stopTracks = useCallback(() => {
    const current = streamRef.current;
    streamRef.current = null;

    if (current) {
      stopStream(current);
    }
  }, []);

  const stop = useCallback(() => {
    stopTracks();
    setStream(null);
    setStatus("idle");
    setError(null);
  }, [stopTracks]);

  useEffect(() => {
    disposedRef.current = false;

    return () => {
      disposedRef.current = true;
      stopTracks();
    };
  }, [stopTracks]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.srcObject = stream;

    return () => {
      if (video.srcObject === stream) {
        video.srcObject = null;
      }
    };
  }, [stream]);

  const start = useCallback(async () => {
    if (streamRef.current || startingRef.current) {
      return;
    }

    startingRef.current = true;
    setError(null);
    setStatus("starting");

    const current = optionsRef.current;
    const devices =
      current.mediaDevices === undefined
        ? typeof navigator === "undefined"
          ? null
          : navigator.mediaDevices
        : current.mediaDevices;
    const getUserMedia = devices?.getUserMedia?.bind(devices);

    if (!getUserMedia) {
      startingRef.current = false;
      setError("unavailable");
      setStatus("error");
      return;
    }

    try {
      const next = await getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      if (disposedRef.current) {
        stopStream(next);
        return;
      }

      if (next.getVideoTracks().length === 0) {
        stopStream(next);
        setError("not_found");
        setStatus("error");
        return;
      }

      streamRef.current = next;
      setStream(next);
      setStatus("ready");
    } catch (cause) {
      setError(mapCameraError(cause));
      setStatus("error");
    } finally {
      startingRef.current = false;
    }
  }, []);

  const capture = useCallback(async (): Promise<Blob> => {
    const video = videoRef.current;

    if (!video || !streamRef.current) {
      setError("capture_failed");
      throw new Error("The capture failed. The camera is not on.");
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setError("capture_failed");
      throw new Error("The capture failed. The camera frame is not ready.");
    }

    const current = optionsRef.current;
    const captureFrame =
      current.capture ??
      ((source: HTMLVideoElement) =>
        encodeJpeg(
          {
            source,
            width: source.videoWidth,
            height: source.videoHeight,
          },
          current.image ?? {},
        ));

    try {
      return await captureFrame(video);
    } catch (cause) {
      setError("capture_failed");
      throw new Error(
        "The capture failed. The camera image is not available.",
        { cause },
      );
    }
  }, []);

  return {
    status,
    error,
    stream,
    videoRef,
    start,
    stop,
    capture,
  };
}
