/**
 * Example: a share button that renders a Wordle-style grid PNG on the
 * user's device and triggers the native share sheet (or clipboard
 * fallback). NO spoilers in the share text — only the score pattern.
 */

"use client";

import { useState } from "react";
import { renderShareGrid, shareResult, shareText, type Cell } from "@/lib/share/client";
import { track } from "@/lib/analytics/client";

export default function ShareResult({
  title,
  subtitle,
  rows,
}: {
  title: string; // e.g. "Bible Trivia"
  subtitle?: string; // e.g. "2026-05-11"
  rows: Cell[][];
}) {
  const [status, setStatus] = useState<"idle" | "shared" | "copied" | "failed">("idle");

  async function onShare() {
    const dataUrl = renderShareGrid({ title, subtitle, rows });
    const text = shareText({ title, subtitle, rows });
    const result = await shareResult(text, dataUrl);
    setStatus(result);
    track("share_clicked", { result });
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onShare}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
      >
        Share result
      </button>
      {status === "copied" ? <p className="text-sm text-zinc-500">Copied to clipboard</p> : null}
      {status === "shared" ? <p className="text-sm text-zinc-500">Shared</p> : null}
      {status === "failed" ? <p className="text-sm text-red-600">Share failed</p> : null}
    </div>
  );
}
