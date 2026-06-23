# React PWA Starter

A batteries-included, TypeScript-first starter for building fast,
offline-capable React applications with Vite. It combines a modern stack (Vite +
React 18 + TypeScript) with PWA support, a Comlink web worker layer, i18n,
client-side persistence (Dexie), and a pragmatic routing + UI setup so you can
bootstrap production-ready apps quickly.

Why use this starter?

- Instant PWA behavior with service-worker lifecycle helpers and a smooth "new
  content available" UX.
- Worker-first patterns (Comlink) for costly work and offline data sync.
- Ready-made i18n and Zod integration for validation + localized error messages.
- Opinionated, extensible structure for routes, components, and features.

Features

- Vite + TypeScript + React 18
- Progressive Web App (service worker via vite-plugin-pwa + workbox-window)
- Comlink-powered Web Worker (worker isolation + API surface)
- Dexie (IndexedDB) inside worker for offline-first persistence
- i18next for translations with language sync into Zod validation messages
- TanStack Router (routeTree generated) for type-safe routing
- Tailwind CSS + utility-first styling + shadcn components
- Testing with Vitest
- Story-like component preview via Ladle

Quick start

Prerequisites

- Node 18+ (or your preferred modern Node)
- Git

Install and run locally

```bash
git clone https://github.com/azamaulanaaa/react-pwa-starter.git
cd react-pwa-starter
npm install
npm run dev           # start dev server (Vite)
```

Notable dependencies

- react, react-dom — UI
- vite, @vitejs/plugin-react-swc — build/dev
- vite-plugin-pwa, workbox-window — PWA/service worker
- comlink, vite-plugin-comlink — worker communication
- dexie — IndexedDB helper for offline persistence
- i18next, i18next-http-backend — translations
- @tanstack/react-router — routing
- zod — schema validation (with localization sync)
- tailwindcss, shadcn, lucide-react — styling & UI primitives
- vitest — test runner

Service worker & update UX

- The app uses registerSW (virtual:pwa-register). When a new release is
  available the onNeedRefresh callback shows a confirm prompt; if the user
  accepts, the page reloads to activate the new SW.
- For production deployments make sure the site is served over HTTPS and the
  build assets are deployed in a manner compatible with your SW's precaching
  strategy.

Workers and offline persistence

- The app creates a Comlink worker at src/components/worker_context.tsx.
- Long-running or blocking operations (DB access, sync) are routed through the
  worker; db.ts provides a Dexie schema for offline data.
- Worker APIs are exposed as remote objects; use the provided WorkerProvider and
  useWorker() hook to interact with them.

Internationalization & validation

- The project uses i18next and includes an i18n provider component.
- When the language changes the code calls syncZodLocale to keep Zod validation
  messages localized.
- i18n strings can be extracted with the included npm run i18n task.

Testing

- Vitest is configured and a setup file exists at src/vitest.setup.ts.
- Run tests with npm run test.

Development tips

- Routes are generated into routeTree.gen.ts. Add or update route modules under
  src/routes and regenerate the tree (the repo uses a generator step).
- Use the WorkerProvider wrapper to access worker methods. Keep heavy logic
  inside the worker to keep the UI responsive.
- For new translations add keys and run npm run i18n to extract strings, then
  provide translations for desired locales.

Deployment recommendations

- Build static assets (npm run build) and deploy to any static host that
  supports HTTPS (Netlify, Vercel, GitHub Pages with HTTPS, S3 + CloudFront).
- Ensure service worker scope and asset serving headers are configured correctly
  so precaching works as expected.

Contributing Contributions are welcome. Suggested workflow:

- Fork and create a feature branch.
- Keep changes small and focused; update or add tests where relevant.
- Run the test suite and the dev server to verify behavior:
  - npm install
  - npm run dev
  - npm run test
- Add a meaningful PR description describing the change and why it helps.

Questions you might ask

- Where is the route generation configured and how do I add nested routes?
- How does the worker API look (method names / signatures) and where is it
  documented?
- Which Dexie schema does db.ts expose and what indexes exist for syncing?

License Include a license file to clarify terms (MIT recommended for starters).
