/**
 * Tests for the session clock's active-time accounting.
 *
 * The clock must count only foreground time: pause() freezes it, resume()
 * restarts it, and elapsedMs() reflects accumulated active time regardless
 * of how many pause/resume cycles happened. Run: bun src/analytics/session-timer.test.ts
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

const { createSessionClock } = await import("./session-timer");

console.log("createSessionClock — active-time accounting");

// Controllable fake clock.
let t = 0;
const now = () => t;

{
  const clock = createSessionClock(now);
  t = 5_000;
  assert(clock.elapsedMs() === 5000, "counts elapsed time while running");
}

{
  t = 0;
  const clock = createSessionClock(now);
  t = 3_000;
  clock.pause();
  t = 10_000; // time passes while paused (hidden tab)
  assert(clock.elapsedMs() === 3000, "does not count time while paused");
}

{
  t = 0;
  const clock = createSessionClock(now);
  t = 2_000;
  clock.pause();
  t = 12_000;
  clock.resume();
  t = 14_000;
  assert(clock.elapsedMs() === 4000, "accumulates across a pause/resume cycle");
}

{
  t = 0;
  const clock = createSessionClock(now);
  t = 1_000;
  clock.pause();
  clock.pause(); // idempotent
  t = 5_000;
  clock.resume();
  clock.resume(); // idempotent
  t = 6_000;
  assert(clock.elapsedMs() === 2000, "pause/resume are idempotent");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
