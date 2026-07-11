import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

// ─── Content-Security-Policy ──────────────────────────────────────────────────
// Next.js App Router uses inline scripts for hydration → 'unsafe-inline' required.
// The real protection here is connect-src (restricts XHR/fetch targets) and
// frame-src / object-src (prevents clickjacking & plugin abuse).
const csp = [
  "default-src 'self'",
  // Scripts: Next.js hydration + Vercel Analytics + Sentry replay
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' va.vercel-scripts.com",
  // Styles: Tailwind inline styles require unsafe-inline
  "style-src 'self' 'unsafe-inline'",
  // Images: OpenStreetMap tiles for Leaflet, Supabase storage, data URIs
  "img-src 'self' data: blob: *.openstreetmap.org *.tile.openstreetmap.org *.basemaps.cartocdn.com *.supabase.co",
  // Fonts: self only
  "font-src 'self'",
  // Connections: Supabase (DB + Realtime), Stripe, Sentry EU, Vercel Analytics, Brevo
  [
    "connect-src 'self'",
    "*.supabase.co",
    "wss://*.supabase.co",          // Realtime websocket
    "api.stripe.com",
    "o4511456134496256.ingest.de.sentry.io",
    "va.vercel-scripts.com",
    "api.brevo.com",
  ].join(" "),
  // Workers: Supabase JS client spawns an internal worker from a blob URL
  "worker-src blob:",
  // Frames: Stripe Checkout opens in a redirect, not iframe — block all
  "frame-src 'none'",
  // No plugins ever
  "object-src 'none'",
  // Upgrade insecure requests on all assets
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  // Content Security Policy
  { key: "Content-Security-Policy", value: csp },
  // Prevent clickjacking (belt-and-braces alongside CSP frame-src)
  { key: "X-Frame-Options", value: "DENY" },
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Referrer policy
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Permissions policy — disable unused browser features
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self)",
  },
  // DNS prefetch control
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // HSTS — only if served over HTTPS (Vercel handles this, but belt-and-braces)
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // @sparticuz/chromium ships a native binary + puppeteer-core drives it —
  // both must stay external to the webpack bundle (used by the USDA APHIS
  // Tableau-dashboard scraper cron).
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  async headers() {
    return [
      {
        // Security headers — all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
      // Static assets — cache 1 year in production (Next.js content-hashes them).
      // In dev, Turbopack reuses stable chunk filenames across rebuilds, so
      // immutable caching would prevent HMR changes from reaching the browser.
      ...(process.env.NODE_ENV === "production"
        ? [{
            source: "/_next/static/(.*)",
            headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
          }]
        : []),
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
      {
        // Service worker — must always be revalidated, never cached. A stale
        // sw.js means clients silently keep running old push/notification logic
        // (browsers already special-case SW update checks, but Vercel's edge
        // could still serve a cached copy without this — better explicit).
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, must-revalidate" },
          { key: "Content-Type",  value: "application/javascript; charset=utf-8" },
        ],
      },
      {
        // /widget — allow embedding in iframes (override X-Frame-Options: DENY)
        source: "/widget",
        headers: [
          { key: "X-Frame-Options",       value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
          { key: "Cache-Control",           value: "public, max-age=60, stale-while-revalidate=30" },
        ],
      },
    ];
  },

  async redirects() {
    // Short-slug aliases → canonical disease page slugs (permanent 301).
    // Lets us share /en/disease/ebola in posts even though the canonical
    // slug is /en/disease/ebola-virus-disease.
    const aliases: Array<[string, string]> = [
      ["ebola",      "ebola-virus-disease"],
      ["marburg",    "marburg-virus-disease"],
      ["dengue",     "dengue-fever"],
      ["lassa",      "lassa-fever"],
      ["nipah",      "nipah-virus"],
      ["typhoid",    "typhoid-fever"],
      ["zika",       "zika-virus"],
      ["oropouche",  "oropouche-virus-disease"],
      ["west-nile",  "west-nile-fever"],
      ["cchf",       "crimean-congo-haemorrhagic-fever"],
      ["bird-flu",   "avian-influenza"],
      ["avian-flu",  "avian-influenza"],
    ];
    return aliases.map(([short, canonical]) => ({
      source:      `/:locale/disease/${short}`,
      destination: `/:locale/disease/${canonical}`,
      permanent:   true,
    }));
  },

  // Expose Vercel's automatic VERCEL_ENV (production | preview | development)
  // as a NEXT_PUBLIC_ variable so the Sentry client SDK can use it.
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
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
      // EU ingest region — must be explicit so the build plugin hits de.sentry.io
      // instead of the default sentry.io for source-map uploads.
      sentryUrl:     process.env.SENTRY_URL ?? "https://de.sentry.io/",
      silent:        true,
      disableLogger: true,
      // Delete .js.map files after uploading to Sentry so they are never
      // served to browsers (prevents source code exposure).
      sourcemaps: { disable: false, deleteSourcemapsAfterUpload: true },
      // Proxy Sentry events through /api/monitoring to bypass adblockers
      tunnelRoute:   "/monitoring",
      telemetry:     false,
    })
  : withNextIntl(nextConfig);
