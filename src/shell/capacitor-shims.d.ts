/**
 * Minimal typings for optional Capacitor peer deps.
 * Real @capacitor/* packages take precedence when installed; these shims
 * let web-only consumers typecheck launchpad shell code without them.
 */

declare module "@capacitor/app" {
	export const App: {
		addListener(
			event: "backButton",
			handler: (info: { canGoBack: boolean }) => void
		): Promise<{ remove: () => Promise<void> }>;
		addListener(
			event: "appStateChange",
			handler: (state: { isActive: boolean }) => void
		): Promise<{ remove: () => Promise<void> }>;
	};
}

declare module "@capacitor/browser" {
	export const Browser: {
		open(options: { url: string }): Promise<void>;
	};
}

declare module "@capacitor/splash-screen" {
	export const SplashScreen: {
		hide(): Promise<void>;
	};
}

declare module "@capacitor/status-bar" {
	export enum Style {
		Dark = "DARK",
		Light = "LIGHT"
	}

	export const StatusBar: {
		setOverlaysWebView(options: { overlay: boolean }): Promise<void>;
		setStyle(options: { style: Style }): Promise<void>;
		setBackgroundColor(options: { color: string }): Promise<void>;
	};
}
