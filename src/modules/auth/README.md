# modules/auth — Sign-in (opt-in)

Default: **OFF**. The launchpad's default identity model is the anonymous
`_lp_aid` cookie. Enable this module when your product needs cross-device
state (streaks, history, social features).

Uses [NextAuth.js v5](https://authjs.dev) with Apple + Google providers.

## Why opt-in, not default

- Most daily-puzzle products don't need login. Forcing it on every product
  adds OAuth setup time + a sign-in prompt that suppresses early retention.
- Solves the iOS Safari ITP cookie-wipe problem: if your product depends on
  streaks across days, anonymous cookies will eventually be cleared and
  retention math under-counts. Login fixes that.

## Enable (4 steps)

1. **Install NextAuth:**
   ```bash
   bun add next-auth@beta
   ```

2. **Copy the module files into your app:**
   ```
   modules/auth/auth.config.ts    →  auth.config.ts
   modules/auth/auth.ts            →  auth.ts
   modules/auth/SignInButton.tsx   →  components/SignInButton.tsx
   ```

3. **Generate a secret and set OAuth credentials in `.env.local`:**
   ```bash
   echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env.local
   ```
   Then add:
   ```
   AUTH_GOOGLE_ID=...
   AUTH_GOOGLE_SECRET=...
   AUTH_APPLE_ID=...
   AUTH_APPLE_SECRET=...
   ```
   - Google: create OAuth credentials at https://console.cloud.google.com/apis/credentials. Add `https://<your-app>.bibleinnovationlab.org/api/auth/callback/google` to authorized redirects.
   - Apple: register at https://developer.apple.com/account/resources/services/list (paid Developer account required).

4. **Add the auth route handler and wrap your layout:**

   Create `app/api/auth/[...nextauth]/route.ts`:
   ```ts
   export { GET, POST } from "@/auth";
   ```

   Optionally wrap `app/layout.tsx` with a session provider (only needed
   for client-side `useSession`):
   ```tsx
   import { SessionProvider } from "next-auth/react";
   export default function RootLayout({ children }) {
     return <html><body><SessionProvider>{children}</SessionProvider></body></html>;
   }
   ```

## Use it

Server component:
```tsx
import { auth } from "@/auth";
const session = await auth();
if (session?.user) console.log("Signed in as", session.user.email);
```

Client component:
```tsx
"use client";
import { useSession, signIn, signOut } from "next-auth/react";
const { data: session } = useSession();
```

## Integrate with analytics

When a user signs in, you can attribute their pre-sign-in anonymous events
to their account by sending an `$identify` PostHog event tying the anon-id
to the user-id. The pattern:

```ts
// after successful sign-in
track("user_identified", { user_id: session.user.email });
```

PostHog's "identify" model handles the rest server-side. See PostHog docs
on aliasing anonymous users to identified users.

## Cost

- NextAuth itself: free, no external dependency (besides your OAuth providers).
- Apple Developer account: $99/year if you want Sign-in-with-Apple.
- Google OAuth: free.

## Not included (write yourself if needed)

- Account deletion endpoint (GDPR-style "delete my account" — not v1).
- Session migration tooling.
- Multi-device session list.
