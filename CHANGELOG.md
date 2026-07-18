# Changelog

## 0.1.2

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
