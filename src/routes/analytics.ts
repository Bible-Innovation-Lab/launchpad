/**
 * POST /api/analytics — analytics endpoint.
 *
 * Pre-made App Router handler. Student template re-exports `POST` from
 * `app/api/analytics/route.ts` so logic propagates via `bun update`.
 *
 * Identity: the `_lp_aid` cookie is the anon-id when present. When absent,
 * the id is DERIVED deterministically from client IP + the device
 * fingerprint the beacon carries (`fp`), then cached in the cookie. Losing
 * the cookie on the same device + network therefore re-derives the SAME id
 * — returning users reconnect to their history instead of being counted
 * as new. (Identical device models behind one NAT can still collide; the
 * cookie minimizes this to mint-time only.)
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

type Body = { event: string; props?: Record<string, JSONValue>; fp?: string; sid?: string };

function clientIp(req: NextRequest): string | undefined {
  // Vercel sets x-forwarded-for as "<client>, <edge>"; first entry is client.
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || undefined;
  return req.headers.get("x-real-ip") ?? undefined;
}

/**
 * Deterministic anon-id: sha256(ip|fingerprint) rendered in UUID shape so
 * downstream tooling treats it like the previous crypto.randomUUID() ids.
 */
async function deriveAnonId(ip: string, fp: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${ip}|${fp}`),
  );
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
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

  // Identity resolution. Cookie wins (stable across network changes);
  // otherwise derive from IP + device fingerprint and cache in the cookie.
  let anonId = req.cookies.get("_lp_aid")?.value;
  let minted = false;
  if (!anonId) {
    const fp = typeof body.fp === "string" ? body.fp.trim().slice(0, 128) : "";
    if (!fp) {
      // No cookie and no fingerprint: bot, prefetch, or curl. Drop
      // silently — 204 to look like every other call.
      return new NextResponse(null, { status: 204 });
    }
    anonId = await deriveAnonId(ip ?? "", fp);
    minted = true;
  }

  const enrichment: Record<string, JSONValue> = { app_id: APP_ID };
  if (ua) enrichment.$useragent = ua;
  if (ip) enrichment.$ip = ip;
  // Per-tab session id (minted client-side) — stamps every event so session
  // duration is computable from first/last timestamp per session_id.
  const sid = typeof body.sid === "string" ? body.sid.trim().slice(0, 64) : "";
  if (sid) enrichment.session_id = sid;

  // First sighting of this identity (no cookie yet): emit first_visit
  // BEFORE the inbound event so funnel ordering is preserved. Re-mints on
  // the same device+network re-derive the same id, so first_visit uniques
  // stay correct even when this fires again after a cookie loss.
  if (minted) {
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
  if (minted) {
    res.cookies.set("_lp_aid", anonId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 2, // 2 years
    });
  }
  return res;
}
