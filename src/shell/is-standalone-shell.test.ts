/**
 * Tests for shell detection helpers. Run: bun src/shell/is-standalone-shell.test.ts
 */

import {
	COMMUNITY_HUB_URL,
	getAppContext,
	isBilGameHostname,
	isBilGameUrl,
	isStandaloneShell,
	SCRIPTURE_HUB_URL
} from "./is-standalone-shell";

let passed = 0;
let failed = 0;

function assert(cond: boolean, name: string): void {
	if (cond) {
		passed++;
		console.log(`  PASS  ${name}`);
	} else {
		failed++;
		console.error(`  FAIL  ${name}`);
	}
}

console.log("isBilGameHostname");
assert(isBilGameHostname("minigames.bible"), "minigames.bible");
assert(isBilGameHostname("community.minigames.bible"), "community.minigames.bible");
assert(isBilGameHostname("tile-game.minigames.bible"), "tile-game.minigames.bible");
assert(
	isBilGameHostname("bibleguessr.bibleinnovationlab.org"),
	"bibleguessr.bibleinnovationlab.org"
);
assert(!isBilGameHostname("discord.com"), "rejects discord.com");
assert(
	!isBilGameHostname("evil-minigames.bible.attacker.com"),
	"rejects suffix spoof"
);

console.log("\nisBilGameUrl");
assert(
	isBilGameUrl("https://miracle-merge.minigames.bible/"),
	"miracle-merge.minigames.bible"
);
assert(!isBilGameUrl("https://discord.com/invite/x"), "discord invite");

console.log("\nhub URLs");
assert(
	SCRIPTURE_HUB_URL === "https://www.minigames.bible",
	"scripture hub uses www"
);
assert(
	COMMUNITY_HUB_URL === "https://community.minigames.bible",
	"community hub url"
);

console.log("\nisStandaloneShell (SSR / no window)");
assert(!isStandaloneShell(), "false without browser APIs");
assert(getAppContext() === "web", "web context without browser APIs");

console.log("\nisStandaloneShell (mocked browser)");
{
	const previousWindow = globalThis.window;
	const previousDocument = (globalThis as { document?: Document }).document;

	const classList = {
		_classes: new Set<string>(),
		contains(name: string) {
			return this._classes.has(name);
		},
		add(name: string) {
			this._classes.add(name);
		},
		remove(name: string) {
			this._classes.delete(name);
		}
	};

	const mockWindow = {
		Capacitor: undefined as
			| { isNativePlatform?: () => boolean; getPlatform?: () => string }
			| undefined,
		matchMedia(query: string) {
			return {
				matches: query.includes("display-mode: fullscreen"),
				media: query,
				onchange: null,
				addListener() {},
				removeListener() {},
				addEventListener() {},
				removeEventListener() {},
				dispatchEvent() {
					return false;
				}
			} as MediaQueryList;
		},
		navigator: {} as Navigator
	};

	const mockDocument = {
		documentElement: { classList }
	};

	Object.defineProperty(globalThis, "window", {
		value: mockWindow,
		configurable: true,
		writable: true
	});
	Object.defineProperty(globalThis, "document", {
		value: mockDocument,
		configurable: true,
		writable: true
	});

	assert(getAppContext() === "pwa", "fullscreen display-mode is pwa");
	assert(isStandaloneShell(), "standalone when fullscreen PWA");

	mockWindow.matchMedia = () =>
		({
			matches: false,
			media: "",
			onchange: null,
			addListener() {},
			removeListener() {},
			addEventListener() {},
			removeEventListener() {},
			dispatchEvent() {
				return false;
			}
		}) as MediaQueryList;

	assert(getAppContext() === "web", "web without Cap or standalone");

	classList.add("cap-native");
	assert(getAppContext() === "native", "cap-native class is native");
	assert(isStandaloneShell(), "standalone when cap-native");

	classList.remove("cap-native");
	mockWindow.Capacitor = {
		isNativePlatform: () => true,
		getPlatform: () => "android"
	};
	assert(getAppContext() === "native", "Capacitor.isNativePlatform is native");

	if (previousWindow === undefined) {
		Reflect.deleteProperty(globalThis, "window");
	} else {
		Object.defineProperty(globalThis, "window", {
			value: previousWindow,
			configurable: true,
			writable: true
		});
	}
	if (previousDocument === undefined) {
		Reflect.deleteProperty(globalThis, "document");
	} else {
		Object.defineProperty(globalThis, "document", {
			value: previousDocument,
			configurable: true,
			writable: true
		});
	}
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
