/**
 * Client-side device fingerprint for anonymous identity recovery.
 *
 * Produces a stable SHA-256 hex hash of device traits visible to the
 * browser (screen, GPU, canvas rendering, timezone, locale, hardware).
 * Sent with every /api/analytics beacon; the server combines it with the
 * client IP to derive a deterministic anon-id when no `_lp_aid` cookie
 * exists. Same device + same network → same id, so users who lose their
 * cookie (webviews, domain moves, cleared storage) reconnect to their
 * history instead of appearing as new users.
 *
 * Known limit: identical device models on the same OS version (e.g. two
 * iPhone 15s on the same wifi) can produce the same fingerprint. The
 * cookie remains the primary identity carrier; the fingerprint is only
 * consulted at mint time.
 */

let cached: Promise<string> | null = null;

/** Memoized: computed once per page load (~1-2 ms after first call). */
export function deviceFingerprint(): Promise<string> {
  if (!cached) cached = compute().catch(() => "");
  return cached;
}

async function compute(): Promise<string> {
  const parts: Array<string | number> = [];
  try {
    parts.push(
      screen.width,
      screen.height,
      screen.colorDepth,
      window.devicePixelRatio ?? 1,
      Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
      (navigator.languages ?? [navigator.language]).join(","),
      navigator.hardwareConcurrency ?? 0,
      (navigator as { deviceMemory?: number }).deviceMemory ?? 0,
      navigator.platform ?? "",
      navigator.maxTouchPoints ?? 0,
    );
  } catch {
    parts.push("base-na");
  }
  parts.push(webglInfo(), canvasFingerprint());
  return sha256Hex(parts.join("|"));
}

/** GPU vendor/renderer — strong differentiator between machine models. */
function webglInfo(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") ??
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) return "webgl-na";
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    if (dbg) {
      return `${gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)}~${gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)}`;
    }
    return `${gl.getParameter(gl.VENDOR)}~${gl.getParameter(gl.RENDERER)}`;
  } catch {
    return "webgl-err";
  }
}

/** Canvas rendering varies with GPU/driver/font stack. */
function canvasFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "canvas-na";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f60";
    ctx.fillRect(100, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.font = "11pt no-real-font-123, sans-serif";
    ctx.fillText("BIL fingerprint \u{1F54A}\uFE0F \u00E9\u00DF", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.font = "18pt Arial";
    ctx.fillText("BIL fingerprint \u{1F54A}\uFE0F \u00E9\u00DF", 4, 45);
    return canvas.toDataURL();
  } catch {
    return "canvas-err";
  }
}

async function sha256Hex(input: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Insecure-context fallback (e.g. plain-http LAN dev): FNV-1a, doubled
  // over the reversed string for a few more bits. Weaker but stable.
  return `${fnv1a(input)}${fnv1a([...input].reverse().join(""))}`;
}

function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
