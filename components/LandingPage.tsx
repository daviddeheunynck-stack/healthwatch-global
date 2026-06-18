import Link from "next/link";
import CheckoutButton from "@/components/CheckoutButton";
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
  pricingProCta: string;
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
  // Trust / social proof
  trustTitle: string;
  trustSub: string;
  trustSourcesLabel: string;
  trustBadges: string[];
  comparisonTitle: string;
  comparisonFeatures: string[];
  aboutLink: string;
  focalPointTitle: string;
  focalPointSub: string;
  focalPointTiers: { label: string; desc: string; example: string; action: string }[];
}> = {
  fr: {
    heroBadge: "4 sources officielles · 195 pays · Mise à jour quotidienne",
    heroTitle: ["Toutes les données OMS.", "Sans les heures de recherche."],
    heroSub: "Épidémiologiste, médecin, consultant ou analyste santé — vous consultez déjà l'OMS, l'ECDC, l'OPAS et l'Africa CDC. HealthWatch les agrège en un seul tableau de bord, calcule automatiquement la létalité, et vous alerte dès la publication.",
    heroCta: "Créer un compte gratuit",
    heroCtaSecondary: "Voir les tarifs",
    heroNoCc: "Gratuit · 14 jours Pro offerts · Sans carte bancaire",
    statOutbreaks: "foyers actifs",
    statCountries: "pays touchés",
    statHighRisk: "alertes haut risque",
    statUpdated: "Délai de mise à jour",
    problemTitle: "L'OMS déclare 15 à 25 nouveaux foyers chaque mois.",
    problemSub: "La plupart des organisations de santé l'apprennent trop tard — après que les médias locaux en aient parlé, après que les équipes terrain aient signalé les premiers cas. HealthWatch Global renverse ce délai.",
    problemStats: [
      { value: "15–25", label: "nouveaux foyers OMS / mois" },
      { value: "72h", label: "délai moyen avant détection terrain" },
      { value: "4 sources", label: "OMS · ECDC · OPAS · Africa CDC — un seul tableau de bord" },
    ],
    previewTitle: "Ce que vos équipes verront",
    previewSub: "Les données ci-dessous proviennent de l'OMS DON, l'ECDC, l'OPAS et l'Africa CDC — synchronisées automatiquement toutes les quelques heures.",
    previewLive: "En direct",
    previewCols: { disease: "Maladie", country: "Pays", risk: "Risque" },
    featuresTitle: "Tout ce dont votre équipe a besoin",
    features: [
      { title: "Alertes par maladie", desc: "Abonnez-vous à H5N1, Ebola, Mpox… Recevez un email dans les 8h dès qu'un foyer est signalé par l'OMS, l'ECDC, l'OPAS ou l'Africa CDC, n'importe où dans le monde." },
      { title: "Badge PHEIC", desc: "Le badge 🚨 PHEIC apparaît automatiquement sur chaque urgence de santé publique de portée internationale déclarée par l'OMS — le niveau d'alerte le plus élevé." },
      { title: "Taux de létalité & incidence", desc: "CFR calculé automatiquement. Incidence pour 100 000 habitants — données de population ONU intégrées pour 150 pays." },
      { title: "Comparaison de foyers", desc: "Ebola RDC 2026 vs Uganda : cas, décès, CFR, incidence côte à côte. Partagez l'URL directement avec vos collègues." },
      { title: "Watchlist & notifications", desc: "Suivez ⭐ jusqu'à 20 foyers spécifiques. Notification automatique par email dès que les chiffres changent." },
      { title: "PDF one-pager & widget", desc: "Rapport PDF professionnel par foyer en 1 clic. Widget embarquable pour votre site. PNG partageable pour WhatsApp et Slack." },
    ],
    howTitle: "Opérationnel en 3 minutes",
    steps: [
      { title: "Créez votre compte", desc: "Inscription en 30 secondes. Aucune carte bancaire requise. Accès immédiat au tableau de bord." },
      { title: "Configurez vos régions", desc: "Sélectionnez les zones géographiques que vous surveillez et recevez votre premier digest dès la semaine suivante." },
      { title: "Passez Pro pour les alertes instantanées", desc: "Débloquez le flux en direct, les rapports PDF et l'export CSV — et restez en avance sur chaque crise." },
    ],
    orgsTitle: "Fait pour les professionnels de santé",
    orgs: ["Épidémiologistes & chercheurs", "Médecins de médecine des voyages", "Consultants santé indépendants", "Journalistes & analystes"],
    pricingTitle: "Commencez gratuitement. Évoluez quand vous en avez besoin.",
    pricingFree: "Gratuit",
    pricingPro: "29 € /mois",
    pricingEnterprise: "Sur devis",
    pricingFreeSub: "Carte mondiale · 1 région · Digest hebdo",
    pricingProSub: "Toutes régions · Alertes · PDF · CSV · Slack",
    pricingEnterpriseSub: "API · On-premise · SLA 99,9 %",
    pricingProCta: "Essai Pro gratuit 14 jours →",
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
    ctaTitle: "Arrêtez de chercher manuellement sur who.int.",
    ctaSub: "HealthWatch Global agrège les bulletins DON de l'OMS, les évaluations ECDC, les alertes de l'OPAS et les rapports de l'Africa CDC — couverture mondiale complète, mise à jour automatiquement.",
    ctaButton: "Démarrer gratuitement",
    ctaNoCc: "Sans carte bancaire · Accès immédiat",
    trustTitle: "OMS · ECDC · OPAS · Africa CDC · 5 langues",
    trustSub: "HealthWatch Global agrège les quatre grandes sources de surveillance épidémiologique mondiale — directement, sans intermédiaire, dans votre langue.",
    trustSourcesLabel: "Sources de données officielles",
    trustBadges: ["RGPD conforme · Hébergement UE", "4 sources officielles · API directe", "99,9 % de disponibilité", "Sans engagement · Annulez à tout moment"],
    comparisonTitle: "HealthWatch vs who.int",
    comparisonFeatures: ["5 langues (FR, EN, ES, AR, ID)", "Alertes email par maladie / région", "CFR & incidence calculés automatiquement", "Rapports PDF en 1 clic", "Filtres, tri & export CSV", "Watchlist & notifications"],
    aboutLink: "Construit par un professionnel passionné par la santé mondiale → En savoir plus",
    focalPointTitle: "Pensé pour les Points focaux nationaux",
    focalPointSub: "Pour chaque foyer actif, HealthWatch calcule le tier RSI et propose les premières actions alignées sur le cadre OMS/RSI 2005.",
    focalPointTiers: [
      { label: "IMMÉDIAT · NOTIFIABLE RSI", desc: "Maladies à notification obligatoire — article 6 du RSI. Alerte à l'OMS requise sous 24 h.", example: "Ebola, polio, SRAS, fièvre jaune", action: "Notifier le Point focal national OMS sous 24 h" },
      { label: "RÉPONSE RAPIDE", desc: "Investigation terrain requise sous 48 h. Alerte aux bureaux régionaux et points focaux de district.", example: "Mpox, choléra, méningite à méningocoque", action: "Lancer l'investigation terrain sous 48 h" },
      { label: "SURVEILLANCE STANDARD", desc: "Veille et signalement de routine. Signaler si la tendance se détériore.", example: "Tous autres foyers actifs", action: "Inclure dans le briefing de surveillance hebdomadaire" },
    ],
  },
  en: {
    heroBadge: "4 official sources · 195 countries · Updated daily",
    heroTitle: ["All WHO outbreak data.", "Without the research hours."],
    heroSub: "Epidemiologist, travel medicine doctor, or health consultant — you already cross-reference WHO, ECDC, PAHO and Africa CDC. HealthWatch aggregates all four, calculates CFR automatically, and alerts you within hours of publication.",
    heroCta: "Create free account",
    heroCtaSecondary: "See pricing",
    heroNoCc: "Free · 14-day Pro trial · No credit card required",
    statOutbreaks: "active outbreaks",
    statCountries: "countries affected",
    statHighRisk: "high-risk alerts",
    statUpdated: "Data freshness",
    problemTitle: "The WHO declares 15–25 new outbreaks every month.",
    problemSub: "Most health organizations learn too late — after local media, after field teams report first cases. HealthWatch Global reverses that delay.",
    problemStats: [
      { value: "15–25", label: "new WHO outbreaks / month" },
      { value: "72h", label: "average detection lag" },
      { value: "4 sources", label: "WHO · ECDC · PAHO · Africa CDC — one dashboard" },
    ],
    previewTitle: "What your teams will see",
    previewSub: "The data below comes from WHO DON, ECDC, PAHO and Africa CDC — automatically synchronized every few hours.",
    previewLive: "Live",
    previewCols: { disease: "Disease", country: "Country", risk: "Risk" },
    featuresTitle: "Everything your team needs",
    features: [
      { title: "Disease-specific alerts", desc: "Subscribe to H5N1, Ebola, Mpox… Get an email within 8 hours of any outbreak reported by WHO, ECDC, PAHO or Africa CDC, anywhere in the world." },
      { title: "PHEIC badge", desc: "🚨 PHEIC badge automatically flags every WHO-declared Public Health Emergency of International Concern — the highest alert level." },
      { title: "CFR & incidence rate", desc: "Case fatality rate calculated automatically. Incidence per 100,000 with UN population data for 150 countries." },
      { title: "Outbreak comparison", desc: "Ebola DRC vs Uganda 2026: cases, deaths, CFR, incidence side by side. Share the URL directly with colleagues." },
      { title: "Watchlist & notifications", desc: "Star ⭐ up to 20 specific outbreaks. Automatic email when figures change — never miss an escalation." },
      { title: "PDF reports & embeddable widget", desc: "Professional PDF per outbreak in 1 click. Embeddable iframe widget for your site. PNG card for WhatsApp and Slack." },
    ],
    howTitle: "Up and running in 3 minutes",
    steps: [
      { title: "Create your account", desc: "Sign up in 30 seconds. No credit card required. Immediate dashboard access." },
      { title: "Configure your regions", desc: "Select the geographies you monitor and receive your first digest the following week." },
      { title: "Go Pro for instant alerts", desc: "Unlock the live feed, PDF reports, and CSV export — and stay ahead of every crisis." },
    ],
    orgsTitle: "Built for health professionals",
    orgs: ["Epidemiologists & researchers", "Travel medicine doctors", "Independent health consultants", "Health journalists & analysts"],
    pricingTitle: "Start free. Scale when you need to.",
    pricingFree: "Free",
    pricingPro: "€29 /month",
    pricingEnterprise: "Custom",
    pricingFreeSub: "World map · 1 region · Weekly digest",
    pricingProSub: "All regions · Alerts · PDF · CSV · Slack",
    pricingEnterpriseSub: "API · On-premise · 99.9% SLA",
    pricingProCta: "Start free trial →",
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
    ctaTitle: "Stop searching manually on who.int.",
    ctaSub: "HealthWatch Global aggregates WHO Disease Outbreak News, ECDC threat assessments, PAHO epidemiological alerts and Africa CDC reports — complete global coverage, updated automatically.",
    ctaButton: "Get started free",
    ctaNoCc: "No credit card · Instant access",
    trustTitle: "WHO · ECDC · PAHO · Africa CDC · 5 languages",
    trustSub: "HealthWatch Global aggregates the four major global epidemiological surveillance sources — directly, with no intermediary, in your language.",
    trustSourcesLabel: "Official data sources",
    trustBadges: ["GDPR compliant · EU hosting", "4 official sources · Direct API", "99.9% uptime", "No commitment · Cancel anytime"],
    comparisonTitle: "HealthWatch vs who.int",
    comparisonFeatures: ["5 languages (FR, EN, ES, AR, ID)", "Email alerts by disease / region", "CFR & incidence auto-calculated", "PDF reports in 1 click", "Filters, sorting & CSV export", "Watchlist & notifications"],
    aboutLink: "Built by a professional passionate about global health → Learn more",
    focalPointTitle: "Built for National Focal Points",
    focalPointSub: "For every active outbreak, HealthWatch calculates the IHR response tier and surfaces first actions aligned with the WHO/IHR 2005 framework.",
    focalPointTiers: [
      { label: "IMMEDIATE · IHR NOTIFIABLE", desc: "Mandatory WHO notification under IHR Article 6 — National Focal Point must alert WHO within 24 h.", example: "Ebola, poliovirus, SARS, yellow fever", action: "Notify WHO National Focal Point within 24 h" },
      { label: "RAPID RESPONSE", desc: "Field investigation required within 48 h. Alert regional offices and district focal points.", example: "Mpox, cholera, meningococcal meningitis", action: "Initiate field investigation within 48 h" },
      { label: "STANDARD MONITORING", desc: "Routine surveillance and reporting. Escalate if trend worsens.", example: "All other active outbreaks", action: "Include in weekly surveillance briefing" },
    ],
  },
  es: {
    heroBadge: "4 fuentes oficiales · 195 países · Actualización diaria",
    heroTitle: ["Todos los datos OMS.", "Sin horas de investigación."],
    heroSub: "Epidemiólogo, médico, consultor o analista de salud — usted ya cruza datos de OMS, ECDC, OPS y Africa CDC. HealthWatch los agrega en un solo panel, calcula el CFR automáticamente y le alerta en horas tras cada publicación oficial.",
    heroCta: "Crear cuenta gratuita",
    heroCtaSecondary: "Ver precios",
    heroNoCc: "Gratis · 14 días Pro de prueba · Sin tarjeta de crédito",
    statOutbreaks: "brotes activos",
    statCountries: "países afectados",
    statHighRisk: "alertas de alto riesgo",
    statUpdated: "Actualización de datos",
    problemTitle: "La OMS declara entre 15 y 25 nuevos brotes cada mes.",
    problemSub: "La mayoría de las organizaciones de salud lo descubren demasiado tarde. HealthWatch Global invierte ese retraso.",
    problemStats: [
      { value: "15–25", label: "nuevos brotes OMS / mes" },
      { value: "72h", label: "retraso promedio de detección" },
      { value: "4 fuentes", label: "OMS · ECDC · OPS · Africa CDC — un solo panel" },
    ],
    previewTitle: "Lo que sus equipos verán",
    previewSub: "Los datos provienen de la OMS DON, ECDC, OPS y Africa CDC — sincronizados automáticamente cada pocas horas.",
    previewLive: "En vivo",
    previewCols: { disease: "Enfermedad", country: "País", risk: "Riesgo" },
    featuresTitle: "Todo lo que su equipo necesita",
    features: [
      { title: "Alertas por enfermedad", desc: "Suscríbase a H5N1, Ébola, Mpox… Reciba un email en menos de 8h cuando la OMS, ECDC, PAHO o Africa CDC reporte un brote en cualquier parte del mundo." },
      { title: "Insignia PHEIC", desc: "🚨 La insignia PHEIC marca cada emergencia de salud pública de importancia internacional declarada por la OMS — el nivel de alerta más alto." },
      { title: "Tasa de letalidad & incidencia", desc: "CFR calculado automáticamente. Incidencia por 100.000 habitantes con datos de población de la ONU para 150 países." },
      { title: "Comparación de brotes", desc: "Ébola RDC vs Uganda: casos, muertes, CFR, incidencia lado a lado. Comparta la URL directamente con colegas." },
      { title: "Lista de seguimiento & notificaciones", desc: "Marque ⭐ hasta 20 brotes. Notificación automática por email cuando cambian las cifras." },
      { title: "Informes PDF & widget embebible", desc: "Informe PDF profesional por brote con 1 clic. Widget iframe para su sitio. Tarjeta PNG para WhatsApp y Slack." },
    ],
    howTitle: "Operativo en 3 minutos",
    steps: [
      { title: "Cree su cuenta", desc: "Registro en 30 segundos. Sin tarjeta de crédito. Acceso inmediato al panel." },
      { title: "Configure sus regiones", desc: "Seleccione las geografías que monitorea y reciba su primer digest la semana siguiente." },
      { title: "Pase a Pro para alertas instantáneas", desc: "Desbloquee el flujo en vivo, informes PDF y exportación CSV." },
    ],
    orgsTitle: "Para profesionales de salud",
    orgs: ["Epidemiólogos & investigadores", "Médicos de medicina de viaje", "Consultores de salud independientes", "Periodistas & analistas"],
    pricingTitle: "Empiece gratis. Escale cuando lo necesite.",
    pricingFree: "Gratis",
    pricingPro: "€29 /mes",
    pricingEnterprise: "A medida",
    pricingFreeSub: "Mapa mundial · 1 región · Digest semanal",
    pricingProSub: "Todas las regiones · Alertas · PDF · CSV · Slack",
    pricingEnterpriseSub: "API · On-premise · SLA 99,9%",
    pricingProCta: "Iniciar prueba gratuita →",
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
    ctaTitle: "Deje de buscar manualmente en who.int.",
    ctaSub: "HealthWatch Global agrega los boletines DON de la OMS, evaluaciones de amenaza del ECDC, alertas de la OPS y reportes de Africa CDC — cobertura global completa, actualizada automáticamente.",
    ctaButton: "Comenzar gratis",
    ctaNoCc: "Sin tarjeta de crédito · Acceso inmediato",
    trustTitle: "OMS · ECDC · OPS · Africa CDC · 5 idiomas",
    trustSub: "HealthWatch Global agrega las cuatro grandes fuentes de vigilancia epidemiológica mundial — directamente, sin intermediarios, en su idioma.",
    trustSourcesLabel: "Fuentes de datos oficiales",
    trustBadges: ["Conforme RGPD · Alojamiento en UE", "4 fuentes oficiales · API directa", "99,9% disponibilidad", "Sin compromiso · Cancele cuando quiera"],
    comparisonTitle: "HealthWatch vs who.int",
    comparisonFeatures: ["5 idiomas (FR, EN, ES, AR, ID)", "Alertas email por enfermedad / región", "CFR & incidencia calculados automáticamente", "Informes PDF en 1 clic", "Filtros, orden & exportación CSV", "Lista de seguimiento & notificaciones"],
    aboutLink: "Creado por un profesional apasionado por la salud global → Saber más",
    focalPointTitle: "Diseñado para Puntos focales nacionales",
    focalPointSub: "Para cada brote activo, HealthWatch calcula el nivel de respuesta RSI y propone las primeras acciones alineadas con el marco OMS/RSI 2005.",
    focalPointTiers: [
      { label: "INMEDIATO · NOTIFICABLE RSI", desc: "Notificación obligatoria a la OMS según el artículo 6 del RSI — el Punto focal debe alertar a la OMS en 24 h.", example: "Ébola, poliovirus, SRAS, fiebre amarilla", action: "Notificar al Punto focal nacional OMS en 24 h" },
      { label: "RESPUESTA RÁPIDA", desc: "Investigación de campo requerida en 48 h. Alertar a oficinas regionales y puntos focales de distrito.", example: "Mpox, cólera, meningitis meningocócica", action: "Iniciar investigación de campo en 48 h" },
      { label: "VIGILANCIA ESTÁNDAR", desc: "Vigilancia y reporte de rutina. Escalar si la tendencia empeora.", example: "Todos los demás brotes activos", action: "Incluir en el informe de vigilancia semanal" },
    ],
  },
  ar: {
    heroBadge: "4 مصادر رسمية · 195 دولة · تحديث يومي",
    heroTitle: ["كل بيانات منظمة الصحة العالمية.", "دون ساعات البحث."],
    heroSub: "عالم أوبئة، طبيب، مستشار أو محلل صحي — أنت تتقاطع بيانات منظمة الصحة العالمية وECDC وPAHO وAfrica CDC. HealthWatch يجمعها في لوحة واحدة، يحسب معدل الوفيات تلقائياً، ويُنبِّهك في ساعات من النشر الرسمي.",
    heroCta: "إنشاء حساب مجاني",
    heroCtaSecondary: "عرض الأسعار",
    heroNoCc: "مجاني · 14 يوم Pro مجاناً · لا بطاقة بنكية مطلوبة",
    statOutbreaks: "تفشيات نشطة",
    statCountries: "دول متضررة",
    statHighRisk: "تنبيهات عالية الخطورة",
    statUpdated: "تأخر التحديث",
    problemTitle: "تُعلن منظمة الصحة العالمية عن 15 إلى 25 تفشياً جديداً كل شهر.",
    problemSub: "معظم منظمات الصحة تعلم متأخرة. HealthWatch Global تعكس هذا التأخير.",
    problemStats: [
      { value: "15–25", label: "تفشيات جديدة / شهر" },
      { value: "72 ساعة", label: "متوسط وقت الكشف" },
      { value: "4 مصادر", label: "WHO · ECDC · PAHO · Africa CDC — لوحة واحدة" },
    ],
    previewTitle: "ما ستراه فرقك",
    previewSub: "البيانات مصدرها WHO DON وECDC وPAHO وAfrica CDC — تُزامَن تلقائياً كل بضع ساعات.",
    previewLive: "مباشر",
    previewCols: { disease: "المرض", country: "الدولة", risk: "الخطر" },
    featuresTitle: "كل ما يحتاجه فريقك",
    features: [
      { title: "تنبيهات الأمراض", desc: "اشترك في H5N1 أو إيبولا أو جدري القرود… واستقبل بريداً إلكترونياً في غضون 8 ساعات من تقرير أي تفشٍّ من WHO أو ECDC أو PAHO أو Africa CDC في العالم." },
      { title: "شارة PHEIC", desc: "🚨 تظهر شارة PHEIC تلقائياً على كل طارئة صحية عمومية ذات اهتمام دولي تُعلنها منظمة الصحة العالمية — أعلى مستوى تأهب." },
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
    orgsTitle: "للمختصين في الصحة",
    orgs: ["علماء الأوبئة والباحثون", "أطباء طب السفر", "مستشارو الصحة المستقلون", "الصحفيون والمحللون"],
    pricingTitle: "ابدأ مجاناً. طوِّر عندما تحتاج.",
    pricingFree: "مجاني",
    pricingPro: "€29 / شهر",
    pricingEnterprise: "حسب الطلب",
    pricingFreeSub: "خريطة عالمية · منطقة واحدة · ملخص أسبوعي",
    pricingProSub: "جميع المناطق · تنبيهات · PDF · CSV · Slack",
    pricingEnterpriseSub: "API · نشر محلي · SLA 99.9%",
    pricingProCta: "← ابدأ التجربة المجانية",
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
    ctaTitle: "توقف عن البحث اليدوي في who.int.",
    ctaSub: "تجمع HealthWatch Global نشرات DON لمنظمة الصحة العالمية وتقييمات ECDC وتنبيهات PAHO وتقارير Africa CDC — تغطية عالمية شاملة، محدَّثة تلقائياً.",
    ctaButton: "ابدأ مجاناً",
    ctaNoCc: "بدون بطاقة بنكية · وصول فوري",
    trustTitle: "WHO · ECDC · PAHO · Africa CDC · 5 لغات",
    trustSub: "تجمع HealthWatch Global المصادر الأربع الكبرى للمراقبة الوبائية العالمية — مباشرةً، دون وسطاء، بلغتك.",
    trustSourcesLabel: "مصادر البيانات الرسمية",
    trustBadges: ["متوافق مع GDPR · استضافة أوروبية", "4 مصادر رسمية · API مباشر", "99.9% وقت التشغيل", "بدون التزام · ألغِ في أي وقت"],
    comparisonTitle: "HealthWatch مقابل who.int",
    comparisonFeatures: ["5 لغات (FR, EN, ES, AR, ID)", "تنبيهات البريد الإلكتروني حسب المرض / المنطقة", "CFR والإصابة محسوبان تلقائياً", "تقارير PDF بنقرة واحدة", "فلاتر وترتيب وتصدير CSV", "قائمة المراقبة والإشعارات"],
    aboutLink: "أُنشئت بواسطة متخصص شغوف بالصحة العالمية ← تعرف أكثر",
    focalPointTitle: "مصمم لنقاط الاتصال الوطنية",
    focalPointSub: "لكل تفشٍّ نشط، تحسب HealthWatch تلقائياً مستوى اللوائح الصحية الدولية وتقترح أولى الإجراءات وفق إطار منظمة الصحة العالمية 2005.",
    focalPointTiers: [
      { label: "فوري · إخطار إلزامي RSI", desc: "إخطار إلزامي لمنظمة الصحة العالمية بموجب المادة 6 — يجب إخطار المنظمة خلال 24 ساعة.", example: "إيبولا، شلل الأطفال، سارس، الحمى الصفراء", action: "إخطار نقطة الاتصال الوطنية لمنظمة الصحة العالمية خلال 24 ساعة" },
      { label: "استجابة سريعة", desc: "تحقيق ميداني مطلوب خلال 48 ساعة. تنبيه المكاتب الإقليمية ونقاط الاتصال.", example: "جدري القرود، الكوليرا، التهاب السحايا", action: "الشروع في التحقيق الميداني خلال 48 ساعة" },
      { label: "مراقبة روتينية", desc: "مراقبة وإبلاغ روتيني. التصعيد إذا ساءت الاتجاهات.", example: "جميع التفشيات النشطة الأخرى", action: "التضمين في إحاطة المراقبة الأسبوعية" },
    ],
  },
  id: {
    heroBadge: "4 sumber resmi · 195 negara · Diperbarui setiap hari",
    heroTitle: ["Semua data wabah WHO.", "Tanpa berjam-jam penelitian."],
    heroSub: "Epidemiolog, dokter, konsultan atau analis kesehatan — Anda sudah memeriksa silang data WHO, ECDC, PAHO dan Africa CDC. HealthWatch mengagregasi keempatnya dalam satu dasbor, menghitung CFR secara otomatis, dan memberi tahu Anda dalam hitungan jam setelah publikasi resmi.",
    heroCta: "Buat akun gratis",
    heroCtaSecondary: "Lihat harga",
    heroNoCc: "Gratis · 14 hari Pro gratis · Tanpa kartu kredit",
    statOutbreaks: "wabah aktif",
    statCountries: "negara terdampak",
    statHighRisk: "peringatan risiko tinggi",
    statUpdated: "Kebaruan data",
    problemTitle: "WHO mendeklarasikan 15–25 wabah baru setiap bulan.",
    problemSub: "Sebagian besar organisasi kesehatan mengetahuinya terlambat. HealthWatch Global membalik keterlambatan itu.",
    problemStats: [
      { value: "15–25", label: "wabah WHO baru / bulan" },
      { value: "72 jam", label: "rata-rata jeda deteksi" },
      { value: "4 sumber", label: "WHO · ECDC · PAHO · Africa CDC — satu dasbor" },
    ],
    previewTitle: "Yang akan dilihat tim Anda",
    previewSub: "Data di bawah ini bersumber dari WHO DON, ECDC, PAHO dan Africa CDC — diperbarui otomatis setiap beberapa jam.",
    previewLive: "Langsung",
    previewCols: { disease: "Penyakit", country: "Negara", risk: "Risiko" },
    featuresTitle: "Semua yang dibutuhkan tim Anda",
    features: [
      { title: "Peringatan per penyakit", desc: "Berlangganan H5N1, Ebola, Mpox… Terima email dalam 8 jam setelah WHO, ECDC, PAHO atau Africa CDC melaporkan wabah di mana saja di dunia." },
      { title: "Lencana PHEIC", desc: "🚨 Lencana PHEIC otomatis menandai setiap Kedaruratan Kesehatan Masyarakat yang Meresahkan Dunia yang dinyatakan WHO — tingkat peringatan tertinggi." },
      { title: "CFR & tingkat insidensi", desc: "CFR dihitung otomatis. Insidensi per 100.000 penduduk dengan data populasi PBB untuk 150 negara." },
      { title: "Perbandingan wabah", desc: "Ebola RDC vs Uganda: kasus, kematian, CFR, insidensi berdampingan. Bagikan URL langsung ke kolega." },
      { title: "Daftar pantau & notifikasi", desc: "Tandai ⭐ hingga 20 wabah. Email otomatis ketika angka berubah — tidak ada eskalasi yang terlewat." },
      { title: "Laporan PDF & widget embeddable", desc: "PDF profesional per wabah dengan 1 klik. Widget iframe untuk situs Anda. Kartu PNG untuk WhatsApp dan Slack." },
    ],
    howTitle: "Siap dalam 3 menit",
    steps: [
      { title: "Buat akun Anda", desc: "Daftar dalam 30 detik. Tanpa kartu kredit. Akses dasbor langsung." },
      { title: "Konfigurasi wilayah Anda", desc: "Pilih geografi yang Anda pantau dan terima digest pertama minggu berikutnya." },
      { title: "Upgrade ke Pro untuk peringatan instan", desc: "Buka umpan langsung, laporan PDF, dan ekspor CSV." },
    ],
    orgsTitle: "Untuk profesional kesehatan",
    orgs: ["Epidemiolog & peneliti", "Dokter kedokteran perjalanan", "Konsultan kesehatan independen", "Jurnalis & analis kesehatan"],
    pricingTitle: "Mulai gratis. Kembangkan saat dibutuhkan.",
    pricingFree: "Gratis",
    pricingPro: "€29 /bulan",
    pricingEnterprise: "Kustom",
    pricingFreeSub: "Peta dunia · 1 wilayah · Digest mingguan",
    pricingProSub: "Semua wilayah · Peringatan · PDF · CSV · Slack",
    pricingEnterpriseSub: "API · On-premise · SLA 99,9%",
    pricingProCta: "Mulai uji coba gratis →",
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
    ctaTitle: "Berhenti mencari manual di who.int.",
    ctaSub: "HealthWatch Global mengumpulkan WHO Disease Outbreak News, penilaian ancaman ECDC, peringatan PAHO dan laporan Africa CDC — cakupan global lengkap, diperbarui otomatis.",
    ctaButton: "Mulai gratis",
    ctaNoCc: "Tanpa kartu kredit · Akses langsung",
    trustTitle: "WHO · ECDC · PAHO · Africa CDC · 5 bahasa",
    trustSub: "HealthWatch Global mengagregasi empat sumber pengawasan epidemiologi global terbesar — langsung, tanpa perantara, dalam bahasa Anda.",
    trustSourcesLabel: "Sumber data resmi",
    trustBadges: ["Sesuai GDPR · Hosting UE", "4 sumber resmi · API langsung", "Uptime 99,9%", "Tanpa komitmen · Batalkan kapan saja"],
    comparisonTitle: "HealthWatch vs who.int",
    comparisonFeatures: ["5 bahasa (FR, EN, ES, AR, ID)", "Peringatan email per penyakit / wilayah", "CFR & insidensi dihitung otomatis", "Laporan PDF dalam 1 klik", "Filter, sortir & ekspor CSV", "Daftar pantau & notifikasi"],
    aboutLink: "Dibangun oleh profesional yang bersemangat tentang kesehatan global → Pelajari lebih lanjut",
    focalPointTitle: "Dirancang untuk Focal Point Nasional",
    focalPointSub: "Untuk setiap wabah aktif, HealthWatch secara otomatis menghitung tingkat respons IHR dan menyarankan tindakan pertama sesuai kerangka WHO/IHR 2005.",
    focalPointTiers: [
      { label: "SEGERA · WAJIB LAPOR IHR", desc: "Notifikasi wajib ke WHO berdasarkan IHR Pasal 6 — Focal Point Nasional harus memberi tahu WHO dalam 24 jam.", example: "Ebola, poliovirus, SARS, demam kuning", action: "Notifikasi Focal Point Nasional WHO dalam 24 jam" },
      { label: "RESPONS CEPAT", desc: "Investigasi lapangan diperlukan dalam 48 jam. Peringatkan kantor regional dan focal point kabupaten.", example: "Mpox, kolera, meningitis meningokokal", action: "Mulai investigasi lapangan dalam 48 jam" },
      { label: "PEMANTAUAN STANDAR", desc: "Surveilans dan pelaporan rutin. Eskalasi jika tren memburuk.", example: "Semua wabah aktif lainnya", action: "Sertakan dalam brifing surveilans mingguan" },
    ],
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
              { value: "≤24h", label: c.statUpdated, icon: Clock, color: "text-green-400" },
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

      {/* ── Official sources — early credibility strip ───────────────────── */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs text-gray-600 mr-1">{c.trustSourcesLabel} :</span>
        {[
          { name: "WHO DON",    cls: "text-blue-400 border-blue-800/50 bg-blue-950/20" },
          { name: "ECDC",       cls: "text-sky-400 border-sky-800/50 bg-sky-950/20" },
          { name: "PAHO",       cls: "text-teal-400 border-teal-800/50 bg-teal-950/20" },
          { name: "Africa CDC", cls: "text-green-400 border-green-800/50 bg-green-950/20" },
        ].map(({ name, cls }) => (
          <span key={name} className={`text-[11px] font-bold px-2.5 py-1 rounded border ${cls}`}>
            {name}
          </span>
        ))}
      </div>

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
            <span className="text-xs text-gray-500">
                {({ fr: "Sources : ", es: "Fuentes: ", ar: "المصادر: ", id: "Sumber: " } as Record<string, string>)[locale] ?? "Sources: "}
                WHO DON · ECDC · PAHO · Africa CDC
              </span>
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
            const icons = [Bell, AlertTriangle, Activity, Globe, Zap, FileText];
            const colors = ["text-red-400", "text-yellow-400", "text-purple-400", "text-blue-400", "text-green-400", "text-orange-400"];
            const bgs = ["bg-red-500/10 border-red-500/20", "bg-yellow-500/10 border-yellow-500/20", "bg-purple-500/10 border-purple-500/20", "bg-blue-500/10 border-blue-500/20", "bg-green-500/10 border-green-500/20", "bg-orange-500/10 border-orange-500/20"];
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

      {/* ── Focal Point Guidance ─────────────────────────────────────────── */}
      <section className="space-y-8">
        <div className="text-center space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">IHR · WHO 2005</p>
          <h2 className="text-2xl md:text-3xl font-bold text-white">{c.focalPointTitle}</h2>
          <p className="text-gray-400 text-sm max-w-xl mx-auto leading-relaxed">{c.focalPointSub}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {c.focalPointTiers.map(({ label, desc, example, action }, i) => {
            const styles = [
              { card: "border-red-800/40 bg-red-950/30", badge: "bg-red-500/10 border-red-500/30 text-red-400", arrow: "text-red-400" },
              { card: "border-yellow-800/40 bg-yellow-950/20", badge: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400", arrow: "text-yellow-400" },
              { card: "border-gray-700/40 bg-gray-900/40", badge: "bg-gray-600/20 border-gray-500/30 text-gray-300", arrow: "text-gray-400" },
            ][i];
            return (
              <div key={label} className={`rounded-xl border ${styles.card} p-5 space-y-3`}>
                <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded border ${styles.badge} tracking-wide`}>{label}</span>
                <p className="text-gray-300 text-sm leading-relaxed">{desc}</p>
                <p className="text-xs text-gray-500">Ex : {example}</p>
                <div className="flex items-start gap-1.5 pt-1 border-t border-white/5">
                  <span className={`mt-0.5 shrink-0 font-bold text-xs ${styles.arrow}`}>›</span>
                  <p className="text-xs text-gray-400 leading-relaxed">{action}</p>
                </div>
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

      {/* ── Social proof ─────────────────────────────────────────────────── */}
      <section className="space-y-10">

        {/* Data sources cards */}
        <div className="text-center space-y-4">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">{c.trustSourcesLabel}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
            {[
              { name: "WHO DON",    dot: "bg-blue-400",  border: "border-blue-800/40 bg-blue-950/20",  sub: "Disease Outbreak News" },
              { name: "ECDC",       dot: "bg-sky-400",   border: "border-sky-800/40 bg-sky-950/20",    sub: "Communicable Disease Threats" },
              { name: "PAHO",       dot: "bg-teal-400",  border: "border-teal-800/40 bg-teal-950/20",  sub: "Pan American Health Org." },
              { name: "Africa CDC", dot: "bg-green-400", border: "border-green-800/40 bg-green-950/20", sub: "Africa Centres for Disease Control" },
            ].map(({ name, dot, border, sub }) => (
              <div key={name} className={`rounded-xl border ${border} px-4 py-3 flex items-center gap-3`}>
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
                <div className="text-left">
                  <p className="text-sm font-bold text-white leading-tight">{name}</p>
                  <p className="text-[10px] text-gray-500 leading-tight mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Title + subtitle */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl md:text-3xl font-bold text-white">{c.trustTitle}</h2>
          <p className="text-gray-400 max-w-xl mx-auto text-sm leading-relaxed">{c.trustSub}</p>
        </div>

        {/* who.int vs HealthWatch comparison */}
        <div className="max-w-2xl mx-auto w-full space-y-3">
          <h3 className="text-center text-base font-semibold text-gray-300">{c.comparisonTitle}</h3>
          <div className="rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-900 border-b border-gray-800">
                  <th className="text-left px-5 py-3 text-gray-500 font-medium w-1/2" />
                  <th className="text-center px-5 py-3 text-gray-500 font-medium">who.int</th>
                  <th className="text-center px-5 py-3 text-red-400 font-semibold">HealthWatch</th>
                </tr>
              </thead>
              <tbody>
                {c.comparisonFeatures.map((feature, i) => (
                  <tr key={i} className={`border-t border-gray-800 ${i % 2 === 0 ? "bg-gray-900/20" : ""}`}>
                    <td className="px-5 py-3 text-gray-300">{feature}</td>
                    <td className="px-5 py-3 text-center text-gray-600 text-base">✕</td>
                    <td className="px-5 py-3 text-center text-green-400 text-base font-bold">✓</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Trust signal badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[Shield, Globe, Zap, CheckCircle].map((Icon, i) => (
            <div key={i} className="flex items-center gap-2.5 bg-gray-900/60 border border-gray-800 rounded-lg px-4 py-3">
              <Icon className="w-4 h-4 text-green-400 shrink-0" />
              <span className="text-xs text-gray-400 leading-snug">{c.trustBadges[i]}</span>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link
            href={`/${locale}/about`}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors underline-offset-2 hover:underline"
          >
            {c.aboutLink}
          </Link>
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
            { name: c.pricingFree, price: "", sub: c.pricingFreeSub, icon: CheckCircle, color: "text-green-400", border: "border-gray-800", cta: null },
            { name: "Pro", price: c.pricingPro, sub: c.pricingProSub, icon: Shield, color: "text-red-400", border: "border-2 border-red-500", cta: c.pricingProCta },
            { name: "Enterprise", price: c.pricingEnterprise, sub: c.pricingEnterpriseSub, icon: Building2, color: "text-purple-400", border: "border-gray-800", cta: null },
          ].map(({ name, price, sub, icon: Icon, color, border, cta }) => (
            <div key={name} className={`bg-gray-900 ${border} rounded-xl p-5 space-y-3`}>
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className={`font-bold text-sm ${color}`}>{name}</span>
              </div>
              <p className="text-2xl font-bold text-white">{price || <span className="text-green-400">0 €</span>}</p>
              <p className="text-xs text-gray-400">{sub}</p>
              {cta && (
                <CheckoutButton
                  plan="pro"
                  locale={locale}
                  label={cta}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-xs mt-1"
                />
              )}
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
            <p className="text-xs text-gray-600 pt-1">
              {locale === "fr" ? "Une organisation ?" : locale === "es" ? "¿Una organización?" : locale === "ar" ? "مؤسسة؟" : locale === "id" ? "Sebuah organisasi?" : "An organization?"}{" "}
              <Link href={`/${locale}/pilot`} className="text-red-400 hover:text-red-300 underline underline-offset-2 transition-colors">
                {locale === "fr" ? "Programme pilote gratuit →" : locale === "es" ? "Programa piloto gratuito →" : locale === "ar" ? "← البرنامج التجريبي المجاني" : locale === "id" ? "Program pilot gratis →" : "Free pilot program →"}
              </Link>
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}
