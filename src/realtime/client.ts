"use client";
/**
 * Client-side subscription to a `createSSEStream` endpoint.
 *
 * Pairs with `@bil/launchpad/realtime`'s `createSSEStream` on the server.
 * Opens an `EventSource`, parses each `state` event as JSON, and re-renders
 * with the latest value. The browser auto-reconnects, so a server soft-close
 * (under Vercel's function timeout) is transparent.
 *
 * This is a SEPARATE entry point from `@bil/launchpad/realtime` on purpose:
 * the server store imports `@upstash/redis`, which must never end up in a
 * client bundle. Import this hook from client components only.
 *
 *   "use client";
 *   import { useRealtimeChannel } from "@bil/launchpad/realtime/client";
 *
 *   const { state, status } = useRealtimeChannel<RoomView>(
 *     roomId ? `/api/game/${roomId}/stream?playerId=${me}` : null
 *   );
 *
 * Pass `null` for the url to stay disconnected (e.g. before an id is known).
 */

import { useEffect, useState } from "react";

export type RealtimeStatus = "connecting" | "open" | "closed";

export interface UseRealtimeChannelResult<T> {
  /** Latest state pushed by the server; null until the first message. */
  state: T | null;
  /** Connection lifecycle. "connecting" also covers auto-reconnect attempts. */
  status: RealtimeStatus;
  /** True once the server signalled the resource doesn't exist (`not_found`). */
  notFound: boolean;
}

export interface UseRealtimeChannelOptions {
  /**
   * SSE event name carrying the JSON state. Must match `createSSEStream`'s
   * `eventName` (default "state").
   */
  event?: string;
}

export function useRealtimeChannel<T>(
  url: string | null,
  options: UseRealtimeChannelOptions = {}
): UseRealtimeChannelResult<T> {
  const event = options.event ?? "state";
  const [state, setState] = useState<T | null>(null);
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!url) {
      setStatus("closed");
      return;
    }
    setStatus("connecting");
    setNotFound(false);

    const es = new EventSource(url);
    es.onopen = () => setStatus("open");
    es.addEventListener(event, (e) => {
      try {
        setState(JSON.parse((e as MessageEvent).data) as T);
      } catch {
        // Ignore malformed frames; the next good one wins.
      }
    });
    es.addEventListener("not_found", () => setNotFound(true));
    // EventSource reconnects on its own after an error/soft-close; surface
    // that as "connecting" rather than a hard "closed".
    es.onerror = () => setStatus("connecting");

    return () => {
      es.close();
      setStatus("closed");
    };
  }, [url, event]);

  return { state, status, notFound };
}
