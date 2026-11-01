// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useConnectivity } from "@/hooks/use-connectivity.ts";

let online = false;
let visibility: DocumentVisibilityState = "hidden";

describe("useConnectivity", () => {
  beforeEach(() => {
    online = false;
    visibility = "hidden";
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => online,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(window.navigator, "onLine");
    Reflect.deleteProperty(document, "visibilityState");
  });

  it("reads the network and visibility events", () => {
    const { result } = renderHook(() => useConnectivity());

    expect(result.current.online).toBe(false);
    expect(result.current.visible).toBe(false);

    online = true;
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current.online).toBe(true);

    visibility = "visible";
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.visible).toBe(true);

    online = false;
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current.online).toBe(false);
  });

  it("records the last sync time", () => {
    const { result } = renderHook(() => useConnectivity());

    expect(result.current.lastSyncAt).toBeNull();

    act(() => result.current.markSynced(1234));

    expect(result.current.lastSyncAt).toBe(1234);
  });
});
