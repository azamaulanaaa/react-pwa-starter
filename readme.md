# React Starter Kit

This project is a TypeScript starter kit for React applications that use Vite. The kit
builds offline-capable React applications. The stack is Vite 8, React 19, and TypeScript. The
kit also includes PWA support, a Comlink web worker, an offline database, a file store, i18n,
and a prebuilt UI component library. You can use the kit to start an application.

## Why use this starter kit?

- The service worker installs and updates by itself.
- A worker runs the data access. The worker provides the database and the file system
  through Comlink. The UI thread stays responsive.
- oxkv stores data offline. It is a WASM key-value store. Effect Schema validates the
  data. The tabs synchronize the data.
- The worker uploads and stores files in chunks. The code is in `src/worker/fs`. The engine
  also includes the hook `useUploader`.
- The kit includes i18n for en-US and id-ID. Effect Schema validates the data and creates
  localized error messages.
- The UI kit is based on Base UI. The kit also includes form, table, and input components.
  Ladle shows the stories for these components.
- The hooks in `src/hooks` handle debounce, persisted state, media queries, dark mode,
  readable streams, and infinite scroll.

## Features

- Vite 8 (Rolldown) + TypeScript 6/7 + React 19
- Progressive Web App (service worker via vite-plugin-pwa and workbox-window, auto-update)
- Comlink Web Worker that works as a Dedicated worker or as a SharedWorker. A SharedWorker
  runs one instance, and all tabs share that instance.
- oxkv (WASM key-value store) for offline-first persistence
- Cross-tab data sync via change bus / peer sync (`src/worker/db`)
- Chunked file storage API with strict part-size validation
- Custom translation layer (micromustache templates) with en-US and id-ID locales. The
  layer formats numbers, dates, and currency with Intl.
- TanStack Router reads routes from files and splits the code automatically. TanStack Form
  and TanStack Table handle forms and tables.
- Tailwind CSS 4 + utility-first styling
- Testing with Vitest 5 (fake-indexeddb included)
- Component preview via Ladle
- Dark mode support
- The build groups vendor code into chunks to reduce the first load

## Quick start

### Prerequisites

