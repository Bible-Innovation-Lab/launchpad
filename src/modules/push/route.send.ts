/**
 * modules/push — fan-out send endpoint.
 * Copy to app/api/push/send/route.ts to enable.
 *
 * Trigger from a Vercel Cron Job at your daily push time (e.g., 9am UTC).
 * Protected by a shared CRON_SECRET; cron job sends it as a header.
 *
 * Run `bun add @vercel/kv web-push` first.
 */

import { NextRequest, NextResponse } from "next/server";
// import { kv } from "@vercel/kv";
// import webpush from "web-push";

export const runtime = "nodejs";

const APP_ID = process.env.APP_ID ?? "unknown";

export async function POST(req: NextRequest) {
  // Auth: only Vercel Cron or admin tools can trigger this.
  const cronSecret = process.env.CRON_SECRET;
  if (req.headers.get("x-cron-secret") !== cronSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { title, body, url } = (await req.json()) as {
    title: string;
    body: string;
    url?: string;
  };

  // Uncomment after `bun add web-push`:
  // webpush.setVapidDetails(
  //   process.env.VAPID_SUBJECT!,
  //   process.env.VAPID_PUBLIC_KEY!,
  //   process.env.VAPID_PRIVATE_KEY!
  // );
  //
  // const keys = await kv.keys(`push:${APP_ID}:*`);
  // let sent = 0;
  // let failed = 0;
  // for (const key of keys) {
  //   const sub = await kv.get(key);
  //   try {
  //     await webpush.sendNotification(
  //       sub as any,
  //       JSON.stringify({ title, body, url })
  //     );
  //     sent++;
  //   } catch (err) {
  //     // 410/404 = subscription expired; delete it
  //     if ((err as any).statusCode === 410 || (err as any).statusCode === 404) {
  //       await kv.del(key);
  //     }
  //     failed++;
  //   }
  // }
  // return NextResponse.json({ sent, failed });

  console.log(`[push] would send "${title}" — ${body} (url: ${url ?? "/"})`);
  return NextResponse.json({ ok: true, sent: 0, failed: 0 });
}
