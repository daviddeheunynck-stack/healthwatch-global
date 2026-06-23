import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET      = clean(process.env.CRON_SECRET);
const RESEND_KEY       = clean(process.env.RESEND_API_KEY);
const APP_URL          = clean(process.env.NEXT_PUBLIC_APP_URL) || "https://healthwatch-global.com";

const RISK_LABEL: Record<string, Record<string, string>> = {
  en: { high: "HIGH", medium: "MEDIUM", low: "LOW" },
  fr: { high: "ÉLEVÉ", medium: "MODÉRÉ", low: "FAIBLE" },
  es: { high: "ALTO",  medium: "MEDIO",  low: "BAJO"  },
  ar: { high: "مرتفع", medium: "متوسط",  low: "منخفض" },
  id: { high: "TINGGI", medium: "SEDANG", low: "RENDAH" },
};

const SUBJECT: Record<string, (d: string, c: string) => string> = {
  en: (d, c) => `[HealthWatch] Update: ${d} — ${c}`,
  fr: (d, c) => `[HealthWatch] Mise à jour : ${d} — ${c}`,
  es: (d, c) => `[HealthWatch] Actualización: ${d} — ${c}`,
  ar: (d, c) => `[HealthWatch] تحديث: ${d} — ${c}`,
  id: (d, c) => `[HealthWatch] Pembaruan: ${d} — ${c}`,
};

interface Subscriber {
  id: string; user_id: string; outbreak_id: string;
  emails: string[]; locale: string; last_sent_at: string | null;
}
interface Outbreak {
  id: string; disease_en: string | null; country_en: string | null;
  cases: number; deaths: number; risk_level: string; date: string;
}

export async function GET(req: NextRequest) {
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!RESEND_KEY) return NextResponse.json({ ok: true, skipped: "RESEND_API_KEY not configured" });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
  const resend   = new Resend(RESEND_KEY);

  const { data: subscribers } = await supabase
    .from("outbreak_subscribers")
    .select("id, user_id, outbreak_id, emails, locale, last_sent_at");

  if (!subscribers?.length) return NextResponse.json({ ok: true, sent: 0 });

  const outbreakIds = [...new Set((subscribers as Subscriber[]).map((s) => s.outbreak_id))];
  const { data: outbreaks } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, risk_level, date")
    .in("id", outbreakIds)
    .eq("active", true);

  const oMap = new Map<string, Outbreak>();
  for (const o of (outbreaks ?? []) as Outbreak[]) oMap.set(o.id, o);

  const COOLDOWN_H = 24;
  let sent = 0;

  for (const sub of subscribers as Subscriber[]) {
    const o = oMap.get(sub.outbreak_id);
    if (!o || !sub.emails.length) continue;

    // Respect 24-hour cooldown
    if (sub.last_sent_at) {
      const h = (Date.now() - new Date(sub.last_sent_at).getTime()) / 3600000;
      if (h < COOLDOWN_H) continue;
    }

    const locale    = sub.locale in SUBJECT ? sub.locale : "en";
    const disease   = o.disease_en ?? "Unknown disease";
    const country   = o.country_en ?? "Unknown country";
    const risk      = (RISK_LABEL[locale] ?? RISK_LABEL.en)[o.risk_level] ?? o.risk_level.toUpperCase();
    const deepLink  = `${APP_URL}/${locale}?outbreak=${o.id}`;
    const cfr       = o.cases > 0 ? (o.deaths / o.cases * 100).toFixed(1) : null;

    try {
      await resend.emails.send({
        from: "HealthWatch Global <alerts@healthwatch-global.com>",
        to:   sub.emails,
        subject: (SUBJECT[locale] ?? SUBJECT.en)(disease, country),
        html: `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px">
  <p style="color:#60a5fa;font-size:18px;font-weight:700;margin:0 0 4px">HealthWatch Global</p>
  <p style="margin:0 0 16px;font-size:12px;color:#64748b">Outbreak subscriber alert</p>
  <hr style="border:none;border-top:1px solid #334155;margin:0 0 16px"/>
  <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#fff">${disease} — ${country}</p>
  <p style="margin:0 0 12px;font-size:13px;color:#94a3b8">
    Cases: <strong style="color:#f1f5f9">${o.cases.toLocaleString(locale)}</strong> &nbsp;|&nbsp;
    Deaths: <strong style="color:#f1f5f9">${o.deaths.toLocaleString(locale)}</strong>
    ${cfr ? `&nbsp;|&nbsp; CFR: <strong style="color:#f1f5f9">${cfr}%</strong>` : ""}
  </p>
  <p style="margin:0 0 20px;font-size:13px;color:#94a3b8">
    Risk level: <strong style="color:${o.risk_level === "high" ? "#f87171" : o.risk_level === "medium" ? "#fbbf24" : "#4ade80"}">${risk}</strong>
    &nbsp;|&nbsp; Last report: ${o.date}
  </p>
  <a href="${deepLink}" style="display:inline-block;padding:10px 20px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">
    View outbreak →
  </a>
  <p style="margin-top:20px;font-size:11px;color:#475569">
    You subscribed to updates for this outbreak on HealthWatch Global.
    To unsubscribe, open the outbreak detail and remove your email list.
    <br/>${APP_URL}
  </p>
</div>`,
      });

      await supabase
        .from("outbreak_subscribers")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("id", sub.id);

      sent++;
    } catch { /* Resend errors non-fatal */ }
  }

  return NextResponse.json({ ok: true, sent });
}
