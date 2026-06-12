/**
 * @bil/launchpad/analytics/client — client-side beacon.
 *
 * ~1 KB module. Single function: `track(event, props?)`. POSTs to
 * /api/analytics on the student's own deployment (same-origin from the
 * browser; mobile clients hit `<base>/api/analytics` over HTTPS).
 * Fire-and-forget; analytics failures never break the user-facing app.
 *
 * Every beacon carries a device fingerprint hash (`fp`). The server uses
 * the `_lp_aid` cookie as identity when present; otherwise it derives a
 * deterministic anon-id from client IP + fingerprint and sets the cookie
 * on the response. The client never sees the anon-id itself.
 *
 * @example
 *   import { track } from "@bil/launchpad/analytics/client";
 *   track("button_click", { label: "share" });
 */

import { isAutomatedBrowser } from "./bot-filter";
import { deviceFingerprint } from "./fingerprint";

export type JSONValue = string | number | boolean | null | JSONValue[] | { [k: string]: JSONValue };

export function track(event: string, props?: Record<string, JSONValue>): void {
  if (isAutomatedBrowser()) return;
  try {
    void deviceFingerprint()
      .then((fp) =>
        fetch("/api/analytics", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ event, props, fp }),
          keepalive: true, // survives pagehide / navigation
        }),
      )
      .catch(() => {
        // swallow — analytics never break the app
      });
  } catch {
    // synchronous failure (e.g. CSP block); same posture
  }
}
