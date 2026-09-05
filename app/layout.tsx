import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://healthwatch-global.com"),
  // Google Search Console site ownership verification — added 2026-09-06.
  // Lives on the true root layout (not app/[locale]/layout.tsx) because
  // per-page generateMetadata() elsewhere in the app redeclares its own
  // `alternates` object, which fully replaces rather than merges with an
  // ancestor's (see app/[locale]/(dashboard)/page.tsx and the RSS
  // autodiscovery fix this same day) — `verification` isn't redeclared
  // anywhere else, so placing it at the outermost layout is what keeps it
  // from being silently dropped on any page.
  verification: {
    google: "JfMX3NgLKfVtwDu8hyY4Fjoc5rENRvGA1Y4Zp_sHccY",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
