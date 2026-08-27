export {};

declare global {
  const __APP_NAME__: string;
}

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    // deno-lint-ignore no-explicit-any
    breadcrumb?: string | ((match: any) => string);
  }
}

declare global {
  type Prettify<T> =
    & {
      [K in keyof T]: T[K];
    }
    & Record<PropertyKey, never>;
}
