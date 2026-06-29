import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  Shield, Users, Activity, RefreshCw,
  TrendingUp, DollarSign, Zap, Bell, Link2,
  CheckCircle, XCircle, BarChart2, AlertTriangle, ExternalLink,
} from "lucide-react";
import Link from "next/link";
import AdminOutbreakTable from "@/components/AdminOutbreakTable";
import AdminSyncButton from "@/components/AdminSyncButton";
import AdminQCFixButton from "@/components/AdminQCFixButton";
import AdminPilotInviteForm from "@/components/AdminPilotInviteForm";
import AdminExtendTrialButton from "@/components/AdminExtendTrialButton";
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
    { data: { users: authUsers } },
  ] = await Promise.all([
    admin.from("outbreaks").select("*").order("date", { ascending: false }),
    admin.from("subscriptions").select("*").order("created_at", { ascending: false }),
    admin.from("profiles").select("id, email, plan, created_at, trial_ends_at, stripe_subscription_id").order("created_at", { ascending: false }),
    admin.from("user_alert_regions").select("user_id"),
    admin.from("profiles").select("id").not("slack_webhook_url", "is", null),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
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
  const payingCount    = profiles?.filter((p) => p.stripe_subscription_id).length ?? 0;
  const next7          = new Date(now.getTime() + 7 * 86400_000).toISOString();
  const trialActive    = profiles?.filter((p) => p.plan !== "free" && !p.stripe_subscription_id && p.trial_ends_at && p.trial_ends_at > now.toISOString()) ?? [];
  const trialExpiring7 = trialActive.filter((p) => p.trial_ends_at! <= next7).length;
  const realMrr        = profiles?.filter((p) => p.stripe_subscription_id).reduce((sum, p) => sum + (PLAN_MRR[p.plan ?? "free"] ?? 0), 0) ?? 0;

  // ── Duplicate outbreak detection (same disease + country, both active) ──────
  const dupMap: Record<string, { id: string; date: string | null }[]> = {};
  for (const o of outbreaks ?? []) {
    if (!o.active) continue;
    const key = `${o.disease}||${o.country_en ?? o.country}`;
    if (!dupMap[key]) dupMap[key] = [];
    dupMap[key].push({ id: o.id, date: o.date ?? null });
  }
  const duplicates = Object.entries(dupMap)
    .filter(([, entries]) => entries.length > 1)
    .map(([key, entries]) => {
      const [disease, country] = key.split("||");
      return { disease, country, entries };
    });

  // ── Retention metrics (from already-fetched authUsers) ────────────────────
  // "Returned" = last_sign_in_at more than 2 days after created_at (not just signup ping)
  const returnedUsers = (authUsers ?? []).filter((u) => {
    if (!u.last_sign_in_at || !u.created_at) return false;
    return new Date(u.last_sign_in_at).getTime() - new Date(u.created_at).getTime() > 2 * 86_400_000;
  });
  // Active in last 30 days
  const active30 = (authUsers ?? []).filter((u) =>
    u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() > now.getTime() - 30 * 86_400_000
  );
  // Never returned (signed in only at signup)
  const neverReturned = (authUsers ?? []).filter((u) => {
    if (!u.last_sign_in_at || !u.created_at) return true;
    return new Date(u.last_sign_in_at).getTime() - new Date(u.created_at).getTime() < 60_000;
  });

  // J+30 Go/No-Go checklist
  const goNoGo = {
    retention:  returnedUsers.length >= 5,   // ≥5 users returned after 2+ days
    active30:   active30.length >= 3,         // ≥3 active in last 30 days
    paying:     payingCount >= 1,             // ≥1 Stripe payment
    pipeline:   false,                        // manual — pilot active discussion
    response:   false,                        // manual — institutional email response
  } as const;

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
            value={`€${realMrr.toLocaleString("fr")}`}
            sub={`MRR potentiel : €${mrr.toLocaleString("fr")}`}
            icon={<DollarSign className="w-4 h-4" />}
            accent="text-green-400"
          />
          <StatCard
            label="Abonnés Stripe actifs"
            value={payingCount}
            sub={`${trialActive.length} en essai · ${convRate}% conv. totale`}
            icon={<Zap className="w-4 h-4" />}
            accent="text-yellow-400"
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
              { ok: goNoGo.paying,    label: `≥1 paiement Stripe actif`, value: `${payingCount} actuellement` },
              { ok: goNoGo.pipeline,  label: `≥1 pilot en discussion active (14 derniers jours)`, value: "à vérifier manuellement" },
              { ok: goNoGo.response,  label: `≥1 réponse parmi les emails institutionnels`, value: "à vérifier manuellement" },
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
            ≥4/5 cochées → continuer sans changer de cap · &lt;3/5 → diagnostiquer l&apos;activation
          </p>
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
          <p className="text-sm text-green-400">✓ Aucun doublon actif détecté (même maladie + même pays).</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">Foyers actifs partageant la même maladie et le même pays — vérifier et désactiver le doublon dans Supabase.</p>
            {duplicates.map(({ disease, country, entries }) => (
              <div key={`${disease}-${country}`} className="bg-orange-950/30 border border-orange-500/20 rounded-lg px-4 py-3 flex flex-col gap-1.5">
                <p className="text-sm font-semibold text-orange-300">{disease} — {country}</p>
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
