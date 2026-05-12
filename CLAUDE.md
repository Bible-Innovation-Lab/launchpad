@AGENTS.md

# Build notes for AI assistants

This file is loaded by Claude Code / Cursor / OpenAI Codex when working in this
repo. It captures the patterns this template uses so the AI can be useful
without spelunking.

## What this is

Bible Innovation Lab (BIL) Launchpad — a Next.js 16 + TypeScript template for
shipping daily-interaction Bible mini-products. Forked once per product. Each
product lives on its own `<app-id>.bibleinnovationlab.org` subdomain.

US-only v1 (proxy enforces). Anonymous analytics by default; sign-in and
push notifications are opt-in modules at `modules/`.

## Next.js 16 specifics

**Middleware is now Proxy.** The file is `proxy.ts` and exports a `proxy()`
function. Same behavior as middleware in older versions, just renamed. Do
NOT recreate as `middleware.ts`; Next 16 will not pick it up.

**Route handlers** still live at `app/<path>/route.ts` and export per-method
functions (`POST`, `GET`, etc.). Web `Request`/`Response` semantics; Next
extends with `NextRequest`/`NextResponse`.

When in doubt, check `node_modules/next/dist/docs/01-app/` for the in-version
docs before relying on training data.

## File-by-file map

- `app/` — Next.js App Router pages. Default `app/page.tsx` is a placeholder;
  replace it with your product.
- `app/api/track/route.ts` — server-side analytics endpoint. Reads `_lp_aid`
  cookie, enriches with geo + parsed UA, forwards to PostHog. Returns 204.
- `app/coming-soon/page.tsx` — landing page for non-US traffic.
- `proxy.ts` — runs on every page request. Bot filter → geo-block →
  anon-cookie mint → one-shot `first_visit` signal cookie.
- `lib/bible/` — `@bil/bible`. World English Bible per-book JSON +
  `getVerse`, `getRange`, `getBook`, `getDailyVerse`, `getRandomVerse`,
  `searchText`. Throws `BibleRefError` (with `didYouMean`) on miss.
- `lib/analytics/client.ts` — 1KB `track(event, props?)` beacon. Use in
  client components.
- `lib/analytics/server.ts` — PostHog forwarder + UA parser. Server only.
- `lib/share/client.ts` — Wordle-style grid renderer + native-share helper.
  Use in client components. NO spoilers in `shareText()` output by design.
- `lib/share/server.tsx` — `@vercel/og` OG card generator for social
  scrapers. Aggressively cached (`immutable, max-age=86400`).
- `modules/auth/` — opt-in NextAuth scaffold. Default OFF; copy files in
  + set env vars to enable. README inside the folder.
- `modules/push/` — opt-in Web Push scaffold. Default OFF; same pattern.
- `examples/` — copy-paste components: `VerseOfDay`, `TrackedButton`,
  `ShareResult`. These are STARTING POINTS, not packages you import.
- `scripts/setup.sh` — first-deploy script. Runs once per repo.
- `scripts/doctor.sh` — environment health check. Run anytime.
- `scripts/build-bible.ts` — one-time. Re-runnable if you need to re-fetch
  the WEB Bible JSON.
- `docs/TROUBLESHOOTING.md` — named errors + fixes.
- `docs/ANALYTICS.md` — event taxonomy + PostHog dashboard links.
- `docs/RECIPES.md` — "how do I add X?" recipes.

## Canonical patterns

**Add a new analytics event:**

```tsx
"use client";
import { track } from "@/lib/analytics/client";
// in a handler:
track("event_name", { some_prop: "value" });
```

Event names are snake_case verbs (`puzzle_complete`, `share_clicked`).
Props are flat key/value; nested objects work but discourage them.

**Look up a verse server-side:**

```tsx
import { getVerse } from "@/lib/bible";
const v = await getVerse("John 3:16");
console.log(v.text);
```

`getVerse` returns `Promise<Verse>` and throws `BibleRefError` on miss.
Aliases work: `"Jn 3:16"`, `"1 Cor 13:4"`, `"Psalm 23:1"`.

**Render the day's verse:**

```tsx
import { getDailyVerse } from "@/lib/bible";
const v = await getDailyVerse(new Date());
```

Deterministic per UTC date. Same day → same verse globally.

**Add a new page:** `app/<route>/page.tsx`. Server components by default;
add `"use client"` at the top for components that need state or event handlers.

**Style:** Tailwind 4 via `@tailwindcss/postcss`. Prefer utility classes
over inline styles. Color palette stays neutral (zinc/white) by default;
products override per their product UX.

## What NOT to do

- Don't add a client-side analytics SDK. The server-side beacon pattern is
  the WHOLE POINT. ~1KB instead of ~50KB, ad-blocker proof, no consent
  banner needed for US-only.
- Don't bundle additional Bible translations in v1. Use `@bil/bible` (WEB only).
- Don't add real auth to the default path. Use `modules/auth/` if you need
  it; copy it in, don't enable globally.
- Don't disable proxy. Bots will pollute analytics; non-US traffic
  needs the legal geo-block.
- Don't add `node:fs` or other Node-only APIs to client components.
- Don't commit secrets. `.env` is gitignored; provisioning service handles
  prod env vars.
- Don't re-create `middleware.ts`. The file is `proxy.ts` in Next 16.

## When you're stuck

1. Check `docs/TROUBLESHOOTING.md`.
2. Run `./scripts/doctor.sh` — health-checks bun, env vars, endpoints.
3. Look at the trivia game repo (`Bible-Innovation-Lab/bible-trivia`) for a
   working example of the full pattern.
