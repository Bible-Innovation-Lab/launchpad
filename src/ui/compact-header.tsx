"use client";

import type { ReactNode } from "react";
import { HubLink } from "../shell/hub";

export type CompactHeaderProps = {
	title: string;
	subtitle?: ReactNode;
	/** Extra controls between title and trailing (e.g. score chips). */
	actions?: ReactNode;
	/**
	 * Right-side chrome. Pass ThemeToggle / DailyReminders from the app.
	 * When omitted, nothing is rendered on the right beyond `actions`.
	 */
	trailing?: ReactNode;
	/** Optional override for the left slot (defaults to HubLink when showHubLink). */
	leading?: ReactNode;
	showHubLink?: boolean;
};

export function CompactHeader({
	title,
	subtitle,
	actions,
	trailing,
	leading,
	showHubLink = false,
}: CompactHeaderProps) {
	const leadingNode = leading ?? (showHubLink ? <HubLink /> : null);

	return (
		<header className="shrink-0 border-b border-zinc-200/80 bg-[var(--background)]/95 pt-safe backdrop-blur dark:border-zinc-800">
			<div className="mx-auto flex w-full max-w-md items-center justify-between gap-2 px-safe py-2.5">
				<div className="flex min-w-0 flex-1 flex-col gap-0.5">
					<div className="flex min-w-0 items-center gap-2">
						{leadingNode}
						<h1 className="truncate text-sm font-semibold">{title}</h1>
					</div>
					{subtitle ? (
						<div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
							{subtitle}
						</div>
					) : null}
				</div>
				<div className="flex shrink-0 items-center gap-1.5">
					{actions}
					{trailing}
				</div>
			</div>
		</header>
	);
}
