## PeteZahGames — Copilot instructions for automated coding agents

These notes help AI coding agents get productive quickly. Keep edits small,
preserve runtime behavior, and prefer modifying the minimal surface area.

High-level architecture

- Hybrid app: a small Express server (`server.js`) serves static assets from
  `public/` and exposes API endpoints under `/api/*` implemented in
  `server/api/*.js`.
- Static-first UI: most UI is served directly from `public/`. There is also an
  Astro-based source in `src/` (components and pages) used for more structured
  front-end work—edit `public/` for quick fixes, `src/` for component-level
  changes (see [src/pages/index.astro](../src/pages/index.astro)).
- Service-worker proxying and transports: `server.js` mounts transports and
  routes for `/bare/`, `/baremux/`, `/epoxy/`, and `/scram/`. The service worker
  and related proxy logic live in `public/sw.js` and
  `public/petezah/rizz.sw.js`.
- Supabase-backed auth/storage: auth handlers live under `server/api/` and
  `server.js` uses express-session; session fields `req.session.user` and
  `req.session.access_token` are relied upon across handlers.

Developer workflows & key commands

- Node + package manager: project uses `type: module` and targets Node >= 22.
  Use `pnpm` (pnpm manifests present). Typical flow:
  - `pnpm install`
  - `pnpm start` (Procfile and start expect `node server.js`).
- There is no generic `pnpm build` script by default—many deploy configs
  reference a build step but do not require it. If you add a build step,
  document it and update deployment files (`Procfile`, `Dockerfile`).
- Environment vars: `SUPABASE_URL`, `SUPABASE_KEY`, and `SESSION_SECRET` are
  required for auth flows; examples are present in `railway.json` /
  `netlify.toml`.

Project-specific conventions

- Static-first edits: prefer `public/` for immediate UI changes. For structured
  UI work (components, SEO metadata) edit the Astro sources in `src/`.
- Proxy + SW consistency: when you change proxy routes in
  [server.js](server.js#L1), update `public/sw.js` and any files under
  `public/scram/` or `public/baremux/`.
- API pattern: add new handlers in `server/api/` (export a function) and
  register them in `server.js` with the appropriate route (see
  [server/api/signin.js](server/api/signin.js#L1)).

Integration points & notable files

- Server entry: [server.js](server.js#L1)
- API handlers: [server/api/\*.js](server/api/signin.js#L1)
- Static UI: [public/](public/index.html#L1) (including `petezah/`, `youtube/`)
- Astro sources: [src/](src/pages/index.astro#L1) (components under
  `src/components/`)
- Service workers & transports: [public/sw.js](public/sw.js#L1),
  [public/petezah/rizz.sw.js](public/petezah/rizz.sw.js#L1)
- Deploy manifests: `Dockerfile`, `Procfile`, `cloudbuild.yaml`, `netlify.toml`,
  `render.yaml`.

Editing examples

- Add API route: create `server/api/your-route.js` exporting a handler, then
  register with `app.post('/api/your-route', handler)` in
  [server.js](server.js#L1).
- Quick UI fix: edit the file under `public/pages/` or `public/static/` and
  reload the server—no build required for most changes.

Safety, testing, and debugging

- Run locally: `pnpm install` then `pnpm start` and visit
  `http://localhost:3000`.
- Inspect these places when debugging: `server.js`, `server/api/*.js`,
  `public/sw.js`, and `public/pages/`.
- Migration & utility scripts: `scripts/migrateimages.js` and
  `server/migrate-supabase.js`—review before running.

Gotchas

- Do NOT commit secrets; use the placeholders in `railway.json` /
  `netlify.toml`.
- Service worker and proxy routes are tightly coupled—update both together.
- Avoid adding a `build` script unless you update deployment manifests.
