/**
 * GET /api/v1/og — generic OG card.
 *
 * Pre-made App Router handler. Student template's `app/api/v1/og/route.tsx`
 * re-exports `GET` from this file AND declares `export const runtime = "edge"`
 * literally (Next.js 16 doesn't allow re-exported runtime declarations).
 *
 * Returns a 1200×630 PNG that says "{APP_ID}" — a generic placeholder so
 * social scrapers (Twitter, Slack, iMessage) get a non-broken image even
 * before the student writes their own. Students who want custom OG cards
 * add `app/api/og/route.tsx` (without /v1) in their template and use
 * `ogImageResponse` from `@bil/launchpad/share/server` directly.
 */

import { ImageResponse } from "@vercel/og";

const APP_ID = process.env.APP_ID ?? "BIL App";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 600, color: "#18181b" }}>{APP_ID}</div>
        <div style={{ fontSize: 28, color: "#71717a", marginTop: 16 }}>
          Built on BIL Launchpad
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
      },
    }
  );
}
