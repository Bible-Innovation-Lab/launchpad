/**
 * @bil/share — server-rendered OG cards for social scrapers.
 *
 * Use `ogImageResponse(...)` from a route at `/og/route.tsx` or
 * `/api/og/route.tsx` to render a 1200×630 PNG. Twitter, Facebook,
 * Slack, iMessage all hit this URL when they preview a shared link.
 *
 * Cache aggressively at the edge — the same (date, score) shape produces
 * the same image, so we hand back a `Cache-Control: immutable` header.
 */

import { ImageResponse } from "@vercel/og";

export const OG_SIZE = { width: 1200, height: 630 } as const;

export type OgGridOpts = {
  title: string; // e.g. "Bible Trivia"
  subtitle?: string; // e.g. "2026-05-11"
  rows: ("correct" | "incorrect" | "empty")[][];
  caption?: string; // e.g. "3/5" or "Got it in 3"
};

const COLORS = {
  correct: "#10b981",
  incorrect: "#6b7280",
  empty: "#e5e7eb",
} as const;

export function ogImageResponse(opts: OgGridOpts): ImageResponse {
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
          padding: 60,
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 600, color: "#18181b" }}>{opts.title}</div>
        {opts.subtitle ? (
          <div style={{ fontSize: 28, color: "#71717a", marginTop: 8 }}>{opts.subtitle}</div>
        ) : null}
        {opts.caption ? (
          <div style={{ fontSize: 36, color: "#27272a", marginTop: 16 }}>{opts.caption}</div>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 32 }}>
          {opts.rows.map((row, ri) => (
            <div key={ri} style={{ display: "flex", gap: 12 }}>
              {row.map((cell, ci) => (
                <div
                  key={ci}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 12,
                    background: COLORS[cell],
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      headers: {
        // Same (date, score) shape → same image → cache forever.
        "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
      },
    },
  );
}

/**
 * Standard OG <meta> tags for a Next.js page. Spread into your page's
 * `metadata` export.
 */
export function ogMetadata(opts: {
  title: string;
  description?: string;
  imageUrl: string;
  url: string;
}) {
  return {
    openGraph: {
      title: opts.title,
      description: opts.description,
      url: opts.url,
      images: [{ url: opts.imageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: opts.title,
      description: opts.description,
      images: [opts.imageUrl],
    },
  };
}
