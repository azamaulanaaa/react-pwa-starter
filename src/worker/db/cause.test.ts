import { describe, expect, it } from "vitest";
import { Cause } from "effect";

import { formatEffectError } from "@/lib/comlink/effect.ts";

describe("formatEffectError", () => {
  it("renders the failure of a cause with one failure", () => {
    const cause = Cause.fail({ _tag: "FsError", error: "no session" });

    expect(formatEffectError(cause)).toBe("[FsError] no session");
  });

  it("renders the first failure of a cause with two failures", () => {
    // A v4 cause is flat and can hold several failures. The formatter
    // deliberately reports the first failure only, as the v3 code did. The
    // string crosses the Comlink port, so this choice is user visible.
    const cause = Cause.combine(
      Cause.fail({ _tag: "OuterError", error: "first failure" }),
      Cause.fail({ _tag: "InnerError", error: "second failure" }),
    );

    expect(cause.reasons.filter(Cause.isFailReason)).toHaveLength(2);
    expect(formatEffectError(cause)).toBe("[OuterError] first failure");
  });

  it("renders the defect text when the cause has no failure", () => {
    const cause = Cause.die(new Error("hard defect"));

    expect(formatEffectError(cause)).toContain("hard defect");
  });
});
