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
 * The FIRST beacon of a page load is sent alone; later `track()` calls
 * wait for its response before going out. The Set-Cookie from the first
 * response therefore lands before any other request, so a brand-new
 * visitor mints exactly once (and emits exactly one `first_visit`)
 * instead of every concurrent cookie-less beacon minting in parallel.
 * Once the gate resolves, all subsequent beacons fire immediately.
 *
 * @example
 *   import { track } from "@bil/launchpad/analytics/client";
 *   track("button_click", { label: "share" });
 */

import { isAutomatedBrowser } from "./bot-filter";
import { deviceFingerprint } from "./fingerprint";

export type JSONValue = string | number | boolean | null | JSONValue[] | { [k: string]: JSONValue };

/**
 * Completion of the first beacon (success OR failure). `null` until the
 * first `track()` call. Never rejects — failures resolve so queued
 * beacons are released no matter what happened to the first one.
 */
let firstBeaconDone: Promise<void> | null = null;

/**
 * Per-tab session id, minted once per browser tab/open and reused for the
 * life of that tab (`sessionStorage` clears when the tab closes). Lets the
 * server stamp every event with `session_id` for session-duration analysis.
 */
function sessionId(): string {
  try {
    if (typeof sessionStorage === "undefined") return "";
    let sid = sessionStorage.getItem("_lp_sid");
    if (!sid) {
      sid =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem("_lp_sid", sid);
    }
    return sid;
  } catch {
    return ""; // private mode / storage disabled — session time just isn't tracked
  }
}

function send(event: string, props: Record<string, JSONValue> | undefined, fp: string): Promise<void> {
  return fetch("/api/analytics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event, props, fp, sid: sessionId() }),
    keepalive: true, // survives pagehide / navigation
  }).then(
    () => undefined,
    () => undefined, // swallow — analytics never break the app
  );
}

export function track(event: string, props?: Record<string, JSONValue>): void {
  if (isAutomatedBrowser()) return;
  try {
    if (!firstBeaconDone) {
      // First beacon: goes out alone and gates the rest of the page load.
      firstBeaconDone = deviceFingerprint().then(
        (fp) => send(event, props, fp),
        () => undefined,
      );
      return;
    }
    void firstBeaconDone
      .then(() => deviceFingerprint())
      .then((fp) => send(event, props, fp))
      .catch(() => {
        // swallow — analytics never break the app
      });
  } catch {
    // synchronous failure (e.g. CSP block); same posture
  }
}
