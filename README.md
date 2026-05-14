# @bil/launchpad

The BIL platform shipped as a single npm package. Pre-made route handlers,
Bible reader (YouVersion-backed), analytics, share helpers, OG card gen,
and security proxy — all the code that's the same across every student
product in the BIL summer program.

**This repo is the package source, not a student template.** Students
fork [`Bible-Innovation-Lab/bil-app-template`](https://github.com/Bible-Innovation-Lab/bil-app-template)
(or click "Use this template" on it) and that template depends on
`@bil/launchpad` via npm.

Internal program. Not open source.

---

## What's in the box

| Sub-path | What it is |
|---|---|
| `@bil/launchpad/proxy` | Next 16 proxy (formerly middleware): bot filter, anon-cookie mint, one-shot first-visit signal. Exports `proxy` function + `config` matcher. |
| `@bil/launchpad/bible` | YouVersion Platform API wrapper. Server-side only (holds `YOUVERSION_API_KEY`). Exports `getVerse`, `getRange`, `getDailyVerse`. Returns `Passage = { id, reference, content }` against NIV 2011 (bible_id `111`). |
| `@bil/launchpad/analytics/server` | PostHog forwarder. Production-only (hard-gated to `NODE_ENV=production`). Exports `capture`, `parseUA`. |
| `@bil/launchpad/analytics/client` | ~1KB client-side `track(event, props?)` beacon. Same-origin POST to `/api/v1/track`. |
| `@bil/launchpad/analytics/page-view-tracker` | `<PageViewTracker />` — drop-in client component. Render once in `app/layout.tsx`; auto-fires `page_view` on mount + every client-side route change. |
| `@bil/launchpad/share/client` | Canvas Wordle-grid generator + `navigator.share` helper. |
| `@bil/launchpad/share/server` | `@vercel/og` server-rendered cards for social scrapers. |
| `@bil/launchpad/routes/{track,bible,og,health}` | Pre-made App Router handlers students re-export from `app/api/v1/*/route.ts`. |
| `@bil/launchpad/config/next` | `withLaunchpad(nextConfig)` — config wrapper that adds `transpilePackages`, BIL security headers, and build-time env-var assertion. |
| `@bil/launchpad/examples/*` | Copy-paste components (`VerseOfDay`, `TrackedButton`, `ShareResult`). Not imported — students copy them into their own `app/`. |

Opt-in modules under `src/modules/` (auth, push) are copy-paste scaffolds students drop into their app when they need them. They have their own peer-deps (e.g. `next-auth`) the student installs.

## How a student consumes this

The student-facing template repo is `Bible-Innovation-Lab/bil-app-template`. Their template's `app/api/v1/track/route.ts` is one line:

```ts
export { POST } from "@bil/launchpad/routes/track";
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

`withLaunchpad(nextConfig)` asserts `APP_ID`, `POSTHOG_KEY`, `YOUVERSION_API_KEY` at build time in production.

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
├── analytics/{client,server}.ts      beacon + forwarder
├── share/{client.ts, server.tsx}     grid + OG card
├── modules/{auth,push}/              opt-in copy-paste scaffolds
├── examples/                         copy-paste components
├── routes/{track,bible,og,health}    pre-made App Router handlers
└── config/next.ts                    withLaunchpad
docs/
├── PRD.md                            platform requirements
└── youversion-mapping.md             API integration brief
```

## Related repos

| Repo | Purpose |
|---|---|
| [`Bible-Innovation-Lab/bil-app-template`](https://github.com/Bible-Innovation-Lab/bil-app-template) | Student starter (depends on this package) |
| [`Bible-Innovation-Lab/bil-provisioning`](https://github.com/Bible-Innovation-Lab/bil-provisioning) | The internal service `setup.sh` calls. Holds Vercel + YouVersion + PostHog admin tokens. |
| [`Bible-Innovation-Lab/bible-trivia`](https://github.com/Bible-Innovation-Lab/bible-trivia) | Product #1 — first canary consumer of this package |

## License

Internal use only.
