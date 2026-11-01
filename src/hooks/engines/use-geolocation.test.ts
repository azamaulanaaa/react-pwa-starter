// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  useGeolocation,
  type GeolocationProvider,
} from "@/hooks/engines/use-geolocation.ts";

function position(
  latitude: number,
  longitude: number,
  accuracy: number,
): GeolocationPosition {
  return {
    coords: {
      latitude,
      longitude,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: 1,
    toJSON: () => ({}),
  };
}

describe("useGeolocation", () => {
  it("returns a position with an accuracy value", () => {
    const provider: GeolocationProvider = {
      getCurrentPosition: (success) => success(position(-6.2, 106.8, 12)),
    };
    const { result } = renderHook(() =>
      useGeolocation({ geolocation: provider, auto: false }),
    );

    act(() => result.current.request());

    expect(result.current.status).toBe("success");
    expect(result.current.coordinates).toEqual({
      latitude: -6.2,
      longitude: 106.8,
    });
    expect(result.current.accuracy).toBe(12);
    expect(result.current.error).toBeNull();
  });

  it("reports a denied permission", () => {
    const provider: GeolocationProvider = {
      getCurrentPosition: (_success, error) =>
        error?.({
          code: 1,
          message: "Permission denied",
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        }),
    };
    const { result } = renderHook(() =>
      useGeolocation({ geolocation: provider, auto: false }),
    );

    act(() => result.current.request());

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("denied");
    expect(result.current.coordinates).toBeNull();
  });

  it("reports a missing geolocation provider", () => {
    const { result } = renderHook(() =>
      useGeolocation({ geolocation: null, auto: false }),
    );

    act(() => result.current.request());

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("unsupported");
  });

  it("requests a position on mount by default", () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) =>
      success(position(1, 2, 3)),
    );
    const { result } = renderHook(() =>
      useGeolocation({ geolocation: { getCurrentPosition } }),
    );

    expect(getCurrentPosition).toHaveBeenCalledOnce();
    expect(result.current.status).toBe("success");
  });
});
