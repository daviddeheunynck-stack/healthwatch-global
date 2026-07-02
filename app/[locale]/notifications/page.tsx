import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import AlertsPageClient from "@/components/AlertsPageClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const TITLES: Record<string, string> = {
  en: "Your alerts — HealthWatch Global",
  fr: "Vos alertes — HealthWatch Global",
  es: "Tus alertas — HealthWatch Global",
  ar: "تنبيهاتك — HealthWatch Global",
  id: "Peringatan Anda — HealthWatch Global",
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: TITLES[locale] ?? TITLES.en, robots: { index: false, follow: false } };
}

export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const [{ data }, { data: profile }] = await Promise.all([
    supabase
      .from("alert_notifications")
      .select("id, type, title, body, outbreak_id, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("profiles")
      .select("plan, trial_ends_at, stripe_subscription_id")
      .eq("id", user.id)
      .single(),
  ]);

  const plan = profile?.plan ?? "free";
  const trialExpired =
    plan !== "free" &&
    !!profile?.trial_ends_at &&
    new Date(profile.trial_ends_at).getTime() < Date.now() &&
    !profile?.stripe_subscription_id;
  const isPaid = ["starter", "pro", "team", "enterprise"].includes(plan) && !trialExpired;

  return <AlertsPageClient locale={locale} initialNotifications={data ?? []} isPaid={isPaid} />;
}
