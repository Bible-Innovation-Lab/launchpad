# Recipes

Copy-paste solutions for the questions you'll hit while building.

## Add a new page

Create `app/<route>/page.tsx`:

```tsx
// app/about/page.tsx
export default function About() {
  return <main className="p-8">About this product.</main>;
}
```

Available at `/<route>`. Server component by default; add `"use client"`
at the top for interactivity.

## Show today's verse

```tsx
// app/page.tsx (server component)
import { getDailyVerse } from "@/lib/bible";

export default async function Home() {
  const v = await getDailyVerse(new Date());
  return (
    <main className="p-8">
      <p>{v.text}</p>
      <p>— {v.ref}</p>
    </main>
  );
}
```

See also `examples/VerseOfDay.tsx`.

## Track a custom event

```tsx
"use client";
import { track } from "@/lib/analytics/client";

export default function StartButton() {
  return (
    <button onClick={() => track("game_started")}>Start</button>
  );
}
```

See also `examples/TrackedButton.tsx`.

## Add a daily-content slot

A new piece of content that rotates daily. Same pattern as `getDailyVerse`.

```tsx
import { getBook } from "@/lib/bible";

export async function getDailyProverb(date: Date) {
  const proverbs = await getBook("Proverbs");
  const ord = Math.floor(date.getTime() / 86400000);
  return proverbs[ord % proverbs.length];
}
```

## Enable the auth module

When your product needs sign-in (cross-device streaks, history, etc.):

1. Copy the contents of `modules/auth/` into your app (the README inside
   has the exact 4 steps).
2. Add OAuth client IDs to `.env.local`:
   ```
   AUTH_SECRET=<run: openssl rand -base64 32>
   AUTH_GOOGLE_ID=...
   AUTH_GOOGLE_SECRET=...
   AUTH_APPLE_ID=...
   AUTH_APPLE_SECRET=...
   ```
3. Wrap the layout with `<SessionProvider>`.
4. Replace any place you used `_lp_aid` for cross-session identity with
   `useSession()`.

## Enable web push

When you want to send daily notifications to opted-in users:

1. Copy the contents of `modules/push/` into your app.
2. Generate VAPID keys: `bunx web-push generate-vapid-keys`.
3. Add them to `.env.local`:
   ```
   VAPID_PUBLIC_KEY=...
   VAPID_PRIVATE_KEY=...
   VAPID_SUBJECT=mailto:program@bibleinnovationlab.org
   ```
4. Wire the permission prompt into a high-intent moment (after a user
   completes their first puzzle, not on page load — permission asks at
   page-load have ~5% accept rates).

## Add Vercel KV (state, leaderboards, saved progress)

1. In the Vercel dashboard, your project → Storage → Connect → KV.
2. Vercel injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` env vars.
3. Install: `bun add @vercel/kv`.
4. Use:
   ```ts
   import { kv } from "@vercel/kv";
   await kv.set(`streak:${userId}`, currentStreak);
   ```

## Swap to a custom OG image

For per-page Open Graph cards (social previews):

```tsx
// app/og/route.tsx
import { ogImageResponse } from "@/lib/share/server";

export const runtime = "edge";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? "";
  const score = (url.searchParams.get("score") ?? "0/5").split("/");
  // Build a rows[][] of cell colors based on score
  const rows: ("correct" | "incorrect" | "empty")[][] = []; // ...
  return ogImageResponse({
    title: "Bible Trivia",
    subtitle: date,
    caption: `${score[0]}/${score[1]}`,
    rows,
  });
}
```

Reference the URL from your page's metadata:

```tsx
// app/page.tsx
import { ogMetadata } from "@/lib/share/server";

export const metadata = ogMetadata({
  title: "Bible Trivia",
  imageUrl: "https://your-app.bibleinnovationlab.org/og?date=2026-05-11&score=3/5",
  url: "https://your-app.bibleinnovationlab.org",
});
```

## Disable US-only for local EU testing

In `.env.local`:

```
NEXT_PUBLIC_DISABLE_GEO=1
```

Restart `bun run dev`. Production deploys always enforce US-only;
this only affects local development.

## Reset the local anon-id cookie (test first-visit flow)

In Chrome devtools → Application → Cookies → delete `_lp_aid` and `_lp_fv`.
Reload the page. Proxy will mint a fresh cookie + signal `first_visit`.

## Run the doctor before debugging anything

```bash
./scripts/doctor.sh
```

Catches the boring things (bun version, env vars, endpoints reachable).
Run this first when something feels off.

## Run the smoke test

```bash
bun run smoke
```

End-to-end check that `@bil/bible` lookups work, `/api/track` is
reachable, and the build compiles. Use in CI and before publishing.
