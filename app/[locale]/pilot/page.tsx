"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { CheckCircle, Loader2, Users, CalendarDays, MessageSquare, Shield, ArrowRight, FlaskConical, ChevronDown } from "lucide-react";
import Link from "next/link";

const COPY = {
  en: {
    tag: "Institutional Pilot Program",
    title: "Validate epidemic surveillance\nwith your field teams.",
    sub: "We offer a free 30-day Pro access for up to 5 members of your organization. No credit card. No sales pitch. In exchange, we ask for honest feedback from people who work in the field.",
    forTitle: "Built for",
    forItems: [
      "Epidemiologists at global health agencies (Africa CDC, ECDC, PAHO, WHO)",
      "Ministry of Health surveillance teams",
      "Public health research institutes",
      "International NGO health coordinators",
      "Humanitarian response program managers",
    ],
    includesTitle: "What the pilot includes",
    includes: [
      { icon: "users", title: "5 Pro seats, 30 days", desc: "Full access — exact figures, regional alerts, PDF reports, CSV export, Slack/Teams integration." },
      { icon: "calendar", title: "30-min onboarding call", desc: "We walk your team through the platform and configure alerts for your regions of interest." },
      { icon: "message", title: "Feedback session at close", desc: "A 45-min structured call to collect your team's experience. That's what we're here for." },
    ],
    askTitle: "What we ask in return",
    askItems: [
      "Two brief check-ins during the 30 days",
      "A structured feedback session at the end",
      "Permission to use anonymized learnings in product development",
    ],
    formTitle: "Apply for a pilot",
    formSub: "We review all applications within 48 hours.",
    labelName: "Full name",
    labelOrg: "Organization",
    labelRole: "Your role",
    labelEmail: "Work email",
    labelTeam: "Team size (people who would use the platform)",
    labelUseCase: "What would you use it for? (2–3 sentences)",
    placeholderUseCase: "e.g. Weekly epidemic briefing for our field teams in Sub-Saharan Africa, tracking cholera, mpox and measles signals...",
    submit: "Apply for the pilot →",
    submitting: "Sending…",
    successTitle: "Application received.",
    successDesc: "We'll review it and get back to you within 48 hours.",
    backLink: "← Back to pricing",
  },
  fr: {
    tag: "Programme Pilote Institutionnel",
    title: "Validez la surveillance épidémique\navec vos équipes terrain.",
    sub: "Nous offrons un accès Pro gratuit de 30 jours pour jusqu'à 5 membres de votre organisation. Sans carte bancaire. Sans démarche commerciale. En échange, nous demandons un retour honnête de personnes qui travaillent sur le terrain.",
    forTitle: "Conçu pour",
    forItems: [
      "Épidémiologistes d'agences internationales (Africa CDC, ECDC, PAHO, OMS)",
      "Équipes de surveillance des ministères de la santé",
      "Instituts de recherche en santé publique",
      "Coordinateurs santé d'ONG internationales",
      "Responsables de programmes de réponse humanitaire",
    ],
    includesTitle: "Ce que le pilote inclut",
    includes: [
      { icon: "users", title: "5 accès Pro, 30 jours", desc: "Accès complet — chiffres exacts, alertes régionales, rapports PDF, export CSV, intégration Slack/Teams." },
      { icon: "calendar", title: "Appel d'onboarding de 30 min", desc: "Nous accompagnons votre équipe sur la plateforme et configurons les alertes pour vos régions d'intérêt." },
      { icon: "message", title: "Session de retour à la clôture", desc: "Un appel structuré de 45 min pour recueillir l'expérience de votre équipe. C'est ce que nous recherchons." },
    ],
    askTitle: "Ce que nous demandons en retour",
    askItems: [
      "Deux points rapides pendant les 30 jours",
      "Une session de retour structurée en fin de pilote",
      "L'autorisation d'utiliser les apprentissages anonymisés pour le développement produit",
    ],
    formTitle: "Candidater au pilote",
    formSub: "Nous examinons toutes les candidatures sous 48 heures.",
    labelName: "Nom complet",
    labelOrg: "Organisation",
    labelRole: "Votre rôle",
    labelEmail: "Email professionnel",
    labelTeam: "Taille de l'équipe (personnes qui utiliseraient la plateforme)",
    labelUseCase: "Pour quel usage ? (2–3 phrases)",
    placeholderUseCase: "ex. Briefing épidémique hebdomadaire pour nos équipes terrain en Afrique subsaharienne, suivi des signaux choléra, mpox et rougeole...",
    submit: "Candidater au pilote →",
    submitting: "Envoi…",
    successTitle: "Candidature reçue.",
    successDesc: "Nous l'examinerons et reviendrons vers vous sous 48 heures.",
    backLink: "← Retour aux tarifs",
  },
  es: {
    tag: "Programa Piloto Institucional",
    title: "Valide la vigilancia epidémica\ncon sus equipos de campo.",
    sub: "Ofrecemos acceso Pro gratuito de 30 días para hasta 5 miembros de su organización. Sin tarjeta de crédito. Sin presión comercial. A cambio, pedimos comentarios honestos de personas que trabajan sobre el terreno.",
    forTitle: "Diseñado para",
    forItems: [
      "Epidemiólogos en agencias internacionales (Africa CDC, ECDC, PAHO, OMS)",
      "Equipos de vigilancia de ministerios de salud",
      "Institutos de investigación en salud pública",
      "Coordinadores de salud de ONG internacionales",
      "Responsables de programas de respuesta humanitaria",
    ],
    includesTitle: "Qué incluye el piloto",
    includes: [
      { icon: "users", title: "5 accesos Pro, 30 días", desc: "Acceso completo — cifras exactas, alertas regionales, informes PDF, exportación CSV, integración Slack/Teams." },
      { icon: "calendar", title: "Llamada de incorporación de 30 min", desc: "Guiamos a su equipo por la plataforma y configuramos alertas para sus regiones de interés." },
      { icon: "message", title: "Sesión de feedback al cierre", desc: "Una llamada estructurada de 45 min para recoger la experiencia de su equipo." },
    ],
    askTitle: "Qué pedimos a cambio",
    askItems: [
      "Dos breves puntos de control durante los 30 días",
      "Una sesión de retroalimentación estructurada al final",
      "Permiso para usar aprendizajes anonimizados en el desarrollo del producto",
    ],
    formTitle: "Solicitar el piloto",
    formSub: "Revisamos todas las solicitudes en 48 horas.",
    labelName: "Nombre completo",
    labelOrg: "Organización",
    labelRole: "Su rol",
    labelEmail: "Email profesional",
    labelTeam: "Tamaño del equipo (personas que usarían la plataforma)",
    labelUseCase: "¿Para qué lo usaría? (2–3 frases)",
    placeholderUseCase: "ej. Briefing epidemiológico semanal para nuestros equipos de campo en África subsahariana...",
    submit: "Solicitar el piloto →",
    submitting: "Enviando…",
    successTitle: "Solicitud recibida.",
    successDesc: "La revisaremos y le responderemos en 48 horas.",
    backLink: "← Volver a precios",
  },
  ar: {
    tag: "برنامج التجربة المؤسسية",
    title: "تحقق من مراقبة الأوبئة\nمع فرق العمل الميداني.",
    sub: "نقدم وصولاً مجانياً لخطة Pro لمدة 30 يوماً لما يصل إلى 5 أعضاء في مؤسستك. بدون بطاقة بنكية. بدون ضغوط تجارية. في المقابل، نطلب ملاحظات صادقة من أشخاص يعملون في الميدان.",
    forTitle: "مصمم لـ",
    forItems: [
      "علماء الأوبئة في الوكالات الدولية (Africa CDC، ECDC، PAHO، WHO)",
      "فرق مراقبة وزارات الصحة",
      "معاهد البحوث في الصحة العامة",
      "منسقو الصحة في المنظمات غير الحكومية الدولية",
      "مديرو برامج الاستجابة الإنسانية",
    ],
    includesTitle: "ما يتضمنه البرنامج التجريبي",
    includes: [
      { icon: "users", title: "5 مقاعد Pro، 30 يوماً", desc: "وصول كامل — أرقام دقيقة، تنبيهات إقليمية، تقارير PDF، تصدير CSV، تكامل Slack/Teams." },
      { icon: "calendar", title: "مكالمة تأهيل 30 دقيقة", desc: "نرشد فريقك عبر المنصة ونضبط التنبيهات لمناطق اهتمامكم." },
      { icon: "message", title: "جلسة تغذية راجعة في الختام", desc: "مكالمة منظمة مدتها 45 دقيقة لجمع تجربة فريقك." },
    ],
    askTitle: "ما نطلبه في المقابل",
    askItems: [
      "متابعتان موجزتان خلال الـ 30 يوماً",
      "جلسة تغذية راجعة منظمة في النهاية",
      "إذن باستخدام المعلومات المجهولة في تطوير المنتج",
    ],
    formTitle: "تقدم للبرنامج التجريبي",
    formSub: "نراجع جميع الطلبات خلال 48 ساعة.",
    labelName: "الاسم الكامل",
    labelOrg: "المنظمة",
    labelRole: "دورك",
    labelEmail: "البريد الإلكتروني المهني",
    labelTeam: "حجم الفريق (الأشخاص الذين سيستخدمون المنصة)",
    labelUseCase: "لماذا تحتاجه؟ (2–3 جمل)",
    placeholderUseCase: "مثال: إحاطة وبائية أسبوعية لفرقنا الميدانية...",
    submit: "← تقديم الطلب",
    submitting: "جارٍ الإرسال…",
    successTitle: "تم استلام طلبك.",
    successDesc: "سنراجعه ونتواصل معك خلال 48 ساعة.",
    backLink: "→ العودة إلى الأسعار",
  },
  id: {
    tag: "Program Pilot Institusional",
    title: "Validasi pemantauan epidemi\nbersama tim lapangan Anda.",
    sub: "Kami menawarkan akses Pro gratis selama 30 hari untuk hingga 5 anggota organisasi Anda. Tanpa kartu kredit. Tanpa tekanan penjualan. Sebagai gantinya, kami meminta umpan balik jujur dari orang-orang yang bekerja di lapangan.",
    forTitle: "Dirancang untuk",
    forItems: [
      "Epidemiolog di lembaga internasional (Africa CDC, ECDC, PAHO, WHO)",
      "Tim surveilans kementerian kesehatan",
      "Institut penelitian kesehatan masyarakat",
      "Koordinator kesehatan LSM internasional",
      "Manajer program respons kemanusiaan",
    ],
    includesTitle: "Apa yang termasuk dalam pilot",
    includes: [
      { icon: "users", title: "5 akses Pro, 30 hari", desc: "Akses penuh — angka tepat, peringatan regional, laporan PDF, ekspor CSV, integrasi Slack/Teams." },
      { icon: "calendar", title: "Panggilan onboarding 30 menit", desc: "Kami memandu tim Anda melalui platform dan mengonfigurasi peringatan untuk wilayah yang diminati." },
      { icon: "message", title: "Sesi umpan balik di akhir", desc: "Panggilan terstruktur 45 menit untuk mengumpulkan pengalaman tim Anda." },
    ],
    askTitle: "Yang kami minta sebagai gantinya",
    askItems: [
      "Dua check-in singkat selama 30 hari",
      "Sesi umpan balik terstruktur di akhir",
      "Izin untuk menggunakan pembelajaran anonim dalam pengembangan produk",
    ],
    formTitle: "Daftar untuk pilot",
    formSub: "Kami meninjau semua aplikasi dalam 48 jam.",
    labelName: "Nama lengkap",
    labelOrg: "Organisasi",
    labelRole: "Peran Anda",
    labelEmail: "Email kerja",
    labelTeam: "Ukuran tim (orang yang akan menggunakan platform)",
    labelUseCase: "Untuk apa Anda gunakan? (2–3 kalimat)",
    placeholderUseCase: "mis. Briefing epidemi mingguan untuk tim lapangan kami di Afrika Sub-Sahara...",
    submit: "Daftar untuk pilot →",
    submitting: "Mengirim…",
    successTitle: "Aplikasi diterima.",
    successDesc: "Kami akan meninjaunya dan menghubungi Anda dalam 48 jam.",
    backLink: "← Kembali ke harga",
  },
} as const;

