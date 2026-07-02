import { Schema } from "effect";

export const I18nAnnotationId = Symbol.for("i18n");

export const getT = (ns?: string) => {
  const t = (key: string, meta?: Record<string, string | number>) =>
  <A, I, R>(
    self: Schema.Schema<A, I, R>,
  ): Schema.Schema<A, I, R> => {
    return Schema.annotations({ [I18nAnnotationId]: { key, meta, ns } })(
      self,
    );
  };

  return { t };
};
