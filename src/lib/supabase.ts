import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Browser/client-side client — uses @supabase/ssr so the PKCE code_verifier
// is stored in cookies (not localStorage), allowing the server-side
// /auth/callback route to complete exchangeCodeForSession successfully.
let _supabaseBrowser: SupabaseClient | null = null;
export function getSupabaseBrowser() {
  if (!_supabaseBrowser) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
      );
    }
    _supabaseBrowser = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabaseBrowser;
}

// Admin client — bypasses RLS, server-only
let _supabaseAdmin: SupabaseClient | null = null;
export function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _supabaseAdmin;
}
