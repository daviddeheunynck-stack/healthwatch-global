import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const REGION_LABELS: Record<string, string> = {
  allRegions: "Toutes les régions",
  africa: "Afrique",
  asia: "Asie",
  europe: "Europe",
  americas: "Amériques",
  oceania: "Océanie",
};

async function sendConfirmationEmail(email: string, region: string) {
  const regionLabel = REGION_LABELS[region] || region;

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY!.replace(/^﻿/, "").trim(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: "HealthWatch Global",
        email: "alerts@healthwatch-global.com",
      },
      to: [{ email }],
      subject: "Votre abonnement aux alertes sanitaires est confirmé",
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8" /></head>
        <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:40px 20px;">
          <div style="max-width:560px;margin:0 auto;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
            <div style="background:#dc2626;padding:28px 32px;">
              <h1 style="margin:0;font-size:22px;color:white;font-weight:700;">🌍 HealthWatch Global</h1>
              <p style="margin:6px 0 0;color:#fecaca;font-size:14px;">Surveillance sanitaire mondiale en temps réel</p>
            </div>
            <div style="padding:32px;">
              <h2 style="margin:0 0 16px;font-size:20px;color:#f1f5f9;">Abonnement confirmé ✓</h2>
              <p style="margin:0 0 24px;color:#94a3b8;line-height:1.6;">
                Vous recevrez désormais des alertes sanitaires pour la région :
                <strong style="color:#f1f5f9;">${regionLabel}</strong>.
              </p>
              <div style="background:#0f172a;border-radius:10px;padding:20px;margin-bottom:24px;border:1px solid #334155;">
                <p style="margin:0 0 8px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Votre abonnement</p>
                <p style="margin:0;color:#e2e8f0;"><span style="color:#64748b;">Email :</span> ${email}</p>
                <p style="margin:8px 0 0;color:#e2e8f0;"><span style="color:#64748b;">Région :</span> ${regionLabel}</p>
              </div>
              <a href="https://healthwatch-global.com"
                 style="display:inline-block;background:#dc2626;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">
                Voir le tableau de bord →
              </a>
            </div>
            <div style="padding:20px 32px;border-top:1px solid #334155;">
              <p style="margin:0;font-size:12px;color:#475569;">
                Sources : OMS · CDC · ProMED · ECDC · PAHO<br/>
                Pour vous désabonner, répondez à cet email avec "désabonnement".
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Brevo error: ${err}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { email, region, locale } = await req.json();

    if (!email || !region) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error: dbError } = await supabase
      .from("subscriptions")
      .insert({ email, region, locale: locale || "fr" });

    if (dbError && dbError.code !== "23505") {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    await sendConfirmationEmail(email, region);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Subscribe error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
