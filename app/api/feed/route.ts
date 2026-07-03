/**
 * GET /api/feed?locale=en&region=africa
 *
 * Public RSS 2.0 feed of active disease outbreaks.
 * No authentication required.
 * Query params:
 *   locale — en | fr | es | ar | id  (default: en)
 *   region — africa | asia | americas | europe | oceania  (optional, all regions if omitted)
 *
 * Refreshed every hour (Cache-Control: max-age=3600).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";

export const revalidate = 3600;

const BASE_URL = "https://healthwatch-global.com";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const VALID_LOCALES = new Set(["en", "fr", "es", "ar", "id"]);
const VALID_REGIONS = new Set(["africa", "asia", "americas", "europe", "oceania"]);

const FEED_TITLE: Record<string, string> = {
  en: "HealthWatch Global — Active Disease Outbreaks",
  fr: "HealthWatch Global — Foyers épidémiques actifs",
  es: "HealthWatch Global — Brotes de enfermedades activos",
  ar: "HealthWatch Global — تفشيات الأمراض النشطة",
  id: "HealthWatch Global — Wabah Penyakit Aktif",
};

const FEED_DESC: Record<string, string> = {
  en: "Live active disease outbreak data from WHO, ECDC, PAHO and Africa CDC. Updated every hour.",
  fr: "Données en direct sur les foyers épidémiques actifs — OMS, ECDC, PAHO et Africa CDC. Mise à jour toutes les heures.",
  es: "Datos en vivo sobre brotes de enfermedades activos — OMS, ECDC, PAHO y Africa CDC. Actualizado cada hora.",
  ar: "بيانات حية عن تفشي الأمراض النشطة من منظمة الصحة العالمية وECDC وPAHO وAfrica CDC. تحديث كل ساعة.",
  id: "Data langsung wabah penyakit aktif dari WHO, ECDC, PAHO dan Africa CDC. Diperbarui setiap jam.",
};

const RISK_LABEL: Record<string, Record<string, string>> = {
  en: { high: "HIGH RISK", medium: "MODERATE RISK", low: "LOW RISK" },
  fr: { high: "RISQUE ÉLEVÉ", medium: "RISQUE MODÉRÉ", low: "RISQUE FAIBLE" },
  es: { high: "RIESGO ALTO", medium: "RIESGO MODERADO", low: "RIESGO BAJO" },
  ar: { high: "خطر مرتفع", medium: "خطر متوسط", low: "خطر منخفض" },
  id: { high: "RISIKO TINGGI", medium: "RISIKO SEDANG", low: "RISIKO RENDAH" },
};

function escapeXml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const locale = VALID_LOCALES.has(searchParams.get("locale") ?? "") ? (searchParams.get("locale") as string) : "en";
  const region = searchParams.get("region") ?? "";
  const filterRegion = VALID_REGIONS.has(region) ? region : null;

  const supabase = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  let query = supabase
    .from("outbreaks")
    .select("id, disease, disease_en, disease_ar, country, country_en, country_ar, region, risk_level, cases, deaths, date, is_pheic, source")
    .eq("active", true)
    .order("date", { ascending: false })
    .limit(50);

  if (filterRegion) query = query.eq("region", filterRegion);

  const { data, error } = await query;

  if (error) {
    return new NextResponse("Internal error", { status: 500 });
  }

  const outbreaks = data ?? [];
  const now = new Date().toUTCString();

  const feedUrl = `${BASE_URL}/api/feed?locale=${locale}${filterRegion ? `&region=${filterRegion}` : ""}`;
  const feedTitle = FEED_TITLE[locale] ?? FEED_TITLE.en;
  const feedDesc  = FEED_DESC[locale] ?? FEED_DESC.en;

  const numLocale = locale === "ar" ? "ar-SA" : locale;
  const items = outbreaks.map((o) => {
    const diseaseName = getLocalizedDisease(o, locale) || "Unknown";
    const countryName = getLocalizedCountry(o, locale);

    const title = countryName ? `${diseaseName} — ${countryName}` : diseaseName;
    const risk  = o.risk_level ? (RISK_LABEL[locale]?.[o.risk_level] ?? o.risk_level.toUpperCase()) : "";
    const cfr   = o.cases > 0 && o.deaths > 0 ? ` · CFR ${(o.deaths / o.cases * 100).toFixed(1)}%` : "";
    const pheicFlag = o.is_pheic ? " 🚨 PHEIC" : "";

    const descParts: string[] = [];
    if (risk) descParts.push(risk);
    if (o.cases)  descParts.push(`Cases: ${o.cases.toLocaleString(numLocale)}`);
    if (o.deaths) descParts.push(`Deaths: ${o.deaths.toLocaleString(numLocale)}${cfr}`);
    if (pheicFlag) descParts.push(pheicFlag);

    const pubDate = o.date ? new Date(o.date).toUTCString() : now;
    const link    = `${BASE_URL}/${locale}/outbreak/${o.id}`;

    return `
    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <description>${escapeXml(descParts.join(" · "))}</description>
      <pubDate>${pubDate}</pubDate>
      ${o.source ? `<source url="${escapeXml(o.source)}">${escapeXml(diseaseName)}</source>` : ""}
    </item>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(feedTitle)}</title>
    <link>${BASE_URL}/${locale}</link>
    <description>${escapeXml(feedDesc)}</description>
    <language>${locale}</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
    <image>
      <url>${BASE_URL}/icon-192.png</url>
      <title>${escapeXml(feedTitle)}</title>
      <link>${BASE_URL}/${locale}</link>
    </image>
${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
