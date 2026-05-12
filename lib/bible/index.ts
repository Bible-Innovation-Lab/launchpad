/**
 * @bil/bible — World English Bible lookup, public domain.
 *
 * Server-side primarily. Verses are stored in 66 per-book JSON files
 * (lib/bible/books/<slug>.json) and lazy-loaded on first reference so
 * cold-start cost on a serverless function is bounded to one book per
 * request, not the whole Bible.
 *
 * @example
 *   import { getVerse } from "@/lib/bible";
 *   const v = getVerse("John 3:16");
 *   console.log(v.text);
 */

import index from "./books/index.json" with { type: "json" };

export type Verse = {
  ref: string; // e.g. "John 3:16"
  book: string; // canonical: "John"
  chapter: number;
  verse: number;
  text: string;
};

export type VerseFilter = {
  book?: string; // restrict to a single book (canonical name OR alias)
  hasSpeaker?: boolean; // reserved for future enrichment, no-op today
};

export type SearchOpts = {
  limit?: number; // default 20
  book?: string; // restrict to a single book
};

type BookFile = { name: string; nr: number; verses: Verse[] };
type Index = {
  translation: string;
  books: { name: string; slug: string; nr: number; aliases: string[] }[];
  aliases: Record<string, string>; // lowercase key -> slug
};

const INDEX = index as Index;

// In-process cache. Each book is loaded at most once per serverless instance.
const bookCache = new Map<string, BookFile>();

async function loadBook(slug: string): Promise<BookFile> {
  const cached = bookCache.get(slug);
  if (cached) return cached;
  // Dynamic import so bundlers only pull in books actually referenced.
  const mod = await import(`./books/${slug}.json`, { with: { type: "json" } });
  const book = mod.default as BookFile;
  // Light normalization: trim stray whitespace on verse text.
  for (const v of book.verses) v.text = v.text.trim();
  bookCache.set(slug, book);
  return book;
}

// ---------------------------------------------------------------------------
// Errors

export class BibleRefError extends Error {
  readonly ref: string;
  readonly didYouMean?: string;
  constructor(ref: string, opts?: { didYouMean?: string }) {
    const suffix = opts?.didYouMean ? ` — did you mean "${opts.didYouMean}"?` : "";
    super(`Invalid Bible reference: "${ref}"${suffix}`);
    this.name = "BibleRefError";
    this.ref = ref;
    this.didYouMean = opts?.didYouMean;
  }
}

// ---------------------------------------------------------------------------
// Reference parsing

type ParsedRef = {
  bookSlug: string;
  bookName: string;
  chapter: number;
  verseStart: number;
  verseEnd: number; // == verseStart for single-verse refs
};

// Matches: "John 3:16", "John 3:16-18", "1 John 1:1", "Psalm 23:1"
const REF_RE = /^\s*([1-3]?\s*[A-Za-z][A-Za-z\s]*?)\s+(\d+)\s*:\s*(\d+)(?:\s*-\s*(\d+))?\s*$/;

function findClosestBook(input: string): string | undefined {
  const target = input.toLowerCase().trim();
  let best: { slug: string; distance: number } | undefined;
  for (const key of Object.keys(INDEX.aliases)) {
    const d = levenshtein(target, key);
    if (!best || d < best.distance) best = { slug: INDEX.aliases[key], distance: d };
  }
  return best && best.distance <= 3 ? best.slug : undefined;
}

function parseRef(ref: string): ParsedRef {
  const match = ref.match(REF_RE);
  if (!match) {
    throw new BibleRefError(ref);
  }
  const [, rawBook, chapterStr, verseStartStr, verseEndStr] = match;
  const bookKey = rawBook.replace(/\s+/g, " ").trim().toLowerCase();
  const slug = INDEX.aliases[bookKey];
  if (!slug) {
    // Try fuzzy: produce a did-you-mean suggestion.
    const closestSlug = findClosestBook(bookKey);
    const closest = INDEX.books.find((b) => b.slug === closestSlug);
    const suggestion = closest
      ? `${closest.name} ${chapterStr}:${verseStartStr}${verseEndStr ? `-${verseEndStr}` : ""}`
      : undefined;
    throw new BibleRefError(ref, { didYouMean: suggestion });
  }
  const bookInfo = INDEX.books.find((b) => b.slug === slug)!;
  const chapter = parseInt(chapterStr, 10);
  const verseStart = parseInt(verseStartStr, 10);
  const verseEnd = verseEndStr ? parseInt(verseEndStr, 10) : verseStart;
  return { bookSlug: slug, bookName: bookInfo.name, chapter, verseStart, verseEnd };
}

