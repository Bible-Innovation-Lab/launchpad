# Changelog

## Unreleased

### Added

- `@bil/launchpad/shell` — `isStandaloneShell()`, `getAppContext()`, `isBilGameUrl()`, `cameFromBilGame()`, `openExternalUrl()`, `syncStatusBarForHost()`, `COMMUNITY_HUB_HOST` for PWA and Capacitor shell UX. Native `openExternalUrl` uses `@capacitor/browser` when available.
- Analytics client attaches `$app_context` (`web` | `pwa` | `native`) on every event
