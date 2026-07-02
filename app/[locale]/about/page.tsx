import Link from "next/link";
import { Activity, Globe, Database, Zap, Users, User, ArrowLeft, ShieldCheck, Mail, ArrowRight } from "lucide-react";
import type { Metadata } from "next";

const ABOUT_META: Record<string, { title: string; description: string }> = {
  en: {
    title: "About",
    description: "HealthWatch Global aggregates WHO, ECDC, PAHO and Africa CDC outbreak data into a single dashboard, updated every hour. Built for epidemiologists, NGOs, governments and health professionals — in 5 languages.",
  },
  fr: {
    title: "À propos",
    description: "HealthWatch Global agrège les données épidémiques de l'OMS, l'ECDC, l'OPAS et l'Africa CDC en un seul tableau de bord, mis à jour toutes les heures. Conçu pour les épidémiologistes, ONG, gouvernements et professionnels de santé — en 5 langues.",
  },
  es: {
    title: "Acerca de",
    description: "HealthWatch Global agrega datos de brotes de la OMS, ECDC, PAHO y Africa CDC en un solo panel, actualizado cada hora. Diseñado para epidemiólogos, ONG, gobiernos y profesionales de la salud — en 5 idiomas.",
  },
  ar: {
    title: "حول المنصة",
    description: "تجمع HealthWatch Global بيانات تفشي الأمراض من WHO وECDC وPAHO وAfrica CDC في لوحة تحكم واحدة، محدَّثة كل ساعة. مصمَّمة لعلماء الأوبئة والمنظمات غير الحكومية والحكومات والمهنيين الصحيين — بـ 5 لغات.",
  },
  id: {
    title: "Tentang",
    description: "HealthWatch Global memantau wabah penyakit di seluruh dunia menggunakan data resmi WHO, ECDC, PAHO dan Africa CDC. Dibangun untuk ahli epidemiologi, LSM, pemerintah, dan tenaga kesehatan — dalam 5 bahasa.",
  },
};

const LOCALES = ["en", "fr", "es", "ar", "id"] as const;
const OG_LOCALE: Record<string, string> = {
  en: "en_US", fr: "fr_FR", es: "es_ES", ar: "ar_SA", id: "id_ID",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const m = ABOUT_META[locale] ?? ABOUT_META.en;
  const url = `https://healthwatch-global.com/${locale}/about`;

  return {
    title: m.title,
    description: m.description,
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [l, `https://healthwatch-global.com/${l}/about`])),
        "x-default": "https://healthwatch-global.com/en/about",
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

