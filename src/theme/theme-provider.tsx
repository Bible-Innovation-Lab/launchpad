"use client";

import {
	ThemeProvider as NextThemesProvider,
	type ThemeProviderProps,
} from "next-themes";

/**
 * next-themes wrapper with BIL defaults (`defaultTheme="system"`).
 * Pair with `public/theme-init.js` in the consuming app to avoid FOUC.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
	return (
		<NextThemesProvider
			attribute="class"
			defaultTheme="system"
			enableSystem
			// next-themes script disabled — theme flash prevented by public/theme-init.js
			scriptProps={{ type: "application/json" }}
			{...props}
		>
			{children}
		</NextThemesProvider>
	);
}
