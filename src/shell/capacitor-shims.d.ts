/**
 * Minimal typings for optional Capacitor peer deps.
 * These ambient modules are pulled into consumers that import launchpad
 * shell entrypoints (`/// <reference path="./capacitor-shims.d.ts" />`),
 * so they define the App/Browser/etc. surface used for typecheck even when
 * the real @capacitor/* packages are installed. Keep this surface aligned
 * with methods/events consumers call (e.g. minimizeApp, appUrlOpen).
 *
 * Also keep notification methods in sync with consumer
 * `lib/native-notifications.ts` (requestPermissions / schedule / cancel / register).
 */

declare module "@capacitor/app" {
	export const App: {
		minimizeApp(): Promise<void>;
		addListener(
			event: "backButton",
			handler: (info: { canGoBack: boolean }) => void
		): Promise<{ remove: () => Promise<void> }>;
		addListener(
			event: "appStateChange",
			handler: (state: { isActive: boolean }) => void
		): Promise<{ remove: () => Promise<void> }>;
		addListener(
			event: "appUrlOpen",
			handler: (event: { url: string }) => void
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

declare module "@capacitor/local-notifications" {
	export type PermissionState = "prompt" | "prompt-with-rationale" | "granted" | "denied";

	export const LocalNotifications: {
		requestPermissions(): Promise<{ display: PermissionState }>;
		checkPermissions(): Promise<{ display: PermissionState }>;
		cancel(options: {
			notifications: Array<{ id: number }>;
		}): Promise<void>;
		schedule(options: {
			notifications: Array<{
				id: number;
				title: string;
				body: string;
				schedule?: {
					on?: { hour?: number; minute?: number };
					allowWhileIdle?: boolean;
				};
				extra?: { url?: string };
			}>;
		}): Promise<void>;
		addListener(
			event: "localNotificationActionPerformed",
			handler: (notification: {
				notification: { extra?: { url?: string } };
			}) => void
		): Promise<{ remove: () => Promise<void> }>;
	};
}

declare module "@capacitor/push-notifications" {
	export type PermissionState = "prompt" | "prompt-with-rationale" | "granted" | "denied";

	export const PushNotifications: {
		requestPermissions(): Promise<{ receive: PermissionState }>;
		checkPermissions(): Promise<{ receive: PermissionState }>;
		register(): Promise<void>;
		addListener(
			event: "pushNotificationActionPerformed",
			handler: (action: {
				notification: { data?: { url?: string } };
			}) => void
		): Promise<{ remove: () => Promise<void> }>;
		addListener(
			event: "registration",
			handler: (token: { value: string }) => void
		): Promise<{ remove: () => Promise<void> }>;
		addListener(
			event: "registrationError",
			handler: (error: { error: string }) => void
		): Promise<{ remove: () => Promise<void> }>;
	};
}
