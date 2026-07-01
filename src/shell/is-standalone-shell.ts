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

function isCapacitorNative(): boolean {
	if (typeof window === "undefined") return false;
	const cap = (window as CapacitorWindow).Capacitor;
	return cap?.isNativePlatform?.() === true;
}

function isPwaStandalone(): boolean {
	if (typeof window === "undefined") return false;
	if (window.matchMedia("(display-mode: standalone)").matches) return true;
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

/**
 * Open a URL outside the in-app shell (Discord, docs, etc.).
 * On Capacitor, hosts not in server.allowNavigation open in the system browser.
 */
export function openExternalUrl(url: string): void {
	if (typeof window === "undefined") return;
	window.open(url, "_blank", "noopener,noreferrer");
}
