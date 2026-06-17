import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf-8");
function getEnv(key) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return "";
  return m[1].replace(/^﻿/, "").replace(/[\r\n]+$/, "").trim();
}

const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");

async function fetchTable(table, select) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${select}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

const [profiles, subscriptions, pushSubs, outbreaks, alertRegions] = await Promise.all([
  fetchTable("profiles", "id,plan,created_at"),
  fetchTable("subscriptions", "id,active,created_at,region,locale"),
  fetchTable("push_subscriptions", "id,created_at"),
  fetchTable("outbreaks", "id,active"),
  fetchTable("user_alert_regions", "user_id"),
]);

const PLAN_MRR = { starter: 29, pro: 29, enterprise: 299, free: 0 };

const now = new Date();
const ago7 = new Date(now.getTime() - 7 * 86400_000).toISOString();
const ago14 = new Date(now.getTime() - 14 * 86400_000).toISOString();
const ago30 = new Date(now.getTime() - 30 * 86400_000).toISOString();

const planCounts = {};
for (const p of profiles) {
  const plan = p.plan ?? "free";
  planCounts[plan] = (planCounts[plan] ?? 0) + 1;
}

const paidCount = (planCounts.starter ?? 0) + (planCounts.pro ?? 0) + (planCounts.enterprise ?? 0);
const userCount = profiles.length;
const mrr = Object.entries(planCounts).reduce((sum, [plan, count]) => sum + (PLAN_MRR[plan] ?? 0) * count, 0);

const new7 = profiles.filter(p => p.created_at >= ago7).length;
const new14 = profiles.filter(p => p.created_at >= ago14).length;
const new30 = profiles.filter(p => p.created_at >= ago30).length;

const activeOutbreaks = outbreaks.filter(o => o.active).length;
const alertUsers = new Set(alertRegions.map(r => r.user_id)).size;
const activeSubs = subscriptions.filter(s => s.active).length;

console.log(JSON.stringify({
  userCount,
  planCounts,
  paidCount,
  mrr,
  conversionRatePct: userCount > 0 ? +((paidCount / userCount) * 100).toFixed(1) : 0,
  signups: { last7d: new7, last14d: new14, last30d: new30 },
  outbreaks: { total: outbreaks.length, active: activeOutbreaks },
  digestSubscribers: { total: subscriptions.length, active: activeSubs },
  digestSubsByRegion: subscriptions.reduce((acc, s) => { acc[s.region] = (acc[s.region]??0)+1; return acc; }, {}),
  pushSubscribers: pushSubs.length,
  alertRegionUsers: alertUsers,
  allProfileSignupDates: profiles.map(p => p.created_at).sort(),
  pushSignupDates: pushSubs.map(p => p.created_at).sort(),
}, null, 2));
