# Analytics

This template ships with server-side analytics. The client beacon is ~1KB;
there is no client-side PostHog SDK. Reasons:
- Faster first paint (no 50KB SDK bundle).
- Ad-blocker proof (first-party endpoint, not a third-party script).
- Privacy-friendlier (anonymous httpOnly cookie, no fingerprinting).
- Simpler debug surface for students.

## How it works

1. **First page load.** `proxy.ts` runs at the edge:
   - Filters known bots.
   - Geo-blocks non-US to `/coming-soon`.
   - Mints an httpOnly anon-id cookie (`_lp_aid` = random UUID, 2-year TTL).
   - Sets a one-shot `_lp_fv=1` signal cookie.

2. **First `track()` call from the client.** Beacon POSTs to `/api/track`:
   ```ts
   import { track } from "@/lib/analytics/client";
   track("puzzle_complete", { attempts_used: 3, won: true });
   ```

3. **Server route handler** at `app/api/track/route.ts`:
   - Reads `_lp_aid` cookie.
   - If `_lp_fv=1` is present (first visit), emits `first_visit` event to
     PostHog *before* the inbound event. Then deletes `_lp_fv`.
   - Parses user-agent to `{browser, os}` (low-cardinality).
   - Reads geo country from `x-vercel-ip-country`.
   - Forwards the enriched event to PostHog server SDK.
   - Returns 204. Analytics failures never break the user-facing app.

## Required events (ship with every product)

These are wired into the template; you get them for free:

| event | when | properties |
|---|---|---|
| `first_visit` | server-emitted on cookie mint | `app_id`, `country`, `browser`, `os` |
| `page_view` | client-side, on every route change | `path`, `app_id`, geo + UA props |

## Adding your own events

Snake-case, verb-shaped, flat props:

```tsx
"use client";
import { track } from "@/lib/analytics/client";

<button onClick={() => track("share_clicked", { result: "shared" })}>
  Share
</button>
```

Recommended naming:
- `<noun>_<verb>` (e.g. `puzzle_complete`, `guess_submitted`)
- Past tense for actions that happened (`shared`, `loaded`, `failed`)
- Don't repeat the app name — it's already on the event as `app_id`.

## Day-2 retention query

In PostHog, build a Retention insight:
- Cohortizing event: `first_visit`
- Returning event: `page_view`
- Filter by `properties.app_id = <your-app-id>` to slice per product.

The program team's aggregated dashboard shows D2 retention across all 50
products with `app_id` as a breakdown dimension.

## Known limitations

- **Cookie clearing under-counts D2.** Safari ITP wipes first-party
  cookies after 7 days of inactivity; users who clear cookies between
  day 1 and day 2 appear as new users. Expect 10-30% undercount on
  consumer mobile traffic. Not fixable without auth (use `modules/auth/`).
- **`first_visit` requires a `track()` call.** If a user lands and
  navigates away before the client fires its first event, `first_visit`
  never emits. The 24-hour TTL on `_lp_fv` gives a safety window, but
  hard-bounce-no-script users will be missed.
- **No rate limit at the edge in v0.** Plan to add Upstash Ratelimit
  when KV is wired. For now, dev environments and small-traffic products
  shouldn't hit it.

## PostHog dashboard

Set up:
1. Sign in to your BIL PostHog org.
2. Create a saved insight: Retention by `app_id`.
3. Pin to a Program Dashboard with traffic + D2 retention for all 50 products.

Local dev: leave `POSTHOG_KEY` unset. Events log to the terminal:
```
[bil-analytics] (no POSTHOG_KEY) puzzle_complete { app_id: "bible-trivia", ... }
```
That tells you the beacon fires. Add `POSTHOG_KEY` in `.env.local` to
actually send to PostHog.
