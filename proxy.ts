import createIntlMiddleware from "next-intl/middleware";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest } from "next/server";
import { routing } from "./i18n.routing";

const intlMiddleware = createIntlMiddleware(routing);

export async function proxy(request: NextRequest) {
  // Refresh the Supabase session FIRST and write it into the incoming
  // request's cookies. next-intl's middleware copies `request.headers`
  // (Cookie included) into whatever response it builds, so the refreshed
  // tokens must land on `request` before next-intl runs — otherwise the
  // Server Component render downstream still sees the stale cookies the
  // browser sent in, which can be a refresh token that was just rotated
  // away by the call below, forcing a login on the very next request.
  let refreshedCookies: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          refreshedCookies = cookiesToSet;
        },
      },
    }
  );

  await supabase.auth.getUser();

  // Run next-intl routing on the now-refreshed request
  const response = intlMiddleware(request);

  // Mirror the refreshed cookies onto the outgoing response too, so the
  // browser's cookie jar stays in sync going forward.
  refreshedCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  );

  return response;
}

export const config = {
  // Exclude: api/*, _next/*, _vercel/*, auth/*, widget, Next.js special routes, static files
  matcher: [
    {
      source:
        "/((?!api|_next|_vercel|auth|widget|apple-icon|icon|opengraph-image|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|.*\\..*).*)",
      // Skip Link prefetch requests. They still carry the browser's cookies, so
      // they'd otherwise call supabase.auth.getUser() (and its refresh) exactly
      // like a real navigation. Supabase refresh tokens are one-time-use: a
      // prefetch racing a real navigation (or two overlapping prefetches — this
      // page alone has several visible <Link>s) can each read the same
      // not-yet-rotated refresh token, and whichever refresh loses gets an
      // invalid_grant, writing a dead session cookie back to the browser. The
      // next real request (or the next refresh) then finds no valid session
      // and bounces to /login. Prefetches don't need a fresh session, so just
      // don't run proxy for them.
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
