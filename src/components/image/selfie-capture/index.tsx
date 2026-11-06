import { useCallback, useEffect, useState } from "react";
import { CameraIcon, RotateCcwIcon, UploadIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.tsx";
import { Button, buttonVariants } from "@/components/ui/button.tsx";
import { useTranslation } from "@/components/context/translation.tsx";
import {
  useCamera,
  type CameraError,
  type CameraStatus,
} from "@/hooks/engines/use-camera.ts";
import {
  useGeolocation,
  type GeolocationCoordinates,
  type GeolocationError,
  type GeolocationStatus,
} from "@/hooks/engines/use-geolocation.ts";
import { cn } from "@/lib/utils/cn.ts";
import { blobToJpeg, IMAGE_MAX_BYTES } from "@/lib/image.ts";

export type SelfieCaptureResult = {
  /** The JPEG image after the scale and the re-encode. */
  blob: Blob;
  /** The position at the capture time. */
  coordinates: GeolocationCoordinates | null;
  /** The position accuracy in meters. */
  accuracy: number | null;
};

export type SelfieCaptureProps = {
  className?: string;
  disabled?: boolean;
  /** A test can force the file input. The component detects the camera by default. */
  cameraAvailable?: boolean;
  /** The component requests a position on mount when this value is true. */
  locateOnMount?: boolean;
  onCapture?: (result: SelfieCaptureResult) => void;
};

/**
 * Returns the translation key for the camera state.
 */
export function cameraMessageKey(
  available: boolean,
  status: CameraStatus,
  error: CameraError | null,
): string {
  if (!available) {
    return "selfie_capture_camera_missing";
  }

  if (status === "starting") {
    return "selfie_capture_camera_starting";
  }

  if (status === "ready") {
    return "selfie_capture_camera_ready";
  }

  if (status === "error") {
    switch (error) {
      case "denied":
        return "selfie_capture_camera_denied";
      case "not_found":
        return "selfie_capture_camera_missing";
      case "busy":
        return "selfie_capture_camera_busy";
      case "unavailable":
        return "selfie_capture_camera_unavailable";
      default:
        return "selfie_capture_camera_failed";
    }
  }

  return "selfie_capture_camera_idle";
}

/**
 * Returns the translation key for the geolocation state.
 */
export function geolocationMessageKey(
  status: GeolocationStatus,
  error: GeolocationError | null,
): string {
  if (status === "locating") {
    return "selfie_capture_location_locating";
  }

  if (status === "success") {
    return "selfie_capture_location_ready";
  }

  if (status === "error") {
    switch (error) {
      case "denied":
        return "selfie_capture_location_denied";
      case "timeout":
        return "selfie_capture_location_timeout";
      case "unavailable":
        return "selfie_capture_location_unavailable";
      default:
        return "selfie_capture_location_unsupported";
    }
  }

  return "selfie_capture_location_idle";
}

function hasCamera(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

function createPreviewUrl(blob: Blob): string {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    return "";
  }

  return URL.createObjectURL(blob);
}

export function SelfieCapture({
  className,
  disabled = false,
  cameraAvailable,
  locateOnMount = true,
  onCapture,
}: SelfieCaptureProps) {
  const { t } = useTranslation();
  const camera = useCamera();
  const location = useGeolocation({ auto: locateOnMount });

  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState<
    "file_failed" | "photo_too_large" | "capture_failed" | null
  >(null);

  const available = cameraAvailable ?? hasCamera();
  const showFileInput = !available || camera.status === "error";

  useEffect(() => {
    if (!photo) {
      setPreview("");
      return;
    }

    const url = createPreviewUrl(photo);
    setPreview(url);

    return () => {
      if (url !== "") {
        URL.revokeObjectURL(url);
      }
    };
  }, [photo]);

  const acceptPhoto = useCallback(
    (blob: Blob) => {
      if (blob.size > IMAGE_MAX_BYTES) {
        setFileError("photo_too_large");
        return;
      }

      setFileError(null);
      setPhoto(blob);
      onCapture?.({
        blob,
        coordinates: location.coordinates,
        accuracy: location.accuracy,
      });
    },
    [location.accuracy, location.coordinates, onCapture],
  );

  const handleCapture = async () => {
    setBusy(true);
    setFileError(null);

    try {
      const blob = await camera.capture();
      acceptPhoto(blob);
      camera.stop();
    } catch {
      setFileError("capture_failed");
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    setBusy(true);
    setFileError(null);

    try {
      const blob = await blobToJpeg(file);
      acceptPhoto(blob);
    } catch {
      setFileError("file_failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRetake = () => {
    camera.stop();
    setPhoto(null);
    setFileError(null);
  };

  const cameraKey = cameraMessageKey(available, camera.status, camera.error);
  const messageKey =
    fileError === "photo_too_large"
      ? "selfie_capture_photo_too_large"
      : fileError === "file_failed"
        ? "selfie_capture_file_failed"
        : fileError === "capture_failed"
          ? "selfie_capture_capture_failed"
          : photo
            ? "selfie_capture_photo_ready"
            : cameraKey;
  const messageParams =
    photo && !fileError
      ? { kilobytes: Math.max(1, Math.round(photo.size / 1024)) }
      : undefined;
  const isError =
    fileError !== null || (available && camera.status === "error");
  const locationKey = geolocationMessageKey(location.status, location.error);
  const locationParams =
    location.status === "success" && location.accuracy !== null
      ? { accuracy: Math.round(location.accuracy) }
      : undefined;

  return (
    <div
      className={cn("flex w-full max-w-md flex-col gap-3", className)}
      data-slot="selfie-capture"
    >
      <div className="relative flex aspect-4/3 items-center justify-center overflow-hidden rounded-xl border bg-muted">
        {preview ? (
          <img
            alt={t("selfie_capture_photo_alt")}
            className="size-full object-cover"
            src={preview}
          />
        ) : (
          <video
            autoPlay
            className={cn(
              "size-full object-cover",
              camera.status !== "ready" && "opacity-0",
            )}
            muted
            playsInline
            ref={camera.videoRef}
          />
        )}

        {!photo && camera.status !== "ready" ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            {showFileInput ? (
              <UploadIcon className="size-8" />
            ) : (
              <CameraIcon className="size-8" />
            )}
            <span className="text-xs">{t("selfie_capture_preview_hint")}</span>
          </div>
        ) : null}
      </div>

      <Alert variant={isError ? "error" : "info"}>
        <AlertTitle>{t(messageKey, messageParams)}</AlertTitle>
        <AlertDescription>{t(locationKey, locationParams)}</AlertDescription>
      </Alert>

      <div className="flex flex-wrap gap-2">
        {!photo && available && camera.status !== "ready" ? (
          <Button
            disabled={disabled || camera.status === "starting"}
            loading={camera.status === "starting"}
            onClick={() => void camera.start()}
          >
            <CameraIcon />
            {t("selfie_capture_camera_start")}
          </Button>
        ) : null}

        {!photo && available && camera.status === "ready" ? (
          <>
            <Button
              disabled={disabled || busy}
              loading={busy}
              onClick={() => void handleCapture()}
            >
              <CameraIcon />
              {t("selfie_capture_camera_capture")}
            </Button>
            <Button
              disabled={disabled || busy}
              onClick={camera.stop}
              variant="outline"
            >
              {t("selfie_capture_camera_stop")}
            </Button>
          </>
        ) : null}

        {photo ? (
          <Button disabled={disabled} onClick={handleRetake} variant="outline">
            <RotateCcwIcon />
            {t("selfie_capture_retake")}
          </Button>
        ) : null}
      </div>

      {showFileInput && !photo ? (
        <label
          className={cn(
            buttonVariants({ variant: "outline" }),
            "cursor-pointer",
            (disabled || busy) && "pointer-events-none opacity-64",
          )}
        >
          <UploadIcon />
          {t("selfie_capture_file_label")}
          <input
            accept="image/*"
            capture="user"
            className="sr-only"
            disabled={disabled || busy}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              void handleFile(file);
            }}
            type="file"
          />
        </label>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {t("selfie_capture_file_hint")}
      </p>
    </div>
  );
}
