# React PWA Starter

A batteries-included, TypeScript-first starter for building fast, offline-capable React applications with Vite. It combines a modern stack (Vite + React 19 + TypeScript) with PWA support, a Comlink web worker layer, i18n, and client-side persistence (Dexie), so you can bootstrap production-ready apps quickly.

## Why use this starter?

- Instant PWA behavior with service-worker lifecycle helpers and a smooth "new
  content available" UX.
- Worker-first patterns (Comlink) for costly work and offline data sync.
- Ready-made i18n and Effect-ts Schema integration for validation + localized
  error messages.
- Opinionated, extensible structure for routes, components, and features.
- Custom persistent state hook with debouncing (localStorage-backed).
- Built-in dark mode and readable stream support.

## Features

- Vite + TypeScript 6/7 + React 19
- Progressive Web App (service worker via vite-plugin-pwa + workbox-window)
- Comlink-powered Web Worker (worker isolation + API surface)
- Dexie (IndexedDB) for offline-first persistence
- i18next for translations with language sync
- TanStack Router (routeTree generated) for type-safe routing
- Tailwind CSS 4 + utility-first styling
- Testing with Vitest
- Story-like component preview via Ladle
- Dark mode support

## Quick start

### Prerequisites

- Node 18+ (or your preferred modern Node), Bun, or Deno
- Git

### Install and run locally

```bash
git clone https://github.com/azamaulanaaa/react-pwa-starter.git
cd react-pwa-starter
npm install
npm run dev           # start dev server (Vite)
```

## Notable dependencies

- `react`, `react-dom` — UI (v19)
- `vite`, `@vitejs/plugin-react` — build/dev (v8+, TypeScript support)
- `@tailwindcss/vite` — Tailwind CSS 4 integration
- `vite-plugin-pwa`, `workbox-window` — PWA/service worker
- `comlink`, `vite-plugin-comlink` — worker communication
- `dexie` — IndexedDB helper for offline persistence
- `i18next`, `i18next-browser-languagedetector`, `i18next-http-backend` — translations
- `@tanstack/react-router`, `@tanstack/react-form`, `@tanstack/react-table` — data management & routing
- `@base-ui/react` — unstyled, accessible components
- `effect` — schema validation and error handling (v3.22+)
- `tailwindcss` — styling (v4)
- `vitest` — test runner
- `@types/node`, `@types/bun`, `@types/deno` — type support for Node.js, Bun, and Deno development tooling

## Service worker & update UX

- The app uses registerSW (virtual:pwa-register). When a new release is
  available the onNeedRefresh callback shows a confirm prompt; if the user
  accepts, the page reloads to activate the new SW.
- For production deployments make sure the site is served over HTTPS and the
  build assets are deployed in a manner compatible with your SW's precaching
  strategy.

## Workers and offline persistence

- The app creates a Comlink worker with isolated worker API surface.
- Long-running or blocking operations are routed through the worker; db.ts provides a Dexie schema for offline data.

## Persistent state management

- The project includes a custom `usePersistState` hook for localStorage-backed state persistence.
- State updates are debounced (default 500ms) before persisting to localStorage.

## Schema validation with Effect-ts

- The project uses Effect-ts Schema (v3.22+) for type-safe validation.

## Internationalization

- The project uses i18next with custom language detection via `useHtmlLang` hook.

## Dark mode

- Dark mode is fully supported with theme detection via `useSystemDarkMode`
  hook.
- Detects system preference using `prefers-color-scheme` media query.
- Supports manual toggling and persists user preference.

## Testing

- Vitest is configured and a setup file exists at `src/vitest.setup.ts`.
- Run tests with `npm run test`.

## Bundle Analysis

- Vite Visualizer (rollup-plugin-visualizer) is included for bundle size analysis.
- Run `npm run build` and check the generated report to optimize your bundle.

## Development tips

- Routes are generated into routeTree.gen.ts. Add or update route modules under `src/routes` and regenerate the tree.
- Use the WorkerProvider wrapper to access worker methods. Keep heavy logic inside the worker to keep the UI responsive.
- For new translations add keys and run npm run i18n to extract strings, then provide translations for desired locales.
- Use path aliases (@/) for cleaner imports throughout your codebase.

## Deployment recommendations

- Build static assets (`npm run build`) and deploy to any static host that supports HTTPS (Netlify, Vercel, GitHub Pages with HTTPS, S3 + CloudFront).
- Ensure service worker scope and asset serving headers are configured correctly so precaching works as expected.
- The project is built for browser environments; Node.js, Bun, and Deno support is provided through type definitions for development tooling.

## Contributing

Contributions are welcome. Suggested workflow:

- Fork and create a feature branch.
- Keep changes small and focused; update or add tests where relevant.
- Run the test suite and the dev server to verify behavior:
  - npm install
  - npm run dev
  - npm run test
- Add a meaningful PR description describing the change and why it helps.

## License

MIT - See LICENSE file for details.
