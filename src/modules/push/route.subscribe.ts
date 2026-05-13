/**
 * modules/push — subscription endpoint.
 * Copy to app/api/push/subscribe/route.ts to enable.
 *
 * Stores subscriptions in Vercel KV keyed by anon-id cookie.
 * Run `bun add @vercel/kv` first.
 */

import { NextRequest, NextResponse } from "next/server";
// import { kv } from "@vercel/kv";  // <-- uncomment after `bun add @vercel/kv`

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const anonId = req.cookies.get("_lp_aid")?.value;
  if (!anonId) return NextResponse.json({ error: "no_session" }, { status: 401 });

  const subscription = await req.json();
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
  }

  // Persist. App-scoped key so multiple products on the same domain don't clash.
  const appId = process.env.APP_ID ?? "unknown";
  const key = `push:${appId}:${anonId}`;

  // Uncomment after adding @vercel/kv:
  // await kv.set(key, subscription, { ex: 60 * 60 * 24 * 365 }); // 1y TTL

  console.log(`[push] would persist subscription at key ${key}`);
  return NextResponse.json({ ok: true });
}
