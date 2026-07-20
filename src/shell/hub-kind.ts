/**
 * Hub kind resolution — safe for Server Components.
 * Prefer calling `resolveHubKind(siteConfig.hub)` in a server layout and
 * passing the result into `<HubProvider hub={...}>` so `HUB` env overrides
 * survive client hydration (non-NEXT_PUBLIC env is unavailable in the browser).
 */

import { COMMUNITY_HUB_URL, SCRIPTURE_HUB_URL } from "./is-standalone-shell";

export const HUBS = {
	scripture: { url: SCRIPTURE_HUB_URL, label: "All games" },
	community: {
		url: COMMUNITY_HUB_URL,
		label: "Community games",
	},
} as const;

export type HubKind = keyof typeof HUBS;

/**
 * Resolve which hub to link to. `HUB=community` / `HUB=scripture` overrides
 * `preferred` (typically `siteConfig.hub`).
 */
export function resolveHubKind(preferred?: HubKind): HubKind {
	const env = typeof process !== "undefined" ? process.env.HUB?.trim() : undefined;
	if (env === "community") return "community";
	if (env === "scripture") return "scripture";
	return preferred ?? "scripture";
}

export function getHubLink(preferred?: HubKind) {
	return HUBS[resolveHubKind(preferred)];
}