const LABELS: Record<string, {
  back: string;
  title: string;
  subtitle: string;
  founderTitle: string;
  founderText: string;
  missionTitle: string;
  missionText: string;
  whoTitle: string;
  whoText: string;
  howTitle: string;
  howSteps: { title: string; text: string }[];
  usersTitle: string;
  users: { title: string; text: string }[];
  openDataTitle: string;
  openDataText: string;
  contactTitle: string;
  contactText: string;
  contactBtn: string;
}> = {
  fr: {
    back: "← Accueil",
    title: "À propos de HealthWatch Global",
    subtitle: "Surveillance épidémique quotidienne pour un monde plus sûr.",
    founderTitle: "Pourquoi j'ai créé HealthWatch",
    founderText:
      "Passionné depuis plusieurs années par le suivi des grandes dynamiques sanitaires mondiales, je consultais régulièrement les bulletins de l'OMS — et je perdais un temps fou à naviguer entre des pages en anglais, sans filtres, sans alertes, sans vue d'ensemble. J'ai construit HealthWatch pour résoudre ce problème à la source : agréger ces données, les traduire et les structurer pour qu'un professionnel y accède en quelques clics plutôt qu'en heures de recherche manuelle.",
    missionTitle: "Notre mission",
    missionText:
      "HealthWatch Global agrège automatiquement les données officielles de l'OMS, l'ECDC, l'OPAS/PAHO et l'Africa CDC — mises à jour toutes les heures — pour fournir un tableau de bord unique aux épidémiologistes, professionnels de santé, journalistes et organisations qui suivent les foyers épidémiques dès leur déclaration.",
    whoTitle: "10+ sources de données officielles",
    whoText:
      "Toutes les données sont agrégées directement depuis des agences officielles : OMS (DON, AFRO, EMRO), ECDC, OPAS/PAHO, Africa CDC, CDC HAN & Notices, UKHSA, Santé Publique France et USDA APHIS pour les foyers HPAI H5N1 bovins — les mêmes institutions utilisées comme références primaires par les gouvernements et organisations de santé publique. Aucune donnée non vérifiée, aucun média tiers. Mise à jour toutes les heures.",
    howTitle: "Comment ça marche",
    howSteps: [
      { title: "Collecte", text: "Notre pipeline agrège les données officielles de l'OMS, l'ECDC, l'OPAS/PAHO et l'Africa CDC — maladie, pays, cas confirmés, décès et létalité pour chaque foyer." },
      { title: "Géolocalisation", text: "Chaque alerte est associée à un pays et positionnée sur une carte interactive mondiale." },
      { title: "Analyse du risque", text: "Un score de risque (faible / modéré / élevé / critique) est calculé automatiquement selon la létalité et la contagiosité connues de chaque pathogène." },
      { title: "Diffusion", text: "Alertes email par maladie (H5N1, Ebola…) ou par région, intégration Slack / Teams, watchlist de foyers suivis avec notifications de changement, widget embarquable, rapports PDF par foyer, outil de comparaison, et API REST Enterprise." },
    ],
    usersTitle: "Pour qui ?",
    users: [
      { title: "Professionnels de santé", text: "Médecins, infirmiers, épidémiologistes : restez informés des foyers actifs à l'échelle mondiale." },
      { title: "Journalistes & chercheurs", text: "Accédez à des données structurées, sourcées et exportables (CSV, PDF) pour vos travaux." },
      { title: "Risk management & mobilité internationale", text: "Responsables sécurité, risk managers et équipes RH : anticipez les risques sanitaires dans les zones d'opération de vos équipes expatriées." },
      { title: "Voyageurs & expatriés", text: "Consultez les alertes actives avant et pendant vos déplacements à l'étranger." },
      { title: "ONG & organisations humanitaires", text: "Surveillez les régions prioritaires et recevez des alertes ciblées pour réagir rapidement." },
      { title: "Gouvernements & agences", text: "Intégrez les données épidémiques directement dans vos systèmes via notre API REST Enterprise." },
    ],
    openDataTitle: "Open data & transparence",
    openDataText:
      "Nous nous appuyons exclusivement sur des données officielles et publiques. Aucun algorithme de prédiction opaque. Les sources sont toujours citées et liées directement aux bulletins officiels d'origine (OMS, ECDC, OPAS, Africa CDC).",
    contactTitle: "Contact",
    contactText: "Une question, un partenariat, un bug ? Écrivez-nous.",
    contactBtn: "Nous contacter",
  },
  en: {
    back: "← Home",
    title: "About HealthWatch Global",
    subtitle: "Daily epidemic surveillance for a safer world.",
    founderTitle: "Why I built HealthWatch",
    founderText:
      "I've spent years following major global health dynamics out of genuine interest. I'd regularly check WHO bulletins — and kept losing time navigating English-only pages with no filters, no alerts, no overview. I built HealthWatch to fix that at the root: aggregate this data, translate it, and structure it so a professional can access it in a few clicks instead of hours of manual digging.",
    missionTitle: "Our mission",
    missionText:
      "HealthWatch Global automatically aggregates official outbreak data from WHO, ECDC, PAHO, and Africa CDC — updated every hour — to provide a single readable dashboard for epidemiologists, health professionals, journalists and organisations that need to track disease outbreaks the moment they are declared.",
    whoTitle: "10+ official data sources",
    whoText:
      "All outbreak data is aggregated directly from official agencies: WHO (DON, AFRO, EMRO), ECDC, PAHO, Africa CDC, CDC HAN & Notices, UKHSA, Santé Publique France, and USDA APHIS for H5N1 bovine HPAI outbreaks — the same institutions governments and public health organisations use as primary references. No secondary media, no unverified data. Updated every hour.",
    howTitle: "How it works",
    howSteps: [
      { title: "Collection", text: "Our pipeline aggregates official data from WHO, ECDC, PAHO, and Africa CDC — extracting disease, country, confirmed cases, deaths, and CFR for each outbreak." },
      { title: "Geolocation", text: "Each alert is linked to a country and placed on an interactive world map." },
      { title: "Risk analysis", text: "A risk score (low / moderate / high / critical) is automatically calculated based on the known lethality and contagiousness of each pathogen." },
      { title: "Distribution", text: "Disease-specific alerts (H5N1, Ebola…) or regional, Slack / Teams integration, watchlist with change notifications, embeddable widget, per-outbreak PDF reports, comparison tool, and Enterprise REST API." },
    ],
    usersTitle: "Who is it for?",
    users: [
      { title: "Health professionals", text: "Doctors, nurses, epidemiologists: stay informed of active outbreaks worldwide." },
      { title: "Journalists & researchers", text: "Access structured, sourced, exportable data (CSV, PDF) for your work." },
      { title: "Corporate risk & global mobility", text: "Security managers, risk officers and HR teams: anticipate health risks in regions where your employees and expatriates operate." },
      { title: "Travellers & expats", text: "Check active alerts before and during your trips abroad." },
      { title: "NGOs & humanitarian organisations", text: "Monitor priority regions and receive targeted alerts to react quickly." },
      { title: "Governments & agencies", text: "Integrate outbreak data from WHO, ECDC, PAHO & Africa CDC into your systems via our Enterprise REST API." },
    ],
    openDataTitle: "Open data & transparency",
    openDataText:
      "We rely exclusively on official, public data. No opaque prediction algorithms. Sources are always cited and linked directly to the original bulletins (WHO, ECDC, PAHO, Africa CDC).",
    contactTitle: "Contact",
    contactText: "A question, a partnership, a bug? Write to us.",
    contactBtn: "Contact us",
  },
  es: {
    back: "← Inicio",
    title: "Acerca de HealthWatch Global",
    subtitle: "Vigilancia epidémica diaria para un mundo más seguro.",
    founderTitle: "Por qué creé HealthWatch",
    founderText:
      "Llevo años siguiendo de cerca las grandes dinámicas sanitarias mundiales por puro interés. Consultaba regularmente los boletines de la OMS — y perdía mucho tiempo navegando páginas en inglés, sin filtros, sin alertas, sin visión de conjunto. Construí HealthWatch para resolver este problema de raíz: agregar estos datos, traducirlos y estructurarlos para que un profesional acceda a ellos en unos clics en lugar de horas de búsqueda manual.",
    missionTitle: "Nuestra misión",
    missionText:
      "HealthWatch Global agrega automáticamente las alertas oficiales de la OMS, ECDC, PAHO y Africa CDC — actualizadas cada hora — para proporcionar un panel legible a los profesionales de la salud, periodistas y organizaciones que necesitan estar informados sobre brotes de enfermedades en cuanto se declaran.",
    whoTitle: "10+ fuentes de datos oficiales",
    whoText:
      "Todos los datos se agregan directamente desde agencias oficiales: OMS (DON, AFRO, EMRO), ECDC, PAHO, Africa CDC, CDC HAN y Notices, UKHSA, Santé Publique France y USDA APHIS para brotes de H5N1 HPAI bovino — las mismas instituciones utilizadas como referencias primarias por gobiernos e instituciones de salud pública. Sin datos no verificados, sin medios de terceros. Actualizado cada hora.",
    howTitle: "Cómo funciona",
    howSteps: [
      { title: "Recopilación", text: "Nuestro pipeline agrega datos de la OMS, ECDC, PAHO y Africa CDC — extrayendo enfermedad, país, casos confirmados y fallecimientos de cada fuente." },
      { title: "Geolocalización", text: "Cada alerta se asocia a un país y se posiciona en un mapa mundial interactivo." },
      { title: "Análisis de riesgo", text: "Se calcula automáticamente una puntuación de riesgo (bajo / moderado / alto / crítico) según la letalidad y contagiosidad conocidas de cada patógeno." },
      { title: "Distribución", text: "Digest semanal, alertas email regionales instantáneas, integración Slack / Teams para sus equipos y API REST para organizaciones Enterprise." },
    ],
    usersTitle: "¿Para quién?",
    users: [
      { title: "Profesionales de la salud", text: "Médicos, enfermeros, epidemiólogos: manténgase informado sobre los brotes activos en todo el mundo." },
      { title: "Periodistas e investigadores", text: "Acceda a datos estructurados, con fuentes y exportables (CSV, PDF) para sus trabajos." },
      { title: "Gestión de riesgos y movilidad global", text: "Responsables de seguridad, gestores de riesgos y equipos de RRHH: anticipe los riesgos sanitarios en las zonas de operación de sus empleados y expatriados." },
      { title: "Viajeros y expatriados", text: "Consulte las alertas activas antes y durante sus viajes al extranjero." },
      { title: "ONG y organizaciones humanitarias", text: "Monitoree regiones prioritarias y reciba alertas específicas para reaccionar rápidamente." },
      { title: "Gobiernos y agencias", text: "Integre datos de la OMS, ECDC, PAHO y Africa CDC directamente en sus sistemas mediante nuestra API REST Enterprise." },
    ],
    openDataTitle: "Datos abiertos y transparencia",
    openDataText:
      "Nos basamos exclusivamente en datos oficiales y públicos. Sin algoritmos de predicción opacos. Las fuentes siempre se citan y enlazan directamente a los boletines originales de la OMS, ECDC, PAHO y Africa CDC.",
    contactTitle: "Contacto",
    contactText: "¿Una pregunta, una asociación, un error? Escríbenos.",
    contactBtn: "Contáctenos",
  },
  ar: {
    back: "→ الرئيسية",
    title: "حول HealthWatch Global",
    subtitle: "مراقبة الأوبئة اليومية لعالم أكثر أمانًا.",
    founderTitle: "لماذا أنشأت HealthWatch",
    founderText:
      "منذ سنوات وأنا أتابع باهتمام كبير التطورات الصحية الكبرى حول العالم. كنت أطّلع بانتظام على نشرات منظمة الصحة العالمية، وأفقد وقتاً طويلاً في التنقل بين صفحات باللغة الإنجليزية فقط، دون مرشحات أو تنبيهات أو رؤية شاملة. أنشأتُ HealthWatch لحل هذه المشكلة من جذورها: تجميع هذه البيانات وترجمتها وتنظيمها، ليتمكن أي مختص من الوصول إليها خلال نقرات معدودة بدلاً من ساعات من البحث اليدوي.",
    missionTitle: "مهمتنا",
    missionText:
      "تجمع HealthWatch Global تلقائياً التنبيهات الرسمية من WHO وECDC وPAHO وAfrica CDC — محدَّثة كل ساعة — لتوفير لوحة تحكم واضحة للمهنيين الصحيين والصحفيين والمنظمات التي تحتاج إلى إخطار بتفشي الأمراض فور الإعلان عنها.",
    whoTitle: "10+ مصادر بيانات رسمية",
    whoText:
      "تُجمَّع جميع البيانات مباشرة من وكالات رسمية: منظمة الصحة العالمية (DON, AFRO, EMRO)، وECDC، وPAHO، وAfrica CDC، وCDC HAN & Notices، وUKHSA، وSanté Publique France، وUSDA APHIS لحالات تفشي H5N1 HPAI في الأبقار — نفس المؤسسات التي تستخدمها الحكومات ومؤسسات الصحة العامة مرجعاً أساسياً. لا بيانات غير موثقة، لا وسائل إعلام خارجية. تحديث كل ساعة.",
    howTitle: "كيف يعمل",
    howSteps: [
      { title: "الجمع", text: "تستعلم خطوط أنابيبنا واجهة OData لمنظمة الصحة العالمية وتستخرج المعلومات الرئيسية: المرض، البلد، الحالات المؤكدة، الوفيات." },
      { title: "التحديد الجغرافي", text: "يُرتبط كل تنبيه ببلد ويُوضع على خريطة عالمية تفاعلية." },
      { title: "تحليل المخاطر", text: "يُحسب تلقائيًا درجة مخاطرة (منخفضة / متوسطة / عالية / حرجة) بناءً على معدل الفتك والعدوى المعروفَين لكل مسبب مرض." },
      { title: "التوزيع", text: "ملخص أسبوعي، وتنبيهات بريدية إقليمية فورية، وتكامل Slack / Teams لفرقك، وAPI REST للمنظمات Enterprise." },
    ],
    usersTitle: "لمن هو؟",
    users: [
      { title: "المهنيون الصحيون", text: "الأطباء والممرضون وعلماء الأوبئة: ابقَ على اطلاع بالتفشيات النشطة حول العالم." },
      { title: "الصحفيون والباحثون", text: "الوصول إلى بيانات منظمة ومُسنَدة وقابلة للتصدير (CSV، PDF) لأعمالك." },
      { title: "إدارة المخاطر والتنقل الدولي", text: "مسؤولو الأمن ومديرو المخاطر وفرق الموارد البشرية: توقّعوا المخاطر الصحية في مناطق عمليات موظفيكم والمغتربين." },
      { title: "المسافرون والمغتربون", text: "تحقق من التنبيهات النشطة قبل رحلاتك إلى الخارج وخلالها." },
      { title: "المنظمات غير الحكومية والإنسانية", text: "راقب المناطق ذات الأولوية واستقبل تنبيهات مستهدفة للاستجابة السريعة." },
      { title: "الحكومات والوكالات", text: "ادمج بيانات التفشيات (WHO وECDC وPAHO وAfrica CDC) في أنظمتك عبر REST API لخطة Enterprise." },
    ],
    openDataTitle: "البيانات المفتوحة والشفافية",
    openDataText:
      "نعتمد حصريًا على بيانات رسمية وعامة. لا خوارزميات تنبؤ غامضة. المصادر مُستشهَد بها دائمًا ومرتبطة مباشرةً بالنشرات الرسمية الأصلية (WHO وECDC وPAHO وAfrica CDC).",
    contactTitle: "التواصل",
    contactText: "سؤال أو شراكة أو خطأ؟ راسلنا.",
    contactBtn: "تواصل معنا",
  },
  id: {
    back: "← Beranda",
    title: "Tentang HealthWatch Global",
    subtitle: "Pemantauan epidemi harian untuk dunia yang lebih aman.",
    founderTitle: "Mengapa saya membuat HealthWatch",
    founderText:
      "Selama bertahun-tahun saya tertarik mengikuti dinamika kesehatan global yang besar. Saya rutin memeriksa buletin WHO — dan terus kehilangan waktu menavigasi halaman berbahasa Inggris tanpa filter, tanpa peringatan, tanpa gambaran menyeluruh. Saya membangun HealthWatch untuk menyelesaikan masalah ini dari akarnya: mengumpulkan data ini, menerjemahkannya, dan menyusunnya agar seorang profesional bisa mengaksesnya hanya dengan beberapa klik — bukan berjam-jam pencarian manual.",
    missionTitle: "Misi kami",
    missionText:
      "HealthWatch Global mengumpulkan secara otomatis data resmi dari WHO, ECDC, PAHO, dan Africa CDC — diperbarui setiap jam — untuk menyediakan dasbor yang mudah dibaca bagi tenaga kesehatan, jurnalis, dan organisasi yang perlu mendapatkan informasi tentang wabah penyakit segera setelah dideklarasikan.",
    whoTitle: "10+ sumber data resmi",
    whoText:
      "Semua data diagregasi langsung dari lembaga resmi: WHO (DON, AFRO, EMRO), ECDC, PAHO, Africa CDC, CDC HAN & Notices, UKHSA, Santé Publique France, dan USDA APHIS untuk wabah H5N1 HPAI pada sapi — lembaga yang sama yang digunakan pemerintah dan institusi kesehatan masyarakat sebagai referensi utama. Tidak ada data tidak terverifikasi, tidak ada media pihak ketiga. Diperbarui setiap jam.",
    howTitle: "Cara kerjanya",
    howSteps: [
      { title: "Pengumpulan", text: "Pipeline kami mengkueri WHO OData API dan mengekstrak informasi kunci: penyakit, negara, kasus yang dikonfirmasi, kematian." },
      { title: "Geolokasi", text: "Setiap peringatan dikaitkan dengan suatu negara dan ditempatkan di peta dunia interaktif." },
      { title: "Analisis risiko", text: "Skor risiko (rendah / sedang / tinggi / kritis) dihitung secara otomatis berdasarkan tingkat kematian dan penularan patogen yang diketahui." },
      { title: "Distribusi", text: "Digest mingguan, peringatan email regional instan, integrasi Slack / Teams untuk tim Anda, dan REST API untuk organisasi Enterprise." },
    ],
    usersTitle: "Untuk siapa?",
    users: [
      { title: "Tenaga kesehatan", text: "Dokter, perawat, ahli epidemiologi: tetap terinformasi tentang wabah aktif di seluruh dunia." },
      { title: "Jurnalis & peneliti", text: "Akses data terstruktur, bersumber, dan dapat diekspor (CSV, PDF) untuk pekerjaan Anda." },
      { title: "Manajemen risiko & mobilitas global", text: "Manajer keamanan, manajer risiko, dan tim HR: antisipasi risiko kesehatan di wilayah operasi karyawan dan ekspatriat Anda." },
      { title: "Wisatawan & ekspatriat", text: "Periksa peringatan aktif sebelum dan selama perjalanan Anda ke luar negeri." },
      { title: "LSM & organisasi kemanusiaan", text: "Pantau wilayah prioritas dan terima peringatan yang ditargetkan untuk bereaksi dengan cepat." },
      { title: "Pemerintah & lembaga", text: "Integrasikan data wabah WHO, ECDC, PAHO & Africa CDC langsung ke sistem Anda melalui REST API Enterprise kami." },
    ],
    openDataTitle: "Data terbuka & transparansi",
    openDataText:
      "Kami mengandalkan data resmi dan publik secara eksklusif. Tidak ada algoritma prediksi yang tidak transparan. Sumber selalu dikutip dan ditautkan langsung ke buletin resmi asli (WHO, ECDC, PAHO, Africa CDC).",
    contactTitle: "Kontak",
    contactText: "Ada pertanyaan, kemitraan, atau bug? Tulis kepada kami.",
    contactBtn: "Hubungi kami",
  },
};


