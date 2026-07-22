import type { MetadataRoute } from "next";

/** Paths under `public/` referenced by the web app manifest and layout metadata. */
export const pwaIconPaths = {
	svg: "/icon.svg",
	png: "/icon.png",
	png192: "/icon-192.png",
	png512: "/icon-512.png",
	appleTouch: "/apple-touch-icon.png",
} as const;

export type CreateWebManifestInput = {
	name: string;
	shortName: string;
	description: string;
	backgroundColor: string;
	themeColor: string;
	iconPaths?: Partial<typeof pwaIconPaths>;
	id?: string;
	startUrl?: string;
	scope?: string;
	display?: MetadataRoute.Manifest["display"];
	categories?: string[];
};

/**
 * Build a Next.js `MetadataRoute.Manifest` from app-supplied fields.
 * Call from `app/manifest.ts` — do not import app `siteConfig` into the package.
 */
export function createWebManifest(
	input: CreateWebManifestInput,
): MetadataRoute.Manifest {
	const icons = { ...pwaIconPaths, ...input.iconPaths };

	return {
		id: input.id ?? "/",
		name: input.name,
		short_name: input.shortName,
		description: input.description,
		start_url: input.startUrl ?? "/",
		scope: input.scope ?? "/",
		display: input.display ?? "standalone",
		categories: input.categories ?? ["games", "entertainment"],
		background_color: input.backgroundColor,
		theme_color: input.themeColor,
		icons: [
			{
				src: icons.png192,
				sizes: "192x192",
				type: "image/png",
			},
			{
				src: icons.png512,
				sizes: "512x512",
				type: "image/png",
				purpose: "maskable",
			},
			{
				src: icons.png512,
				sizes: "512x512",
				type: "image/png",
			},
			{
				src: icons.png,
				sizes: "any",
				type: "image/png",
				purpose: "any",
			},
			{
				src: icons.svg,
				sizes: "any",
				type: "image/svg+xml",
				purpose: "any",
			},
		],
	};
}
