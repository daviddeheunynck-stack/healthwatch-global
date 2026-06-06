import { getLocale } from "next-intl/server";
import Link from "next/link";
import { Shield, ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const titles: Record<string, string> = {
    fr: "Politique de confidentialité",
    en: "Privacy Policy",
    es: "Política de privacidad",
    ar: "سياسة الخصوصية",
    id: "Kebijakan Privasi",
  };
  return {
    title: titles[locale] ?? titles.en,
    description: "HealthWatch Global — RGPD / GDPR compliance, données collectées, sous-traitants, vos droits.",
    robots: { index: true, follow: true },
  };
}

const COPY: Record<string, {
  back: string; title: string; updated: string;
  s1t: string; s1p: string;
  s2t: string;
  s2a_title: string; s2a_body: string;
  s2b_title: string; s2b_body: string;
  s2c_title: string; s2c_body: string;
  s2d_title: string; s2d_body: string;
  s3t: string; s3a: string; s3b: string; s3c: string;
  s4t: string; s4_processor: string; s4_purpose: string; s4_location: string;
  s4_rows: [string, string, string][];
  s4_note: string;
  s5t: string; s5a: string; s5b: string; s5c: string;
  s6t: string; s6p: string; s6cnil: string;
  s7t: string; s7p: string;
  s8t: string; s8p: string;
}> = {
  fr: {
    back: "Retour au tableau de bord",
    title: "Politique de confidentialité",
    updated: "Dernière mise à jour : 5 juin 2026",
    s1t: "1. Responsable du traitement",
    s1p: "HealthWatch Global est exploité par David Deheunynck (micro-entrepreneur, France). Pour toute demande relative à la confidentialité, contactez-nous à",
    s2t: "2. Données collectées",
    s2a_title: "Création de compte",
    s2a_body: "Adresse email et mot de passe (haché). Utilisés pour vous authentifier et gérer votre abonnement.",
    s2b_title: "Préférences d'alertes",
    s2b_body: "Email, régions géographiques et maladies surveillées, langue. Utilisés pour envoyer les alertes épidémiologiques demandées (digest hebdomadaire, alertes régionales, alertes par maladie).",
    s2c_title: "Formulaire de contact",
    s2c_body: "Nom, email, organisation (facultatif), message. Utilisés uniquement pour répondre à votre demande.",
    s2d_title: "Paiement",
    s2d_body: "Les données de facturation sont traitées directement par Stripe. HealthWatch Global ne stocke jamais les numéros de carte.",
    s3t: "3. Base légale (RGPD)",
    s3a: "Exécution du contrat — fourniture du service souscrit.",
    s3b: "Intérêt légitime — réponse aux soumissions du formulaire de contact.",
    s3c: "Consentement — envoi du digest hebdomadaire (désinscription possible à tout moment).",
    s4t: "4. Sous-traitants",
    s4_processor: "Prestataire", s4_purpose: "Finalité", s4_location: "Localisation",
    s4_rows: [
      ["Supabase", "Base de données et authentification", "UE (Francfort)"],
      ["Brevo", "Emails transactionnels et alertes", "UE (Paris)"],
      ["Stripe", "Traitement des paiements", "UE / US"],
      ["Vercel", "Hébergement et réseau CDN", "CDN mondial"],
      ["WHO OData API", "Source des données épidémiques (données publiques)", "Public"],
    ],
    s4_note: "Nous ne vendons ni ne louons vos données personnelles à des tiers.",
    s5t: "5. Durée de conservation",
    s5a: "Données de compte : conservées pendant la durée du compte, puis supprimées sous 30 jours après clôture.",
    s5b: "Abonnements aux alertes : conservés jusqu'à désinscription.",
    s5c: "Formulaire de contact : conservé jusqu'à 1 an à des fins de suivi.",
    s6t: "6. Vos droits (RGPD)",
    s6p: "Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, de portabilité et d'opposition au traitement de vos données. Pour exercer ces droits, contactez-nous à",
    s6cnil: "Vous pouvez également introduire une réclamation auprès de la CNIL (autorité française de contrôle) —",
    s7t: "7. Cookies et analytique",
    s7p: "Nous utilisons un cookie de session Supabase à des fins d'authentification. Aucun cookie publicitaire ou de traçage n'est utilisé. Vercel Analytics mesure l'audience de façon agrégée (pages vues, pays d'origine) sans collecter de données personnelles, sans déposer de cookie, en conformité totale avec le RGPD.",
    s8t: "8. Modifications",
    s8p: "Nous pouvons mettre à jour cette politique pour refléter l'évolution de nos pratiques ou de la législation. Les utilisateurs inscrits seront notifiés par email de tout changement substantiel.",
  },
  en: {
    back: "Back to dashboard",
    title: "Privacy Policy",
    updated: "Last updated: May 25, 2026",
    s1t: "1. Data Controller",
    s1p: "HealthWatch Global is operated by David Deheunynck (sole trader, France). For any privacy-related request, contact us at",
    s2t: "2. Data We Collect",
    s2a_title: "Account registration",
    s2a_body: "Email address and password (hashed). Used to authenticate you and manage your subscription.",
    s2b_title: "Alert subscriptions",
    s2b_body: "Email address, preferred region and language. Used to send you the weekly health digest you requested.",
    s2c_title: "Contact form",
    s2c_body: "Name, email, organization (optional), message. Used solely to respond to your inquiry.",
    s2d_title: "Payment",
    s2d_body: "Billing details are processed directly by Stripe. HealthWatch Global never stores card numbers.",
    s3t: "3. Legal Basis (GDPR)",
    s3a: "Contract performance — providing the service you subscribed to.",
    s3b: "Legitimate interest — responding to contact form submissions.",
    s3c: "Consent — sending the weekly alert digest (you can unsubscribe at any time).",
    s4t: "4. Third-Party Processors",
    s4_processor: "Processor", s4_purpose: "Purpose", s4_location: "Location",
    s4_rows: [
      ["Supabase", "Database & authentication", "EU (Frankfurt)"],
      ["Brevo", "Transactional emails & alerts", "EU (Paris)"],
      ["Stripe", "Payment processing", "EU / US"],
      ["Vercel", "Hosting & edge network", "Global CDN"],
      ["WHO OData API", "Epidemic data source (public data)", "Public"],
    ],
    s4_note: "We do not sell or rent your personal data to any third party.",
    s5t: "5. Data Retention",
    s5a: "Account data: retained for the duration of your account, then deleted within 30 days of closure.",
    s5b: "Alert subscriptions: retained until you unsubscribe.",
    s5c: "Contact form data: retained for up to 1 year for follow-up purposes.",
    s6t: "6. Your Rights (GDPR)",
    s6p: "Under the GDPR, you have the right to access, rectify, erase, restrict or port your personal data, and to object to its processing. To exercise any of these rights, email us at",
    s6cnil: "You also have the right to lodge a complaint with your national supervisory authority (in France: CNIL) —",
    s7t: "7. Analytics & Cookies",
    s7p: "We use a single session cookie set by Supabase for authentication purposes. No tracking or advertising cookies are used. Vercel Analytics measures aggregate audience metrics (page views, country of origin) — no personal data, no cookies, fully GDPR-compliant.",
    s8t: "8. Changes to this Policy",
    s8p: "We may update this policy to reflect changes in our practices or applicable law. Registered users will be notified by email of any material changes.",
  },
  es: {
    back: "Volver al panel",
    title: "Política de privacidad",
    updated: "Última actualización: 5 de junio de 2026",
    s1t: "1. Responsable del tratamiento",
    s1p: "HealthWatch Global es operado por David Deheunynck (autónomo, Francia). Para cualquier solicitud relacionada con la privacidad, contáctenos en",
    s2t: "2. Datos que recopilamos",
    s2a_title: "Registro de cuenta",
    s2a_body: "Dirección de email y contraseña (hash). Usados para autenticarle y gestionar su suscripción.",
    s2b_title: "Preferencias de alertas",
    s2b_body: "Email, regiones geográficas y enfermedades vigiladas, idioma. Usados para enviar las alertas epidemiológicas solicitadas (digest semanal, alertas regionales, alertas por enfermedad).",
    s2c_title: "Formulario de contacto",
    s2c_body: "Nombre, email, organización (opcional), mensaje. Usados únicamente para responder a su consulta.",
    s2d_title: "Pago",
    s2d_body: "Los datos de facturación son procesados directamente por Stripe. HealthWatch Global nunca almacena números de tarjeta.",
    s3t: "3. Base legal (RGPD)",
    s3a: "Ejecución del contrato — prestación del servicio contratado.",
    s3b: "Interés legítimo — respuesta a las consultas del formulario de contacto.",
    s3c: "Consentimiento — envío del digest semanal (puede cancelar la suscripción en cualquier momento).",
    s4t: "4. Subcontratistas",
    s4_processor: "Proveedor", s4_purpose: "Finalidad", s4_location: "Ubicación",
    s4_rows: [
      ["Supabase", "Base de datos y autenticación", "UE (Fráncfort)"],
      ["Brevo", "Emails transaccionales y alertas", "UE (París)"],
      ["Stripe", "Procesamiento de pagos", "UE / EE. UU."],
      ["Vercel", "Alojamiento y red CDN", "CDN global"],
      ["WHO OData API", "Fuente de datos epidémicos (datos públicos)", "Público"],
    ],
    s4_note: "No vendemos ni alquilamos sus datos personales a terceros.",
    s5t: "5. Conservación de datos",
    s5a: "Datos de cuenta: conservados durante la vigencia de su cuenta y eliminados en un plazo de 30 días tras su cierre.",
    s5b: "Suscripciones a alertas: conservados hasta que cancele la suscripción.",
    s5c: "Formulario de contacto: conservados hasta 1 año para seguimiento.",
    s6t: "6. Sus derechos (RGPD)",
    s6p: "Conforme al RGPD, tiene derecho de acceso, rectificación, supresión, limitación, portabilidad y oposición al tratamiento de sus datos. Para ejercer estos derechos, escríbanos a",
    s6cnil: "También puede presentar una reclamación ante la autoridad supervisora nacional (en Francia: CNIL) —",
    s7t: "7. Analítica y cookies",
    s7p: "Utilizamos una cookie de sesión de Supabase para la autenticación. No se usan cookies publicitarias ni de rastreo. Vercel Analytics mide métricas de audiencia agregadas sin recopilar datos personales, totalmente conforme al RGPD.",
    s8t: "8. Cambios en esta política",
    s8p: "Podemos actualizar esta política para reflejar cambios en nuestras prácticas o la legislación aplicable. Los usuarios registrados serán notificados por email de cualquier cambio sustancial.",
  },
  ar: {
    back: "العودة إلى لوحة التحكم",
    title: "سياسة الخصوصية",
    updated: "آخر تحديث: 25 مايو 2026",
    s1t: "1. المسؤول عن معالجة البيانات",
    s1p: "يُشغَّل HealthWatch Global من قِبل David Deheunynck (تاجر منفرد، فرنسا). لأي طلب متعلق بالخصوصية، تواصل معنا على",
    s2t: "2. البيانات التي نجمعها",
    s2a_title: "إنشاء حساب",
    s2a_body: "عنوان البريد الإلكتروني وكلمة المرور (مشفرة). تُستخدم لتوثيق هويتك وإدارة اشتراكك.",
    s2b_title: "تفضيلات التنبيهات",
    s2b_body: "البريد الإلكتروني والمناطق الجغرافية والأمراض المراقبة واللغة. تُستخدم لإرسال التنبيهات الوبائية المطلوبة (الملخص الأسبوعي والتنبيهات الإقليمية وتنبيهات الأمراض).",
    s2c_title: "نموذج الاتصال",
    s2c_body: "الاسم والبريد الإلكتروني والمؤسسة (اختياري) والرسالة. تُستخدم فقط للرد على استفسارك.",
    s2d_title: "الدفع",
    s2d_body: "تُعالَج بيانات الفواتير مباشرةً من قِبل Stripe. لا يخزّن HealthWatch Global أرقام البطاقات مطلقًا.",
    s3t: "3. الأساس القانوني (اللائحة العامة لحماية البيانات)",
    s3a: "تنفيذ العقد — تقديم الخدمة التي اشتركت فيها.",
    s3b: "المصلحة المشروعة — الرد على استفسارات نموذج الاتصال.",
    s3c: "الموافقة — إرسال الملخص الأسبوعي (يمكنك إلغاء الاشتراك في أي وقت).",
    s4t: "4. مزودو الخدمة الخارجيون",
    s4_processor: "المزود", s4_purpose: "الغرض", s4_location: "الموقع",
    s4_rows: [
      ["Supabase", "قاعدة البيانات والمصادقة", "الاتحاد الأوروبي (فرانكفورت)"],
      ["Brevo", "رسائل البريد الإلكتروني والتنبيهات", "الاتحاد الأوروبي (باريس)"],
      ["Stripe", "معالجة المدفوعات", "الاتحاد الأوروبي / الولايات المتحدة"],
      ["Vercel", "الاستضافة وشبكة CDN", "CDN عالمي"],
      ["WHO OData API", "مصدر البيانات الوبائية (بيانات عامة)", "عام"],
    ],
    s4_note: "لا نبيع بياناتك الشخصية ولا نؤجرها لأي طرف ثالث.",
    s5t: "5. مدة الاحتفاظ بالبيانات",
    s5a: "بيانات الحساب: تُحفظ طوال مدة الحساب، ثم تُحذف خلال 30 يومًا من إغلاقه.",
    s5b: "اشتراكات التنبيهات: تُحفظ حتى إلغاء الاشتراك.",
    s5c: "بيانات نموذج الاتصال: تُحفظ لمدة تصل إلى سنة لأغراض المتابعة.",
    s6t: "6. حقوقك",
    s6p: "بموجب اللائحة العامة لحماية البيانات، يحق لك الوصول إلى بياناتك الشخصية وتصحيحها وحذفها وتقييد معالجتها ونقلها والاعتراض على معالجتها. لممارسة أي من هذه الحقوق، راسلنا على",
    s6cnil: "يحق لك أيضًا تقديم شكوى إلى هيئة الرقابة الوطنية (في فرنسا: CNIL) —",
    s7t: "7. التحليلات وملفات تعريف الارتباط",
    s7p: "نستخدم ملف تعريف ارتباط جلسة واحد من Supabase لأغراض المصادقة. لا تُستخدم ملفات تعريف الارتباط الإعلانية أو التتبعية. يقيس Vercel Analytics مقاييس الجمهور المجمّعة دون جمع بيانات شخصية، بما يتوافق تمامًا مع اللائحة العامة لحماية البيانات.",
    s8t: "8. التغييرات على هذه السياسة",
    s8p: "قد نحدّث هذه السياسة لتعكس التغييرات في ممارساتنا أو القانون المعمول به. سيتم إخطار المستخدمين المسجلين عبر البريد الإلكتروني بأي تغييرات جوهرية.",
  },
  id: {
    back: "Kembali ke dasbor",
    title: "Kebijakan Privasi",
    updated: "Terakhir diperbarui: 5 Juni 2026",
    s1t: "1. Pengontrol Data",
    s1p: "HealthWatch Global dioperasikan oleh David Deheunynck (pedagang tunggal, Prancis). Untuk permintaan terkait privasi, hubungi kami di",
    s2t: "2. Data yang Kami Kumpulkan",
    s2a_title: "Registrasi akun",
    s2a_body: "Alamat email dan kata sandi (di-hash). Digunakan untuk mengautentikasi Anda dan mengelola langganan Anda.",
    s2b_title: "Preferensi peringatan",
    s2b_body: "Email, wilayah geografis dan penyakit yang dipantau, bahasa. Digunakan untuk mengirim peringatan epidemiologi yang diminta (digest mingguan, peringatan regional, peringatan penyakit).",
    s2c_title: "Formulir kontak",
    s2c_body: "Nama, email, organisasi (opsional), pesan. Digunakan hanya untuk merespons pertanyaan Anda.",
    s2d_title: "Pembayaran",
    s2d_body: "Detail penagihan diproses langsung oleh Stripe. HealthWatch Global tidak pernah menyimpan nomor kartu.",
    s3t: "3. Dasar Hukum (GDPR)",
    s3a: "Pelaksanaan kontrak — menyediakan layanan yang Anda langgani.",
    s3b: "Kepentingan sah — merespons pengiriman formulir kontak.",
    s3c: "Persetujuan — mengirimkan digest peringatan mingguan (Anda dapat berhenti berlangganan kapan saja).",
    s4t: "4. Pemroses Pihak Ketiga",
    s4_processor: "Pemroses", s4_purpose: "Tujuan", s4_location: "Lokasi",
    s4_rows: [
      ["Supabase", "Database & autentikasi", "UE (Frankfurt)"],
      ["Brevo", "Email transaksional & peringatan", "UE (Paris)"],
      ["Stripe", "Pemrosesan pembayaran", "UE / AS"],
      ["Vercel", "Hosting & jaringan CDN", "CDN global"],
      ["WHO OData API", "Sumber data epidemi (data publik)", "Publik"],
    ],
    s4_note: "Kami tidak menjual atau menyewakan data pribadi Anda kepada pihak ketiga.",
    s5t: "5. Retensi Data",
    s5a: "Data akun: disimpan selama akun aktif, lalu dihapus dalam 30 hari setelah penutupan.",
    s5b: "Langganan peringatan: disimpan hingga Anda berhenti berlangganan.",
    s5c: "Data formulir kontak: disimpan hingga 1 tahun untuk keperluan tindak lanjut.",
    s6t: "6. Hak Anda (GDPR)",
    s6p: "Berdasarkan GDPR, Anda berhak mengakses, memperbaiki, menghapus, membatasi, atau memindahkan data pribadi Anda, serta menolak pemrosesannya. Untuk menggunakan hak-hak ini, email kami di",
    s6cnil: "Anda juga berhak mengajukan keluhan kepada otoritas pengawas nasional (di Prancis: CNIL) —",
    s7t: "7. Analitik & Cookie",
    s7p: "Kami menggunakan satu cookie sesi dari Supabase untuk keperluan autentikasi. Tidak ada cookie pelacakan atau iklan yang digunakan. Vercel Analytics mengukur metrik audiens agregat tanpa mengumpulkan data pribadi, sepenuhnya sesuai GDPR.",
    s8t: "8. Perubahan Kebijakan",
    s8p: "Kami dapat memperbarui kebijakan ini untuk mencerminkan perubahan praktik atau hukum yang berlaku. Pengguna terdaftar akan diberitahu melalui email tentang perubahan material.",
  },
};

