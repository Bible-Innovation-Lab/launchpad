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

Scope is intentionally narrow: three jobs and nothing else.

1. **Quick spinup** — `proxy` + `config/next` give a student a configured
   Next 16 app with anon-cookie + security headers + env assertions in
   ~three one-liners.
2. **Bible text** — `bible` is a YouVersion Platform API wrapper.
3. **Auto-tracked analytics** — `proxy` mints the anon cookie, the
   `page-view-tracker` client component auto-fires `$pageview` on every
   route change, `routes/analytics` is the server endpoint that forwards
   to PostHog. Zero student wiring for first-visit + page-view events.

Everything else (share helpers, OG cards, auth, push, health endpoints,
client-callable Bible HTTP route, examples) is out of scope and lives in
the consuming app. See `docs/ROADMAP.md` for re-add criteria.

Subpath exports (see `package.json` `exports` map):

- `@bil/launchpad/proxy` — `proxy` function + `config` matcher
- `@bil/launchpad/bible` — `getVerse`, `getRange`, `getDailyVerse` (YouVersion)
- `@bil/launchpad/analytics/{client,page-view-tracker}` — 1KB beacon + auto-page-view client component
- `@bil/launchpad/feedback` — `<FeedbackModal />` star-rating + free-text pop-up that fires a PostHog event through the same beacon
- `@bil/launchpad/routes/analytics` — pre-made App Router handler for `/api/analytics`
- `@bil/launchpad/config/next` — `withLaunchpad`

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
for `proxy as default` (Next 16 wants the literal function):

- ✅ `import { proxy } from "@bil/launchpad/proxy"; export default proxy;`
- ❌ `export { proxy as default } from "@bil/launchpad/proxy";`
- ✅ `export const runtime = "edge";` (literal in route file)
- ❌ `export { runtime } from "@bil/launchpad/routes/...";`

Keep this in mind when adding new pre-made routes or modifying `proxy/index.ts`.

## File-by-file map

- `src/proxy/index.ts` — proxy function + matcher. Identity is no longer
  minted here; only clears the legacy `_lp_fv` cookie from old versions.
- `src/bible/server.ts` — YouVersion Platform API wrapper. Top-level facade
  uses module-singleton client; factory `createYouVersionClient` exists for
  tests. Header is `X-YVP-App-Key`. `bible_id` is hard-coded to `111` (NIV
  2011). Returns `Passage = { id, reference, content }`.
- `src/bible/server.test.ts` — 21 unit tests with stubbed `fetch`. Run with
  `bun src/bible/server.test.ts`.
- `src/analytics/client.ts` — ~1KB `track(event, props?)` beacon. POSTs to
  `/api/analytics`. Fire-and-forget, never throws.
- `src/analytics/page-view-tracker.tsx` — `<PageViewTracker />` client
 component. Students render it once in `app/layout.tsx`; fires
 `$pageview` with `{ path }` on mount + every client-side route change.
 The first beacon from a new identity also yields `first_visit` (minted
 in the route), so a fresh app gets both events with zero student wiring.
 Also calls `useSessionTimer()` so session-time events flow with the same
 zero wiring.
- `src/shell/native-chrome-init.tsx` — Capacitor splash, status bar, back
 button, and notification tap listeners (`localNotificationActionPerformed`
 / push tap). Soft-ask + schedule + FCM token POST stay in the hub.
- `src/shell/hub-kind.ts` — server-safe `resolveHubKind` / `HUBS` /
 `getHubLink`. Reads `process.env.HUB` (`community` | `scripture`). Apps
 call this from a Server Component and pass the result into `HubProvider`.
- `src/shell/hub.tsx` — client `<HubProvider>` + `<HubLink>`. Trusts the
 `hub` prop (do not re-read env here — non-`NEXT_PUBLIC_` vars are absent
 in the browser bundle).
- `src/analytics/session-timer.ts` — `createSessionClock` (pure, testable
  active-time accumulator) + `useSessionTimer()` hook. Reports active
  (foreground) in-app time via `heartbeat` (every 20s while visible) and
  `$pageleave` (on `visibilitychange`→hidden and `pagehide`), each carrying
  `elapsed_ms`. Wired into `<PageViewTracker />`; no separate export needed.
  Test: `bun src/analytics/session-timer.test.ts`.
