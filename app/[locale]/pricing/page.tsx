import { getTranslations, getLocale } from "next-intl/server";
import { Check, Gift, ArrowRight, Star, Clock, Shield, Mail, Users, Globe, Building2, HeartHandshake, Microscope, Stethoscope, Landmark, RefreshCw } from "lucide-react";
import PricingCards from "@/components/PricingCards";
import Link from "next/link";
import type { Metadata } from "next";

// ─── Metadata ─────────────────────────────────────────────────────────────────

const PRICING_META: Record<string, { title: string; description: string }> = {
  en: { title: "Pricing Plans", description: "Flexible plans for NGOs, health ministries and international organizations. Start free — upgrade when you need real-time alerts and PDF exports." },
  fr: { title: "Tarifs", description: "Formules flexibles pour les ONG, ministères de la santé et organisations internationales. Démarrez gratuitement." },
  es: { title: "Precios", description: "Planes flexibles para ONG, ministerios de salud y organizaciones internacionales." },
  ar: { title: "الأسعار", description: "خطط مرنة للمنظمات غير الحكومية ووزارات الصحة والمنظمات الدولية." },
  id: { title: "Harga", description: "Paket fleksibel untuk LSM, kementerian kesehatan dan organisasi internasional." },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const m = PRICING_META[locale] ?? PRICING_META.en;
  return { title: m.title, description: m.description };
}

// ─── Hardcoded multilingual copy for new sections ─────────────────────────────

