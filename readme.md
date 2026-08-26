# React Starter Kit

A batteries-included, TypeScript-first starter kit for building fast,
offline-capable React applications with Vite. It combines a modern stack (Vite
8 + React 19 + TypeScript) with PWA support, a Comlink web worker layer backed
by an offline database and file store, i18n, and a large prebuilt UI component
library, so you can bootstrap production-ready apps quickly.

## Why use this starter kit?

- Instant PWA behavior with auto-updating service worker.
- Worker-first architecture: all data access lives in a Comlink-exposed worker
  (database + file system), keeping the UI thread responsive.
- Offline-first persistence through oxkv (WASM key-value store) with Effect
  Schema validation and cross-tab synchronization.
- Chunked file upload/storage engine built into the worker (`src/worker/fs`)
  with a ready-made `useUploader` hook.
- Ready-made i18n (en-US, id-ID) and Effect Schema integration for validation +
  localized error messages.
- Large prebuilt UI kit (Base UI based) plus reusable form/table/input
  components with Ladle stories.
- Library of primitive hooks (debounce, persist state, media query, dark mode,
  readable streams, infinite scroll, ...) under `src/hooks`.

## Features

- Vite 8 (Rolldown) + TypeScript 6/7 + React 19
- Progressive Web App (service worker via vite-plugin-pwa + workbox-window,
  auto-update)
- Comlink-powered Web Worker that works as both Dedicated and SharedWorker
  (single shared instance across tabs)
- oxkv (WASM key-value store) for offline-first persistence
- Cross-tab data sync via change bus / peer sync (`src/worker/db-fs`)
- Chunked file storage API with strict part-size validation
- Custom translation layer (micromustache templates) with en-US/id-ID locales
  plus Intl-based number/date/currency formatting
- TanStack Router (file-based routes, auto code splitting), Form, Table, and
  query-core
- Tailwind CSS 4 + utility-first styling
- Testing with Vitest 4 (fake-indexeddb included)
- Component preview via Ladle
- Dark mode support
- Vendor chunk splitting strategy for optimized initial load

## Quick start

### Prerequisites

