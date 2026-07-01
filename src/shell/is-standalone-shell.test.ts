/**
 * Tests for shell detection helpers. Run: bun src/shell/is-standalone-shell.test.ts
 */

import {
	getAppContext,
	isBilGameHostname,
	isBilGameUrl,
	isStandaloneShell
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

console.log("\nisStandaloneShell (SSR / no window)");
assert(!isStandaloneShell(), "false without browser APIs");
assert(getAppContext() === "web", "web context without browser APIs");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
