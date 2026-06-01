#!/usr/bin/env bun
/**
 * Bot filter unit tests.
 * Run with: bun src/analytics/bot-filter.test.ts
 */

import { isBotUserAgent } from "./bot-filter";

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}${detail ? " — " + detail : ""}`);
  }
}

const bots = [
  "Googlebot/2.1 (+http://www.google.com/bot.html)",
  "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  "facebookexternalhit/1.1",
  "Twitterbot/1.0",
  "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
  "HeadlessChrome/120.0.0.0",
  "curl/8.4.0",
  "python-requests/2.31.0",
  "Go-http-client/2.0",
  "Puppeteer/21.0.0",
  "GPTBot/1.0",
  "ClaudeBot/1.0",
  "meta-externalagent/1.1",
  "vercel-screenshot/1.0",
  "UptimeRobot/2.0",
];

const humans = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
];

console.log("isBotUserAgent — bots");
for (const ua of bots) {
  check(ua.slice(0, 48), isBotUserAgent(ua));
}

console.log("isBotUserAgent — humans");
for (const ua of humans) {
  check(ua.slice(0, 48), !isBotUserAgent(ua));
}

check("empty string", isBotUserAgent(""));
check("whitespace", isBotUserAgent("   "));
check("undefined", isBotUserAgent(undefined));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
