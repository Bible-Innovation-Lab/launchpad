/**
 * GET /api/v1/bible/[ref] — Bible passage lookup endpoint.
 *
 * Pre-made App Router handler. Student template's
 * `app/api/v1/bible/[ref]/route.ts` re-exports `GET` from this file.
 *
 * Returns the Passage JSON from the underlying YouVersion call.
 * The `[ref]` URL segment is a reference like "John 3:16" or "John 3:16-21"
 * (URL-encoded). Mobile and client components hit this same endpoint;
 * the API key never leaves the server.
 *
 * Open by design — no auth gating on this read endpoint. Bible text is
 * publicly available; YouVersion has no rate limits. Same posture as
 * /api/v1/track.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getVerse, BibleRefError, YouVersionError } from "../bible/server";

interface Ctx {
  params: Promise<{ ref: string }>;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { ref: rawRef } = await ctx.params;
  const ref = decodeURIComponent(rawRef);

  try {
    const passage = await getVerse(ref);
    return NextResponse.json(passage, {
      headers: {
        // YouVersion responses are stable for the same ref; cache for 24h
        // at the edge, revalidate-while-stale for another hour.
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    if (err instanceof BibleRefError) {
      return NextResponse.json(
        { error: "invalid_reference", ref, message: err.message },
        { status: 400 }
      );
    }
    if (err instanceof YouVersionError) {
      // Map upstream errors. 401/403 from YouVersion ⇒ 502 (we have a
      // server-side config problem, not a client problem). 404 ⇒ 404.
      const status = err.status === 404 ? 404 : 502;
      return NextResponse.json(
        { error: "bible_unavailable", ref, message: err.message },
        { status }
      );
    }
    // Unknown error — log and return 500.
    console.error("[bible/route] unexpected error:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
