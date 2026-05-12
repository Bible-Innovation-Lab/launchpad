/**
 * @bil/share — client-canvas share image.
 *
 * Renders a Wordle-style colored grid PNG on the user's device. No server
 * cost. Works offline. Use this for "share your result" buttons.
 *
 * For Twitter/Facebook scrapers (which need a URL they can fetch), use
 * `@/lib/share/server` instead — those get aggressively cached at the edge.
 */

export type Cell = "correct" | "incorrect" | "empty";

export type GridShareOpts = {
  rows: Cell[][]; // 2D array of cells; one row per guess
  title?: string; // e.g. "Bible Trivia"
  subtitle?: string; // e.g. "2026-05-11  3/5"
  width?: number; // px; default 600
};

const COLORS: Record<Cell, string> = {
  correct: "#10b981", // emerald-500
  incorrect: "#6b7280", // zinc-500
  empty: "#e5e7eb", // zinc-200
};

/**
 * Render the share grid to a data URL. Use as <img src={dataUrl} />.
 * Returns null in non-browser environments.
 */
export function renderShareGrid(opts: GridShareOpts): string | null {
  if (typeof document === "undefined") return null;
  const width = opts.width ?? 600;
  const rowCount = opts.rows.length;
  const colCount = Math.max(1, ...opts.rows.map((r) => r.length));
  const padding = 40;
  const cellGap = 8;
  const headerHeight = (opts.title ? 40 : 0) + (opts.subtitle ? 28 : 0) + (opts.title || opts.subtitle ? 24 : 0);
  const cellSize = Math.floor((width - 2 * padding - (colCount - 1) * cellGap) / colCount);
  const gridHeight = rowCount * cellSize + (rowCount - 1) * cellGap;
  const height = headerHeight + gridHeight + 2 * padding;

  const canvas = document.createElement("canvas");
  // 2× for retina
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Header
  let y = padding;
  if (opts.title) {
    ctx.fillStyle = "#18181b";
    ctx.font = "600 28px ui-sans-serif, system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(opts.title, width / 2, y + 24);
    y += 40;
  }
  if (opts.subtitle) {
    ctx.fillStyle = "#71717a";
    ctx.font = "400 16px ui-sans-serif, system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(opts.subtitle, width / 2, y + 18);
    y += 28;
  }
  if (opts.title || opts.subtitle) y += 24;

  // Grid
  for (let r = 0; r < rowCount; r++) {
    const row = opts.rows[r];
    for (let c = 0; c < colCount; c++) {
      const cell = row[c] ?? "empty";
      const x = padding + c * (cellSize + cellGap);
      const cy = y + r * (cellSize + cellGap);
      ctx.fillStyle = COLORS[cell];
      // rounded corners
      roundRect(ctx, x, cy, cellSize, cellSize, 8);
    }
  }
  return canvas.toDataURL("image/png");
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

/**
 * Generate the plain-text share string. NO spoilers — only the score
 * pattern, not the quote or answer.
 *
 * @example
 *   shareText({ title: "Bible Trivia", subtitle: "2026-05-11", rows })
 *   // → "Bible Trivia 2026-05-11  3/5  ⬛⬛🟩⬜⬜"
 */
export function shareText(opts: {
  title: string;
  subtitle?: string;
  rows: Cell[][];
}): string {
  const pattern = opts.rows
    .map((row) => row.map((c) => (c === "correct" ? "🟩" : c === "incorrect" ? "⬛" : "⬜")).join(""))
    .join("\n");
  const head = opts.subtitle ? `${opts.title} ${opts.subtitle}` : opts.title;
  return `${head}\n${pattern}`;
}

/**
 * Trigger the native share sheet (mobile) or fall back to clipboard.
 * Pass the data URL from renderShareGrid for the image; the text is the
 * spoiler-free share string from shareText.
 */
export async function shareResult(text: string, dataUrl?: string | null): Promise<"shared" | "copied" | "failed"> {
  // Try native share sheet first (mobile).
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      if (dataUrl) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], "result.png", { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ text, files: [file] });
          return "shared";
        }
      }
      await navigator.share({ text });
      return "shared";
    } catch {
      // fall through to clipboard
    }
  }
  // Fallback: copy text to clipboard.
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return "copied";
    } catch {
      return "failed";
    }
  }
  return "failed";
}
