/**
 * @bil/launchpad/analytics/client — client-side beacon.
 *
 * ~1 KB module. Single function: `track(event, props?)`. POSTs to
 * /api/track on the student's own deployment (same-origin from the
 * browser; mobile clients hit `<base>/api/track` over HTTPS).
 * Fire-and-forget; analytics failures never break the user-facing app.
 *
 * The server endpoint reads the `_lp_aid` cookie (set by the proxy on
 * first page load) and enriches with geo + parsed UA before forwarding
 * to PostHog. The client never sees the anon-id and never sets the cookie.
 *
 * @example
 *   import { track } from "@bil/launchpad/analytics/client";
 *   track("button_click", { label: "share" });
 */

export type JSONValue = string | number | boolean | null | JSONValue[] | { [k: string]: JSONValue };

export function track(event: string, props?: Record<string, JSONValue>): void {
  try {
    void fetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event, props }),
      keepalive: true, // survives pagehide / navigation
    }).catch(() => {
      // swallow — analytics never break the app
    });
  } catch {
    // synchronous failure (e.g. CSP block); same posture
  }
}
