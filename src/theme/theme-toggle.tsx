"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { track } from "../analytics/client";

function useMounted() {
	return useSyncExternalStore(
		() => () => {},
		() => true,
		() => false,
	);
}

export type ThemeToggleProps = {
	className?: string;
	/** PostHog event name. Defaults to `theme_changed`. */
	eventName?: string;
};

export function ThemeToggle({
	className,
	eventName = "theme_changed",
}: ThemeToggleProps) {
	const { theme, setTheme } = useTheme();
	const mounted = useMounted();

	function cycle() {
		const current = theme ?? "system";
		const next =
			current === "light" ? "dark" : current === "dark" ? "system" : "light";
		setTheme(next);
		track(eventName, { theme: next });
	}

	const label =
		theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";

	return (
		<button
			type="button"
			onClick={cycle}
			className={
				className ??
				"h-7 min-w-16 rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600"
			}
			aria-label={mounted ? `Theme: ${label}` : "Toggle theme"}
		>
			<span className="hidden sm:inline">{mounted ? label : "Theme"}</span>
			<span className="sm:hidden">◐</span>
		</button>
	);
}
