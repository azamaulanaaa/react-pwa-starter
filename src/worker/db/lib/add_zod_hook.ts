import { RxCollection } from "rxdb";
import { z } from "zod";
import * as z4 from "zod/v4/core";

export function addZodHooks<
  T1 extends z4.$ZodObject,
  T2 extends z4.$ZodDiscriminatedUnion,
>(
  collection: RxCollection,
  schemaLatest: T1,
  migrationSchema: T2,
) {
  collection.postCreate((plainData, rxDocument) => {
    const latestResult = z.safeParse(schemaLatest, plainData);
    if (latestResult.success) return;

    const migrationResult = z.safeParse(migrationSchema, plainData);
    if (migrationResult.success) {
      plainData.stagedMigration = migrationResult.data;
    } else {
      plainData.stagedMigration = {};
    }

    Object.defineProperty(rxDocument, "stagedMigration", {
      get: () => migrationResult.success ? migrationResult.data : {},
      enumerable: true,
      configurable: true,
    });
  });

  const validateLatest = (data: any) => {
    z.parse(schemaLatest, data);
  };

  collection.preInsert(validateLatest, false);
  collection.preSave(validateLatest, false);
}
