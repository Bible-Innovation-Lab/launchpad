/**
 * @bil/launchpad/share — text share cascade.
 *
 * `navigator.share` → clipboard. Fires a PostHog event via the analytics
 * beacon (default `share_clicked`). Message / emoji / OG generation stays
 * in the consuming app.
 */

import { track, type JSONValue } from "../analytics/client";

export type ShareTextResult = "share" | "copy" | "cancelled";

export type ShareTextOptions = {
	text: string;
	title?: string;
	url?: string;
	/** PostHog event name. Defaults to `share_clicked`. */
	eventName?: string;
	/** Extra properties merged into the analytics event. */
	props?: Record<string, JSONValue>;
};

export async function shareText(
	options: ShareTextOptions,
): Promise<ShareTextResult> {
	const { text, title, url, eventName = "share_clicked", props } = options;

	const payload: ShareData = { text };
	if (title) payload.title = title;
	if (url) payload.url = url;

	if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
		try {
			await navigator.share(payload);
			track(eventName, { result: "share", ...(props ?? {}) });
			return "share";
		} catch (err) {
			if (err instanceof Error && err.name === "AbortError") {
				track(eventName, { result: "cancelled", ...(props ?? {}) });
				return "cancelled";
			}
			// fall through to clipboard
		}
	}

	if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
		const clipboardText = url ? `${text}\n\n${url}` : text;
		try {
			await navigator.clipboard.writeText(clipboardText);
			track(eventName, { result: "copy", ...(props ?? {}) });
			return "copy";
		} catch {
			// fall through
		}
	}

	track(eventName, { result: "cancelled", ...(props ?? {}) });
	return "cancelled";
}
