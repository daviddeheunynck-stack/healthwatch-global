import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

// Localized confirmation pages
const MESSAGES: Record<string, { title: string; body: string }> = {
  fr: { title: "Désabonnement confirmé", body: "Vous avez été désabonné(e) avec succès. Vous ne recevrez plus de briefings hebdomadaires." },
  en: { title: "Unsubscribed", body: "You have been successfully unsubscribed. You will no longer receive weekly briefings." },
  es: { title: "Suscripción cancelada", body: "Se ha cancelado su suscripción correctamente. Ya no recibirá informes semanales." },
  ar: { title: "تم إلغاء الاشتراك", body: "تم إلغاء اشتراكك بنجاح. لن تتلقى بعد الآن الملخصات الأسبوعية." },
  id: { title: "Berhasil berhenti berlangganan", body: "Anda telah berhasil berhenti berlangganan. Anda tidak akan lagi menerima briefing mingguan." },
};

function htmlPage(locale: string, success: boolean) {
  const m = MESSAGES[locale] || MESSAGES.fr;
  const dir = locale === "ar" ? "rtl" : "ltr";
  const title = success ? m.title : "Lien invalide";
  const body = success ? m.body : "Ce lien de désabonnement est invalide ou a déjà été utilisé.";

  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title} — HealthWatch Global</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #0f172a; color: #e2e8f0; display: flex;
           align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; padding: 16px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px;
            padding: 40px 48px; max-width: 480px; width: 100%; text-align: center; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { color: #f1f5f9; font-size: 22px; margin: 0 0 12px; }
    p  { color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 0 0 24px; }
    a  { color: #dc2626; text-decoration: none; font-weight: 600; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? "✅" : "⚠️"}</div>
    <h1>${title}</h1>
    <p>${body}</p>
    <a href="https://healthwatch-global.com">← Retour au site</a>
  </div>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const locale = req.nextUrl.searchParams.get("locale") || "fr";

  if (!id) {
    return new NextResponse(htmlPage(locale, false), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { error } = await supabase
    .from("subscriptions")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[unsubscribe] error:", error);
    return new NextResponse(htmlPage(locale, false), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  console.log(`[unsubscribe] removed subscription id=${id}`);
  return new NextResponse(htmlPage(locale, true), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
