# React Starter Kit

This project is a TypeScript starter kit for React applications that use Vite. The kit
builds offline-capable React applications. The stack is Vite 8, React 19, and TypeScript. The
kit also includes PWA support, a Comlink web worker, an offline database, a file store, i18n,
and a prebuilt UI component library. You can use the kit to start an application.

The starter has no business logic. The optional task example is separate from the core. An
application adds its own domain code.

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

- Vite 8 (Rolldown) + TypeScript 7 + React 19
- Progressive Web App (service worker via vite-plugin-pwa and workbox-window, auto-update)
- Comlink Web Worker that works as a Dedicated worker or as a SharedWorker. A SharedWorker
  runs one instance, and all tabs share that instance.
- oxkv (WASM key-value store) for offline-first persistence
- Cross-tab data sync via change bus / peer sync (`src/worker/db`)
- Durable outbox with idempotent retries and automatic flush
- Change feed pull and apply pages with a stored cursor
- Report client with poll, artifact cache, and the `useReport` hook
- Server clock and organization time zone helpers (`src/lib/time`)
- Camera, geolocation, and JPEG image hooks (`src/hooks/engines`, `src/lib/image.ts`)
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

- Install Node. [mise](https://mise.jdx.dev) manages Node. See `mise.toml`. Install Git.

### Install and run locally

```bash
git clone https://github.com/azamaulanaaa/react-pwa-starter.git
cd react-pwa-starter && npm install && npm run dev
```

### Scripts

| Script                  | Description                               |
| ----------------------- | ----------------------------------------- |
| `npm run dev`           | Start the Vite dev server                 |
| `npm run build`         | Production build (with bundle visualizer) |
| `npm run preview`       | Preview the production build              |
| `npm run check`         | Type-check with TypeScript 7              |
| `npm run test`          | Run tests with Vitest                     |
| `npm run test:run`      | Run tests with Vitest one time            |
| `npm run ladle`         | Serve Ladle component previews            |
| `npm run fmt`           | Format the code with Prettier             |
| `npm run fmt:check`     | Check formatting without writing changes  |
| `npm run lint`          | Lint the code with oxlint                 |
| `npm run ci`            | Run all CI checks locally                 |
| `npm run hooks:install` | Install the local Git hooks               |

Prettier formats the code and oxlint lints it. The configurations are in
`.prettierrc.json`, `.prettierignore`, and `.oxlintrc.json`.

## Continuous integration

The workflow `.github/workflows/ci.yml` runs on each push to `main`, on each
pull request, and on manual dispatch. It uses Node 24.x and Node 26.x. The
workflow runs these checks:

- `npm run fmt:check` checks the formatting.
- `npm run lint` runs oxlint.
- `npm run check` runs the type check.
- `npm run test:run` runs the tests one time.
- `npm run build` makes the production build.

Run the same checks locally with `npm run ci`.

## Local git hooks

Install the local hooks with `npm run hooks:install`. The command sets
`core.hooksPath` to `.githooks`.

- The pre-commit hook runs `npm run fmt:check` and `npm run lint`.
- The pre-push hook runs `npm run ci`.

The hooks stop when `node_modules` is missing. Run `npm ci` first.

To skip a hook in an emergency, add `--no-verify` to the command. Use
`git commit --no-verify` to skip the pre-commit hook. Use
`git push --no-verify` to skip the pre-push hook. Run the checks before you
push the changes.

## Start both services

This section starts the frontend and a local `rust-api` instance. The starter does
not include the backend. Get `rust-api` from
<https://github.com/azamaulanaaa/rust-api>. The default frontend does not mount the
adapter. Complete the steps in [rust-api adapter](#rust-api-adapter) in an
application that needs the backend.

### Prepare the backend

The backend needs Rust 1.88 or newer and an OIDC provider. For local work without
an S3 bucket, set the S3 backend to `memory`.

Create `config.toml` in the `rust-api` checkout:

```toml
public_address = "http://localhost:5173"
listen_port = 8080

[authorization]
client_id = "rust-api"
client_secret = "replace-me"
issuer_url = "https://idp.example.com"

[database]
prefix = "oxkv"

[s3]
backend = "memory"
bucket = "local"
region = "us-east-1"

[observability]
otlp_endpoint = "http://localhost:4318/v1/traces"
```

- The `public_address` value builds the OIDC redirect. Register
  `http://localhost:5173/auth/callback` as the redirect URI at the provider. For
  local development, set `public_address = "http://localhost:5173"`. The Vite dev
  server proxies `/auth` to the backend, so the callback lands on the SPA origin.
- You do not need `RUST_API_ALLOWED_ORIGINS` with the proxy. The SPA and the API
  share one origin, so the browser sends no CORS preflight. Keep the
  `[http].allowed_origins` value only for a direct cross-origin setup.
- The `[observability].otlp_endpoint` value is optional. The rust-api OTLP export
  is off by default. The default frontend endpoint is `http://localhost:4318`, and
  the SDK adds `/v1/traces`, `/v1/metrics`, and `/v1/logs` to it. The rust-api
  endpoint needs the full signal path. For the `otlp-http` build, set
  `http://localhost:4318/v1/traces`. For the `otlp-grpc` build, set
  `http://localhost:4317`. Both services can send to one collector. The collector
  must allow CORS from `http://localhost:5173` for the browser exporter.

Start the backend on port 8080 with `mise install`, then
`cargo run -- serve --config config.toml`. Check readiness with
`curl http://localhost:8080/ready`. A `200` response means the backend is ready.

### Configure and start the frontend

Copy `.env.example` to `.env` and set these values:

```dotenv
VITE_API_BASE_URL=/api
VITE_RUST_API_ENABLED=true
VITE_RUST_API_BASE_URL=/
```

`VITE_API_BASE_URL` sets the base URL for the generic client in `src/lib/api`.
`VITE_RUST_API_ENABLED` loads the optional rust-api session provider on demand. The default
is `false`, so a normal development run sends no request to the rust-api.
`VITE_RUST_API_BASE_URL` sets the base URL for the optional adapter in
`src/rust-api/shared/client.ts`. The default is `http://localhost:8080`.
`/` means the SPA origin. The local setup above uses the proxy value `/`.

The Vite dev server runs on `http://localhost:5173` and proxies `/auth`, `/fs`,
and `/sync` to `http://localhost:8080`. Start the backend on 8080, then run
`npm install` and `npm run dev`, and open `http://localhost:5173`.

Because the SPA and the API share one origin, the OIDC callback returns to
`http://localhost:5173/auth/callback`. The `return_to` redirect also stays on
the SPA origin.

A production deployment needs the same mapping in a reverse proxy. For
example, with nginx:

```nginx
location /auth/ { proxy_pass http://rust-api:8080; }
location /fs/   { proxy_pass http://rust-api:8080; }
location /sync/ { proxy_pass http://rust-api:8080; }
```

Or with Caddy:

```caddyfile
handle /auth/* { reverse_proxy rust-api:8080 }
handle /fs/*   { reverse_proxy rust-api:8080 }
handle /sync/* { reverse_proxy rust-api:8080 }
```

### Sign in and keep the session

The adapter does not render a login route. Call `provider.login()` from the
application, or open `http://localhost:5173/auth/login` directly.

1. `GET /auth/login?return_to=<encoded path>` stores the path in the short-lived
   `oidc_return_to` cookie and redirects the browser to the OIDC provider. The
   path must be relative and start with one `/`. The server returns `400` for an
   absolute URL, a protocol-relative path, a backslash, or a control character.
2. The provider redirects to `GET /auth/callback`. The callback sets the
   `auth_token` cookie. It also sets `refresh_token` when the provider sends one.
   With `return_to`, the callback returns `302` to that relative path. On failure
   it adds `?error=<code>`. Without `return_to`, the callback returns an
   `AuthResponse` JSON body.
3. `GET /auth/me` is the session guard. A `401` response means no session. The
   adapter maps `sub` to the user id and `exp` seconds to `expiresAt`
   milliseconds.
4. `POST /auth/refresh` renews the session from the `refresh_token` cookie. Call
   it before `exp`. A `401` response means the session is gone, so send the user
   to login again. The adapter keeps the new token in memory.
5. `POST /auth/logout` clears `auth_token` and `refresh_token`. The server also
   starts a best-effort RFC 7009 revocation. The adapter clears the in-memory
   token and the session cache.

The callback redirect uses the stable error codes `access_denied`,
`authentication_failed`, `security_cookies_missing`, and `invalid_state`. The
callback keeps an existing query and fragment.

The adapter sends `credentials: "include"` on every request. The Vite proxy
forwards the cookies to the backend, so the browser sees one origin. The adapter
does not persist the token across page loads.

The `return_to` value is a relative path. The browser resolves the `302` against
the API origin. The adapter sends `return_to` only when the API URL has the same
origin as the SPA. The `spaOrigin` option overrides the browser origin. With the
dev proxy, `/` gives a same-origin API, so the callback returns to the SPA.

For a direct cross-origin API, the adapter keeps the path in session storage and
opens `/auth/login` without `return_to`. The callback then returns JSON on the
API origin. The user must return to the SPA manually. `SessionProvider` reads the
stored path on the next mount and opens it. A direct cross-origin setup must set
`VITE_RUST_API_BASE_URL` to the absolute API URL, register the API callback URL
at the provider, and set `RUST_API_ALLOWED_ORIGINS` to the SPA origin.

`SameSite=Lax` requires the SPA and the API to be same-site. A different port on
the same host is same-site. A different registrable domain is not same-site. A
SPA on a different registrable domain must use the bearer token.

### Run validation

`npm run dev` starts only the dev server. Run `npm run test`, `npm run build`,
and `npm run check` for the frontend tests, build, and type check.

## Notable dependencies

- `react`, `react-dom` — UI (v19)
- `vite`, `@vitejs/plugin-react` — build/dev (v8, Rolldown-based)
- `@tailwindcss/vite` — Tailwind CSS 4 integration
- `vite-plugin-pwa`, `workbox-window` — PWA/service worker
- `comlink`, `vite-plugin-comlink` — worker communication
- `oxkv` — WASM key-value store for offline persistence
- `idb-keyval` — IndexedDB key-value store for report artifacts
- `unstorage` (IndexedDB driver) — storage utilities used by the worker file
  store
- `effect` — schema validation, streams, and error handling (v4.0.2)
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
│   ├── context/       # Providers: config, intl, session, translation, worker
│   ├── image/         # Image components
│   │   ├── thumbnail/ # Image thumbnail with an overlay
│   │   └── view/      # Image view lightbox
│   └── upload/        # File upload with drag and drop
├── hooks/
│   ├── engines/       # Higher-level hooks: use-infinite-scroll, use-uploader,
│   │                  # use-report, use-camera, use-geolocation
│   └── primitives/    # Small composable hooks (debounce, persist state,
│                      # media query, dark mode, streams, use-file-upload)
├── lib/               # Comlink helpers, generic API, auth, sync, outbox, report,
│                      # time, pwa, and file contracts, cn, utilities
├── rust-api/          # Optional backend adapter. The core imports only optional.tsx.
│   ├── shared/        # Client, config, sync, files, and generated wire types.
│   ├── main/          # Browser composition root, session, auth card, and mount.
│   └── worker/        # Worker composition root. src/worker/main.ts does not expose it yet.
└── worker/
    ├── main.ts        # Worker entry. It exposes { changes, db, fs, outbox, queue }.
    ├── db/            # Tables, schema, change bus, change apply, oxkv,
    │                  # persistence, peer sync
    ├── fs/            # Chunked file storage (multi-part uploads)
    ├── outbox/        # Durable writes: schema, registry, backoff, runtime
    └── queue/         # Job queue: schema, registry, store, watch bus, scheduler
```

## Optional task example

The task example in `src/examples/task` shows a form, a list, a schema, a table
module, and a route. The default app does not import this code. The task route is
not in the default route tree.

Create `src/features`, copy `src/examples/task` to `src/features/task`, then copy
its `route.tsx` to `src/routes/_dashboard/index.tsx`.

Then complete these steps:

1. Change every `@/examples/task` import in `src/features/task` and
   `src/routes/_dashboard/index.tsx` to `@/features/task`.
2. Add the example table map to `src/worker/db/database/main.ts`:

   ```ts
   import { taskTables } from "@/features/task/register.ts";

   export const tables = { ...taskTables };
   ```

   The default file exports an empty `tables` object. The example map adds the
   `task` table to the worker database.

3. Keep the task translation keys in `public/locales`.

The example route uses the `/_dashboard/` path. The copy replaces the default
home page. The example tests run with the normal Vitest config. Run
`npm run test`.

## Table registration

The core database factory takes a table map. The core has no table name. An
application supplies the table modules at startup.

1. Define the table with `createTableModule`. The module has a `name` and an
   Effect Schema.
2. Export a table map from a registration module. The example map is in
   `src/examples/task/register.ts`.
3. Add the map to the `tables` object in `src/worker/db/database/main.ts`. The
   task example above shows the import and the spread.

`src/worker/db/index.ts` passes the same object to `createDatabase` and
`createDbFs`. An empty `tables` object starts without a table and without an
error. The worker type comes from the table map, so the core types name no
table. The default app registers no table. The task example does not add itself
to the default app.

## Worker boundary

This section names files and symbols, not line numbers, so it stays true when the
code moves.

- The worker owns the database, the file store, the job queue, the durable
  outbox, and the change applier. `src/worker/main.ts` exposes
  `{ changes, db, fs, outbox, queue }`. `src/components/context/worker.tsx`
  reaches the worker over a Comlink endpoint. In shared mode it wraps the shared
  port. In dedicated mode it wraps the Worker itself.
- `src/lib/comlink/effect.ts` registers two transfer handlers. `EFFECT_PROXY`
  handles Effects and `EFFECT_STREAM_PROXY` handles Streams.
  `src/lib/comlink/std.ts` registers a handler for plain functions.
- An Effect is never cloned across the port. `EFFECT_PROXY` keeps the Effect in
  the worker, exposes a function over a `MessageChannel`, and runs it there. It
  returns `{ success, value }` or `{ success, error }`. Arguments cross as plain
  data, so each method decodes them before use, as `createTableApi` does in
  `src/worker/db/table.ts`.
- Errors cross as a value. The error envelope is
  `{ success: false, error: { tag, message, details? } }`. The client receives a
  `WorkerError` with the `tag` field and a two-line message:

  ```
  [Worker Error]
  [app/worker/db] <message>
  ```

  A plain error has `tag: null`. A nested error keeps both tags in
  `details.tags`, such as `["app/worker/db", "app/worker/fs"]`, and the message
  keeps the chain as `[app/worker/db -> app/worker/fs] <message>`.
  - The worker declares four tags: `app/worker/db` on `DbError`,
    `app/worker/fs` on `FsError`, `app/worker/queue` on `QueueError`, and
    `app/worker/outbox` on `OutboxError`. Each error carries a `message` getter.
  - The client reads the tag from `error.tag`. It never parses the tag from the
    message text. It accepts the old string error value for one release and maps
    that value to a null tag.
  - The stream handler keeps the same tag. Comlink copies only `message`, `name`,
    and `stack` from a thrown Error. The worker keeps the payload on a `failure`
    method and sends the payload as a value.

- The tracer is a `Context.Reference`. `withDevTools` provides the devtools
  layer around one transferred Effect run. Other paths, such as the stream
  bridge, keep the default tracer. `effectProxyContext` in
  `src/lib/comlink/effect.ts` is the shared Context that every transferred
  Effect runs under. Add a worker-side service to it and every transferred
  Effect can read it.
- The default UI makes no database calls. The optional task example in
  `src/examples/task/route.tsx` shows five calls: `watch`, `set` twice, `get`,
  and `delete`. The file store and the job queue are built, tested, and
  bridged. No UI code calls either one.
- `register` in `src/worker/queue/index.ts` is worker-side only and is not on
  the exposed `queue` object. A handler is a closure, so only a module that the
  worker imports can register one. `enqueue` for an unregistered kind fails at
  once.
- Cancelling the reader on the UI side stops the reader and releases the
  worker's stream. The `EFFECT_STREAM_PROXY` finalizer runs on the end of the
  data, a failure, and a cancel. It calls the remote `return` only on the cancel
  path. Cancelling a `queue.watch` reader releases the worker's subscription. It
  stops no job.
- A transferred Effect has no cancel path. The worker runs it to completion. A
  queue job runs on a fiber that the queue runtime owns, so dropping the
  `enqueue` call stops nothing. `pause`, `resume`, and `cancel` are three
  separate worker calls that mutate the queue's own state.
- One supervisor scope in `src/worker/supervisor.ts` owns every long-lived
  worker fiber. The queue loop and the outbox flusher run under this scope.
  `src/worker/runtime.ts` builds the `{ changes, db, fs, outbox, queue }`
  object. The queue runtime is not a `Layer`, because `Layer.effect` rebuilds
  per call and would reset the queue.
- `stopWorker` closes the supervisor scope. It is worker-side only. The UI does
  not call it.

## Service worker & update UX

- `src/main.tsx` registers the service worker through `virtual:pwa-register`. The app asks
  the user to reload when new content is available.
- Serve the site over HTTPS for a production deployment. Deploy the build assets so they
  match your service worker's precaching strategy.

## Worker: database and offline persistence

- `src/worker/main.ts` exposes `{ changes, db, fs, outbox, queue }` over Comlink. It detects whether it runs as a
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

## Durable outbox

- The worker outbox is in `src/worker/outbox`. The shared types are in
  `src/lib/outbox`. `src/worker/main.ts` exposes it as `outbox`.
- The API has `enqueue`, `get`, `list`, `status`, `watch`, `flush`, and `resume`.
  `register` is worker-side only. `enqueue` fails for an unknown kind.
- An operation has a UUIDv7 `id`. The id is also the idempotency key, so a second
  send is safe. `createdAt` is the server-corrected time when given.
- The state type is `pending`, `sending`, `failed`, `conflict`, or `done`.
  `sending` is durable before the call. A restart returns it to `pending`.
- A `2xx` response removes the row. A `401` pauses the flusher and sets
  `signInRequired`. A `409` or a conflict code moves the row to `conflict`. A
  permanent `4xx` code moves it to `failed`. Every other response retries.
- Retry uses exponential backoff. The base is 1000 ms and the cap is 300000 ms.
  The jitter is 50 to 100 percent. The head row blocks the queue until it ends.
- One flusher fiber runs at a time. A duplicate `flush()` joins the active
  drain and returns the same result. A failed or interrupted drain clears the
  active slot, so a later call can start again.
- `status` returns `pending`, `sending`, `failed`, and `conflict` counts. It also
  returns `paused` and `signInRequired`. `useOutbox` reads the counts.
- `useAutoFlush` flushes on the `online` event, on a visible tab, and after a
  login. It also flushes every 60 seconds while a write is pending and the tab
  is visible and online. `useConnectivity` supplies both states.

## Persistent state management

- The project includes a `usePersistState` hook. The hook stores state in `localStorage`.
- The app can debounce state updates with `useDebouncedCallback`. The default delay is
  500ms. The hook writes the state to `localStorage` after the delay.

## Device hooks

- `useCamera` in `src/hooks/engines/use-camera.ts` starts the camera only when
  the caller calls `start`. It requests the front camera with no audio.
- The camera status is `idle`, `starting`, `ready`, or `error`. The error is
  `denied`, `not_found`, `busy`, `unavailable`, or `capture_failed`.
- The hook stops every track on unmount and on `stop`. It stops a stream that
  arrives after unmount, and a stream with no video track. By default, `capture`
  returns a JPEG blob.
- `useGeolocation` in `src/hooks/engines/use-geolocation.ts` requests one
  position. It asks on mount by default, with high accuracy, a 15-second limit,
  and no cached position.
- The status is `idle`, `locating`, `success`, or `error`. The error is `denied`,
  `unavailable`, `timeout`, or `unsupported`. The hook keeps the last
  coordinates and accuracy. It ignores a late result after unmount.
- `src/lib/image.ts` encodes JPEG. The long edge is at most 720 px. It lowers the
  quality from 0.7 to try to fit 300 KiB. The quality does not go below 0.4.

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

## API client

- The generic client is in `src/lib/api`. The client sends JSON and reads JSON. The client
  has no domain type.
- The client reads the base URL from `VITE_API_BASE_URL`. The default is `/api` on the same
  origin. Set the variable to an absolute URL for another host. The client does not name a
  backend.
- `createApiClient` accepts a `fetch` function. Tests give a fake function. The default is the
  global `fetch`.
- `createApiClient` accepts a `tokenProvider`. The provider implements `getToken`. The client
  adds `Authorization: Bearer <token>` when the token is not empty. The client adds no header
  when the token is empty. A React provider can implement the interface.
- `client.request<T>(path, options)` sends a method, a JSON body, headers, and an abort signal.
  The function returns the parsed JSON value. The function returns `undefined` for an empty
  response.
- `createApiClient` accepts a `clock` sampler. The client samples every response with it.
- A failed response returns an `ApiError`. The error has `status`, `message`, `code`, and
  `details`. The client reads the `{ "error": "...", "code": "...", "details": ... }` envelope.
  `code` is `null` and `details` is `undefined` when the body omits them. The status is `null`
  when no response arrives.

```ts
import { createApiClient } from "@/lib/api";

const api = createApiClient({ tokenProvider: { getToken: () => token } });
```

## Server clock

- `createServerClock` in `src/lib/time/clock.ts` adds an offset to local time.
  `serverTimeFromResponse` reads `X-Server-Time-Ms` first, then `Date` (one-second
  resolution). `offsetFromSample` removes half of the round trip.
- The clock stores the offset and its measurement time under `app.server-clock.v1` in
  `localStorage`. The memory storage is the fallback. `isStale` reports true after one hour.
- `organizationDay` returns the organization-local date as `YYYY-MM-DD`. `shiftWindow`
  returns `{ startMs, endMs, day }`. Both use `Intl` and the given time zone, not the device
  time zone. A shift crosses midnight when `overnight` is true or the end is not later than
  the start. The window belongs to the start date.

## Session provider

- The contract is in `src/lib/auth/types.ts`. The index `src/lib/auth` exports the contract
  and its helpers.
- The `Session` type has a `user` identity and an `expiresAt` time. The time uses Unix epoch
  milliseconds. An expired session counts as missing.
- The `SessionProvider` interface has four methods: `getSession`, `login`, `logout`, and
  `refresh`. `getSession` returns null when no session exists. `refresh` returns the new
  session.
- The core has no identity provider detail. An adapter implements the interface for one
  backend. The core names no OIDC provider and no backend path.
- The React layer is in `src/components/context/session.tsx`. The module exports
  `SessionProvider`, `useSession`, and `RequireSession`.
- `SessionProvider` takes a `provider` prop. The provider loads the session one time when it
  mounts. `useSession` returns `session`, `status`, `error`, `login`, `logout`, and
  `refresh`.
- `RequireSession` renders its children only for a valid session. The guard shows the
  optional `fallback` while the session loads. Without a session, the guard calls
  `onUnauthenticated(loginPath)`. When no callback exists, the guard redirects the browser
  to `loginPath`. The default path is `/login`.

```tsx
import {
  RequireSession,
  SessionProvider,
} from "@/components/context/session.tsx";
import type { SessionProvider as SessionContract } from "@/lib/auth";

const provider: SessionContract = {
  getSession: async () => null,
  login: async () => {},
  logout: async () => {},
  refresh: async () => null,
};

<SessionProvider provider={provider}>
  <RequireSession loginPath="/sign-in">
    <Dashboard />
  </RequireSession>
</SessionProvider>;
```

### Session durability

- The session cache is in `src/lib/auth/cache.ts`. The record holds `userId`, `expiresAt`,
  `lastVerifiedAt`, and `epoch`. The record does not hold the token. The cookie is the
  credential.
- `getSession` calls the network with a five-second limit. When the network fails, the call
  times out, or the server returns a `5xx` response, the call returns the cached session when
  the last check is inside the offline grace window. The call does not use the cache for `401`,
  `403`, or `404`. The default grace window is seven days. The expiry of the cached session is
  the end of the grace window.
- The session is offline-unverified after the token expiry. The next network call must confirm
  the session. A `401` on the flush must pause the outbox and ask for a login.
- `writeSessionCache` removes the old record when the user id changes. `clearSessionCache`
  removes the record on logout.
- The refresh timer fires 60 seconds before `expiresAt`. `refreshDelayMs` returns the delay.
- `createRefreshCoordinator` runs one refresh across tabs. It uses `navigator.locks` when the
  browser provides it. The fallback is a storage mutex with a time limit.
- The adapter sends each new session through `createSessionChannel`. The channel uses
  `BroadcastChannel`. The fallback uses a storage event. A tab applies the event without a new
  network call. A tab that misses the event calls `getSession` on its next mount.
- The login path is client side. When the API is same-origin with the SPA, `login` sends
  `LoginOptions.returnTo` as the rust-api `return_to` query parameter. For a cross-origin API,
  `login` stores the path in session storage instead. `SessionProvider` removes the value and
  opens the path after a successful login.
- The cache stores metadata only. Do not store the token in local storage.

### Logout reset

- `resetSession` in `src/lib/auth/reset.ts` runs the logout reset in a fixed
  order: outbox check, tables, report cache, runtime caches, session cache,
  logout. The default tables are `sync_state` and `quarantine`. The outbox is not
  in the list, so an unsent write stays.
- A `pending` or `sending` outbox row blocks the reset. The result is
  `outbox_pending` and no clear step runs.
- A failed step does not stop the later steps. The reset reports the first
  failure after every step runs.
- `clearRuntimeCaches` removes every cache name that does not start with
  `workbox-precache`. The precache that holds the app shell stays.
- `useSafeLogout` calls `resetSession` and exposes `running` and `error`.
  `useSessionReset` runs the same reset when the user id changes. It does not
  clear the session cache and does not log out.

## System: outbox and queue

- The outbox components are in `src/components/outbox`. The queue components
  are in `src/components/queue`. The shared `JsonView` and `DetailFields`
  components are in `src/components/shared`.
- The `/system` composition page is in
  `src/components/system/system-page.tsx`. The `/system` route is in
  `src/routes/_dashboard/system.tsx`. The dashboard sidebar has a `System`
  link before the `Setting` link.
- `OutboxView` shows the outbox rows, the state counts, the search box, the
  state filter, and the detail sheet. `QueueView` shows the queue rows, the
  state counts, the search box, the state filter, and the detail sheet.
- The outbox has the global `flush` and `resume` actions. `flush` calls
  `worker.outbox.flush()`. `resume` calls `worker.outbox.resume()`. The view
  shows the paused state and the sign-in-required state. The sign-in link opens
  `/login`.
- The outbox has no per-item retry, delete, or cancel action. A failed or
  conflicted row stays in the list until a handler or an operator resolves it.
- The queue has the per-job `pause`, `resume`, and `cancel` actions. They call
  `worker.queue.pause(id)`, `worker.queue.resume(id)`, and
  `worker.queue.cancel(id)`. The cancel action asks for confirmation first.
- The queue stores the live jobs. `useQueueJobs` reads `worker.queue.watch()`.
  The stream sends the first snapshot, then each change. The list updates
  without polling.
- `useOutboxOps` reads `worker.outbox.watch()` and reloads the list after each
  status change. The hook calls `worker.outbox.list()` on mount.
- Run the system tests with `npm run test:run`.

## Announcements

- The `/system` page has an `Announcements` tab. The tab shows the announcement archive.
- The table lists the seed catalog and the custom announcements.
- A row opens a read-only detail sheet with the full content. A hidden announcement stays in the table and the sheet.
- The `New announcement` form has a `Show as` dropdown and one `Create and show` button. The dropdown selects a lightbox or a banner. The default is a banner.
- Custom announcements persist under `state-announcement_catalog` in `localStorage`.
- The table uses a fixed layout. Long content truncates with an ellipsis. The table hides the secondary columns on small screens.
- `src/components/announcement/data.ts` holds the seed catalog. An application can replace the list with its own data source.
- The form uses the existing `Dialog` primitive. The lightbox uses the existing `Dialog` primitive. The banner uses the existing `Alert` primitive. The feature adds no new UI primitive.
- `Hide for later` snoozes the announcement for 24 hours. The announcement returns when the snooze ends.
- `Got it` dismisses the announcement. A dismissed announcement does not return.
- The delivery state is stored under `state-announcement_delivery` in `localStorage`.
- `AnnouncementHost` renders the active announcement one time in the dashboard shell. A banner shows in the page flow. A lightbox shows in a dialog with a blurred backdrop.

## Replica reader

- The generic reader is in `src/lib/sync`. The reader has no domain type.
- `createReplicaReader` accepts a `ReplicaTransport`. An adapter implements the transport for one
  backend. A test can give a fake transport.
- `status` returns `appliedSeq`, `head`, and `pending`. The call does not advance the replica.
- `advance` advances the replica and returns the new status.
- `manifest` returns the object list. Each entry has a key, an ETag, and an optional size. The
  reader does not interpret the data.
- `readObject(key, { etag })` sends a conditional request when the caller gives an ETag. The
  function returns `{ kind: "object", object }` with the bytes and the ETag. The function returns
  `{ kind: "not-modified", etag }` for a 304 response.
- The ETag is an opaque string. The reader does not parse the value.
- The interface names no backend path and no manifest rule. The adapter owns these details.
- The reader rejects an empty key, an empty ETag, a 304 response without an ETag, and an object
  without an ETag.

```ts
import { createReplicaReader } from "@/lib/sync";

const reader = createReplicaReader(transport);
const status = await reader.status();
const result = await reader.readObject("primary", { etag: localEtag });
```

### Change feed

- `src/lib/sync/changes.ts` defines `ChangeFeed.pull({ scope, since, limit? })`.
- A page has `rows`, `next`, `hasMore`, `oldestSeq`, and `serverTimeMs`. A row
  has `table`, `key`, `seq`, `deleted`, and `value`. The `next` value is the
  exclusive cursor for the next call.
- The transport throws `ChangeFeedError` with `reason: "resync_required"` when
  the server returns status 410.
- The worker exposes `changes.applyPage` and `changes.state`. `applyPage` writes
  the page rows and the cursor in one transaction.
- A `since` value below `oldestSeq` returns `resync_required`. A `page.next` below
  `since`, or a full page with no advance, returns `rejected`.
- An unknown table or an invalid row goes to the `quarantine` table. The result
  reports `applied`, `deleted`, and `quarantined` counts.
- `state(scope)` returns the stored `sync_state` cursor or null.

## File transport

- The contract is in `src/lib/fs`. The contract has no storage path and no domain type.
- `FileTransport` defines `init`, `uploadPart`, `complete`, `cancel`, `progress`, `metadata`,
  `download`, and `delete`.
- `FileId` is opaque. The transport does not interpret the value.
- `FileTransport<TMetadata>` accepts one application metadata type. The default type is
  `FileMetadata`, which has a `name` and a `mimetype`.
- The shared schema is in `src/lib/fs/schema.ts`. The worker uses the same schema.
- For one part, the part size equals the file size, which is at most 10 MiB.
  For more parts, the part size is a multiple of 1 KiB and at most 512 KiB.
  The part count is `ceil(file_size / part_size)` and must not be larger than
  10,000. Every part except the last part has `part_size` bytes. The last part
  has the remaining bytes. Do not pad the last part.
- The schema error messages start with `The upload failed.` A user can read the cause.

```ts
import type { FileTransport } from "@/lib/fs";

const transport: FileTransport = createTransport();
const partSize = 512 * 1024;
const totalParts = Math.max(1, Math.ceil(blob.size / partSize));
const upload = await transport.init({
  file_size: blob.size,
  part_size: totalParts === 1 ? blob.size : partSize,
  file_total_parts: totalParts,
});

for (let index = 0; index < upload.totalParts; index += 1) {
  await transport.uploadPart(
    {
      file_id: upload.id,
      file_total_part: upload.totalParts,
      file_part: index,
    },
    blob.slice(index * partSize, (index + 1) * partSize),
  );
}

const file = await transport.complete(upload.id, {
  name: "report.pdf",
  mimetype: "application/pdf",
});
```

For a single-part upload, set `part_size` to `file_size` and set `file_total_parts` to 1.

## Report client

- The generic client is in `src/lib/report`. `createReportClient` takes a
  `transport`, a file transport, and an optional cache.
- `create(input)` starts one job and returns `{ id }`. `get(id)` returns the job
  state. `run(input)` reads the cache. On a miss it starts the job, polls it,
  and downloads the artifact.
- The poll waits `[1000, 2000, 4000, 8000, 15000]` ms. It stops after 10 minutes
  and returns a failed job with code `timeout`.
- `createReportCache` uses `idb-keyval`. It stores one artifact by report id and
  month, plus a month index by site. The cache keeps the blob and the file
  record.
- `useReport(client)` returns `state`, `job`, `blob`, `start`, and `abort`. It
  aborts the run when the screen closes.
- `run` accepts an `AbortSignal` and an `onJob` callback. An empty month fails
  before the request.

## rust-api adapter

- The adapter is optional. The code is in `src/rust-api`. The core imports one module,
  `src/rust-api/optional.tsx`.
- `src/rust-api/optional.tsx` reads `VITE_RUST_API_ENABLED` at module load. The switch accepts
  `1`, `true`, `yes`, or `on`. When the switch is off, the core loads no adapter chunk and sends
  no request.
- When the switch is on, `RustApiMount` loads `src/rust-api/main/mount.tsx` with a dynamic import.
  The module creates one backend at module scope with `createRustApiBackendIfEnabled()`.
  The mount wraps the router in `RustApiSessionBoundary`. The `Suspense` fallback is null.
- The login route uses `RustApiLoginPanel` from the same optional module. The panel lazy-loads
  `RustApiAuthCard` from `src/rust-api/main/auth-ui.tsx`. The panel returns null when the switch is off.
- `src/rust-api/shared` holds the runtime-agnostic modules. It has the client, config, sync,
  files, and the generated wire types. The main and worker composition roots use these modules.
- `src/rust-api/main/backend.ts` is the browser composition root. `createRustApiBackend` creates
  one client and one token store. The `session`, `replica`, and `files` adapters use the shared client.
- `src/rust-api/worker/backend.ts` is the worker composition root. `createRustApiWorkerBackend`
  creates one client and one token store. The `replica` and `files` adapters use the shared client.
  `src/worker/main.ts` does not expose rust-api yet.
- `src/rust-api/index.ts`, `shared/index.ts`, `main/index.ts`, and `worker/index.ts` are barrels.
- The adapter reads the base URL from `VITE_RUST_API_BASE_URL`. The default is
  `http://localhost:8080`. `/` means the SPA origin, which the Vite dev proxy uses.
  The client strips a trailing slash.
- The client sends `credentials: "include"` on every call. The rust-api `auth_token` cookie
  is the primary credential. The client can also send a bearer token from an in-memory store.
- The adapter has no task logic. It does not import `src/examples`.
- `createRustApiClient` accepts a base URL, a fetch function, and a token store. A test can
  give a fake fetch.
- The generated wire types are in `src/rust-api/shared/generated`. The rust-api
  repository does not commit an OpenAPI document at the inspected commit. The types come from
  the route definitions and the response structs. The module names the commit and the
  regeneration command.
- To regenerate from a live server, run:

  ```bash
  curl -s http://localhost:8080/openapi.json -o /tmp/rust-api-openapi.json
  npx openapi-typescript /tmp/rust-api-openapi.json \
    -o src/rust-api/shared/generated/openapi.d.ts
  ```

### Main composition root

```ts
import { createRustApiBackend } from "@/rust-api/main/backend.ts";

const backend = createRustApiBackend();

const session = await backend.session.getSession();
const status = await backend.replica.status();
const file = await backend.files.metadata("file-id");
```

The boundary gives the same backend object to route components. The hook returns null
when the switch is off.

```tsx
import { useRustApiBackend } from "@/rust-api/main/boundary.tsx";

function ReplicaStatus() {
  const backend = useRustApiBackend();

  if (backend === null) return <span>Rust API is off</span>;

  return <span>{backend.client.baseUrl}</span>;
}
```

The factory accepts `env`, `baseUrl`, `fetch`, `tokens`, and `session` options.
A test can give a fake environment and a fake fetch.
`createRustApiBackendIfEnabled` returns null when `VITE_RUST_API_ENABLED` is off.

### Worker composition root

```ts
import {
  createRustApiWorkerBackend,
  createRustApiWorkerBackendIfEnabled,
} from "@/rust-api/worker/backend.ts";

const backend = createRustApiWorkerBackend();

const status = await backend.replica.status();
const file = await backend.files.metadata("file-id");
```

The worker factory accepts `env`, `baseUrl`, `fetch`, and `tokens` options.
`createRustApiWorkerBackendIfEnabled` returns null when the switch is off.
`src/worker/main.ts` does not expose rust-api yet. A later issue can add the worker boundary.

### Session provider

- `createRustApiSessionProvider` implements the core `SessionProvider` contract.
- `login` sends the browser to `GET /auth/login`. When the API and the SPA share an origin and
  `LoginOptions.returnTo` is a safe relative path, the URL includes
  `return_to=<encoded path>`. The callback sets the cookies and returns `302` to the path.
  Without `return_to`, the callback returns an `AuthResponse` JSON body.
- The adapter sends `return_to` only for a same-origin API. The relative `302` uses the API
  origin. For a cross-origin API, `login` keeps the path in session storage and opens
  `/auth/login` without `return_to`. The callback shows JSON on the API origin, and the user
  must return to the SPA manually. `SessionProvider` opens the stored path on the next mount.
  The browser origin is the default. The `spaOrigin` option sets a different SPA origin.
- The adapter rejects an unsafe return path before it sends the query. The server returns `400`
  for the same values.
- `getSession` calls `GET /auth/me`. The adapter maps `sub` to the user id and `exp` seconds to
  `expiresAt` milliseconds. A `401` response returns null.
- `refresh` calls `POST /auth/refresh`. The browser sends the `refresh_token` cookie. The
  adapter stores the new token and reads the session again. A rejected refresh returns null.
  The refresh runs one time across tabs.
- `logout` calls `POST /auth/logout`, clears the in-memory token, and clears the session cache.
  The server clears `auth_token` and `refresh_token` and starts a best-effort revocation. The
  adapter needs no extra call for the revocation.
- `getSession` keeps session metadata in the cache. It falls back to the cache when the network
  fails and the record is inside the seven-day grace window.
- A refresh in one tab sets a new cookie. The tab sends the new session through the channel.
  The other tabs apply the new session. A tab that misses the event calls `getSession` on its
  next mount.

```ts
import { createRustApiBackend } from "@/rust-api/main/backend.ts";

const backend = createRustApiBackend();
const provider = backend.session;
```

### Replica reader

- `createRustApiReplicaReader` implements the core `ReplicaReader` contract.
- `status` calls `GET /sync/status`. The adapter caches the body and the `ETag`. The next
  call sends `If-None-Match`. A `304` response returns the cached status.
- The status has no `pending` field. The adapter sets `pending` when `applied_seq` is null
  or when `applied_seq < head`. A null `applied_seq` means that no build ran. The adapter
  reports this state as `appliedSeq: 0` with `pending: true`, because the first advance must
  run before `manifest.json` exists.
- `advance` calls `POST /sync/sync` one time. The adapter caches the response `ETag`. The
  next call sends `If-None-Match`. A `304` response reads the current head and returns the
  cached advance result. The advance `ETag` does not cover `head`.
- The upstream `pending` flag means that a full rebuild is queued. The reader `pending` flag
  means that the replica has changes to apply. The adapter sets `pending` when either
  condition is true: the upstream flag is true or `applied_seq < head`. The adapter reads the
  current head from `/sync/status`. The caller repeats the call while `pending` is true.
- `manifest` calls `GET /sync/db/manifest.json`. The adapter keeps the `sst` order and the
  `wal` order. It does not sort or filter the entries.
- The manifest has no per-object ETag. The adapter uses a version token. The transport keeps
  the real `ETag` from each successful object read. A later read uses the real `ETag` when
  the caller gives the version token or no `ETag`. An explicit real `ETag` from the caller
  wins.
- The adapter sends the cached real `ETag` for an immutable object. The server can then
  return a `304` response without a body. The immutable keys are `e*/sst/*`, `e*/wal/*`,
  and `e*/blob/*`.
- `readObject` calls `GET /sync/db/{object}`. The adapter sends `If-None-Match` when it has
  an `ETag` to send. A `304` response returns a not-modified result.
- The adapter keeps the manifest rules. The core reader stays generic.

```ts
import { createRustApiBackend } from "@/rust-api/main/backend.ts";

const backend = createRustApiBackend();
const status = await backend.replica.status();
```

### File transport

- `createRustApiFileTransport` implements the core `FileTransport` contract.
- `init` calls `POST /fs/uploads`. The adapter validates the declaration with the shared
  schema before the request.
- The server accepts a shorter last part. Every part except the last part has `part_size`
  bytes. The last part has `file_size - (file_total_parts - 1) * part_size` bytes. The
  server rejects a padded last part with status `400`.
- The server rejects a multipart part count above 10,000 and a part size above 512 KiB.
- `uploadPart` calls `PUT /fs/uploads/{id}/parts/{index}` and sends the part as raw bytes.
- `complete` calls `POST /fs/uploads/{id}/complete` and then reads `/fs/files/{id}/meta`.
- `cancel` calls `DELETE /fs/uploads/{id}`.
- `progress` calls `GET /fs/uploads/{id}`.
- `metadata` calls `GET /fs/files/{id}/meta`. A `404` response returns null.
- `download` calls `GET /fs/files/{id}`. A start or end value adds a `Range` header. The
  adapter maps `206` to a partial blob and `416` to a clear error.
- `delete` calls `DELETE /fs/files/{id}`.
- The transport does not attach a file to a domain row. That rule belongs to the application.

```ts
import { createRustApiBackend } from "@/rust-api/main/backend.ts";

const backend = createRustApiBackend();
const transport = backend.files;
```

## Dark mode

- The hook `useSystemDarkMode` detects the theme with the `prefers-color-scheme` media query.
  The config context stores the theme and locale preferences. The settings page lets the user
  edit them.

## Testing

- Vitest 5 uses `src/vitest.setup.ts`. The storage tests use fake-indexeddb. Tests live
  next to their modules, such as `src/worker/db/*.test.ts`.
- Run tests with `npm run test`.

## Add a coss ui component

The coss ui registry name is `@coss`. Run this command to add a component:

```bash
npx shadcn@latest add @coss/button
```

The `utils` alias in `components.json` is `@/lib/utils`. `src/lib/utils/cn.ts`
re-exports `cn` from `cnfast`. `src/lib/utils.ts` re-exports `cn` from
`src/lib/utils/cn.ts`. Existing code imports `@/lib/utils/cn.ts`. Generated
components import `@/lib/utils`. Both paths use the same helper.

The `hooks` alias in `components.json` is `@/hooks/primitives`. Generated hooks import
from that directory.

Do not run `npx shadcn@latest add @coss/ui --overwrite`. Local edits exist in
`src/components/ui/scroll-area.tsx` and `src/components/ui/sidebar.tsx`.

The `@coss/utils` registry item can try to write `src/lib/utils.ts`. It can also
add the `clsx` and `tailwind-merge` dependencies. Keep the existing re-export. Do
not pass `--overwrite`.

## File upload

The component is in `src/components/upload/file-upload.tsx`. The hook is in
`src/hooks/primitives/use-file-upload.ts`. The source registry item is
`https://coss.com/origin/r/comp-552.json`.

The component supports drag and drop and a file picker. It shows preview cards
for each file. It applies a maximum file count, a maximum file size, and accept
rules. It can remove one file or clear all files.

The progress overlay covers only the preview. The file name, the file size, and
the error text stay visible.

The per-file remove button cancels one upload. The app cancels the upload
transport when the file leaves the list through `onFilesChange`.

The component does not upload files. The app owns the upload. The app starts one
upload for each new file from `onFilesAdded` or `onFilesChange`. The app sets
`progressByFileId[id]` from 0 to 1. The app sets `errorsByFileId[id]` when one
upload fails. The app owns the actual upload calls and sets the progress values.

The props:

- `initialFiles`: the files at the first render.
- `maxFiles`: the maximum file count. The default is 6.
- `maxSize`: the maximum file size in bytes. The default is 5 MB.
- `accept`: the input accept rule. The default is `*`.
- `multiple`: allow more than one file. The default is `true`.
- `disabled`: disable the input and the buttons.
- `busy`: disable add and select while an upload runs. The remove action stays
  available. The default is `false`.
- `progressByFileId`: the progress for each file id. A value from 0 to 1.
- `errorsByFileId`: the upload error for each file id.
- `name`, `id`, and `className`: the input name, the input id, and the root
  class.
- `onFilesChange`: run when the file list changes.
- `onFilesAdded`: run when the user adds files.

The `toFileMetadata` helper returns only `id`, `name`, `size`, and `type` for
each file. The `uploadsComplete` helper reports true when every file has
progress 1. An empty list returns true.

This example disables the submit button until every upload completes:

```tsx
const ready = uploadsComplete(files, progressByFileId);

<FileUpload
  busy={!ready}
  onFilesChange={setFiles}
  progressByFileId={progressByFileId}
/>
<Button disabled={!ready} onClick={() => submit(toFileMetadata(files))}>
  Save
</Button>
```

The stories run with `npm run ladle`. The tests run with `npm run test:run`.

## Image thumbnail

The component is in `src/components/image/thumbnail/index.tsx`.

`ImageThumbnail` shows an image as a button. A hover or a keyboard focus shows
a ghost overlay with an eye icon. The eye icon tells the user that the image
opens in a larger view. A touch device has no hover, so the overlay always
shows there. A click or a keyboard activation opens `ImageView` with the same
image.

The props:

- `src`: the image source.
- `alt`: the image alt text. The component also uses it for the button name.
- `maxZoom`: the maximum zoom. The default is 2.
- `downloadName`: the file name for the download action. The default is `image`.
- `open`: the open state. The component owns the state when you omit it.
- `onOpenChange`: runs when the open state changes.
- `className`: the root class.
- `imageClassName`: the image class.

The component owns the open state by default. Set `open` and `onOpenChange` to
control the state.

This example uses the uncontrolled state:

```tsx
<ImageThumbnail alt="Report" className="max-w-xl" src={src} />
```

This example uses the controlled state:

```tsx
const [open, setOpen] = useState(false);

<ImageThumbnail alt="Report" onOpenChange={setOpen} open={open} src={src} />;
```

The stories run with `npm run ladle`. The tests run with `npm run test:run`.

## Image view

The component is in `src/components/image/view/index.tsx`.

`ImageView` shows one image in a lightbox. The backdrop is blurred. The image
is in the center. The image keeps its aspect ratio. At the base zoom, the image
fits in 80% of the viewport. The default maximum zoom is 2x. The close button
is a default button that stays at the top right. The zoom controls stay at the
top left. The zoom controls have no border or shadow. The download button is an
outline button that stays at the center bottom. The download uses the image
source. The component does not fetch or transform the image. The dialog handles
focus, Escape, and the page scroll lock.

The props:

- `src`: the image source.
- `alt`: the image alt text.
- `open`: the open state.
- `onOpenChange`: runs when the open state changes.
- `maxZoom`: the maximum zoom. The default is 2.
- `downloadName`: the file name for the download action. The default is `image`.
- `className`: the root class.

This example uses the controlled state:

```tsx
const [open, setOpen] = useState(false);

<img alt="Report" src={src} onClick={() => setOpen(true)} />
<ImageView
  alt="Report"
  onOpenChange={setOpen}
  open={open}
  src={src}
/>
```

The stories run with `npm run ladle`. The tests run with `npm run test:run`.

## Component previews (Ladle)

- Each component has a `stories.tsx` file. Ladle serves stories in `src/components` and
  `src/examples`. The configuration is in `.ladle/`. Run `npm run ladle` to open the
  previews.

## Bundle Analysis

- The project includes rollup-plugin-visualizer. Run `npm run build`, then check the
  generated report to reduce the bundle size.
- The build groups vendor dependencies into chunks: react, router, tanstack-ui, visuals,
  effect, database, worker, pwa, otel, and util. See `VENDOR_GROUPS` in `vite.config.ts`.

## Observability (OpenTelemetry)

The app uses browser OpenTelemetry. The SDK records traces, metrics, and logs. It exports the
data through OTLP/HTTP to any collector.

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
- Your collector must allow CORS from the app origin.

## Development tips

- Routes are generated into `routeTree.gen.ts`. Add route modules under `src/routes`. The
  TanStack Router vite plugin regenerates the tree automatically. The plugin also splits the
  code automatically.
- Use the `WorkerProvider` context to access the worker API (`changes`, `db`, `fs`,
  `outbox`, `queue`). Put the heavy logic in the worker. The UI stays responsive.
- Build new features from the primitive hooks in `src/hooks/primitives`. Compose the hooks
  into engine hooks in `src/hooks/engines`.
- Use the path alias `@/` for shorter imports.
- The file `mise.toml` pins the tool versions. The tools are Node, the Tailwind
  language server, and the shadcn CLI.

## Deployment recommendations

- Run `npm run build` and deploy the static assets to a static host with HTTPS. The hosts
  are Netlify, Vercel, GitHub Pages, and S3 with CloudFront.
- Configure the service worker scope and the asset serving headers. Then the precaching
  works as expected.
- The project runs in a browser. The type definitions cover Node.js and Bun.

## Contributing

Contributions are welcome. Use this workflow:

- Fork the project and create a feature branch.
- Keep the changes small and focused. Update or add the tests where it matters.
- Run `npm install`, `npm run check`, `npm run fmt:check`, `npm run lint`, and
  `npm run test` before you open a PR.
- Add a PR description that explains the change and the benefit.

## License

MIT.