- Install Node. [mise](https://mise.jdx.dev) manages Node. See `mise.toml`.
- Git

### Install and run locally

```bash
git clone https://github.com/azamaulanaaa/react-pwa-starter.git
cd react-pwa-starter
npm install
npm run dev           # start dev server (Vite)
```

### Scripts

| Script              | Description                               |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Start the Vite dev server                 |
| `npm run build`     | Production build (with bundle visualizer) |
| `npm run preview`   | Preview the production build              |
| `npm run check`     | Type-check with TypeScript                |
| `npm run test`      | Run tests with Vitest                     |
| `npm run ladle`     | Serve Ladle component previews            |
| `npm run fmt`       | Format the code with Prettier             |
| `npm run fmt:check` | Check formatting without writing changes  |
| `npm run lint`      | Lint the code with oxlint                 |

Prettier formats the code and oxlint lints it. The configurations are in
`.prettierrc.json`, `.prettierignore`, and `.oxlintrc.json`.

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
- `@tanstack/react-router`, `@tanstack/react-form`, `@tanstack/react-table` —
  routing, forms, and data tables
- `@base-ui/react` — unstyled, accessible components
- `class-variance-authority`, `cnfast`, `tailwindcss` — styling utilities
- `vitest` — test runner
- `@ladle/react` — component preview
- `uuid` — UUID v7 generation
- `prettier`, `oxlint` — formatting and linting
- `@types/node`, `@types/bun` — type support for Node.js and Bun development
  tooling

## Project structure

```
src/
├── routes/            # TanStack Router routes from files (_dashboard layout)
├── examples/
│   └── task/          # Optional task example. The default app does not import it.
│       ├── form/      # Task form and stories
│       ├── list/      # Task list, stories, and tests
│       ├── schema.ts  # Task form schema and tests
│       ├── table.ts    # Task table module
│       ├── register.ts # Task table registration map
│       └── route.tsx  # Task route example
├── components/
│   ├── ui/            # Prebuilt Base UI component kit (54 components)
│   ├── input/         # Date picker and formatted inputs
│   ├── table/         # Generic table wrapper
│   ├── form/          # Form helpers and the setting form
│   ├── context/       # Providers: config, intl, translation, worker
│   └── image/         # Image preview
├── hooks/
│   ├── engines/       # Higher-level hooks: use-infinite-scroll, use-uploader
│   └── primitives/    # Small composable hooks (debounce, persist state,
│                      # media query, dark mode, streams)
├── lib/               # Comlink helpers, cn, misc utilities
└── worker/
    ├── main.ts        # Worker entry. It exposes { db, fs, queue } through Comlink.
    ├── db/            # Tables, schema, change bus, oxkv, persistence, peer sync
    ├── fs/            # Chunked file storage (multi-part uploads)
    └── queue/         # Job queue: schema, registry, store, watch bus, scheduler
```

## Optional task example

The task example in `src/examples/task` shows a form, a list, a schema, a table
module, and a route. The default app does not import this code. The task route is
not in the default route tree.

Copy the example into an application:

```bash
cp -R src/examples/task src/features/task
cp src/features/task/route.tsx src/routes/_dashboard/index.tsx
```

Then complete these steps:

1. Change the `@/examples/task` imports to `@/features/task`.
2. Add the example table map to `src/worker/db/database/main.ts`:

   ```ts
   import { taskTables } from "@/features/task/register.ts";

   export const tables = { ...taskTables };
   ```

3. Keep the task translation keys in `public/locales`.

The example tests run with the normal Vitest config. Run `npm run test`.

## Table registration

The core database factory takes a table map. The core has no table name. An
application supplies the table modules at startup.

1. Define the table with `createTableModule`. The module has a `name` and an
   Effect Schema.
2. Export a table map from a registration module. The example map is in
   `src/examples/task/register.ts`.
3. Add the table map to the `tables` object in
   `src/worker/db/database/main.ts`:

   ```ts
   import { taskTables } from "@/examples/task/register.ts";

   export const tables = { ...taskTables };
   ```

`src/worker/db/index.ts` passes the same object to `createDatabase` and
`createDbFs`. An empty `tables` object starts without a table and without an
error. The worker type comes from the table map, so the core types name no
table. The default app registers no table. The task example does not add itself
to the default app.

## Worker boundary

This section names files and symbols, not line numbers, so it stays true when the
code moves.

- The worker owns the database, the file store, and the job queue.
  `src/worker/main.ts` exposes `{ db, fs, queue }`.
  `src/components/context/worker.tsx` reaches the worker over a
  Comlink endpoint. In shared mode it wraps the shared port. In dedicated mode
  it wraps the Worker itself.
- `src/lib/comlink/effect.ts` registers two transfer handlers. `EFFECT_PROXY`
  handles Effects and `EFFECT_STREAM_PROXY` handles Streams.
  `src/lib/comlink/std.ts` registers a handler for plain functions.
- An Effect is never cloned across the port. `EFFECT_PROXY` keeps the Effect in
  the worker, exposes a function over a `MessageChannel`, and runs it there. It
  returns a plain envelope, `{ success, value }` or `{ success, error }`.
  Arguments cross as plain data, so each method decodes them before use, as
  `createTableApi` does in `src/worker/db/table.ts`. Pass only data that
  structured clone carries.
- Errors cross as strings. `flattenTaggedError` writes `[tag] message`, or
  `[tag -> tag] message` for a nested error. The client receives a plain `Error`
  whose message has two lines. The worker prefixes the first line and
  `flattenTaggedError` writes the second one, so the shape is:

  ```
  [Worker Error]
  [app/worker/db] <message>
  ```

  The `_tag` does not survive the boundary.
  - The worker declares three tags today: `app/worker/db` on `DbError` in
    `src/worker/db/error.ts`, `app/worker/fs` on `FsError` in
    `src/worker/fs/error.ts`, and `app/worker/queue` on `QueueError` in
    `src/worker/queue/error.ts`. Only the database one reaches the UI, because
    no UI code calls the file store or the queue yet.
    `flattenTaggedError` writes only `[tag] message`, so the client sees a
    `QueueError` nowhere, including its `reason`.
  - The moment a second tag reaches the client, stop relying on the tag
    surviving. Parsing the tag out of the message text works, but it is a guess
    that breaks silently when the message format changes. The fix is to send
    `{ _tag, message }` across the port and rebuild the tagged error on the
    client, which this bridge does not do today.

- The tracer is a `Context.Reference`, so its default resolves outside any
  Context. `withDevTools` provides the devtools layer around the whole
  transferred Effect run. The layer merges the tracer into the Context of that
  run and of no other. Nothing changes the default tracer for the process.
  Effects started on other paths, such as the stream bridge or the plain
  function handler, keep the default tracer.
- `effectProxyContext` in `src/lib/comlink/effect.ts` is the shared Context that
  every transferred Effect runs under. It is module-private and empty today. Add
  a worker-side service to it and every transferred Effect can read it without
  changing the run path again.
- The default UI makes no database calls. The optional task example in
  `src/examples/task/route.tsx` shows five calls: `watch`, `set` twice, `get`,
  and `delete`. The file store and the job queue are built, tested, and
  bridged. No UI code calls either one.
- `register` in `src/worker/queue/index.ts` is worker-side only and is not on
  the exposed `queue` object. A handler is a closure, so only a module the
  worker imports can register one. A `kind` is usable only in a build where
  some module called `register` for it, and `enqueue` for an unregistered kind
  fails immediately instead of queueing into a guaranteed failure.
- Cancelling the reader on the UI side stops the reader and releases the worker's
  stream. The `EFFECT_STREAM_PROXY` finalizer runs on every terminal path, which
  are the end of the data, a failure, and a cancel. It calls the remote `return`
  only on the cancel path, and that call closes the worker's stream fiber. The
  finalizer closes the port on all three paths. Cancelling a `queue.watch`
  reader releases the worker's subscription. It stops no job.
- A transferred Effect has no cancel path. Nothing interrupts the worker run when
  the caller stops awaiting it. The worker runs it to completion. A queue job is
  different: it runs on a fiber the queue runtime owns, never on the caller's
  fiber, so dropping the `enqueue` call stops nothing. `pause`, `resume`, and
  `cancel` are three separate short worker calls that mutate the queue's own
  state.
- The queue runtime (`src/worker/queue/runtime.ts`) is built once under an
  explicit scope that lives for the life of the worker. It is not a `Layer`:
  `Layer.effect` rebuilds per call, so the queue would reset on every call.

## Service worker & update UX

- `src/main.tsx` registers the service worker through `virtual:pwa-register`. The app asks
  the user to reload when new content is available.
- Serve the site over HTTPS for a production deployment. Deploy the build assets so they
  match your service worker's precaching strategy.

## Worker: database and offline persistence

- `src/worker/main.ts` exposes `{ db, fs, queue }` over Comlink. It detects whether it runs as a
  SharedWorker or a Dedicated worker.
  - As a SharedWorker, every tab connects to one shared instance through its own
    MessagePort.
  - As a Dedicated worker, each tab gets its own instance. The change bus and the peer sync
    layer (`src/worker/db`) send changes to the other tabs.
- The database layer (`src/worker/db`) provides typed tables. Effect Schema validates each
  table. The tables use the oxkv WASM store. The layer also provides watch and stream APIs
  for reactive queries.
- The file system layer (`src/worker/fs`) stores files in chunks (multi-part
  uploads) with strict part-size validation rules.
- The queue layer (`src/worker/queue`) runs jobs. It has one scheduler, one
  global concurrency limit (2 by default), and an admission cap (64 by default).
  The records are the single source of truth and the registry is empty until a
  worker module registers a handler.
  - `pause` interrupts and `resume` re-runs the handler from its beginning.
    Nothing about a job's in-memory position survives a pause, so a resumable
    continuation of an arbitrary Effect does not exist. Cleanup a handler
    installed with `Effect.addFinalizer` still runs.
  - `resume` goes to the back of the line. It does not jump ahead of work that
    was queued while it was paused.
  - `cancel` interrupts the fiber and leaves the record `canceled`. It does not
    roll back side effects the handler already produced. Compensation belongs in
    the handler's own finalizer.
  - Retry is not in v1. A handler that wants it calls `Effect.retry` inside
    itself, where it knows whether the failure was transient.

## Persistent state management

- The project includes a `usePersistState` hook. The hook stores state in `localStorage`.
- The app can debounce state updates with `useDebouncedCallback`. The default delay is
  500ms. The hook writes the state to `localStorage` after the delay.

## Schema validation with Effect

- The project uses Effect Schema to validate documents, uploads, and hook state. The
  validation is type-safe. The error messages are localized.

## Internationalization

- The project uses a lightweight translation layer. The provider is `TranslationProvider` in
  `src/components/context/translation.tsx`. The layer uses micromustache templates. The layer
  replaces a full framework.
- The dictionaries are in `public/locales`. The files are `en-US.json` and `id-ID.json`. The
  app fetches the files at runtime. The app uses `en-US` as the fallback dictionary.
- The active locale comes from the user config. The hook `useNavigatorLanguage` detects the
  browser language.
- The `IntlProvider` context formats numbers, currency, percentages, dates, and relative
  times. The context localizes the formats. The context also provides parsing helpers.

## Dark mode

- The hook `useSystemDarkMode` detects the theme. The hook uses the `prefers-color-scheme`
  media query. The app supports dark mode.
- The config context stores the theme and the locale preferences. The settings page lets the
  user edit these preferences.

## Testing

- Vitest 5 uses the setup file `src/vitest.setup.ts`. The storage tests use fake-indexeddb.
- Tests live next to their modules. For example, `src/worker/db/*.test.ts` and
  `src/examples/task/*.test.ts`.
- Run tests with `npm run test`.

## Component previews (Ladle)

- Each component has a `stories.tsx` file. Ladle serves the stories in
  `src/components` and `src/examples`. The configuration is in `.ladle/`.
- Run `npm run ladle` to open the previews.

## Bundle Analysis

- The project includes rollup-plugin-visualizer. The plugin analyzes the bundle size.
- Run `npm run build`. Then check the generated report. Use the report to reduce the bundle
  size.
- The build groups vendor dependencies into separate chunks. The groups are react, router,
  tanstack-ui, visuals, effect, database, worker, pwa, otel, and util. See `VENDOR_GROUPS` in
  `vite.config.ts`.

## Observability (OpenTelemetry)

The app uses browser OpenTelemetry. The SDK records traces, metrics, and logs. It exports the
data through OTLP/HTTP to any collector. The collectors are Jaeger, Grafana Tempo, Grafana
Alloy, Aspire Dashboard, Honeycomb, and Datadog OTLP intake.

- The SDK is in the lazy chunk `vendor-otel`. `src/main.tsx` imports the chunk after the
  first paint. The SDK does not block the first page load.
- The configuration uses environment variables. See `.env.example`. The variable
  `VITE_OTEL_ENDPOINT` sets the endpoint. The default is `http://localhost:4318`. The app
  also reads the service name, the sampling ratio, and the metric export interval. The
  variable `VITE_OTEL_ENABLED` stops the telemetry when you set it to `false`.
- Privacy: set `VITE_OTEL_REQUIRE_CONSENT=true` for a GDPR-style opt-in. The telemetry does
  not start until the app calls `setTelemetryConsent(true)` from `src/telemetry/api.ts`.
  Until the user gives consent, all helpers stay no-ops. The app collects nothing and exports
  nothing.
- The project includes the following features.
  - The SDK creates spans for `fetch` calls with `@opentelemetry/instrumentation-fetch`. The
    SDK excludes OTLP export calls to avoid recursion.
  - The SDK creates spans for router navigation. It records `app.router.navigations` and
    histograms of the duration.
  - The SDK records Core Web Vitals (CLS, INP, LCP, FCP, TTFB) as spans and histogram
    metrics.
  - The SDK creates a page load timing span from Navigation Timing entries.
  - The SDK records uncaught errors and unhandled rejections as ERROR log records. It limits
    the records to 10 per minute. It adds a suppression summary (error-storm protection).
  - The SDK sets a stable `session.id` resource attribute for each browser session.
- You can record custom telemetry in the app code. Import the lightweight helpers from
  `src/telemetry/api.ts`. The helpers are `getTracer()`, `getMeter()`, `getLogger()`, and
  `withSpan(name, fn)`. They are no-ops until the SDK initializes. The call sites do not need
  a state check. Never import `src/telemetry/index.ts` statically. A static import adds the
  SDK to the eager graph.
- Your collector must allow CORS from the app origin. This example configures the OTLP HTTP
  receiver of Grafana Alloy:

  ```alloy
  otlp "http" {
    default_grpc_endpoint = "localhost:4317"
    default_http_endpoint = "localhost:4318"
    cors_allowed_origins  = ["https://your-app-origin"]
  }
  ```

## Development tips

- Routes are generated into `routeTree.gen.ts`. Add route modules under `src/routes`. The
  TanStack Router vite plugin regenerates the tree automatically. The plugin also splits the
  code automatically.
- Use the `WorkerProvider` context to access the worker API (`db`, `fs`). Put the heavy logic
  in the worker. The UI stays responsive.
- Build new features from the primitive hooks in `src/hooks/primitives`. Compose the hooks
  into engine hooks in `src/hooks/engines`.
- Use the path alias `@/` for shorter imports.
- The file `mise.toml` pins the tool versions. The tools are Node, the Tailwind
  language server, and the shadcn CLI.

## Deployment recommendations

- Run `npm run build` to build the static assets. Deploy the assets to a static host that
  supports HTTPS. The hosts are Netlify, Vercel, GitHub Pages with HTTPS, and S3 with
  CloudFront.
- Configure the service worker scope and the asset serving headers correctly. Then the
  precaching works as expected.
- The project runs in a browser. The type definitions cover Node.js and Bun. The
  development tools use these types.

## Contributing

Contributions are welcome. Use this workflow:

- Fork the project and create a feature branch.
- Keep the changes small and focused. Update or add the tests where it matters.
- Run these commands before you open a PR:
  - npm install
  - npm run check
  - npm run fmt:check
  - npm run lint
  - npm run test
- Add a PR description. The description must explain the change and the benefit.

## License

MIT.
