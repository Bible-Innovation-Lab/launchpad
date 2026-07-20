"use client";

import { track } from "../analytics/client";
import { getAppContext } from "../shell/is-standalone-shell";
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";

type PromptMode = "ios" | "android-install" | "android-menu" | "embedded";

type BeforeInstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type PwaInstallPromptProps = {
	appName: string;
	/** Used to scope the dismiss key in localStorage. */
	shortName: string;
};

const VISIT_COUNT_KEY = "bil-pwa-visit-count";

function dismissKey(shortName: string): string {
	const slug = process.env.NEXT_PUBLIC_APP_ID ?? shortName;
	return `bil-pwa-install-dismissed-${slug}`;
}

function isIosSafari(): boolean {
	if (typeof navigator === "undefined") return false;
	const ua = navigator.userAgent;
	return /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

function isAndroid(): boolean {
	if (typeof navigator === "undefined") return false;
	return /Android/i.test(navigator.userAgent);
}

function hasCapNativeClass(): boolean {
	if (typeof document === "undefined") return false;
	return document.documentElement.classList.contains("cap-native");
}

/** Capacitor / PWA / home-screen — never show install CTAs here. */
function isInShellNow(): boolean {
	return getAppContext() !== "web" || hasCapNativeClass();
}

/**
 * Named social / messenger WebViews only.
 * Do not treat bare Android `; wv)` as installable IAB — Capacitor uses that UA.
 */
function isSocialInAppBrowser(): boolean {
	if (isInShellNow()) return false;
	if (typeof navigator === "undefined") return false;
	const ua = navigator.userAgent;
	return /FBAN|FBAV|Instagram|Line\/|Twitter|LinkedInApp|TikTok|Snapchat/i.test(
		ua,
	);
}

function platformForMode(mode: PromptMode): string {
	switch (mode) {
		case "ios":
			return "ios";
		case "android-install":
		case "android-menu":
			return "android";
		case "embedded":
			return "in_app";
	}
}

function readVisitCount(): number {
	if (typeof window === "undefined") return 0;
	const visits = Number(sessionStorage.getItem(VISIT_COUNT_KEY) ?? "0") + 1;
	sessionStorage.setItem(VISIT_COUNT_KEY, String(visits));
	return visits;
}

function readWasDismissed(shortName: string): boolean {
	if (typeof window === "undefined") return false;
	return localStorage.getItem(dismissKey(shortName)) === "1";
}

function resolvePromptMode(
	deferredPrompt: BeforeInstallPromptEvent | null,
	androidMenuVisible: boolean,
): PromptMode | null {
	if (isSocialInAppBrowser()) return "embedded";
	if (isIosSafari()) return "ios";
	if (deferredPrompt) return "android-install";
	if (androidMenuVisible && isAndroid()) return "android-menu";
	return null;
}

function subscribeNoop() {
	return () => {};
}

/** Re-check shell when Cap bridge or `cap-native` class appears after first paint. */
function subscribeInShell(onStoreChange: () => void) {
	if (typeof window === "undefined" || typeof document === "undefined") {
		return () => {};
	}

	const observer = new MutationObserver(onStoreChange);
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class"],
	});

	const interval = window.setInterval(onStoreChange, 250);
	const stop = window.setTimeout(() => window.clearInterval(interval), 3000);

	return () => {
		observer.disconnect();
		window.clearInterval(interval);
		window.clearTimeout(stop);
	};
}

function useDeferredInstallPrompt(active: boolean) {
	const eventRef = useRef<BeforeInstallPromptEvent | null>(null);

	return useSyncExternalStore(
		(onStoreChange) => {
			if (!active || typeof window === "undefined") return () => {};
			const handler = (event: Event) => {
				event.preventDefault();
				eventRef.current = event as BeforeInstallPromptEvent;
				onStoreChange();
			};
			window.addEventListener("beforeinstallprompt", handler);
			return () => {
				window.removeEventListener("beforeinstallprompt", handler);
				eventRef.current = null;
			};
		},
		() => eventRef.current,
		() => null,
	);
}

