import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  Shield, Users, Activity, RefreshCw,
  TrendingUp, DollarSign, Zap, Bell, Link2,
} from "lucide-react";
import Link from "next/link";
import AdminOutbreakTable from "@/components/AdminOutbreakTable";
import AdminSyncButton from "@/components/AdminSyncButton";
import AdminBroadcastButton from "@/components/AdminBroadcastButton";
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

      {/* ── Sync ────────────────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-blue-400" />
          <h2 className="text-white font-semibold">Synchronisation WHO</h2>
        </div>
        <p className="text-sm text-gray-400">
          Déclenche manuellement le cron de synchronisation des données OMS (automatique 1x/jour à 6h UTC).
        </p>
        <AdminSyncButton />
      </div>

      {/* ── PH launch broadcast ─────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-[#ff6154]/30 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[#ff6154] text-lg">🚀</span>
          <h2 className="text-white font-semibold">Email Product Hunt Launch</h2>
          <span className="text-xs text-gray-500 ml-1">— 24 juin 2026</span>
        </div>
        <p className="text-sm text-gray-400">
          Envoie l&apos;email de lancement PH à tous les inscrits. Fais d&apos;abord un <strong className="text-gray-300">dry run</strong> pour vérifier le nombre de destinataires.
          <br />
          <span className="text-yellow-500">⚠️ Mettre à jour <code className="text-yellow-400">PH_URL</code> dans <code className="text-yellow-400">lib/ph-launch-email.ts</code> avant d&apos;envoyer.</span>
        </p>
        <AdminBroadcastButton />
      </div>

      {/* ── Pilot invites ───────────────────────────────────────────────────── */}
      <AdminPilotInviteForm locale={locale} />

      {/* ── Outbreaks ───────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-white font-semibold text-lg">Épidémies</h2>
        <AdminOutbreakTable initial={(outbreaks as Outbreak[]) ?? []} />
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
                <th className="px-4 py-3 text-left">Trial jusqu'au</th>
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
