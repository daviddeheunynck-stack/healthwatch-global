import Link from "next/link";
import { Plane, Bell, Mail, Code2, Users, Globe } from "lucide-react";

const SECTION: Record<string, { title: string; sub: string }> = {
  fr: { title: "Vos fonctionnalités", sub: "Tout ce qui est inclus dans votre abonnement" },
  en: { title: "Your features",        sub: "Everything included in your subscription" },
  es: { title: "Sus funcionalidades",  sub: "Todo incluido en su suscripción" },
  ar: { title: "ميزاتك",              sub: "كل ما يشمله اشتراكك" },
  id: { title: "Fitur Anda",           sub: "Semua yang termasuk dalam langganan Anda" },
};

type CardDef = {
  icon: React.ReactNode;
  bg: string;
  title: Record<string, string>;
  desc: Record<string, string>;
  badge?: Record<string, string>;
  badgeCls?: string;
  href: string;
  cta: Record<string, string>;
};

export default function FeatureHub({ locale }: { locale: string }) {
  const s = SECTION[locale] ?? SECTION.en;

  const CARDS: CardDef[] = [
    {
      icon: <Plane className="w-5 h-5 text-blue-400" />,
      bg: "bg-blue-950/60",
      title: { fr: "Santé-voyage", en: "Travel Risk", es: "Riesgo de viaje", ar: "مخاطر السفر", id: "Risiko Perjalanan" },
      desc:  { fr: "Évaluation épidémiologique par destination + avis gouvernementaux en temps réel", en: "Epidemiological risk by destination with live government advisories", es: "Riesgo por destino con avisos gubernamentales en tiempo real", ar: "تقييم المخاطر الوبائية حسب الوجهة مع النصائح الحكومية الفورية", id: "Risiko epidemiologi per tujuan + saran pemerintah langsung" },
      badge: { fr: "Nouveau", en: "New", es: "Nuevo", ar: "جديد", id: "Baru" },
      badgeCls: "bg-emerald-950/60 text-emerald-400 border-emerald-800/40",
      href: `/${locale}/travel-risk`,
      cta:   { fr: "Évaluer un pays →", en: "Assess a country →", es: "Evaluar un país →", ar: "← تقييم دولة", id: "Evaluasi negara →" },
    },
    {
      icon: <Bell className="w-5 h-5 text-amber-400" />,
      bg: "bg-amber-950/60",
      title: { fr: "Alertes personnalisées", en: "Custom Alerts", es: "Alertas personalizadas", ar: "تنبيهات مخصصة", id: "Peringatan Kustom" },
      desc:  { fr: "Watchlist maladies, géofence géographique, alertes par catégorie et pays à risque", en: "Disease watchlist, geographic geofence, category and country-risk alerts", es: "Lista de enfermedades, geocerca, alertas por categoría y países de riesgo", ar: "قائمة مراقبة الأمراض، السياج الجغرافي، تنبيهات الفئات والبلدان", id: "Pantau penyakit, geofence, peringatan kategori & negara berisiko" },
      href: `/${locale}/settings?tab=alerts`,
      cta:   { fr: "Configurer →", en: "Configure →", es: "Configurar →", ar: "← إعداد", id: "Konfigurasi →" },
    },
    {
      icon: <Mail className="w-5 h-5 text-emerald-400" />,
      bg: "bg-emerald-950/60",
      title: { fr: "Digest & Rapports", en: "Digest & Reports", es: "Boletín & Informes", ar: "الملخص والتقارير", id: "Digest & Laporan" },
      desc:  { fr: "Sitrep hebdomadaire par email, rapports PDF régionaux programmés", en: "Weekly email sitrep, scheduled regional PDF reports", es: "Sitrep semanal por email, informes PDF regionales programados", ar: "ملخص أسبوعي بالبريد الإلكتروني وتقارير PDF إقليمية مجدولة", id: "Sitrep mingguan via email, laporan PDF regional terjadwal" },
      href: `/${locale}/settings?tab=notifications`,
      cta:   { fr: "Configurer →", en: "Configure →", es: "Configurar →", ar: "← إعداد", id: "Konfigurasi →" },
    },
    {
      icon: <Code2 className="w-5 h-5 text-purple-400" />,
      bg: "bg-purple-950/60",
      title: { fr: "API & Données", en: "API & Data", es: "API y Datos", ar: "API والبيانات", id: "API & Data" },
      desc:  { fr: "Clé API REST, export CSV, webhooks temps réel vers vos systèmes", en: "REST API key, CSV export, real-time webhooks to your systems", es: "Clave API REST, exportación CSV, webhooks en tiempo real", ar: "مفتاح REST API، تصدير CSV، webhooks في الوقت الفعلي", id: "Kunci REST API, ekspor CSV, webhook real-time ke sistem Anda" },
      href: `/${locale}/settings?tab=integration`,
      cta:   { fr: "Accéder →", en: "Access →", es: "Acceder →", ar: "← الوصول", id: "Akses →" },
    },
    {
      icon: <Globe className="w-5 h-5 text-sky-400" />,
      bg: "bg-sky-950/60",
      title: { fr: "Pays & Scorecard", en: "Countries & Scorecard", es: "Países y Scorecard", ar: "الدول والتقييم", id: "Negara & Scorecard" },
      desc:  { fr: "Tableaux de bord par pays, scorecard épidémiologique, historique des foyers", en: "Country dashboards, epidemiological scorecard, outbreak history", es: "Paneles por país, scorecard epidemiológica, historial de brotes", ar: "لوحات البلدان، التقييم الوبائي، تاريخ التفشيات", id: "Dasbor negara, scorecard epidemiologis, riwayat wabah" },
      href: `/${locale}/countries`,
      cta:   { fr: "Explorer →", en: "Explore →", es: "Explorar →", ar: "← استكشاف", id: "Jelajahi →" },
    },
    {
      icon: <Users className="w-5 h-5 text-slate-400" />,
      bg: "bg-slate-800/80",
      title: { fr: "Équipe & Accès", en: "Team & Access", es: "Equipo y Acceso", ar: "الفريق والوصول", id: "Tim & Akses" },
      desc:  { fr: "Inviter des membres, gérer les rôles et partager l'accès à la plateforme", en: "Invite members, manage roles and share platform access", es: "Invitar miembros, gestionar roles y acceso compartido", ar: "دعوة الأعضاء وإدارة الأدوار والوصول المشترك", id: "Undang anggota, kelola peran dan akses bersama" },
      badge: { fr: "Team", en: "Team", es: "Team", ar: "Team", id: "Team" },
      badgeCls: "bg-slate-800 text-slate-400 border-slate-700/60",
      href: `/${locale}/settings?tab=team`,
      cta:   { fr: "Gérer →", en: "Manage →", es: "Gestionar →", ar: "← إدارة", id: "Kelola →" },
    },
  ];

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-white">{s.title}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{s.sub}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CARDS.map((card) => {
          const title = card.title[locale] ?? card.title.en;
          const desc  = card.desc[locale]  ?? card.desc.en;
          const cta   = card.cta[locale]   ?? card.cta.en;
          const badge = card.badge?.[locale] ?? card.badge?.en;

          return (
            <Link
              key={card.href}
              href={card.href}
              className="group flex flex-col gap-3 rounded-xl border border-gray-700/40 bg-gray-900/40 hover:bg-gray-800/50 hover:border-gray-600/60 px-4 py-4 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}>
                  {card.icon}
                </div>
                {badge && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${card.badgeCls}`}>
                    {badge}
                  </span>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{desc}</p>
              </div>

              <p className="text-xs font-medium text-gray-400 group-hover:text-white transition-colors mt-auto">
                {cta}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
