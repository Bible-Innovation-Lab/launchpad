/**
 * Empty stand-ins for optional @capacitor/* peers.
 * withLaunchpad aliases missing peers here so Next/webpack does not warn
 * "Module not found" while still allowing real packages when installed.
 */
export const App = {
	async addListener() {
		return { remove: async () => {} };
	},
};

export const Browser = {
	async open() {},
};

export const SplashScreen = {
	async hide() {},
};

export const Style = {
	Dark: "DARK",
	Light: "LIGHT",
	Default: "DEFAULT",
};

export const StatusBar = {
	async setOverlaysWebView() {},
	async setStyle() {},
	async setBackgroundColor() {},
};

export const LocalNotifications = {
	async addListener() {
		return { remove: async () => {} };
	},
};

export const PushNotifications = {
	async addListener() {
		return { remove: async () => {} };
	},
};
