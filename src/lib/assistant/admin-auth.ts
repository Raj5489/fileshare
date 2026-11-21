/**
 * Server-side admin authorization guard.
 *
 * Usage in a Route Handler or Server Component:
 *
 *   const result = await requireAdmin(request);
 *   if (!result.ok) return result.response;   // 401 or 403 JSON
 *   // result.email is the verified admin email
 *
 * Authorization is intentionally checked on every request — there is no
 * session-level admin flag and no client-supplied role is trusted.
 *
 * Admin emails are listed in the ADMIN_EMAILS environment variable as a
 * comma-separated string:
 *   ADMIN_EMAILS=you@example.com,colleague@example.com
 *
 * This module is server-only. It imports next/headers and Supabase
 * server utilities that must not be bundled for the browser.
 */

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export type AdminCheckOk = {
  ok: true;
  email: string;
};

export type AdminCheckFail = {
  ok: false;
  response: NextResponse;
};

export type AdminCheck = AdminCheckOk | AdminCheckFail;

/**
 * Reads the authorized admin emails from the environment variable.
 * Returns a lowercase Set for O(1) lookup.
 */
function getAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Verifies the incoming request carries a valid Supabase session and that
 * the authenticated user's email is in the ADMIN_EMAILS allowlist.
 *
 * Returns `{ ok: true, email }` on success or `{ ok: false, response }` with
 * a ready-to-return 401/403 NextResponse on failure.
 */
export async function requireAdmin(): Promise<AdminCheck> {
  const adminEmails = getAdminEmails();

  if (adminEmails.size === 0) {
    console.error(
      "[AdminAuth] ADMIN_EMAILS is not configured. All admin access denied.",
    );
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Admin access is not configured." },
        { status: 403 },
      ),
    };
  }

  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authentication service unavailable." },
        { status: 503 },
      ),
    };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      ),
    };
  }

  const email = user.email?.toLowerCase() ?? "";

  if (!adminEmails.has(email)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden." },
        { status: 403 },
      ),
    };
  }

  return { ok: true, email };
}

/**
 * Checks whether the current session belongs to an admin user.
 * Intended for use in Server Components (pages) to gate rendering.
 *
 * Returns the admin email on success, null otherwise.
 * Does NOT throw — callers should redirect on null.
 */
export async function getAdminUser(): Promise<string | null> {
  try {
    const result = await requireAdmin();
    return result.ok ? result.email : null;
  } catch {
    return null;
  }
}
