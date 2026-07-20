/**
 * YouVersion Platform API wrapper.
 *
 * Server-only. Holds YOUVERSION_API_KEY, calls
 * https://api.youversion.com/v1/bibles/{bibleId}/passages/{usfm}.
 * Auth via `X-YVP-App-Key` header.
 *
 * Default bible_id is 111 (NIV 2011). Override via `createYouVersionClient({ bibleId })`,
 * top-level helper options, or env `YOUVERSION_BIBLE_ID`.
 *
 * Two ways to use it:
 *   1) Top-level functions (read API key from process.env at first call):
 *        import { getVerse } from "@bil/launchpad/bible";
 *        const p = await getVerse("John 3:16");
 *
 *   2) Factory (inject fetch + key for tests / multi-key scenarios):
 *        const yv = createYouVersionClient({ apiKey, bibleId: 59, fetch });
 *        const p = await yv.getVerse("John 3:16");
 *
 * Returns Passage objects: { id, reference, content }.
 *
 * Also exports `buildBibleComUrl` for bible.com deep links.
 */

const YV_BASE = "https://api.youversion.com/v1";
/** NIV 2011 — platform default when no override is set. */
export const DEFAULT_BIBLE_ID = 111;

export interface Passage {
  /** USFM passage id, e.g. "JHN.3.16" or "JHN.3.16-21" */
  id: string;
  /** Human-readable reference, e.g. "John 3:16" or "John 3:16-21" */
  reference: string;
  /** Plain text content (we always request format=text) */
  content: string;
}

export interface YouVersionClientOptions {
  apiKey: string;
  /**
   * YouVersion bible id. Defaults to `DEFAULT_BIBLE_ID` (111 / NIV 2011).
   * Example: `59` for ESV.
   */
  bibleId?: number;
  /** Optional fetch override for tests. Defaults to globalThis.fetch. */
  fetch?: typeof fetch;
  /** Optional base URL override. Defaults to the production endpoint. */
  baseUrl?: string;
}

export type BuildBibleComUrlOptions = {
  /** bible.com version id. Defaults to `DEFAULT_BIBLE_ID` (111). */
  versionId?: number;
  /** Optional abbreviation suffix, e.g. `"NIV"` → `…/JHN.3.16.NIV`. */
  abbreviation?: string;
};

/**
 * Build a bible.com deep link for a USFM passage id.
 * Canonical form: `https://www.bible.com/bible/{versionId}/{usfm}`.
 */
export function buildBibleComUrl(
  usfmId: string,
  opts?: BuildBibleComUrlOptions,
): string {
  const versionId = opts?.versionId ?? DEFAULT_BIBLE_ID;
  const base = `https://www.bible.com/bible/${versionId}/${usfmId.trim()}`;
  if (opts?.abbreviation) {
    return `${base}.${opts.abbreviation}`;
  }
  return base;
}

function resolveBibleId(explicit?: number): number {
  if (typeof explicit === "number" && Number.isFinite(explicit)) {
    return explicit;
  }
  const fromEnv = process.env.YOUVERSION_BIBLE_ID?.trim();
  if (fromEnv) {
    const n = Number(fromEnv);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_BIBLE_ID;
}

export interface YouVersionClient {
  getVerse(ref: string): Promise<Passage>;
  getRange(ref: string): Promise<Passage>;
  getDailyVerse(date: Date): Promise<Passage>;
}

export class YouVersionError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "YouVersionError";
    this.status = status;
  }
}

export class BibleRefError extends Error {
  readonly ref: string;
  constructor(ref: string, message?: string) {
    super(message ?? `Unrecognized Bible reference: ${ref}`);
    this.name = "BibleRefError";
    this.ref = ref;
  }
}

// ---------------------------------------------------------------------------
// USFM book table — 66 protestant-canon books. Display name → USFM id.
// Notable non-obvious mappings: Mark=MRK (not MAR), Philippians=PHP (not PHI),
// Joshua=JOS, Ezekiel=EZK, Song of Solomon=SNG, Psalms=PSA.

