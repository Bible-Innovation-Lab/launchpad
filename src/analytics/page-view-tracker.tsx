"use client";

/**
 * @bil/launchpad/analytics/page-view-tracker — drop-in auto $pageview + session time.
 *
 * Render once in `app/layout.tsx` inside `<body>`. Fires
 * `track("$pageview", { path })` on initial mount and on every
 * client-side route change. Renders no DOM.
 *
 * The first $pageview POST from a new identity also emits `first_visit`
 * (minted in the analytics route), so a student app gets both events
 * with zero wiring.
 *
 * It also runs the session timer (`useSessionTimer`), which reports active
 * in-app time via `heartbeat` (every 20s while visible) and `$pageleave`
 * (on tab hide / pagehide) — so "time in app" is measurable for every
 * player, including those who never finish a game. Zero extra wiring.
 */

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { track } from "./client";
import { useSessionTimer } from "./session-timer";

export function PageViewTracker(): null {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    track("$pageview", { path: pathname });
  }, [pathname]);
  useSessionTimer();
  return null;
}
