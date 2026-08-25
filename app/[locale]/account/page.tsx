import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { User, Shield, Zap, Building2, Gift, Download, Users } from "lucide-react";
import Link from "next/link";
import BillingPortalButton from "@/components/BillingPortalButton";
import CheckoutButton from "@/components/CheckoutButton";
import SignOutButton from "@/components/SignOutButton";
import DeleteAccountButton from "@/components/DeleteAccountButton";
import AlertRegionToggles from "@/components/AlertRegionToggles";
import PushNotificationToggle from "@/components/PushNotificationToggle";
import DiseaseAlertPicker from "@/components/DiseaseAlertPicker";
import AlertLocalePanel from "@/components/AlertLocalePanel";
import SlackWebhookForm from "@/components/SlackWebhookForm";
import ApiKeyManager from "@/components/ApiKeyManager";
import TrackPageView from "@/components/TrackPageView";
import { PRICE_DISPLAY } from "@/lib/pricing";
import type { Metadata } from "next";

const ACCOUNT_META: Record<string, { title: string }> = {
  en: { title: "My Account" },
  fr: { title: "Mon compte" },
  es: { title: "Mi cuenta" },
  ar: { title: "حسابي" },
  id: { title: "Akun Saya" },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const m = ACCOUNT_META[locale] ?? ACCOUNT_META.en;
  return {
    title: m.title,
    robots: { index: false, follow: false },
  };
}

