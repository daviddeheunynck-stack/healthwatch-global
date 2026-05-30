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
  starter:    49, // legacy — treated as Pro
  pro:        49,
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
  ] = await Promise.all([
    admin.from("outbreaks").select("*").order("date", { ascending: false }),
    admin.from("subscriptions").select("*").order("created_at", { ascending: false }),
    admin.from("profiles").select("id, email, plan, created_at").order("created_at", { ascending: false }),
    admin.from("user_alert_regions").select("user_id"),
    admin.from("profiles").select("id").not("slack_webhook_url", "is", null),
  ]);

  // ── Derived metrics ────────────────────────────────────────────────────────
  const activeCount = outbreaks?.filter((o) => o.active).length ?? 0;
  const userCount   = profiles?.length ?? 0;

  // Plan counts
  const planCounts: Record<string, number> = { free: 0, starter: 0, pro: 0, enterprise: 0 };
  for (const p of profiles ?? []) {
    const plan = p.plan ?? "free";
    planCounts[plan] = (planCounts[plan] ?? 0) + 1;
  }

  const paidCount = (planCounts.starter ?? 0) + (planCounts.pro ?? 0) + (planCounts.enterprise ?? 0);
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
            label="MRR estimé"
            value={`€${mrr.toLocaleString("fr")}`}
            sub="plans actifs × prix mensuel"
            icon={<DollarSign className="w-4 h-4" />}
            accent="text-green-400"
          />
          <StatCard
            label="Utilisateurs payants"
            value={paidCount}
            sub={`${convRate}% de conversion`}
            icon={<Zap className="w-4 h-4" />}
            accent="text-yellow-400"
          />
          <StatCard
            label="Nouveaux (7j)"
            value={new7}
            sub={`${new30} sur 30 jours`}
            icon={<TrendingUp className="w-4 h-4" />}
            accent="text-blue-400"
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
          Déclenche manuellement le cron de synchronisation des données OMS (automatique chaque jour à 6h).
        </p>
        <AdminSyncButton />
      </div>

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
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-left">Inscrit le</th>
                <th className="px-4 py-3 text-left">Ancienneté</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {profiles?.map((p) => {
                const daysAgo = p.created_at
                  ? Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400_000)
                  : null;
                return (
                  <tr key={p.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-white">{p.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.plan === "pro"
                            ? "bg-red-500/10 text-red-400"
                            : p.plan === "starter"
                            ? "bg-blue-500/10 text-blue-400"
                            : p.plan === "enterprise"
                            ? "bg-purple-500/10 text-purple-400"
                            : "bg-gray-700 text-gray-400"
                        }`}
                      >
                        {p.plan ?? "free"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {p.created_at
                        ? new Date(p.created_at).toLocaleDateString("fr")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {daysAgo !== null ? `J+${daysAgo}` : "—"}
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