function useAndroidMenuFallback(active: boolean) {
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		if (!active) return;
		const timer = window.setTimeout(() => setVisible(true), 5000);
		return () => window.clearTimeout(timer);
	}, [active]);

	return visible;
}

/**
 * Bottom install banner. Consuming apps should include the
 * `pwa-install-prompt` CSS (see bil-app-template `components/pwa-install-prompt.css`).
 */
export function PwaInstallPrompt({
	appName,
	shortName,
}: PwaInstallPromptProps) {
	const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false);
	const inShell = useSyncExternalStore(subscribeInShell, isInShellNow, () => false);
	const [visitCount] = useState(readVisitCount);
	const [wasDismissed, setWasDismissed] = useState(() =>
		readWasDismissed(shortName),
	);
	const trackedMode = useRef<PromptMode | null>(null);

	const promptEligible = isClient && !wasDismissed && !inShell;

	const deferredPrompt = useDeferredInstallPrompt(
		promptEligible && isAndroid() && !isSocialInAppBrowser(),
	);
	const androidMenuVisible = useAndroidMenuFallback(
		promptEligible &&
			isAndroid() &&
			!isSocialInAppBrowser() &&
			visitCount >= 2 &&
			deferredPrompt === null,
	);

	const mode = promptEligible
		? resolvePromptMode(deferredPrompt, androidMenuVisible)
		: null;

	useEffect(() => {
		if (!mode || trackedMode.current === mode) return;
		trackedMode.current = mode;
		track("pwa_install_prompt_shown", {
			platform: platformForMode(mode),
		});
	}, [mode]);

	const dismiss = useCallback(() => {
		if (mode) {
			track("pwa_install_dismissed", { platform: platformForMode(mode) });
		}
		localStorage.setItem(dismissKey(shortName), "1");
		setWasDismissed(true);
	}, [mode, shortName]);

	const install = useCallback(async () => {
		if (!deferredPrompt) return;
		await deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;
		if (outcome === "accepted") {
			track("pwa_install_accepted", { platform: "android" });
		}
		dismiss();
	}, [deferredPrompt, dismiss]);

	if (!mode) return null;

	return (
		<div
			className="pwa-install-prompt"
			role="region"
			aria-label="Install app"
			data-testid="pwa-install-prompt"
		>
			<div className="pwa-install-prompt__body">
				<p className="pwa-install-prompt__title">Install {appName}</p>
				{mode === "ios" ? (
					<p className="pwa-install-prompt__text">
						Tap <strong>Share</strong>, then{" "}
						<strong>Add to Home Screen</strong> for a full-screen app
						experience.
					</p>
				) : null}
				{mode === "android-install" ? (
					<p className="pwa-install-prompt__text">
						Add to your home screen for quick access and a native-like
						experience.
					</p>
				) : null}
				{mode === "android-menu" ? (
					<p className="pwa-install-prompt__text">
						Tap <strong>⋮</strong>, then <strong>Install app</strong> or{" "}
						<strong>Add to Home screen</strong>.
					</p>
				) : null}
				{mode === "embedded" ? (
					<p className="pwa-install-prompt__text">
						Open this page in <strong>Safari</strong> or{" "}
						<strong>Chrome</strong> to install the app on your home screen.
					</p>
				) : null}
			</div>
			<div className="pwa-install-prompt__actions">
				{mode === "android-install" && deferredPrompt ? (
					<button
						type="button"
						className="pwa-install-prompt__primary"
						onClick={install}
					>
						Install
					</button>
				) : null}
				<button
					type="button"
					className="pwa-install-prompt__dismiss"
					onClick={dismiss}
				>
					Not now
				</button>
			</div>
		</div>
	);
}
