import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildDigestEmail } from "@/lib/digest-email";
import type { Outbreak } from "@/lib/outbreaks";

export const dynamic = "force-dynamic";

// Strip BOM (U+FEFF = char code 65279) and whitespace from env vars.
// Uses String.fromCharCode so no literal BOM byte appears in this source file.
const BOM = String.fromCharCode(65279);
const clean = (val: string | undefined) =>
  (val || "").replace(new RegExp("^" + BOM), "").trim();

const BREVO_API_KEY = clean(process.env.BREVO_API_KEY);
const SUPABASE_URL = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo error for ${to}: ${err}`);
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = clean(process.env.CRON_SECRET);

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: subscribers, error: subError } = await supabase
    .from("subscriptions")
    .select("id, email, region, locale");

  if (subError) {
    console.error("Failed to fetch subscribers:", subError);
    return NextResponse.json({ error: subError.message }, { status: 500 });
  }

  if (!subscribers || subscribers.length === 0) {
    return NextResponse.json({ message: "No subscribers found.", sent: 0 });
  }

  const { data: outbreaks, error: outbreakError } = await supabase
    .from("outbreaks")
    .select("*")
    .order("date", { ascending: false });

  if (outbreakError) {
    console.error("Failed to fetch outbreaks:", outbreakError);
    return NextResponse.json({ error: outbreakError.message }, { status: 500 });
  }

  const allOutbreaks: Outbreak[] = outbreaks || [];
  let sent = 0;
  let failed = 0;

  for (const sub of subscribers) {
    try {
      const locale = sub.locale || "fr";
      const region = sub.region || "allRegions";

      const regionOutbreaks = region === "allRegions"
        ? allOutbreaks
        : allOutbreaks.filter((o) => o.region === region);

      const { subject, html } = buildDigestEmail(regionOutbreaks, region, locale, sub.id);
      await sendEmail(sub.email, subject, html);
      sent++;

      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error(`Failed to send to ${sub.email}:`, err);
      failed++;
    }
  }

  console.log(`Weekly digest: ${sent} sent, ${failed} failed.`);
  return NextResponse.json({ sent, failed, total: subscribers.length });
}
