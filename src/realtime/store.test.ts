#!/usr/bin/env bun
/**
 * Realtime store unit tests.
 * Run with: bun src/realtime/store.test.ts
 *
 * Exercises both backends:
 *   - the in-memory fallback (forceMemory)
 *   - the Redis backend against a tiny in-process fake RedisLike that
 *     honours the SET NX / EX, GETDEL, MGET, PTTL semantics we depend on.
 */

import { createRealtimeStore, type RedisLike } from "./store";

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

// Minimal RedisLike fake honouring the subset the store uses. Tracks the
// raw key strings so we can assert namespacing.
function makeFakeRedis() {
  interface Entry {
    value: unknown;
    expiresAt: number | null;
  }
  const map = new Map<string, Entry>();
  const live = (key: string): Entry | undefined => {
    const e = map.get(key);
    if (!e) return undefined;
    if (e.expiresAt !== null && e.expiresAt <= Date.now()) {
      map.delete(key);
      return undefined;
    }
    return e;
  };
  const client: RedisLike & { _keys(): string[] } = {
    async get<T>(key: string) {
      const e = live(key);
      return e ? (e.value as T) : null;
    },
    async mget<T>(...keys: string[]) {
      return keys.map((key) => {
        const e = live(key);
        return e ? (e.value as T) : null;
      });
    },
    async set(key, value, opts) {
      if (opts?.nx === true && live(key)) return null;
      map.set(key, {
        value,
        expiresAt: opts?.ex !== undefined ? Date.now() + opts.ex * 1000 : null,
      });
      return "OK";
    },
    async del(...keys: string[]) {
      let n = 0;
      for (const key of keys) if (map.delete(key)) n++;
      return n;
    },
    async getdel<T>(key: string) {
      const e = live(key);
      if (!e) return null;
      map.delete(key);
      return e.value as T;
    },
    async pttl(key: string) {
      const e = map.get(key);
      if (!e || e.expiresAt === null) return -1;
      return e.expiresAt - Date.now();
    },
    _keys() {
      return [...map.keys()];
    },
  };
  return client;
}

interface Room {
  version: number;
  players: string[];
}

async function runBackend(name: string, store: ReturnType<typeof createRealtimeStore>) {
  console.log(`\n[${name}] basic get/set`);
  check("get missing → null", (await store.get("nope")) === null);
  await store.set<Room>("room:1", { version: 1, players: ["a"] });
  const got = await store.get<Room>("room:1");
  check("round-trips JSON", got?.version === 1 && got.players[0] === "a");

  console.log(`[${name}] mget`);
  await store.set<Room>("room:2", { version: 2, players: [] });
  const many = await store.mget<Room>(["room:1", "room:2", "room:missing"]);
  check(
    "mget returns values + null in order",
    many.length === 3 &&
      many[0]?.version === 1 &&
      many[1]?.version === 2 &&
      many[2] === null
  );

  console.log(`[${name}] setIfAbsent (lock)`);
  const first = await store.setIfAbsent("lock:x", "1");
  const second = await store.setIfAbsent("lock:x", "2");
  check("first claim wins", first === true);
  check("second claim loses", second === false);

  console.log(`[${name}] getDel (atomic claim)`);
  await store.set("queue:waiting", "room-abc");
  const claimed = await store.getDel<string>("queue:waiting");
  const claimedAgain = await store.getDel<string>("queue:waiting");
  check("getDel returns value", claimed === "room-abc");
  check("getDel is one-shot", claimedAgain === null);

  console.log(`[${name}] del`);
  await store.set("temp", { version: 9, players: [] });
  await store.del("temp");
  check("del removes the key", (await store.get("temp")) === null);

  console.log(`[${name}] pttlMs`);
  await store.set("ttl:none", "x");
  check("no-ttl key → 0", (await store.pttlMs("ttl:none")) === 0);
  await store.set("ttl:some", "x", { ttlSeconds: 10 });
  const ttl = await store.pttlMs("ttl:some");
  check("ttl key → positive ms", ttl > 0 && ttl <= 10_000);
  check("absent key → 0", (await store.pttlMs("ttl:absent")) === 0);
}

await runBackend("memory", createRealtimeStore({ forceMemory: true, namespace: "t" }));

const fake = makeFakeRedis();
const redisStore = createRealtimeStore({ client: fake, namespace: "duel" });
await runBackend("redis", redisStore);

console.log("\n[redis] namespacing");
check("isPersistent is true for redis backend", redisStore.isPersistent === true);
check(
  "keys are prefixed with the namespace",
  fake._keys().every((k) => k.startsWith("duel:")),
  fake._keys().join(", ")
);

console.log("\n[memory] isPersistent");
check(
  "isPersistent is false for memory backend",
  createRealtimeStore({ forceMemory: true }).isPersistent === false
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
