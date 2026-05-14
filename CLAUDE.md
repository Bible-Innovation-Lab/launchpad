@AGENTS.md

# Build notes for AI assistants

This repo is the **source for the `@bil/launchpad` npm package**, not a
student template. Students consume this package from
[`Bible-Innovation-Lab/bil-app-template`](https://github.com/Bible-Innovation-Lab/bil-app-template).
Read `README.md` for the consumer-facing view; this file captures the
patterns + invariants that keep the package healthy.

## What ships from here

`@bil/launchpad` is TypeScript source — consumers transpile via Next.js's
`transpilePackages`. No build step in this repo; we ship `.ts` directly.
`withLaunchpad(nextConfig)` (re-exported from `src/config/next.ts`) sets
`transpilePackages: ["@bil/launchpad"]` so students never touch it.

Subpath exports (see `package.json` `exports` map):

- `@bil/launchpad/proxy` — `proxy` function + `config` matcher
- `@bil/launchpad/bible` — `getVerse`, `getRange`, `getDailyVerse` (YouVersion)
- `@bil/launchpad/analytics/{server,client,page-view-tracker}` — PostHog forwarder + 1KB beacon + auto-page-view layout component
- `@bil/launchpad/share/{client,server}` — Wordle grid + OG cards
- `@bil/launchpad/routes/{track,bible,og,health}` — pre-made App Router handlers
- `@bil/launchpad/config/next` — `withLaunchpad`
- `@bil/launchpad/examples/*` — copy-paste components (NOT imported; students copy)

`src/modules/{auth,push}/` are copy-paste scaffolds with their own peer-deps.
They are excluded from typecheck on purpose (see `tsconfig.json` `exclude`).

## Next.js 16 specifics

**Middleware is now Proxy.** The file in a student app is `proxy.ts` at the
project root and exports a `proxy` function. Students do:

```ts
import { proxy } from "@bil/launchpad/proxy";
export default proxy;
export const config = { matcher: [...] };
```

Next 16 requires `runtime` and `config` to be **literal exports in the
route/proxy file** — they cannot be re-exported through a package. Same
for `proxy as default` (Next 16 wants the literal function). The
verification commit `9c40b21` (in a throwaway app) confirmed:

- ✅ `import { proxy } from "@bil/launchpad/proxy"; export default proxy;`
- ❌ `export { proxy as default } from "@bil/launchpad/proxy";`
- ✅ `export const runtime = "edge";` (literal in route file)
- ❌ `export { runtime } from "@bil/launchpad/routes/...";`

Keep this in mind when adding new pre-made routes or modifying `proxy/index.ts`.

## File-by-file map

- `src/proxy/index.ts` — proxy function + matcher. Bot filter →
  anon-cookie mint → one-shot `_lp_fv` first-visit signal.
- `src/bible/server.ts` — YouVersion Platform API wrapper. Top-level facade
  uses module-singleton client; factory `createYouVersionClient` exists for
  tests. Header is `X-YVP-App-Key`. `bible_id` is hard-coded to `111` (NIV
  2011). Returns `Passage = { id, reference, content }`.
- `src/bible/server.test.ts` — 21 unit tests with stubbed `fetch`. Run with
  `bun src/bible/server.test.ts`.
- `src/analytics/server.ts` — PostHog forwarder. Hard-gated to
  `NODE_ENV=production`. Exports `capture`, `parseUA`.
- `src/analytics/client.ts` — ~1KB `track(event, props?)` beacon. POSTs to
  `/api/v1/track` (versioned path). Fire-and-forget, never throws.
- `src/analytics/page-view-tracker.tsx` — `<PageViewTracker />` client
  component. Students render it once in `app/layout.tsx`; fires
  `page_view` with `{ path }` on mount + every client-side route change.
  Pairs with the proxy's `_lp_fv` first-visit signal so a fresh app gets
  both `first_visit` + `page_view` with zero student wiring.
- `src/share/client.ts` — `renderShareGrid` (canvas), `shareResult` (native
  share → clipboard fallback), `shareText`. NO spoilers in `shareText`
  output by design.
- `src/share/server.tsx` — `@vercel/og` OG card. Aggressively cached.
- `src/routes/track.ts` — POST handler for `/api/v1/track`. Reads `_lp_aid`,
  enriches with geo+UA, calls `capture`. Emits `first_visit` before inbound
  event when `_lp_fv=1` is set.
- `src/routes/bible.ts` — GET handler for `/api/v1/bible/[ref]`. Returns
  Passage JSON. Maps `BibleRefError` → 400, `YouVersionError` → 404/502.
- `src/routes/og.tsx` — generic 1200×630 OG card. Students re-export `GET`
  from this and add `export const runtime = "edge"` literally.
- `src/routes/health.ts` — `{ status: "ok", app_id, ts }`.
- `src/config/next.ts` — `withLaunchpad`. Adds `transpilePackages`, BIL
  security headers (HSTS, X-Frame-Options, etc.), asserts `APP_ID`,
  `POSTHOG_KEY`, `YOUVERSION_API_KEY` at build time in production.
- `src/examples/*` — `VerseOfDay`, `TrackedButton`, `ShareResult`.
  Copy-paste starting points. NOT importable as a runtime API surface.
- `src/modules/{auth,push}/` — opt-in scaffolds. Excluded from typecheck;
  they have their own peer-deps that the student installs.
- `docs/PRD.md` — platform requirements.
- `docs/youversion-mapping.md` — API integration brief.

## Canonical patterns

**Add a new pre-made route:**

1. Create `src/routes/<name>.ts` exporting `GET` / `POST` etc.
2. Add `"./routes/<name>": "./src/routes/<name>.ts"` to `package.json`
   `exports`.
3. Document in `README.md` table.
4. Remember: students re-export, so any `runtime`/`config` must be literals
   in the student's `route.ts`, not in this package.

**Add a new module under bible/share/analytics:**

1. New file under `src/<area>/<name>.ts`.
2. Add subpath export in `package.json`.
3. Add test next to it (`<name>.test.ts`) — they run with `bun`.
4. Update `README.md` table.
5. `bun run smoke` before commit.

**Touch the proxy:**

The matcher lives in `src/proxy/index.ts` but students still need a literal
`config` in their `proxy.ts`. Keep the matcher example in `README.md` in
sync if you change defaults.

**Versioning + release:**

Bug fixes + new features land here; students get them via
`bun update @bil/launchpad`. Breaking changes require coordinating a
template-repo update too. SemVer applies — `0.x.y` until v1.

## Required env vars (in student apps)

`withLaunchpad` asserts these at build time in production:

- `APP_ID` — student's subdomain slug (e.g. `bible-trivia`)
- `POSTHOG_KEY` — shared BIL PostHog project key
- `YOUVERSION_API_KEY` — shared YouVersion Platform API key (header is
  `X-YVP-App-Key`)

Optional: `POSTHOG_HOST` (defaults to `https://us.i.posthog.com`).

`bil-provisioning` (separate repo) injects these into the student's Vercel
project. This package never reads them at import time — only at handler
invocation or build-time assertion.

## What NOT to do

- Don't add a build step. We ship TypeScript source; `transpilePackages`
  handles it on the consumer side.
- Don't introduce a client-side analytics SDK. The server-side beacon at
  `/api/v1/track` is the whole point (~1KB, ad-blocker proof).
- Don't re-export `runtime` or `config` from pre-made route files (Next 16
  won't accept it; see verification above).
- Don't bundle Bible JSON. YouVersion Platform API is the source of truth
  now. (Old `lib/bible/books/` was deleted with the package refactor.)
- Don't add direct dependencies on Next.js or React — they're peerDeps.
  Same for `@vercel/og`.
- Don't import from `@/lib/...`. That alias only existed in the old
  Next.js template; the package uses bare specifier paths within `src/`.
- Don't enable `src/modules/**` in typecheck. They have their own peer-deps
  (e.g. `next-auth`) that aren't installed here.
- Don't commit secrets. `.env.local` is gitignored.

## When you're stuck

1. Read `README.md` for the consumer view + subpath export table.
2. Look at the bil-app-template repo for how a student wires this in.
3. Look at `bible-trivia` for a real app consuming the package.
4. Run `bun run smoke` (typecheck + 21 unit tests).