- Node (managed via [mise](https://mise.jdx.dev/); see `mise.toml`) — Deno is
  also used for formatting/linting
- Git

### Install and run locally

```bash
git clone https://github.com/azamaulanaaa/react-pwa-starter.git
cd react-pwa-starter
npm install
npm run dev           # start dev server (Vite)
```

### Scripts

| Script            | Description                               |
| ----------------- | ----------------------------------------- |
| `npm run dev`     | Start the Vite dev server                 |
| `npm run build`   | Production build (with bundle visualizer) |
| `npm run preview` | Preview the production build              |
| `npm run check`   | Type-check with TypeScript                |
| `npm run test`    | Run tests with Vitest                     |
| `npm run ladle`   | Serve Ladle component previews            |

Formatting and linting are handled by Deno (`deno fmt`, `deno lint`, configured
in `deno.json`).

## Notable dependencies

- `react`, `react-dom` — UI (v19)
- `vite`, `@vitejs/plugin-react` — build/dev (v8, Rolldown-based)
- `@tailwindcss/vite` — Tailwind CSS 4 integration
- `vite-plugin-pwa`, `workbox-window` — PWA/service worker
- `comlink`, `vite-plugin-comlink` — worker communication
- `oxkv` — WASM key-value store for offline persistence
- `unstorage` (IndexedDB driver) — storage utilities used by the worker file
  store
- `effect` — schema validation, streams, and error handling (v3.22+)
- `micromustache` — mustache-style interpolation for translations
- `@tanstack/react-router`, `@tanstack/react-form`, `@tanstack/react-table`,
  `@tanstack/query-core` — routing & data management
- `@base-ui/react` — unstyled, accessible components
- `class-variance-authority`, `cnfast`, `tailwindcss` — styling utilities
- `vitest` — test runner
- `@ladle/react` — component preview
- `uuid` — UUID v7 generation
- `@types/node`, `@types/bun`, `@types/deno` — type support for Node.js, Bun,
  and Deno development tooling

## Project structure

```
src/
├── routes/            # TanStack Router file-based routes (_dashboard layout)
├── components/
│   ├── ui/            # Prebuilt Base UI component kit (~55 components)
│   ├── input/         # Date picker and formatted inputs
│   ├── table/         # Generic table wrapper
│   ├── form/          # Ready-made forms (task, setting)
│   ├── list/          # List components (task)
│   ├── context/       # Providers: config, intl, translation, worker
│   └── image/         # Image preview
├── hooks/
│   ├── engines/       # Higher-level hooks: use-infinite-scroll, use-uploader
│   └── primitives/    # Small composable hooks (debounce, persist state,
│                      # media query, dark mode, streams, ...)
├── lib/               # Comlink helpers, cn, misc utilities
└── worker/
    ├── main.ts        # Worker entry: exposes { db, fs } via Comlink
    ├── db/            # Database layer: tables, schema, change bus, oxkv
    ├── db-fs/         # DB-backed file system + cross-tab peer sync
    └── fs/            # Chunked file storage (multi-part uploads)
```

## Service worker & update UX

- The service worker is registered via `virtual:pwa-register` in `src/main.tsx`;
  when new content is available the user is prompted to reload.
- For production deployments make sure the site is served over HTTPS and the
  build assets are deployed in a manner compatible with your SW's precaching
  strategy.

## Worker: database and offline persistence

- `src/worker/main.ts` exposes `{ db, fs }` over Comlink. It detects whether it
  runs as a SharedWorker or a Dedicated worker:
  - As a SharedWorker, every tab connects to one shared instance through its own
    MessagePort.
  - As a Dedicated worker, each tab gets its own instance, and changes are kept
    in sync across tabs via the change bus / peer sync layer
    (`src/worker/db-fs`).
- The database layer (`src/worker/db`) provides typed tables with Effect Schema
  validation on top of the oxkv WASM store, plus watch/stream APIs for reactive
  queries.
- The file system layer (`src/worker/fs`) stores files in chunks (multi-part
  uploads) with strict part-size validation rules.

## Persistent state management

- The project includes a custom `usePersistState` hook for localStorage-backed
  state persistence.
- State updates can be debounced (e.g. via `useDebouncedCallback`, default
  500ms) before persisting to localStorage.

## Schema validation with Effect

- The project uses Effect Schema for type-safe validation of documents, uploads,
  and hook state, including localized error messages.

## Internationalization

- Translations use a custom lightweight layer (`TranslationProvider` in
  `src/components/context/translation.tsx`) with micromustache templates instead
  of a heavy framework.
- Dictionaries live in `public/locales` (`en-US.json`, `id-ID.json`) and are
  fetched at runtime; `en-US` is the fallback dictionary.
- The active locale comes from user config or browser language detection via the
  `useNavigatorLanguage` hook.
- The `IntlProvider` context exposes localized number, currency, percent, date,
  and relative-time formatting plus parsing helpers.

## Dark mode

- Dark mode is supported with theme detection via the `useSystemDarkMode` hook
  (prefers-color-scheme media query).
- Theme and locale preferences are managed by the config context and editable
  from the settings page.

## Testing

- Vitest 4 is configured with a setup file at `src/vitest.setup.ts`
  (fake-indexeddb is used for storage-related tests).
- Tests live next to their modules (e.g. `src/worker/db/*.test.ts`).
- Run tests with `npm run test`.

## Component previews (Ladle)

- Components ship with `stories.tsx` files served by Ladle (`.ladle/` contains
  configuration).
- Run `npm run ladle` to browse them.

## Bundle Analysis

- rollup-plugin-visualizer is included for bundle size analysis.
- Run `npm run build` and check the generated report to optimize your bundle.
- Vendor dependencies are grouped into dedicated chunks (react, router,
  tanstack-ui, effect, database, worker, pwa, otel, ...); see `VENDOR_GROUPS`
  in `vite.config.ts`.

## Observability (OpenTelemetry)

The app ships with browser OpenTelemetry wired for traces, metrics and logs,
exported via OTLP/HTTP to any collector (Jaeger, Grafana Tempo/Alloy, Aspire
Dashboard, Honeycomb, Datadog OTLP intake, ...).

- The SDK lives in a dedicated lazy chunk (`vendor-otel`) and is dynamically
  imported after first paint from `src/main.tsx`, so it never blocks initial
  page load.
- Configuration is env-based (see `.env.example`): `VITE_OTEL_ENDPOINT`
  (default `http://localhost:4318`), plus service name, sampling ratio, metric
  export interval and a master kill-switch (`VITE_OTEL_ENABLED=false`).
- Privacy: set `VITE_OTEL_REQUIRE_CONSENT=true` for GDPR-style opt-in —
  telemetry then refuses to start until the app calls
  `setTelemetryConsent(true)` from `src/telemetry/api.ts`. Until consent,
  all helpers stay no-ops and nothing is collected or exported.
- Out of the box you get:
  - Auto-instrumented `fetch` spans (`@opentelemetry/instrumentation-fetch`);
    OTLP export calls themselves are excluded to avoid recursion.
  - Router navigation spans + `app.router.navigations` / duration histograms.
  - Core Web Vitals (CLS, INP, LCP, FCP, TTFB) as spans + histogram metrics.
  - Page-load timing span from Navigation Timing entries.
  - Uncaught errors / unhandled rejections as ERROR log records, rate-limited
    to 10 per minute with a suppression summary (error-storm protection).
  - A stable per-browser-session `session.id` resource attribute.
- To emit custom telemetry anywhere in app code, import the lightweight helpers
  from `src/telemetry/api.ts` — `getTracer()`, `getMeter()`, `getLogger()` and
  `withSpan(name, fn)`. They are no-ops until the SDK initializes, so call
  sites never need state checks. Never import `src/telemetry/index.ts`
  statically; that would pull the SDK into the eager graph.
- Your collector must allow CORS from the app origin. Example for Grafana
  Alloy's OTLP HTTP receiver:

  ```alloy
  otlp "http" {
    default_grpc_endpoint = "localhost:4317"
    default_http_endpoint = "localhost:4318"
    cors_allowed_origins  = ["https://your-app-origin"]
  }
  ```

## Development tips

- Routes are generated into `routeTree.gen.ts`. Add route modules under
  `src/routes`; the tree regenerates automatically (TanStack Router vite plugin
  with auto code splitting).
- Use the `WorkerProvider` context to access the worker API (`db`, `fs`). Keep
  heavy logic inside the worker to keep the UI responsive.
- Build new features from the primitive hooks in `src/hooks/primitives`; compose
  them into engine hooks in `src/hooks/engines`.
- Use path aliases (`@/`) for cleaner imports throughout your codebase.
- Tooling is pinned via `mise.toml` (Node, Deno, Tailwind language server,
  shadcn CLI).

## Deployment recommendations

- Build static assets (`npm run build`) and deploy to any static host that
  supports HTTPS (Netlify, Vercel, GitHub Pages with HTTPS, S3 + CloudFront).
- Ensure service worker scope and asset serving headers are configured correctly
  so precaching works as expected.
- The project is built for browser environments; Node.js, Bun, and Deno support
  is provided through type definitions for development tooling.

## Contributing

Contributions are welcome. Suggested workflow:

- Fork and create a feature branch.
- Keep changes small and focused; update or add tests where relevant.
- Verify before opening a PR:
  - npm install
  - npm run check
  - deno fmt && deno lint
  - npm run test
- Add a meaningful PR description describing the change and why it helps.

## License

MIT.
