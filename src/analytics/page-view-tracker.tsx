"use client";

/**
 * @bil/launchpad/analytics/page-view-tracker — drop-in auto $pageview.
 *
 * Render once in `app/layout.tsx` inside `<body>`. Fires
 * `track("$pageview", { path })` on initial mount and on every
 * client-side route change. Renders no DOM.
 *
 * The first $pageview POST from a new identity also emits `first_visit`
 * (minted in the analytics route), so a student app gets both events
 * with zero wiring.
 */

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { track } from "./client";

export function PageViewTracker(): null {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    track("$pageview", { path: pathname });
  }, [pathname]);
  return null;
}
