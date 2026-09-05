import { getTranslations } from "next-intl/server";
import { Check, Gift, ArrowRight, Star, Clock, Shield, Mail, Users, Globe, Building2, HeartHandshake, Microscope, Stethoscope, Landmark, RefreshCw } from "lucide-react";
import PricingCards from "@/components/PricingCards";
import TrackPageView from "@/components/TrackPageView";
import Link from "next/link";
import type { Metadata } from "next";
import { jsonLdHtml } from "@/lib/json-ld";

export const revalidate = 3600;

// ─── Metadata ─────────────────────────────────────────────────────────────────

const LOCALES = ["en", "fr", "es", "ar", "id"] as const;
const OG_LOCALE: Record<string, string> = {
  en: "en_US", fr: "fr_FR", es: "es_ES", ar: "ar_SA", id: "id_ID",
};

const PRICING_META: Record<string, { title: string; description: string }> = {
  en: { title: "Pricing Plans", description: "Flexible plans for NGOs, health ministries and international organizations. Start free — upgrade when you need instant alerts and PDF exports." },
  fr: { title: "Tarifs", description: "Formules flexibles pour les ONG, ministères de la santé et organisations internationales. Démarrez gratuitement." },
  es: { title: "Precios", description: "Planes flexibles para ONG, ministerios de salud y organizaciones internacionales." },
  ar: { title: "الأسعار", description: "خطط مرنة للمنظمات غير الحكومية ووزارات الصحة والمنظمات الدولية." },
  id: { title: "Harga", description: "Paket fleksibel untuk LSM, kementerian kesehatan dan organisasi internasional." },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const m = PRICING_META[locale] ?? PRICING_META.en;
  const url = `https://healthwatch-global.com/${locale}/pricing`;

  return {
    title: m.title,
    description: m.description,
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [l, `https://healthwatch-global.com/${l}/pricing`])),
        "x-default": "https://healthwatch-global.com/en/pricing",
      },
    },
    openGraph: {
      type: "website",
      url,
      title: `${m.title} | HealthWatch Global`,
      description: m.description,
      siteName: "HealthWatch Global",
      locale: OG_LOCALE[locale] ?? "en_US",
      images: [
        {
          url: `https://healthwatch-global.com/api/og?locale=${locale}`,
          width: 1200,
          height: 630,
          alt: `${m.title} — HealthWatch Global`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${m.title} | HealthWatch Global`,
      description: m.description,
      images: [`https://healthwatch-global.com/api/og?locale=${locale}`],
    },
    robots: { index: true, follow: true },
  };
}

// ─── Hardcoded multilingual copy for new sections ─────────────────────────────

