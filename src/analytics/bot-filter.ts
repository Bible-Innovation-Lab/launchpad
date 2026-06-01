/**
 * Shared bot / automation detection for analytics.
 *
 * Used by the edge proxy (skip cookie mint), the /api/analytics handler
 * (defense in depth), and the client beacon (skip fire-and-forget POSTs).
 */

// Known crawlers, link preview fetchers, uptime monitors, and HTTP clients
// that should not mint anon cookies or emit PostHog events.
const BOT_UA_RE =
  /bot\b|crawl|spider|slurp|headless|phantomjs|selenium|webdriver|puppeteer|playwright|scrapy|wget\b|curl\b|python-requests|go-http-client|java\/|httpclient|libwww-perl|postmanruntime|insomnia|meta-externalagent|google-extended|petalbot|ia_archiver|archive\.org_bot|dotbot|rogerbot|mj12bot|blexbot|slackbot|preview|whatsapp|telegram|discordbot|facebookexternalhit|twitterbot|linkedinbot|pingdom|uptimerobot|lighthouse|gtmetrix|vercel-screenshot|vercelbot|bytespider|gptbot|claudebot|amazonbot|semrush|ahrefs|yandex|baiduspider|duckduckbot|mediapartners-google|adsbot-google|applebot|bingpreview|skypeuripreview|vkshare|w3c_validator|validator\.nu/i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua?.trim()) return true;
  return BOT_UA_RE.test(ua);
}

/** Client-only: automation signals not visible on the server request. */
export function isAutomatedBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  if (navigator.webdriver) return true;
  return isBotUserAgent(navigator.userAgent);
}
