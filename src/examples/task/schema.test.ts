// @vitest-environment jsdom
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { useFormTaskSchema } from "@/examples/task/schema.ts";

const message = "form_task_error_task_empty";

// `toStandardSchemaV1` caches on the schema, so each call gets a fresh one.
const validate = (task: string) =>
  Schema.toStandardSchemaV1(useFormTaskSchema(), {
    checkHook: () => message,
  })["~standard"].validate({ task });

describe("formTaskSchema", () => {
  it("reports no issue for a filled task", async () => {
    const result = await validate("buy milk");

    expect(result.issues).toBeUndefined();
  });

  it("reports the translated message and the field path for an empty task", async () => {
    const result = await validate("");

    expect(result.issues).toHaveLength(1);
    expect(result.issues?.[0].message).toBe(message);
    expect(result.issues?.[0].path).toEqual(["task"]);
  });

  it("does not use leafHook for the check issue", async () => {
    const result = await Schema.toStandardSchemaV1(useFormTaskSchema(), {
      leafHook: () => message,
    })["~standard"].validate({ task: "" });

    expect(result.issues?.[0].message).not.toBe(message);
  });
});