const COPY: Record<string, {
  heroTag: string; heroTitle: string; heroSub: string;
  orgTypes: string[]; orgLabel: string;
  guarantee: string; guaranteeDesc: string;
  compareTitle: string;
  features: { label: string; free: boolean | string; pro: boolean | string; team: boolean | string; enterprise: boolean | string }[];
  ctaTitle: string; ctaDesc: string;
  roiTitle: string; roiText: string;
}> = {
  en: {
    heroTag: "Designed for health organizations and their teams worldwide",
    heroTitle: "Anticipate. Don't just react.",
    heroSub: "A single undetected outbreak can cost your organization months of crisis response. HealthWatch Global gives your teams actionable intelligence sourced directly from official health agencies.",
    orgTypes: ["Ministries of Health", "International NGOs", "Humanitarian Organizations", "Research Institutes", "Corporate Risk & Travel Security Teams"],
    orgLabel: "Built for",
    guarantee: "Cancel anytime. 14-day refund.",
    guaranteeDesc: "No commitment. If you're not satisfied within 14 days of your first payment, we refund you — no questions asked.",
    compareTitle: "Full feature comparison",
    features: [
      { label: "Seats included", free: "1", pro: "1", team: "5", enterprise: "Unlimited" },
      { label: "Monitored regions", free: "1", pro: "All", team: "All", enterprise: "All" },
      { label: "Instant alerts (email + push)", free: false, pro: true, team: true, enterprise: true },
      { label: "PDF reports + CSV export", free: false, pro: true, team: true, enterprise: true },
      { label: "Slack / Teams integration", free: false, pro: true, team: true, enterprise: true },
      { label: "Single team invoice + DPA", free: false, pro: false, team: true, enterprise: true },
      { label: "REST API + Webhooks", free: false, pro: true, team: true, enterprise: true },
      { label: "Support", free: "Email", pro: "Priority", team: "Priority", enterprise: "Dedicated" },
    ],
    ctaTitle: "Not sure which plan fits?",
    ctaDesc: "Email us. We'll map your surveillance needs and recommend the right plan for your organization — no sales pressure.",
    roiTitle: "The cost of not knowing",
    roiText: "WHO declares 15–25 new disease outbreaks every month. A single crisis that reaches your region before your teams are informed can mean weeks of reactive operations, supply chain disruption, and reputational exposure — and a duty-of-care failure for organizations with staff deployed abroad. At $29/month, Pro costs less than one hour of crisis management.",
  },
  fr: {
    heroTag: "Conçu pour les organisations de santé et leurs équipes partout dans le monde",
    heroTitle: "Anticipez. Ne réagissez plus.",
    heroSub: "Un foyer épidémique non détecté à temps peut coûter à votre organisation des mois de gestion de crise. HealthWatch Global fournit à vos équipes des données de surveillance fiables, directement issues des sources officielles de santé.",
    orgTypes: ["Ministères de la Santé", "ONG internationales", "Organisations humanitaires", "Instituts de recherche", "Équipes risques corporate & sécurité voyage"],
    orgLabel: "Conçu pour",
    guarantee: "Sans engagement. Remboursement sous 14 jours.",
    guaranteeDesc: "Pas d'engagement. Si vous n'êtes pas satisfait dans les 14 jours suivant votre premier paiement, nous vous remboursons — sans question.",
    compareTitle: "Comparatif complet des fonctionnalités",
    features: [
      { label: "Sièges inclus", free: "1", pro: "1", team: "5", enterprise: "Illimité" },
      { label: "Régions surveillées", free: "1", pro: "Toutes", team: "Toutes", enterprise: "Toutes" },
      { label: "Alertes instantanées (email + push)", free: false, pro: true, team: true, enterprise: true },
      { label: "Rapports PDF + export CSV", free: false, pro: true, team: true, enterprise: true },
      { label: "Intégration Slack / Teams", free: false, pro: true, team: true, enterprise: true },
      { label: "Facture institutionnelle + DPA", free: false, pro: false, team: true, enterprise: true },
      { label: "API REST + Webhooks", free: false, pro: true, team: true, enterprise: true },
      { label: "Support", free: "Email", pro: "Prioritaire", team: "Prioritaire", enterprise: "Dédié" },
    ],
    ctaTitle: "Vous ne savez pas quelle formule choisir ?",
    ctaDesc: "Écrivez-nous. Nous analyserons vos besoins de surveillance et recommanderons la formule adaptée à votre organisation — sans pression commerciale.",
    roiTitle: "Le coût de l'ignorance",
    roiText: "L'OMS déclare 15 à 25 nouveaux foyers épidémiques chaque mois. Un seul foyer qui atteint votre région avant que vos équipes soient informées peut signifier des semaines d'opérations réactives, une rupture de la chaîne d'approvisionnement, une exposition médiatique — et un manquement au devoir de protection pour les organisations avec des collaborateurs déployés à l'étranger. À 29 €/mois, le plan Pro coûte moins d'une heure de gestion de crise.",
  },
  es: {
    heroTag: "Diseñado para organizaciones de salud y sus equipos en todo el mundo",
    heroTitle: "Anticipe. No solo reaccione.",
    heroSub: "Un brote no detectado a tiempo puede costarle a su organización meses de gestión de crisis. HealthWatch Global ofrece a sus equipos datos de vigilancia de la OMS, ECDC, PAHO y Africa CDC, directamente en su idioma.",
    orgTypes: ["Ministerios de Salud", "ONG internacionales", "Organizaciones humanitarias", "Institutos de investigación", "Equipos de riesgo corporativo y seguridad del viajero"],
    orgLabel: "Diseñado para",
    guarantee: "Sin compromiso. Reembolso en 14 días.",
    guaranteeDesc: "Sin compromiso. Si no está satisfecho en los 14 días posteriores a su primer pago, le reembolsamos sin preguntas.",
    compareTitle: "Comparación completa de funciones",
    features: [
      { label: "Puestos incluidos", free: "1", pro: "1", team: "5", enterprise: "Ilimitado" },
      { label: "Regiones supervisadas", free: "1", pro: "Todas", team: "Todas", enterprise: "Todas" },
      { label: "Alertas instantáneas (email + push)", free: false, pro: true, team: true, enterprise: true },
      { label: "Informes PDF + exportación CSV", free: false, pro: true, team: true, enterprise: true },
      { label: "Integración Slack / Teams", free: false, pro: true, team: true, enterprise: true },
      { label: "Factura institucional + DPA", free: false, pro: false, team: true, enterprise: true },
      { label: "API REST + Webhooks", free: false, pro: true, team: true, enterprise: true },
      { label: "Soporte", free: "Email", pro: "Prioritario", team: "Prioritario", enterprise: "Dedicado" },
    ],
    ctaTitle: "¿No sabe qué plan elegir?",
    ctaDesc: "Escríbanos. Analizaremos sus necesidades de vigilancia y le recomendaremos el plan adecuado para su organización, sin presión comercial.",
    roiTitle: "El coste de no saber",
    roiText: "La OMS declara entre 15 y 25 nuevos brotes de enfermedades cada mes. Un solo brote que llegue a su región antes de que sus equipos estén informados puede significar semanas de operaciones reactivas, disrupciones en la cadena de suministro y exposición reputacional — y un incumplimiento del deber de protección para organizaciones con personal desplegado en el extranjero. A €29/mes, el plan Pro cuesta menos de una hora de gestión de crisis.",
  },
  ar: {
    heroTag: "مصمم للمنظمات الصحية وفرقها حول العالم",
    heroTitle: "استبق الأزمات. لا تكتفِ بالاستجابة.",
    heroSub: "قد يُكلِّف تفشٍّ واحد غير مكتشف في الوقت المناسب منظمتك أشهراً من إدارة الأزمات. توفر HealthWatch Global لفرقك بيانات مراقبة محدَّثة كل ساعة من WHO وECDC وPAHO وAfrica CDC.",
    orgTypes: ["وزارات الصحة", "المنظمات غير الحكومية الدولية", "المنظمات الإنسانية", "معاهد البحوث", "فرق إدارة المخاطر المؤسسية وأمن السفر"],
    orgLabel: "مصمم لـ",
    guarantee: "بدون التزام. استرداد خلال 14 يوماً.",
    guaranteeDesc: "بدون التزام. إذا لم تكن راضياً خلال 14 يوماً من دفعتك الأولى، نعيد إليك المبلغ كاملاً دون أسئلة.",
    compareTitle: "مقارنة شاملة للميزات",
    features: [
      { label: "المقاعد المشمولة", free: "1", pro: "1", team: "5", enterprise: "غير محدود" },
      { label: "المناطق المراقبة", free: "1", pro: "جميعها", team: "جميعها", enterprise: "جميعها" },
      { label: "تنبيهات فورية (بريد + إشعارات)", free: false, pro: true, team: true, enterprise: true },
      { label: "تقارير PDF + تصدير CSV", free: false, pro: true, team: true, enterprise: true },
      { label: "تكامل Slack / Teams", free: false, pro: true, team: true, enterprise: true },
      { label: "فاتورة مؤسسية + DPA", free: false, pro: false, team: true, enterprise: true },
      { label: "REST API + Webhooks", free: false, pro: true, team: true, enterprise: true },
      { label: "الدعم", free: "بريد إلكتروني", pro: "أولوية", team: "أولوية", enterprise: "مخصص" },
    ],
    ctaTitle: "لست متأكداً من الخطة المناسبة؟",
    ctaDesc: "راسلنا عبر البريد الإلكتروني. سنحلل احتياجاتك في المراقبة ونوصي بالخطة المناسبة لمؤسستك — دون ضغوط تجارية.",
    roiTitle: "تكلفة عدم المعرفة",
    roiText: "تُعلن منظمة الصحة العالمية عن 15 إلى 25 تفشياً جديداً للأمراض كل شهر. تفشٍّ واحد يصل إلى منطقتك قبل إحاطة فريقك قد يعني أسابيع من العمليات التفاعلية، واضطراب في سلاسل التوريد، وأضرار مؤسسية — فضلاً عن إخلال بواجب الحماية للمؤسسات التي لديها موظفون في الخارج. بـ 29 €/شهر، تكلفة خطة Pro أقل من ساعة واحدة لإدارة الأزمات.",
  },
  id: {
    heroTag: "Dirancang untuk organisasi kesehatan dan tim mereka di seluruh dunia",
    heroTitle: "Antisipasi. Jangan hanya bereaksi.",
    heroSub: "Satu wabah yang tidak terdeteksi tepat waktu bisa menelan biaya berbulan-bulan manajemen krisis. HealthWatch Global memberikan data pemantauan WHO, ECDC, PAHO dan Africa CDC yang diperbarui setiap jam kepada tim Anda.",
    orgTypes: ["Kementerian Kesehatan", "LSM Internasional", "Organisasi Kemanusiaan", "Lembaga Penelitian", "Tim Risiko Korporat & Keamanan Perjalanan"],
    orgLabel: "Dirancang untuk",
    guarantee: "Tanpa komitmen. Pengembalian dana 14 hari.",
    guaranteeDesc: "Tanpa komitmen. Jika tidak puas dalam 14 hari setelah pembayaran pertama, kami kembalikan uang Anda tanpa pertanyaan.",
    compareTitle: "Perbandingan fitur lengkap",
    features: [
      { label: "Kursi termasuk", free: "1", pro: "1", team: "5", enterprise: "Tak terbatas" },
      { label: "Wilayah yang dipantau", free: "1", pro: "Semua", team: "Semua", enterprise: "Semua" },
      { label: "Peringatan instan (email + push)", free: false, pro: true, team: true, enterprise: true },
      { label: "Laporan PDF + ekspor CSV", free: false, pro: true, team: true, enterprise: true },
      { label: "Integrasi Slack / Teams", free: false, pro: true, team: true, enterprise: true },
      { label: "Faktur institusional + DPA", free: false, pro: false, team: true, enterprise: true },
      { label: "REST API + Webhooks", free: false, pro: true, team: true, enterprise: true },
      { label: "Dukungan", free: "Email", pro: "Prioritas", team: "Prioritas", enterprise: "Khusus" },
    ],
    ctaTitle: "Tidak yakin paket mana yang cocok?",
    ctaDesc: "Hubungi kami via email. Kami akan memetakan kebutuhan pemantauan Anda dan merekomendasikan paket yang tepat untuk organisasi Anda — tanpa tekanan penjualan.",
    roiTitle: "Biaya ketidaktahuan",
    roiText: "WHO mendeklarasikan 15–25 wabah penyakit baru setiap bulan. Satu wabah yang mencapai wilayah Anda sebelum tim Anda mendapat informasi bisa berarti berminggu-minggu operasi reaktif, gangguan rantai pasokan, dan kerusakan reputasi — serta kegagalan duty-of-care bagi organisasi yang memiliki staf di luar negeri. Dengan €29/bulan, Pro lebih murah dari satu jam manajemen krisis.",
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
        "name": "Free",
        "price": "0",
        "priceCurrency": "EUR",
        "description": "Daily outbreak map and dashboard, no account required.",
      },
      {
        "@type": "Offer",
        "name": "Pro",
        "price": "29",
        "priceCurrency": "EUR",
        "priceSpecification": {
          "@type": "UnitPriceSpecification",
          "billingDuration": "P1M",
          "referenceQuantity": { "@type": "QuantitativeValue", "value": 1, "unitCode": "MON" },
        },
        "description": "All regions, instant alerts, Slack/Teams integration, unlimited CSV export. 7-day free trial.",
      },
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [1, 2, 3, 4, 5, 6].map((i) => ({
      "@type": "Question",
      "name": t(`pricing.faq${i}_q`),
      "acceptedAnswer": { "@type": "Answer", "text": t(`pricing.faq${i}_a`) },
    })),
  };

  return (
    <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdHtml(pricingSchema) }}
    />
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdHtml(faqSchema) }}
    />
    <div className="space-y-20" dir={isRtl ? "rtl" : undefined}>
      <TrackPageView action="pricing_page_view" metadata={{ locale }} />

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

      {/* ── ROI framing ───────────────────────────────────────────────────── */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-8 max-w-3xl mx-auto w-full space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-400 shrink-0" />
          <h2 className="font-bold text-white text-lg">{c.roiTitle}</h2>
        </div>
        <p className="text-gray-400 text-sm leading-relaxed">{c.roiText}</p>
      </div>

      {/* ── Institutional pilot banner ────────────────────────────────────── */}
      {/* Moved above the self-serve cards (2026-07-23): self-serve has never
          converted a single paying customer, while every real engaged lead
          has been institutional-shaped (public health professionals). This
          path should be the second thing a visitor sees, not the ninth. */}
      <div className="bg-gradient-to-r from-red-950/50 via-red-900/20 to-transparent border border-red-700/30 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 max-w-4xl mx-auto w-full">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-red-300 font-semibold text-sm">
              {locale === "fr" ? "Programme pilote institutionnel — 35 jours gratuits" : locale === "es" ? "Programa piloto institucional — 35 días gratis" : locale === "ar" ? "البرنامج التجريبي المؤسسي — 35 يوماً مجاناً" : locale === "id" ? "Program pilot institusional — 35 hari gratis" : "Institutional pilot program — 35 days free"}
            </p>
            <p className="text-gray-400 text-xs mt-0.5">
              {locale === "fr" ? "5 accès Pro offerts pour votre équipe (ONG, agence ONU, ministère). En échange : votre retour terrain structuré." : locale === "es" ? "5 accesos Pro para su equipo (ONG, agencia ONU, ministerio). A cambio: su retroalimentación estructurada." : locale === "ar" ? "5 مقاعد Pro لفريقك (منظمة غير حكومية، وكالة أممية، وزارة). في المقابل: ملاحظاتكم الميدانية المنظمة." : locale === "id" ? "5 akses Pro untuk tim Anda (LSM, badan PBB, kementerian). Sebagai gantinya: umpan balik lapangan terstruktur Anda." : "5 Pro seats for your team (NGO, UN agency, ministry). In exchange: your structured field feedback."}
            </p>
          </div>
        </div>
        <Link
          href={`/${locale}/pilot`}
          className="shrink-0 text-xs bg-red-700 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          {locale === "fr" ? "Candidater au pilote →" : locale === "es" ? "Solicitar piloto →" : locale === "ar" ? "← التقدم للبرنامج" : locale === "id" ? "Daftar pilot →" : "Apply for the pilot →"}
        </Link>
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
                  {t(`pricing.${k}`)}
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

      {/* ── Feature comparison table ──────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white text-center">{c.compareTitle}</h2>
        <div className="overflow-x-auto rounded-2xl border border-gray-800">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900">
                <th className="text-left px-5 py-4 text-gray-500 font-medium w-2/5"></th>
                {[
                  { label: "Free",       color: "text-gray-400"   },
                  { label: "Pro",        color: "text-red-400"    },
                  { label: "Team",       color: "text-amber-400"  },
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
                  <td className="px-4 py-3 bg-red-500/3"><CellValue val={row.pro} /></td>
                  <td className="px-4 py-3 bg-amber-500/3"><CellValue val={row.team} /></td>
                  <td className="px-4 py-3"><CellValue val={row.enterprise} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── API docs link for Pro/Team/Enterprise ────────────────────────── */}
      <p className="text-center text-xs text-gray-500">
        {locale === "fr" ? "Accès API REST (Pro · Team · Enterprise) — " : locale === "es" ? "Acceso REST API (Pro · Team · Enterprise) — " : locale === "ar" ? "وصول REST API (Pro · Team · Enterprise) — " : locale === "id" ? "Akses REST API (Pro · Team · Enterprise) — " : "REST API access (Pro · Team · Enterprise) — "}
        <Link href={`/${locale}/docs`} className="text-purple-400 hover:text-purple-300 underline transition-colors">
          {locale === "fr" ? "voir la documentation →" : locale === "es" ? "ver documentación →" : locale === "ar" ? "← عرض التوثيق" : locale === "id" ? "lihat dokumentasi →" : "view API docs →"}
        </Link>
      </p>

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

      {/* ── LMIC equity note ─────────────────────────────────────────────── */}
      <p className="text-center text-xs text-gray-600 max-w-2xl mx-auto -mt-2">
        {locale === "fr"
          ? "Unité de santé publique dans un pays à revenu faible ou intermédiaire ? Écrivez-nous — nous avons une politique de prix libre pour les équipes dont le budget ne permet pas le tarif standard."
          : locale === "es"
          ? "¿Unidad de salud pública en un país de renta baja o media? Escríbanos — tenemos una política de precio libre para equipos con presupuesto limitado."
          : locale === "ar"
          ? "وحدة صحة عامة في دولة منخفضة أو متوسطة الدخل؟ راسلونا — لدينا سياسة سعر حر للفرق ذات الميزانيات المحدودة."
          : locale === "id"
          ? "Unit kesehatan publik di negara berpenghasilan rendah atau menengah? Hubungi kami — kami memiliki kebijakan harga bebas untuk tim dengan anggaran terbatas."
          : "Public health unit in a low- or middle-income country? Write to us — we have a pay-what-you-can policy for teams whose budget doesn't allow the standard rate."}
      </p>

      {/* ── Institutional procurement ─────────────────────────────────────── */}
      <div className="bg-gray-900/40 border border-gray-700/50 rounded-2xl p-6 flex flex-col sm:flex-row items-start gap-5 max-w-4xl mx-auto w-full">
        <div className="w-10 h-10 rounded-lg bg-gray-700/40 border border-gray-600/40 flex items-center justify-center shrink-0 mt-0.5">
          <Shield className="w-5 h-5 text-gray-400" />
        </div>
        <div className="space-y-3 flex-1">
          <p className="font-semibold text-white text-sm">
            {locale === "fr" ? "Achat institutionnel & facturation" : locale === "es" ? "Compra institucional y facturación" : locale === "ar" ? "الشراء المؤسسي والفواتير" : locale === "id" ? "Pengadaan institusional & faktur" : "Institutional procurement & invoicing"}
          </p>
          <ul className="space-y-1.5 text-xs text-gray-400">
            <li className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-0.5" />
              {locale === "fr" ? "Une facture PDF est générée automatiquement pour chaque paiement (mensuel ou annuel)." : locale === "es" ? "Se genera automáticamente una factura PDF por cada pago (mensual o anual)." : locale === "ar" ? "يتم إنشاء فاتورة PDF تلقائياً لكل دفعة (شهرية أو سنوية)." : locale === "id" ? "Faktur PDF dibuat otomatis untuk setiap pembayaran (bulanan atau tahunan)." : "A PDF invoice is generated automatically for every payment (monthly or annual)."}
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-0.5" />
              {locale === "fr" ? "Le plan annuel émet une seule facture pour l'année — idéal pour les bons de commande." : locale === "es" ? "El plan anual emite una única factura para todo el año — ideal para órdenes de compra." : locale === "ar" ? "تصدر الخطة السنوية فاتورة و��حدة للسنة كاملة — مثالية لأوامر الشراء." : locale === "id" ? "Paket tahunan menerbitkan satu faktur untuk seluruh tahun — ideal untuk purchase order." : "The annual plan issues a single invoice for the year — ideal for purchase orders."}
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-0.5" />
                            {locale === "fr" ? "Besoin d'un devis formel avant engagement ? Contactez-nous — nous répondons sous 24h." : locale === "es" ? "¿Necesita un presupuesto formal antes de comprometerse? Contáctenos — respondemos en 24h." : locale === "ar" ? "تحتاج إلى عرض سعر رسمي قبل الالتزام؟ تواصلوا معنا — نرد في غضون 24 ساعة." : locale === "id" ? "Butuh penawaran formal sebelum berkomitmen? Hubungi kami — kami merespons dalam 24 jam." : "Need a formal quote before committing? Contact us — we respond within 24h."}
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-0.5" />
              {locale === "fr" ? "Données hébergées en UE — Supabase (Francfort) + Brevo (Paris). Conformité RGPD complète." : locale === "es" ? "Datos alojados en la UE — Supabase (Frankfurt) + Brevo (París). Conformidad RGPD completa." : locale === "ar" ? "البيانات مستضافة في الاتحاد الأوروبي — Supabase (فرانكفورت) + Brevo (باريس). امتثال كامل لـ GDPR." : locale === "id" ? "Data dihosting di UE — Supabase (Frankfurt) + Brevo (Paris). Kepatuhan GDPR penuh." : "Data hosted in the EU — Supabase (Frankfurt) + Brevo (Paris). Full GDPR compliance."}
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-0.5" />
              {locale === "fr" ? "Facturation au nom de votre organisation. Marchés publics et procédures d'achat institutionnel : contactez-nous." : locale === "es" ? "Facturación a nombre de su organización. Contratación pública y compra institucional: contáctenos." : locale === "ar" ? "الفوترة باسم مؤسستك. المشتريات العامة والإجراءات المؤسسية: تواصلوا معنا." : locale === "id" ? "Penagihan atas nama organisasi Anda. Pengadaan publik dan pembelian institusional: hubungi kami." : "Invoicing in your organization's name. Public procurement and institutional purchasing: contact us."}
            </li>
          </ul>
          <Link
            href={`/${locale}/contact`}
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors border border-gray-700 hover:border-gray-500 rounded-lg px-3 py-1.5"
          >
            <Mail className="w-3.5 h-3.5" />
            {locale === "fr" ? "Demander un devis →" : locale === "es" ? "Solicitar presupuesto →" : locale === "ar" ? "طلب عرض سعر ←" : locale === "id" ? "Minta penawaran →" : "Request a quote →"}
          </Link>
        </div>
      </div>

      {/* ── CTA contact ────────��──────────────────��───────────────────────── */}
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
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="font-medium text-white mb-2">{t(`pricing.faq${i}_q`)}</p>
            <p className="text-gray-400 text-sm">{t(`pricing.faq${i}_a`)}</p>
          </div>
        ))}
      </div>

    </div>
    </>
  );
}
