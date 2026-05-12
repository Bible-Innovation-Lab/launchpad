/**
 * Example: a button that fires a custom analytics event when clicked.
 *
 * Use as a copy-paste starting point. `track()` is fire-and-forget — it
 * never blocks the UI and never throws.
 */

"use client";

import { track } from "@/lib/analytics/client";

export default function TrackedButton({
  event,
  label,
  children,
}: {
  event: string; // event name to fire (e.g. "share_clicked")
  label?: string; // optional property attached to the event
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => track(event, label ? { label } : undefined)}
      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
    >
      {children}
    </button>
  );
}
