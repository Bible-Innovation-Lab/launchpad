/**
 * Simulates a web-only consumer (no @capacitor/* installed) typechecking shell code.
 * Run from launchpad root: bun scripts/typecheck-web-consumer.ts
 */

import { $ } from "bun";
import { mkdtemp, cp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const root = join(import.meta.dir, "..");
const tmp = await mkdtemp(join(tmpdir(), "launchpad-web-consumer-"));

try {
	await cp(join(root, "src"), join(tmp, "src"), { recursive: true });

	const tsconfig = {
		compilerOptions: {
			target: "ES2022",
			lib: ["dom", "dom.iterable", "esnext"],
			strict: true,
			noEmit: true,
			esModuleInterop: true,
			module: "esnext",
			moduleResolution: "bundler",
			isolatedModules: true,
			jsx: "react-jsx",
			skipLibCheck: true
		},
		include: ["src/shell/is-standalone-shell.ts"]
	};

	await writeFile(join(tmp, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));

	const result = await $`bunx tsc --noEmit -p ${join(tmp, "tsconfig.json")}`.quiet();
	if (result.exitCode !== 0) {
		console.error(result.stderr.toString());
		process.exit(1);
	}

	console.log("PASS — shell typechecks without @capacitor/* installed");
} finally {
	await rm(tmp, { recursive: true, force: true });
}
