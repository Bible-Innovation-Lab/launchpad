import { getDailyVerse } from "@/lib/bible";

// Daily verse changes at UTC midnight; cache 5 minutes is fine.
export const revalidate = 300;

export default async function Home() {
  const verse = await getDailyVerse(new Date());

  return (
    <main className="min-h-screen bg-white px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-5 py-3 text-sm text-zinc-600">
          You&rsquo;re looking at the BIL Launchpad starter. Replace{" "}
          <code className="rounded bg-white px-1 py-0.5 font-mono text-xs">app/page.tsx</code> with
          your product. The verse below proves <code>@bil/bible</code> works.
        </div>

        <section className="mt-12">
          <p className="text-sm uppercase tracking-wide text-zinc-500">Today&rsquo;s verse</p>
          <blockquote className="mt-3 text-2xl font-medium leading-relaxed text-zinc-900">
            {verse.text}
          </blockquote>
          <p className="mt-3 text-sm text-zinc-500">&mdash; {verse.ref}</p>
        </section>

        <section className="mt-12 grid gap-4 text-sm text-zinc-600">
          <p>Useful starting points:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <code className="font-mono">docs/RECIPES.md</code> &mdash; how-to for common patterns
            </li>
            <li>
              <code className="font-mono">examples/</code> &mdash; copy-paste components
              (VerseOfDay, TrackedButton, ShareResult)
            </li>
            <li>
              <code className="font-mono">CLAUDE.md</code> &mdash; canonical patterns for the AI you
              vibe-code with
            </li>
            <li>
              <code className="font-mono">./scripts/doctor.sh</code> &mdash; run when something feels off
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
