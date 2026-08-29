import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin";
import { createClient as createServiceClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import {
  Shield, Users, Activity, RefreshCw,
  TrendingUp, DollarSign, Zap, Bell, Link2,
  CheckCircle, XCircle, BarChart2, AlertTriangle, ExternalLink, Clock,
} from "lucide-react";
import Link from "next/link";
import AdminOutbreakTable from "@/components/AdminOutbreakTable";
import AdminSyncButton from "@/components/AdminSyncButton";
import AdminQCFixButton from "@/components/AdminQCFixButton";
import AdminPilotInviteForm from "@/components/AdminPilotInviteForm";
import AdminExtendTrialButton from "@/components/AdminExtendTrialButton";
import DataStatusWidget from "@/components/DataStatusWidget";
import { hasRealAdmin1 } from "@/lib/outbreaks";
import type { Outbreak } from "@/lib/outbreaks";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin — HealthWatch Global",
  robots: { index: false, follow: false },
};

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

// ── MRR estimate (monthly prices in EUR) ─────────────────────────────────────
const PLAN_MRR: Record<string, number> = {
  starter:    29, // legacy — treated as Pro
  pro:        29,
  team:       149,
  enterprise: 299,
  free:       0,
};

// Monthly-equivalent for an annual subscription (annual price / 12), read from
// the same figures documented in app/api/checkout/route.ts:13 (EUR: Pro €249/yr,
// Team €1 290/yr). Added 2026-08-18: `realMrr` previously priced every paying
// Pro account at €29/mo flat, even one that actually bought the €249/yr plan
// (~€20.75/mo) — a ~40% overstatement of that account's true monthly value.
// `stripe_billing_period` (profiles column, set by the webhook from checkout's
// own subscription metadata) is null for any subscriber who converted before
// 2026-08-18 — those fall back to the monthly figure below rather than being
// guessed, same as PLAN_MRR itself does for an unrecognized plan key.
const PLAN_MRR_ANNUAL: Record<string, number> = {
  starter:    249 / 12,
  pro:        249 / 12,
  team:       1290 / 12,
  enterprise: 299 * 12 / 12, // no annual Enterprise SKU exists yet — same as monthly
  free:       0,
};

// listUsers returns one page at a time (default/max 1000 users per page). Reading
// only page 1 silently drops every user past the first 1000 from the name lookup
// below — a coverage gap that grows invisibly with the user base. Page through
// until a short page signals the end. Names live only in auth user_metadata
// (profiles has no name column), so this stays the right source; we just stop
// truncating it.
async function fetchAllAuthUsers(admin: SupabaseClient): Promise<User[]> {
  const perPage = 1000;
  const all: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.warn("[admin] listUsers page", page, ":", error.message);
      break;
    }
    const users = data?.users ?? [];
    all.push(...users);
    if (users.length < perPage) break;
  }
  return all;
}

// ─── Mini stat card ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  accent = "text-gray-400",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className={`flex items-center gap-2 text-sm mb-1 ${accent}`}>
        {icon}
        <span className="text-gray-400">{label}</span>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Plan distribution bar ────────────────────────────────────────────────────

