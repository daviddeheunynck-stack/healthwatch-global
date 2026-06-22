import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const clean = (v: string | undefined) => (v ?? "").replace(/^﻿/, "").trim();

export async function GET(req: NextRequest) {
  const cronSecret = clean(process.env.CRON_SECRET);
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`)
    return new Response("Unauthorized", { status: 401 });

  const resendKey = clean(process.env.RESEND_API_KEY);
  if (!resendKey) return new Response("RESEND_API_KEY not set", { status: 500 });

  const supabase = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  const [{ count: total }, { count: high }, { count: pheic }, { data: recent }] =
    await Promise.all([
      supabase.from("outbreaks").select("*", { count: "exact", head: true }).eq("active", true),
      supabase.from("outbreaks").select("*", { count: "exact", head: true }).eq("active", true).eq("risk_level", "high"),
      supabase.from("outbreaks").select("*", { count: "exact", head: true }).eq("active", true).eq("is_pheic", true),
      supabase.from("outbreaks").select("updated_at").eq("active", true).order("updated_at", { ascending: false }).limit(1),
    ]);

  const lastSync = recent?.[0]?.updated_at ? new Date(recent[0].updated_at) : null;
  const syncAgeH  = lastSync ? Math.round((Date.now() - lastSync.getTime()) / 3600000) : null;
  const syncStale = syncAgeH === null || syncAgeH > 4;
  const status    = syncStale || (pheic ?? 0) > 0 ? "⚠️" : "✅";

  const html = `
<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px">
  <p style="font-size:16px;font-weight:700;color:#60a5fa;margin:0 0 16px">HealthWatch — Health Check ${status}</p>
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <tr><td style="padding:6px 0;color:#94a3b8">Foyers actifs</td><td style="padding:6px 0;font-weight:600">${total ?? "?"}</td></tr>
    <tr><td style="padding:6px 0;color:#94a3b8">Risque HIGH</td><td style="padding:6px 0;font-weight:600;color:#f87171">${high ?? "?"}</td></tr>
    <tr><td style="padding:6px 0;color:#94a3b8">PHEIC actifs</td><td style="padding:6px 0;font-weight:600;color:#c084fc">${pheic ?? "?"}</td></tr>
    <tr><td style="padding:6px 0;color:#94a3b8">Dernière sync</td><td style="padding:6px 0;${syncStale ? "color:#f87171;font-weight:600" : ""}">${syncAgeH !== null ? `il y a ${syncAgeH}h` : "inconnue"}</td></tr>
  </table>
  <p style="margin-top:16px;font-size:11px;color:#475569">${new Date().toISOString()}</p>
</div>`;

  const resend = new Resend(resendKey);
  await resend.emails.send({
    from:    "HealthWatch Global <alerts@healthwatch-global.com>",
    to:      "david.deheunynck@yahoo.fr",
    subject: `${status} HealthWatch — ${total ?? "?"} foyers actifs · ${new Date().toLocaleDateString("fr-FR")}`,
    html,
  });

  return Response.json({ ok: true, total, high, pheic, syncAgeH });
}
