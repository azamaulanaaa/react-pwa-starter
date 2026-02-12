import { describe, expect, it } from "vitest";
import { getGreeting } from "./greeting.ts";

describe("Greeting Worker", () => {
  it("should greet using real locale files", async () => {
    const result = await getGreeting("Vite");

    expect(result).toContain("Vite");
  });
});
