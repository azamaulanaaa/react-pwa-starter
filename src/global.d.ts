export {};

declare global {
  const __APP_NAME__: string;
  /** Vite build flag. It is true for `vite dev` and false for `vite build`. */
  const __DEVTOOLS__: boolean;
}

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    breadcrumb?: string | ((match: any) => string);
  }
}

declare global {
  type Prettify<T> = {
    [K in keyof T]: T[K];
  } & Record<PropertyKey, never>;
}
