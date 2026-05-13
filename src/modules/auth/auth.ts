/**
 * modules/auth — NextAuth v5 entry point.
 * Copy this file to the repo root as `auth.ts` to enable.
 *
 * Exports the auth() helper for server components/route handlers and the
 * GET/POST route handlers for /api/auth/[...nextauth]/route.ts.
 */

import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
export const { GET, POST } = handlers;
