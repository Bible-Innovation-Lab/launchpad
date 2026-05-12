# PRD: BIL Launchpad

| | |
|---|---|
| **Product** | BIL Launchpad (`Bible-Innovation-Lab/launchpad`) |
| **Owner** | Scott Bouma, YouVersion |
| **Status** | Draft v1 — implementation in progress |
| **Last updated** | 2026-05-12 |

---

## Problem

A YouVersion-sponsored summer program will run a small team of tech students who try
to ship 50+ daily-interaction Bible mini-products. Students are strong product
thinkers but have limited real-world deployment experience.

Without shared infrastructure, every student loses days per product to:
- Setting up Vercel + GitHub integration
- Configuring DNS + subdomain wildcards
- Wiring analytics so retention can be measured
- Re-inventing standard primitives (Bible text lookup, share images, OG cards)

The result: the program produces fewer shipped products, and the products that ship
have inconsistent measurement so cross-product comparison is impossible.

## Goal

Eliminate per-product infrastructure work so students spend their time on product UX.
Make it possible for a student new to Vercel and Next.js to go from "Use this
template" to a live, instrumented URL on the same day.

## Non-goals

- This is not a CMS. Products bring their own content.
- This is not a multi-tenant platform. Each product is its own repo and Vercel project.
- This is not a generic SaaS starter. It's specifically opinionated for daily-interaction
  Bible products targeting US traffic.
- This is not open source.

## Target user

**Primary user:** a tech student in the BIL summer program. Junior engineering skill
level. Comfortable with TypeScript and React; new to Next.js conventions, new to Vercel,
new to deployment plumbing. Pairs heavily with AI assistants (Cursor, Claude Code).

**Secondary user:** the BIL platform team (Scott + collaborators) who maintain the
template, the provisioning service, and the central PostHog + Vercel accounts.

## Success criteria

**Launchpad-level (must be measurable):**

- **Median time-to-live** for a student new to the template: **under 3 hours realistic,
  under 60 minutes aspirational** (click "Use this template" → live URL responding 200).
- **Day-2 retention is queryable** for every product in the PostHog dashboard within
  one day of its launch, without per-product setup.
- **Fewer than 5 Slack/Discord questions per student across the whole summer** about
  deploy / subdomain / analytics wiring. Measurable from program chat history.

**Program-level (informs whether the launchpad served its purpose):**

- 50+ products shipped over the summer with live subdomains and instrumented analytics.
- At least 1 product reaches 1,000 DAUs by program end.
- An internal retro / dashboard that ranks all 50 by day-2 retention from paid traffic.

## Functional requirements

### F1: Single-template fork pattern

The launchpad is a GitHub Template. Students click "Use this template," GitHub
creates a new repo under the `Bible-Innovation-Lab` org with the template's full
contents. The student then clones, runs `./scripts/setup.sh`, and is live.

### F2: One-command provisioning

`./scripts/setup.sh` must:
- Prompt for an `app-id` (subdomain-safe slug, validated against a denylist).
- Write `app.config.json` with the chosen ID.
- Call the BIL provisioning service to import the repo into Vercel, attach the
  subdomain, and inject env vars.
- Return the live URL and open it in the browser.

This script is the **only** deploy path. There is no documented way to deploy a BIL
product without going through it. The token-handling rationale (never let admin
credentials touch student machines) lives in the provisioning service PRD.

### F3: Bible content layer

Every BIL product needs Bible text. The launchpad ships `@bil/bible`:
- Stores the **World English Bible** (public domain) as 66 per-book JSON files.
- Lazy-loads per book — a serverless cold start parses only the book referenced.
- Exposes `getVerse`, `getRange`, `getBook`, `getDailyVerse`, `getRandomVerse`,
  `searchText`.
- Throws typed `BibleRefError` with `didYouMean` suggestions on miss; never
  returns `undefined` silently.

### F4: Server-side analytics

The launchpad ships `@bil/analytics`:
- A ~1 KB client beacon (`track(event, props?)`) that POSTs to `/api/track`.
- A server-side route handler that:
  - Reads the anon-id cookie set by `proxy.ts`.
  - Enriches with `app_id`, country (from edge geo header), parsed user-agent.
  - Forwards to PostHog server SDK.
  - Returns 204 always (analytics never break user-facing flows).
- A one-shot `first_visit` event fired BEFORE the inbound event when the cookie
  was just minted (preserves funnel ordering).

Day-2 retention by `app_id` falls out of the standard PostHog Retention insight.
No custom SQL required.

### F5: Sharing primitives

The launchpad ships `@bil/share`:
- Client-canvas Wordle-grid PNG generator (per-user share images; free, on-device).
- Server-rendered OG cards via `@vercel/og` (for Twitter/Facebook scrapers).
- `shareText()` helper that produces **spoiler-free** share strings (only the
  score pattern; never the quote or answer).

### F6: US-only enforcement

`proxy.ts` geo-blocks non-US traffic with a 307 redirect to `/coming-soon` BEFORE
any cookie is minted or any analytics event fires. This is what makes the launchpad
compliant with GDPR/ePrivacy in v1 without a consent banner.

### F7: Bot filtering

`proxy.ts` filters known bot user-agents (Googlebot, Slackbot, scanners) and skips
cookie mint + analytics for them. Keeps day-2 retention numbers clean.

