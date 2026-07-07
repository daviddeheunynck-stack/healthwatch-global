import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // proxy.ts already refreshes the session server-side on every navigation
        // (see proxy.ts). Supabase's client-side autoRefreshToken runs a second,
        // uncoordinated refresh loop on a timer — and @supabase/auth-js immediately
        // re-runs that check when a tab regains visibility after being backgrounded
        // (GoTrueClient#_handleVisibilityChange). A tab left open a while, then
        // switched back to and refreshed, fires both refreshers within the same
        // ~90s pre-expiry window (EXPIRY_MARGIN_MS on both sides). Refresh tokens
        // are one-time-use, so whichever loses gets invalid_grant and writes a
        // dead session cookie — bouncing the next load to /login.
        // getUser()/getSession() still refresh reactively on demand (e.g. Navbar's
        // mount effect), so sessions don't go stale across normal navigation —
        // this only removes the background timer most likely to race the server.
        autoRefreshToken: false,
      },
    }
  );
}
