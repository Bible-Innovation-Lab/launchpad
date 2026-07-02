/**
 * @bil/launchpad/analytics/session-timer — in-app engagement time.
 *
 * Measures *active* (foreground) time spent in the app and reports it via
 * the existing `/api/analytics` beacon, so "time in app" is measurable for
 * every player — including those who never complete a game.
 *
 * Two events, both stamped with `session_id` + `app_id` server-side:
 *
 * - `heartbeat` — fired every `intervalMs` (default 20s) while the tab is
 *   visible, carrying the cumulative active `elapsed_ms` so far. Gives a
 *   lower bound on session length even if the leave event is dropped.
 * - `$pageleave` — PostHog's standard leave event, flushed when the tab is
 *   hidden/deactivated (`visibilitychange` → `hidden`) and on `pagehide`,
 *   carrying the final active `elapsed_ms`.
 *
 * "Active" means foreground: time while the tab is hidden is not counted, so
 * a game left open in a background tab does not inflate the metric.
 *
 * Wired into `<PageViewTracker />`, which student apps already mount once in
 * `app/layout.tsx` — so this needs zero per-app changes.
 */

import { useEffect } from "react";
import { track } from "./client";

/** Monotonic-ish millisecond clock; `performance.now()` when available. */
function defaultNow(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

export interface SessionClock {
  /** Cumulative active milliseconds, rounded to an integer. */
  elapsedMs(): number;
  /** Stop counting (tab hidden). Idempotent. */
  pause(): void;
  /** Resume counting (tab visible). Idempotent. */
  resume(): void;
}

/**
 * Accumulates active time across pause/resume cycles. Pure and clock-injectable
 * so the accounting logic is unit-testable without timers or a DOM.
 *
 * Starts running immediately; call `pause()` right away if the page begins in
 * a hidden state.
 */
export function createSessionClock(now: () => number = defaultNow): SessionClock {
  let accumulated = 0;
  let runningSince: number | null = now();
  return {
    elapsedMs(): number {
      const live = runningSince === null ? 0 : now() - runningSince;
      return Math.round(accumulated + live);
    },
    pause(): void {
      if (runningSince !== null) {
        accumulated += now() - runningSince;
        runningSince = null;
      }
    },
    resume(): void {
      if (runningSince === null) {
        runningSince = now();
      }
    },
  };
}

/**
 * Tracks active in-app time for the life of the mounting component and reports
 * it via `heartbeat` (every `intervalMs`) and `$pageleave` (on hide / pagehide).
 *
 * Safe on the server (no-op until the effect runs in the browser). Cleans up
 * its interval and listeners on unmount.
 */
export function useSessionTimer(intervalMs = 20_000): void {
  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return;

    const clock = createSessionClock();
    if (document.visibilityState === "hidden") clock.pause();

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        track("heartbeat", { elapsed_ms: clock.elapsedMs() });
      }
    }, intervalMs);

    const flush = (): void => {
      track("$pageleave", { elapsed_ms: clock.elapsedMs() });
    };

    const onVisibilityChange = (): void => {
      if (document.visibilityState === "hidden") {
        clock.pause();
        flush();
      } else {
        clock.resume();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flush);

    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flush);
    };
  }, [intervalMs]);
}