function PlanBar({
  counts,
  total,
}: {
  counts: Record<string, number>;
  total: number;
}) {
  const plans = [
    { key: "pro",        label: "Pro",        color: "bg-red-500"    },
    { key: "starter",    label: "Legacy",     color: "bg-gray-500"   },
    { key: "enterprise", label: "Enterprise", color: "bg-purple-500" },
    { key: "free",       label: "Free",       color: "bg-gray-600"   },
  ];

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden gap-px bg-gray-800">
        {plans.map(({ key, color }) => {
          const pct = total > 0 ? (counts[key] ?? 0) / total : 0;
          if (pct === 0) return null;
          return (
            <div
              key={key}
              className={`${color} transition-all`}
              style={{ width: `${pct * 100}%` }}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {plans.map(({ key, label, color }) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className={`inline-block w-2.5 h-2.5 rounded-sm ${color}`} />
            {label}
            <span className="text-white font-medium">{counts[key] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/login`);
  if (!isAdmin(user.email)) redirect(`/${locale}`);

  const admin = createServiceClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  const now        = new Date();
  const ago7       = new Date(now.getTime() - 7  * 86400_000).toISOString();
  const ago30      = new Date(now.getTime() - 30 * 86400_000).toISOString();

  const [
    { data: outbreaks },
    { data: subscribers },
    { data: profiles },
    { data: alertRegions },
    { data: slackUsers },
    authUsers,
    { data: productEvents },
  ] = await Promise.all([
    admin.from("outbreaks").select("*").order("date", { ascending: false }),
    admin.from("subscriptions").select("*").order("created_at", { ascending: false }),
    admin.from("profiles").select("id, email, plan, created_at, trial_ends_at, stripe_subscription_id, stripe_has_payment_method, stripe_billing_period").order("created_at", { ascending: false }),
    admin.from("user_alert_regions").select("user_id"),
    admin.from("profiles").select("id").not("slack_webhook_url", "is", null),
    fetchAllAuthUsers(admin),
    // Capture-only since 2026-07-23 (migration 20260723160000_product_events.sql) — first
    // read path. Capped at 200 most recent rows: enough for the 30j aggregate + a recent
    // feed without an unbounded query as volume grows.
    admin.from("product_events").select("id, user_id, action, metadata, created_at").gte("created_at", ago30).order("created_at", { ascending: false }).limit(200),
  ]);

  const nameByEmail: Record<string, string> = {};
  for (const u of authUsers ?? []) {
    const meta = u.user_metadata ?? {};
    const name = meta.full_name || meta.name || meta.display_name || null;
    if (name && u.email) nameByEmail[u.email] = name;
  }

  // ── Derived metrics ────────────────────────────────────────────────────────
  const activeCount = outbreaks?.filter((o) => o.active).length ?? 0;
  const userCount   = profiles?.length ?? 0;

  // Plan counts
  const planCounts: Record<string, number> = { free: 0, starter: 0, pro: 0, team: 0, enterprise: 0 };
  for (const p of profiles ?? []) {
    const plan = p.plan ?? "free";
    planCounts[plan] = (planCounts[plan] ?? 0) + 1;
  }

  const paidCount = (planCounts.starter ?? 0) + (planCounts.pro ?? 0) + (planCounts.team ?? 0) + (planCounts.enterprise ?? 0);
  const convRate  = userCount > 0 ? ((paidCount / userCount) * 100).toFixed(1) : "0";

  const mrr = Object.entries(planCounts).reduce(
    (sum, [plan, count]) => sum + (PLAN_MRR[plan] ?? 0) * count,
    0
  );

  // Growth
  const new7  = profiles?.filter((p) => p.created_at && p.created_at >= ago7).length  ?? 0;
  const new30 = profiles?.filter((p) => p.created_at && p.created_at >= ago30).length ?? 0;

  // Alert feature usage
  const alertUserCount = new Set(alertRegions?.map((r: { user_id: string }) => r.user_id)).size;
  const slackCount     = slackUsers?.length ?? 0;

  // Paying vs trial distinction
  // "admin_override" is a synthetic sentinel (see migrations 20260630120000/130000) that grants
  // the founder's own account permanent Pro without a real Stripe subscription — exclude it from
  // any metric meant to reflect actual paying customers.
  //
  // That sentinel doesn't cover every founder account, though: found 2026-08-29 when David asked
  // "why does MRR réel show €29 — was there a payment?" after testing the real Stripe checkout
  // flow himself on 2026-08-26 (a genuine `sub_...` id, `stripe_has_payment_method: true`, still
  // `trialing`, `amount_paid: 0` on its only invoice) — isRealStripeSub only screens out the
  // literal "admin_override" string, so a real test subscription under his own email passed
  // straight through and inflated realMrr/payingCount with zero dollars actually charged. Any
  // ADMIN_EMAILS account is excluded here too, regardless of which Stripe path it went through.
  const isRealStripeSub = (p: { stripe_subscription_id?: string | null; email?: string | null }) =>
    !!p.stripe_subscription_id && p.stripe_subscription_id !== "admin_override" && !isAdmin(p.email ?? undefined);
  // "Paying" used to mean only `isRealStripeSub` — but checkout sets
  // stripe_subscription_id the instant checkout completes, even with
  // `payment_method_collection: if_required` and zero card on file (see
  // app/api/checkout/route.ts:150-152). Found 2026-08-17/18:
  // otitamorgan@gmail.com converted 2026-08-12, `trialing`, no payment
  // method, trial_settings.end_behavior=cancel → scheduled to silently
  // cancel 2026-08-26 without ever being charged. Counting that as "paying"
  // let the go/no-go payment criterion (below) go green on €0 collected.
  // stripe_has_payment_method (migration 20260818200000) is the corrected
  // signal — see syncPaymentMethodFlag in app/api/webhook/route.ts for how
  // it's kept current.
  const isPayingCustomer = (p: { stripe_subscription_id?: string | null; stripe_has_payment_method?: boolean | null }) =>
    isRealStripeSub(p) && !!p.stripe_has_payment_method;
  const stripeSubCount = profiles?.filter(isRealStripeSub).length ?? 0;
  const payingCount    = profiles?.filter(isPayingCustomer).length ?? 0;
  // Stripe subscriptions that exist but have no payment method attached —
  // the exact Morgan Otita shape. Distinct from `trialActive` below (which
  // only ever counted DB-only trials, `!stripe_subscription_id`) — this is
  // the population that trialActive structurally could never see.
  const uncoveredStripeTrials = profiles?.filter((p) => isRealStripeSub(p) && !p.stripe_has_payment_method) ?? [];
  const next7          = new Date(now.getTime() + 7 * 86400_000).toISOString();
  const trialActive    = profiles?.filter((p) => p.plan !== "free" && !p.stripe_subscription_id && p.trial_ends_at && p.trial_ends_at > now.toISOString()) ?? [];
  const trialExpiring7 = trialActive.filter((p) => p.trial_ends_at! <= next7).length;
  const realMrr         = profiles?.filter(isPayingCustomer).reduce((sum, p) => {
    const table = p.stripe_billing_period === "annual" ? PLAN_MRR_ANNUAL : PLAN_MRR;
    return sum + (table[p.plan ?? "free"] ?? 0);
  }, 0) ?? 0;

  // ── Duplicate outbreak detection (same disease + country + admin1, active) ──
  // admin1 is part of the key because several sources are legitimately
  // sub-national: USDA APHIS publishes one HPAI H5N1 row per state, so
  // Avian Influenza / United States / Idaho, / Texas and / Utah are three
  // distinct events, not one event stored three times. Keying on
  // disease + country alone flagged them as a duplicate every day
  // (2026-08-22), which trains the reader to dismiss this panel — and a
  // duplicate detector nobody reads is worse than none. Rows with no admin1
  // still collapse together under the empty string, which is the national
  // case this check was written for — hasRealAdmin1 folds the "~" sentinel
  // written by backfill-admin1 into that same national bucket, so a "~" row
  // and a null row for one country still count as duplicates of each other.
  const dupMap: Record<string, { id: string; date: string | null }[]> = {};
  for (const o of outbreaks ?? []) {
    if (!o.active) continue;
    const zone = hasRealAdmin1(o.admin1) ? o.admin1 : "";
    const key = `${o.disease}||${o.country_en ?? o.country}||${zone}`;
    if (!dupMap[key]) dupMap[key] = [];
    dupMap[key].push({ id: o.id, date: o.date ?? null });
  }
  const duplicates = Object.entries(dupMap)
    .filter(([, entries]) => entries.length > 1)
    .map(([key, entries]) => {
      const [disease, country, admin1] = key.split("||");
      return { disease, country, admin1, entries };
    });

  // ── Retention metrics (from already-fetched authUsers) ────────────────────
  // "Last known activity" = max(last_sign_in_at, latest product_events.created_at for that
  // user). last_sign_in_at only moves on re-authentication — a still-valid session/JWT never
  // updates it even if the user is actively browsing. product_events is an OR on top of it, not
  // a replacement: it only captures dashboard_view / outbreak_detail_view / pricing_page_view
  // since 2026-07-23/24, so a user with no tracked event (e.g. signed up before tracking, or
  // only used untracked surfaces) still falls back to last_sign_in_at alone.
  const latestEventByUser: Record<string, number> = {};
  for (const e of productEvents ?? []) {
    if (!e.user_id || !e.created_at) continue;
    const t = new Date(e.created_at).getTime();
    if (!latestEventByUser[e.user_id] || t > latestEventByUser[e.user_id]) latestEventByUser[e.user_id] = t;
  }
  const lastActivity = (u: { id: string; last_sign_in_at?: string | null }): number | null => {
    const signIn = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : null;
    const event   = latestEventByUser[u.id] ?? null;
    if (signIn === null && event === null) return null;
    return Math.max(signIn ?? -Infinity, event ?? -Infinity);
  };
  // "Returned" = last known activity more than 2 days after created_at (not just signup ping)
  const returnedUsers = (authUsers ?? []).filter((u) => {
    if (!u.created_at) return false;
    const activity = lastActivity(u);
    if (activity === null) return false;
    return activity - new Date(u.created_at).getTime() > 2 * 86_400_000;
  });
  // Active in last 30 days
  const active30 = (authUsers ?? []).filter((u) => {
    const activity = lastActivity(u);
    return activity !== null && activity > now.getTime() - 30 * 86_400_000;
  });
  // Never returned (last known activity only at signup)
  const neverReturned = (authUsers ?? []).filter((u) => {
    if (!u.created_at) return true;
    const activity = lastActivity(u);
    if (activity === null) return true;
    return activity - new Date(u.created_at).getTime() < 60_000;
  });

  // ── Product usage events (product_events, capture-only since 2026-07-23) ──
  const emailById: Record<string, string> = {};
  for (const p of profiles ?? []) if (p.email) emailById[p.id] = p.email;

  const ACTION_LABELS: Record<string, string> = {
    dashboard_view: "Vue dashboard",
    pricing_page_view: "Vue pricing",
    outbreak_detail_view: "Détail foyer",
    csv_export: "Export CSV",
    pdf_report_download: "Rapport PDF",
  };

  function eventDetail(action: string, metadata: Record<string, unknown> | null): string {
    if (!metadata) return "—";
    if (action === "outbreak_detail_view" && metadata.outbreak_id) return `${String(metadata.outbreak_id).slice(0, 8)}…`;
    if (action === "csv_export" && metadata.format) return String(metadata.format);
    if (action === "pdf_report_download" && metadata.region) return String(metadata.region);
    if (metadata.locale) return String(metadata.locale);
    return "—";
  }

  function relativeTime(iso: string): string {
    const mins = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
    if (mins < 60) return `il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `il y a ${hours}h`;
    return `il y a ${Math.floor(hours / 24)}j`;
  }

  const productEventsList = productEvents ?? [];
  const eventUserCount = new Set(productEventsList.map((e) => e.user_id)).size;
  const actionCounts: Record<string, number> = {};
  for (const e of productEventsList) actionCounts[e.action] = (actionCounts[e.action] ?? 0) + 1;
  const topAction = Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0];
  const recentEvents = productEventsList.slice(0, 25);

  // J+30 Go/No-Go checklist
  // "Réponse institutionnelle" (email) reste affichée plus bas pour info mais n'est plus
  // comptabilisée : le canal cold email institutionnel a été fermé, ce critère ne pourra
  // structurellement plus jamais passer au vert.
  //
  // `pipeline` retiré du dénominateur automatisé le 2026-08-18 : il est codé
  // en dur à `false` depuis sa création (jugement manuel de David sur une
  // discussion pilote active, aucun signal produit ne peut l'automatiser
  // honnêtement), ce qui rendait « ≥3/4 cochées » silencieusement équivalent
  // à « les 3 autres, toutes vertes » — le seuil affiché mentait sur ce qu'il
  // fallait réellement atteindre. Affiché séparément plus bas comme jugement
  // manuel plutôt que comme un 4e critère automatisé qui ne peut jamais
  // passer.
  const goNoGo = {
    retention:  returnedUsers.length >= 5,   // ≥5 users returned after 2+ days
    active30:   active30.length >= 3,         // ≥3 active in last 30 days
    paying:     payingCount >= 1,             // ≥1 Stripe subscription with a real payment method
  } as const;
  const automatedScore = Object.values(goNoGo).filter(Boolean).length;

  return (
    <div className="max-w-7xl mx-auto space-y-8 py-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-red-500" />
          <h1 className="text-2xl font-bold text-white">Panel Admin</h1>
        </div>
        <Link
          href={`/${locale}`}
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          ← Tableau de bord
        </Link>
      </div>

      {/* ── Revenue KPIs ───────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Revenus</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="MRR réel (Stripe)"
            value={`€${realMrr.toFixed(realMrr % 1 === 0 ? 0 : 2)}`}
            sub={`Compte un moyen de paiement réel · MRR potentiel (tous plans) : €${mrr.toLocaleString("fr")}`}
            icon={<DollarSign className="w-4 h-4" />}
            accent="text-green-400"
          />
          <StatCard
            label="Payants (avec moyen de paiement)"
            value={payingCount}
            sub={
              uncoveredStripeTrials.length > 0
                ? `${stripeSubCount} abonné(s) Stripe au total — ${uncoveredStripeTrials.length} sans carte, à échéance`
                : `${trialActive.length} en essai (hors Stripe) · ${convRate}% conv. totale`
            }
            icon={<Zap className="w-4 h-4" />}
            accent={uncoveredStripeTrials.length > 0 ? "text-orange-400" : "text-yellow-400"}
          />
          <StatCard
            label="Essais expirant (7j)"
            value={trialExpiring7}
            sub={`Nouveaux inscrits : ${new7} (7j) · ${new30} (30j)`}
            icon={<TrendingUp className="w-4 h-4" />}
            accent={trialExpiring7 > 0 ? "text-orange-400" : "text-blue-400"}
          />
          <StatCard
            label="Total utilisateurs"
            value={userCount}
            sub={`${subscribers?.length ?? 0} abonnés digest`}
            icon={<Users className="w-4 h-4" />}
            accent="text-gray-400"
          />
        </div>
      </div>

      {/* ── Plan distribution ──────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Répartition des plans</h2>
        <PlanBar counts={planCounts} total={userCount} />
      </div>

      {/* ── Feature adoption ──────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Adoption des features</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard
            label="Alertes régionales"
            value={alertUserCount}
            sub="utilisateurs abonnés"
            icon={<Bell className="w-4 h-4" />}
            accent="text-red-400"
          />
          <StatCard
            label="Intégration Slack"
            value={slackCount}
            sub="webhooks connectés"
            icon={<Link2 className="w-4 h-4" />}
            accent="text-purple-400"
          />
          <StatCard
            label="Épidémies actives"
            value={activeCount}
            sub={`${outbreaks?.length ?? 0} au total`}
            icon={<Activity className="w-4 h-4" />}
            accent="text-orange-400"
          />
        </div>
      </div>

      {/* ── Product usage (product_events) ─────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          Activité produit (30 derniers jours)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard
            label="Événements"
            value={productEventsList.length}
            sub={productEventsList.length >= 200 ? "200+ (limite d'affichage)" : "product_events"}
            icon={<Zap className="w-4 h-4" />}
            accent="text-blue-400"
          />
          <StatCard
            label="Utilisateurs actifs"
            value={eventUserCount}
            sub="au moins 1 événement"
            icon={<Users className="w-4 h-4" />}
            accent="text-green-400"
          />
          <StatCard
            label="Action la plus fréquente"
            value={topAction ? (ACTION_LABELS[topAction[0]] ?? topAction[0]) : "—"}
            sub={topAction ? `${topAction[1]} fois` : "aucun événement"}
            icon={<Activity className="w-4 h-4" />}
            accent="text-purple-400"
          />
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                <th className="px-4 py-3 text-left">Utilisateur</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Détail</th>
                <th className="px-4 py-3 text-left">Quand</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {recentEvents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500 text-sm">
                    Aucun événement sur cette période.
                  </td>
                </tr>
              ) : (
                recentEvents.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-white">{emailById[e.user_id] ?? `${e.user_id.slice(0, 8)}…`}</td>
                    <td className="px-4 py-3 text-gray-300">{ACTION_LABELS[e.action] ?? e.action}</td>
                    <td className="px-4 py-3 text-gray-400">{eventDetail(e.action, e.metadata as Record<string, unknown> | null)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{relativeTime(e.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Retention & J+30 checklist ─────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2">
          <BarChart2 className="w-3.5 h-3.5" />
          Rétention & Activation
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Utilisateurs revenus"
            value={returnedUsers.length}
            sub="login > 2j après inscription"
            icon={<TrendingUp className="w-4 h-4" />}
            accent={returnedUsers.length >= 5 ? "text-green-400" : "text-orange-400"}
          />
          <StatCard
            label="Actifs 30j"
            value={active30.length}
            sub="au moins 1 session ce mois"
            icon={<Activity className="w-4 h-4" />}
            accent={active30.length >= 3 ? "text-green-400" : "text-orange-400"}
          />
          <StatCard
            label="Jamais revenus"
            value={neverReturned.length}
            sub="login unique au signup"
            icon={<Users className="w-4 h-4" />}
            accent={neverReturned.length > (authUsers?.length ?? 0) / 2 ? "text-red-400" : "text-gray-400"}
          />
          <StatCard
            label="Taux activation"
            value={authUsers?.length ? `${((returnedUsers.length / authUsers.length) * 100).toFixed(0)}%` : "—"}
            sub={`${returnedUsers.length} / ${authUsers?.length ?? 0} inscrits`}
            icon={<Zap className="w-4 h-4" />}
            accent="text-blue-400"
          />
        </div>

        {/* J+30 Go/No-Go */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Checklist J+30 — Go / No-Go</p>
          <div className="space-y-2">
            {[
              { ok: goNoGo.retention, label: `≥5 utilisateurs revenus après J+2`, value: `${returnedUsers.length} actuellement` },
              { ok: goNoGo.active30,  label: `≥3 utilisateurs actifs sur 30 jours`, value: `${active30.length} actuellement` },
              {
                ok: goNoGo.paying,
                label: `≥1 abonnement Stripe avec moyen de paiement réel`,
                value: uncoveredStripeTrials.length > 0
                  ? `${payingCount} actuellement — ${uncoveredStripeTrials.length} de plus sans carte, ne compte pas`
                  : `${payingCount} actuellement`,
              },
            ].map(({ ok, label, value }) => (
              <div key={label} className="flex items-start gap-3">
                {ok
                  ? <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                  : <XCircle    className="w-4 h-4 text-red-400/60 shrink-0 mt-0.5" />
                }
                <div>
                  <p className={`text-sm ${ok ? "text-gray-300" : "text-gray-500"}`}>{label}</p>
                  <p className="text-xs text-gray-600">{value}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600 pt-2 border-t border-gray-800">
            Score automatisé : {automatedScore}/3 → ≥2/3 continuer sans changer de cap · &lt;2/3 diagnostiquer l&apos;activation.
            Le pilote actif ci-dessous est un jugement manuel, pas un 4e critère automatisé — il ne peut structurellement
            jamais être calculé depuis les données du produit.
          </p>
          <div className="flex items-start gap-3 pt-2 border-t border-gray-800">
            <div className="w-4 h-4 shrink-0 mt-0.5 flex items-center justify-center text-gray-500 font-bold">?</div>
            <div>
              <p className="text-sm text-gray-400">Pilote en discussion active (jugement manuel de David)</p>
              <p className="text-xs text-gray-600">non automatisable — aucun signal produit ne distingue une vraie discussion pilote</p>
            </div>
          </div>
          {/* Snapshot manuel — pas de source live dans ce repo pour la prospection institutionnelle
              (suivie dans marketing/institutional-prospects-log.md, pas en base). À remettre à jour
              à la main si ce panneau est relu après une nouvelle vague de relances. */}
          <div className="flex items-start gap-3 pt-2 border-t border-gray-800">
            <div className="w-4 h-4 shrink-0 mt-0.5 flex items-center justify-center text-gray-500">·</div>
            <div>
              <p className="text-sm text-gray-400">Prospection institutionnelle (hors scoring)</p>
              <p className="text-xs text-gray-600">200 prospectés · 180 envoyés · 170 délivrés · 10 bounces · 0 réponse — chiffres au 18/08</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sync ────────────────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-blue-400" />
          <h2 className="text-white font-semibold">Synchronisation des sources</h2>
        </div>
        <p className="text-sm text-gray-400">
          Déclenche manuellement la synchronisation WHO, ECDC, PAHO et données régionales (automatique plusieurs fois/jour).
        </p>
        <AdminSyncButton />
      </div>

      {/* ── Data source status ──────────────────────────────────────────────── */}
      <DataStatusWidget locale={locale} />

      {/* ── QC Fixes ────────────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-amber-800/30 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h2 className="text-white font-semibold">Correctifs QC</h2>
        </div>
        <p className="text-sm text-gray-400">
          Anomalies détectées par le cron qualité — appliquer manuellement si les chiffres sources ont été vérifiés.
        </p>
        <AdminQCFixButton />
      </div>

      {/* ── Pilot invites ───────────────────────────────────────────────────── */}
      <AdminPilotInviteForm locale={locale} />

      {/* ── Outbreaks ───────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-white font-semibold text-lg">Épidémies</h2>
        <AdminOutbreakTable initial={(outbreaks as Outbreak[]) ?? []} />
      </div>

      {/* ── Duplicate detection ─────────────────────────────────────────────── */}
      <div className={`bg-gray-900 border rounded-xl p-5 space-y-3 ${duplicates.length > 0 ? "border-orange-500/40" : "border-gray-800"}`}>
        <div className="flex items-center gap-2">
          {duplicates.length > 0
            ? <AlertTriangle className="w-4 h-4 text-orange-400" />
            : <CheckCircle   className="w-4 h-4 text-green-400" />}
          <h2 className="text-white font-semibold">
            Doublons potentiels
            {duplicates.length > 0 && (
              <span className="ml-2 text-xs font-normal text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">
                {duplicates.length} détecté{duplicates.length > 1 ? "s" : ""}
              </span>
            )}
          </h2>
        </div>
        {duplicates.length === 0 ? (
          <p className="text-sm text-green-400">✓ Aucun doublon actif détecté (même maladie + même pays + même zone).</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">Foyers actifs partageant la même maladie, le même pays et la même zone — vérifier et désactiver le doublon dans Supabase.</p>
            {duplicates.map(({ disease, country, admin1, entries }) => (
              <div key={`${disease}-${country}-${admin1}`} className="bg-orange-950/30 border border-orange-500/20 rounded-lg px-4 py-3 flex flex-col gap-1.5">
                <p className="text-sm font-semibold text-orange-300">{disease} — {country}{admin1 ? ` · ${admin1}` : ""}</p>
                <div className="flex flex-wrap gap-2">
                  {entries.map(e => (
                    <Link
                      key={e.id}
                      href={`/${locale}/outbreak/${e.id}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white bg-gray-800 border border-gray-700 px-2 py-1 rounded transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      ID {e.id.slice(0, 8)}…
                      {e.date && <span className="text-gray-600 ml-1">{e.date}</span>}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Users ───────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-white font-semibold text-lg">Utilisateurs ({userCount})</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                <th className="px-4 py-3 text-left">Nom</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-left">Statut</th>
                <th className="px-4 py-3 text-left">Trial jusqu&apos;au</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {profiles?.map((p) => {
                const trialDate = p.trial_ends_at ? new Date(p.trial_ends_at) : null;
                const trialExpired = trialDate && trialDate < now;
                return (
                  <tr key={p.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-gray-300">{(p.email ? nameByEmail[p.email] : null) ?? "—"}</td>
                    <td className="px-4 py-3 text-white">{p.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.plan === "pro" ? "bg-red-500/10 text-red-400"
                        : p.plan === "starter" ? "bg-blue-500/10 text-blue-400"
                        : p.plan === "team" ? "bg-amber-500/10 text-amber-400"
                        : p.plan === "enterprise" ? "bg-purple-500/10 text-purple-400"
                        : "bg-gray-700 text-gray-400"
                      }`}>
                        {p.plan ?? "free"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.stripe_subscription_id ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">💳 Payant</span>
                      ) : p.plan !== "free" ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${trialExpired ? "bg-red-500/10 text-red-400" : "bg-blue-500/10 text-blue-400"}`}>
                          {trialExpired ? "Expiré" : "Essai"}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-500">Gratuit</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-xs ${trialExpired ? "text-red-400" : "text-gray-400"}`}>
                      {trialDate ? trialDate.toLocaleDateString("fr") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {p.email && !p.stripe_subscription_id && (
                        <AdminExtendTrialButton email={p.email} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Digest subscribers ──────────────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-white font-semibold text-lg">
          Abonnés digest ({subscribers?.length ?? 0})
        </h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Région</th>
                <th className="px-4 py-3 text-left">Locale</th>
                <th className="px-4 py-3 text-center">Actif</th>
                <th className="px-4 py-3 text-left">Inscrit le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {subscribers?.map((s) => (
                <tr key={s.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 text-white">{s.email}</td>
                  <td className="px-4 py-3 text-gray-400 capitalize">{s.region}</td>
                  <td className="px-4 py-3 text-gray-400 uppercase">{s.locale}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        s.active
                          ? "bg-green-500/10 text-green-400"
                          : "bg-gray-700 text-gray-500"
                      }`}
                    >
                      {s.active ? "Oui" : "Non"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {s.created_at
                      ? new Date(s.created_at).toLocaleDateString("fr")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
