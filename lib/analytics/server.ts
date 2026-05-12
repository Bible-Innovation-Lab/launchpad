/**
 * @bil/analytics — server-side PostHog forwarder.
 *
 * Used by app/api/track/route.ts. Falls back to console logging when
 * POSTHOG_KEY is unset (local dev). Failures never bubble up; analytics
 * never break user-facing flows.
 */

import { PostHog } from "posthog-node";
import type { JSONValue } from "./client";

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (client) return client;
  const key = process.env.POSTHOG_KEY;
  const host = process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";
  if (!key) return null;
  client = new PostHog(key, { host, flushAt: 1, flushInterval: 1000 });
  return client;
}

export type CaptureInput = {
  distinctId: string;
  event: string;
  properties?: Record<string, JSONValue>;
  timestamp?: Date;
};

export async function capture(input: CaptureInput): Promise<void> {
  const ph = getClient();
  if (!ph) {
    // Dev fallback. Visible in `bun run dev` output so students can
    // verify their events fire without hooking PostHog up first.
    if (process.env.NODE_ENV !== "production") {
      console.log("[bil-analytics] (no POSTHOG_KEY)", input.event, input.properties ?? {});
    }
    return;
  }
  try {
    ph.capture({
      distinctId: input.distinctId,
      event: input.event,
      properties: input.properties,
      timestamp: input.timestamp,
    });
  } catch (err) {
    // Log but never throw. Dashboard link helps students debug.
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[bil-analytics] PostHog capture failed:",
        err,
        "— check PostHog dashboard:",
        process.env.POSTHOG_HOST ?? "https://us.i.posthog.com",
      );
    }
  }
}

// Quickly classify a user-agent string into {browser, os} so PostHog
// gets useful low-cardinality dimensions instead of the raw UA blob.
export function parseUA(ua: string): { browser: string; os: string } {
  let os = "other";
  if (/windows nt/i.test(ua)) os = "windows";
  else if (/mac os x|macintosh/i.test(ua)) os = "macos";
  else if (/android/i.test(ua)) os = "android";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "ios";
  else if (/linux/i.test(ua)) os = "linux";

  let browser = "other";
  if (/edg\//i.test(ua)) browser = "edge";
  else if (/firefox\//i.test(ua)) browser = "firefox";
  else if (/chrome\//i.test(ua)) browser = "chrome";
  else if (/safari\//i.test(ua)) browser = "safari";

  return { browser, os };
}