// ---------------------------------------------------------------------------
// Public API

/**
 * Look up a single verse by reference. Throws BibleRefError on miss
 * (with did_you_mean suggestion when possible).
 *
 * @example getVerse("John 3:16")
 */
export async function getVerse(ref: string): Promise<Verse> {
  const parsed = parseRef(ref);
  const book = await loadBook(parsed.bookSlug);
  const verse = book.verses.find(
    (v) => v.chapter === parsed.chapter && v.verse === parsed.verseStart,
  );
  if (!verse) {
    throw new BibleRefError(ref, {
      didYouMean: `${parsed.bookName} ${parsed.chapter}:${parsed.verseStart} not found — check chapter/verse bounds.`,
    });
  }
  return verse;
}

/**
 * Look up a contiguous verse range like "John 3:16-18".
 *
 * @example getRange("Psalm 23:1-6")
 */
export async function getRange(ref: string): Promise<Verse[]> {
  const parsed = parseRef(ref);
  const book = await loadBook(parsed.bookSlug);
  const result = book.verses.filter(
    (v) =>
      v.chapter === parsed.chapter && v.verse >= parsed.verseStart && v.verse <= parsed.verseEnd,
  );
  if (result.length === 0) throw new BibleRefError(ref);
  return result;
}

/**
 * Return every verse in a book.
 *
 * @example getBook("Genesis")
 */
export async function getBook(name: string): Promise<Verse[]> {
  const slug = INDEX.aliases[name.toLowerCase().trim()];
  if (!slug) throw new BibleRefError(name, { didYouMean: findClosestBook(name) });
  const book = await loadBook(slug);
  return book.verses;
}

/**
 * Pick a deterministic verse for a given UTC date. Same date → same verse.
 * Returns a Verse from the entire Bible by default; filter by book if given.
 *
 * @example getDailyVerse(new Date(), { book: "Psalms" })
 */
export async function getDailyVerse(date: Date, filter?: VerseFilter): Promise<Verse> {
  // Use UTC date components to be tz-stable across the world.
  const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const dayOrdinal = Math.floor(utc / 86400000);
  return pickVerse(dayOrdinal, filter);
}

/**
 * Non-deterministic random verse. Server-side only.
 *
 * @example getRandomVerse({ book: "Proverbs" })
 */
export async function getRandomVerse(filter?: VerseFilter): Promise<Verse> {
  const seed = Math.floor(Math.random() * 2 ** 31);
  return pickVerse(seed, filter);
}

async function pickVerse(seed: number, filter?: VerseFilter): Promise<Verse> {
  if (filter?.book) {
    const verses = await getBook(filter.book);
    return verses[seed % verses.length];
  }
  // Pick a book by seed, then a verse within it. Two-step keeps us from
  // having to load all 66 books just to pick one verse.
  const bookEntry = INDEX.books[seed % INDEX.books.length];
  const book = await loadBook(bookEntry.slug);
  return book.verses[seed % book.verses.length];
}

/**
 * Substring search across the whole Bible (or a single book).
 * Not indexed; expect 50-200ms latency on a cold function. Returns up to
 * `limit` matches (default 20).
 *
 * @example searchText("love", { book: "1 Corinthians", limit: 5 })
 */
export async function searchText(query: string, opts?: SearchOpts): Promise<Verse[]> {
  const limit = opts?.limit ?? 20;
  const needle = query.toLowerCase();
  const out: Verse[] = [];
  const books = opts?.book
    ? [INDEX.books.find((b) => b.slug === INDEX.aliases[opts.book!.toLowerCase()])!]
    : INDEX.books;
  for (const meta of books) {
    if (!meta) continue;
    const book = await loadBook(meta.slug);
    for (const v of book.verses) {
      if (v.text.toLowerCase().includes(needle)) {
        out.push(v);
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Helpers

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  const curr = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return curr[b.length];
}

// Export a list of canonical book names for autocomplete / docs use cases.
export const BOOKS = INDEX.books.map((b) => ({ name: b.name, nr: b.nr }));
