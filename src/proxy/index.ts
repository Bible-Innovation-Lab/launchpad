/**
 * Edge proxy (Next.js 16's renamed middleware). Runs on every page request
 * matched by `config.matcher` below.
 *
 * Identity is no longer minted here. The `_lp_aid` anon-id is derived in
 * /api/analytics from client IP + a device fingerprint computed in the
 * browser, so a lost cookie on the same device + network re-derives the
 * SAME id (see src/routes/analytics.ts). The proxy's remaining job is
 * cleanup: it clears the legacy one-shot `_lp_fv` cookie left behind by
 * older versions. Existing `_lp_aid` cookies stay untouched and remain
 * the identity for returning users.
 *
 * Note: file is named `proxy.ts` and exports `proxy()` per Next.js 16
 * conventions. (Middleware was renamed to Proxy in v16; same behavior.)
 */

import { NextRequest, NextResponse } from "next/server";

export const config = {
  // Match everything except Next internals and static assets. /api routes
  // handle their own cookie reads.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z]+$).*)"],
};

export function proxy(req: NextRequest): NextResponse {
  const res = NextResponse.next();
  // Legacy cleanup: pre-fingerprint versions minted a one-shot _lp_fv
  // cookie here. It is no longer read anywhere; expire it if present.
  if (req.cookies.get("_lp_fv")) {
    res.cookies.set("_lp_fv", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }
  return res;
}
