/**
 * POST /api/v1/track — analytics endpoint.
 *
 * Pre-made App Router handler. Student template re-exports `POST` from
 * `app/api/v1/track/route.ts` so logic propagates via `bun update`.
 *
 * Always returns 204 (analytics never break the app). Reads the anon-id
 * cookie set by the proxy on first page load, enriches the inbound event
 * with geo + parsed UA, forwards to PostHog. Emits `first_visit` first
 * when the proxy signals via `_lp_fv=1` on cookie mint.
 */

import { NextRequest, NextResponse } from "next/server";
import { capture, parseUA } from "../analytics/server.js";
import type { JSONValue } from "../analytics/client.js";

const APP_ID = process.env.APP_ID ?? "unknown";
const LIB_TAG = "bil-launchpad-server";

type Body = { event: string; props?: Record<string, JSONValue> };

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

  // Enrich server-side. Never trust the client to set these.
  const ua = req.headers.get("user-agent") ?? "";
  const { browser, os } = parseUA(ua);
  const country =
    req.headers.get("x-vercel-ip-country") ?? // Vercel edge geo
    req.headers.get("cf-ipcountry") ?? // Cloudflare
    "unknown";

  const baseProps: Record<string, JSONValue> = {
    app_id: APP_ID,
    $lib: LIB_TAG,
    country,
    browser,
    os,
    ...(body.props ?? {}),
  };

  // If proxy just minted the cookie (one-shot _lp_fv=1), emit first_visit
  // BEFORE the inbound event so funnel ordering is preserved.
  const isFirstVisit = req.cookies.get("_lp_fv")?.value === "1";
  if (isFirstVisit) {
    await capture({
      distinctId: anonId,
      event: "first_visit",
      properties: { app_id: APP_ID, $lib: LIB_TAG, country, browser, os },
      timestamp: new Date(Date.now() - 1),
    });
  }

  await capture({
    distinctId: anonId,
    event: body.event,
    properties: baseProps,
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