const USFM_BOOKS: Record<string, string> = {
  // Old Testament
  Genesis: "GEN", Exodus: "EXO", Leviticus: "LEV", Numbers: "NUM",
  Deuteronomy: "DEU", Joshua: "JOS", Judges: "JDG", Ruth: "RUT",
  "1 Samuel": "1SA", "2 Samuel": "2SA", "1 Kings": "1KI", "2 Kings": "2KI",
  "1 Chronicles": "1CH", "2 Chronicles": "2CH",
  Ezra: "EZR", Nehemiah: "NEH", Esther: "EST", Job: "JOB",
  Psalms: "PSA", Proverbs: "PRO", Ecclesiastes: "ECC", "Song of Solomon": "SNG",
  Isaiah: "ISA", Jeremiah: "JER", Lamentations: "LAM", Ezekiel: "EZK",
  Daniel: "DAN", Hosea: "HOS", Joel: "JOL", Amos: "AMO",
  Obadiah: "OBA", Jonah: "JON", Micah: "MIC", Nahum: "NAM",
  Habakkuk: "HAB", Zephaniah: "ZEP", Haggai: "HAG", Zechariah: "ZEC",
  Malachi: "MAL",
  // New Testament
  Matthew: "MAT", Mark: "MRK", Luke: "LUK", John: "JHN",
  Acts: "ACT", Romans: "ROM", "1 Corinthians": "1CO", "2 Corinthians": "2CO",
  Galatians: "GAL", Ephesians: "EPH", Philippians: "PHP", Colossians: "COL",
  "1 Thessalonians": "1TH", "2 Thessalonians": "2TH",
  "1 Timothy": "1TI", "2 Timothy": "2TI",
  Titus: "TIT", Philemon: "PHM", Hebrews: "HEB", James: "JAS",
  "1 Peter": "1PE", "2 Peter": "2PE",
  "1 John": "1JN", "2 John": "2JN", "3 John": "3JN",
  Jude: "JUD", Revelation: "REV",
};

// ---------------------------------------------------------------------------
// Reference parsing.
//
// Accepts:
//   "John 3:16"      → "JHN.3.16"
//   "John 3:16-21"   → "JHN.3.16-21"
//   "John 3"         → "JHN.3"     (whole chapter)
//   "1 Corinthians 13:4-7" → "1CO.13.4-7"
//   "JHN.3.16" / "GEN.1" / "MAT.21.12-17" → passed through (already USFM)
//
// Throws BibleRefError on unrecognized book or malformed shape.

