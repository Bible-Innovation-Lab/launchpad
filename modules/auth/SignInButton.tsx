/**
 * modules/auth — sign-in button component.
 * Copy to components/SignInButton.tsx to use.
 */

"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function SignInButton() {
  const { data: session, status } = useSession();

  if (status === "loading") return null;

  if (session?.user) {
    return (
      <button
        type="button"
        onClick={() => signOut()}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
      >
        Sign out ({session.user.name ?? session.user.email})
      </button>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => signIn("google")}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-800"
      >
        Sign in with Google
      </button>
      <button
        type="button"
        onClick={() => signIn("apple")}
        className="rounded-md bg-black px-3 py-1.5 text-sm text-white hover:bg-zinc-800"
      >
        Sign in with Apple
      </button>
    </div>
  );
}
