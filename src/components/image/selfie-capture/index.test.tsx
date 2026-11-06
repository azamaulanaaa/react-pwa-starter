// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/components/context/translation.tsx";
import { blobToJpeg } from "@/lib/image.ts";

import {
  SelfieCapture,
  type SelfieCaptureProps,
  type SelfieCaptureResult,
} from "@/components/image/selfie-capture/index.tsx";

import dictionary from "~/public/locales/en-US.json" with { type: "json" };

vi.mock("@/lib/image.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/image.ts")>();

  return {
    ...actual,
    blobToJpeg: vi.fn(async () => new Blob(["jpeg"], { type: "image/jpeg" })),
  };
});

const originalMediaDevices = Object.getOwnPropertyDescriptor(
  navigator,
  "mediaDevices",
);
const originalGeolocation = Object.getOwnPropertyDescriptor(
  navigator,
  "geolocation",
);

function setMediaDevices(value: unknown): void {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value,
  });
}

function setGeolocation(value: unknown): void {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value,
  });
}

function fakeStream(): MediaStream {
  const track = {
    kind: "video",
    stop: vi.fn(),
  } as unknown as MediaStreamTrack;

  return {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  } as unknown as MediaStream;
}

function renderCapture(props: SelfieCaptureProps = {}) {
  return render(
    <TranslationProvider
      dictionary={dictionary}
      fallbackDictionary={dictionary}
    >
      <SelfieCapture {...props} />
    </TranslationProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();

  if (originalMediaDevices) {
    Object.defineProperty(navigator, "mediaDevices", originalMediaDevices);
  } else {
    Reflect.deleteProperty(navigator, "mediaDevices");
  }

  if (originalGeolocation) {
    Object.defineProperty(navigator, "geolocation", originalGeolocation);
  } else {
    Reflect.deleteProperty(navigator, "geolocation");
  }
});

describe("SelfieCapture", () => {
  it("falls back to the file input when the camera is absent", () => {
    setMediaDevices(undefined);

    renderCapture();

    expect(screen.getByLabelText("Select a photo")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start camera" })).toBeNull();
  });

  it("does not start the camera before a user gesture", async () => {
    const getUserMedia = vi.fn(async () => fakeStream());
    setMediaDevices({ getUserMedia });

    const { unmount } = renderCapture();

    expect(getUserMedia).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Start camera" }));

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
    unmount();
  });

  it("reports a denied permission", async () => {
    const getUserMedia = vi.fn(async () => {
      throw Object.assign(new Error("Permission denied"), {
        name: "NotAllowedError",
      });
    });
    setMediaDevices({ getUserMedia });

    renderCapture();

    fireEvent.click(screen.getByRole("button", { name: "Start camera" }));

    expect(
      await screen.findByText(
        "The camera permission is off. Select a photo file instead.",
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText("Select a photo")).toBeTruthy();
  });

  it("captures a selfie and a position from the file input", async () => {
    setMediaDevices(undefined);
    setGeolocation({
      getCurrentPosition: (success: PositionCallback) =>
        success({
          coords: {
            latitude: 1,
            longitude: 2,
            accuracy: 5,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
            toJSON: () => ({}),
          },
          timestamp: 1,
          toJSON: () => ({}),
        }),
    });

    const onCapture = vi.fn();
    renderCapture({ onCapture });

    const file = new File([new Uint8Array([1, 2, 3])], "selfie.jpg", {
      type: "image/jpeg",
    });

    const input = screen.getByLabelText("Select a photo");
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => expect(onCapture).toHaveBeenCalledOnce());

    const result = onCapture.mock.calls[0]?.[0] as SelfieCaptureResult;

    expect(result.blob.type).toBe("image/jpeg");
    expect(result.coordinates).toEqual({ latitude: 1, longitude: 2 });
    expect(result.accuracy).toBe(5);
    expect(vi.mocked(blobToJpeg)).toHaveBeenCalledOnce();
  });
});