const COPY: Record<string, {
  heroTag: string; heroTitle: string; heroSub: string;
  orgTypes: string[]; orgLabel: string;
  guarantee: string; guaranteeDesc: string;
  compareTitle: string;
  features: { label: string; free: boolean | string; starter: boolean | string; pro: boolean | string; enterprise: boolean | string }[];
  ctaTitle: string; ctaDesc: string;
  roiTitle: string; roiText: string;
}> = {
  en: {
    heroTag: "Designed for health organizations and their teams worldwide",
    heroTitle: "Anticipate. Don't just react.",
    heroSub: "A single undetected outbreak can cost your organization months of crisis response. HealthWatch Global gives your teams real-time intelligence sourced directly from WHO.",
    orgTypes: ["Ministries of Health", "International NGOs", "Humanitarian Organizations", "Research Institutes", "Private Health Sector"],
    orgLabel: "Built for",
    guarantee: "Cancel anytime. 14-day refund.",
    guaranteeDesc: "No commitment. If you're not satisfied within 14 days of your first payment, we refund you — no questions asked.",
    compareTitle: "Full feature comparison",
    features: [
      { label: "Live outbreak map", free: true, starter: true, pro: true, enterprise: true },
      { label: "WHO DON data feed", free: true, starter: true, pro: true, enterprise: true },
      { label: "Monitored regions", free: "1", starter: "3", pro: "All", enterprise: "All" },
      { label: "Exact case & death figures", free: false, starter: true, pro: true, enterprise: true },
      { label: "Weekly email digest", free: true, starter: true, pro: true, enterprise: true },
      { label: "Regional email alerts", free: false, starter: "3 regions", pro: "All regions", enterprise: "All regions" },
      { label: "Real-time alerts (all regions)", free: false, starter: false, pro: true, enterprise: true },
      { label: "PDF regional reports", free: false, starter: "Weekly", pro: "All regions", enterprise: "All regions" },
      { label: "CSV data export", free: false, starter: true, pro: true, enterprise: true },
      { label: "Slack / Teams integration", free: false, starter: false, pro: true, enterprise: true },
      { label: "REST API access", free: false, starter: false, pro: false, enterprise: true },
      { label: "On-premise deployment", free: false, starter: false, pro: false, enterprise: true },
      { label: "99.9% SLA", free: false, starter: false, pro: false, enterprise: true },
      { label: "Dedicated account manager", free: false, starter: false, pro: false, enterprise: true },
      { label: "Support", free: "Email", starter: "Email", pro: "Priority", enterprise: "Dedicated" },
    ],
    ctaTitle: "Not sure which plan fits?",
    ctaDesc: "Book a 20-minute call. We'll map your surveillance needs and recommend the right plan — no sales pressure.",
    roiTitle: "The cost of not knowing",
    roiText: "WHO declares 15–25 new disease outbreaks every month. A single crisis that reaches your region before your teams are informed can mean weeks of reactive operations, supply chain disruption, and reputational exposure. At $199/month, Starter costs less than one hour of crisis management.",
  },
  fr: {
    heroTag: "Conçu pour les organisations de santé et leurs équipes partout dans le monde",
    heroTitle: "Anticipez. Ne réagissez plus.",
    heroSub: "Un foyer épidémique non détecté à temps peut coûter à votre organisation des mois de gestion de crise. HealthWatch Global fournit à vos équipes des données en temps réel, directement issues de l'OMS.",
    orgTypes: ["Ministères de la Santé", "ONG internationales", "Organisations humanitaires", "Instituts de recherche", "Secteur privé de la santé"],
    orgLabel: "Conçu pour",
    guarantee: "Sans engagement. Remboursement sous 14 jours.",
    guaranteeDesc: "Pas d'engagement. Si vous n'êtes pas satisfait dans les 14 jours suivant votre premier paiement, nous vous remboursons — sans question.",
    compareTitle: "Comparatif complet des fonctionnalités",
    features: [
      { label: "Carte des épidémies en direct", free: true, starter: true, pro: true, enterprise: true },
      { label: "Flux données OMS DON", free: true, starter: true, pro: true, enterprise: true },
      { label: "Régions surveillées", free: "1", starter: "3", pro: "Toutes", enterprise: "Toutes" },
      { label: "Chiffres exacts (cas & décès)", free: false, starter: true, pro: true, enterprise: true },
      { label: "Digest email hebdomadaire", free: true, starter: true, pro: true, enterprise: true },
      { label: "Alertes email régionales", free: false, starter: "3 régions", pro: "Toutes les régions", enterprise: "Toutes les régions" },
      { label: "Alertes en temps réel (toutes régions)", free: false, starter: false, pro: true, enterprise: true },
      { label: "Rapports PDF régionaux", free: false, starter: "Hebdomadaire", pro: "Toutes les régions", enterprise: "Toutes les régions" },
      { label: "Export CSV des données", free: false, starter: true, pro: true, enterprise: true },
      { label: "Intégration Slack / Teams", free: false, starter: false, pro: true, enterprise: true },
      { label: "Accès API REST", free: false, starter: false, pro: false, enterprise: true },
      { label: "Déploiement on-premise", free: false, starter: false, pro: false, enterprise: true },
      { label: "SLA 99,9 %", free: false, starter: false, pro: false, enterprise: true },
      { label: "Account manager dédié", free: false, starter: false, pro: false, enterprise: true },
      { label: "Support", free: "Email", starter: "Email", pro: "Prioritaire", enterprise: "Dédié" },
    ],
    ctaTitle: "Vous ne savez pas quelle formule choisir ?",
    ctaDesc: "Réservez un appel de 20 minutes. Nous analyserons vos besoins de surveillance et recommanderons la formule adaptée — sans pression commerciale.",
    roiTitle: "Le coût de l'ignorance",
    roiText: "L'OMS déclare 15 à 25 nouveaux foyers épidémiques chaque mois. Un seul foyer qui atteint votre région avant que vos équipes soient informées peut signifier des semaines d'opérations réactives, une rupture de la chaîne d'approvisionnement et une exposition médiatique. À 199 €/mois, la formule Starter coûte moins d'une heure de gestion de crise.",
  },
  es: {
    heroTag: "Diseñado para organizaciones de salud y sus equipos en todo el mundo",
    heroTitle: "Anticipe. No solo reaccione.",
    heroSub: "Un brote no detectado a tiempo puede costarle a su organización meses de gestión de crisis. HealthWatch Global ofrece a sus equipos inteligencia en tiempo real, directamente de la OMS.",
    orgTypes: ["Ministerios de Salud", "ONG internacionales", "Organizaciones humanitarias", "Institutos de investigación", "Sector sanitario privado"],
    orgLabel: "Diseñado para",
    guarantee: "Sin compromiso. Reembolso en 14 días.",
    guaranteeDesc: "Sin compromiso. Si no está satisfecho en los 14 días posteriores a su primer pago, le reembolsamos sin preguntas.",
    compareTitle: "Comparación completa de funciones",
    features: [
      { label: "Mapa de brotes en vivo", free: true, starter: true, pro: true, enterprise: true },
      { label: "Datos OMS DON", free: true, starter: true, pro: true, enterprise: true },
      { label: "Regiones supervisadas", free: "1", starter: "3", pro: "Todas", enterprise: "Todas" },
      { label: "Cifras exactas (casos y fallec.)", free: false, starter: true, pro: true, enterprise: true },
      { label: "Digest semanal por email", free: true, starter: true, pro: true, enterprise: true },
      { label: "Alertas email regionales", free: false, starter: "3 regiones", pro: "Todas las regiones", enterprise: "Todas las regiones" },
      { label: "Alertas en tiempo real (todas las regiones)", free: false, starter: false, pro: true, enterprise: true },
      { label: "Informes PDF regionales", free: false, starter: "Semanal", pro: "Todas las regiones", enterprise: "Todas las regiones" },
      { label: "Exportación de datos CSV", free: false, starter: true, pro: true, enterprise: true },
      { label: "Integración Slack / Teams", free: false, starter: false, pro: true, enterprise: true },
      { label: "Acceso API REST", free: false, starter: false, pro: false, enterprise: true },
      { label: "Implementación on-premise", free: false, starter: false, pro: false, enterprise: true },
      { label: "SLA del 99,9%", free: false, starter: false, pro: false, enterprise: true },
      { label: "Gestor de cuenta dedicado", free: false, starter: false, pro: false, enterprise: true },
      { label: "Soporte", free: "Email", starter: "Email", pro: "Prioritario", enterprise: "Dedicado" },
    ],
    ctaTitle: "¿No sabe qué plan elegir?",
    ctaDesc: "Reserve una llamada de 20 minutos. Analizaremos sus necesidades de vigilancia y le recomendaremos el plan adecuado, sin presión comercial.",
    roiTitle: "El coste de no saber",
    roiText: "La OMS declara entre 15 y 25 nuevos brotes de enfermedades cada mes. Un solo brote que llegue a su región antes de que sus equipos estén informados puede significar semanas de operaciones reactivas y exposición reputacional. A $199/mes, el plan Starter cuesta menos de una hora de gestión de crisis.",
  },
  ar: {
    heroTag: "مصمم للمنظمات الصحية وفرقها حول العالم",
    heroTitle: "استبق الأزمات. لا تكتفِ بالاستجابة.",
    heroSub: "قد يُكلِّف تفشٍّ واحد غير مكتشف في الوقت المناسب منظمتك أشهراً من إدارة الأزمات. توفر HealthWatch Global لفرقك بيانات استخباراتية فورية مباشرةً من منظمة الصحة العالمية.",
    orgTypes: ["وزارات الصحة", "المنظمات غير الحكومية الدولية", "المنظمات الإنسانية", "معاهد البحوث", "القطاع الصحي الخاص"],
    orgLabel: "مصمم لـ",
    guarantee: "بدون التزام. استرداد خلال 14 يوماً.",
    guaranteeDesc: "بدون التزام. إذا لم تكن راضياً خلال 14 يوماً من دفعتك الأولى، نعيد إليك المبلغ كاملاً دون أسئلة.",
    compareTitle: "مقارنة شاملة للميزات",
    features: [
      { label: "خريطة التفشيات المباشرة", free: true, starter: true, pro: true, enterprise: true },
      { label: "بيانات منظمة الصحة العالمية DON", free: true, starter: true, pro: true, enterprise: true },
      { label: "المناطق المراقبة", free: "1", starter: "3", pro: "جميعها", enterprise: "جميعها" },
      { label: "أرقام دقيقة (حالات ووفيات)", free: false, starter: true, pro: true, enterprise: true },
      { label: "ملخص بريدي أسبوعي", free: true, starter: true, pro: true, enterprise: true },
      { label: "تنبيهات بريدية إقليمية", free: false, starter: "3 مناطق", pro: "جميع المناطق", enterprise: "جميع المناطق" },
      { label: "تنبيهات فورية (جميع المناطق)", free: false, starter: false, pro: true, enterprise: true },
      { label: "تقارير PDF إقليمية", free: false, starter: "أسبوعي", pro: "جميع المناطق", enterprise: "جميع المناطق" },
      { label: "تصدير البيانات CSV", free: false, starter: true, pro: true, enterprise: true },
      { label: "تكامل Slack / Teams", free: false, starter: false, pro: true, enterprise: true },
      { label: "الوصول لـ REST API", free: false, starter: false, pro: false, enterprise: true },
      { label: "نشر محلي", free: false, starter: false, pro: false, enterprise: true },
      { label: "ضمان SLA 99.9%", free: false, starter: false, pro: false, enterprise: true },
      { label: "مدير حساب مخصص", free: false, starter: false, pro: false, enterprise: true },
      { label: "الدعم", free: "بريد إلكتروني", starter: "بريد إلكتروني", pro: "أولوية", enterprise: "مخصص" },
    ],
    ctaTitle: "لست متأكداً من الخطة المناسبة؟",
    ctaDesc: "احجز مكالمة مدتها 20 دقيقة. سنحلل احتياجاتك في المراقبة ونوصي بالخطة المناسبة — دون ضغوط تجارية.",
    roiTitle: "تكلفة عدم المعرفة",
    roiText: "تُعلن منظمة الصحة العالمية عن 15 إلى 25 تفشياً جديداً للأمراض كل شهر. تفشٍّ واحد يصل إلى منطقتك قبل إحاطة فريقك قد يعني أسابيع من العمليات التفاعلية والأضرار المؤسسية. بـ 199 دولار/شهر، تكلفة خطة Starter أقل من ساعة واحدة لإدارة الأزمات.",
  },
  id: {
    heroTag: "Dirancang untuk organisasi kesehatan dan tim mereka di seluruh dunia",
    heroTitle: "Antisipasi. Jangan hanya bereaksi.",
    heroSub: "Satu wabah yang tidak terdeteksi tepat waktu bisa menelan biaya berbulan-bulan manajemen krisis. HealthWatch Global memberikan intelijen real-time kepada tim Anda, langsung dari WHO.",
    orgTypes: ["Kementerian Kesehatan", "LSM Internasional", "Organisasi Kemanusiaan", "Lembaga Penelitian", "Sektor Kesehatan Swasta"],
    orgLabel: "Dirancang untuk",
    guarantee: "Tanpa komitmen. Pengembalian dana 14 hari.",
    guaranteeDesc: "Tanpa komitmen. Jika tidak puas dalam 14 hari setelah pembayaran pertama, kami kembalikan uang Anda tanpa pertanyaan.",
    compareTitle: "Perbandingan fitur lengkap",
    features: [
      { label: "Peta wabah langsung", free: true, starter: true, pro: true, enterprise: true },
      { label: "Data WHO DON", free: true, starter: true, pro: true, enterprise: true },
      { label: "Wilayah yang dipantau", free: "1", starter: "3", pro: "Semua", enterprise: "Semua" },
      { label: "Angka tepat (kasus & kematian)", free: false, starter: true, pro: true, enterprise: true },
      { label: "Digest email mingguan", free: true, starter: true, pro: true, enterprise: true },
      { label: "Peringatan email regional", free: false, starter: "3 wilayah", pro: "Semua wilayah", enterprise: "Semua wilayah" },
      { label: "Peringatan real-time (semua wilayah)", free: false, starter: false, pro: true, enterprise: true },
      { label: "Laporan PDF regional", free: false, starter: "Mingguan", pro: "Semua wilayah", enterprise: "Semua wilayah" },
      { label: "Ekspor data CSV", free: false, starter: true, pro: true, enterprise: true },
      { label: "Integrasi Slack / Teams", free: false, starter: false, pro: true, enterprise: true },
      { label: "Akses REST API", free: false, starter: false, pro: false, enterprise: true },
      { label: "Penerapan on-premise", free: false, starter: false, pro: false, enterprise: true },
      { label: "SLA 99,9%", free: false, starter: false, pro: false, enterprise: true },
      { label: "Manajer akun khusus", free: false, starter: false, pro: false, enterprise: true },
      { label: "Dukungan", free: "Email", starter: "Email", pro: "Prioritas", enterprise: "Khusus" },
    ],
    ctaTitle: "Tidak yakin paket mana yang cocok?",
    ctaDesc: "Jadwalkan panggilan 20 menit. Kami akan memetakan kebutuhan pemantauan Anda dan merekomendasikan paket yang tepat — tanpa tekanan penjualan.",
    roiTitle: "Biaya ketidaktahuan",
    roiText: "WHO mendeklarasikan 15–25 wabah penyakit baru setiap bulan. Satu wabah yang mencapai wilayah Anda sebelum tim Anda mendapat informasi bisa berarti berminggu-minggu operasi reaktif dan kerusakan reputasi. Dengan $199/bulan, Starter lebih murah dari satu jam manajemen krisis.",
  },
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function CellValue({ val }: { val: boolean | string }) {
  if (val === true) return <Check className="w-4 h-4 text-green-400 mx-auto" />;
  if (val === false) return <span className="text-gray-700 mx-auto block text-center">—</span>;
  return <span className="text-xs font-medium text-gray-300 block text-center">{val}</span>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations();
  const c = COPY[locale] ?? COPY.en;
  const isRtl = locale === "ar";

  const pricingSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "HealthWatch Global",
    "applicationCategory": "HealthApplication",
    "operatingSystem": "Web",
    "url": "https://healthwatch-global.com",
    "offers": [
      {
        "@type": "Offer",
        "name": "Starter",
        "price": "29",
        "priceCurrency": "EUR",
        "priceSpecification": { "@type": "RecurringChargeSpecification", "billingDuration": "P1M" },
        "description": "3 monitored regions, regional email alerts, CSV export, PDF reports",
      },
      {
        "@type": "Offer",
        "name": "Pro",
        "price": "79",
        "priceCurrency": "EUR",
        "priceSpecification": { "@type": "RecurringChargeSpecification", "billingDuration": "P1M" },
        "description": "All regions, real-time alerts, Slack/Teams integration, unlimited CSV",
      },
      {
        "@type": "Offer",
        "name": "Enterprise",
        "price": "299",
        "priceCurrency": "EUR",
        "priceSpecification": { "@type": "RecurringChargeSpecification", "billingDuration": "P1M" },
        "description": "Everything in Pro + REST API access, on-premise deployment, 99.9% SLA",
      },
    ],
  };

  return (
    <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingSchema) }}
    />
    <div className="space-y-20" dir={isRtl ? "rtl" : undefined}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="text-center space-y-6 max-w-3xl mx-auto pt-4">
        <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 text-green-400 text-xs font-medium">
          <Globe className="w-3.5 h-3.5" />
          {c.heroTag}
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight tracking-tight">
          {c.heroTitle}
        </h1>
        <p className="text-gray-400 text-lg leading-relaxed max-w-2xl mx-auto">{c.heroSub}</p>

        {/* Org types */}
        <div className="space-y-2">
          <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold">{c.orgLabel}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {c.orgTypes.map((org) => (
              <span key={org} className="text-xs bg-gray-800 border border-gray-700 rounded-full px-3 py-1 text-gray-400">
                {org}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Free tier ────────────────────────────────────────────────────── */}
      <div className="border border-gray-700 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gray-900/40 max-w-4xl mx-auto w-full">
        <div className="flex items-start gap-4">
          <Gift className="w-8 h-8 text-green-400 shrink-0 mt-0.5" />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-green-400 font-bold text-lg">{t("pricing.free_title")}</span>
              <span className="bg-green-500/10 text-green-400 text-xs font-medium px-2 py-0.5 rounded-full border border-green-500/20">0 €</span>
            </div>
            <p className="text-gray-400 text-sm">{t("pricing.free_desc")}</p>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
              {(["f0_1","f0_2","f0_3","f0_4"] as const).map((k) => (
                <li key={k} className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                  {t(`pricing.${k}` as any)}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <Link
          href={`/${locale}/signup`}
          className="shrink-0 border border-green-500/40 hover:border-green-400 text-green-400 hover:text-green-300 font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm whitespace-nowrap"
        >
          {t("pricing.free_cta")}
        </Link>
      </div>

      {/* ── Plans (client component — billing toggle) ────────────────────── */}
      <PricingCards locale={locale} />

      {/* ── Guarantee strip ───────────────────────────────────────────────── */}
      <div className="bg-green-500/5 border border-green-500/15 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-5 max-w-3xl mx-auto w-full">
        <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
          <RefreshCw className="w-6 h-6 text-green-400" />
        </div>
        <div>
          <p className="font-semibold text-white text-sm">{c.guarantee}</p>
          <p className="text-gray-400 text-sm mt-1">{c.guaranteeDesc}</p>
        </div>
      </div>

      {/* ── ROI framing ───────────────────────────────────────────────────── */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-8 max-w-3xl mx-auto w-full space-y-3">
        <div className="flex items-center gap-2 text-amber-400">
          <Clock className="w-5 h-5 shrink-0" />
          <h2 className="font-bold text-white text-lg">{c.roiTitle}</h2>
        </div>
        <p className="text-gray-400 text-sm leading-relaxed">{c.roiText}</p>
      </div>

      {/* ── Feature comparison table ──────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white text-center">{c.compareTitle}</h2>
        <div className="overflow-x-auto rounded-2xl border border-gray-800">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900">
                <th className="text-left px-5 py-4 text-gray-500 font-medium w-2/5"></th>
                {[
                  { label: "Free",       color: "text-gray-400"   },
                  { label: "Starter",    color: "text-blue-400"   },
                  { label: "Pro",        color: "text-red-400"    },
                  { label: "Enterprise", color: "text-purple-400" },
                ].map(({ label, color }) => (
                  <th key={label} className={`px-4 py-4 font-bold text-center ${color}`}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {c.features.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-gray-900/20" : ""}>
                  <td className="px-5 py-3 text-gray-300">{row.label}</td>
                  <td className="px-4 py-3"><CellValue val={row.free} /></td>
                  <td className="px-4 py-3"><CellValue val={row.starter} /></td>
                  <td className="px-4 py-3 bg-red-500/3"><CellValue val={row.pro} /></td>
                  <td className="px-4 py-3"><CellValue val={row.enterprise} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Designed for — organisation types ────────────────────────────── */}
      <div className="space-y-5">
        <p className="text-center text-xs text-gray-500 uppercase tracking-widest font-semibold">
          {locale === "fr" ? "Conçu pour" : locale === "es" ? "Diseñado para" : locale === "ar" ? "مصمم لـ" : locale === "id" ? "Dirancang untuk" : "Designed for"}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Landmark,      label: locale === "fr" ? "Ministères de la Santé" : locale === "es" ? "Ministerios de Salud" : locale === "ar" ? "وزارات الصحة" : locale === "id" ? "Kementerian Kesehatan" : "Health Ministries" },
            { icon: HeartHandshake,label: locale === "fr" ? "ONG Internationales" : locale === "es" ? "ONG Internacionales" : locale === "ar" ? "المنظمات غير الحكومية" : locale === "id" ? "LSM Internasional" : "International NGOs" },
            { icon: Microscope,    label: locale === "fr" ? "Instituts de Recherche" : locale === "es" ? "Institutos de Investigación" : locale === "ar" ? "معاهد البحوث" : locale === "id" ? "Lembaga Penelitian" : "Research Institutes" },
            { icon: Stethoscope,   label: locale === "fr" ? "Hôpitaux & Cliniques" : locale === "es" ? "Hospitales & Clínicas" : locale === "ar" ? "المستشفيات والعيادات" : locale === "id" ? "Rumah Sakit & Klinik" : "Hospitals & Clinics" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-600 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Icon className="w-5 h-5 text-red-400" />
              </div>
              <p className="text-sm text-gray-300 font-medium text-center">{label}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-6 pt-2">
          {[
            { value: "195", label: locale === "fr" ? "pays couverts" : locale === "es" ? "países cubiertos" : locale === "ar" ? "دولة مغطاة" : locale === "id" ? "negara tercakup" : "countries covered", icon: Globe },
            { value: "99.9%", label: locale === "fr" ? "disponibilité" : locale === "es" ? "disponibilidad" : locale === "ar" ? "وقت التشغيل" : locale === "id" ? "uptime" : "uptime", icon: Star },
            { value: "5", label: locale === "fr" ? "langues" : locale === "es" ? "idiomas" : locale === "ar" ? "لغات" : locale === "id" ? "bahasa" : "languages", icon: Users },
            { value: "GDPR", label: locale === "fr" ? "conformité" : locale === "es" ? "cumplimiento" : locale === "ar" ? "الامتثال" : locale === "id" ? "kepatuhan" : "compliant", icon: Shield },
          ].map(({ value, label, icon: Icon }) => (
            <div key={label} className="flex items-center gap-2 text-gray-400 text-sm">
              <Icon className="w-4 h-4 text-red-400" />
              <span className="font-bold text-white">{value}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── NGO discount banner ───────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-emerald-950/60 via-emerald-900/20 to-transparent border border-emerald-700/30 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 max-w-4xl mx-auto w-full">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <HeartHandshake className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-emerald-300 font-semibold text-sm">
              {locale === "fr" ? "Tarif ONG — jusqu'à −30%" : locale === "es" ? "Precio ONG — hasta −30%" : locale === "ar" ? "سعر المنظمات غير الحكومية — حتى −30%" : locale === "id" ? "Harga LSM — hingga −30%" : "NGO rate — up to −30%"}
            </p>
            <p className="text-gray-400 text-xs mt-0.5">
              {locale === "fr" ? "Vous êtes une ONG, un organisme humanitaire ou un institut de recherche à but non lucratif ? Contactez-nous pour un tarif adapté." : locale === "es" ? "¿Es una ONG, organización humanitaria o instituto de investigación sin ánimo de lucro? Contáctenos para una tarifa adaptada." : locale === "ar" ? "هل أنتم منظمة غير حكومية أو هيئة إنسانية أو معهد بحثي غير ربحي؟ تواصلوا معنا للحصول على سعر مخصص." : locale === "id" ? "Apakah Anda LSM, organisasi kemanusiaan, atau lembaga riset nirlaba? Hubungi kami untuk tarif khusus." : "Are you an NGO, humanitarian organization, or non-profit research institute? Contact us for a dedicated rate."}
            </p>
          </div>
        </div>
        <Link
          href={`/${locale}/contact`}
          className="shrink-0 text-xs bg-emerald-700 hover:bg-emerald-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          {locale === "fr" ? "Demander un tarif →" : locale === "es" ? "Solicitar tarifa →" : locale === "ar" ? "طلب سعر ←" : locale === "id" ? "Minta tarif →" : "Request a quote →"}
        </Link>
      </div>

      {/* ── CTA contact ───────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center space-y-4 max-w-2xl mx-auto w-full">
        <Users className="w-8 h-8 text-red-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">{c.ctaTitle}</h2>
        <p className="text-gray-400 text-sm">{c.ctaDesc}</p>
        <Link
          href={`/${locale}/contact`}
          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
        >
          <Mail className="w-4 h-4" />
          {t("pricing.contactUs")}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto space-y-4 w-full">
        <h2 className="text-xl font-semibold text-white text-center mb-6">{t("pricing.faq_title")}</h2>
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="font-medium text-white mb-2">{t(`pricing.faq${i}_q` as any)}</p>
            <p className="text-gray-400 text-sm">{t(`pricing.faq${i}_a` as any)}</p>
          </div>
        ))}
      </div>

    </div>
    </>
  );
}
