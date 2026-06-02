import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n.routing";

export default createMiddleware(routing);

export const config = {
  // Match all routes EXCEPT:
  // - /api/* (API routes, image generators, webhooks)
  // - /_next/* (Next.js internals)
  // - /static files (favicon, icons, etc.)
  matcher: [
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