export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const l = LABELS[locale] ?? LABELS.en;
  const isRtl = locale === "ar";

  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "HealthWatch Global",
    url: "https://healthwatch-global.com",
    logo: "https://healthwatch-global.com/logo.png",
    email: "alerts@healthwatch-global.com",
    description: ABOUT_META[locale]?.description ?? ABOUT_META.en.description,
    sameAs: [
      "https://www.linkedin.com/company/healthwatch-global",
    ],
  };

  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />
    <div className="max-w-3xl mx-auto space-y-12 py-4" dir={isRtl ? "rtl" : undefined}>

      {/* Back */}
      <Link
        href={`/${locale}`}
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className={`w-4 h-4 ${isRtl ? "rotate-180" : ""}`} />
        {l.back}
      </Link>

      {/* Hero */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-red-600/10 border border-red-600/20 flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6 text-red-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">{l.title}</h1>
        </div>
        <p className="text-lg text-gray-400 leading-relaxed">{l.subtitle}</p>
      </div>

      {/* Founder note — the human behind the product */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <User className="w-5 h-5 text-red-400 shrink-0" />
          {l.founderTitle}
        </h2>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 border-l-2 border-l-red-500/40">
          <p className="text-gray-300 leading-relaxed italic">{l.founderText}</p>
        </div>
      </section>

      {/* Mission */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Globe className="w-5 h-5 text-red-400 shrink-0" />
          {l.missionTitle}
        </h2>
        <p className="text-gray-400 leading-relaxed">{l.missionText}</p>
      </section>

      {/* WHO data source */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Database className="w-5 h-5 text-red-400 shrink-0" />
          {l.whoTitle}
        </h2>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
          <p className="text-gray-400 leading-relaxed">{l.whoText}</p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "WHO DON",      href: "https://www.who.int/emergencies/disease-outbreak-news" },
              { label: "ECDC",         href: "https://www.ecdc.europa.eu/en/threats-and-outbreaks" },
              { label: "PAHO",         href: "https://www.paho.org/en/epidemiological-alerts-and-updates" },
              { label: "Africa CDC",   href: "https://africacdc.org/disease-outbreaks/" },
              { label: "CDC HAN",      href: "https://emergency.cdc.gov/han/" },
              { label: "UKHSA",        href: "https://www.gov.uk/government/collections/health-protection-report" },
              { label: "SPF",          href: "https://www.santepubliquefrance.fr/maladies-et-traumatismes/" },
              { label: "USDA APHIS",   href: "https://www.aphis.usda.gov/livestock-poultry-disease/avian/avian-influenza/hpai-detections/livestock" },
            ].map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-950/50 border border-red-800/30 rounded-lg px-2.5 py-1 transition-colors"
              >
                {s.label} <span className="text-xs opacity-60">↗</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-red-400 shrink-0" />
          {l.howTitle}
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {l.howSteps.map((step, i) => (
            <div
              key={i}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-1.5"
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-red-600/20 text-red-400 text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <p className="text-white text-sm font-semibold">{step.title}</p>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Who is it for */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-red-400 shrink-0" />
          {l.usersTitle}
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {l.users.map((u, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-1">
              <p className="text-white text-sm font-semibold">{u.title}</p>
              <p className="text-gray-400 text-sm leading-relaxed">{u.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Open data */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-red-400 shrink-0" />
          {l.openDataTitle}
        </h2>
        <p className="text-gray-400 leading-relaxed">{l.openDataText}</p>
      </section>

      {/* Pro trial CTA */}
      <section className="bg-gradient-to-r from-red-950/40 via-red-900/20 to-transparent border border-red-700/30 rounded-2xl p-8 space-y-4 text-center">
        <p className="text-white font-bold text-xl">
          {locale === "fr" ? "Commencez votre essai Pro — 14 jours gratuits" :
           locale === "es" ? "Inicie su prueba Pro — 14 días gratis" :
           locale === "ar" ? "ابدأ تجربة Pro — 14 يوماً مجانية" :
           locale === "id" ? "Mulai uji coba Pro — 14 hari gratis" :
           "Start your Pro trial — 14 days free"}
        </p>
        <p className="text-gray-400 text-sm">
          {locale === "fr" ? "Sans carte bancaire · Accès immédiat · Annulation à tout moment" :
           locale === "es" ? "Sin tarjeta de crédito · Acceso inmediato · Cancela cuando quieras" :
           locale === "ar" ? "بدون بطاقة بنكية · وصول فوري · إلغاء في أي وقت" :
           locale === "id" ? "Tanpa kartu kredit · Akses langsung · Batalkan kapan saja" :
           "No credit card · Instant access · Cancel anytime"}
        </p>
        <Link
          href={`/${locale}/signup`}
          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-8 py-3 rounded-xl transition-colors text-sm"
        >
          {locale === "fr" ? "Créer mon compte gratuit" :
           locale === "es" ? "Crear cuenta gratuita" :
           locale === "ar" ? "إنشاء حسابي المجاني" :
           locale === "id" ? "Buat akun gratis" :
           "Create my free account"}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* Institutional pilot CTA */}
      <section className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-white font-semibold text-sm">
            {locale === "fr" ? "Vous représentez une organisation ?" : locale === "es" ? "¿Representa una organización?" : locale === "ar" ? "هل تمثل مؤسسة؟" : locale === "id" ? "Mewakili sebuah organisasi?" : "Representing an organization?"}
          </p>
          <p className="text-gray-400 text-xs mt-0.5">
            {locale === "fr" ? "Programme pilote : 5 accès Pro gratuits, 35 jours, pour agences de santé internationales, ONG et ministères." : locale === "es" ? "Programa piloto: 5 accesos Pro gratis, 35 días, para agencias internacionales de salud, ONG y ministerios." : locale === "ar" ? "البرنامج التجريبي: 5 مقاعد Pro مجانية لمدة 35 يوماً لوكالات الصحة الدولية والمنظمات غير الحكومية والوزارات." : locale === "id" ? "Program pilot: 5 akses Pro gratis, 35 hari, untuk lembaga kesehatan internasional, LSM, dan kementerian." : "Pilot program: 5 free Pro seats, 35 days, for international health agencies, NGOs and ministries."}
          </p>
        </div>
        <Link
          href={`/${locale}/pilot`}
          className="shrink-0 text-xs bg-amber-600 hover:bg-amber-500 text-white font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          {locale === "fr" ? "En savoir plus →" : locale === "es" ? "Más información →" : locale === "ar" ? "← اكتشف المزيد" : locale === "id" ? "Pelajari lebih →" : "Learn more →"}
        </Link>
      </section>

      {/* Contact CTA */}
      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-red-400 shrink-0" />
          <h2 className="text-lg font-semibold text-white">{l.contactTitle}</h2>
        </div>
        <p className="text-gray-400 text-sm">{l.contactText}</p>
        <Link
          href={`/${locale}/contact`}
          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
        >
          <Mail className="w-4 h-4" />
          {l.contactBtn}
        </Link>
      </section>

    </div>
    </>
  );
}
