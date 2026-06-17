/**
 * Server-Sent Events helper for realtime multiplayer.
 *
 * SSE is the right transport for BIL games on Vercel: serverless functions
 * can't hold a WebSocket open, but they can stream a long-lived HTTP
 * response. The browser's native `EventSource` auto-reconnects, so we
 * close the stream well under Vercel's function timeout and let the client
 * reconnect transparently.
 *
 * Pattern: poll the realtime store on a short interval, compute a cheap
 * `signature` of the state, and only push a `state` event when it changes.
 * That keeps payloads small and the client render cheap while still feeling
 * instant (default 400ms poll).
 *
 * Usage in an app route (`app/api/rooms/[id]/stream/route.ts`):
 *
 *   import { createSSEStream } from "@bil/launchpad/realtime";
 *   import { realtimeStore } from "@bil/launchpad/realtime";
 *
 *   export const dynamic = "force-dynamic";
 *   export const maxDuration = 60;
 *
 *   export async function GET(req, { params }) {
 *     const { id } = await params;
 *     return createSSEStream({
 *       signal: req.signal,
 *       load: () => realtimeStore.get<RoomState>(`room:${id}`),
 *       signature: (s) => `${s.version}:${s.status}`,
 *     });
 *   }
 */

export interface SSEStreamOptions<T> {
  /** Read the current state. Return null to emit `not_found` and close. */
  load: () => Promise<T | null>;
  /**
   * Cheap change-detection key. The stream only pushes a new `state` event
   * when this value changes. Include everything the client reacts to
   * (e.g. a version counter plus status).
   */
  signature: (state: T) => string;
  /**
   * Optional side effect run on every poll BEFORE `load` — typically a
   * presence "touch" so the store knows this viewer is still connected.
   * Errors are swallowed so a transient store hiccup can't kill the stream.
   */
  onPoll?: () => Promise<void> | void;
  /** Poll interval in ms. Default 400. */
  pollIntervalMs?: number;
  /**
   * Self-imposed soft cap before closing the stream so the function exits
   * before Vercel kills it; EventSource reconnects automatically. Default
   * 25_000 (safely under both the 60s Node and 25s Edge limits, accounting
   * for the reconnect handshake). */
  maxDurationMs?: number;
  /** Keepalive comment interval to defeat proxy buffering. Default 15_000. */
  heartbeatMs?: number;
  /** EventSource reconnect hint in ms. Default 1_000. */
  retryMs?: number;
  /** Abort signal from the request (`req.signal`) so we clean up on disconnect. */
  signal?: AbortSignal;
  /** Name of the data event. Default "state". */
  eventName?: string;
}

/**
 * Build a `Response` that streams realtime state as Server-Sent Events.
 * Emits:
 *   - `event: hello`     once on connect
 *   - `event: <state>`   whenever the signature changes (name configurable)
 *   - `event: not_found` then closes, if `load()` returns null
 *   - `event: error`     on a load() throw (stream stays open to retry)
 *   - `: keepalive`      comment heartbeats
 */
export function createSSEStream<T>(opts: SSEStreamOptions<T>): Response {
  const pollIntervalMs = opts.pollIntervalMs ?? 400;
  const maxDurationMs = opts.maxDurationMs ?? 25_000;
  const heartbeatMs = opts.heartbeatMs ?? 15_000;
  const retryMs = opts.retryMs ?? 1_000;
  const eventName = opts.eventName ?? "state";

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let lastSignature = "";

      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      const sendEvent = (event: string, data: unknown) => {
        safeEnqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      const tick = async () => {
        if (opts.onPoll) {
          try {
            await opts.onPoll();
          } catch {
            // Presence is a soft signal — never let it break the stream.
          }
        }
        let state: T | null;
        try {
          state = await opts.load();
        } catch (err) {
          sendEvent("error", { message: (err as Error).message });
          return;
        }
        if (state === null) {
          sendEvent("not_found", {});
          finish();
          return;
        }
        const sig = opts.signature(state);
        if (sig !== lastSignature) {
          lastSignature = sig;
          sendEvent(eventName, state);
        }
      };

      let interval: ReturnType<typeof setInterval> | undefined;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      let softCap: ReturnType<typeof setTimeout> | undefined;

      const finish = () => {
        if (closed) return;
        closed = true;
        if (interval) clearInterval(interval);
        if (heartbeat) clearInterval(heartbeat);
        if (softCap) clearTimeout(softCap);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      // Faster reconnect than EventSource's 3s default keeps a
      // close→reconnect cycle inside typical presence TTL windows.
      safeEnqueue(`retry: ${retryMs}\n\n`);
      sendEvent("hello", {});
      await tick();

      interval = setInterval(() => void tick(), pollIntervalMs);
      heartbeat = setInterval(
        () => safeEnqueue(`: keepalive ${Date.now()}\n\n`),
        heartbeatMs
      );
      softCap = setTimeout(finish, maxDurationMs);

      opts.signal?.addEventListener("abort", finish);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
