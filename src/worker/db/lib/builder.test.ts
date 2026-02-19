import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  assembleCollectionConfig,
  RxCollectionDefinition,
  transformToRxJsonSchema,
} from "./builder.ts";

const MockSchemaV0 = z.object({ value: z.string() });
const MockSchemaV1 = z.object({ content: z.string(), is_active: z.boolean() });
const MockSchemaV2 = z.object({
  text: z.string(),
  status: z.enum(["active", "inactive", "unknown"]),
});

// FIX: The builder expects a tuple/array of schemas to calculate versions by index
const PayloadVersions = [MockSchemaV0, MockSchemaV1, MockSchemaV2] as const;

describe("transformToRxJsonSchema", () => {
  it("should generate a valid RxJsonSchema from the Zod schema", () => {
    const rxSchema = transformToRxJsonSchema("mock_schema", PayloadVersions);

    expect(rxSchema).toBeDefined();
    expect(rxSchema.version).toBe(2);
    expect(rxSchema.primaryKey).toBe("id");
    expect(rxSchema.type).toBe("object");
  });

  it("should preserve the nested payload versioning structure with 'v' prefix", () => {
    const rxSchema = transformToRxJsonSchema("mock_schema", PayloadVersions);
    const payloadProps = (rxSchema as any).properties?.payload?.properties;

    // FIX: Keys are prefixed with 'v' in your code
    expect(payloadProps).toHaveProperty("v0");
    expect(payloadProps?.["v0"]?.properties).toHaveProperty("value");

    expect(payloadProps).toHaveProperty("v1");
    expect(payloadProps?.["v1"]?.properties).toHaveProperty("content");

    expect(payloadProps).toHaveProperty("v2");
    expect(payloadProps?.["v2"]?.properties).toHaveProperty("text");
  });

  it("should mark older versions as optional and the latest version as required", () => {
    const rxSchema = transformToRxJsonSchema("version_check", PayloadVersions);
    const payload = (rxSchema as any).properties?.payload;

    const requiredFields = payload?.required || [];

    // The latest version (v2) should be required
    expect(requiredFields).toContain("v2");

    // Older versions (v0, v1) should NOT be in the required array
    expect(requiredFields).not.toContain("v0");
    expect(requiredFields).not.toContain("v1");
  });

  it("should handle a single-version payload correctly", () => {
    const singleVersion = [z.object({ foo: z.string() })] as const;
    const rxSchema = transformToRxJsonSchema("single_version", singleVersion);

    expect(rxSchema.version).toBe(0);
    expect((rxSchema as any).properties?.payload?.properties).toHaveProperty(
      "v0",
    );
    expect((rxSchema as any).properties?.payload?.required).toContain("v0");
  });

  it("should correctly map Zod Enums to JSON Schema enums", () => {
    const rxSchema = transformToRxJsonSchema("enum_check", PayloadVersions);
    const v2Props = (rxSchema as any).properties?.payload?.properties?.["v2"]
      ?.properties;

    const statusSchema = v2Props?.status;
    expect(statusSchema).toHaveProperty("enum");
    expect(statusSchema?.enum).toEqual(["active", "inactive", "unknown"]);
  });
});

describe("RxCollectionDefinition", () => {
  it("should maintain data integrity through a multi-step migration chain", () => {
    const builder = RxCollectionDefinition.create("user_data")
      .initial(MockSchemaV0)
      .addStep(MockSchemaV1, (prev) => ({
        content: `Migrated: ${prev.value}`,
        is_active: true,
      }))
      .addStep(MockSchemaV2, (prev) => ({
        text: prev.content,
        status: prev.is_active ? ("active" as const) : ("inactive" as const),
      }));

    const { migrationStrategies, schema } = assembleCollectionConfig(builder);

    expect(schema.version).toBe(2);

    // Test V0 -> V1
    const docV0 = {
      id: "uuid-1",
      payload: { v0: { value: "Hello World" } },
    };

    // RxDB migration strategies take the old document as the first argument
    const docV1 = migrationStrategies[1](docV0, null as any);
    expect(docV1.payload.v1).toEqual({
      content: "Migrated: Hello World",
      is_active: true,
    });

    // Test V1 -> V2
    const docV2 = migrationStrategies[2](docV1, null as any);
    expect(docV2.payload.v2).toEqual({
      text: "Migrated: Hello World",
      status: "active",
    });
  });

  it("should fail migration if the payload is missing the previous version's key", () => {
    const { migrationStrategies } = assembleCollectionConfig(
      RxCollectionDefinition.create("fail_test")
        .initial(MockSchemaV0)
        .addStep(MockSchemaV1, (prev) => ({
          content: prev.value,
          is_active: false,
        })),
    );

    const brokenDoc = {
      id: "uuid-2",
      payload: {}, // Missing key 'v0'
    };

    expect(() => migrationStrategies[1](brokenDoc, null as any)).toThrow();
  });

  it("should correctly handle zod.parse() validation during migration", () => {
    const { migrationStrategies } = assembleCollectionConfig(
      RxCollectionDefinition.create("type_safety")
        .initial(MockSchemaV0)
        .addStep(MockSchemaV1, (prev) => ({
          content: prev.value,
          is_active: true,
        })),
    );

    const invalidDataDoc = {
      payload: {
        v0: { value: 12345 }, // Should be string, but is number
      },
    };

    expect(() => migrationStrategies[1](invalidDataDoc, null as any)).toThrow();
  });
});
