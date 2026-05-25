import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const URLS = [
  "https://api.reliefweb.int/v2/reports?appname=healthwatch-global&limit=1&fields[include][]=title&filter[field]=theme.name&filter[value]=Health",
  "https://www.ecdc.europa.eu/en/rss-feeds/rss.xml",
  "https://www.ecdc.europa.eu/feeds/en/news/rss",
  "https://www.healthmap.org/en/rss.php",
  "https://www.who.int/emergencies/disease-outbreak-news",
  "https://httpbin.org/get",
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
        return {
          url,
          status: res.status,
          ok: res.ok,
          ms: Date.now() - start,
          preview: body.slice(0, 120),
        };
      } catch (e: any) {
        return { url, status: 0, ok: false, ms: Date.now() - start, error: e.message };
      }
    })
  );

  return NextResponse.json({ results });
}
