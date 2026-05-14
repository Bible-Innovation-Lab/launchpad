/**
 * Edge proxy (Next.js 16's renamed middleware). Runs on every page request
 * matched by `config.matcher` below.
 *
 * Responsibilities:
 *   1. Bot filter — skip cookie + analytics for known bots.
 *   2. Anon-cookie mint — first GET mints `_lp_aid` (UUID v4, HttpOnly, 2y).
 *   3. One-shot first-visit signal — sets `_lp_fv=1` cookie so the next
 *      /api/track call can emit `first_visit` before the inbound event.
 *
 * Note: file is named `proxy.ts` and exports `proxy()` per Next.js 16
 * conventions. (Middleware was renamed to Proxy in v16; same behavior.)
 */

import { NextRequest, NextResponse } from "next/server";

// Bot UAs we never want to count or mint cookies for.
const BOT_RE = /bot\b|crawl|spider|slurp|slackbot|preview|whatsapp|telegram|discordbot|facebookexternalhit|twitterbot|linkedinbot|pingdom|uptimerobot|lighthouse|gtmetrix/i;

export const config = {
  // Match everything except Next internals and static assets. /api routes
  // handle their own cookie reads.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z]+$).*)"],
};

export function proxy(req: NextRequest): NextResponse {
  const ua = req.headers.get("user-agent") ?? "";

  // 1) Bot filter — pass through without minting.
  if (BOT_RE.test(ua)) {
    return NextResponse.next();
  }

  // 2) Mint anon-id cookie if missing.
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
    // 3) One-shot signal so the NEXT /api/track call emits first_visit before
    //    the inbound event. The /api/track handler reads this and clears it.
    res.cookies.set("_lp_fv", "1", {
      ...cookieOpts,
      maxAge: 60 * 60 * 24, // 24h safety window
    });
  }
  return res;
}
