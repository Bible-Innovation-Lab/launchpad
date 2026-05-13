/**
 * GET /api/v1/health — liveness check.
 *
 * Pre-made App Router handler. Student template's
 * `app/api/v1/health/route.ts` re-exports `GET` from this file.
 *
 * Returns 200 with a timestamp. No auth, no side effects. Used by external
 * uptime monitors (Pingdom / Better Stack) to verify each student app is
 * serving traffic. Also useful as the simplest sanity check that the
 * package is wired correctly.
 */

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    app_id: process.env.APP_ID ?? "unknown",
    ts: new Date().toISOString(),
  });
}
