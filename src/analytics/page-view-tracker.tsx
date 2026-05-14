"use client";

/**
 * @bil/launchpad/analytics/page-view-tracker — drop-in auto page_view.
 *
 * Render once in `app/layout.tsx` inside `<body>`. Fires
 * `track("page_view", { path })` on initial mount and on every
 * client-side route change. Renders no DOM.
 *
 * Pair with the launchpad proxy's `_lp_fv` first-visit signal: the first
 * page_view POST to /api/v1/track will emit `first_visit` alongside it,
 * so a student app gets both events with zero wiring.
 */

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { track } from "./client";

export function PageViewTracker(): null {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    track("page_view", { path: pathname });
  }, [pathname]);
  return null;
}
