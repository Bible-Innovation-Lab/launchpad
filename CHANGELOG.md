# Changelog

## 0.1.3

### Added

- `@bil/launchpad/share` — `shareText()` cascade (`navigator.share` → clipboard) with built-in `share_clicked` analytics. Text-only; message/OG builders stay in apps.
- `@bil/launchpad/shell/hub` — `HUBS`, `HubKind`, `HubProvider`, `HubLink`, `getHubLink()`, `resolveHubKind()`.
- `@bil/launchpad/shell/hub-kind` — server-safe hub resolution (`resolveHubKind` respects `HUB` env). Resolve in a Server Component and pass into `HubProvider` so the override survives client hydration.
- `@bil/launchpad/ui` — `ViewportFitShell`, `CompactHeader` (slot-based `trailing`), `PlayLayoutHeader`, `ResponsivePlayLayout`, `CollapsibleSection`.
- `@bil/launchpad/theme` — `ThemeProvider` + `ThemeToggle` (peer: `next-themes`).
- `@bil/launchpad/pwa` — `PwaInstallPrompt`, `ServiceWorkerRegistration`, `createWebManifest`, `pwaIconPaths`. Apps still own `public/sw.js` and icons.
- `@bil/launchpad/bible` — multi-translation via `bibleId` / `YOUVERSION_BIBLE_ID` (default still `111`); `buildBibleComUrl()`.
- `FeedbackModal` — `onSubmitted` callback (hub badge side-effects); `onSubmit` kept as alias.

### Fixed

- `withLaunchpad`: aliases missing optional `@capacitor/*` peers to `@bil/launchpad/shell/capacitor-optional-stub` (package subpath, not an absolute path — Turbopack rejects Windows absolute imports) so web-only apps mounting `<NativeChromeInit />` no longer warn `Module not found`.
- `FeedbackModal`: `onSubmitted` / `onSubmit` may be async; returning `false` (or throwing) keeps the form open instead of showing thanks — so apps can gate success on a persistence API.
- `shareText`: dismissing the native share sheet (`AbortError`) falls through to clipboard instead of returning `cancelled`, so users still get the text on mobile.
- `PwaInstallPrompt`: accepting the native install no longer fires `pwa_install_dismissed` or permanently dismisses via the same path as "Not now". Closing the native sheet only hides the banner for the current visit.
- `FeedbackModal`: when both `onSubmitted` and deprecated `onSubmit` are passed, only `onSubmitted` runs.
- `ResponsivePlayLayout`: mount only mobile or desktop via `matchMedia` (`lg` / 1024px), so children are not duplicated.
- `PwaInstallPrompt`: capture `beforeinstallprompt` with a stable mount-once listener so rerenders do not discard the deferred prompt.
- `buildBibleComUrl`: default version follows `resolveBibleId()` / `YOUVERSION_BIBLE_ID` (same as the YouVersion client).
- `HubProvider`: requires a pre-resolved `hub` prop; `resolveHubKind` / `getHubLink` are only exported from `@bil/launchpad/shell/hub-kind` so `HUB` env is not read in the client bundle.
- `HubLink`: in native/PWA shells always `navigateToHub(url)` — no `history.back()`, which missed the hub after SPA navigations.
- `PwaInstallPrompt`: visit count increments once per page load (module guard), so Strict Mode remounts do not unlock the Android menu fallback early.

### Fixed

- Optional Capacitor peer deps (`@capacitor/app`, `@capacitor/browser`, `@capacitor/splash-screen`, `@capacitor/status-bar`) no longer break Next.js typecheck in web-only apps that omit them — ambient shims in `@bil/launchpad/shell`.
- `getAppContext()` / `isStandaloneShell()` treat `html.cap-native` as Capacitor native (late bridge) and recognize `fullscreen` / `minimal-ui` PWA display modes.

## 0.1.1

### Added

- `@bil/launchpad/shell` — `SCRIPTURE_HUB_URL`, `COMMUNITY_HUB_URL`, `initNativeViewportChrome()`, `syncNativeChromeForHost()`, `navigateToHub()` for Capacitor safe-area and hub navigation.
- `@bil/launchpad/shell/native-chrome-init` — `<NativeChromeInit />` client component (splash hide, status bar sync, Android back).
- Optional peer deps: `@capacitor/app`, `@capacitor/splash-screen`.

### Fixed

- `FeedbackModal` overlay padding now includes top safe-area inset.

## Unreleased

### Added

- `@bil/launchpad/shell` — `isStandaloneShell()`, `getAppContext()`, `isBilGameUrl()`, `cameFromBilGame()`, `openExternalUrl()`, `syncStatusBarForHost()`, `COMMUNITY_HUB_HOST` for PWA and Capacitor shell UX. Native `openExternalUrl` uses `@capacitor/browser` when available.
- Analytics client attaches `$app_context` (`web` | `pwa` | `native`) on every event

### Fixed

- Capacitor `@capacitor/app` ambient shims now include `minimizeApp()` and `appUrlOpen` so native shell bridges in consumer apps typecheck.
