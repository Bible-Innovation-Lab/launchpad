#!/usr/bin/env bun
/**
 * One-time script: fetch World English Bible (public domain) from getbible.net
 * and produce 66 per-book JSON files plus an alias index.
 *
 * Output: lib/bible/books/<slug>.json + lib/bible/books/index.json
 *
 * Run with: bun scripts/build-bible.ts
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

type GetBibleVerse = { chapter: number; verse: number; name: string; text: string };
type GetBibleChapter = { chapter: number; name: string; verses: GetBibleVerse[] };
type GetBibleBook = { nr: number; name: string; chapters: GetBibleChapter[] };

type OutVerse = { ref: string; book: string; chapter: number; verse: number; text: string };
type BookFile = { name: string; nr: number; verses: OutVerse[] };

type IndexEntry = { name: string; slug: string; nr: number; aliases: string[] };
type Index = { translation: string; books: IndexEntry[]; aliases: Record<string, string> };

const BOOK_ALIASES: Record<string, string[]> = {
  Genesis: ["Gen", "Ge", "Gn"],
  Exodus: ["Exod", "Exo", "Ex"],
  Leviticus: ["Lev", "Le", "Lv"],
  Numbers: ["Num", "Nu", "Nm", "Nb"],
  Deuteronomy: ["Deut", "Dt"],
  Joshua: ["Josh", "Jos", "Jsh"],
  Judges: ["Judg", "Jdg", "Jg", "Jdgs"],
  Ruth: ["Rth", "Ru"],
  "1 Samuel": ["1 Sam", "1Sam", "1Sa", "1S"],
  "2 Samuel": ["2 Sam", "2Sam", "2Sa", "2S"],
  "1 Kings": ["1 Kgs", "1Kgs", "1Ki", "1K"],
  "2 Kings": ["2 Kgs", "2Kgs", "2Ki", "2K"],
  "1 Chronicles": ["1 Chr", "1Chr", "1Ch"],
  "2 Chronicles": ["2 Chr", "2Chr", "2Ch"],
  Ezra: ["Ezr"],
  Nehemiah: ["Neh", "Ne"],
  Esther: ["Est", "Esth"],
  Job: ["Jb"],
  Psalms: ["Psalm", "Pss", "Ps", "Psa", "Psm", "Pslm"],
  Proverbs: ["Prov", "Pro", "Prv", "Pr"],
  Ecclesiastes: ["Eccl", "Ecc", "Ec", "Qoh"],
  "Song of Solomon": ["Song", "Songs", "Sng", "SOS", "Canticles", "Cant", "SS"],
  Isaiah: ["Isa", "Is"],
  Jeremiah: ["Jer", "Je", "Jr"],
  Lamentations: ["Lam", "La"],
  Ezekiel: ["Ezek", "Eze", "Ezk"],
  Daniel: ["Dan", "Da", "Dn"],
  Hosea: ["Hos", "Ho"],
  Joel: ["Jl", "Joe"],
  Amos: ["Am"],
  Obadiah: ["Obad", "Oba", "Ob"],
  Jonah: ["Jon", "Jnh"],
  Micah: ["Mic", "Mc"],
  Nahum: ["Nah", "Na"],
  Habakkuk: ["Hab", "Hb"],
  Zephaniah: ["Zeph", "Zep", "Zp"],
  Haggai: ["Hag", "Hg"],
  Zechariah: ["Zech", "Zec", "Zc"],
  Malachi: ["Mal", "Ml"],
  Matthew: ["Matt", "Mt"],
  Mark: ["Mrk", "Mk", "Mr"],
  Luke: ["Luk", "Lk"],
  John: ["Jn", "Jhn"],
  Acts: ["Act", "Ac"],
  Romans: ["Rom", "Ro", "Rm"],
  "1 Corinthians": ["1 Cor", "1Cor", "1Co"],
  "2 Corinthians": ["2 Cor", "2Cor", "2Co"],
  Galatians: ["Gal", "Ga"],
  Ephesians: ["Eph", "Ephes"],
  Philippians: ["Phil", "Php", "Pp"],
  Colossians: ["Col", "Co"],
  "1 Thessalonians": ["1 Thess", "1Thess", "1Th"],
  "2 Thessalonians": ["2 Thess", "2Thess", "2Th"],
  "1 Timothy": ["1 Tim", "1Tim", "1Ti"],
  "2 Timothy": ["2 Tim", "2Tim", "2Ti"],
  Titus: ["Tit", "Ti"],
  Philemon: ["Phlm", "Phm", "Pm"],
  Hebrews: ["Heb"],
  James: ["Jas", "Jm"],
  "1 Peter": ["1 Pet", "1Pet", "1Pe", "1P"],
  "2 Peter": ["2 Pet", "2Pet", "2Pe", "2P"],
  "1 John": ["1 Jn", "1Jn", "1Jhn", "1Jo", "1J"],
  "2 John": ["2 Jn", "2Jn", "2Jhn", "2Jo", "2J"],
  "3 John": ["3 Jn", "3Jn", "3Jhn", "3Jo", "3J"],
  Jude: ["Jud", "Jd"],
  Revelation: ["Rev", "Re", "Apocalypse", "Apoc"],
};

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

async function fetchBook(nr: number): Promise<GetBibleBook> {
  const res = await fetch(`https://api.getbible.net/v2/web/${nr}.json`);
  if (!res.ok) throw new Error(`getbible nr=${nr} returned ${res.status}`);
  return (await res.json()) as GetBibleBook;
}

async function main() {
  const outDir = join(import.meta.dir, "..", "lib", "bible", "books");
  await mkdir(outDir, { recursive: true });

  const index: Index = {
    translation: "World English Bible (WEB) — public domain, sourced from getbible.net",
    books: [],
    aliases: {},
  };

  for (let nr = 1; nr <= 66; nr++) {
    process.stdout.write(`\rFetching book ${nr}/66...`);
    const book = await fetchBook(nr);

    const verses: OutVerse[] = [];
    for (const ch of book.chapters) {
      for (const v of ch.verses) {
        verses.push({
          ref: `${book.name} ${v.chapter}:${v.verse}`,
          book: book.name,
          chapter: v.chapter,
          verse: v.verse,
          text: v.text,
        });
      }
    }

    const slug = slugify(book.name);
    const outFile: BookFile = { name: book.name, nr: book.nr, verses };
    await writeFile(join(outDir, `${slug}.json`), JSON.stringify(outFile));

    const aliases = BOOK_ALIASES[book.name] ?? [];
    index.books.push({ name: book.name, slug, nr: book.nr, aliases });
    // Map canonical name and all aliases (case-insensitive) to slug
    const allKeys = [book.name, slug, ...aliases];
    for (const key of allKeys) {
      index.aliases[key.toLowerCase()] = slug;
    }
  }

  await writeFile(join(outDir, "index.json"), JSON.stringify(index, null, 2));
  process.stdout.write(`\rFetched 66/66 books. Wrote ${outDir}/\n`);

  // Print summary
  let totalVerses = 0;
  let totalBytes = 0;
  for (const b of index.books) {
    const data = await Bun.file(join(outDir, `${b.slug}.json`)).text();
    totalBytes += data.length;
    totalVerses += (JSON.parse(data) as BookFile).verses.length;
  }
  console.log(`Total verses: ${totalVerses}`);
  console.log(`Total size on disk: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
