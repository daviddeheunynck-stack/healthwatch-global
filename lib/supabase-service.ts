import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

let cached: SupabaseClient | null = null;

/**
 * Memoized service-role Supabase client (bypasses RLS). Use only in new
 * server-side code — the ~80 existing routes that each instantiate their own
 * inline createClient(url, SERVICE_ROLE_KEY) are left as-is; this isn't a
 * retrofit, just a shared factory going forward.
 */
export function getServiceClient(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  return cached;
}
