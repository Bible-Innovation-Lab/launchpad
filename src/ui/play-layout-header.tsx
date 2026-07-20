"use client";

import type { ReactNode } from "react";
import { HubLink } from "../shell/hub";

export type PlayLayoutHeaderProps = {
	title: string;
	actions?: ReactNode;
	trailing?: ReactNode;
	leading?: ReactNode;
	showHubLink?: boolean;
};

/** Desktop header used by ResponsivePlayLayout — not the app-wide AppHeader. */
export function PlayLayoutHeader({
	title,
	actions,
	trailing,
	leading,
	showHubLink = true,
}: PlayLayoutHeaderProps) {
	const leadingNode = leading ?? (showHubLink ? <HubLink /> : null);

	return (
		<header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-[var(--background)]/95 pt-safe backdrop-blur dark:border-zinc-800">
			<div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-safe py-3">
				<div className="flex min-w-0 items-center gap-2">
					{leadingNode}
					<h1 className="truncate text-sm font-semibold">{title}</h1>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{actions}
					{trailing}
				</div>
			</div>
		</header>
	);
}
