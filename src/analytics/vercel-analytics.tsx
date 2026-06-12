"use client";

/**
 * @bil/launchpad/analytics/vercel-analytics — Vercel Web Analytics beacon.
 *
 * Render once in `app/layout.tsx` alongside `<PageViewTracker />`. Requires
 * Web Analytics enabled on the Vercel project (bil-provisioning does this
 * on first provision). Redundant with PostHog — intentional backup stream.
 *
 * Does not track in local dev (same as @vercel/analytics defaults).
 */

import { Analytics } from "@vercel/analytics/next";

export function VercelAnalytics() {
  return <Analytics />;
}
