# BIL Launchpad

Next.js 16 + TypeScript template for shipping daily-interaction Bible mini-products.
Used by the Bible Innovation Lab summer program. Each forked product lives at
its own `<app-id>.bibleinnovationlab.org` subdomain.

Internal program. Off-brand under BIL (no YouVersion branding).

## Quick start (7 steps to live)

1. Click **"Use this template"** on `github.com/Bible-Innovation-Lab/launchpad` → fresh repo under the org.
2. Clone locally: `git clone git@github.com:Bible-Innovation-Lab/<app-name>.git && cd <app-name>`
3. `bun install`
4. `./scripts/setup.sh` &mdash; prompts for an app-id, calls the BIL provisioning service, returns a live URL.
5. `bun run dev` to verify locally.
6. `git push` &mdash; Vercel auto-deploys.
7. Visit `https://<app-id>.bibleinnovationlab.org`.

If something feels off at any step, run `./scripts/doctor.sh`.

## What's in the box

**Always on (`lib/`):**

- `@bil/bible` &mdash; World English Bible (public domain), per-book lazy-loaded. `getVerse`, `getRange`, `getBook`, `getDailyVerse`, `getRandomVerse`, `searchText`.
- `@bil/analytics` &mdash; 1KB client beacon + server-side PostHog forwarder. Ad-blocker proof, US-only, first-party cookies only.
- `@bil/share` &mdash; client-canvas share-grid generator + server-rendered OG cards for social scrapers.
- `proxy.ts` (Next.js 16 renamed middleware) &mdash; bot filter, geo-block, anon-cookie mint.

**Opt-in (`modules/`):**

- `modules/auth/` &mdash; NextAuth v5 with Apple + Google. Copy-paste to enable.
- `modules/push/` &mdash; Web Push (VAPID + service worker). Copy-paste to enable.

**DX:**

- `CLAUDE.md`, `AGENTS.md` &mdash; pattern hints for the AI you vibe-code with.
- `examples/` &mdash; copy-paste components (`VerseOfDay`, `TrackedButton`, `ShareResult`).
- `docs/TROUBLESHOOTING.md`, `ANALYTICS.md`, `RECIPES.md` &mdash; the questions you'll have.
- `scripts/setup.sh`, `doctor.sh` &mdash; provisioning + health checks.

## Development

```bash
bun install              # install deps
bun run dev              # dev server (http://localhost:3000)
bun run typecheck        # TypeScript check
bun run lint             # ESLint
bun run smoke            # full pre-commit: tests + typecheck + build
bun lib/bible/test.ts    # @bil/bible smoke tests
```

Local analytics: events log to the terminal if `POSTHOG_KEY` is unset.
That's the dev convenience &mdash; you can see the beacon fire without
hooking PostHog up.

## Architecture

See the design doc at
`~/.gstack/projects/scottbouma/scottbouma-launchpad-design-20260511-152914.md`
for the full design with threat model, test plan, and reviewer findings.

## License

Internal use only.
