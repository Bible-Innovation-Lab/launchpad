# Changelog

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
