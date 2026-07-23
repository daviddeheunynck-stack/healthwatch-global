import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import { resolvedPlan } from "@/lib/resolved-plan";
import SettingsTabs from "@/components/SettingsTabs";

const PAGE_TITLE: Record<string, string> = {
  en: "Settings", fr: "Paramètres", es: "Configuración",
  ar: "الإعدادات", id: "Pengaturan",
};
const PAGE_SUB: Record<string, string> = {
  en: "Manage your alerts, notifications and integrations",
  fr: "Gérez vos alertes, notifications et intégrations",
  es: "Gestiona tus alertas, notificaciones e integraciones",
  ar: "إدارة التنبيهات والإشعارات والتكاملات",
  id: "Kelola peringatan, notifikasi, dan integrasi Anda",
};

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = searchParams ? await searchParams : {};
  const initialTab = typeof sp.tab === "string" ? sp.tab : "alerts";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, trial_ends_at, stripe_subscription_id, disease_watchlist")
    .eq("id", user.id)
    .single();

  if (resolvedPlan(profile) === "free") redirect(`/${locale}/pricing`);

  const diseaseWatchlist = (profile?.disease_watchlist as string[] | null) ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-gray-700/40 border border-gray-600/30 flex items-center justify-center shrink-0">
          <Settings className="w-6 h-6 text-gray-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{PAGE_TITLE[locale] ?? PAGE_TITLE.en}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{PAGE_SUB[locale] ?? PAGE_SUB.en}</p>
        </div>
      </div>

      <SettingsTabs
        locale={locale}
        userEmail={user.email ?? null}
        initialWatchlist={diseaseWatchlist}
        initialTab={initialTab}
      />
    </div>
  );
}
