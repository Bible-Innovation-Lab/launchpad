/**
 * @bil/analytics — server-side PostHog forwarder.
 *
 * Production-only. Local dev (`bun run dev`) NEVER sends to PostHog —
 * events log to the terminal instead. This keeps the central PostHog
 * dashboard free of developer noise (test events, cohort pollution,
 * inflated DAU). Real user traffic only.
 *
 * The POSTHOG_KEY env var is injected into Vercel's production +
 * preview environments by bil-provisioning. Vercel sets NODE_ENV to
 * "production" for both, which is what gates the forwarder.
 *
 * Failures never bubble up; analytics never break user-facing flows.
 */

import { PostHog } from "posthog-node";
import type { JSONValue } from "./client";

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (client) return client;
  // Gate 1: production deployments only.
  if (process.env.NODE_ENV !== "production") return null;
  // Gate 2: key must be present. Should be — bil-provisioning sets it on
  // every Vercel project. If missing in prod, log loudly so platform team
  // sees it in Vercel function logs.
  const key = process.env.POSTHOG_KEY;
  if (!key) {
    console.warn(
      "[bil-analytics] POSTHOG_KEY missing in production — events will not fire",
    );
    return null;
  }
  const host = process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";
  // disableGeoip defaults to true in posthog-node v3+; we re-enable
  // because we pass real client IPs through `$ip` and want PostHog
  // to populate `$geoip_country_code`, `$geoip_city_name`, etc.
  client = new PostHog(key, {
    host,
    flushAt: 1,
    flushInterval: 1000,
    disableGeoip: false,
  });
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
    // Dev: print event to terminal so students can verify their tracking
    // code fires. Never reaches PostHog from local dev — by design.
    if (process.env.NODE_ENV !== "production") {
      console.log("[bil-analytics] (dev)", input.event, input.properties ?? {});
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

