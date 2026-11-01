import { describe, expect, it } from "vitest";

import { ApiError, apiErrorFromResponse } from "@/lib/api/error.ts";

/** Builds a JSON response for the error tests. */
function jsonResponse(body: unknown, status = 400): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("apiErrorFromResponse", () => {
  it("keeps the code and the details from the error body", async () => {
    const error = await apiErrorFromResponse(
      jsonResponse(
        {
          error: "The value is outside the range.",
          code: "out_of_range",
          details: { value: 312, limit: 150 },
        },
        422,
      ),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("out_of_range");
    expect(error.details).toEqual({ value: 312, limit: 150 });
  });

  it("uses a null code when the body has no code", async () => {
    const error = await apiErrorFromResponse(
      jsonResponse({ error: "The item is missing." }, 404),
    );

    expect(error.code).toBeNull();
    expect(error.details).toBeUndefined();
  });

  it("keeps the message when the body is not JSON", async () => {
    const error = await apiErrorFromResponse(
      new Response("<html>Bad gateway</html>", { status: 502 }),
    );

    expect(error.message).toBe(
      "The request failed. The server returned status 502.",
    );
    expect(error.code).toBeNull();
  });

  it("keeps the status on the error", async () => {
    const error = await apiErrorFromResponse(
      jsonResponse({ error: "The item changed." }, 409),
    );

    expect(error.status).toBe(409);
  });
});

describe("ApiError", () => {
  it("keeps the old constructor call working", () => {
    const error = new ApiError("The request failed.", 500);

    expect(error.name).toBe("ApiError");
    expect(error.message).toBe("The request failed.");
    expect(error.status).toBe(500);
    expect(error.code).toBeNull();
    expect(error.details).toBeUndefined();
  });
});
