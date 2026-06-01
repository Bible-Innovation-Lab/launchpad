/**
 * POST /api/analytics — analytics endpoint.
 *
 * Pre-made App Router handler. Student template re-exports `POST` from
 * `app/api/analytics/route.ts` so logic propagates via `bun update`.
 *
 * Forwards events to PostHog's HTTP capture endpoint directly — no SDK,
 * no batching, no extra deps. Passes raw `$useragent` and `$ip` so
 * PostHog's pipeline auto-derives `$browser` (via the User Agent
 * Populator CDP app — enable it once in the PostHog UI) and the
 * `$geoip_*` family. Always returns 204 — analytics never break
 * user-facing flows.
 *
 * Production-only. In dev, events log to stdout instead so the central
 * PostHog dashboard stays free of developer noise.
 */

import { NextRequest, NextResponse } from "next/server";
import { isBotUserAgent } from "../analytics/bot-filter";
import type { JSONValue } from "../analytics/client";

const APP_ID = process.env.APP_ID ?? "unknown";
const POSTHOG_HOST = process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";

type Body = { event: string; props?: Record<string, JSONValue> };

function clientIp(req: NextRequest): string | undefined {
  // Vercel sets x-forwarded-for as "<client>, <edge>"; first entry is client.
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || undefined;
  return req.headers.get("x-real-ip") ?? undefined;
}

async function capture(payload: {
  distinctId: string;
  event: string;
  properties: Record<string, JSONValue>;
  timestamp: Date;
}): Promise<void> {
  // Production gate. Dev logs to stdout so developer test events never
  // pollute the central PostHog dashboard.
  if (process.env.NODE_ENV !== "production") {
    console.log("[bil-analytics] (dev)", payload.event, payload.properties);
    return;
  }
  const key = process.env.POSTHOG_KEY;
  if (!key) {
    console.warn("[bil-analytics] POSTHOG_KEY missing in production — event dropped");
    return;
  }
  try {
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        event: payload.event,
        distinct_id: payload.distinctId,
        properties: payload.properties,
        timestamp: payload.timestamp.toISOString(),
      }),
    });
  } catch (err) {
    console.warn("[bil-analytics] capture failed:", err);
  }
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
  // $os, $geoip_* from these server-side.
  const ua = req.headers.get("user-agent") ?? "";
  if (isBotUserAgent(ua)) {
    return new NextResponse(null, { status: 204 });
  }
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
