// RSS 2.0 feed — active WHO outbreaks in the requested locale.
// URL: /[locale]/feed  (e.g. /fr/feed, /en/feed)
// Cache: 1 hour (same as sync-outbreaks cron cadence).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { getLocalizedDisease, getLocalizedCountry, getLocalizedDescription } from "@/lib/outbreaks";
import type { Outbreak } from "@/lib/outbreaks";

export const revalidate = 3600;

const BASE_URL = "https://healthwatch-global.com";
const BOM      = String.fromCharCode(65279);
const clean    = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const FEED_META: Record<string, { title: string; description: string; lang: string }> = {
  fr: { title: "HealthWatch Global — Épidémies mondiales", description: "Foyers de maladies infectieuses actifs — données officielles OMS, ECDC, PAHO et Africa CDC, mises à jour toutes les heures.", lang: "fr" },
  en: { title: "HealthWatch Global — Global Disease Outbreaks", description: "Active infectious disease outbreaks — official WHO, ECDC, PAHO and Africa CDC data, updated every hour.", lang: "en" },
  es: { title: "HealthWatch Global — Brotes mundiales", description: "Brotes activos de enfermedades infecciosas — datos oficiales OMS, ECDC, PAHO y Africa CDC, actualizados cada hora.", lang: "es" },
  ar: { title: "HealthWatch Global — تفشيات الأمراض العالمية", description: "تفشيات الأمراض المعدية النشطة — بيانات رسمية من منظمة الصحة العالمية، ECDC، PAHO وAfrica CDC، محدّثة كل ساعة.", lang: "ar" },
  id: { title: "HealthWatch Global — Wabah Penyakit Global", description: "Wabah penyakit menular aktif — data resmi WHO, ECDC, PAHO dan Africa CDC, diperbarui setiap jam.", lang: "id" },
};

const STATS_LABEL: Record<string, { cases: string; deaths: string }> = {
  fr: { cases: "cas",    deaths: "décès"      },
  en: { cases: "cases",  deaths: "deaths"     },
  es: { cases: "casos",  deaths: "fallecidos" },
  ar: { cases: "حالة",   deaths: "وفاة"       },
  id: { cases: "kasus",  deaths: "kematian"   },
};

const RISK_LABEL: Record<string, Record<string, string>> = {
  fr: { high: "Risque élevé", medium: "Risque modéré", low: "Risque faible" },
  en: { high: "High risk",    medium: "Moderate risk", low: "Low risk"    },
  es: { high: "Riesgo alto",  medium: "Riesgo moderado", low: "Riesgo bajo" },
  ar: { high: "خطر مرتفع",   medium: "خطر متوسط",     low: "خطر منخفض"   },
  id: { high: "Risiko tinggi", medium: "Risiko sedang", low: "Risiko rendah" },
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ locale: string }> }
) {
  const { locale } = await params;
  const l        = FEED_META[locale] ? locale : "en";
  const meta     = FEED_META[l];
  const risks    = RISK_LABEL[l] ?? RISK_LABEL.en;
  const stats    = STATS_LABEL[l] ?? STATS_LABEL.en;
  const numLocale = l === "ar" ? "ar-SA" : l;

  const supabase = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  const { data, error } = await supabase
    .from("outbreaks")
    .select("id, disease, disease_en, disease_ar, country, country_en, country_ar, risk_level, date, cases, deaths, description, description_fr, description_es, description_ar, description_id")
    .eq("active", true)
    .order("date", { ascending: false })
    .limit(30);

  // A failed query used to fall through silently into a validly-formed, empty
  // RSS document — indistinguishable from "no active outbreaks right now" to
  // any subscriber's reader/pipeline, then cached and served for an hour to
  // every locale visitor. Same pattern already fixed in app/api/rss/route.ts
  // (commit 772edef) — missed there because that audit was scoped to app/api/*
  // and this route lives under app/[locale]/feed instead. Found 2026-08-02.
  if (error) {
    console.error("[locale-feed] outbreaks query failed:", error.message);
    Sentry.captureException(new Error(`[locale-feed] query failed: ${error.message}`), { tags: { route: "locale-feed" } });
    return new NextResponse("Temporarily unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const outbreaks = (data ?? []) as Outbreak[];

  const items = outbreaks.map((o) => {
    const disease     = esc(getLocalizedDisease(o, l));
    const country     = esc(getLocalizedCountry(o, l));
    const description = getLocalizedDescription(o, l);
    const riskLabel   = esc(risks[o.risk_level] ?? o.risk_level);
    const pubDate     = o.date ? new Date(o.date).toUTCString() : new Date().toUTCString();
    const link        = `${BASE_URL}/${l}/outbreak/${o.id}`;
    const guid        = `${BASE_URL}/outbreak/${o.id}`;

    const statsLine = o.cases > 0
      ? `${o.cases.toLocaleString(numLocale)} ${stats.cases}${o.deaths !== null ? ` · ${o.deaths.toLocaleString(numLocale)} ${stats.deaths}` : ""}`
      : "";

    const descParts = [
      `[${riskLabel}] ${disease} — ${country}`,
      statsLine,
      description ? esc(description.slice(0, 300)) : "",
    ].filter(Boolean).join(" · ");

    return `
    <item>
      <title>${disease} — ${country}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${guid}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${descParts}</description>
      <category>${disease}</category>
    </item>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(meta.title)}</title>
    <link>${BASE_URL}/${l}</link>
    <description>${esc(meta.description)}</description>
    <language>${meta.lang}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE_URL}/${l}/feed" rel="self" type="application/rss+xml" />
    <image>
      <url>${BASE_URL}/icons/icon-192.png</url>
      <title>${esc(meta.title)}</title>
      <link>${BASE_URL}/${l}</link>
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
