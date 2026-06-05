import Link from "next/link";
import {
  ArrowRight, Activity, Globe, Bell, Shield, FileText,
  Zap, Clock, CheckCircle, AlertTriangle, Building2,
  HeartHandshake, Microscope, Stethoscope, Landmark, Radio,
} from "lucide-react";
import { getOutbreaks, getStats, getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import RiskBadge from "@/components/RiskBadge";
import NewsletterSubscribeForm from "@/components/NewsletterSubscribeForm";

// ─── Multilingual copy ────────────────────────────────────────────────────────

const COPY: Record<string, {
  // Hero
  heroBadge: string;
  heroTitle: string[];   // split in two to allow gradient on second line
  heroSub: string;
  heroCta: string;
  heroCtaSecondary: string;
  heroNoCc: string;
  // Stats bar
  statOutbreaks: string;
  statCountries: string;
  statHighRisk: string;
  statUpdated: string;
  // Problem
  problemTitle: string;
  problemSub: string;
  problemStats: { value: string; label: string }[];
  // Preview
  previewTitle: string;
  previewSub: string;
  previewLive: string;
  previewCols: { disease: string; country: string; risk: string };
  // Features
  featuresTitle: string;
  features: { title: string; desc: string }[];
  // How it works
  howTitle: string;
  steps: { title: string; desc: string }[];
  // Orgs
  orgsTitle: string;
  orgs: string[];
  // Pricing
  pricingTitle: string;
  pricingFree: string;
  pricingPro: string;
  pricingEnterprise: string;
  pricingFreeSub: string;
  pricingProSub: string;
  pricingEnterpriseSub: string;
  pricingCta: string;
  // Newsletter
  newsletterTitle:   string;
  newsletterSub:     string;
  newsletterPlaceholder: string;
  newsletterRegionLabel: string;
  newsletterRegions: Record<string, string>;
  newsletterSubmit:  string;
  newsletterSuccess: string;
  newsletterSuccessSub: string;
  newsletterFine:    string;
  newsletterError:   string;
  // Final CTA
  ctaTitle: string;
  ctaSub: string;
  ctaButton: string;
  ctaNoCc: string;
}> = {
  fr: {
    heroBadge: "Données OMS en direct · 195 pays · Mis à jour quotidiennement",
    heroTitle: ["Anticipez les épidémies.", "Ne réagissez plus."],
    heroSub: "Un foyer non détecté à temps peut coûter à votre organisation des semaines de crise. HealthWatch Global livre à vos équipes des données en avance sur les événements — directement depuis l'OMS.",
    heroCta: "Créer un compte gratuit",
    heroCtaSecondary: "Voir les tarifs",
    heroNoCc: "Gratuit · Sans carte bancaire",
    statOutbreaks: "foyers actifs",
    statCountries: "pays touchés",
    statHighRisk: "alertes haut risque",
    statUpdated: "Mis à jour quotidiennement",
    problemTitle: "L'OMS déclare 15 à 25 nouveaux foyers chaque mois.",
    problemSub: "La plupart des organisations de santé l'apprennent trop tard — après que les médias locaux en aient parlé, après que les équipes terrain aient signalé les premiers cas. HealthWatch Global renverse ce délai.",
    problemStats: [
      { value: "15–25", label: "nouveaux foyers OMS / mois" },
      { value: "72h", label: "délai moyen avant détection terrain" },
      { value: "× 10", label: "coût d'une crise réactive vs anticipée" },
    ],
    previewTitle: "Ce que vos équipes verront en temps réel",
    previewSub: "Les données ci-dessous sont réelles et actualisées depuis l'API WHO Disease Outbreak News.",
    previewLive: "En direct",
    previewCols: { disease: "Maladie", country: "Pays", risk: "Risque" },
    featuresTitle: "Tout ce dont votre équipe a besoin",
    features: [
      { title: "Alertes par maladie", desc: "Abonnez-vous à H5N1, Ebola, Mpox… Recevez un email en moins de 6h dès qu'un foyer est détecté n'importe où dans le monde." },
      { title: "Badge PHEIC & corroboration", desc: "Le badge 🚨 PHEIC apparaît sur chaque urgence sanitaire internationale déclarée par l'OMS. 🔁 WHO+ProMED confirme les foyers multi-sources." },
      { title: "Taux de létalité & incidence", desc: "CFR calculé automatiquement. Incidence pour 100 000 habitants — données de population ONU intégrées pour 150 pays." },
      { title: "Comparaison de foyers", desc: "Ebola RDC 2026 vs Uganda : cas, décès, CFR, incidence côte à côte. Partagez l'URL directement avec vos collègues." },
      { title: "Watchlist & notifications", desc: "Suivez ⭐ jusqu'à 20 foyers spécifiques. Notification automatique par email dès que les chiffres changent." },
      { title: "PDF one-pager & widget", desc: "Rapport PDF professionnel par foyer en 1 clic. Widget embarquable pour votre site. PNG partageable pour WhatsApp et Slack." },
    ],
    howTitle: "Opérationnel en 3 minutes",
    steps: [
      { title: "Créez votre compte", desc: "Inscription en 30 secondes. Aucune carte bancaire requise. Accès immédiat au tableau de bord." },
      { title: "Configurez vos régions", desc: "Sélectionnez les zones géographiques que vous surveillez et recevez votre premier digest dès la semaine suivante." },
      { title: "Passez Pro pour les alertes temps réel", desc: "Débloquez le flux en direct, les rapports PDF et l'export CSV — et restez en avance sur chaque crise." },
    ],
    orgsTitle: "Conçu pour",
    orgs: ["Ministères de la Santé", "ONG Internationales", "Instituts de Recherche", "Hôpitaux & Cliniques"],
    pricingTitle: "Commencez gratuitement. Évoluez quand vous en avez besoin.",
    pricingFree: "Gratuit",
    pricingPro: "49 € /mois",
    pricingEnterprise: "Sur devis",
    pricingFreeSub: "Carte mondiale · 1 région · Digest hebdo",
    pricingProSub: "Toutes régions · Alertes · PDF · CSV · Slack",
    pricingEnterpriseSub: "API · On-premise · SLA 99,9 %",
    pricingCta: "Voir tous les tarifs →",
    newsletterTitle: "Restez informé — gratuitement",
    newsletterSub: "Le digest hebdomadaire des foyers actifs, filtré par région, directement dans votre boîte mail.",
    newsletterPlaceholder: "votre@organisation.com",
    newsletterRegionLabel: "Région",
    newsletterRegions: { allRegions: "Toutes les régions", africa: "Afrique", asia: "Asie", europe: "Europe", americas: "Amériques", oceania: "Océanie" },
    newsletterSubmit: "S'abonner",
    newsletterSuccess: "Vous êtes abonné(e) !",
    newsletterSuccessSub: "Vérifiez votre boîte mail pour confirmer votre inscription.",
    newsletterFine: "Gratuit · Sans carte bancaire · Désabonnement en 1 clic",
    newsletterError: "Une erreur est survenue. Réessayez.",
    ctaTitle: "Votre organisation est-elle prête pour la prochaine épidémie ?",
    ctaSub: "Rejoignez les équipes qui suivent les crises sanitaires mondiales en temps réel.",
    ctaButton: "Démarrer gratuitement",
    ctaNoCc: "Sans carte bancaire · Accès immédiat",
  },
  en: {
    heroBadge: "Live WHO data · 195 countries · Updated daily",
    heroTitle: ["Anticipate outbreaks.", "Stop reacting."],
    heroSub: "An undetected outbreak can cost your organization weeks of crisis management. HealthWatch Global delivers real-time intelligence to your teams — directly from the WHO.",
    heroCta: "Create free account",
    heroCtaSecondary: "See pricing",
    heroNoCc: "Free · No credit card required",
    statOutbreaks: "active outbreaks",
    statCountries: "countries affected",
    statHighRisk: "high-risk alerts",
    statUpdated: "Updated daily",
    problemTitle: "The WHO declares 15–25 new outbreaks every month.",
    problemSub: "Most health organizations learn too late — after local media, after field teams report first cases. HealthWatch Global reverses that delay.",
    problemStats: [
      { value: "15–25", label: "new WHO outbreaks / month" },
      { value: "72h", label: "average detection lag" },
      { value: "× 10", label: "cost of reactive vs. anticipatory response" },
    ],
    previewTitle: "What your teams will see in real time",
    previewSub: "The data below is live and sourced directly from the WHO Disease Outbreak News API.",
    previewLive: "Live",
    previewCols: { disease: "Disease", country: "Country", risk: "Risk" },
    featuresTitle: "Everything your team needs",
    features: [
      { title: "Disease-specific alerts", desc: "Subscribe to H5N1, Ebola, Mpox… Get an email within 6 hours whenever an outbreak is detected anywhere in the world." },
      { title: "PHEIC badge & corroboration", desc: "🚨 PHEIC badge on every WHO-declared public health emergency. 🔁 WHO+ProMED confirms multi-source outbreaks." },
      { title: "CFR & incidence rate", desc: "Case fatality rate calculated automatically. Incidence per 100,000 with UN population data for 150 countries." },
      { title: "Outbreak comparison", desc: "Ebola DRC vs Uganda 2026: cases, deaths, CFR, incidence side by side. Share the URL directly with colleagues." },
      { title: "Watchlist & notifications", desc: "Star ⭐ up to 20 specific outbreaks. Automatic email when figures change — never miss an escalation." },
      { title: "PDF reports & embeddable widget", desc: "Professional PDF per outbreak in 1 click. Embeddable iframe widget for your site. PNG card for WhatsApp and Slack." },
    ],
    howTitle: "Up and running in 3 minutes",
    steps: [
      { title: "Create your account", desc: "Sign up in 30 seconds. No credit card required. Immediate dashboard access." },
      { title: "Configure your regions", desc: "Select the geographies you monitor and receive your first digest the following week." },
      { title: "Go Pro for real-time alerts", desc: "Unlock the live feed, PDF reports, and CSV export — and stay ahead of every crisis." },
    ],
    orgsTitle: "Designed for",
    orgs: ["Health Ministries", "International NGOs", "Research Institutes", "Hospitals & Clinics"],
    pricingTitle: "Start free. Scale when you need to.",
    pricingFree: "Free",
    pricingPro: "$49 /month",
    pricingEnterprise: "Custom",
    pricingFreeSub: "World map · 1 region · Weekly digest",
    pricingProSub: "All regions · Alerts · PDF · CSV · Slack",
    pricingEnterpriseSub: "API · On-premise · 99.9% SLA",
    pricingCta: "See all plans →",
    newsletterTitle: "Stay informed — for free",
    newsletterSub: "A weekly digest of active outbreaks, filtered by region, delivered straight to your inbox.",
    newsletterPlaceholder: "you@organization.com",
    newsletterRegionLabel: "Region",
    newsletterRegions: { allRegions: "All regions", africa: "Africa", asia: "Asia", europe: "Europe", americas: "Americas", oceania: "Oceania" },
    newsletterSubmit: "Subscribe",
    newsletterSuccess: "You're subscribed!",
    newsletterSuccessSub: "Check your inbox to confirm your subscription.",
    newsletterFine: "Free · No credit card · Unsubscribe in 1 click",
    newsletterError: "Something went wrong. Please try again.",
    ctaTitle: "Is your organization ready for the next outbreak?",
    ctaSub: "Join teams monitoring global health crises in real time.",
    ctaButton: "Get started free",
    ctaNoCc: "No credit card · Instant access",
  },
  es: {
    heroBadge: "Datos OMS en vivo · 195 países · Actualizado diariamente",
    heroTitle: ["Anticipe los brotes.", "Deje de reaccionar."],
    heroSub: "Un brote no detectado puede costarle a su organización semanas de gestión de crisis. HealthWatch Global entrega inteligencia en tiempo real a sus equipos — directamente desde la OMS.",
    heroCta: "Crear cuenta gratuita",
    heroCtaSecondary: "Ver precios",
    heroNoCc: "Gratis · Sin tarjeta de crédito",
    statOutbreaks: "brotes activos",
    statCountries: "países afectados",
    statHighRisk: "alertas de alto riesgo",
    statUpdated: "Actualizado diariamente",
    problemTitle: "La OMS declara entre 15 y 25 nuevos brotes cada mes.",
    problemSub: "La mayoría de las organizaciones de salud lo descubren demasiado tarde. HealthWatch Global invierte ese retraso.",
    problemStats: [
      { value: "15–25", label: "nuevos brotes OMS / mes" },
      { value: "72h", label: "retraso promedio de detección" },
      { value: "× 10", label: "coste de respuesta reactiva vs. anticipada" },
    ],
    previewTitle: "Lo que sus equipos verán en tiempo real",
    previewSub: "Los datos a continuación son reales y provienen directamente de la API WHO Disease Outbreak News.",
    previewLive: "En vivo",
    previewCols: { disease: "Enfermedad", country: "País", risk: "Riesgo" },
    featuresTitle: "Todo lo que su equipo necesita",
    features: [
      { title: "Alertas por enfermedad", desc: "Suscríbase a H5N1, Ébola, Mpox… Reciba un email en menos de 6h cuando se detecte un brote en cualquier parte del mundo." },
      { title: "Insignia PHEIC & corroboración", desc: "🚨 PHEIC en cada emergencia sanitaria internacional de la OMS. 🔁 WHO+ProMED confirma brotes de múltiples fuentes." },
      { title: "Tasa de letalidad & incidencia", desc: "CFR calculado automáticamente. Incidencia por 100.000 habitantes con datos de población de la ONU para 150 países." },
      { title: "Comparación de brotes", desc: "Ébola RDC vs Uganda: casos, muertes, CFR, incidencia lado a lado. Comparta la URL directamente con colegas." },
      { title: "Lista de seguimiento & notificaciones", desc: "Marque ⭐ hasta 20 brotes. Notificación automática por email cuando cambian las cifras." },
      { title: "Informes PDF & widget embebible", desc: "Informe PDF profesional por brote con 1 clic. Widget iframe para su sitio. Tarjeta PNG para WhatsApp y Slack." },
    ],
    howTitle: "Operativo en 3 minutos",
    steps: [
      { title: "Cree su cuenta", desc: "Registro en 30 segundos. Sin tarjeta de crédito. Acceso inmediato al panel." },
      { title: "Configure sus regiones", desc: "Seleccione las geografías que monitorea y reciba su primer digest la semana siguiente." },
      { title: "Pase a Pro para alertas en tiempo real", desc: "Desbloquee el flujo en vivo, informes PDF y exportación CSV." },
    ],
    orgsTitle: "Diseñado para",
    orgs: ["Ministerios de Salud", "ONG Internacionales", "Institutos de Investigación", "Hospitales & Clínicas"],
    pricingTitle: "Empiece gratis. Escale cuando lo necesite.",
    pricingFree: "Gratis",
    pricingPro: "$49 /mes",
    pricingEnterprise: "A medida",
    pricingFreeSub: "Mapa mundial · 1 región · Digest semanal",
    pricingProSub: "Todas las regiones · Alertas · PDF · CSV · Slack",
    pricingEnterpriseSub: "API · On-premise · SLA 99,9%",
    pricingCta: "Ver todos los planes →",
    newsletterTitle: "Manténgase informado — gratis",
    newsletterSub: "Un resumen semanal de brotes activos, filtrado por región, directo a su bandeja de entrada.",
    newsletterPlaceholder: "usted@organización.com",
    newsletterRegionLabel: "Región",
    newsletterRegions: { allRegions: "Todas las regiones", africa: "África", asia: "Asia", europe: "Europa", americas: "Américas", oceania: "Oceanía" },
    newsletterSubmit: "Suscribirse",
    newsletterSuccess: "¡Está suscrito!",
    newsletterSuccessSub: "Revise su bandeja de entrada para confirmar su suscripción.",
    newsletterFine: "Gratis · Sin tarjeta · Cancelar en 1 clic",
    newsletterError: "Algo salió mal. Por favor, inténtelo de nuevo.",
    ctaTitle: "¿Está su organización lista para el próximo brote?",
    ctaSub: "Únase a los equipos que monitorean las crisis sanitarias mundiales en tiempo real.",
    ctaButton: "Comenzar gratis",
    ctaNoCc: "Sin tarjeta de crédito · Acceso inmediato",
  },
  ar: {
    heroBadge: "بيانات منظمة الصحة العالمية مباشرة · 195 دولة · تحديث يومي",
    heroTitle: ["استبق التفشيات.", "توقف عن التفاعل."],
    heroSub: "تفشٍّ واحد غير مكتشف في الوقت المناسب قد يُكلِّف منظمتك أسابيع من إدارة الأزمات. توفر HealthWatch Global بيانات استخباراتية فورية لفرقك مباشرةً من منظمة الصحة العالمية.",
    heroCta: "إنشاء حساب مجاني",
    heroCtaSecondary: "عرض الأسعار",
    heroNoCc: "مجاني · لا بطاقة بنكية مطلوبة",
    statOutbreaks: "تفشيات نشطة",
    statCountries: "دول متضررة",
    statHighRisk: "تنبيهات عالية الخطورة",
    statUpdated: "تحديث يومي",
    problemTitle: "تُعلن منظمة الصحة العالمية عن 15 إلى 25 تفشياً جديداً كل شهر.",
    problemSub: "معظم منظمات الصحة تعلم متأخرة. HealthWatch Global تعكس هذا التأخير.",
    problemStats: [
      { value: "15–25", label: "تفشيات جديدة / شهر" },
      { value: "72 ساعة", label: "متوسط وقت الكشف" },
      { value: "× 10", label: "تكلفة الاستجابة التفاعلية مقابل الاستباقية" },
    ],
    previewTitle: "ما ستراه فرقك في الوقت الفعلي",
    previewSub: "البيانات أدناه حقيقية ومُحدَّثة مباشرةً من API أخبار تفشي أمراض منظمة الصحة العالمية.",
    previewLive: "مباشر",
    previewCols: { disease: "المرض", country: "الدولة", risk: "الخطر" },
    featuresTitle: "كل ما يحتاجه فريقك",
    features: [
      { title: "تنبيهات الأمراض", desc: "اشترك في H5N1 أو إيبولا أو جدري القرود… واستقبل بريداً إلكترونياً خلال 6 ساعات عند اكتشاف أي تفشٍّ في العالم." },
      { title: "شارة PHEIC والتحقق المزدوج", desc: "🚨 شارة PHEIC على كل حالة طوارئ تُعلنها OMS. 🔁 WHO+ProMED يؤكد التفشيات متعددة المصادر." },
      { title: "معدل الوفيات والإصابة", desc: "CFR يُحسب تلقائياً. معدل الإصابة لكل 100,000 نسمة مع بيانات سكان الأمم المتحدة لـ 150 دولة." },
      { title: "مقارنة التفشيات", desc: "إيبولا في الكونغو مقابل أوغندا: الحالات والوفيات ومعدل الوفيات والإصابة جنباً إلى جنب. شارك الرابط مع زملائك." },
      { title: "قائمة المراقبة والإشعارات", desc: "تتبع ⭐ حتى 20 تفشياً. إشعار تلقائي بالبريد عند تغيير الأرقام." },
      { title: "تقارير PDF وويدجت", desc: "تقرير PDF احترافي لكل تفشٍّ بنقرة واحدة. ويدجت قابل للتضمين في موقعك. بطاقة PNG للمشاركة." },
    ],
    howTitle: "جاهز للعمل في 3 دقائق",
    steps: [
      { title: "أنشئ حسابك", desc: "التسجيل في 30 ثانية. لا بطاقة بنكية. وصول فوري للوحة التحكم." },
      { title: "حدد مناطقك", desc: "اختر المناطق الجغرافية التي تراقبها واستقبل أول ملخص الأسبوع التالي." },
      { title: "انتقل إلى Pro للتنبيهات الفورية", desc: "افتح البث المباشر وتقارير PDF وتصدير CSV." },
    ],
    orgsTitle: "مصمم لـ",
    orgs: ["وزارات الصحة", "المنظمات غير الحكومية الدولية", "معاهد البحوث", "المستشفيات والعيادات"],
    pricingTitle: "ابدأ مجاناً. طوِّر عندما تحتاج.",
    pricingFree: "مجاني",
    pricingPro: "49$ / شهر",
    pricingEnterprise: "حسب الطلب",
    pricingFreeSub: "خريطة عالمية · منطقة واحدة · ملخص أسبوعي",
    pricingProSub: "جميع المناطق · تنبيهات · PDF · CSV · Slack",
    pricingEnterpriseSub: "API · نشر محلي · SLA 99.9%",
    pricingCta: "عرض جميع الخطط ←",
    newsletterTitle: "ابقَ على اطلاع — مجاناً",
    newsletterSub: "ملخص أسبوعي بالتفشيات النشطة، مصفى حسب المنطقة، يصل مباشرة إلى بريدك الإلكتروني.",
    newsletterPlaceholder: "أنت@منظمة.com",
    newsletterRegionLabel: "المنطقة",
    newsletterRegions: { allRegions: "جميع المناطق", africa: "أفريقيا", asia: "آسيا", europe: "أوروبا", americas: "الأمريكتان", oceania: "أوقيانوسيا" },
    newsletterSubmit: "اشترك",
    newsletterSuccess: "تم اشتراكك!",
    newsletterSuccessSub: "تحقق من بريدك الإلكتروني لتأكيد اشتراكك.",
    newsletterFine: "مجاني · بدون بطاقة · إلغاء الاشتراك بنقرة واحدة",
    newsletterError: "حدث خطأ. يرجى المحاولة مجدداً.",
    ctaTitle: "هل منظمتك مستعدة للتفشي القادم؟",
    ctaSub: "انضم إلى الفرق التي تراقب الأزمات الصحية العالمية في الوقت الفعلي.",
    ctaButton: "ابدأ مجاناً",
    ctaNoCc: "بدون بطاقة بنكية · وصول فوري",
  },
  id: {
    heroBadge: "Data WHO langsung · 195 negara · Diperbarui setiap hari",
    heroTitle: ["Antisipasi wabah.", "Berhenti bereaksi."],
    heroSub: "Wabah yang tidak terdeteksi tepat waktu dapat menelan biaya berminggu-minggu krisis bagi organisasi Anda. HealthWatch Global memberikan intelijen real-time kepada tim Anda — langsung dari WHO.",
    heroCta: "Buat akun gratis",
    heroCtaSecondary: "Lihat harga",
    heroNoCc: "Gratis · Tanpa kartu kredit",
    statOutbreaks: "wabah aktif",
    statCountries: "negara terdampak",
    statHighRisk: "peringatan risiko tinggi",
    statUpdated: "Diperbarui setiap hari",
    problemTitle: "WHO mendeklarasikan 15–25 wabah baru setiap bulan.",
    problemSub: "Sebagian besar organisasi kesehatan mengetahuinya terlambat. HealthWatch Global membalik keterlambatan itu.",
    problemStats: [
      { value: "15–25", label: "wabah WHO baru / bulan" },
      { value: "72 jam", label: "rata-rata jeda deteksi" },
      { value: "× 10", label: "biaya respons reaktif vs. antisipatif" },
    ],
    previewTitle: "Yang akan dilihat tim Anda secara real-time",
    previewSub: "Data di bawah ini nyata dan bersumber langsung dari API WHO Disease Outbreak News.",
    previewLive: "Langsung",
    previewCols: { disease: "Penyakit", country: "Negara", risk: "Risiko" },
    featuresTitle: "Semua yang dibutuhkan tim Anda",
    features: [
      { title: "Peringatan per penyakit", desc: "Berlangganan H5N1, Ebola, Mpox… Terima email dalam 6 jam ketika wabah terdeteksi di mana saja di dunia." },
      { title: "Lencana PHEIC & korroborasi", desc: "🚨 PHEIC pada setiap darurat kesehatan WHO. 🔁 WHO+ProMED mengonfirmasi wabah multi-sumber." },
      { title: "CFR & tingkat insidensi", desc: "CFR dihitung otomatis. Insidensi per 100.000 penduduk dengan data populasi PBB untuk 150 negara." },
      { title: "Perbandingan wabah", desc: "Ebola RDC vs Uganda: kasus, kematian, CFR, insidensi berdampingan. Bagikan URL langsung ke kolega." },
      { title: "Daftar pantau & notifikasi", desc: "Tandai ⭐ hingga 20 wabah. Email otomatis ketika angka berubah — tidak ada eskalasi yang terlewat." },
      { title: "Laporan PDF & widget embeddable", desc: "PDF profesional per wabah dengan 1 klik. Widget iframe untuk situs Anda. Kartu PNG untuk WhatsApp dan Slack." },
    ],
    howTitle: "Siap dalam 3 menit",
    steps: [
      { title: "Buat akun Anda", desc: "Daftar dalam 30 detik. Tanpa kartu kredit. Akses dasbor langsung." },
      { title: "Konfigurasi wilayah Anda", desc: "Pilih geografi yang Anda pantau dan terima digest pertama minggu berikutnya." },
      { title: "Upgrade ke Pro untuk peringatan real-time", desc: "Buka umpan langsung, laporan PDF, dan ekspor CSV." },
    ],
    orgsTitle: "Dirancang untuk",
    orgs: ["Kementerian Kesehatan", "LSM Internasional", "Lembaga Penelitian", "Rumah Sakit & Klinik"],
    pricingTitle: "Mulai gratis. Kembangkan saat dibutuhkan.",
    pricingFree: "Gratis",
    pricingPro: "$49 /bulan",
    pricingEnterprise: "Kustom",
    pricingFreeSub: "Peta dunia · 1 wilayah · Digest mingguan",
    pricingProSub: "Semua wilayah · Peringatan · PDF · CSV · Slack",
    pricingEnterpriseSub: "API · On-premise · SLA 99,9%",
    pricingCta: "Lihat semua paket →",
    newsletterTitle: "Tetap terinformasi — gratis",
    newsletterSub: "Ringkasan mingguan wabah aktif, difilter berdasarkan wilayah, langsung ke kotak masuk Anda.",
    newsletterPlaceholder: "anda@organisasi.com",
    newsletterRegionLabel: "Wilayah",
    newsletterRegions: { allRegions: "Semua wilayah", africa: "Afrika", asia: "Asia", europe: "Eropa", americas: "Amerika", oceania: "Oseania" },
    newsletterSubmit: "Berlangganan",
    newsletterSuccess: "Anda sudah berlangganan!",
    newsletterSuccessSub: "Periksa kotak masuk Anda untuk mengonfirmasi langganan.",
    newsletterFine: "Gratis · Tanpa kartu · Berhenti berlangganan dalam 1 klik",
    newsletterError: "Terjadi kesalahan. Silakan coba lagi.",
    ctaTitle: "Apakah organisasi Anda siap untuk wabah berikutnya?",
    ctaSub: "Bergabunglah dengan tim yang memantau krisis kesehatan global secara real-time.",
    ctaButton: "Mulai gratis",
    ctaNoCc: "Tanpa kartu kredit · Akses langsung",
  },
};

const ORG_ICONS = [Landmark, HeartHandshake, Microscope, Stethoscope];

// ─── Component ────────────────────────────────────────────────────────────────

export default async function LandingPage({ locale }: { locale: string }) {
  const c = COPY[locale] ?? COPY.en;
  const isRtl = locale === "ar";

  const outbreaks = await getOutbreaks();
  const stats = getStats(outbreaks);
  const topOutbreaks = outbreaks
    .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.risk_level] - { high: 0, medium: 1, low: 2 }[b.risk_level]))
    .slice(0, 5);

  return (
    <div className="space-y-24" dir={isRtl ? "rtl" : undefined}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-8 pb-4">
        {/* Glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-red-600/8 blur-[120px] rounded-full" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-red-600/10 border border-red-600/20 rounded-full px-4 py-1.5 text-xs text-red-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            {c.heroBadge}
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight">
            <span className="text-white">{c.heroTitle[0]}</span>
            <br />
            <span className="text-red-500">{c.heroTitle[1]}</span>
          </h1>

          <p className="text-gray-400 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
            {c.heroSub}
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href={`/${locale}/signup`}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-8 py-4 rounded-xl transition-all shadow-lg shadow-red-900/30 text-sm"
            >
              {c.heroCta}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href={`/${locale}/pricing`}
              className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold px-8 py-4 rounded-xl transition-colors text-sm"
            >
              {c.heroCtaSecondary}
            </Link>
          </div>
          <p className="text-xs text-gray-600">{c.heroNoCc}</p>

          {/* Live stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {[
              { value: stats.activeOutbreaks, label: c.statOutbreaks, icon: Activity, color: "text-red-400" },
              { value: stats.countriesAffected, label: c.statCountries, icon: Globe, color: "text-blue-400" },
              { value: stats.highRisk, label: c.statHighRisk, icon: AlertTriangle, color: "text-yellow-400" },
              { value: c.statUpdated, label: "", icon: Clock, color: "text-green-400" },
            ].map(({ value, label, icon: Icon, color }, i) => (
              <div key={i} className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 text-center">
                <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                {label && <p className="text-xs text-gray-500 mt-0.5">{label}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Problem ──────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto space-y-10">
        <div className="text-center space-y-4">
          <h2 className="text-2xl md:text-3xl font-bold text-white">{c.problemTitle}</h2>
          <p className="text-gray-400 max-w-2xl mx-auto leading-relaxed">{c.problemSub}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {c.problemStats.map(({ value, label }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center space-y-2">
              <p className="text-4xl font-extrabold text-red-400">{value}</p>
              <p className="text-sm text-gray-400">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Live data preview ─────────────────────────────────────────────── */}
      <section className="space-y-5">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1 text-xs text-green-400 font-medium">
            <Radio className="w-3.5 h-3.5" />
            {c.previewLive}
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white">{c.previewTitle}</h2>
          <p className="text-gray-400 text-sm max-w-xl mx-auto">{c.previewSub}</p>
        </div>

        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 border-b border-gray-800">
              <tr>
                <th className="text-left px-5 py-3 font-medium">{c.previewCols.disease}</th>
                <th className="text-left px-5 py-3 font-medium">{c.previewCols.country}</th>
                <th className="text-left px-5 py-3 font-medium">{c.previewCols.risk}</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {topOutbreaks.map((outbreak, i) => (
                <tr key={outbreak.id} className={`border-t border-gray-800 ${i % 2 === 0 ? "bg-gray-900/20" : ""}`}>
                  <td className="px-5 py-3 font-medium text-white">{getLocalizedDisease(outbreak, locale)}</td>
                  <td className="px-5 py-3 text-gray-300">{getLocalizedCountry(outbreak, locale)}</td>
                  <td className="px-5 py-3"><RiskBadge level={outbreak.risk_level as "high" | "medium" | "low"} /></td>
                  <td className="px-5 py-3 text-right">
                    <span className="blur-sm select-none text-gray-500 text-xs">
                      {outbreak.cases.toLocaleString()} {locale === "fr" ? "cas" : locale === "es" ? "casos" : locale === "ar" ? "حالة" : locale === "id" ? "kasus" : "cases"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="bg-gray-900/60 border-t border-gray-800 px-5 py-3 flex items-center justify-between">
            <span className="text-xs text-gray-500">Source : WHO Disease Outbreak News</span>
            <Link href={`/${locale}/signup`} className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors">
              {c.heroCta} →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="space-y-10">
        <h2 className="text-2xl md:text-3xl font-bold text-white text-center">{c.featuresTitle}</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {c.features.map(({ title, desc }, i) => {
            const icons = [Globe, Radio, FileText, Bell, Globe, Activity];
            const colors = ["text-blue-400", "text-red-400", "text-purple-400", "text-yellow-400", "text-green-400", "text-orange-400"];
            const bgs = ["bg-blue-500/10 border-blue-500/20", "bg-red-500/10 border-red-500/20", "bg-purple-500/10 border-purple-500/20", "bg-yellow-500/10 border-yellow-500/20", "bg-green-500/10 border-green-500/20", "bg-orange-500/10 border-orange-500/20"];
            const Icon = icons[i] ?? Activity;
            return (
              <div key={title} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3 hover:border-gray-600 transition-colors">
                <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${bgs[i]}`}>
                  <Icon className={`w-5 h-5 ${colors[i]}`} />
                </div>
                <h3 className="font-semibold text-white">{title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto space-y-10">
        <h2 className="text-2xl md:text-3xl font-bold text-white text-center">{c.howTitle}</h2>
        <div className="space-y-4">
          {c.steps.map(({ title, desc }, i) => (
            <div key={title} className="flex gap-5 bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors">
              <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {i + 1}
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-white">{title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Designed for ─────────────────────────────────────────────────── */}
      <section className="space-y-6">
        <p className="text-center text-xs text-gray-500 uppercase tracking-widest font-semibold">{c.orgsTitle}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {c.orgs.map((org, i) => {
            const Icon = ORG_ICONS[i];
            return (
              <div key={org} className="flex flex-col items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-600 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-red-400" />
                </div>
                <p className="text-sm text-gray-300 font-medium text-center">{org}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Pricing teaser ───────────────────────────────────────────────── */}
      <section className="space-y-8">
        <h2 className="text-2xl md:text-3xl font-bold text-white text-center">{c.pricingTitle}</h2>
        <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {[
            { name: c.pricingFree, price: "", sub: c.pricingFreeSub, icon: CheckCircle, color: "text-green-400", border: "border-gray-800" },
            { name: "Pro", price: c.pricingPro, sub: c.pricingProSub, icon: Shield, color: "text-red-400", border: "border-2 border-red-500" },
            { name: "Enterprise", price: c.pricingEnterprise, sub: c.pricingEnterpriseSub, icon: Zap, color: "text-purple-400", border: "border-gray-800" },
          ].map(({ name, price, sub, icon: Icon, color, border }) => (
            <div key={name} className={`bg-gray-900 ${border} rounded-xl p-5 space-y-3`}>
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className={`font-bold text-sm ${color}`}>{name}</span>
              </div>
              <p className="text-2xl font-bold text-white">{price || <span className="text-green-400">0 €</span>}</p>
              <p className="text-xs text-gray-400">{sub}</p>
            </div>
          ))}
        </div>
        <div className="text-center">
          <Link href={`/${locale}/pricing`} className="text-sm text-red-400 hover:text-red-300 font-semibold transition-colors">
            {c.pricingCta}
          </Link>
        </div>
      </section>

      {/* ── Newsletter subscribe ─────────────────────────────────────────── */}
      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-5">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-white">{c.newsletterTitle}</h2>
          <p className="text-sm text-gray-400 max-w-lg mx-auto">{c.newsletterSub}</p>
        </div>
        <NewsletterSubscribeForm
          locale={locale}
          labels={{
            title:         c.newsletterTitle,
            subtitle:      c.newsletterSub,
            placeholder:   c.newsletterPlaceholder,
            regionLabel:   c.newsletterRegionLabel,
            regions:       c.newsletterRegions,
            submit:        c.newsletterSubmit,
            success:       c.newsletterSuccess,
            successSub:    c.newsletterSuccessSub,
            fine:          c.newsletterFine,
            errorGeneric:  c.newsletterError,
          }}
        />
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="relative rounded-2xl overflow-hidden border border-gray-800 bg-gray-900">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-red-600/8 blur-[80px] rounded-full" />
        </div>
        <div className="relative px-8 py-16 text-center space-y-6 max-w-2xl mx-auto">
          <div className="flex justify-center gap-3 flex-wrap">
            {[Building2, HeartHandshake, Microscope].map((Icon, i) => (
              <div key={i} className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
                <Icon className="w-5 h-5 text-gray-400" />
              </div>
            ))}
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white">{c.ctaTitle}</h2>
          <p className="text-gray-400">{c.ctaSub}</p>
          <div className="space-y-3">
            <Link
              href={`/${locale}/signup`}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-10 py-4 rounded-xl transition-all shadow-lg shadow-red-900/30 text-sm"
            >
              {c.ctaButton}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-xs text-gray-600">{c.ctaNoCc}</p>
          </div>
        </div>
      </section>

    </div>
  );
}
