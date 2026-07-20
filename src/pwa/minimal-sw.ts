/**
 * Canonical minimal service worker for PWA installability.
 *
 * Copy this file to each app's `public/sw.js`. Service workers cannot be
 * loaded from node_modules. Apps that need web push may extend this file
 * with `push` / `notificationclick` handlers (see bil-app-template).
 */
export const MINIMAL_PWA_SERVICE_WORKER = `self.addEventListener("install", (event) => {
	event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
});

// Chrome requires a fetch handler for PWA installability.
self.addEventListener("fetch", () => {});
`;
