import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createRxSchema } from "./create_rx_schema.ts";
import { BaseSchema } from "../schemas/base.schema.ts";

const MockSchemaV0 = BaseSchema.extend({
  version: z.literal(0),
  value: z.string(),
});

const MockSchemaV1 = BaseSchema.extend({
  version: z.literal(1),
  content: z.string(),
  is_active: z.boolean(), // Added an extra field to prove extraction works
});

const MockDiscriminatedUnion = z.discriminatedUnion("version", [
  MockSchemaV0,
  MockSchemaV1,
]);

describe("createRxSchema", () => {
  it("should generate a valid RxDB schema structure", () => {
    const rxSchema = createRxSchema("test_collection", MockDiscriminatedUnion);

    // Check RxDB specific top-level properties
    expect(rxSchema.title).toBe("test_collection");
    expect(rxSchema.version).toBe(0);
    expect(rxSchema.primaryKey).toBe("id");
    expect(rxSchema.type).toBe("object");
  });

  it("should enforce BaseSchema fields as required", () => {
    const rxSchema = createRxSchema("test_collection", MockDiscriminatedUnion);

    const requiredFields = (rxSchema as any).required || [];

    expect(requiredFields).toContain("id");
    expect(requiredFields).toContain("created_at");
    expect(requiredFields).toContain("modified_at");
    expect(requiredFields).toContain("version");
  });

  it("should extract variant fields and make them optional", () => {
    const rxSchema = createRxSchema("test_collection", MockDiscriminatedUnion);

    const properties = (rxSchema as any).properties;
    const requiredFields = (rxSchema as any).required || [];

    // The fields should exist in the schema properties
    expect(properties).toHaveProperty("value");
    expect(properties).toHaveProperty("content");
    expect(properties).toHaveProperty("is_active");

    // BUT they must NOT be in the required array (so RxDB accepts old/new docs)
    expect(requiredFields).not.toContain("value");
    expect(requiredFields).not.toContain("content");
    expect(requiredFields).not.toContain("is_active");
  });

  it("should type the dynamic fields correctly in JSON Schema", () => {
    const rxSchema = createRxSchema("test_collection", MockDiscriminatedUnion);
    const properties = (rxSchema as any).properties;

    // Check that the types translated correctly from Zod to JSON Schema
    expect(properties.value.type).toBe("string");
    expect(properties.content.type).toBe("string");
    expect(properties.is_active.type).toBe("boolean");

    // Version should be flattened to a generic number, not a literal 0 or 1
    expect(properties.version.type).toBe("number");
  });

  it("should ONLY require fields from BaseSchema and the version field", () => {
    const rxSchema = createRxSchema("test_collection", MockDiscriminatedUnion);

    // Cast to any to easily access the generated JSON Schema properties
    const jsonSchema = rxSchema as any;
    const requiredFields: string[] = jsonSchema.required || [];

    // 1. Verify all our base fields and 'version' are required
    expect(requiredFields).toContain("id");
    expect(requiredFields).toContain("created_at");
    expect(requiredFields).toContain("modified_at");
    expect(requiredFields).toContain("version");

    // 2. THE CRITICAL CHECK: Ensure exactly 4 fields are required.
    // This mathematically proves that 'value' and 'content' were correctly
    // stripped out of the required array and made optional.
    expect(requiredFields).toHaveLength(4);

    // 3. Explicitly check variant fields for good measure (and readable tests!)
    expect(requiredFields).not.toContain("value");
    expect(requiredFields).not.toContain("content");
  });
});