### F8: Opt-in modules

Two opt-in modules ship in `modules/`, default OFF:
- `modules/auth/` — Sign-in with Apple + Google via NextAuth v5. Solves the iOS
  Safari ITP cookie-wipe problem for streak products.
- `modules/push/` — Web Push (VAPID + service worker + send endpoint). Solves
  daily-loop retention amplification once a product already has organic D2 pull.

Each module has its own README with 4-5 step enable instructions. Students copy
files into their app to turn them on.

### F9: DX surface

The launchpad ships docs and code structure that minimize the questions students
hit at hour 1 / day 1 / week 1:
- `README.md`, `CLAUDE.md`, `AGENTS.md`
- `docs/TROUBLESHOOTING.md` (named errors: `PROVISIONING_403`, `APPID_TAKEN`, etc.)
- `docs/ANALYTICS.md` (event taxonomy + PostHog setup)
- `docs/RECIPES.md` ("how do I add X?")
- `examples/` (copy-paste components: `VerseOfDay`, `TrackedButton`, `ShareResult`)
- `scripts/doctor.sh` (health check; run when something feels off)

### F10: CI

- Every PR runs `lint`, `typecheck`, `bible-smoke-test`, and `build`.
- A weekly smoke-clone job clones the template into a fresh dir and runs `bun install
  && bun run build` end-to-end. Catches "the template is broken" before a student hits it.

## Non-functional requirements

### NF1: Performance

- Bible text fetch: < 10 ms warm, < 200 ms cold (per-book lazy load keeps cold-start
  parse to a single book).
- `/api/track` p99 latency: < 500 ms.
- Page weight: client beacon is ~1 KB; no client-side analytics SDK ships.

### NF2: Privacy

- US-only at the edge. No EU traffic touches the cookie code path.
- Anonymous httpOnly cookie. No fingerprinting.
- See [`PRIVACY-BRIEF.md`](PRIVACY-BRIEF.md) for the legal review brief.

### NF3: Security

- Admin tokens (Vercel, PostHog) never live in this repo — they live in the
  provisioning service.
- `.env.local` is gitignored; `.env.example` documents the shape.
- Setup script authenticates students to the provisioning service via GitHub
  OAuth device flow (not a shared bearer).

### NF4: Maintainability

- Opinionated stack: one framework (Next.js), one host (Vercel), one analytics
  provider (PostHog), one auth posture (anon by default), one package manager (bun).
- `@bil/*` packages are semver-tagged with a Renovate config so security patches
  auto-PR to forks. Major version bumps require manual merge.

### NF5: Cost

- Vercel: Pro team, central BIL billing. Each project gets its own deployment;
  most stay idle.
- PostHog: free tier expected pre-success; budget for Growth tier (~$200/mo) when
  one product crosses 1 M events / month.

## Out of scope (v1)

- EU support (v2)
- Multiple Bible translations beyond WEB (v2)
- Semantic search on Bible text (v2)
- YouVersion `platform.youversion.com` API integration (v2)
- A published CLI (we use a bash script; opt-in modules are copy-paste)
- Mobile app shell
- Template upgrade migration tooling (Renovate tracks updates, students decide whether to merge)
- Hand-curated product-specific content (lives in each product's own repo)

## Dependencies (blocking v1)

| Dependency | Owner | Status |
|---|---|---|
| GoDaddy DNS wildcard CNAME for `*.bibleinnovationlab.org` → Vercel | Scott | Pending |
| Paid Vercel Pro team account under BIL billing | Scott | Pending |
| New BIL-owned PostHog org with project + admin tokens | Scott | Pending |
| `bil-provisioning` service deployed | Platform team | Not started |
| Legal sign-off on US-only anon-cookie analytics | YouVersion legal | Pending — see [`PRIVACY-BRIEF.md`](PRIVACY-BRIEF.md) |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Provisioning service not built before students arrive | Medium | Platform team manually provisions for the first batch (~5 min/repo) until service is up |
| Vercel free-tier limits hit on a viral product | Medium | Pro team on central billing absorbs surges |
| PostHog event budget exceeded mid-summer | Medium | Billing alert at 800 K events; auto-upgrade to Growth tier before cap |
| Day-2 retention math under-counts due to Safari ITP | High | Documented limitation; opt-in auth module addresses for streak products |
| `@bil/bible` bundle pollutes products that don't use it | Low | Per-book lazy load: only referenced books parse on cold start |

## Open questions

- What's the program's marketing channel? (Instagram / TikTok / Reddit / Discord) — affects whether per-product pixels are needed and which OG image formats matter.
- Sunset policy: what happens to a student's repo + subdomain after the summer? Open-source at student's discretion is the working answer; needs platform-team teardown coordination.
- D2 retention threshold for "this product has pull" — pre-decided as cohort-relative (rank within categories of similar products, pick the top N) rather than an absolute number.

## Design references

- Full design doc (with autoplan review history, threat model, test plan):
  `~/.gstack/projects/scottbouma/scottbouma-launchpad-design-20260511-152914.md`
- Privacy / legal brief: [`PRIVACY-BRIEF.md`](PRIVACY-BRIEF.md)
- Provisioning service requirements: `Bible-Innovation-Lab/bil-provisioning/docs/PRD.md`
