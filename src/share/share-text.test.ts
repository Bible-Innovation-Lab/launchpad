#!/usr/bin/env bun
/**
 * Tests for @bil/launchpad/share. Run: bun src/share/share-text.test.ts
 */

import { shareText } from "./share-text";

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail?: string) {
	if (ok) {
		passed++;
		console.log(`  PASS  ${label}`);
	} else {
		failed++;
		console.log(`  FAIL  ${label}${detail ? " — " + detail : ""}`);
	}
}

const tracked: Array<{ event: string; props?: Record<string, unknown> }> = [];

// Stub analytics track by monkey-patching the module's dependency path:
// shareText imports track — we intercept via global fetch used by track.
// Instead, test share behavior with navigator stubs only and allow track to no-op
// when fetch fails (analytics swallows errors).

console.log("shareText —");

const originalShare = navigator.share;
const originalClipboard = navigator.clipboard;

// share success
(navigator as Navigator & { share: typeof navigator.share }).share = async () => {
	/* ok */
};
const r1 = await shareText({ text: "hello" });
check("native share returns share", r1 === "share");

// AbortError → cancelled
(navigator as Navigator & { share: typeof navigator.share }).share = async () => {
	const err = new Error("user cancelled");
	err.name = "AbortError";
	throw err;
};
const r2 = await shareText({ text: "hello" });
check("AbortError returns cancelled", r2 === "cancelled");

// share fails → clipboard
(navigator as Navigator & { share: typeof navigator.share }).share = async () => {
	throw new Error("share failed");
};
Object.defineProperty(navigator, "clipboard", {
	configurable: true,
	value: {
		writeText: async (t: string) => {
			check("clipboard receives text", t.includes("hello"));
		},
	},
});
const r3 = await shareText({ text: "hello", url: "https://example.com" });
check("fallback to copy", r3 === "copy");

// no share, no clipboard → cancelled
delete (navigator as { share?: unknown }).share;
Object.defineProperty(navigator, "clipboard", {
	configurable: true,
	value: undefined,
});
const r4 = await shareText({ text: "hello" });
check("unavailable returns cancelled", r4 === "cancelled");

// restore
if (originalShare) {
	(navigator as Navigator & { share: typeof navigator.share }).share = originalShare;
} else {
	delete (navigator as { share?: unknown }).share;
}
Object.defineProperty(navigator, "clipboard", {
	configurable: true,
	value: originalClipboard,
});

void tracked;

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
