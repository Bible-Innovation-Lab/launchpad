"use client";

/**
 * @bil/launchpad/shell/hub — hub URL resolution + HubLink.
 *
 * Wrap the app once with `<HubProvider hub={siteConfig.hub}>`. HubLink and
 * getHubLink() read from context (and still respect `process.env.HUB`).
 */

import {
	createContext,
	useContext,
	type ReactNode,
} from "react";
import {
	cameFromBilGame,
	COMMUNITY_HUB_URL,
	getAppContext,
	isStandaloneShell,
	navigateToHub,
	SCRIPTURE_HUB_URL,
} from "./is-standalone-shell";

export const HUBS = {
	scripture: { url: SCRIPTURE_HUB_URL, label: "All games" },
	community: {
		url: COMMUNITY_HUB_URL,
		label: "Community games",
	},
} as const;

export type HubKind = keyof typeof HUBS;

type HubContextValue = {
	hub: HubKind;
};

const HubContext = createContext<HubContextValue | null>(null);

export function resolveHubKind(preferred?: HubKind): HubKind {
	const env = typeof process !== "undefined" ? process.env.HUB?.trim() : undefined;
	if (env === "community") return "community";
	if (env === "scripture") return "scripture";
	return preferred ?? "scripture";
}

export function getHubLink(preferred?: HubKind) {
	return HUBS[resolveHubKind(preferred)];
}

export function HubProvider({
	hub = "scripture",
	children,
}: {
	hub?: HubKind;
	children: ReactNode;
}) {
	const resolved = resolveHubKind(hub);
	return (
		<HubContext.Provider value={{ hub: resolved }}>
			{children}
		</HubContext.Provider>
	);
}

function useHubKind(): HubKind {
	const ctx = useContext(HubContext);
	return resolveHubKind(ctx?.hub);
}

export type HubLinkProps = {
	className?: string;
};

export function HubLink({ className }: HubLinkProps) {
	const hub = useHubKind();
	const { url, label } = HUBS[hub];

	function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
		if (getAppContext() === "native") {
			e.preventDefault();
			navigateToHub(url);
			return;
		}

		if (!isStandaloneShell()) return;

		if (cameFromBilGame() && window.history.length > 1) {
			e.preventDefault();
			window.history.back();
		}
	}

	return (
		<a
			href={url}
			onClick={handleClick}
			className={
				className ??
				"shrink-0 text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
			}
		>
			← {label}
		</a>
	);
}
