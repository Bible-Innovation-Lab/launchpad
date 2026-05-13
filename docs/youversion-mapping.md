# YouVersion Platform API → `lib/bible/` mapping

Status: RESOLVED — all gaps closed by Scott on 2026-05-13. Ready to implement
the wrapper after the throwaway-template-app verification gate clears.

Generated 2026-05-13 as the design doc's primary assignment.

## Decisions locked

- **Bible:** `bible_id = 111` (NIV 2011). Greenfield migration; no concern
  about switching from current WEB JSON. NIV is licensed-text — students
  call it through the API, they don't extract or redistribute.
- **Auth (server → YouVersion):** `X-YVP-App-Key: <key>` header.
  Confirmed via probe 2026-05-13. Server-side shared key. `YOUVERSION_API_KEY`
  env var in each student's Vercel project, injected by bil-provisioning.
- **Auth (client → student's own API):** none. `/api/v1/bible/...` is open
  by design, same as today's `/api/track` flow. Bible text is publicly
  available; YouVersion has no rate limits; there's nothing to gate.
- **Rate limits:** none enforced; YV Platform can scale.
- **Pricing:** free.
- **Response shape:** `{ id, content, reference }` — plain text content
  when `format=text`. Reference is human-readable ("John 3:16"); id is the
  USFM passage id ("JHN.3.16").

## API surface (v0.1.0, post-probe)

- `getVerse(ref)` — single verse, 1 call
- `getRange(ref)` — verse range, 1 call. Returns ONE concatenated `Passage`
  (`{id, reference, content}`) not `Verse[]`. YouVersion only returns passages
  as a single text block; per-verse decomposition isn't a thing they
  support cleanly. Callers needing per-verse breakdown can loop `getVerse`.
- `getDailyVerse(date)` — daily verse, 2 calls (no caching).

**Dropped (post-probe 2026-05-13):**
- `getBook` — YouVersion returns `{id: null, content: ""}` for whole-book
  passage requests. Would require chapter-fanout (Genesis = 50 round-trips).
  Zero external callers in bible-trivia or launchpad app code (only
  consumer was internal `searchText`, already dropped). Add later via
  chapter-fanout if needed.
- `getRandomVerse` — no YouVersion endpoint; not worth client-side impl.
- `searchText` — no YouVersion endpoint.

## What the docs cover

**Single endpoint shape** for all passage retrieval — `GET /v1/bibles/{bible_id}/passages/{passage_id}`:
- `passage_id` uses USFM identifiers: `JHN.3.16` (single verse), `JHN.3.16-21` (range), `JHN.3` (chapter), `JHN` (book)
- Query params: `format=text|html`, `include_headings`, `include_notes`
- One URL pattern covers verse / range / chapter / book

**Verse of the day**: `GET /v1/verse_of_the_days/{day}` where `day` is 1-366.
- Returns `{ "day": 1, "passage_id": "JHN.3.16" }` — reference only, NOT text
- To get the daily verse with text, you need TWO calls: verse-of-day → then passages
- `GET /v1/verse_of_the_days` returns the full year mapping (cacheable; refreshes annually)

**Structural endpoints** (useful for `getBook` + random-verse impl):
- `GET /v1/bibles` — list translations
- `GET /v1/bibles/{bible_id}/index` — full book/chapter/verse counts
- `GET /v1/bibles/{bible_id}/books` — list books
- `GET /v1/bibles/{bible_id}/books/{book_id}/chapters` — chapters in a book

## Mapping (post-probe)

| v0.1.0 function | YouVersion call | Notes |
|---|---|---|
| `getVerse(ref)` | `GET /v1/bibles/111/passages/{usfm}?format=text` | Need ref-string→USFM converter ("John 3:16" → "JHN.3.16"). |
| `getRange(ref)` | `GET /v1/bibles/111/passages/{usfm_with_range}?format=text` | Same endpoint with `JHN.3.16-17` shape. Returns one concatenated `Passage`. |
| `getDailyVerse(date)` | TWO calls: `GET /v1/verse_of_the_days/{day}` → `GET /v1/bibles/111/passages/{passage_id}?format=text` | No caching. ~150ms per call locally. |
| ~~`getBook`~~ | DROPPED — `JHN` returns `{id:null, content:""}`. | Add later via chapter-fanout if needed. |
| ~~`getRandomVerse`~~ | DROPPED | Add later if needed. |
| ~~`searchText`~~ | DROPPED | Add later if needed. |

## Day-of-year mapping for `getDailyVerse`

The current `getDailyVerse(date: Date)` is deterministic per UTC date. YouVersion's `/v1/verse_of_the_days/{day}` is day-of-year (1-366), which lossily collapses across years (Jan 1 in 2026 = Jan 1 in 2027, both day=1). This matches the current `getDailyVerse` semantic (deterministic-per-date, same verse globally on a given calendar day).

Edge cases:
- Leap years: YouVersion returns 1-366 in leap years, 1-365 otherwise. Confirm what the API returns for "day 366" in non-leap years (likely just 404 or wraps).
- Timezones: YouVersion docs don't specify. Pin to UTC in the wrapper so the daily verse is globally consistent (matches current behavior).

## Client authentication

**None.** Same model as today's `/api/track` PostHog forwarder: route is open,
accepts requests from any origin, with no header check. Justification:

- `/api/v1/track` is write-only; abuse adds noise to PostHog event counts
  (filterable by `app_id`) but cannot exfiltrate data.
- `/api/v1/bible/...` returns publicly-available Bible text. There's a
  hundred ways to get Bible text on the internet without going through us.
- YouVersion has no rate limits and explicitly OK'd viral apps. There's no
  cost to BIL from anonymous load.

Add an origin-or-key middleware later **only when** an endpoint genuinely
needs it (auth-token issuance, push registration, anything user-identity-tied
or that does meaningful compute server-side). Premature gating taxes every
student route handler without buying anything.

## Pre-implementation prototype

Before writing the wrapper, build a 30-line script that confirms the auth
header shape from YouVersion and validates the URL pattern works end-to-end:

```ts
// scripts/youversion-probe.ts
const KEY = process.env.YOUVERSION_API_KEY!;
const URL = "https://api.youversion.com/v1/bibles/111/passages/JHN.3.16?format=text";

// Try common header shapes; first one that returns 200 is the auth model.
for (const header of [
  { "X-Token": KEY },
  { "Authorization": `Bearer ${KEY}` },
  { "X-Api-Key": KEY },
  { "X-App-Id": KEY },
]) {
  const res = await fetch(URL, { headers: header });
  console.log(JSON.stringify(header), res.status);
  if (res.ok) {
    console.log(await res.json());
    break;
  }
}
```

Run once. The header that returns 200 is the answer. Lock it into the wrapper.

## Implementation sketch — `@bil/launchpad/bible/server.ts`

```ts
const YV_BASE = "https://api.youversion.com/v1";
const BIBLE_ID = "111";  // NIV 2011, locked
const API_KEY = process.env.YOUVERSION_API_KEY!;

const AUTH = { "X-YVP-App-Key": API_KEY };  // header shape confirmed 2026-05-13

export interface Passage {
  id: string;         // USFM: "JHN.3.16" or range "JHN.3.16-17"
  content: string;    // plain text (we pass format=text)
  reference: string;  // human-readable: "John 3:16"
}

// USFM book table (66 entries; ~600 bytes; const-bundled, not fetched)
const USFM_BOOKS: Record<string, string> = {
  "Genesis": "GEN", "Exodus": "EXO", /* ... */ "John": "JHN", /* ... */ "Revelation": "REV"
};

function refToUsfm(ref: string): string {
  // "John 3:16"      → "JHN.3.16"
  // "John 3:16-21"   → "JHN.3.16-21"
  // "John 3"         → "JHN.3"
}

async function fetchPassage(usfm: string): Promise<Passage> {
  const url = `${YV_BASE}/bibles/${BIBLE_ID}/passages/${usfm}?format=text`;
  const res = await fetch(url, { headers: AUTH });
  if (!res.ok) throw new BibleApiError(`YouVersion ${res.status} for ${usfm}`);
  return await res.json();  // { id, content, reference }
}

export async function getVerse(ref: string)   { return fetchPassage(refToUsfm(ref)); }
export async function getRange(ref: string)   { return fetchPassage(refToUsfm(ref)); }

export async function getDailyVerse(date: Date): Promise<Passage> {
  const day = dayOfYearUTC(date);
  const vodRes = await fetch(`${YV_BASE}/verse_of_the_days/${day}`, { headers: AUTH });
  if (!vodRes.ok) throw new BibleApiError(`YouVersion vod ${vodRes.status} for day ${day}`);
  const vod = await vodRes.json();  // { day, passage_id }
  return fetchPassage(vod.passage_id);
}

// getBook, getRandomVerse, searchText — not in v0.1.0. Add later if needed.
```

Total: ~50 lines of TS plus the USFM book table. Same-day job.

## Recommended next actions

1. **Get a YouVersion API key** for the bil-provisioning admin team's env
   (the actual secret). Inject as `YOUVERSION_API_KEY` via bil-provisioning
   per the design doc's bil-provisioning extension section.

2. **Run the probe script** (above) to lock the auth header shape. ~5 minutes.

3. **Add `BIL_CLIENT_KEY` generation to bil-provisioning** — random per-project,
   set during `/provision` alongside `APP_ID` / `POSTHOG_KEY` / `YOUVERSION_API_KEY`.

4. **Write the wrapper** with the auth shape from step 2. ~70 lines + tests.
5. **Validate against bible-trivia** (the canary migration in the design doc).