const REF_RE =
  /^\s*((?:[1-3]\s+)?[A-Za-z][A-Za-z\s]*?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?\s*$/;

/** YouVersion USFM passage id: GEN.1 | JHN.3.16 | MAT.21.12-17 | 1SA.17 */
const USFM_ID_RE =
  /^\s*([1-3]?[A-Za-z]{2,3})\.(\d+)(?:\.(\d+)(?:-(\d+))?)?\s*$/;

// Case-insensitive lookup: build once, key by lowercase book name.
const USFM_LOOKUP: Record<string, string> = Object.fromEntries(
  Object.entries(USFM_BOOKS).map(([name, id]) => [name.toLowerCase(), id])
);

const USFM_BOOK_IDS = new Set(Object.values(USFM_BOOKS));

export function refToUsfm(ref: string): string {
  const usfmMatch = USFM_ID_RE.exec(ref);
  if (usfmMatch) {
    const [, bookRaw, chapterStr, verseStartStr, verseEndStr] = usfmMatch;
    const book = bookRaw.toUpperCase();
    if (!USFM_BOOK_IDS.has(book)) {
      throw new BibleRefError(ref, `Unknown USFM book: ${bookRaw}`);
    }
    let usfm = `${book}.${chapterStr}`;
    if (verseStartStr) {
      usfm += `.${verseStartStr}`;
      if (verseEndStr) usfm += `-${verseEndStr}`;
    }
    return usfm;
  }

  const m = REF_RE.exec(ref);
  if (!m) throw new BibleRefError(ref);
  const [, rawBook, chapterStr, verseStartStr, verseEndStr] = m;

  const lookupKey = rawBook.replace(/\s+/g, " ").trim().toLowerCase();
  const usfmBook = USFM_LOOKUP[lookupKey];
  if (!usfmBook) throw new BibleRefError(ref, `Unknown book: ${rawBook}`);

  let usfm = `${usfmBook}.${chapterStr}`;
  if (verseStartStr) {
    usfm += `.${verseStartStr}`;
    if (verseEndStr) usfm += `-${verseEndStr}`;
  }
  return usfm;
}

// ---------------------------------------------------------------------------
// Factory: create a client with explicit options. Used by tests + by the
// top-level facade below.

export function createYouVersionClient(opts: YouVersionClientOptions): YouVersionClient {
  const apiKey = opts.apiKey;
  if (!apiKey) {
    throw new Error("createYouVersionClient: apiKey is required");
  }
  const bibleId = resolveBibleId(opts.bibleId);
  const doFetch = opts.fetch ?? globalThis.fetch;
  const baseUrl = opts.baseUrl ?? YV_BASE;

  async function fetchPassage(usfm: string): Promise<Passage> {
    const url = `${baseUrl}/bibles/${bibleId}/passages/${encodeURIComponent(usfm)}?format=text`;
    const res = await doFetch(url, { headers: { "X-YVP-App-Key": apiKey } });
    if (!res.ok) {
      throw new YouVersionError(res.status, `YouVersion ${res.status} for ${usfm}`);
    }
    const json = (await res.json()) as Partial<Passage>;
    if (!json.id || !json.content || !json.reference) {
      // YouVersion returns `{id:null, content:""}` for unsupported requests
      // (e.g. whole-book passage). Surface as a clearly-shaped error rather
      // than letting empty content propagate.
      throw new YouVersionError(404, `YouVersion returned empty passage for ${usfm}`);
    }
    return { id: json.id, reference: json.reference, content: json.content };
  }

  async function getVerse(ref: string): Promise<Passage> {
    return fetchPassage(refToUsfm(ref));
  }

  async function getRange(ref: string): Promise<Passage> {
    return fetchPassage(refToUsfm(ref));
  }

  async function getDailyVerse(date: Date): Promise<Passage> {
    const day = dayOfYearUTC(date);
    const vodUrl = `${baseUrl}/verse_of_the_days/${day}`;
    const vodRes = await doFetch(vodUrl, { headers: { "X-YVP-App-Key": apiKey } });
    if (!vodRes.ok) {
      throw new YouVersionError(
        vodRes.status,
        `YouVersion verse-of-day ${vodRes.status} for day ${day}`
      );
    }
    const vod = (await vodRes.json()) as { day?: number; passage_id?: string };
    if (!vod.passage_id) {
      throw new YouVersionError(502, `YouVersion verse-of-day returned no passage_id for day ${day}`);
    }
    return fetchPassage(vod.passage_id);
  }

  return { getVerse, getRange, getDailyVerse };
}

function dayOfYearUTC(date: Date): number {
  // 1 = January 1, 366 = December 31 in a leap year.
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const diff = date.getTime() - start;
  return Math.floor(diff / 86_400_000);
}

// ---------------------------------------------------------------------------
// Top-level facade (lazy singleton from process.env). Convenient default;
// use createYouVersionClient(...) for tests / DI.

let _singleton: YouVersionClient | null = null;
let _singletonKey: string | null = null;

function getDefaultClient(bibleId?: number): YouVersionClient {
  const apiKey = process.env.YOUVERSION_API_KEY;
  if (!apiKey) {
    throw new Error(
      "YOUVERSION_API_KEY env var is not set. " +
      "It should be injected by bil-provisioning at /provision time."
    );
  }
  const resolved = resolveBibleId(bibleId);
  // Explicit per-call override — do not clobber the default singleton.
  if (bibleId !== undefined) {
    return createYouVersionClient({ apiKey, bibleId: resolved });
  }
  const key = String(resolved);
  if (_singleton && _singletonKey === key) return _singleton;
  _singleton = createYouVersionClient({ apiKey, bibleId: resolved });
  _singletonKey = key;
  return _singleton;
}

export async function getVerse(ref: string, opts?: { bibleId?: number }): Promise<Passage> {
  return getDefaultClient(opts?.bibleId).getVerse(ref);
}
export async function getRange(ref: string, opts?: { bibleId?: number }): Promise<Passage> {
  return getDefaultClient(opts?.bibleId).getRange(ref);
}
export async function getDailyVerse(date: Date, opts?: { bibleId?: number }): Promise<Passage> {
  return getDefaultClient(opts?.bibleId).getDailyVerse(date);
}
