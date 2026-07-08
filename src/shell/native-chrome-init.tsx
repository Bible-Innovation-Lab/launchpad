/// <reference path="./capacitor-shims.d.ts" />

"use client";

import { useEffect } from "react";
import {
	getAppContext,
	syncNativeChromeForHost,
	syncStatusBarForHost
} from "./is-standalone-shell";

/**
 * Initializes Capacitor splash hide, status bar, and Android back when
 * a BIL site runs inside the native shell.
 */
export function NativeChromeInit() {
	useEffect(() => {
		if (getAppContext() !== "native") return;

		let removeAppStateListener: (() => void) | undefined;

		void (async () => {
			try {
				const { SplashScreen } = await import("@capacitor/splash-screen");
				await SplashScreen.hide();
			} catch {
				// optional
			}

			await syncNativeChromeForHost(window.location.hostname);

			try {
				const { App } = await import("@capacitor/app");
				await App.addListener("backButton", ({ canGoBack }) => {
					if (canGoBack) window.history.back();
				});

				const stateHandle = await App.addListener(
					"appStateChange",
					({ isActive }) => {
						if (isActive) {
							void syncStatusBarForHost(window.location.hostname);
						}
					}
				);
				removeAppStateListener = () => {
					void stateHandle.remove();
				};
			} catch {
				// optional
			}
		})();

		return () => {
			removeAppStateListener?.();
		};
	}, []);

	return null;
}
