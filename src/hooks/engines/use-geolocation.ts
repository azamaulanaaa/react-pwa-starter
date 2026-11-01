import { useCallback, useEffect, useRef, useState } from "react";

export type GeolocationStatus = "idle" | "locating" | "success" | "error";

export type GeolocationError =
  "denied" | "unavailable" | "timeout" | "unsupported";

export type GeolocationCoordinates = {
  latitude: number;
  longitude: number;
};

export type GeolocationProvider = {
  getCurrentPosition: (
    success: PositionCallback,
    error?: PositionErrorCallback | null,
    options?: PositionOptions,
  ) => void;
};

export type UseGeolocationOptions = {
  /** A test can replace the geolocation provider. */
  geolocation?: GeolocationProvider | null;
  /** The hook requests a position on mount when this value is true. */
  auto?: boolean;
  /** The maximum time for one request in milliseconds. */
  timeoutMs?: number;
  /** The maximum age of a cached position in milliseconds. */
  maximumAgeMs?: number;
};

function mapGeolocationError(
  cause: GeolocationPositionError,
): GeolocationError {
  switch (cause.code) {
    case 1:
      return "denied";
    case 3:
      return "timeout";
    default:
      return "unavailable";
  }
}

/**
 * Reads the user position from the browser.
 * The hook stores the status, the coordinates, the accuracy, and the error.
 * The hook requests one position at a time.
 */
export function useGeolocation(options: UseGeolocationOptions = {}) {
  const [status, setStatus] = useState<GeolocationStatus>("idle");
  const [coordinates, setCoordinates] = useState<GeolocationCoordinates | null>(
    null,
  );
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<GeolocationError | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  const autoRequestedRef = useRef(false);

  const request = useCallback(() => {
    const current = optionsRef.current;
    const provider =
      current.geolocation === undefined
        ? typeof navigator === "undefined"
          ? null
          : navigator.geolocation
        : current.geolocation;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    if (!provider?.getCurrentPosition) {
      setError("unsupported");
      setStatus("error");
      return;
    }

    setError(null);
    setStatus("locating");

    provider.getCurrentPosition(
      (position) => {
        if (!mountedRef.current || requestId !== requestRef.current) {
          return;
        }

        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setAccuracy(position.coords.accuracy);
        setStatus("success");
      },
      (cause) => {
        if (!mountedRef.current || requestId !== requestRef.current) {
          return;
        }

        setError(mapGeolocationError(cause));
        setStatus("error");
      },
      {
        enableHighAccuracy: true,
        timeout: current.timeoutMs ?? 15_000,
        maximumAge: current.maximumAgeMs ?? 0,
      },
    );
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const auto = options.auto ?? true;

  useEffect(() => {
    if (!auto || autoRequestedRef.current) {
      return;
    }

    autoRequestedRef.current = true;
    request();
  }, [auto, request]);

  return {
    status,
    coordinates,
    accuracy,
    error,
    request,
  };
}
