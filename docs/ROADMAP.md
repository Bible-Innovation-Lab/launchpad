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

**Status (0.1.3).** Text-only `shareText()` lives at `@bil/launchpad/share`
(`navigator.share` → clipboard + built-in `share_clicked` analytics). Message /
emoji / OG / image generation stay in apps.

**Still out.** File/image share cascade and hung-sheet timeout. Revisit when
3+ apps need `canShare({ files })` with a shared timeout policy.

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

**Status (0.1.3).** PWA *install* is in the package (`@bil/launchpad/pwa`:
`PwaInstallPrompt`, `ServiceWorkerRegistration`, `createWebManifest`). Each
app still ships its own `public/sw.js` (service workers cannot load from
`node_modules`).

**Still out.** VAPID subscribe/send, notification soft-ask, DailyReminders,
FCM — prefer a separate `@bil/push` package or template recipe when organic
D2 retention exists without a nudge.

**Hidden complexity to plan for.** Safari requires a PWA install (Add to
Home Screen) before it will accept push permission — different UX from
Chrome/Android. iOS push only works on iOS 16.4+.

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
