import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

const securityHeaders = [
  // Prevent clickjacking
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Referrer policy
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Permissions policy — disable unused browser features
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self)",
  },
  // XSS protection (legacy but still useful for older browsers)
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // DNS prefetch control
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // HSTS — only if served over HTTPS (Vercel handles this, but belt-and-braces)
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Security headers — all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // Static assets — cache 1 year (Next.js content-hashes them)
        source: "/_next/static/(.*)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // Favicons & public assets — cache 7 days
        source: "/(favicon.ico|robots.txt|sitemap.xml|.*\\.png|.*\\.svg|.*\\.ico|.*\\.webp)",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
      {
        // /api/health — cache 30s (monitors poll frequently)
        source: "/api/health",
        headers: [{ key: "Cache-Control", value: "public, max-age=30, stale-while-revalidate=10" }],
      },
    ];
  },
};

// Only wrap with Sentry when org + project + auth token are all configured.
// Without them the build still succeeds — errors are still captured via the DSN,
// but source maps won't be uploaded (stack traces will show minified code in Sentry).
const sentryConfigured =
  !!process.env.SENTRY_ORG &&
  !!process.env.SENTRY_PROJECT &&
  !!process.env.SENTRY_AUTH_TOKEN;

export default sentryConfigured
  ? withSentryConfig(withNextIntl(nextConfig), {
      org:           process.env.SENTRY_ORG,
      project:       process.env.SENTRY_PROJECT,
      authToken:     process.env.SENTRY_AUTH_TOKEN,
      // EU region — driven by SENTRY_URL env var (https://de.sentry.io/)
      silent:        true,
      disableLogger: true,
    })
  : withNextIntl(nextConfig);
