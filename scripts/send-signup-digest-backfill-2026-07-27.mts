// One-off: complete the 2026-07-26 signup digest backfill, which used a
// hardcoded USERS list that only covered 5 of the 7 real trial users active
// at the time and missed iinnerre@gmail.com and jalal.nourlil@pasteur.ma.
// Same logic as that script (and the route's digest block), applied against
// each user's current backlog so outbreaks already alerted for real aren't
// duplicated. Authorized by David in chat 2026-07-27.
import { readFileSync } from "fs";
import { buildSignupDigestEmail } from "../lib/signup-digest-email";

const env = readFileSync(".env.local.live", "utf-8");
const getEnv = (key: string) => {
  const m = env.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return "";
  return m[1].replace(/^﻿/, "").replace(/[\r\n]+$/, "").trim().replace(/^"(.*)"$/, "$1");
};

const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
const BREVO_API_KEY = getEnv("BREVO_API_KEY");
const APP_URL = getEnv("NEXT_PUBLIC_APP_URL") || "https://healthwatch-global.com";

if (!SUPABASE_URL.includes("tqznwmpkokdzrszysbcm")) {
  throw new Error("Refusing to run: this does not look like the production project.");
}

const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
async function get(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

const RISK_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

const USERS = [
  { id: "df23024d-5605-46ac-9504-b6dd86466125", email: "iinnerre@gmail.com" },
  { id: "5983889e-4d4c-4b40-85c2-8f6e1e782285", email: "jalal.nourlil@pasteur.ma" },
];

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) throw new Error(`Brevo error: ${await res.text()}`);
}

for (const u of USERS) {
  const [regions, profile, log] = await Promise.all([
    get(`user_alert_regions?user_id=eq.${u.id}&select=region,min_risk`),
    get(`profiles?id=eq.${u.id}&select=alert_locale`),
    get(`outbreak_alert_log?user_id=eq.${u.id}&select=outbreak_id`),
  ]);

  const minRiskByRegion: Record<string, string> = Object.fromEntries(
    regions.map((r: { region: string; min_risk: string | null }) => [r.region, r.min_risk ?? "low"])
  );
  const seen = new Set(log.map((l: { outbreak_id: string }) => String(l.outbreak_id)));
  const regionList = Object.keys(minRiskByRegion);

  const active = await get(
    `outbreaks?active=eq.true&region=in.(${regionList.join(",")})&select=id,region,disease,disease_en,disease_ar,country,country_en,country_ar,risk_level,cases&limit=1000`
  );

  const qualifying = active.filter((o: { region: string; risk_level: string }) => {
    const minRisk = minRiskByRegion[o.region];
    if (!minRisk) return false;
    return (RISK_RANK[o.risk_level] ?? 0) >= (RISK_RANK[minRisk] ?? 0);
  });
  const backlog = qualifying.filter((o: { id: string }) => !seen.has(String(o.id)));

  if (backlog.length === 0) {
    console.log(`${u.email}: 0 en retard, rien à envoyer`);
    continue;
  }

  const sentAt = new Date().toISOString();
  const logRows = backlog.map((o: { id: string; risk_level: string; cases: number | null }) => ({
    user_id: u.id,
    outbreak_id: String(o.id),
    risk_level: o.risk_level,
    cases_at_alert: o.cases ?? null,
    sent_at: sentAt,
  }));
  const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/outbreak_alert_log?on_conflict=user_id,outbreak_id`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(logRows),
  });
  if (!upsertRes.ok) throw new Error(`outbreak_alert_log upsert failed for ${u.email}: ${upsertRes.status} ${await upsertRes.text()}`);

  const locale = (profile[0]?.alert_locale as string | null) ?? "en";
  const top = [...backlog]
    .sort((a: { risk_level: string }, b: { risk_level: string }) => (RISK_RANK[b.risk_level] ?? 0) - (RISK_RANK[a.risk_level] ?? 0))
    .slice(0, 10);

  const { subject, html } = buildSignupDigestEmail(
    locale,
    top,
    backlog.length,
    `${APP_URL}/${locale}`,
    `${APP_URL}/${locale}/account#regional-alerts`
  );

  await sendEmail(u.email, subject, html);
  console.log(`${u.email}: envoyé — ${backlog.length} foyers en retard (locale=${locale}), sujet: "${subject}"`);

  await new Promise((r) => setTimeout(r, 200));
}
