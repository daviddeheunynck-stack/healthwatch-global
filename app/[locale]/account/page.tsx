import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { User, Shield, Zap, Building2, Gift, ExternalLink } from "lucide-react";
import Link from "next/link";
import BillingPortalButton from "@/components/BillingPortalButton";
import SignOutButton from "@/components/SignOutButton";

const PLAN_META: Record<string, { label: string; color: string; iconName: string }> = {
  free:       { label: "Free",       color: "text-green-400 bg-green-500/10 border-green-500/20",    iconName: "gift"       },
  starter:    { label: "Starter",    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",       iconName: "zap"        },
  pro:        { label: "Pro",        color: "text-red-400 bg-red-500/10 border-red-500/20",          iconName: "shield"     },
  enterprise: { label: "Enterprise", color: "text-purple-400 bg-purple-500/10 border-purple-500/20", iconName: "building2"  },
};

const PLAN_ICONS: Record<string, React.ReactNode> = {
  gift:      <Gift className="w-4 h-4" />,
  zap:       <Zap className="w-4 h-4" />,
  shield:    <Shield className="w-4 h-4" />,
  building2: <Building2 className="w-4 h-4" />,
};

const LABELS: Record<string, Record<string, string>> = {
  fr: {
    title: "Mon compte",
    plan: "Formule actuelle",
    billing: "Facturation",
    manageBilling: "Gérer l'abonnement",
    manageDesc: "Modifier votre plan, mettre à jour votre moyen de paiement ou annuler via le portail Stripe sécurisé.",
    upgradeTo: "Passer à Pro",
    upgradeDesc: "Débloquez les chiffres exacts, les exports PDF, les alertes en temps réel et plus encore.",
    account: "Compte",
    email: "Adresse email",
    memberSince: "Membre depuis",
    logout: "Se déconnecter",
    backHome: "← Retour au tableau de bord",
  },
  en: {
    title: "My account",
    plan: "Current plan",
    billing: "Billing",
    manageBilling: "Manage subscription",
    manageDesc: "Change your plan, update your payment method or cancel via the secure Stripe portal.",
    upgradeTo: "Upgrade to Pro",
    upgradeDesc: "Unlock exact figures, PDF exports, real-time alerts and more.",
    account: "Account",
    email: "Email address",
    memberSince: "Member since",
    logout: "Sign out",
    backHome: "← Back to dashboard",
  },
  es: {
    title: "Mi cuenta",
    plan: "Plan actual",
    billing: "Facturación",
    manageBilling: "Gestionar suscripción",
    manageDesc: "Cambie su plan, actualice su método de pago o cancele a través del portal seguro de Stripe.",
    upgradeTo: "Actualizar a Pro",
    upgradeDesc: "Desbloquee cifras exactas, exportaciones PDF, alertas en tiempo real y más.",
    account: "Cuenta",
    email: "Dirección de correo",
    memberSince: "Miembro desde",
    logout: "Cerrar sesión",
    backHome: "← Volver al panel",
  },
  ar: {
    title: "حسابي",
    plan: "الخطة الحالية",
    billing: "الفوترة",
    manageBilling: "إدارة الاشتراك",
    manageDesc: "غيّر خطتك أو حدّث طريقة الدفع أو ألغِ الاشتراك عبر بوابة Stripe الآمنة.",
    upgradeTo: "الترقية إلى Pro",
    upgradeDesc: "افتح الأرقام الدقيقة وتصدير PDF والتنبيهات الفورية والمزيد.",
    account: "الحساب",
    email: "البريد الإلكتروني",
    memberSince: "عضو منذ",
    logout: "تسجيل الخروج",
    backHome: "→ العودة إلى لوحة التحكم",
  },
  id: {
    title: "Akun saya",
    plan: "Paket saat ini",
    billing: "Penagihan",
    manageBilling: "Kelola langganan",
    manageDesc: "Ubah paket, perbarui metode pembayaran, atau batalkan melalui portal Stripe yang aman.",
    upgradeTo: "Upgrade ke Pro",
    upgradeDesc: "Buka angka tepat, ekspor PDF, peringatan real-time, dan lainnya.",
    account: "Akun",
    email: "Alamat email",
    memberSince: "Anggota sejak",
    logout: "Keluar",
    backHome: "← Kembali ke dasbor",
  },
};

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const l = LABELS[locale] ?? LABELS.fr;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/login`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, stripe_customer_id, created_at")
    .eq("id", user.id)
    .single();

  const plan = (profile?.plan || "free") as string;
  const meta = PLAN_META[plan] ?? PLAN_META.free;
  const planIcon = PLAN_ICONS[meta.iconName] ?? PLAN_ICONS.gift;
  const hasBilling = !!profile?.stripe_customer_id;
  const isPaid = plan !== "free";

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(locale, { year: "numeric", month: "long" })
    : "—";

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4">

      {/* Back link */}
      <Link href={`/${locale}`} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
        {l.backHome}
      </Link>

      <h1 className="text-2xl font-bold text-white">{l.title}</h1>

      {/* Plan card */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">{l.plan}</h2>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold ${meta.color}`}>
            {planIcon}
            {meta.label}
          </span>
        </div>

        {/* Billing management */}
        {isPaid && hasBilling ? (
          <div className="pt-2 space-y-3 border-t border-gray-800">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">{l.billing}</h3>
            <p className="text-sm text-gray-400">{l.manageDesc}</p>
            <BillingPortalButton locale={locale} label={l.manageBilling} />
          </div>
        ) : !isPaid ? (
          <div className="pt-2 border-t border-gray-800 space-y-3">
            <p className="text-sm text-gray-400">{l.upgradeDesc}</p>
            <Link
              href={`/${locale}/pricing`}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              {l.upgradeTo}
            </Link>
          </div>
        ) : null}
      </div>

      {/* Account info */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">{l.account}</h2>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-gray-500 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">{l.email}</p>
              <p className="text-sm text-white">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Shield className="w-4 h-4 text-gray-500 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">{l.memberSince}</p>
              <p className="text-sm text-white">{memberSince}</p>
            </div>
          </div>
        </div>

        {/* Sign out */}
        <div className="pt-2 border-t border-gray-800">
          <SignOutButton locale={locale} label={l.logout} />
        </div>
      </div>

    </div>
  );
}