- `src/feedback/feedback-modal.tsx` — `<FeedbackModal />` controlled
  client component. 5-star rating + "Any feedback?" textarea + X close.
  On submit calls `track("feedback_submitted", { rating, feedback })`
  through the analytics beacon — no new HTTP surface, distinct_id and
  IP/UA enrichment come from `/api/analytics` for free. All labels and
  the event name are overridable; defaults are the canonical
  "How would you rate this game?" / "Any feedback?" copy. Inline styles
  only — keeps the package zero-CSS.
- `src/routes/analytics.ts` — POST handler for `/api/analytics`. Identity
  resolver: uses the `_lp_aid` cookie when present, otherwise derives a
  deterministic anon-id `sha256(ip|fingerprint)` from the beacon's `fp`
  field and sets the cookie. Forwards the client `User-Agent` and
  `x-forwarded-for` as PostHog's `$useragent` + `$ip` properties (PostHog
  auto-derives `$browser`, `$os`, `$geoip_*`), POSTs directly to PostHog's
  HTTP capture endpoint — no SDK. Emits `first_visit` before the inbound
  event when an id is freshly minted. The only pre-made route in the
  package.
- `src/analytics/fingerprint.ts` — client-side device fingerprint
  (screen, WebGL renderer, canvas, timezone, locale, hardware) hashed to
  SHA-256. Memoized per page load; sent as `fp` with every beacon.
- `src/config/next.ts` — `withLaunchpad`. Adds `transpilePackages`, BIL
  security headers (HSTS, X-Frame-Options, etc.), asserts `APP_ID`,
  `POSTHOG_KEY`, `YOUVERSION_API_KEY` at build time in production.
- `docs/ROADMAP.md` — scoped-out ideas (share helpers, auth, push) with
  re-add signals. Read this before suggesting we add anything back.

## Canonical patterns

**Add a new pre-made route:**

1. Create `src/routes/<name>.ts` exporting `GET` / `POST` etc.
2. Add `"./routes/<name>": "./src/routes/<name>.ts"` to `package.json`
   `exports`.
3. Document in `README.md` table.
4. Remember: students re-export, so any `runtime`/`config` must be literals
   in the student's `route.ts`, not in this package.

**Add a new module under bible/analytics:**

1. New file under `src/<area>/<name>.ts`.
2. Add subpath export in `package.json`.
3. Add test next to it (`<name>.test.ts`) — they run with `bun`.
4. Update `README.md` table.
5. `bun run smoke` before commit.

Before adding anything to a new area: does it serve one of the three jobs
(spinup / Bible / auto-analytics)? If not, it belongs in the consuming app.

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

## PostHog setup (one-time)

For `$browser` / `$browser_version` to be auto-populated from the
`$useragent` we forward, enable PostHog's **User Agent Populator** CDP
app under Data pipelines in the PostHog UI. GeoIP enrichment (from
`$ip`) is automatic — PostHog's pipeline resolves `$geoip_*` properties
whenever an event arrives with an `$ip` property set.

## What NOT to do

- Don't add a build step. We ship TypeScript source; `transpilePackages`
  handles it on the consumer side.
- Don't introduce a client-side analytics SDK. The server-side beacon at
  `/api/analytics` is the whole point (~1KB, ad-blocker proof).
- Don't add `posthog-node` (or any PostHog SDK) back. We POST directly
  to PostHog's `/capture/` HTTP endpoint — keeps deps to zero and
  matches PostHog conventions exactly.
- Don't re-export `runtime` or `config` from pre-made route files (Next 16
  won't accept it; see verification above).
- Don't bundle Bible JSON. YouVersion Platform API is the source of truth.
- Don't add direct dependencies on Next.js or React — they're peerDeps.
- Don't import from `@/lib/...`. That alias only existed in the old
  Next.js template; the package uses bare specifier paths within `src/`.
- Don't add scope creep. The package does three things — quick spinup,
  Bible, auto-analytics. Share cards, OG images, auth, push, health
  endpoints, etc. live in the consuming app.
- Don't commit secrets. `.env.local` is gitignored.

## When you're stuck

1. Read `README.md` for the consumer view + subpath export table.
2. Look at the bil-app-template repo for how a student wires this in.
3. Look at `bible-trivia` for a real app consuming the package.
4. Run `bun run smoke` (typecheck + 21 unit tests).
