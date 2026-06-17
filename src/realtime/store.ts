/**
 * Realtime KV store — the cross-invocation state layer that makes
 * multiplayer work on Vercel.
 *
 * Why this exists: on Vercel every request can land on a different
 * serverless function instance, so an in-process `Map` can't be the
 * source of truth for shared game/room state — two players would never
 * see each other. This store puts that state in Upstash Redis (over the
 * REST API, edge/serverless friendly) so all invocations read and write
 * the same place.
 *
 * Backend selection (first match wins):
 *   1. `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
 *   2. `KV_REST_API_URL` + `KV_REST_API_TOKEN` (Vercel KV / Marketplace
 *      Upstash injects this pair automatically)
 *   3. in-process `Map` fallback — dev convenience only. A single
 *      `next dev` worker serves both players from one process, so this
 *      is enough locally; it will NOT work across Vercel invocations.
 *
 * bil-provisioning injects the shared Upstash credentials into every
 * student project at `./scripts/setup.sh` time, so production apps get a
 * real backend with zero config.
 *
 * Keys are namespaced by `APP_ID` (`<app-id>:<key>`) so many apps can
 * safely share one Redis instance without colliding. Pass an explicit
 * `namespace` to override.
 *
 * Usage (default singleton, reads env at first call):
 *
 *   import { realtimeStore } from "@bil/launchpad/realtime";
 *   await realtimeStore.set(`room:${id}`, state, { ttlSeconds: 3600 });
 *   const state = await realtimeStore.get<RoomState>(`room:${id}`);
 *
 * Usage (factory, for tests / DI):
 *
 *   const store = createRealtimeStore({ client: fakeRedis, namespace: "x" });
 */

import { Redis } from "@upstash/redis";

export interface RealtimeSetOptions {
  /** Expire the key after this many seconds. */
  ttlSeconds?: number;
}

export interface RealtimeStore {
  /** Read a JSON value. Returns null when the key is absent. */
  get<T>(key: string): Promise<T | null>;
  /** Read many JSON values at once. `null` entry = absent key. */
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  /** Write a JSON value, optionally with a TTL. */
  set<T>(key: string, value: T, opts?: RealtimeSetOptions): Promise<void>;
  /** Delete one or more keys. */
  del(...keys: string[]): Promise<void>;
  /**
   * Atomic get-and-delete. The cornerstone of a race-free matchmaking
   * queue: only one caller can ever claim a given waiting slot.
   */
  getDel<T>(key: string): Promise<T | null>;
  /**
   * Set only if the key does not already exist (SET NX). Returns true if
   * this call created it. Use for locks / claims.
   */
  setIfAbsent<T>(
    key: string,
    value: T,
    opts?: RealtimeSetOptions
  ): Promise<boolean>;
  /**
   * Remaining time-to-live in milliseconds. 0 when the key is absent or
   * has no expiry. Handy for presence ("did the opponent ping recently?").
   */
  pttlMs(key: string): Promise<number>;
  /**
   * True when backed by a real Redis (Upstash / Vercel KV); false when
   * using the dev-only in-memory fallback. Useful for a one-time warning.
   */
  readonly isPersistent: boolean;
}

export interface CreateRealtimeStoreOptions {
  /**
   * Key prefix. Defaults to `process.env.APP_ID`. Falls back to `"app"`
   * if APP_ID is unset (local dev). Pass explicitly in tests.
   */
  namespace?: string;
  /**
   * Provide a pre-built Upstash Redis client (or a compatible fake for
   * tests). When omitted, the store reads credentials from env and builds
   * one, or falls back to the in-memory backend if none are present.
   */
  client?: RedisLike;
  /**
   * Force the in-memory backend regardless of env. Tests / local tooling.
   */
  forceMemory?: boolean;
}

// Minimal subset of @upstash/redis we depend on. Lets tests inject a fake
// without standing up a real Redis.
export interface RedisLike {
  get<T = unknown>(key: string): Promise<T | null>;
  mget<T = unknown>(...keys: string[]): Promise<(T | null)[]>;
  set(
    key: string,
    value: unknown,
    opts?: { ex?: number; nx?: true }
  ): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  getdel<T = unknown>(key: string): Promise<T | null>;
  pttl(key: string): Promise<number>;
}

function resolveNamespace(explicit?: string): string {
  if (explicit && explicit.length > 0) return explicit;
  const appId = process.env.APP_ID;
  return appId && appId.length > 0 ? appId : "app";
}

function readRedisCredentials(): { url: string; token: string } | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (url && token) return { url, token };
  return null;
}

// ---------------------------------------------------------------------------
// Redis backend