const FAQ_COPY: Record<string, { title: string; items: { q: string; a: string }[] }> = {
  en: {
    title: "Frequently asked questions",
    items: [
      { q: "What data sources does HealthWatch use?", a: "All data comes directly from official WHO, ECDC, PAHO, and Africa CDC sources. We do not use secondary or unverified sources. The platform updates every 6 hours." },
      { q: "Is the platform GDPR compliant?", a: "Yes. The platform runs on European infrastructure (Vercel EU + Supabase EU). We do not collect personal health data from users. Your work email is the only personal data stored." },
      { q: "How does multi-user access work?", a: "Each team member gets their own individual account. The 5-seat pilot gives 5 independent logins, each with full Pro access. No shared passwords, no shared sessions." },
      { q: "What happens at the end of the 30 days?", a: "Accounts automatically revert to the Free plan. No charge, no credit card required. If your team wants to continue with Pro, we'll discuss options at the closing feedback session." },
      { q: "Do we need IT involvement to get started?", a: "No. HealthWatch is a web platform — no installation, no VPN, no firewall changes required. Access is via any modern browser. Slack and Teams integrations are optional and take under 2 minutes." },
    ],
  },
  fr: {
    title: "Questions fréquentes",
    items: [
      { q: "Quelles sources de données utilise HealthWatch ?", a: "Toutes les données proviennent directement des sources officielles OMS, ECDC, PAHO et Africa CDC. Nous n'utilisons aucune source secondaire ou non vérifiée. La plateforme se met à jour quotidiennement." },
      { q: "La plateforme est-elle conforme au RGPD ?", a: "Oui. La plateforme est hébergée sur une infrastructure européenne (Vercel EU + Supabase EU). Nous ne collectons pas de données de santé personnelles. Votre email professionnel est la seule donnée personnelle stockée." },
      { q: "Comment fonctionne l'accès multi-utilisateurs ?", a: "Chaque membre de l'équipe dispose de son propre compte individuel. Le pilote à 5 accès donne 5 logins indépendants, chacun avec l'accès Pro complet. Aucun mot de passe partagé." },
      { q: "Que se passe-t-il à la fin des 30 jours ?", a: "Les comptes passent automatiquement au plan Gratuit. Aucun frais, aucune carte bancaire requise. Si votre équipe souhaite continuer avec Pro, nous en discutons lors de la session de feedback de clôture." },
      { q: "Faut-il impliquer l'IT pour commencer ?", a: "Non. HealthWatch est une plateforme web — aucune installation, aucun VPN, aucune exception pare-feu nécessaire. L'accès se fait via tout navigateur moderne. Les intégrations Slack et Teams sont optionnelles et prennent moins de 2 minutes." },
    ],
  },
  es: {
    title: "Preguntas frecuentes",
    items: [
      { q: "¿Qué fuentes de datos utiliza HealthWatch?", a: "Todos los datos provienen directamente de las fuentes oficiales de OMS, ECDC, PAHO y Africa CDC. No utilizamos fuentes secundarias ni no verificadas. La plataforma se actualiza diariamente." },
      { q: "¿Es la plataforma conforme al RGPD?", a: "Sí. La plataforma se ejecuta en infraestructura europea (Vercel EU + Supabase EU). No recopilamos datos de salud personales. Su email profesional es el único dato personal almacenado." },
      { q: "¿Cómo funciona el acceso multiusuario?", a: "Cada miembro del equipo tiene su propia cuenta individual. El piloto de 5 accesos ofrece 5 inicios de sesión independientes, cada uno con acceso Pro completo. Sin contraseñas compartidas." },
      { q: "¿Qué sucede al final de los 30 días?", a: "Las cuentas vuelven automáticamente al plan Gratuito. Sin cargos, sin tarjeta de crédito requerida. Si su equipo desea continuar con Pro, lo discutiremos en la sesión de feedback de cierre." },
      { q: "¿Necesitamos involucrar al departamento de TI?", a: "No. HealthWatch es una plataforma web — no requiere instalación, VPN ni cambios de firewall. El acceso es a través de cualquier navegador moderno. Las integraciones con Slack y Teams son opcionales y tardan menos de 2 minutos." },
    ],
  },
  ar: {
    title: "الأسئلة المتكررة",
    items: [
      { q: "ما مصادر البيانات التي يستخدمها HealthWatch؟", a: "تأتي جميع البيانات مباشرة من المصادر الرسمية لمنظمة الصحة العالمية وECDC وPAHO وAfrica CDC. لا نستخدم مصادر ثانوية أو غير موثقة. تتحدث المنصة يومياً." },
      { q: "هل المنصة متوافقة مع اللائحة الأوروبية لحماية البيانات؟", a: "نعم. تعمل المنصة على بنية تحتية أوروبية (Vercel EU + Supabase EU). لا نجمع بيانات صحية شخصية. بريدك الإلكتروني المهني هو البيانات الشخصية الوحيدة المخزنة." },
      { q: "كيف يعمل الوصول متعدد المستخدمين؟", a: "يحصل كل عضو في الفريق على حسابه الخاص. يوفر البرنامج التجريبي 5 تسجيلات دخول مستقلة، كل منها بوصول Pro كامل. لا كلمات مرور مشتركة." },
      { q: "ماذا يحدث في نهاية الـ 30 يوماً؟", a: "تعود الحسابات تلقائياً إلى الخطة المجانية. لا رسوم، لا بطاقة بنكية مطلوبة. إذا أراد فريقك الاستمرار مع Pro، نناقش ذلك في جلسة التغذية الراجعة الختامية." },
      { q: "هل نحتاج إلى فريق تقنية المعلومات للبدء؟", a: "لا. HealthWatch منصة ويب — لا تثبيت، لا VPN، لا تغييرات في جدار الحماية. الوصول عبر أي متصفح حديث. تكاملات Slack وTeams اختيارية وتستغرق أقل من دقيقتين." },
    ],
  },
  id: {
    title: "Pertanyaan yang sering diajukan",
    items: [
      { q: "Sumber data apa yang digunakan HealthWatch?", a: "Semua data berasal langsung dari sumber resmi WHO, ECDC, PAHO, dan Africa CDC. Kami tidak menggunakan sumber sekunder atau yang tidak terverifikasi. Platform diperbarui setiap hari." },
      { q: "Apakah platform ini mematuhi GDPR?", a: "Ya. Platform berjalan di infrastruktur Eropa (Vercel EU + Supabase EU). Kami tidak mengumpulkan data kesehatan pribadi pengguna. Email kerja Anda adalah satu-satunya data pribadi yang disimpan." },
      { q: "Bagaimana akses multi-pengguna bekerja?", a: "Setiap anggota tim mendapatkan akun individual mereka sendiri. Pilot 5 kursi memberikan 5 login independen, masing-masing dengan akses Pro penuh. Tidak ada kata sandi bersama." },
      { q: "Apa yang terjadi setelah 30 hari?", a: "Akun secara otomatis kembali ke paket Gratis. Tidak ada biaya, tidak perlu kartu kredit. Jika tim Anda ingin melanjutkan dengan Pro, kami akan membahasnya di sesi umpan balik penutup." },
      { q: "Apakah kami perlu melibatkan IT untuk memulai?", a: "Tidak. HealthWatch adalah platform web — tidak ada instalasi, VPN, atau perubahan firewall yang diperlukan. Akses melalui browser modern apa pun. Integrasi Slack dan Teams bersifat opsional dan membutuhkan kurang dari 2 menit." },
    ],
  },
};

