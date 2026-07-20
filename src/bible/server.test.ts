#!/usr/bin/env bun
/**
 * Smoke + behavior tests for @bil/launchpad/bible (src/bible/server.ts).
 * Run with: bun src/bible/server.test.ts
 *
 * Uses a stubbed fetch — does not hit YouVersion.
 */

import {
  createYouVersionClient,
  refToUsfm,
  buildBibleComUrl,
  DEFAULT_BIBLE_ID,
  BibleRefError,
  YouVersionError,
} from "./server";

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

async function expectThrows<E extends new (...args: never[]) => Error>(
  label: string,
  fn: () => unknown | Promise<unknown>,
  ErrType: E
) {
  try {
    await fn();
    failed++;
    console.log(`  FAIL  ${label} — expected throw but resolved`);
  } catch (err) {
    if (err instanceof ErrType) {
      passed++;
      console.log(`  PASS  ${label}`);
    } else {
      failed++;
      console.log(`  FAIL  ${label} — wrong error type: ${err}`);
    }
  }
}

// ---------------------------------------------------------------------------
// refToUsfm (pure)

console.log("refToUsfm —");
check("single verse", refToUsfm("John 3:16") === "JHN.3.16");
check("range", refToUsfm("John 3:16-21") === "JHN.3.16-21");
check("chapter only", refToUsfm("John 3") === "JHN.3");
check("multi-word book (1 Corinthians)", refToUsfm("1 Corinthians 13:4") === "1CO.13.4");
check("multi-word book (Song of Solomon)", refToUsfm("Song of Solomon 1:1") === "SNG.1.1");
check("lowercase book name normalized", refToUsfm("john 3:16") === "JHN.3.16");
check("USFM chapter passthrough", refToUsfm("GEN.1") === "GEN.1");
check("USFM verse passthrough", refToUsfm("JHN.3.16") === "JHN.3.16");
check("USFM range passthrough", refToUsfm("MAT.21.12-17") === "MAT.21.12-17");
check("USFM numbered book passthrough", refToUsfm("1SA.17") === "1SA.17");
check("USFM lowercase normalized", refToUsfm("jhn.3.16") === "JHN.3.16");
check("Psalm singular → Psalms is NOT auto-aliased (v0.1.0 strict)",
  (() => {
    try { refToUsfm("Psalm 23:1"); return false; }
    catch (e) { return e instanceof BibleRefError; }
  })()
);
await expectThrows("bad book name throws BibleRefError",
  () => refToUsfm("Bogus 1:1"), BibleRefError);
await expectThrows("malformed shape throws BibleRefError",
  () => refToUsfm("not a reference"), BibleRefError);
await expectThrows("bad USFM book throws BibleRefError",
  () => refToUsfm("XYZ.1.1"), BibleRefError);

// ---------------------------------------------------------------------------
// Fake fetch helper

type FetchResp = { status: number; body: unknown };
function stubFetch(responses: FetchResp[]) {
  let i = 0;
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ url: String(url), headers });
    const r = responses[i++] ?? responses[responses.length - 1];
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { fn, calls };
}

// ---------------------------------------------------------------------------
// getVerse

console.log("\ngetVerse —");
{
  const stub = stubFetch([
    { status: 200, body: { id: "JHN.3.16", reference: "John 3:16", content: "For God so loved..." } },
  ]);
  const yv = createYouVersionClient({ apiKey: "test-key", fetch: stub.fn });
  const p = await yv.getVerse("John 3:16");
  check("returns Passage shape", p.id === "JHN.3.16" && p.reference === "John 3:16" && p.content.startsWith("For God"));
  check("called the right URL", stub.calls[0].url.includes("/bibles/111/passages/JHN.3.16?format=text"));
  check("sent X-YVP-App-Key header", stub.calls[0].headers["X-YVP-App-Key"] === "test-key");
}

// ---------------------------------------------------------------------------
// getRange — returns single concatenated Passage (not Verse[])

