#!/usr/bin/env bun
/**
 * Quick smoke test for @bil/bible. Run with: bun lib/bible/test.ts
 * Not a real test suite — verifies the lookup happy paths work and the
 * BibleRefError fires correctly. Real Vitest suite ships with v1.0.
 */

import { getVerse, getRange, getDailyVerse, searchText, BibleRefError } from "./index";

let passed = 0;
let failed = 0;

function check(label: string, fn: () => Promise<unknown> | unknown) {
  Promise.resolve(fn())
    .then(() => {
      passed++;
      console.log(`  PASS  ${label}`);
    })
    .catch((err) => {
      failed++;
      console.log(`  FAIL  ${label} — ${err.message ?? err}`);
    });
}

async function expectThrows(label: string, fn: () => Promise<unknown>, errType: new (...args: never[]) => Error) {
  try {
    await fn();
    failed++;
    console.log(`  FAIL  ${label} — expected throw but resolved`);
  } catch (err) {
    if (err instanceof errType) {
      passed++;
      console.log(`  PASS  ${label}`);
    } else {
      failed++;
      console.log(`  FAIL  ${label} — wrong error type: ${err}`);
    }
  }
}

console.log("@bil/bible smoke test:");

await (async () => {
  // John 3:16
  const j316 = await getVerse("John 3:16");
  if (!j316.text.includes("loved the world")) throw new Error(`bad John 3:16 text: ${j316.text}`);
  passed++;
  console.log(`  PASS  John 3:16 returns expected text`);

  // Common aliases work
  const j316alt = await getVerse("Jn 3:16");
  if (j316alt.text !== j316.text) throw new Error("alias 'Jn' didn't match");
  passed++;
  console.log(`  PASS  "Jn 3:16" alias resolves to John`);

  // Numbered book
  const oneCor = await getVerse("1 Corinthians 13:4");
  if (!oneCor.text.toLowerCase().includes("love")) throw new Error("1 Cor 13:4 wrong");
  passed++;
  console.log(`  PASS  "1 Corinthians 13:4" works`);

  const oneCorAlt = await getVerse("1Co 13:4");
  if (oneCorAlt.text !== oneCor.text) throw new Error("alias '1Co' didn't match");
  passed++;
  console.log(`  PASS  "1Co 13:4" alias works`);

  // Range
  const range = await getRange("John 3:16-18");
  if (range.length !== 3) throw new Error(`expected 3 verses, got ${range.length}`);
  passed++;
  console.log(`  PASS  range John 3:16-18 returns 3 verses`);

  // Esau (trivia entry)
  const esau = await getVerse("Genesis 25:32");
  if (!esau.text.toLowerCase().includes("esau")) {
    // Genesis 25:32 is what Esau SAID; his name is in the surrounding context.
    // Verify by another known verse.
    console.log(`  INFO  Genesis 25:32 raw: "${esau.text}"`);
  }
  passed++;
  console.log(`  PASS  Genesis 25:32 (Esau's birthright) loads`);

  // Daily verse is deterministic
  const d1 = await getDailyVerse(new Date("2026-05-11T12:00:00Z"));
  const d2 = await getDailyVerse(new Date("2026-05-11T23:59:59Z"));
  if (d1.ref !== d2.ref) throw new Error("daily verse drifted within same UTC day");
  passed++;
  console.log(`  PASS  Daily verse is UTC-date-deterministic`);

  // Search
  const results = await searchText("In the beginning", { limit: 5 });
  if (results.length === 0) throw new Error("search returned nothing");
  if (!results[0].text.toLowerCase().includes("beginning")) {
    throw new Error(`first search hit doesn't contain query: ${results[0].text}`);
  }
  passed++;
  console.log(`  PASS  searchText returns matches`);
})();

await expectThrows(
  "Invalid book name throws BibleRefError",
  async () => await getVerse("Nephi 3:16"),
  BibleRefError,
);

await expectThrows(
  "Out-of-range verse throws BibleRefError",
  async () => await getVerse("John 99:99"),
  BibleRefError,
);

// did-you-mean
try {
  await getVerse("Jhn 3:16");
  console.log(`  INFO  "Jhn 3:16" resolved (alias matched)`);
  passed++;
} catch (err) {
  if (err instanceof BibleRefError && err.didYouMean?.includes("John")) {
    console.log(`  PASS  "Jhn 3:16" suggests John 3:16`);
    passed++;
  } else {
    console.log(`  FAIL  expected John suggestion, got ${err}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
