import { describe, expect, it } from "vitest";

import { classifyOutcome, outcomeFromError } from "@/worker/outbox/classify.ts";

describe("outbox classification", () => {
  it("removes a successful operation", () => {
    const result = classifyOutcome({ status: 200 });

    expect(result.kind).toBe("success");
  });

  it("moves a permanent code to the failed state", () => {
    const result = classifyOutcome({
      status: 400,
      code: "invalid_input",
    });

    expect(result).toMatchObject({
      kind: "permanent",
      state: "failed",
      error: { code: "invalid_input" },
    });
  });

  it("treats a conflict status as the review state", () => {
    const result = classifyOutcome({ status: 409 });

    expect(result).toMatchObject({
      kind: "permanent",
      state: "conflict",
      error: { code: "conflict" },
    });
  });

  it("treats a conflict code as the review state", () => {
    const result = classifyOutcome({ status: 400, code: "duplicate" });

    expect(result).toMatchObject({
      kind: "permanent",
      state: "conflict",
      error: { code: "duplicate" },
    });
  });

  it("keeps a server error in the pending state", () => {
    const result = classifyOutcome({ status: 503 });

    expect(result).toMatchObject({
      kind: "transient",
      error: { code: "server_error" },
    });
  });

  it("keeps a rate limit in the pending state", () => {
    const result = classifyOutcome({ status: 429 });

    expect(result).toMatchObject({
      kind: "transient",
      error: { code: "rate_limited" },
    });
  });

  it("treats a lost session as a sign-in state", () => {
    const result = classifyOutcome({ status: 401 });

    expect(result).toMatchObject({
      kind: "unauthorized",
      error: { code: "unauthorized" },
    });
  });

  it("reads the status and the code from a thrown error", () => {
    const outcome = outcomeFromError({ status: 409, code: "conflict" });
    const result = classifyOutcome(outcome);

    expect(result).toMatchObject({
      kind: "permanent",
      state: "conflict",
    });
  });

  it("treats a plain thrown error as a network error", () => {
    const result = classifyOutcome(outcomeFromError(new Error("offline")));

    expect(result).toMatchObject({
      kind: "transient",
      error: { code: "network", message: "offline" },
    });
  });
});
