# Troubleshooting

Named errors and how to fix them. Run `./scripts/doctor.sh` for an
automated health check first.

## `bun: command not found`

You need bun installed. Run:
```bash
curl -fsSL https://bun.sh/install | bash
```
Restart your shell. Verify with `bun --version`.

## `Cannot find module '@/lib/bible'`

The TypeScript path alias `@/` maps to the repo root. Check `tsconfig.json`
has:
```json
"paths": { "@/*": ["./*"] }
```
If you renamed the repo, the alias should still work — it's relative.

## `bun run dev` shows a blank page on first load

If you're loading from a non-US IP (VPN, mobile data routing), the proxy
redirects you to `/coming-soon`. To test locally, either:
- Disable your VPN, or
- Set `NEXT_PUBLIC_DISABLE_GEO=1` in `.env.local` to skip the geo-block
  in dev only.

## `POSTHOG_KEY` is undefined / analytics don't appear in PostHog

You'll see this in dev console: `[bil-analytics] (no POSTHOG_KEY) event_name {...}`.
That means the beacon is firing but PostHog isn't configured. To wire it up:

1. Go to your PostHog project → Settings → Project API Keys.
2. Copy the project API key (starts with `phc_`).
3. Add to `.env.local`:
   ```
   POSTHOG_KEY=phc_yourkeyhere
   POSTHOG_HOST=https://us.i.posthog.com
   ```
4. Restart `bun run dev`.

In production, env vars are injected by the provisioning service.

## `BibleRefError: Invalid Bible reference`

The reference didn't parse. Common causes:
- Typo in book name: `"Jhn 3:16"` → the error includes a `didYouMean` field with the correction.
- Out-of-range verse: `"John 99:99"` — check chapter/verse bounds.
- Bad format: must be `"<Book> <chapter>:<verse>"` (optionally `-<verse>`).

Catch it explicitly:
```ts
import { getVerse, BibleRefError } from "@/lib/bible";
try {
  const v = await getVerse(userInput);
} catch (err) {
  if (err instanceof BibleRefError) {
    console.warn(err.message, "didYouMean:", err.didYouMean);
  }
}
```

## `PROVISIONING_403` from setup.sh

The provisioning service rejected your call. Causes:
- Not a member of the `Bible-Innovation-Lab` GitHub org. Ask the program admin to add you.
- Your GitHub auth token expired. Run `gh auth refresh`.
- Your repo isn't owned by the BIL org. Re-fork from the template under the org.

## `APPID_TAKEN`

Another product already claimed that app-id. Pick a different one:
- Subdomain-safe: `^[a-z][a-z0-9-]{2,30}$` (lowercase letters, numbers, dashes; starts with letter; 3-31 chars).
- Avoid the denylist: `www, api, admin, app, auth, mail, ftp, blog, docs, status, dashboard, youversion, yv, bibleinnovationlab, bil, internal, staging, dev, test, demo`.

## `DNS_PENDING` after first deploy

The wildcard cert at Vercel can take 5-60 minutes on first attach. Check
the Vercel dashboard for your project → Domains. Look for "Pending DNS"
or "Provisioning certificate." If it's been longer than an hour:
- Confirm GoDaddy DNS still has the `*` → `cname.vercel-dns.com` record.
- Try removing and re-adding the domain in the Vercel project.

## `BUILD_FAILED_TS` — typecheck fails on push

CI runs `bunx tsc --noEmit` on every PR. To run locally before pushing:
```bash
bunx tsc --noEmit
```
Common fixes:
- Missing return type → add it.
- `any` from an external lib → `unknown` + narrow with a type guard.
- Path alias not resolving → check `tsconfig.json` `paths`.

## `MIDDLEWARE_BLOCKED_NON_US`

Same as the blank-page-from-VPN issue above. Either disable VPN or set
`NEXT_PUBLIC_DISABLE_GEO=1` for local dev.

## Vercel auto-deploy didn't trigger

After `git push`, Vercel should pick up the change in ~30 seconds. If
nothing happens:
- Check Vercel project → Deployments tab.
- Confirm the GitHub integration is connected (project Settings → Git).
- Check Vercel's status page: status.vercel.com.

## `posthog-node` is missing or wrong version

`bun install` should pull it in. If not:
```bash
bun add posthog-node
```

## Bible JSON looks broken (verses have stray whitespace)

The raw WEB source has trailing spaces and embedded paragraph markers.
`@bil/bible`'s `getVerse` trims whitespace on read. If you import
`books/<book>.json` directly, you'll see the raw text. Always use the
exported functions instead.

## I can't tell if my events are reaching PostHog

In `bun run dev`, every `track()` call logs to the terminal:
```
[bil-analytics] event_name { app_id: "...", browser: "...", ... }
```
If you see that, the beacon works. If PostHog dashboard is empty:
- Confirm `POSTHOG_KEY` is set in `.env.local`.
- PostHog Live Events tab: paste your project's Live URL.
- Wait ~30 seconds; PostHog ingestion isn't instant.