export default async function PrivacyPage() {
  const locale = await getLocale();
  const c = COPY[locale] ?? COPY.en;
  const isRtl = locale === "ar";

  return (
    <div className="max-w-3xl mx-auto space-y-10" dir={isRtl ? "rtl" : undefined}>

      <div>
        <Link
          href={`/${locale}`}
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {c.back}
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-600/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-red-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">{c.title}</h1>
        </div>
        <p className="text-gray-500 text-sm">{c.updated}</p>
      </div>

      <div className="space-y-8 text-sm text-gray-400 leading-relaxed">

        {/* 1 */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">{c.s1t}</h2>
          <p>{c.s1p}{" "}
            <a href="mailto:contact@healthwatch-global.com" className="text-red-400 hover:text-red-300">
              contact@healthwatch-global.com
            </a>.
          </p>
        </section>

        {/* 2 */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">{c.s2t}</h2>
          <div className="space-y-3">
            {[
              { title: c.s2a_title, body: c.s2a_body },
              { title: c.s2b_title, body: c.s2b_body },
              { title: c.s2c_title, body: c.s2c_body },
              { title: c.s2d_title, body: c.s2d_body },
            ].map(({ title, body }) => (
              <div key={title} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-1">
                <p className="text-white text-sm font-medium">{title}</p>
                <p className="text-gray-400 text-sm">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 3 */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">{c.s3t}</h2>
          <ul className="space-y-2">
            {[c.s3a, c.s3b, c.s3c].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-red-400 shrink-0 mt-0.5">•</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* 4 */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">{c.s4t}</h2>
          <div className="overflow-hidden border border-gray-800 rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900">
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">{c.s4_processor}</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">{c.s4_purpose}</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">{c.s4_location}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {c.s4_rows.map(([name, purpose, location]) => (
                  <tr key={name} className="bg-gray-900/40">
                    <td className="px-4 py-3 text-white font-medium">{name}</td>
                    <td className="px-4 py-3 text-gray-400">{purpose}</td>
                    <td className="px-4 py-3 text-gray-500">{location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-gray-500 text-sm">{c.s4_note}</p>
        </section>

        {/* 5 */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">{c.s5t}</h2>
          <ul className="space-y-2">
            {[c.s5a, c.s5b, c.s5c].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-red-400 shrink-0 mt-0.5">•</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* 6 */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">{c.s6t}</h2>
          <p>
            {c.s6p}{" "}
            <a href="mailto:contact@healthwatch-global.com" className="text-red-400 hover:text-red-300">
              contact@healthwatch-global.com
            </a>
            {". "}
            {c.s6cnil}{" "}
            <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300">
              cnil.fr
            </a>.
          </p>
        </section>

        {/* 7 */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">{c.s7t}</h2>
          <p>{c.s7p}</p>
        </section>

        {/* 8 */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">{c.s8t}</h2>
          <p>{c.s8p}</p>
        </section>

        <p className="text-xs text-gray-600 pt-4 border-t border-gray-800">{c.updated}</p>

      </div>
    </div>
  );
}
