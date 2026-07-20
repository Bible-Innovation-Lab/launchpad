"use client";

/**
 * @bil/launchpad/shell/hub — HubProvider + HubLink (client).
 *
 * Resolve hub on the server with `@bil/launchpad/shell/hub-kind`
 * (`resolveHubKind(siteConfig.hub)` respects `process.env.HUB`), then pass
 * the result into `<HubProvider hub={...}>`. Do not call `resolveHubKind`
 * from client code — non-NEXT_PUBLIC env is unavailable in the browser.
 */

import {
	createContext,
	useContext,
	type ReactNode,
} from "react";
import {
	getAppContext,
	isStandaloneShell,
	navigateToHub,
} from "./is-standalone-shell";
import { HUBS, type HubKind } from "./hub-kind";

export { HUBS, type HubKind };
// resolveHubKind / getHubLink live only on `@bil/launchpad/shell/hub-kind`
// so they are not pulled into the client bundle via this entry.

type HubContextValue = {
	hub: HubKind;
};

const HubContext = createContext<HubContextValue | null>(null);

export function HubProvider({
	hub,
	children,
}: {
	/** Already-resolved hub kind from the server layout. Required. */
	hub: HubKind;
	children: ReactNode;
}) {
	return (
		<HubContext.Provider value={{ hub }}>
			{children}
		</HubContext.Provider>
	);
}

function useHubKind(): HubKind {
	const ctx = useContext(HubContext);
	if (!ctx) {
		if (process.env.NODE_ENV !== "production") {
			console.warn(
				"@bil/launchpad/shell/hub: HubLink used outside HubProvider; defaulting to scripture.",
			);
		}
		return "scripture";
	}
	return ctx.hub;
}

export type HubLinkProps = {
	className?: string;
};

export function HubLink({ className }: HubLinkProps) {
	const hub = useHubKind();
	const { url, label } = HUBS[hub];

	function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
		// Always target the hub URL. Do not use history.back() — after SPA
		// navigations document.referrer is stale and back() can land on a
		// previous in-app route instead of the hub.
		if (getAppContext() === "native" || isStandaloneShell()) {
			e.preventDefault();
			navigateToHub(url);
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
