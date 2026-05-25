import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml,application/json,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

// Sitefinity / WHO internal API candidates
const API_CANDIDATES = [
  "https://www.who.int/api/default/newsitems?$format=json&$top=3",
  "https://www.who.int/api/hub/sfdata/newsitems?sf_culture=en&$top=3",
  "https://www.who.int/api/news/newsitems?sf_culture=en&$top=3&$format=json",
  "https://www.who.int/api/content/v1/newsitems?language=en&top=3",
];

export async function GET() {
  const results: Record<string, any> = {};

  // 1. Test Sitefinity API endpoints
  results.apiTests = await Promise.all(
    API_CANDIDATES.map(async (url) => {
      try {
        const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(6000) });
        const body = await r.text();
        return { url, status: r.status, preview: body.slice(0, 300) };
      } catch (e: any) {
        return { url, status: 0, error: e.message };
      }
    })
  );

  // 2. Fetch the full WHO DON page and extract useful sections
  try {
    const r = await fetch("https://www.who.int/emergencies/disease-outbreak-news", {
      headers: HEADERS,
      signal: AbortSignal.timeout(10000),
    });
    const html = await r.text();

    // Find DON article links
    const linkRe = /href="(\/emergencies\/disease-outbreak-news\/item\/[^"]+)"/g;
    const links: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html)) !== null) {
      if (!links.includes(m[1])) links.push(m[1]);
    }
    results.donLinksFound = links.length;
    results.donLinksSample = links.slice(0, 5);

    // Find "scrape:on" / "scrape:off" markers
    const scrapeBlocks: string[] = [];
    const scrapeRe = /<!--[^-]*scrape:on[^>]*-->([\s\S]*?)<!--[^-]*scrape:off[^>]*-->/gi;
    while ((m = scrapeRe.exec(html)) !== null) {
      scrapeBlocks.push(m[1].slice(0, 500));
    }
    results.scrapeBlocks = scrapeBlocks;

    // Look for JSON-LD structured data
    const jsonLdRe = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    const jsonLds: any[] = [];
    while ((m = jsonLdRe.exec(html)) !== null) {
      try { jsonLds.push(JSON.parse(m[1])); } catch {}
    }
    results.jsonLd = jsonLds;

    // Show 800 chars after </head>
    const bodyStart = html.indexOf("</head>");
    results.bodyPreview = bodyStart > -1 ? html.slice(bodyStart, bodyStart + 800) : html.slice(2000, 2800);

    // Show 800 chars from the middle of the page (often where article list lives)
    const midpoint = Math.floor(html.length / 2);
    results.midPreview = html.slice(midpoint, midpoint + 800);

    // Look for Kendo DataSource API endpoint hints
    const kendoRe = /(?:url|read|transport)["'\s:]+["'](https?:\/\/www\.who\.int\/api[^"']+)["']/gi;
    const kendoUrls: string[] = [];
    while ((m = kendoRe.exec(html)) !== null) {
      if (!kendoUrls.includes(m[1])) kendoUrls.push(m[1]);
    }
    results.kendoApiUrls = kendoUrls;

    results.htmlSize = html.length;
  } catch (e: any) {
    results.pageError = e.message;
  }

  return NextResponse.json(results);
}
