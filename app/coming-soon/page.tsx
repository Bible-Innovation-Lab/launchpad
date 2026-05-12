export const metadata = {
  title: "Coming soon",
  robots: { index: false },
};

export default function ComingSoon() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-white px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">Coming soon</h1>
        <p className="mt-3 text-zinc-600">
          This site is only available in the United States right now. Check back later.
        </p>
      </div>
    </main>
  );
}
