/// <reference path="./capacitor-shims.d.ts" />

import { getAppContext, SCRIPTURE_HUB_URL } from "./is-standalone-shell";

function resolveOpenUrl(url?: string): string {
	const raw = (url ?? `${SCRIPTURE_HUB_URL}/`).trim();
	if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
	try {
		return new URL(raw, SCRIPTURE_HUB_URL).href;
	} catch {
		return `${SCRIPTURE_HUB_URL}/`;
	}
}

/**
 * Registers Capacitor local/push tap listeners once.
 * Soft-ask + schedule + FCM token POST live in the hub (Minigame-Hub).
 */
export async function initNativeNotificationListeners(): Promise<void> {
	if (getAppContext() !== "native") return;
	if (typeof window === "undefined") return;

	const g = window as Window & { __bilLaunchpadNotifListeners?: boolean };
	if (g.__bilLaunchpadNotifListeners) return;
	g.__bilLaunchpadNotifListeners = true;

	try {
		const { LocalNotifications } = await import(
			"@capacitor/local-notifications"
		);
		await LocalNotifications.addListener(
			"localNotificationActionPerformed",
			(notification) => {
				const url =
					(notification.notification.extra as { url?: string } | undefined)
						?.url ?? `${SCRIPTURE_HUB_URL}/`;
				window.location.assign(resolveOpenUrl(url));
			}
		);
	} catch {
		// optional peer
	}

	try {
		const { PushNotifications } = await import(
			"@capacitor/push-notifications"
		);
		await PushNotifications.addListener(
			"pushNotificationActionPerformed",
			(action) => {
				const data = action.notification.data as { url?: string } | undefined;
				window.location.assign(resolveOpenUrl(data?.url));
			}
		);
	} catch {
		// optional peer
	}
}
