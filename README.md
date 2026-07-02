# @bil/launchpad

The BIL platform shipped as a single npm package. Three things, intentionally
narrow: a security proxy (anon-cookie mint + bot filter), a YouVersion-backed
Bible reader, and auto-page-view analytics — the code that's the same across
every student product in the BIL summer program. Apps own everything else
(share cards, share text, OG images, auth, push, etc.).

**This repo is the package source, not a student template.** Students
fork [`Bible-Innovation-Lab/bil-app-template`](https://github.com/Bible-Innovation-Lab/bil-app-template)
(or click "Use this template" on it) and that template depends on
`@bil/launchpad` via npm.

Internal program. Not open source.

---

## What's in the box

| Sub-path | What it is |
|---|---|
| `@bil/launchpad/proxy` | Next 16 proxy (formerly middleware): legacy-cookie cleanup. Identity minting now lives in the analytics route. Exports `proxy` function + `config` matcher. |
| `@bil/launchpad/bible` | YouVersion Platform API wrapper. Server-side only (holds `YOUVERSION_API_KEY`). Exports `getVerse`, `getRange`, `getDailyVerse`. Returns `Passage = { id, reference, content }` against NIV 2011 (bible_id `111`). |
| `@bil/launchpad/analytics/client` | ~1KB client-side `track(event, props?)` beacon. Same-origin POST to `/api/analytics`, carrying a device-fingerprint hash for identity recovery. |
| `@bil/launchpad/analytics/page-view-tracker` | `<PageViewTracker />` — drop-in client component. Render once in `app/layout.tsx`; auto-fires `$pageview` on mount + every client-side route change. Also runs the session timer: reports active in-app time via `heartbeat` (every 20s while visible) and `$pageleave` (on tab hide/pagehide), both carrying `elapsed_ms`. |
| `@bil/launchpad/analytics/vercel-analytics` | `<VercelAnalytics />` — Vercel Web Analytics (`@vercel/analytics`). Redundant PostHog backup; render once in `app/layout.tsx`. Requires Web Analytics enabled on the Vercel project. |
| `@bil/launchpad/feedback` | `<FeedbackModal />` — controlled pop-up with a 5-star "How would you rate this game?" picker, an "Any feedback?" textarea, and an X close button. Submitting fires a `feedback_submitted` PostHog event through the existing `/api/analytics` beacon. |
| `@bil/launchpad/realtime` | Multiplayer toolkit (server). `realtimeStore` / `createRealtimeStore` — an Upstash-Redis-backed KV store (with a dev in-memory fallback) for cross-invocation room/game state, namespaced by `APP_ID`. `createSSEStream` — a Server-Sent Events helper that polls the store and pushes state changes to connected players. Credentials (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`) are injected by bil-provisioning, so multiplayer works in production with zero config. |
| `@bil/launchpad/realtime/client` | Multiplayer toolkit (client). `useRealtimeChannel(url)` — a React hook that subscribes to a `createSSEStream` endpoint with `EventSource` and re-renders with the latest state. Separate entry point so the server store's `@upstash/redis` never lands in a client bundle. |
| `@bil/launchpad/routes/analytics` | Pre-made `POST /api/analytics` handler. Students re-export from `app/api/analytics/route.ts`. Uses the `_lp_aid` cookie as identity when present; otherwise derives a deterministic anon-id from client IP + device fingerprint and sets the cookie. Forwards `$useragent` + `$ip` to PostHog (which auto-derives `$browser` + `$geoip_*`), emits `first_visit` when an id is freshly minted. Direct HTTP POST to PostHog's `/capture/` — no SDK. |
| `@bil/launchpad/config/next` | `withLaunchpad(nextConfig)` — config wrapper that adds `transpilePackages`, BIL security headers, and build-time env-var assertion. |

## How a student consumes this

The student-facing template repo is `Bible-Innovation-Lab/bil-app-template`. Their template's `app/api/analytics/route.ts` is one line:

```ts
export { POST } from "@bil/launchpad/routes/analytics";
```

Their `proxy.ts` is two lines:

```ts
import { proxy } from "@bil/launchpad/proxy";
export default proxy;
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z]+$).*)"] };
```

(Note: Next.js 16 requires `runtime` and `config` literal-export in the route file — they can't be re-exported from a package. See the autoplan verification commit for context.)

Their `next.config.ts`:

```ts
import { withLaunchpad } from "@bil/launchpad/config/next";
export default withLaunchpad({});
```

Bug fixes and new modules flow to existing student apps via `bun update @bil/launchpad && git push`.

## Required env vars (injected by bil-provisioning)

These must be set on each student's Vercel project. The bil-provisioning service sets them automatically when a student runs `./scripts/setup.sh` in their template.

| Env var | Required | Source |
|---|---|---|
| `APP_ID` | yes | the student's chosen subdomain slug, e.g. `bible-trivia` |
| `POSTHOG_KEY` | yes | shared BIL PostHog project key |
| `POSTHOG_HOST` | optional (default `https://us.i.posthog.com`) | |
| `YOUVERSION_API_KEY` | yes | shared key, header is `X-YVP-App-Key` |
| `UPSTASH_REDIS_REST_URL` | optional (only needed for multiplayer) | shared Upstash Redis REST URL; bil-provisioning injects it when configured. `KV_REST_API_URL` is accepted as a fallback. |
| `UPSTASH_REDIS_REST_TOKEN` | optional (only needed for multiplayer) | matching token; `KV_REST_API_TOKEN` accepted as a fallback. |

