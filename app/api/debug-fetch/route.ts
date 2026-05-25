import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const URLS = [
  // ReliefWeb v2 with the official doc appname
  "https://api.reliefweb.int/v2/reports?appname=apidoc&limit=1&fields[include][]=title&filter[field]=theme.name&filter[value]=Health",
  // WHO DON page — show 1200 chars so we can see the article list HTML structure
  "https://www.who.int/emergencies/disease-outbreak-news",
  // Alternate WHO RSS paths post-redesign
  "https://www.who.int/emergencies/disease-outbreak-news/rss",
  "https://www.who.int/emergencies/disease-outbreak-news.rss",
  "https://www.who.int/csr/don/en/rss.xml",
];

export async function GET() {
  const results = await Promise.all(
    URLS.map(async (url) => {
      const start = Date.now();
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "HealthWatch-Global/1.0" },
          signal: AbortSignal.timeout(8000),
        });
        const body = await res.text();
        // Show more for WHO page so we can see article list structure
        const previewLen = url.includes("who.int/emergencies") ? 2000 : 200;
        return {
          url,
          status: res.status,
          ok: res.ok,
          ms: Date.now() - start,
          preview: body.slice(0, previewLen),
        };
      } catch (e: any) {
        return { url, status: 0, ok: false, ms: Date.now() - start, error: e.message };
      }
    })
  );

  return NextResponse.json({ results });
}
