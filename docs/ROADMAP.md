# Roadmap

The v0.1 package is deliberately narrow: quick spinup, Bible access,
auto-tracked analytics. Everything below was scoped out so each app could
ship its own version first and prove the shape before we hoist it back
into the platform.

The pattern: **if 3+ apps end up writing the same thing, that's the
signal to pull it back into `@bil/launchpad`.** Until then, keep the
platform small.

---

## Share helpers

**What it was.** `@bil/launchpad/share` with a `shareResult(text, dataUrl?)`
helper — the cascading `navigator.share` → `canShare({files})` → clipboard
fallback. Also a `@vercel/og`-based card renderer and a Wordle-grid canvas.

**Why removed.** Different products have different share shapes (grids,
verses, scores, photos, plain text). The Wordle-grid stuff was Bible Trivia
hiding in the platform; the `shareResult` cascade is genuinely shared but
no other apps exist yet to confirm the right shape.

**Re-add signal.** When 3+ apps have a `lib/share/` directory and they all
have the same `navigator.share → clipboard` cascade copy-pasted, extract
`shareResult` into the package. Keep the image + text generation in apps —
that part really does vary.

**Hidden complexity to plan for.** iOS Safari's `canShare({files})` lies
when the file is a data URL blob > a few MB; Android Chrome's share sheet
sometimes hangs and never resolves the promise. The cascade has to time
out the share attempt before falling back. The current version doesn't
handle the timeout case.

---

## Auth (Sign in with Apple + Google)

**What it was.** `src/modules/auth/` — copy-paste NextAuth v5 scaffold
with Apple + Google providers. Default OFF; students drop the files in
when they need streak persistence.

**Why removed.** No app has needed it yet, and as a copy-paste scaffold
it wasn't actually depending on the package — it was a folder of files
the student would copy. Lived in the wrong repo.

**Re-add signal.** First time a BIL app needs durable user identity
(streaks, saved progress, social leaderboards). The Safari ITP cookie-wipe
problem is real for any daily-loop product — anon cookies disappear after
~7 days of inactivity, breaking D7+ retention math.

**What to put back.** Probably *not* as a launchpad module. Better as a
separate package `@bil/auth` or a recipe in `bil-app-template/docs/`.
NextAuth v5 has its own opinions about file layout that fight against
"drop-in module from a package."

**Hidden complexity to plan for.** Apple Sign In requires a paid Apple
Developer account ($99/yr) and a separately-configured Service ID per
domain — meaning each BIL app subdomain needs its own Apple-side config.
The provisioning service would have to handle that or we accept Google-only.

---

## Web Push notifications

**What it was.** `src/modules/push/` — copy-paste VAPID + service worker
+ send endpoint scaffold. Default OFF.

**Why removed.** Same reason as auth: no app needs it yet, and the
copy-paste shape didn't justify living in the package.

**Re-add signal.** First time a BIL app shows organic D2 retention pull
without a notification nudge. Push amplifies an existing loop; it does
not create one. Adding it to apps that don't already have organic pull
just trains users to swipe away notifications.

**What to put back.** A `@bil/push` package (or recipe) that wires up
VAPID + a `pushSubscribe()` client helper + a `sendPush()` server helper.
The service worker file has to live in each app's `public/` though —
service workers can't be loaded from `node_modules`.

**Hidden complexity to plan for.** Safari requires a PWA install (Add to
Home Screen) before it will accept push permission — different UX from
Chrome/Android. iOS push only works on iOS 16.4+. The product needs an
"install this app" upsell flow that's currently nobody's responsibility.

---

## Other ideas that came up but aren't queued

These don't have enough signal yet to be on the roadmap proper; recording
them so we don't re-debate the same things in three months.

- **`/api/v1/bible/[ref]` HTTP route.** The library is fine; the HTTP
  wrapper was for hypothetical client-side or mobile consumers. Reconsider
  if a non-Next consumer materializes.
- **OG card generator (`@vercel/og`).** Each app already builds its own
  card, so a shared generator would have to be very generic to be useful.
  Probably stays in apps forever.
- **Health endpoint `/api/v1/health`.** Useful but trivial — students can
  write `{ status: "ok" }` in 5 lines. Reconsider if we add a centralized
  uptime checker that wants a standard shape.
- **Server Actions for Bible reads.** Modern alternative to the HTTP route
  for client → Bible. Worth revisiting if the SA pattern stabilizes in
  Next 16+.

---

## How to make a re-add decision

Before pulling anything back into the package, answer:

1. **Are 3+ apps doing the same thing?** If not, it's not platform yet —
   it's one app's code that hasn't been generalized.
2. **Is the shape stable?** If the apps disagree on the API, it's too
   early — pulling in the wrong shape costs more than the duplication.
3. **Does it serve one of the three jobs (spinup / Bible / analytics)?**
   If yes, easy add. If no, default to a separate package (`@bil/auth`,
   `@bil/push`) rather than expanding launchpad's scope.
4. **Is there a complexity tax the platform can absorb that an app
   can't?** E.g. push notifications' Safari/Android divergence is the
   kind of thing a platform should hide. That's a strong re-add signal
   even with just 1-2 consumers.
