/**
 * POST /api/track — analytics endpoint.
 *
 * Pre-made App Router handler. Student template re-exports `POST` from
 * `app/api/track/route.ts` so logic propagates via `bun update`.
 *
 * Always returns 204 (analytics never break the app). Reads the anon-id
 * cookie set by the proxy on first page load, forwards the client's
 * `User-Agent` + IP as PostHog's `$useragent` + `$ip` properties (PostHog
 * derives `$browser`, `$os`, `$geoip_*` server-side), then captures the
 * inbound event. Emits `first_visit` first when the proxy signals via
 * `_lp_fv=1` on cookie mint.
 *
 * One-time PostHog UI step: enable the "User Agent Populator" CDP app
 * for `$browser` / `$browser_version` auto-derivation.
 */

import { NextRequest, NextResponse } from "next/server";
import { capture } from "../analytics/server";
import type { JSONValue } from "../analytics/client";

const APP_ID = process.env.APP_ID ?? "unknown";

type Body = { event: string; props?: Record<string, JSONValue> };

function clientIp(req: NextRequest): string | undefined {
  // Vercel sets x-forwarded-for as "<client>, <edge>"; first entry is client.
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || undefined;
  return req.headers.get("x-real-ip") ?? undefined;
}

export async function POST(req: NextRequest) {
  const anonId = req.cookies.get("_lp_aid")?.value;
  if (!anonId) {
    // No cookie means proxy didn't mint one. Bot, prefetch, or curl.
    // Drop silently — return 204 to look like every other call.
    return new NextResponse(null, { status: 204 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  if (!body.event || typeof body.event !== "string") {
    return new NextResponse(null, { status: 204 });
  }

  // Forward the raw client UA + IP — PostHog auto-derives $browser,
  // $os, $geoip_* from these. Never trust the client to set them.
  const ua = req.headers.get("user-agent") ?? "";
  const ip = clientIp(req);

  const enrichment: Record<string, JSONValue> = { app_id: APP_ID };
  if (ua) enrichment.$useragent = ua;
  if (ip) enrichment.$ip = ip;

  // If proxy just minted the cookie (one-shot _lp_fv=1), emit first_visit
  // BEFORE the inbound event so funnel ordering is preserved.
  const isFirstVisit = req.cookies.get("_lp_fv")?.value === "1";
  if (isFirstVisit) {
    await capture({
      distinctId: anonId,
      event: "first_visit",
      properties: enrichment,
      timestamp: new Date(Date.now() - 1),
    });
  }

  await capture({
    distinctId: anonId,
    event: body.event,
    properties: { ...enrichment, ...(body.props ?? {}) },
    timestamp: new Date(),
  });

  const res = new NextResponse(null, { status: 204 });
  // Clear the one-shot first-visit signal so it only fires once.
  if (isFirstVisit) {
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
