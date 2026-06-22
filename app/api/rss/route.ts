import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createService } from "@supabase/supabase-js";

const PAID_PLANS = ["pro", "team", "enterprise"];
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://healthwatch-global.com";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const region = searchParams.get("region");
  const risk   = searchParams.get("risk");

  const service = createService(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Auth: session cookie OR ?api_key= / X-API-Key header
  let profilePlan: string | null = null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles").select("plan").eq("id", user.id).single();
    profilePlan = profile?.plan ?? null;
  } else {
    const keyParam = searchParams.get("api_key") ?? req.headers.get("x-api-key");
    if (keyParam) {
      const { data: profile } = await service
        .from("profiles").select("plan").eq("api_key", keyParam).single();
      profilePlan = profile?.plan ?? null;
    }
  }

  if (!profilePlan) return new Response("Unauthorized", { status: 401 });
  if (!PAID_PLANS.includes(profilePlan))
    return new Response("Pro plan required", { status: 403 });

  let query = service
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, risk_level, date, region, is_pheic")
    .eq("active", true)
    .order("date", { ascending: false })
    .limit(50);

  if (region) query = query.eq("region", region);
  if (risk)   query = query.eq("risk_level", risk);

  const { data: outbreaks } = await query;

  const items = (outbreaks ?? []).map((o) => {
    const pheicNote = o.is_pheic ? " [PHEIC]" : "";
    const cfr = o.cases > 0 && o.deaths > 0
      ? `${(o.deaths / o.cases * 100).toFixed(1)}% CFR · `
      : "";
    return `
    <item>
      <title>${escapeXml(`${o.disease_en ?? "Unknown"} — ${o.country_en ?? "Unknown"}${pheicNote}`)}</title>
      <description>${escapeXml(`Risk: ${(o.risk_level ?? "unknown").toUpperCase()} · ${(o.cases ?? 0).toLocaleString("en")} cases · ${cfr}Region: ${o.region ?? ""}`)}</description>
      <pubDate>${new Date(o.date).toUTCString()}</pubDate>
      <link>${escapeXml(`${APP_URL}/en?outbreak=${o.id}`)}</link>
      <guid isPermaLink="false">${o.id}</guid>
      <category>${escapeXml(o.risk_level ?? "")}</category>
    </item>`;
  }).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>HealthWatch Global — Active Outbreaks</title>
    <link>${escapeXml(APP_URL)}</link>
    <description>Active disease outbreak alerts — WHO, ECDC, PAHO and Africa CDC data</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <ttl>60</ttl>
    <atom:link href="${escapeXml(`${APP_URL}/api/rss`)}" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
