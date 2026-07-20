"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Registers `/sw.js` in production. The service worker file must live in
 * each app's `public/` — it cannot be loaded from node_modules.
 */
export function ServiceWorkerRegistration({
	children,
}: {
	children: ReactNode;
}) {
	useEffect(() => {
		if (process.env.NODE_ENV === "development") return;
		if (!("serviceWorker" in navigator)) return;

		void navigator.serviceWorker.register("/sw.js").catch(() => {
			// Install prompt still works on iOS; Android may lack installability without SW.
		});
	}, []);

	return children;
}
