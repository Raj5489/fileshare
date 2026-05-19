import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Browser/client-side client — lazy-initialized to avoid crash during module eval
let _supabaseBrowser: SupabaseClient | null = null;
export function getSupabaseBrowser() {
  if (!_supabaseBrowser) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
      );
    }
    _supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabaseBrowser;
}

/** @deprecated Use getSupabaseBrowser() instead */
export const supabaseBrowser = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabaseBrowser() as any)[prop];
  },
});

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

/** @deprecated Use getSupabaseAdmin() instead */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabaseAdmin() as any)[prop];
  },
});
