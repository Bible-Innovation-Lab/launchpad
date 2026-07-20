"use client";

import type { ReactNode } from "react";
import { CompactHeader } from "./compact-header";
import { PlayLayoutHeader } from "./play-layout-header";
import { ViewportFitShell } from "./viewport-fit-shell";

export type ResponsivePlayLayoutProps = {
	title: string;
	subtitle?: ReactNode;
	headerActions?: ReactNode;
	/** Right-side chrome for both mobile CompactHeader and desktop PlayLayoutHeader. */
	trailing?: ReactNode;
	showHubLink?: boolean;
	sidebar?: ReactNode;
	children: ReactNode;
	mainClassName?: string;
	desktopMainClassName?: string;
};

/**
 * Mobile (max-lg): ViewportFitShell — game fits in 100dvh, no page scroll.
 * Desktop (lg+): wider shell with optional sidebar; scroll permitted.
 */
export function ResponsivePlayLayout({
	title,
	subtitle,
	headerActions,
	trailing,
	showHubLink = false,
	sidebar,
	children,
	mainClassName = "items-center justify-center gap-4",
	desktopMainClassName = "items-center justify-center gap-6",
}: ResponsivePlayLayoutProps) {
	return (
		<>
			<div className="lg:hidden">
				<ViewportFitShell
					header={
						<CompactHeader
							title={title}
							subtitle={subtitle}
							actions={headerActions}
							trailing={trailing}
							showHubLink={showHubLink}
						/>
					}
					mainClassName={mainClassName}
				>
					{children}
				</ViewportFitShell>
			</div>

			<div className="hidden min-h-dvh bg-[var(--background)] text-[var(--foreground)] lg:flex lg:flex-col">
				<PlayLayoutHeader
					title={title}
					actions={headerActions}
					trailing={trailing}
					showHubLink={showHubLink}
				/>
				<div className="mx-auto flex w-full max-w-5xl flex-1 gap-8 px-safe pb-safe py-10">
					<main
						className={["flex flex-1 flex-col", desktopMainClassName].join(" ")}
					>
						{subtitle ? (
							<p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
								{subtitle}
							</p>
						) : null}
						{children}
					</main>
					{sidebar ? (
						<aside className="w-72 shrink-0 border-l border-zinc-200 pl-8 dark:border-zinc-800">
							{sidebar}
						</aside>
					) : null}
				</div>
			</div>
		</>
	);
}
