"use client";

import { useId, useState, type ReactNode } from "react";

export type CollapsibleSectionProps = {
	title: string;
	children: ReactNode;
	defaultOpen?: boolean;
	className?: string;
};

export function CollapsibleSection({
	title,
	children,
	defaultOpen = false,
	className = "",
}: CollapsibleSectionProps) {
	const [open, setOpen] = useState(defaultOpen);
	const panelId = useId();

	return (
		<div
			className={[
				"w-full rounded-lg border border-[var(--card-border)] bg-[var(--card)]",
				className,
			]
				.filter(Boolean)
				.join(" ")}
		>
			<button
				type="button"
				className="touch-target flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-medium"
				onClick={() => setOpen((value) => !value)}
				aria-expanded={open}
				aria-controls={panelId}
			>
				<span>{title}</span>
				<span className="text-zinc-500 dark:text-zinc-400" aria-hidden>
					{open ? "▾" : "▸"}
				</span>
			</button>
			{open ? (
				<div
					id={panelId}
					className="border-t border-[var(--card-border)] px-4 py-3 text-sm"
				>
					{children}
				</div>
			) : null}
		</div>
	);
}