function buildRedisStore(client: RedisLike, namespace: string): RealtimeStore {
  const k = (key: string) => `${namespace}:${key}`;

  return {
    isPersistent: true,
    async get<T>(key: string) {
      const raw = await client.get<T | string>(k(key));
      if (raw === null || raw === undefined) return null;
      // Upstash auto-deserializes JSON; be defensive if a legacy string
      // value snuck in.
      if (typeof raw === "string") {
        try {
          return JSON.parse(raw) as T;
        } catch {
          return raw as unknown as T;
        }
      }
      return raw as T;
    },
    async mget<T>(keys: string[]) {
      if (keys.length === 0) return [];
      const values = await client.mget<T>(...keys.map(k));
      return (values ?? []).map((v) => (v === undefined ? null : v));
    },
    async set<T>(key: string, value: T, opts?: RealtimeSetOptions) {
      await client.set(
        k(key),
        value,
        opts?.ttlSeconds ? { ex: opts.ttlSeconds } : undefined
      );
    },
    async del(...keys: string[]) {
      if (keys.length === 0) return;
      await client.del(...keys.map(k));
    },
    async getDel<T>(key: string) {
      const v = await client.getdel<T>(k(key));
      return v ?? null;
    },
    async setIfAbsent<T>(key: string, value: T, opts?: RealtimeSetOptions) {
      const result = await client.set(k(key), value, {
        nx: true,
        ...(opts?.ttlSeconds ? { ex: opts.ttlSeconds } : {}),
      });
      return result === "OK";
    },
    async pttlMs(key: string) {
      const ttl = await client.pttl(k(key));
      return ttl > 0 ? ttl : 0;
    },
  };
}

// ---------------------------------------------------------------------------
// In-memory backend (dev only)

interface MemoryEntry {
  value: unknown;
  expiresAt: number | null; // ms epoch; null = no TTL
}

interface MemoryStore {
  map: Map<string, MemoryEntry>;
}

function buildMemoryStore(namespace: string): RealtimeStore {
  // Survive HMR / module reloads in `next dev` by hanging the map off the
  // global object — otherwise each route reload would reset all state.
  const globalRef = globalThis as unknown as {
    __bilRealtimeStore?: MemoryStore;
  };
  if (!globalRef.__bilRealtimeStore) {
    globalRef.__bilRealtimeStore = { map: new Map() };
  }
  const store = globalRef.__bilRealtimeStore;
  const k = (key: string) => `${namespace}:${key}`;

  const read = (key: string): MemoryEntry | undefined => {
    const entry = store.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      store.map.delete(key);
      return undefined;
    }
    return entry;
  };

  return {
    isPersistent: false,
    async get<T>(key: string) {
      const entry = read(k(key));
      return entry ? (entry.value as T) : null;
    },
    async mget<T>(keys: string[]) {
      return keys.map((key) => {
        const entry = read(k(key));
        return entry ? (entry.value as T) : null;
      });
    },
    async set<T>(key: string, value: T, opts?: RealtimeSetOptions) {
      store.map.set(k(key), {
        value,
        expiresAt: opts?.ttlSeconds ? Date.now() + opts.ttlSeconds * 1000 : null,
      });
    },
    async del(...keys: string[]) {
      for (const key of keys) store.map.delete(k(key));
    },
    async getDel<T>(key: string) {
      const entry = read(k(key));
      if (!entry) return null;
      store.map.delete(k(key));
      return entry.value as T;
    },
    async setIfAbsent<T>(key: string, value: T, opts?: RealtimeSetOptions) {
      if (read(k(key))) return false;
      store.map.set(k(key), {
        value,
        expiresAt: opts?.ttlSeconds ? Date.now() + opts.ttlSeconds * 1000 : null,
      });
      return true;
    },
    async pttlMs(key: string) {
      const entry = store.map.get(k(key));
      if (!entry || entry.expiresAt === null) return 0;
      const ms = entry.expiresAt - Date.now();
      return ms > 0 ? ms : 0;
    },
  };
}

// ---------------------------------------------------------------------------
// Factory + default singleton

export function createRealtimeStore(
  opts: CreateRealtimeStoreOptions = {}
): RealtimeStore {
  const namespace = resolveNamespace(opts.namespace);

  if (opts.forceMemory) return buildMemoryStore(namespace);
  if (opts.client) return buildRedisStore(opts.client, namespace);

  const creds = readRedisCredentials();
  if (creds) {
    return buildRedisStore(new Redis(creds) as unknown as RedisLike, namespace);
  }

  if (process.env.NODE_ENV === "production") {
    // Don't silently use the in-memory store in prod — multiplayer would
    // appear to work for one player and break for the other.
    console.warn(
      "[@bil/launchpad/realtime] No Upstash/Vercel KV credentials found. " +
        "Falling back to an in-memory store, which does NOT work across " +
        "Vercel function invocations. Set UPSTASH_REDIS_REST_URL + " +
        "UPSTASH_REDIS_REST_TOKEN (bil-provisioning injects these) to " +
        "enable real multiplayer."
    );
  }
  return buildMemoryStore(namespace);
}

let _singleton: RealtimeStore | null = null;

/** Lazily-built default store, namespaced by `APP_ID`. */
export const realtimeStore: RealtimeStore = {
  get isPersistent() {
    return (_singleton ??= createRealtimeStore()).isPersistent;
  },
  get: (key) => (_singleton ??= createRealtimeStore()).get(key),
  mget: (keys) => (_singleton ??= createRealtimeStore()).mget(keys),
  set: (key, value, opts) =>
    (_singleton ??= createRealtimeStore()).set(key, value, opts),
  del: (...keys) => (_singleton ??= createRealtimeStore()).del(...keys),
  getDel: (key) => (_singleton ??= createRealtimeStore()).getDel(key),
  setIfAbsent: (key, value, opts) =>
    (_singleton ??= createRealtimeStore()).setIfAbsent(key, value, opts),
  pttlMs: (key) => (_singleton ??= createRealtimeStore()).pttlMs(key),
};
