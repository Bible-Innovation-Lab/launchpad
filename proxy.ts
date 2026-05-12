/**
 * Edge proxy (Next.js 16's renamed middleware). Runs on every page request
 * matched by `config.matcher` below.
 *
 * Responsibilities:
 *   1. Bot filter — skip cookie + analytics for known bots.
 *   2. Geo-block — non-US redirects to /coming-soon (v1 is US-only).
 *   3. Anon-cookie mint — first GET mints `_lp_aid` (UUID v4, HttpOnly, 2y).
 *   4. One-shot first-visit signal — sets `_lp_fv=1` cookie so the next
 *      /api/track call can emit `first_visit` before the inbound event.
 *
 * What this does NOT do:
 *   - Rate limiting on /api/track (do that with Upstash Ratelimit when a
 *     real KV store is wired; for v0 the in-process rate is high enough).
 *
 * Note: file is named `proxy.ts` and exports `proxy()` per Next.js 16
 * conventions. (Middleware was renamed to Proxy in v16; same behavior.)
 */

import { NextRequest, NextResponse } from "next/server";

// Bot UAs we never want to count or mint cookies for.
const BOT_RE = /bot\b|crawl|spider|slurp|slackbot|preview|whatsapp|telegram|discordbot|facebookexternalhit|twitterbot|linkedinbot|pingdom|uptimerobot|lighthouse|gtmetrix/i;

// US-only enforcement. Override with NEXT_PUBLIC_DISABLE_GEO=1 for local EU testing.
const US_ONLY = process.env.NEXT_PUBLIC_DISABLE_GEO !== "1";

export const config = {
  // Match everything except Next internals, static assets, and /api routes
  // (the API route handles its own cookie reads).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|coming-soon|.*\\.[a-zA-Z]+$).*)"],
};

export function proxy(req: NextRequest): NextResponse {
  const ua = req.headers.get("user-agent") ?? "";

  // 1) Bot filter — pass through without minting or geo-blocking.
  if (BOT_RE.test(ua)) {
    return NextResponse.next();
  }

  // 2) Geo-block. Vercel sets x-vercel-ip-country; Cloudflare sets cf-ipcountry.
  if (US_ONLY) {
    const country =
      req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry") ?? null;
    if (country && country !== "US" && country !== "unknown") {
      // Don't redirect API calls or already on /coming-soon
      if (!req.nextUrl.pathname.startsWith("/coming-soon")) {
        const url = req.nextUrl.clone();
        url.pathname = "/coming-soon";
        return NextResponse.redirect(url);
      }
    }
  }

  // 3) Mint anon-id cookie if missing.
  const res = NextResponse.next();
  const existing = req.cookies.get("_lp_aid")?.value;
  if (!existing) {
    const id = crypto.randomUUID();
    const cookieOpts = {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
    };
    res.cookies.set("_lp_aid", id, {
      ...cookieOpts,
      maxAge: 60 * 60 * 24 * 365 * 2, // 2 years
    });
    // 4) One-shot signal so the NEXT /api/track call emits first_visit before
    //    the inbound event. The /api/track handler reads this and clears it.
    res.cookies.set("_lp_fv", "1", {
      ...cookieOpts,
      maxAge: 60 * 60 * 24, // 24h safety window
    });
  }
  return res;
}