`withLaunchpad(nextConfig)` asserts `APP_ID`, `POSTHOG_KEY`, `YOUVERSION_API_KEY` at build time in production. The Upstash vars are **not** required at build time — apps that don't do multiplayer never touch them, and `@bil/launchpad/realtime` degrades to an in-memory dev store when they're absent.

### Multiplayer (`@bil/launchpad/realtime`)

The store gives you race-free shared state across serverless invocations:

```ts
// app/api/rooms/[id]/route.ts
import { realtimeStore } from "@bil/launchpad/realtime";

const ROOM_TTL = 60 * 60; // 1 hour

await realtimeStore.set(`room:${id}`, state, { ttlSeconds: ROOM_TTL });
const state = await realtimeStore.get<RoomState>(`room:${id}`);
// Atomic matchmaking-queue claim: only one caller ever wins.
const waiting = await realtimeStore.getDel<string>("queue:waiting");
```

Push changes to players over SSE — `EventSource` reconnects automatically,
so the helper closes itself safely under Vercel's function timeout:

```ts
// app/api/rooms/[id]/stream/route.ts
import { createSSEStream, realtimeStore } from "@bil/launchpad/realtime";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return createSSEStream({
    signal: req.signal,
    load: () => realtimeStore.get<RoomState>(`room:${id}`),
    signature: (s) => `${s.version}:${s.status}`, // only push when this changes
  });
}
```

Subscribe from a client component with the matching hook:

```tsx
"use client";
import { useRealtimeChannel } from "@bil/launchpad/realtime/client";

const { state, status } = useRealtimeChannel<RoomState>(
  roomId ? `/api/rooms/${roomId}/stream` : null
);
```

Keys are namespaced by `APP_ID`, so every BIL app can safely share one
Upstash instance. The `bil-app-template` ships a complete minimal example
(invite link → lobby → start → everyone taps → complete) built on these
primitives; `verse-duel` is a fuller two-player reference implementation.

## Development

```bash
bun install
bun run typecheck     # tsc --noEmit
bun run test          # bun src/bible/server.test.ts (21 tests, stubbed fetch)
bun run smoke         # typecheck + test
```

The package is TypeScript source — consumers transpile it via Next.js's `transpilePackages: ["@bil/launchpad"]`. `withLaunchpad` sets this automatically.

## Repo structure

```
src/
├── proxy/index.ts                    proxy function + config matcher
├── bible/server.ts                   YouVersion wrapper
├── bible/server.test.ts              21 unit tests
├── analytics/client.ts               1 KB beacon
├── analytics/page-view-tracker.tsx   auto-page-view client component
├── feedback/feedback-modal.tsx       5-star + textarea modal → PostHog
├── routes/analytics.ts               pre-made App Router handler
└── config/next.ts                    withLaunchpad
docs/
└── ROADMAP.md                        scoped-out ideas (share, auth, push)
```

## PostHog setup (one-time)

For `$browser` / `$browser_version` to be auto-populated from the
`$useragent` we forward, enable PostHog's **User Agent Populator** CDP
app under Data pipelines in the PostHog UI. GeoIP enrichment (from
`$ip`) is automatic — PostHog's pipeline resolves `$geoip_*` properties
whenever an event arrives with an `$ip` property set. We POST directly
to `/capture/` over HTTP; no PostHog SDK in the deploy.

## Related repos

| Repo | Purpose |
|---|---|
| [`Bible-Innovation-Lab/bil-app-template`](https://github.com/Bible-Innovation-Lab/bil-app-template) | Student starter (depends on this package) |
| [`Bible-Innovation-Lab/bil-provisioning`](https://github.com/Bible-Innovation-Lab/bil-provisioning) | The internal service `setup.sh` calls. Holds Vercel + YouVersion + PostHog admin tokens. |
| [`Bible-Innovation-Lab/bible-trivia`](https://github.com/Bible-Innovation-Lab/bible-trivia) | Product #1 — first canary consumer of this package |

## License

Internal use only.