const PLAN_META: Record<string, { label: string; color: string; iconName: string }> = {
  free:       { label: "Free",       color: "text-green-400 bg-green-500/10 border-green-500/20",    iconName: "gift"       },
  starter:    { label: "Starter",    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",       iconName: "zap"        },
  pro:        { label: "Pro",        color: "text-red-400 bg-red-500/10 border-red-500/20",          iconName: "shield"     },
  team:       { label: "Team",       color: "text-amber-400 bg-amber-500/10 border-amber-500/20",    iconName: "users"      },
  enterprise: { label: "Enterprise", color: "text-purple-400 bg-purple-500/10 border-purple-500/20", iconName: "building2"  },
};

const PLAN_ICONS: Record<string, React.ReactNode> = {
  gift:      <Gift className="w-4 h-4" />,
  zap:       <Zap className="w-4 h-4" />,
  shield:    <Shield className="w-4 h-4" />,
  users:     <Users className="w-4 h-4" />,
  building2: <Building2 className="w-4 h-4" />,
};

// ─── Alert region labels ──────────────────────────────────────────────────────

const ALERT_LABELS: Record<string, {
  title: string; desc: string; locked: string; upgrade: string; error: string;
  emptyHint?: string; regionLabels: Record<string, string>;
  minRiskLabel: string; minRiskOptions: Record<string, string>;
}> = {
  fr: {
    title: "Alertes par région",
    desc: "Recevez un email dès qu'un nouveau foyer est détecté dans vos régions surveillées.",
    locked: "Les alertes régionales sont disponibles avec les plans Pro et Team.",
    upgrade: "Débloquer Pro →",
    error: "Erreur lors de la sauvegarde. Réessayez.",
    emptyHint: "Activez au moins une région pour recevoir des alertes email de foyers.",
    regionLabels: { africa: "Afrique", asia: "Asie", americas: "Amériques", europe: "Europe", oceania: "Océanie" },
    minRiskLabel: "Seuil minimum",
    minRiskOptions: { high: "Risque élevé seulement", medium: "Risque modéré et plus", low: "Tous niveaux" },
  },
  en: {
    title: "Regional alerts",
    desc: "Get an email whenever a new outbreak is detected in your watched regions.",
    locked: "Regional alerts are available on the Pro and Team plans.",
    upgrade: "Unlock Pro →",
    error: "Failed to save. Please try again.",
    emptyHint: "Turn on at least one region to receive outbreak alert emails.",
    regionLabels: { africa: "Africa", asia: "Asia", americas: "Americas", europe: "Europe", oceania: "Oceania" },
    minRiskLabel: "Minimum severity",
    minRiskOptions: { high: "High risk only", medium: "Medium risk and up", low: "All levels" },
  },
  es: {
    title: "Alertas regionales",
    desc: "Reciba un email cuando se detecte un nuevo brote en sus regiones monitoreadas.",
    locked: "Las alertas regionales están disponibles en los planes Pro y Team.",
    upgrade: "Desbloquear Pro →",
    error: "Error al guardar. Inténtelo de nuevo.",
    emptyHint: "Active al menos una región para recibir alertas de brotes por email.",
    regionLabels: { africa: "África", asia: "Asia", americas: "Américas", europe: "Europa", oceania: "Oceanía" },
    minRiskLabel: "Severidad mínima",
    minRiskOptions: { high: "Solo riesgo alto", medium: "Riesgo medio y superior", low: "Todos los niveles" },
  },
  ar: {
    title: "التنبيهات الإقليمية",
    desc: "استقبل بريداً إلكترونياً فور رصد تفشٍّ جديد في المناطق التي تتابعها.",
    locked: "التنبيهات الإقليمية متاحة في خطط Pro و Team.",
    upgrade: "← فتح Pro",
    error: "فشل الحفظ. يرجى المحاولة مجدداً.",
    emptyHint: "فعّل منطقة واحدة على الأقل لتلقي تنبيهات تفشي الأمراض عبر البريد الإلكتروني.",
    regionLabels: { africa: "أفريقيا", asia: "آسيا", americas: "الأمريكتان", europe: "أوروبا", oceania: "أوقيانوسيا" },
    minRiskLabel: "الحد الأدنى للخطورة",
    minRiskOptions: { high: "خطر مرتفع فقط", medium: "خطر متوسط فأعلى", low: "جميع المستويات" },
  },
  id: {
    title: "Peringatan regional",
    desc: "Terima email saat wabah baru terdeteksi di wilayah yang Anda pantau.",
    locked: "Peringatan regional tersedia di paket Pro dan Team.",
    upgrade: "Buka Pro →",
    error: "Gagal menyimpan. Silakan coba lagi.",
    emptyHint: "Aktifkan setidaknya satu wilayah untuk menerima peringatan wabah via email.",
    regionLabels: { africa: "Afrika", asia: "Asia", americas: "Amerika", europe: "Eropa", oceania: "Oseania" },
    minRiskLabel: "Tingkat keparahan minimum",
    minRiskOptions: { high: "Hanya risiko tinggi", medium: "Risiko sedang ke atas", low: "Semua tingkat" },
  },
};

const SLACK_LABELS: Record<string, {
  title: string; desc: string; placeholder: string;
  save: string; remove: string; connected: string; connectedDesc: string;
  locked: string; upgrade: string; errorInvalid: string; errorGeneric: string;
  howTo: string; howToHref: string;
}> = {
  fr: {
    title: "Intégration Slack / Teams",
    desc: "Recevez les alertes de foyers directement dans votre channel Slack ou Teams.",
    placeholder: "https://hooks.slack.com/services/…",
    save: "Connecter",
    remove: "Déconnecter",
    connected: "Webhook connecté",
    connectedDesc: "Les nouvelles alertes régionales seront aussi postées dans votre channel.",
    locked: "L'intégration Slack est disponible avec les plans Pro et Team.",
    upgrade: "Débloquer Pro →",
    errorInvalid: "URL invalide. Utilisez un webhook Slack ou Teams.",
    errorGeneric: "Erreur lors de la connexion. Vérifiez l'URL et réessayez.",
    howTo: "Comment créer un webhook Slack entrant →",
    howToHref: "https://api.slack.com/messaging/webhooks",
  },
  en: {
    title: "Slack / Teams integration",
    desc: "Receive outbreak alerts directly in your Slack or Teams channel.",
    placeholder: "https://hooks.slack.com/services/…",
    save: "Connect",
    remove: "Disconnect",
    connected: "Webhook connected",
    connectedDesc: "New regional alerts will also be posted to your channel.",
    locked: "Slack integration is available on the Pro and Team plans.",
    upgrade: "Unlock Pro →",
    errorInvalid: "Invalid URL. Use a Slack or Teams incoming webhook URL.",
    errorGeneric: "Connection failed. Check the URL and try again.",
    howTo: "How to create a Slack incoming webhook →",
    howToHref: "https://api.slack.com/messaging/webhooks",
  },
  es: {
    title: "Integración Slack / Teams",
    desc: "Reciba alertas de brotes directamente en su canal de Slack o Teams.",
    placeholder: "https://hooks.slack.com/services/…",
    save: "Conectar",
    remove: "Desconectar",
    connected: "Webhook conectado",
    connectedDesc: "Las nuevas alertas regionales también se publicarán en su canal.",
    locked: "La integración con Slack está disponible en los planes Pro y Team.",
    upgrade: "Desbloquear Pro →",
    errorInvalid: "URL inválida. Use un webhook de entrada de Slack o Teams.",
    errorGeneric: "Error de conexión. Verifique la URL e inténtelo de nuevo.",
    howTo: "Cómo crear un webhook de entrada de Slack →",
    howToHref: "https://api.slack.com/messaging/webhooks",
  },
  ar: {
    title: "تكامل Slack / Teams",
    desc: "استقبل تنبيهات التفشيات مباشرةً في قناة Slack أو Teams الخاصة بك.",
    placeholder: "https://hooks.slack.com/services/…",
    save: "توصيل",
    remove: "قطع الاتصال",
    connected: "تم توصيل الـ Webhook",
    connectedDesc: "ستُنشر التنبيهات الإقليمية الجديدة أيضاً في قناتك.",
    locked: "تكامل Slack متاح في خطط Pro و Team.",
    upgrade: "← فتح Pro",
    errorInvalid: "رابط غير صالح. استخدم رابط Slack أو Teams الوارد.",
    errorGeneric: "فشل الاتصال. تحقق من الرابط وحاول مجدداً.",
    howTo: "كيفية إنشاء webhook وارد في Slack →",
    howToHref: "https://api.slack.com/messaging/webhooks",
  },
  id: {
    title: "Integrasi Slack / Teams",
    desc: "Terima peringatan wabah langsung di channel Slack atau Teams Anda.",
    placeholder: "https://hooks.slack.com/services/…",
    save: "Hubungkan",
    remove: "Putuskan",
    connected: "Webhook terhubung",
    connectedDesc: "Peringatan regional baru juga akan diposting ke channel Anda.",
    locked: "Integrasi Slack tersedia di paket Pro dan Team.",
    upgrade: "Buka Pro →",
    errorInvalid: "URL tidak valid. Gunakan URL webhook masuk Slack atau Teams.",
    errorGeneric: "Koneksi gagal. Periksa URL dan coba lagi.",
    howTo: "Cara membuat webhook masuk Slack →",
    howToHref: "https://api.slack.com/messaging/webhooks",
  },
};

const API_KEY_LABELS: Record<string, {
  title: string; desc: string; newKeyPlaceholder: string;
  create: string; revoke: string; revokeConfirm: string;
  copyKey: string; copied: string; oneTimeWarning: string; neverSeen: string;
  noKeys: string; lastUsed: string; never: string; created: string;
  errorName: string; errorLimit: string; errorGeneric: string; docsHint: string;
}> = {
  fr: {
    title: "Clés API",
    desc: "Accédez aux données de foyers via notre API REST. Authentifiez vos requêtes avec l'en-tête X-API-Key.",
    newKeyPlaceholder: "Nom de la clé (ex: production, staging…)",
    create: "Créer",
    revoke: "Révoquer",
    revokeConfirm: "Révoquer cette clé ? Elle sera immédiatement inutilisable.",
    copyKey: "Copier",
    copied: "Copié !",
    oneTimeWarning: "Copiez cette clé maintenant — elle ne sera plus affichée.",
    neverSeen: "Pour des raisons de sécurité, la clé complète ne peut pas être récupérée.",
    noKeys: "Aucune clé API. Créez-en une ci-dessus.",
    lastUsed: "Dernière utilisation",
    never: "Jamais utilisée",
    created: "Créée le",
    errorName: "Le nom est requis.",
    errorLimit: "Maximum de 5 clés atteint. Révoquez-en une d'abord.",
    errorGeneric: "Erreur. Réessayez.",
    docsHint: "Endpoint : GET https://healthwatch-global.com/api/v1/outbreaks · Params : region, risk, limit, offset",
  },
  en: {
    title: "API keys",
    desc: "Access outbreak data via our REST API. Authenticate requests with the X-API-Key header.",
    newKeyPlaceholder: "Key name (e.g. production, staging…)",
    create: "Create",
    revoke: "Revoke",
    revokeConfirm: "Revoke this key? It will stop working immediately.",
    copyKey: "Copy",
    copied: "Copied!",
    oneTimeWarning: "Copy this key now — it won't be shown again.",
    neverSeen: "For security, the full key cannot be retrieved after this.",
    noKeys: "No API keys. Create one above.",
    lastUsed: "Last used",
    never: "Never used",
    created: "Created",
    errorName: "Name is required.",
    errorLimit: "Maximum of 5 keys reached. Revoke one first.",
    errorGeneric: "Error. Please try again.",
    docsHint: "Endpoint: GET https://healthwatch-global.com/api/v1/outbreaks · Params: region, risk, limit, offset",
  },
  es: {
    title: "Claves API",
    desc: "Acceda a los datos de brotes a través de nuestra API REST. Autentique solicitudes con el encabezado X-API-Key.",
    newKeyPlaceholder: "Nombre de la clave (p.ej. producción, staging…)",
    create: "Crear",
    revoke: "Revocar",
    revokeConfirm: "¿Revocar esta clave? Dejará de funcionar inmediatamente.",
    copyKey: "Copiar",
    copied: "¡Copiado!",
    oneTimeWarning: "Copie esta clave ahora — no se mostrará de nuevo.",
    neverSeen: "Por seguridad, la clave completa no puede recuperarse después.",
    noKeys: "Sin claves API. Cree una arriba.",
    lastUsed: "Último uso",
    never: "Nunca usada",
    created: "Creada",
    errorName: "El nombre es obligatorio.",
    errorLimit: "Máximo de 5 claves alcanzado. Revoque una primero.",
    errorGeneric: "Error. Inténtelo de nuevo.",
    docsHint: "Endpoint: GET https://healthwatch-global.com/api/v1/outbreaks · Params: region, risk, limit, offset",
  },
  ar: {
    title: "مفاتيح API",
    desc: "الوصول إلى بيانات التفشيات عبر API REST. مصادقة الطلبات بالترويسة X-API-Key.",
    newKeyPlaceholder: "اسم المفتاح (مثلاً: الإنتاج، التجريبي…)",
    create: "إنشاء",
    revoke: "إلغاء",
    revokeConfirm: "إلغاء هذا المفتاح؟ سيتوقف عن العمل فوراً.",
    copyKey: "نسخ",
    copied: "تم النسخ!",
    oneTimeWarning: "انسخ هذا المفتاح الآن — لن يُعرض مجدداً.",
    neverSeen: "لأسباب أمنية، لا يمكن استرداد المفتاح الكامل بعد هذا.",
    noKeys: "لا توجد مفاتيح API. أنشئ مفتاحاً أعلاه.",
    lastUsed: "آخر استخدام",
    never: "لم يُستخدم",
    created: "تاريخ الإنشاء",
    errorName: "الاسم مطلوب.",
    errorLimit: "الحد الأقصى هو 5 مفاتيح. ألغِ أحدها أولاً.",
    errorGeneric: "خطأ. يرجى المحاولة مجدداً.",
    docsHint: "النقطة: GET https://healthwatch-global.com/api/v1/outbreaks · المعاملات: region, risk, limit, offset",
  },
  id: {
    title: "Kunci API",
    desc: "Akses data wabah melalui REST API kami. Autentikasi permintaan dengan header X-API-Key.",
    newKeyPlaceholder: "Nama kunci (mis. produksi, staging…)",
    create: "Buat",
    revoke: "Cabut",
    revokeConfirm: "Cabut kunci ini? Kunci akan berhenti berfungsi segera.",
    copyKey: "Salin",
    copied: "Disalin!",
    oneTimeWarning: "Salin kunci ini sekarang — tidak akan ditampilkan lagi.",
    neverSeen: "Demi keamanan, kunci lengkap tidak dapat diambil kembali.",
    noKeys: "Belum ada kunci API. Buat satu di atas.",
    lastUsed: "Terakhir digunakan",
    never: "Belum pernah",
    created: "Dibuat",
    errorName: "Nama diperlukan.",
    errorLimit: "Maksimum 5 kunci tercapai. Cabut satu terlebih dahulu.",
    errorGeneric: "Terjadi kesalahan. Coba lagi.",
    docsHint: "Endpoint: GET https://healthwatch-global.com/api/v1/outbreaks · Params: region, risk, limit, offset",
  },
};

const LABELS: Record<string, Record<string, string>> = {
  fr: {
    title: "Mon compte",
    plan: "Formule actuelle",
    billing: "Facturation",
    manageBilling: "Gérer l'abonnement",
    manageDesc: "Modifier votre plan, mettre à jour votre moyen de paiement ou annuler via le portail Stripe sécurisé.",
    upgradeTo: "Passer à Pro",
    upgradeDesc: "Débloquez les chiffres exacts, les exports PDF, les alertes instantanées et plus encore.",
    account: "Compte",
    email: "Adresse email",
    memberSince: "Membre depuis",
    logout: "Se déconnecter",
    backHome: "← Retour au tableau de bord",
    dataExport: "Export des données",
    dataExportDesc: "Téléchargez l'ensemble des données d'épidémies actives au format CSV.",
    downloadCsv: "Télécharger CSV",
    trialEndsOn: "Essai gratuit jusqu'au",
    trialEnded: "Essai terminé",
  },
  en: {
    title: "My account",
    plan: "Current plan",
    billing: "Billing",
    manageBilling: "Manage subscription",
    manageDesc: "Change your plan, update your payment method or cancel via the secure Stripe portal.",
    upgradeTo: "Upgrade to Pro",
    upgradeDesc: "Unlock exact figures, PDF exports, instant alerts and more.",
    account: "Account",
    email: "Email address",
    memberSince: "Member since",
    logout: "Sign out",
    backHome: "← Back to dashboard",
    dataExport: "Data export",
    dataExportDesc: "Download all active outbreak data in CSV format for use in Excel or your own tools.",
    downloadCsv: "Download CSV",
    trialEndsOn: "Free trial until",
    trialEnded: "Trial ended",
  },
  es: {
    title: "Mi cuenta",
    plan: "Plan actual",
    billing: "Facturación",
    manageBilling: "Gestionar suscripción",
    manageDesc: "Cambie su plan, actualice su método de pago o cancele a través del portal seguro de Stripe.",
    upgradeTo: "Actualizar a Pro",
    upgradeDesc: "Desbloquee cifras exactas, exportaciones PDF, alertas instantáneas y más.",
    account: "Cuenta",
    email: "Dirección de correo",
    memberSince: "Miembro desde",
    logout: "Cerrar sesión",
    backHome: "← Volver al panel",
    dataExport: "Exportación de datos",
    dataExportDesc: "Descargue todos los datos de brotes activos en formato CSV para Excel u otras herramientas.",
    downloadCsv: "Descargar CSV",
    trialEndsOn: "Prueba gratuita hasta el",
    trialEnded: "Prueba finalizada",
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
    dataExport: "تصدير البيانات",
    dataExportDesc: "تنزيل جميع بيانات التفشيات النشطة بتنسيق CSV للاستخدام في Excel أو أدواتك الخاصة.",
    downloadCsv: "تنزيل CSV",
    trialEndsOn: "تجربة مجانية حتى",
    trialEnded: "انتهت التجربة",
  },
  id: {
    title: "Akun saya",
    plan: "Paket saat ini",
    billing: "Penagihan",
    manageBilling: "Kelola langganan",
    manageDesc: "Ubah paket, perbarui metode pembayaran, atau batalkan melalui portal Stripe yang aman.",
    upgradeTo: "Upgrade ke Pro",
    upgradeDesc: "Buka angka tepat, ekspor PDF, peringatan instan, dan lainnya.",
    account: "Akun",
    email: "Alamat email",
    memberSince: "Anggota sejak",
    logout: "Keluar",
    backHome: "← Kembali ke dasbor",
    dataExport: "Ekspor data",
    dataExportDesc: "Unduh semua data wabah aktif dalam format CSV untuk Excel atau alat Anda sendiri.",
    downloadCsv: "Unduh CSV",
    trialEndsOn: "Uji coba gratis hingga",
    trialEnded: "Uji coba berakhir",
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

  if (!user) redirect(`/${locale}/login?next=/${locale}/account`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, stripe_customer_id, stripe_subscription_id, created_at, slack_webhook_url, trial_ends_at, is_pilot, pilot_organization")
    .eq("id", user.id)
    .single();

  // Apply the same trial-expiry guard as the dashboard: if trial has ended and
  // no Stripe subscription exists, treat the user as free immediately rather
  // than waiting for the expire-trials cron (runs daily at 10:00 UTC).
  let plan = (profile?.plan || "free") as string;
  const rawEnd = profile?.trial_ends_at ?? null;
  if (
    plan !== "free" &&
    rawEnd &&
    new Date(rawEnd).getTime() < Date.now() &&
    !profile?.stripe_subscription_id
  ) {
    plan = "free";
  }

  const meta = PLAN_META[plan] ?? PLAN_META.free;
  const planIcon = PLAN_ICONS[meta.iconName] ?? PLAN_ICONS.gift;
  const hasBilling = !!profile?.stripe_customer_id;
  const isPaid = plan !== "free";

  // Institutional pilots (is_pilot=true) are meant to close as a human
  // conversation about a Team plan, not a self-serve $29/mo Pro checkout —
  // lib/trial-ending-email.ts and lib/trial-value-nudge-email.ts already
  // frame it that way. Without this, a pilot logging into their own account
  // saw the same generic "Add payment method" self-serve button as everyone
  // else, contradicting every email they'd received. Once they actually have
  // billing set up (hasBilling), they're a real paying customer either way —
  // show the normal billing management panel like anyone else.
  const isPilotPending = !!profile?.is_pilot && !hasBilling;
  const pilotOrg = (profile?.pilot_organization as string | null) || (locale === "fr" ? "votre organisation" : "your organization");
  const pilotMailtoHref = "mailto:david.deheunynck@gmail.com?subject=" + encodeURIComponent(
    locale === "fr" ? `Suite du pilote — ${pilotOrg}` : `Following up on our pilot — ${pilotOrg}`
  );
  const pilotCtaLabel =
    locale === "fr" ? "Répondre pour en discuter →" :
    locale === "es" ? "Responder para hablar →" :
    locale === "ar" ? "← الرد للمناقشة" :
    locale === "id" ? "Balas untuk berdiskusi →" :
    "Reply to discuss →";
  const pilotBodyText = (org: string) =>
    locale === "fr" ? `Votre équipe a un accès pilote actif pour ${org}. Pour continuer au-delà du pilote, répondez à cet email — on cale un tarif Team adapté (à partir de 149€/mois pour 5 sièges).` :
    locale === "es" ? `Su equipo tiene un acceso piloto activo para ${org}. Para continuar más allá del piloto, responda a este email.` :
    locale === "ar" ? `يملك فريقكم وصولاً تجريبياً نشطاً لـ ${org}. للاستمرار بعد التجربة، ردوا على هذا البريد.` :
    locale === "id" ? `Tim Anda memiliki akses pilot aktif untuk ${org}. Untuk melanjutkan setelah pilot, balas email ini saja.` :
    `Your team has an active pilot access for ${org}. To continue beyond the pilot, just reply to this email — we'll set up a Team plan that fits (from €149/month for 5 seats).`;

  // Fetch subscribed alert regions
  const { data: alertRegionsData } = await supabase
    .from("user_alert_regions")
    .select("region, min_risk")
    .eq("user_id", user.id);
  const initialAlertRegions = (alertRegionsData ?? []).map((r: { region: string }) => r.region);
  const initialAlertMinRisk = Object.fromEntries(
    (alertRegionsData ?? []).map((r: { region: string; min_risk: string | null }) => [r.region, r.min_risk ?? "low"])
  );

  const al = ALERT_LABELS[locale] ?? ALERT_LABELS.en;
  const sl  = SLACK_LABELS[locale]   ?? SLACK_LABELS.en;
  const akl = API_KEY_LABELS[locale] ?? API_KEY_LABELS.en;

  const slackUrl: string | null = profile?.slack_webhook_url ?? null;
  const showApiKeys = ["pro", "team", "enterprise"].includes(plan);
  const { data: apiKeysData } = showApiKeys
    ? await supabase
        .from("api_keys")
        .select("id, name, key_prefix, last_used_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  const slackConfigured = !!slackUrl;
  const slackMasked = slackUrl ? `${slackUrl.slice(0, 30)}…${slackUrl.slice(-6)}` : slackUrl;

  const localeTag = locale === "ar" ? "ar-SA" : locale;
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(localeTag, { year: "numeric", month: "long" })
    : "—";

  const trialEndsAt = rawEnd ? new Date(rawEnd) : null;
  const trialActive = trialEndsAt !== null && trialEndsAt > new Date();
  const trialExpired = trialEndsAt !== null && trialEndsAt <= new Date();
  const trialDateStr = trialEndsAt
    ? trialEndsAt.toLocaleDateString(localeTag, {
        day: "numeric", month: "long", year: "numeric",
      })
    : null;
  const trialDaysLeft = trialActive && trialEndsAt
    ? Math.ceil((trialEndsAt.getTime() - Date.now()) / 86_400_000)
    : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4">
      <TrackPageView action="account_view" metadata={{ locale, plan }} />

      {/* Back link */}
      <Link href={`/${locale}`} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
        {l.backHome}
      </Link>

      <h1 className="text-2xl font-bold text-white">{l.title}</h1>

      {/* Plan card */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">{l.plan}</h2>
        <div className="flex items-center flex-wrap gap-3">
          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold ${meta.color}`}>
            {planIcon}
            {meta.label}
          </span>
          {trialActive && trialDateStr && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              {trialDaysLeft !== null && trialDaysLeft > 0
                ? `${trialDaysLeft} ${locale === "fr" ? "jours restants" : locale === "es" ? "días restantes" : locale === "ar" ? "أيام متبقية" : locale === "id" ? "hari tersisa" : "days left"} · `
                : ""}
              {l.trialEndsOn} {trialDateStr}
            </span>
          )}
          {trialExpired && trialDateStr && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-700 border border-gray-600 text-gray-400 text-xs font-medium">
              {l.trialEnded}
            </span>
          )}
        </div>

        {/* Billing management */}
        {isPaid && hasBilling ? (
          <div className="pt-2 space-y-3 border-t border-gray-800">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">{l.billing}</h3>
            <p className="text-sm text-gray-400">{l.manageDesc}</p>
            <BillingPortalButton locale={locale} label={l.manageBilling} />
          </div>
        ) : isPaid && !hasBilling && isPilotPending ? (
          /* Institutional pilot, no billing set up yet — human conversation, not self-serve checkout */
          <div className="pt-2 border-t border-gray-800 space-y-3">
            <p className="text-sm text-gray-400">{pilotBodyText(pilotOrg)}</p>
            <a
              href={pilotMailtoHref}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
            >
              {pilotCtaLabel}
            </a>
          </div>
        ) : isPaid && !hasBilling ? (
          /* Trial activated via Supabase (no Stripe checkout yet) — guide them to add a payment method */
          <div className="pt-2 border-t border-gray-800 space-y-3">
            <p className="text-sm text-gray-400">
              {locale === "fr" ? "Votre essai Pro est actif. Ajoutez un moyen de paiement pour conserver l'accès après la fin de l'essai." :
               locale === "es" ? "Su prueba Pro está activa. Añada un método de pago para conservar el acceso tras el período de prueba." :
               locale === "ar" ? "تجربتك Pro نشطة. أضف طريقة دفع للاحتفاظ بالوصول بعد انتهاء التجربة." :
               locale === "id" ? "Uji coba Pro Anda aktif. Tambahkan metode pembayaran untuk mempertahankan akses setelah uji coba." :
               "Your Pro trial is active. Add a payment method to keep access after the trial ends."}
            </p>
            <CheckoutButton
              billing="monthly"
              plan="pro"
              locale={locale}
              label={
                locale === "fr" ? "Ajouter un moyen de paiement →" :
                locale === "es" ? "Añadir método de pago →" :
                locale === "ar" ? "← إضافة طريقة دفع" :
                locale === "id" ? "Tambahkan metode pembayaran →" :
                "Add payment method →"
              }
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
            />
          </div>
        ) : !isPaid && isPilotPending ? (
          /* Pilot trial expired (downgraded to free) without ever setting up billing —
             still a human conversation, not a self-serve resubscribe. */
          <div className="pt-2 border-t border-gray-800 space-y-3">
            <p className="text-sm text-gray-400">{pilotBodyText(pilotOrg)}</p>
            <a
              href={pilotMailtoHref}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
            >
              {pilotCtaLabel}
            </a>
          </div>
        ) : !isPaid ? (
          <div className="pt-2 border-t border-gray-800 space-y-3">
            <p className="text-sm text-gray-400">
              {trialExpired
                ? (locale === "fr" ? "Votre essai est terminé. Abonnez-vous pour retrouver l'accès aux chiffres exacts, aux alertes et aux rapports PDF." :
                   locale === "es" ? "Su prueba ha finalizado. Suscríbase para recuperar el acceso a cifras exactas, alertas e informes PDF." :
                   locale === "ar" ? "انتهت تجربتك. اشترك لاستعادة الوصول إلى الأرقام الدقيقة والتنبيهات وتقارير PDF." :
                   locale === "id" ? "Uji coba Anda telah berakhir. Berlangganan untuk mendapatkan kembali akses ke angka tepat, peringatan, dan laporan PDF." :
                   "Your trial ended. Subscribe to get back access to exact figures, alerts and PDF reports.")
                : l.upgradeDesc}
            </p>
            <CheckoutButton
              billing="monthly"
              plan="pro"
              locale={locale}
              label={trialExpired
                ? (locale === "fr" ? "S'abonner à Pro →" :
                   locale === "es" ? "Suscribirse a Pro →" :
                   locale === "ar" ? "← الاشتراك في Pro" :
                   locale === "id" ? "Berlangganan Pro →" :
                   "Subscribe to Pro →")
                : l.upgradeTo}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
            />
            <p className="text-xs text-gray-600">
              {trialExpired
                ? (locale === "fr" ? `À partir de ${PRICE_DISPLAY.fr.proMonthly}/mois ou ${PRICE_DISPLAY.fr.proAnnual}/an` :
                   locale === "es" ? `Desde ${PRICE_DISPLAY.es.proMonthly}/mes o ${PRICE_DISPLAY.es.proAnnual}/año` :
                   locale === "ar" ? `ابتداءً من ${PRICE_DISPLAY.ar.proMonthly}/شهر أو ${PRICE_DISPLAY.ar.proAnnual}/سنة` :
                   locale === "id" ? `Mulai ${PRICE_DISPLAY.id.proMonthly}/bulan atau ${PRICE_DISPLAY.id.proAnnual}/tahun` :
                   `From ${PRICE_DISPLAY.en_eur.proMonthly}/month or ${PRICE_DISPLAY.en_eur.proAnnual}/year`)
                : (locale === "fr" ? `Carte requise à la souscription, aucun débit avant la fin de l'essai${trialDaysLeft ? ` (${trialDaysLeft} jour${trialDaysLeft > 1 ? "s" : ""} restant${trialDaysLeft > 1 ? "s" : ""})` : ""}` :
                   locale === "es" ? `Tarjeta requerida al suscribirse, sin cobro hasta que termine la prueba${trialDaysLeft ? ` (quedan ${trialDaysLeft} día${trialDaysLeft > 1 ? "s" : ""})` : ""}` :
                   locale === "ar" ? `البطاقة مطلوبة عند الاشتراك، لا خصم قبل انتهاء التجربة${trialDaysLeft ? ` (تبقّى ${trialDaysLeft} يوم)` : ""}` :
                   locale === "id" ? `Kartu diperlukan saat berlangganan, tidak ada tagihan sebelum uji coba berakhir${trialDaysLeft ? ` (${trialDaysLeft} hari tersisa)` : ""}` :
                   `Card required at signup, no charge until your trial ends${trialDaysLeft ? ` (${trialDaysLeft} day${trialDaysLeft > 1 ? "s" : ""} left)` : ""}`)}
            </p>
            {trialExpired && (
              <p className="text-xs text-gray-600">
                {locale === "fr" ? "Satisfait ou remboursé 14 jours — sans condition." :
                 locale === "es" ? "14 días de garantía de devolución — sin preguntas." :
                 locale === "ar" ? "ضمان استرداد الأموال خلال 14 يوماً." :
                 locale === "id" ? "Garansi uang kembali 14 hari." :
                 "14-day money-back guarantee — no questions asked."}
              </p>
            )}
          </div>
        ) : null}
      </div>

      {/* Team management — team plan only */}
      {plan === "team" && (
        <div className="bg-gray-900 border border-amber-600/30 rounded-2xl p-6 space-y-3">
          <h2 className="text-sm font-semibold text-amber-400/80 uppercase tracking-wide flex items-center gap-2">
            <Users className="w-4 h-4" />
            {locale === "fr" ? "Gestion de l'équipe" :
             locale === "es" ? "Gestión del equipo" :
             locale === "ar" ? "إدارة الفريق" :
             locale === "id" ? "Manajemen Tim" :
             "Team management"}
          </h2>
          <p className="text-sm text-gray-400">
            {locale === "fr" ? "Invitez des membres, gérez les sièges et suivez l'accès de votre équipe." :
             locale === "es" ? "Invite miembros, gestione puestos y controle el acceso de su equipo." :
             locale === "ar" ? "ادعُ أعضاءً وأدِر المقاعد وتابع وصول فريقك." :
             locale === "id" ? "Undang anggota, kelola kursi, dan pantau akses tim Anda." :
             "Invite members, manage seats and track your team's access."}
          </p>
          <Link
            href={`/${locale}/account/team`}
            className="inline-flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
          >
            <Users className="w-4 h-4" />
            {locale === "fr" ? "Gérer l'équipe →" :
             locale === "es" ? "Gestionar equipo →" :
             locale === "ar" ? "← إدارة الفريق" :
             locale === "id" ? "Kelola tim →" :
             "Manage team →"}
          </Link>
        </div>
      )}

      {/* CSV export — paid users only */}
      {isPaid && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">{l.dataExport}</h2>
          <p className="text-sm text-gray-400">{l.dataExportDesc}</p>
          <div className="flex items-center gap-2">
            <a
              href="/api/export"
              download
              className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              {l.downloadCsv}
            </a>
            <a
              href="/api/export?format=json"
              download
              className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              {locale === "fr" ? "Télécharger JSON" :
               locale === "es" ? "Descargar JSON" :
               locale === "ar" ? "تنزيل JSON" :
               locale === "id" ? "Unduh JSON" :
               "Download JSON"}
            </a>
          </div>
        </div>
      )}

      {/* Push notifications — device-level, free for everyone (unlike the
          email-based alert cards below, which are Pro+). Self-contained:
          owns its own copy and card chrome, like DiseaseAlertPicker. */}
      <PushNotificationToggle locale={locale} />

      {/* Regional alerts */}
      <div id="regional-alerts" className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">{al.title}</h2>
          <p className="text-sm text-gray-500 mt-1">{al.desc}</p>
        </div>
        <AlertRegionToggles
          isPaid={isPaid}
          initialRegions={initialAlertRegions}
          initialMinRisk={initialAlertMinRisk}
          labels={al}
        />
      </div>

      {/* Disease-specific alerts */}
      <div id="disease-alerts">
        <DiseaseAlertPicker locale={locale} isPaid={isPaid} />
      </div>

      {/* Alert email language */}
      {isPaid && <AlertLocalePanel locale={locale} />}

      {/* Slack / Teams integration */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">{sl.title}</h2>
          <p className="text-sm text-gray-500 mt-1">{sl.desc}</p>
        </div>
        <SlackWebhookForm
          isPaid={isPaid}
          initialConfigured={slackConfigured}
          initialMasked={slackMasked}
          labels={sl}
        />
      </div>

      {/* API keys — pro/team/enterprise */}
      {showApiKeys && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">{akl.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{akl.desc}</p>
          </div>
          <ApiKeyManager
            initialKeys={apiKeysData ?? []}
            labels={akl}
            locale={locale}
          />
        </div>
      )}

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

        {/* Danger zone */}
        <div className="pt-4 border-t border-red-900/30">
          <DeleteAccountButton locale={locale} />
        </div>
      </div>

    </div>
  );
}