console.log("\ngetRange —");
{
  const stub = stubFetch([
    { status: 200, body: { id: "JHN.3.16-17", reference: "John 3:16-17", content: "For God so loved... For God did not send..." } },
  ]);
  const yv = createYouVersionClient({ apiKey: "test-key", fetch: stub.fn });
  const p = await yv.getRange("John 3:16-17");
  check("range returns one Passage", p.id === "JHN.3.16-17");
  check("range URL uses range shape", stub.calls[0].url.includes("/passages/JHN.3.16-17"));
}
{
  const stub = stubFetch([
    { status: 200, body: { id: "GEN.1", reference: "Genesis 1", content: "In the beginning..." } },
  ]);
  const yv = createYouVersionClient({ apiKey: "test-key", fetch: stub.fn });
  const p = await yv.getRange("GEN.1");
  check("USFM getRange passthrough", p.id === "GEN.1");
  check("USFM getRange URL", stub.calls[0].url.includes("/passages/GEN.1?format=text"));
}

// ---------------------------------------------------------------------------
// getDailyVerse — 2 calls

console.log("\ngetDailyVerse —");
{
  const stub = stubFetch([
    { status: 200, body: { day: 133, passage_id: "PRO.13.20" } },
    { status: 200, body: { id: "PRO.13.20", reference: "Proverbs 13:20", content: "Walk with the wise..." } },
  ]);
  const yv = createYouVersionClient({ apiKey: "test-key", fetch: stub.fn });
  const date = new Date("2026-05-13T00:00:00Z"); // day 133
  const p = await yv.getDailyVerse(date);
  check("returns the passage from the looked-up id", p.id === "PRO.13.20");
  check("first call hit verse_of_the_days/133", stub.calls[0].url.endsWith("/verse_of_the_days/133"));
  check("second call hit passages/PRO.13.20", stub.calls[1].url.includes("/passages/PRO.13.20"));
}

// ---------------------------------------------------------------------------
// Error paths

console.log("\nerror paths —");
{
  // 401 from YouVersion
  const stub = stubFetch([{ status: 401, body: { fault: "bad key" } }]);
  const yv = createYouVersionClient({ apiKey: "wrong", fetch: stub.fn });
  await expectThrows("401 → YouVersionError",
    () => yv.getVerse("John 3:16"), YouVersionError);
}
{
  // Empty content (whole-book request)
  const stub = stubFetch([{ status: 200, body: { id: null, reference: null, content: "" } }]);
  const yv = createYouVersionClient({ apiKey: "test", fetch: stub.fn });
  await expectThrows("empty content → YouVersionError",
    () => yv.getVerse("John 3:16"), YouVersionError);
}
{
  // verse-of-day returns no passage_id (broken contract)
  const stub = stubFetch([{ status: 200, body: { day: 1 } }]);
  const yv = createYouVersionClient({ apiKey: "test", fetch: stub.fn });
  await expectThrows("vod without passage_id → YouVersionError",
    () => yv.getDailyVerse(new Date("2026-01-01T00:00:00Z")), YouVersionError);
}

// ---------------------------------------------------------------------------
// Configuration

console.log("\nconfiguration —");
{
  let threw = false;
  try { createYouVersionClient({ apiKey: "" }); } catch { threw = true; }
  check("empty apiKey throws at factory", threw);
}

console.log("\nbuildBibleComUrl —");
{
  check(
    "default NIV url",
    buildBibleComUrl("JHN.3.16") ===
      `https://www.bible.com/bible/${DEFAULT_BIBLE_ID}/JHN.3.16`,
  );
  check(
    "abbreviation suffix",
    buildBibleComUrl("JHN.3.16", { abbreviation: "NIV" }) ===
      "https://www.bible.com/bible/111/JHN.3.16.NIV",
  );
  check(
    "alternate versionId",
    buildBibleComUrl("JHN.6.9", { versionId: 59 }) ===
      "https://www.bible.com/bible/59/JHN.6.9",
  );
}

console.log("\nbibleId override —");
{
  const stub = stubFetch([
    {
      status: 200,
      body: { id: "JHN.3.16", reference: "John 3:16", content: "For God…" },
    },
  ]);
  const yv = createYouVersionClient({
    apiKey: "test",
    bibleId: 59,
    fetch: stub.fn,
  });
  await yv.getVerse("John 3:16");
  check(
    "fetch uses overridden bible id",
    stub.calls[0].url.includes("/bibles/59/passages/") === true,
    stub.calls[0].url,
  );
}

// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
