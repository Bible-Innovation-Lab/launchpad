/**
 * Example: render the day's verse using @bil/launchpad/bible.
 *
 * Copy this into your app/page.tsx (or wherever) as a starting point.
 * Server component — `getDailyVerse` runs at request time, no client JS needed.
 */

import { getDailyVerse } from "@bil/launchpad/bible";

export default async function VerseOfDay() {
  const passage = await getDailyVerse(new Date());
  return (
    <section className="mx-auto max-w-xl px-6 py-12">
      <p className="text-sm uppercase tracking-wide text-zinc-500">Today's verse</p>
      <blockquote className="mt-3 text-lg leading-relaxed text-zinc-900">
        {passage.content}
      </blockquote>
      <p className="mt-3 text-sm text-zinc-500">— {passage.reference}</p>
    </section>
  );
}
