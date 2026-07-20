/**
 * withLaunchpad — Next.js config helper.
 *
 * Consumed by the student template's `next.config.ts`:
 *
 *   import { withLaunchpad } from "@bil/launchpad/config/next";
 *   export default withLaunchpad({
 *     // your own NextConfig overrides go here
 *   });
 *
 * What it does:
 *   - Adds `@bil/launchpad` to `transpilePackages` so Next's bundler
 *     compiles the package's TS sources cleanly. (Without this, students
 *     get "Cannot use import statement outside a module" at build time.)
 *   - Sets security headers consistent with BIL policy (strict-transport,
 *     frame-options, content-type-options). Students can override via
 *     their own `headers()` returning a merged array — we union, not
 *     replace.
 *   - Validates required env vars at build time (`APP_ID`, `POSTHOG_KEY`,
 *     `YOUVERSION_API_KEY`) in production. Fails the build loudly if any
 *     are missing — students learn about misconfiguration at build, not
 *     at runtime when their first user hits a 500.
 *   - Aliases missing optional `@capacitor/*` peers to a no-op stub so
 *     web-only apps that mount `<NativeChromeInit />` do not get
 *     "Module not found" webpack warnings for push/local-notifications.
 *
 * Student overrides win: `withLaunchpad(userConfig)` merges userConfig on
 * top, preserving any flags the student set. The only fields we always
 * append to are `transpilePackages` (we add ours; theirs are kept) and
 * `headers()` (we union with the student's headers).
 */

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

type AsyncOrSync<T> = T | Promise<T>;
type HeadersFn = () => AsyncOrSync<
	Array<{ source: string; headers: Array<{ key: string; value: string }> }>
>;

const REQUIRED_ENV_VARS = ["APP_ID", "POSTHOG_KEY", "YOUVERSION_API_KEY"] as const;

const OPTIONAL_CAPACITOR_PEERS = [
	"@capacitor/app",
	"@capacitor/browser",
	"@capacitor/local-notifications",
	"@capacitor/push-notifications",
	"@capacitor/splash-screen",
	"@capacitor/status-bar",
] as const;

const BIL_SECURITY_HEADERS = [
	{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
	{ key: "X-Frame-Options", value: "DENY" },
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

/** Map uninstalled optional Capacitor peers → no-op stub (absolute path). */
function missingCapacitorAliases(): Record<string, string> {
	const consumerRequire = createRequire(join(process.cwd(), "package.json"));
	const stub = join(
		dirname(fileURLToPath(import.meta.url)),
		"../shell/capacitor-optional-stub.js",
	);
	const aliases: Record<string, string> = {};
	for (const pkg of OPTIONAL_CAPACITOR_PEERS) {
		try {
			consumerRequire.resolve(pkg);
		} catch {
			aliases[pkg] = stub;
		}
	}
	return aliases;
}

export function withLaunchpad(userConfig: NextConfig = {}): NextConfig {
	// Build-time env-var assertion. Production only (skipped in dev so local
	// dev works without bil-provisioning having injected anything).
	if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE === "phase-production-build") {
		const missing = REQUIRED_ENV_VARS.filter((k) => !process.env[k]);
		if (missing.length > 0) {
			throw new Error(
				`[@bil/launchpad] Missing required env vars at build time: ${missing.join(", ")}. ` +
					`These should be injected by bil-provisioning during /provision. ` +
					`Check your Vercel project's env var settings.`,
			);
		}
	}

	const userTranspile = userConfig.transpilePackages ?? [];
	const userHeaders = userConfig.headers as HeadersFn | undefined;
	const userWebpack = userConfig.webpack;
	const capacitorAliases = missingCapacitorAliases();

	const merged: NextConfig = {
		...userConfig,
		transpilePackages: ["@bil/launchpad", ...userTranspile.filter((p) => p !== "@bil/launchpad")],
		async headers() {
			const platform = [{ source: "/(.*)", headers: BIL_SECURITY_HEADERS }];
			const user = userHeaders ? await userHeaders() : [];
			return [...platform, ...user];
		},
		webpack(config, options) {
			if (Object.keys(capacitorAliases).length > 0) {
				config.resolve = config.resolve ?? {};
				const existing = config.resolve.alias;
				config.resolve.alias = {
					...(typeof existing === "object" && !Array.isArray(existing) ? existing : {}),
					...capacitorAliases,
				};
			}
			return userWebpack ? userWebpack(config, options) : config;
		},
	};

	if (Object.keys(capacitorAliases).length > 0) {
		merged.turbopack = {
			...userConfig.turbopack,
			resolveAlias: {
				...userConfig.turbopack?.resolveAlias,
				...capacitorAliases,
			},
		};
	}

	return merged;
}
