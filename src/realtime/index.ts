/**
 * @bil/launchpad/realtime — the multiplayer toolkit.
 *
 * Two primitives that together cover cross-player state on Vercel:
 *   - `realtimeStore` / `createRealtimeStore` — Upstash-backed KV store
 *     (with a dev in-memory fallback) for shared room/game state.
 *   - `createSSEStream` — Server-Sent Events helper to push state changes
 *     to connected players in near-real time.
 *
 * See ./store.ts and ./sse.ts for details.
 */

export {
  realtimeStore,
  createRealtimeStore,
  type RealtimeStore,
  type RealtimeSetOptions,
  type CreateRealtimeStoreOptions,
  type RedisLike,
} from "./store";

export { createSSEStream, type SSEStreamOptions } from "./sse";
