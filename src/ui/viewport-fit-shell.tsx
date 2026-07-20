import type { ReactNode } from "react";

export type ViewportFitShellProps = {
	header?: ReactNode;
	footer?: ReactNode;
	children: ReactNode;
	className?: string;
	mainClassName?: string;
};

/**
 * Full-viewport play shell (`play-shell` CSS lives in the consuming app).
 */
export function ViewportFitShell({
	header,
	footer,
	children,
	className = "",
	mainClassName = "",
}: ViewportFitShellProps) {
	return (
		<div
			className={["play-shell bg-[var(--background)] text-[var(--foreground)]", className]
				.filter(Boolean)
				.join(" ")}
		>
			{header}
			<main
				className={[
					"play-shell__main mx-auto flex w-full max-w-md flex-col px-safe",
					mainClassName,
				]
					.filter(Boolean)
					.join(" ")}
			>
				{children}
			</main>
			{footer}
		</div>
	);
}
