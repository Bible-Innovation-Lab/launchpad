# modules/push — Web Push (opt-in)

Default: **OFF**. Push is the highest-impact retention lever for daily-loop
products, but it muddies the day-2 retention signal if always on. Enable
once your product has organic D2 pull and you want to amplify it.

Uses standard [Web Push](https://www.w3.org/TR/push-api/) with VAPID
authentication. Works on Android Chrome + Firefox; on iOS, requires
the user to "Add to Home Screen" (PWA install) — true browser push on
Safari iOS is still limited.

## Why opt-in, not default

- Push permission asks at page-load have ~5% accept rates. Asking from a
  high-intent moment (e.g., right after a user completes their first
  puzzle) gets to 30-50%. The template can't pick that moment for you.
- Push on by default would inflate D2 retention numbers and you wouldn't
  know if your product has real organic pull.
- Subscription storage requires a database (Vercel KV at minimum). Forces
  state into a stateless template.

## Enable (5 steps)

1. **Install web-push:**
   ```bash
   bun add web-push
   bun add -d @types/web-push
   ```

2. **Generate VAPID keys (one-time, per product):**
   ```bash
   bunx web-push generate-vapid-keys
   ```
   Save the output. Add to `.env.local`:
   ```
   VAPID_PUBLIC_KEY=...
   VAPID_PRIVATE_KEY=...
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=<same as VAPID_PUBLIC_KEY>
   VAPID_SUBJECT=mailto:program@bibleinnovationlab.org
   ```

3. **Copy the module files into your app:**
   ```
   modules/push/sw.js                  →  public/sw.js
   modules/push/lib.ts                  →  lib/push.ts
   modules/push/EnablePushButton.tsx    →  components/EnablePushButton.tsx
   modules/push/route.subscribe.ts      →  app/api/push/subscribe/route.ts
   modules/push/route.send.ts            →  app/api/push/send/route.ts
   ```

4. **Set up subscription storage.** Subscriptions need to persist; v1 default
   is Vercel KV. Add `@vercel/kv` and create a KV store in the Vercel dashboard:
   ```bash
   bun add @vercel/kv
   ```

5. **Wire the EnablePushButton into a high-intent moment** (e.g., the
   celebration screen after a user wins their first puzzle, or after they've
   returned 2 days in a row).

## Use it

```tsx
"use client";
import EnablePushButton from "@/components/EnablePushButton";

<EnablePushButton appName="Bible Trivia" />
```

The button:
1. Asks for browser notification permission.
2. Subscribes via the service worker (`/sw.js`).
3. POSTs the subscription to `/api/push/subscribe`, which stores it in KV.

## Send a daily push

From a cron job, scheduled function, or admin endpoint:

```ts
// app/api/push/send/route.ts handles this — calls webpush.sendNotification()
// against every stored subscription with your daily payload.
```

Recommended: trigger from a Vercel Cron Job at the user's local TZ offset
(or 9am UTC for v1 — simpler).

## iOS notes

Web Push works on iOS Safari only when the user has installed the site as
a PWA ("Add to Home Screen"). Plain web push on Safari is not supported.
The button gracefully degrades — on iOS Safari, it shows "Add to Home
Screen" instructions instead of triggering the permission prompt.

## Not included (write yourself if needed)

- Push topic/segment targeting (everyone gets the same message).
- Click-through attribution back to PostHog.
- Quiet hours (per-user TZ logic).
