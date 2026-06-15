// Push-alert cron — runs daily at 06:45 UTC, right after sync-outbreaks (06:00).
// For every outbreak inserted since the last run (push_notified_at IS NULL +
// created_at within 25 h), sends a localised Web Push to every subscriber and
// marks the outbreak as notified so it is never re-sent.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToMany } from "@/lib/push";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import { errorMessage } from "@/lib/error";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();
const CRON_SECRET = clean(process.env.CRON_SECRET);

const RISK_LABEL: Record<string, Record<string, string>> = {
  en: { High: "High risk",        "Very High": "Very high risk", Moderate: "Moderate risk", Low: "Low risk" },
  fr: { High: "Risque élevé",     "Very High": "Risque très élevé", Moderate: "Risque modéré", Low: "Risque faible" },
  es: { High: "Riesgo alto",      "Very High": "Riesgo muy alto",   Moderate: "Riesgo moderado", Low: "Riesgo bajo" },
  ar: { High: "خطر مرتفع",        "Very High": "خطر مرتفع جداً",   Moderate: "خطر متوسط",    Low: "خطر منخفض" },
  id: { High: "Risiko tinggi",    "Very High": "Risiko sangat tinggi", Moderate: "Risiko sedang", Low: "Risiko rendah" },
};

const CASES_LABEL: Record<string, string> = {
  en: "cases", fr: "cas", es: "casos", ar: "حالة", id: "kasus",
};

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  // 1. New outbreaks — inserted in the last 25 h, not yet push-notified.
  //    The 25 h window prevents backfilling historical rows that predate this
  //    column being added (they all have push_notified_at = NULL but were
  //    created long ago).
  const cutoff = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  const { data: newOutbreaks, error: obErr } = await supabase
    .from("outbreaks")
    .select("id, disease, disease_en, disease_ar, country, country_en, country_ar, cases, risk_level")
    .eq("active", true)
    .is("push_notified_at", null)
    .gte("created_at", cutoff);

  if (obErr) {
    console.error("[push-alerts] fetch outbreaks:", obErr.message);
    return NextResponse.json({ error: obErr.message }, { status: 500 });
  }

  if (!newOutbreaks || newOutbreaks.length === 0) {
    console.log("[push-alerts] No new outbreaks to notify");
    return NextResponse.json({ sent: 0, outbreaks: 0 });
  }

  // 2. All push subscriptions — one per device/browser.
  const { data: allSubs, error: subsErr } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, locale");

  if (subsErr) {
    console.error("[push-alerts] fetch subscriptions:", subsErr.message);
    return NextResponse.json({ error: subsErr.message }, { status: 500 });
  }

  if (!allSubs || allSubs.length === 0) {
    // Still mark outbreaks as notified so they don't queue up forever.
    await supabase
      .from("outbreaks")
      .update({ push_notified_at: new Date().toISOString() })
      .in("id", newOutbreaks.map((o) => o.id));
    return NextResponse.json({ sent: 0, outbreaks: newOutbreaks.length, message: "No subscribers" });
  }

  // 3. Send — one push per outbreak, grouped by locale for localised copy.
  let totalSent = 0;
  const allExpiredIds: string[] = [];
  const notifiedIds: string[] = [];

  for (const outbreak of newOutbreaks) {
    const locales = [...new Set(allSubs.map((s) => s.locale ?? "en"))];

    for (const locale of locales) {
      const group = allSubs.filter((s) => (s.locale ?? "en") === locale);
      const disease = getLocalizedDisease(outbreak, locale);
      const country = getLocalizedCountry(outbreak, locale);
      const risk    = RISK_LABEL[locale]?.[outbreak.risk_level ?? ""] ?? "";
      const cases   = outbreak.cases != null
        ? `${outbreak.cases.toLocaleString("en")} ${CASES_LABEL[locale] ?? "cases"}`
        : "";

      const bodyParts = [cases, risk].filter(Boolean);

      const payload = {
        title: `⚠️ ${disease} — ${country}`,
        body:  bodyParts.join(" · ") || disease,
        tag:   `hwg-outbreak-${outbreak.id}`,
        url:   `/${locale}/`,
        icon:  "/icons/icon-192.png",
      };

      try {
        const result = await sendPushToMany(group, payload);
        totalSent += result.sent;
        allExpiredIds.push(...result.expiredIds);
      } catch (e: unknown) {
        console.error(`[push-alerts] ${disease}/${country}/${locale}:`, errorMessage(e));
      }
    }

    notifiedIds.push(outbreak.id);
  }

  // 4. Mark as notified — idempotent even if the cron fires twice.
  if (notifiedIds.length > 0) {
    const { error: markErr } = await supabase
      .from("outbreaks")
      .update({ push_notified_at: new Date().toISOString() })
      .in("id", notifiedIds);
    if (markErr) console.error("[push-alerts] mark notified:", markErr.message);
  }

  // 5. Sweep dead endpoints so they don't inflate subscriber counts.
  if (allExpiredIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", allExpiredIds);
    console.log(`[push-alerts] Swept ${allExpiredIds.length} expired subscription(s)`);
  }

  console.log(`[push-alerts] Done — outbreaks: ${notifiedIds.length}, sent: ${totalSent}, expired: ${allExpiredIds.length}`);
  return NextResponse.json({ outbreaks: notifiedIds.length, sent: totalSent, expired: allExpiredIds.length });
}
