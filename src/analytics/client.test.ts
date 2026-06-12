/**
 * Tests for the client beacon's first-beacon gate.
 *
 * The first track() must POST alone; later calls wait for its response
 * so the Set-Cookie lands before any other cookie-less request (prevents
 * duplicate mints / duplicate first_visit). Run: bun src/analytics/client.test.ts
 */

export {}; // top-level await requires module context

let passed = 0;
let failed = 0;

function assert(cond: boolean, name: string): void {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.error(`  FAIL  ${name}`);
  }
}

const flush = () => new Promise((r) => setTimeout(r, 20));

const sent: string[] = [];
let releaseFirst: (() => void) | undefined;

// Stub fetch: first request stays pending until released; rest resolve.
globalThis.fetch = ((_url: unknown, init?: { body?: string }) => {
  const body = JSON.parse(init?.body ?? "{}") as { event: string };
  sent.push(body.event);
  if (sent.length === 1) {
    return new Promise<Response>((resolve) => {
      releaseFirst = () => resolve(new Response(null, { status: 204 }));
    });
  }
  return Promise.resolve(new Response(null, { status: 204 }));
}) as typeof fetch;

const { track } = await import("./client");

console.log("track — first-beacon gate");

track("first");
track("second");
track("third");
await flush();

assert(sent.length === 1 && sent[0] === "first", "only the first beacon is sent while the gate is closed");

releaseFirst?.();
await flush();

assert(sent.includes("second") && sent.includes("third"), "queued beacons flush after the first response");
assert(sent.length === 3, "no duplicates after the gate opens");

track("fourth");
await flush();
assert(sent.length === 4 && sent[3] === "fourth", "later beacons go out immediately once the gate is open");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
