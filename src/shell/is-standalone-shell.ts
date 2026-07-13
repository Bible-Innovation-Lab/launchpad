/// <reference path="./capacitor-shims.d.ts" />

/**
 * @bil/launchpad/shell — detect PWA, iOS home screen, and Capacitor native shells.
 *
 * Used by hub/game UIs to choose same-window navigation (shell) vs new tab (desktop web).
 */

export type AppContext = "web" | "pwa" | "native";

type CapacitorWindow = Window & {
	Capacitor?: {
		isNativePlatform?: () => boolean;
		getPlatform?: () => string;
	};
};

function hasCapNativeClass(): boolean {
	if (typeof document === "undefined") return false;
	return document.documentElement.classList.contains("cap-native");
}

function isCapacitorNative(): boolean {
	if (typeof window === "undefined") return false;
	const cap = (window as CapacitorWindow).Capacitor;
	if (cap?.isNativePlatform?.() === true) return true;
	const platform = cap?.getPlatform?.();
	if (platform === "android" || platform === "ios") return true;
	// native-chrome-init.js marks Cap WebViews even if the bridge loads late
	return hasCapNativeClass();
}

function isPwaStandalone(): boolean {
	if (typeof window === "undefined") return false;
	if (window.matchMedia("(display-mode: standalone)").matches) return true;
	if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
	if (window.matchMedia("(display-mode: minimal-ui)").matches) return true;
	const nav = window.navigator as Navigator & { standalone?: boolean };
	return nav.standalone === true;
}

/** True when the app runs inside PWA, iOS home screen, or Capacitor WebView. */
export function isStandaloneShell(): boolean {
	return isCapacitorNative() || isPwaStandalone();
}

export function getAppContext(): AppContext {
	if (isCapacitorNative()) return "native";
	if (isPwaStandalone()) return "pwa";
	return "web";
}

/** BIL hub and game hostnames allowed for in-shell navigation. */
export const BIL_GAME_HOST_SUFFIXES = [
	"minigames.bible",
	"bibleinnovationlab.org"
] as const;

export function isBilGameHostname(hostname: string): boolean {
	const host = hostname.toLowerCase();
	return BIL_GAME_HOST_SUFFIXES.some(
		(suffix) => host === suffix || host.endsWith(`.${suffix}`)
	);
}

export function isBilGameUrl(url: string): boolean {
	try {
		return isBilGameHostname(new URL(url).hostname);
	} catch {
		return false;
	}
}

/** True when the previous page was a BIL hub or game (for smart back navigation). */
export function cameFromBilGame(): boolean {
	if (typeof document === "undefined") return false;
	if (!document.referrer) return false;
	return isBilGameUrl(document.referrer);
}

/** Community hub uses a light chrome; Scripture hub and games use dark. */
export const COMMUNITY_HUB_HOST = "community.minigames.bible";

/** Canonical Scripture hub URL — use www (apex has cert issues in some WebViews). */
export const SCRIPTURE_HUB_URL = "https://www.minigames.bible";

/** Canonical Community hub URL. */
export const COMMUNITY_HUB_URL = `https://${COMMUNITY_HUB_HOST}`;

/** Keep web content below the native status bar (Android edge-to-edge). */
export async function initNativeViewportChrome(): Promise<void> {
	if (getAppContext() !== "native") return;

	try {
		const { StatusBar } = await import("@capacitor/status-bar");
		await StatusBar.setOverlaysWebView({ overlay: false });
	} catch {
		// StatusBar plugin unavailable
	}
}

/**
 * Sync Capacitor status bar style to the current hub hostname.
 * No-op on web/PWA or when the StatusBar plugin is unavailable.
 */
export async function syncStatusBarForHost(hostname: string): Promise<void> {
	if (getAppContext() !== "native") return;

	try {
		const { StatusBar, Style } = await import("@capacitor/status-bar");
		if (hostname === COMMUNITY_HUB_HOST) {
			await StatusBar.setStyle({ style: Style.Light });
			await StatusBar.setBackgroundColor({ color: "#fafaf9" });
		} else {
			await StatusBar.setStyle({ style: Style.Dark });
			await StatusBar.setBackgroundColor({ color: "#0a1628" });
		}
	} catch {
		// StatusBar plugin unavailable
	}
}

/** Viewport chrome + status bar colors for the current host. */
export async function syncNativeChromeForHost(hostname: string): Promise<void> {
	await initNativeViewportChrome();
	await syncStatusBarForHost(hostname);
}

/**
 * Navigate to a BIL hub URL inside the shell WebView.
 * Uses explicit assign so cross-subdomain hops work reliably in Capacitor.
 */
export function navigateToHub(url: string): void {
	if (typeof window === "undefined") return;
	window.location.assign(url);
}

/**
 * Open a URL outside the in-app shell (Discord, docs, etc.).
 * Uses Capacitor Browser on native; window.open elsewhere.
 */
export function openExternalUrl(url: string): void {
	if (typeof window === "undefined") return;

	if (getAppContext() === "native") {
		void (async () => {
			try {
				const { Browser } = await import("@capacitor/browser");
				await Browser.open({ url });
			} catch {
				window.open(url, "_blank", "noopener,noreferrer");
			}
		})();
		return;
	}

	window.open(url, "_blank", "noopener,noreferrer");
}