const INCLUDE_ICONS = {
  users:    Users,
  calendar: CalendarDays,
  message:  MessageSquare,
};

export default function PilotPage() {
  const locale = useLocale() as keyof typeof COPY;
  const c = COPY[locale] ?? COPY.en;
  const isRtl = locale === "ar";

  const [form, setForm] = useState({ name: "", organization: "", role: "", email: "", teamSize: "", useCase: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const faq = FAQ_COPY[locale] ?? FAQ_COPY.en;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const message = `[PILOT APPLICATION]\nRole: ${form.role}\nTeam size: ${form.teamSize}\nUse case: ${form.useCase}`;
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:         form.name,
          organization: form.organization,
          email:        form.email,
          message,
          locale,
        }),
      });
      if (!res.ok) throw new Error();
      setSuccess(true);
    } catch {
      setError(locale === "fr" ? "Une erreur est survenue. Réessayez." : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 transition-colors text-sm";

  return (
    <div className={`max-w-4xl mx-auto space-y-16${isRtl ? " text-right" : ""}`} dir={isRtl ? "rtl" : "ltr"}>

      {/* Hero */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 uppercase tracking-widest">
          <FlaskConical className="w-3.5 h-3.5" />
          {c.tag}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white whitespace-pre-line leading-tight">
          {c.title}
        </h1>
        <p className="text-gray-400 text-base max-w-2xl mx-auto leading-relaxed">{c.sub}</p>
      </div>

      {/* Credibility strip */}
      <div className="flex flex-wrap justify-center gap-6 border-y border-gray-800/60 py-5">
        {[
          { label: locale === "fr" ? "4 sources officielles : OMS · ECDC · PAHO · Africa CDC" : locale === "es" ? "4 fuentes oficiales: OMS · ECDC · PAHO · Africa CDC" : locale === "ar" ? "4 مصادر رسمية: WHO · ECDC · PAHO · Africa CDC" : locale === "id" ? "4 sumber resmi: WHO · ECDC · PAHO · Africa CDC" : "4 official sources: WHO · ECDC · PAHO · Africa CDC" },
          { label: locale === "fr" ? "195 pays surveillés" : locale === "es" ? "195 países monitorizados" : locale === "ar" ? "195 دولة مراقبة" : locale === "id" ? "195 negara dipantau" : "195 countries monitored" },
          { label: locale === "fr" ? "5 langues" : locale === "es" ? "5 idiomas" : locale === "ar" ? "5 لغات" : locale === "id" ? "5 bahasa" : "5 languages" },
          { label: locale === "fr" ? "Mise à jour toutes les 6h" : locale === "es" ? "Actualización cada 6 horas" : locale === "ar" ? "تحديث كل 6 ساعات" : locale === "id" ? "Diperbarui setiap 6 jam" : "Updated every 6 hours" },
        ].map(({ label }) => (
          <div key={label} className="flex items-center gap-2 text-sm text-gray-400">
            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* Two columns: includes + for whom */}
      <div className="grid md:grid-cols-2 gap-10">

        {/* What's included */}
        <div>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">{c.includesTitle}</h2>
          <div className="space-y-5">
            {c.includes.map((item) => {
              const Icon = INCLUDE_ICONS[item.icon as keyof typeof INCLUDE_ICONS];
              return (
                <div key={item.title} className="flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">{item.title}</p>
                    <p className="text-gray-400 text-sm mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* For whom + ask */}
        <div className="space-y-8">
          <div>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">{c.forTitle}</h2>
            <ul className="space-y-2.5">
              {c.forItems.map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-gray-300">
                  <ArrowRight className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gray-800/40 rounded-xl border border-gray-700/50 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-300">{c.askTitle}</h3>
            </div>
            <ul className="space-y-2">
              {c.askItems.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-gray-400">
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 p-8">
        <h2 className="text-xl font-bold text-white mb-1">{c.formTitle}</h2>
        <p className="text-sm text-gray-400 mb-8">{c.formSub}</p>

        {success ? (
          <div className="text-center py-10 space-y-3">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
            <p className="text-lg font-semibold text-white">{c.successTitle}</p>
            <p className="text-gray-400 text-sm">{c.successDesc}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{c.labelName} *</label>
                <input required className={inputClass} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{c.labelOrg} *</label>
                <input required className={inputClass} value={form.organization} onChange={e => setForm(f => ({ ...f, organization: e.target.value }))} />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{c.labelRole} *</label>
                <input required className={inputClass} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{c.labelEmail} *</label>
                <input required type="email" className={inputClass} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{c.labelTeam}</label>
              <input className={inputClass} placeholder="e.g. 3" value={form.teamSize} onChange={e => setForm(f => ({ ...f, teamSize: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{c.labelUseCase} *</label>
              <textarea
                required
                rows={3}
                className={`${inputClass} resize-none`}
                placeholder={c.placeholderUseCase}
                value={form.useCase}
                onChange={e => setForm(f => ({ ...f, useCase: e.target.value }))}
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex items-center justify-between pt-2">
              <Link href={`/${locale}/pricing`} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                {c.backLink}
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />{c.submitting}</> : c.submit}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* FAQ */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white">{faq.title}</h2>
        <div className="divide-y divide-gray-800 rounded-xl border border-gray-800 overflow-hidden">
          {faq.items.map((item, i) => (
            <div key={i}>
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-gray-800/40 transition-colors"
              >
                <span className="text-sm font-medium text-gray-200">{item.q}</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4 text-sm text-gray-400 leading-relaxed">{item.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
