# BIL Launchpad

A Next.js 16 + TypeScript template for shipping daily-interaction Bible mini-products
under the Bible Innovation Lab (BIL) brand. Used by the BIL summer program. Each
forked product lives at its own `<app-id>.bibleinnovationlab.org` subdomain.

This repository is a **GitHub Template** — click "Use this template" on
[github.com/Bible-Innovation-Lab/launchpad](https://github.com/Bible-Innovation-Lab/launchpad)
to create a new product.

Internal program. Off-brand (no YouVersion logos or styling). Not open source.

---

## Why this exists

Tech students with limited deployment experience can lose days per product to deploy
plumbing, subdomain wiring, analytics setup, and marketing instrumentation — work that
has nothing to do with the product they're building. The launchpad eliminates those
decisions so students focus on product UX. See [`docs/PRD.md`](docs/PRD.md) for the
full product requirements.

## Quick start

Read `docs/RECIPES.md` for "how do I…" answers. The short version:

```bash
# 1. Click "Use this template" on github.com/Bible-Innovation-Lab/launchpad.
# 2. Clone your new repo and install:
git clone git@github.com:Bible-Innovation-Lab/<your-app>.git && cd <your-app>
bun install

# 3. Provision (one-time per repo):
./scripts/setup.sh
# Prompts for an app-id, then calls the BIL provisioning service to:
#   - Import this repo into the BIL Vercel team
#   - Attach <app-id>.bibleinnovationlab.org as the project domain
#   - Inject POSTHOG_KEY + APP_ID env vars
# Returns the live URL.

# 4. Develop:
bun run dev

# 5. Ship:
git push
# Vercel auto-deploys main → production.
```

If something feels off, run `./scripts/doctor.sh`.

## What's in the box

**Always on (`lib/`):**

| Package | Purpose |
|---|---|
| `@bil/bible` | World English Bible (public domain). 66 per-book JSON files. `getVerse`, `getRange`, `getBook`, `getDailyVerse`, `getRandomVerse`, `searchText`. Throws `BibleRefError` (with `didYouMean`) on miss. |
| `@bil/analytics` | 1 KB client beacon + server-side PostHog forwarder. Cookie minted by `proxy.ts` (Next 16's renamed middleware). First-party, US-only, ad-blocker proof. |
| `@bil/share` | Client-canvas Wordle-grid generator + `@vercel/og` server-rendered cards for social scrapers. |

**Opt-in modules (`modules/`):**

| Module | What it adds |
|---|---|
| `modules/auth/` | Sign-in with Apple + Google via NextAuth v5. Copy files in + set env vars to enable. |
| `modules/push/` | Web Push (VAPID + service worker). Copy files in + generate keys to enable. |

**Infrastructure:**

- `proxy.ts` — bot filter + US-only geo-block + anon-cookie mint + one-shot first-visit signal.
- `vercel.json` — bun build/install, `iad1` region.
- `.github/workflows/` — CI on every PR plus a weekly smoke-clone job.

**Developer experience:**

- `CLAUDE.md` + `AGENTS.md` — pattern hints for the AI you vibe-code with.
- `examples/` — copy-paste components (`VerseOfDay`, `TrackedButton`, `ShareResult`).
- `docs/` — `PRD.md`, `TROUBLESHOOTING.md`, `ANALYTICS.md`, `RECIPES.md`, `PRIVACY-BRIEF.md`.
- `scripts/setup.sh`, `doctor.sh`, `build-bible.ts`.

## Available scripts

```bash
bun run dev              # Dev server (http://localhost:3000)
bun run build            # Production build
bun run typecheck        # `tsc --noEmit`
bun run lint             # ESLint
bun run smoke            # Tests + typecheck + build (use before pushing)
bun run setup            # ./scripts/setup.sh
bun run doctor           # ./scripts/doctor.sh
bun run build-bible      # Re-fetch the WEB Bible JSON (one-time)
```

## Documentation

- [`docs/PRD.md`](docs/PRD.md) — product requirements
- [`docs/RECIPES.md`](docs/RECIPES.md) — "how do I add X?" recipes
- [`docs/ANALYTICS.md`](docs/ANALYTICS.md) — event taxonomy + PostHog setup
- [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) — named errors + fixes
- [`docs/PRIVACY-BRIEF.md`](docs/PRIVACY-BRIEF.md) — for the YouVersion privacy/legal review
- `CLAUDE.md` — patterns for AI assistants

## Related repos

| Repo | Purpose |
|---|---|
| [`Bible-Innovation-Lab/launchpad`](https://github.com/Bible-Innovation-Lab/launchpad) | This template |
| [`Bible-Innovation-Lab/bible-trivia`](https://github.com/Bible-Innovation-Lab/bible-trivia) | Product #1 — daily Bible-character trivia |
| `Bible-Innovation-Lab/bil-provisioning` | The internal service `setup.sh` calls. Holds the Vercel + PostHog admin tokens. |

## License

Internal use only.
