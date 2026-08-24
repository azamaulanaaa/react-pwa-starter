export {};

declare global {
  const __APP_NAME__: string;
}

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    breadcrumb?: string | ((match: any) => string);
  }
}
