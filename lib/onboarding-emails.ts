import { PRICE_DISPLAY } from "@/lib/pricing";
import { signUnsubscribeToken } from "@/lib/unsubscribe-token";

// ─── J+1 : First action — configure alert regions ─────────────────────────────

const J1_CONTENT: Record<string, {
  subject: string;
  headline: string;
  intro: string;
  actionTitle: string;
  actionDesc: string;
  ctaLabel: string;
  secondaryLabel: string;
  closing: string;
  unsubNote: string;
}> = {
  fr: {
    subject: "Une action à faire maintenant — vos régions d'alerte",
    headline: "Votre accès Pro est actif.",
    intro: "Bienvenue. Une seule action rend HealthWatch vraiment utile dès aujourd'hui : configurer vos régions d'alerte email.",
    actionTitle: "Configurez vos alertes en 30 secondes",
    actionDesc: "Sélectionnez vos régions et vous recevrez un email dès qu'un nouveau foyer épidémique est détecté — avec cas confirmés, décès, niveau de risque IHR et source OMS/ECDC.",
    ctaLabel: "Configurer mes alertes →",
    secondaryLabel: "Ou accédez au tableau de bord →",
    closing: "Bonne surveillance,\nDavid — HealthWatch Global",
    unsubNote: "Vous recevez cet email car vous avez créé un compte sur healthwatch-global.com.",
  },
  en: {
    subject: "One thing to set up now — your outbreak alert regions",
    headline: "Your Pro access is live.",
    intro: "Welcome. One action makes HealthWatch immediately useful: configuring your email alert regions.",
    actionTitle: "Set up your alerts in 30 seconds",
    actionDesc: "Select your regions and you'll receive an email as soon as a new outbreak is detected — with confirmed cases, deaths, IHR risk level and WHO/ECDC source.",
    ctaLabel: "Configure my alerts →",
    secondaryLabel: "Or go to the dashboard →",
    closing: "Stay safe,\nDavid — HealthWatch Global",
    unsubNote: "You're receiving this email because you created an account on healthwatch-global.com.",
  },
  es: {
    subject: "Una acción que hacer ahora — sus regiones de alerta de brotes",
    headline: "Su acceso Pro está activo.",
    intro: "Bienvenido. Una sola acción hace que HealthWatch sea inmediatamente útil: configurar sus regiones de alerta por email.",
    actionTitle: "Configure sus alertas en 30 segundos",
    actionDesc: "Seleccione sus regiones y recibirá un email en cuanto se detecte un nuevo brote — con casos confirmados, fallecidos, nivel de riesgo RSI y fuente OMS/ECDC.",
    ctaLabel: "Configurar mis alertas →",
    secondaryLabel: "O ir al panel →",
    closing: "Cuídese,\nDavid — HealthWatch Global",
    unsubNote: "Recibe este correo porque creó una cuenta en healthwatch-global.com.",
  },
  ar: {
    subject: "إجراء واحد الآن — مناطق تنبيه التفشيات",
    headline: "وصولك Pro نشط.",
    intro: "مرحباً. إجراء واحد يجعل HealthWatch مفيداً فوراً: ضبط مناطق تنبيه البريد الإلكتروني.",
    actionTitle: "اضبط تنبيهاتك في 30 ثانية",
    actionDesc: "اختر مناطقك وستتلقى بريداً إلكترونياً فور اكتشاف تفشٍّ جديد — مع الحالات المؤكدة والوفيات ومستوى خطر اللوائح الصحية الدولية ومصدر منظمة الصحة العالمية/ECDC.",
    ctaLabel: "← ضبط تنبيهاتي",
    secondaryLabel: "← أو الذهاب إلى لوحة التحكم",
    closing: "مع السلامة،\nDavid — HealthWatch Global",
    unsubNote: "تتلقى هذا البريد لأنك أنشأت حساباً على healthwatch-global.com.",
  },
  id: {
    subject: "Satu hal yang harus dilakukan sekarang — wilayah peringatan wabah Anda",
    headline: "Akses Pro Anda aktif.",
    intro: "Selamat datang. Satu tindakan membuat HealthWatch langsung berguna: mengatur wilayah peringatan email Anda.",
    actionTitle: "Atur peringatan Anda dalam 30 detik",
    actionDesc: "Pilih wilayah Anda dan Anda akan menerima email segera setelah wabah baru terdeteksi — dengan kasus terkonfirmasi, kematian, tingkat risiko IHR, dan sumber WHO/ECDC.",
    ctaLabel: "Atur peringatan saya →",
    secondaryLabel: "Atau buka dasbor →",
    closing: "Jaga kesehatan,\nDavid — HealthWatch Global",
    unsubNote: "Anda menerima email ini karena membuat akun di healthwatch-global.com.",
  },
};

// ─── J+3 : Discover your Pro trial features ───────────────────────────────────

const J3_CONTENT: Record<string, {
  subject: string;
  headline: string;
  intro: string;
  featuresTitle: string;
  features: string[];
  tip: string;
  ctaLabel: string;
  closing: string;
  unsubNote: string;
}> = {
  fr: {
    subject: "J+3 de votre essai Pro — avez-vous essayé ces fonctionnalités ?",
    headline: "Vous êtes en essai Pro depuis 3 jours.",
    intro: "Vous avez accès à toutes les fonctionnalités Pro pendant encore 11 jours. Voici celles qui font la différence pour les équipes de veille sanitaire :",
    featuresTitle: "À explorer cette semaine",
    features: [
      "📊 <strong>Chiffres exacts</strong> — cas confirmés et décès par foyer, sans floutage",
      "📄 <strong>Rapports PDF régionaux</strong> — téléchargeables en 1 clic depuis la page d'un foyer",
      "📬 <strong>Alertes email régionales</strong> — configurez votre région dans votre compte",
      "📥 <strong>Export CSV</strong> — bouton « Exporter » en haut du tableau de bord",
      "🔔 <strong>Alertes push en temps réel</strong> — activez-les depuis le tableau de bord",
      "🦠 <strong>Alertes par maladie</strong> — abonnez-vous à Mpox, Ebola ou toute maladie depuis votre compte pour recevoir des alertes où qu'elle survienne",
    ],
    tip: "💡 Conseil : commencez par télécharger un rapport PDF de votre région. C'est la fonctionnalité la plus utilisée par les épidémiologistes.",
    ctaLabel: "Aller au tableau de bord →",
    closing: "Bonne surveillance,\nL'équipe HealthWatch Global",
    unsubNote: "Vous recevez cet email car vous avez créé un compte sur healthwatch-global.com.",
  },
  en: {
    subject: "Day 3 of your Pro trial — have you tried these features?",
    headline: "You've been on your Pro trial for 3 days.",
    intro: "You have access to all Pro features for 11 more days. Here are the ones that make the biggest difference for health surveillance teams:",
    featuresTitle: "Worth exploring this week",
    features: [
      "📊 <strong>Exact figures</strong> — confirmed cases and deaths per outbreak, unblurred",
      "📄 <strong>Regional PDF reports</strong> — downloadable in 1 click from any outbreak page",
      "📬 <strong>Regional email alerts</strong> — configure your region in your account settings",
      "📥 <strong>CSV export</strong> — 'Export' button at the top of the dashboard",
      "🔔 <strong>Real-time push alerts</strong> — enable them from the dashboard",
      "🦠 <strong>Disease-specific alerts</strong> — subscribe to Mpox, Ebola or any disease from your account and get alerted wherever it strikes",
    ],
    tip: "💡 Tip: start by downloading a PDF report for your region. It's the most-used feature among epidemiologists.",
    ctaLabel: "Go to dashboard →",
    closing: "Stay safe,\nThe HealthWatch Global Team",
    unsubNote: "You're receiving this email because you created an account on healthwatch-global.com.",
  },
  es: {
    subject: "Día 3 de su prueba Pro — ¿ha probado estas funciones?",
    headline: "Lleva 3 días en su prueba Pro.",
    intro: "Tiene acceso a todas las funciones Pro durante 11 días más. Estas son las que marcan la diferencia para los equipos de vigilancia sanitaria:",
    featuresTitle: "Vale la pena explorar esta semana",
    features: [
      "📊 <strong>Cifras exactas</strong> — casos confirmados y fallecidos por brote, sin desenfoque",
      "📄 <strong>Informes PDF regionales</strong> — descargables en 1 clic desde cualquier página de brote",
      "📬 <strong>Alertas email regionales</strong> — configure su región en la configuración de su cuenta",
      "📥 <strong>Exportación CSV</strong> — botón 'Exportar' en la parte superior del panel",
      "🔔 <strong>Alertas push en tiempo real</strong> — actívelas desde el panel",
      "🦠 <strong>Alertas por enfermedad</strong> — suscríbase a Mpox, Ébola o cualquier enfermedad desde su cuenta para recibir alertas dondequiera que aparezca",
    ],
    tip: "💡 Consejo: comience descargando un informe PDF de su región. Es la función más utilizada por los epidemiólogos.",
    ctaLabel: "Ir al panel →",
    closing: "Cuídese,\nEl equipo de HealthWatch Global",
    unsubNote: "Recibe este correo porque creó una cuenta en healthwatch-global.com.",
  },
  ar: {
    subject: "اليوم الثالث من تجربتك Pro — هل جربت هذه الميزات؟",
    headline: "لقد مضى 3 أيام على تجربتك Pro.",
    intro: "لديك وصول إلى جميع ميزات Pro لمدة 11 يوماً آخر. إليك الميزات الأكثر أهمية لفرق المراقبة الصحية:",
    featuresTitle: "يستحق الاستكشاف هذا الأسبوع",
    features: [
      "📊 <strong>الأرقام الدقيقة</strong> — الحالات المؤكدة والوفيات لكل تفشٍّ، بدون طمس",
      "📄 <strong>تقارير PDF إقليمية</strong> — قابلة للتنزيل بنقرة واحدة من أي صفحة تفشٍّ",
      "📬 <strong>تنبيهات بريدية إقليمية</strong> — اضبط منطقتك في إعدادات حسابك",
      "📥 <strong>تصدير CSV</strong> — زر 'تصدير' أعلى لوحة التحكم",
      "🔔 <strong>تنبيهات push فورية</strong> — فعّلها من لوحة التحكم",
      "🦠 <strong>تنبيهات خاصة بالأمراض</strong> — اشترك في Mpox أو إيبولا أو أي مرض من حسابك لتلقي تنبيهات أينما ظهر",
    ],
    tip: "💡 نصيحة: ابدأ بتنزيل تقرير PDF لمنطقتك. إنها الميزة الأكثر استخداماً بين علماء الأوبئة.",
    ctaLabel: "← الذهاب إلى لوحة التحكم",
    closing: "مع السلامة،\nفريق HealthWatch Global",
    unsubNote: "تتلقى هذا البريد لأنك أنشأت حساباً على healthwatch-global.com.",
  },
  id: {
    subject: "Hari ke-3 uji coba Pro Anda — sudahkah mencoba fitur ini?",
    headline: "Anda telah 3 hari dalam uji coba Pro.",
    intro: "Anda memiliki akses ke semua fitur Pro selama 11 hari lagi. Inilah fitur yang paling membuat perbedaan bagi tim surveilans kesehatan:",
    featuresTitle: "Layak dijelajahi minggu ini",
    features: [
      "📊 <strong>Angka tepat</strong> — kasus terkonfirmasi dan kematian per wabah, tanpa blur",
      "📄 <strong>Laporan PDF regional</strong> — diunduh dalam 1 klik dari halaman wabah mana pun",
      "📬 <strong>Peringatan email regional</strong> — atur wilayah Anda di pengaturan akun",
      "📥 <strong>Ekspor CSV</strong> — tombol 'Ekspor' di bagian atas dasbor",
      "🔔 <strong>Peringatan push real-time</strong> — aktifkan dari dasbor",
      "🦠 <strong>Peringatan per penyakit</strong> — berlangganan Mpox, Ebola, atau penyakit apa pun dari akun Anda dan dapatkan peringatan di mana pun muncul",
    ],
    tip: "💡 Tips: mulailah dengan mengunduh laporan PDF untuk wilayah Anda. Ini fitur yang paling banyak digunakan ahli epidemiologi.",
    ctaLabel: "Buka dasbor →",
    closing: "Jaga kesehatan,\nTim HealthWatch Global",
    unsubNote: "Anda menerima email ini karena membuat akun di healthwatch-global.com.",
  },
};

// ─── J+7 : Mid-trial check-in — PDF report feature spotlight ─────────────────

const J7_CONTENT: Record<string, {
  subject: string;
  headline: string;
  intro: string;
  featureTitle: string;
  featureDesc: string;
  steps: string[];
  tip: string;
  ctaLabel: string;
  secondaryCta: string;
  closing: string;
  unsubNote: string;
}> = {
  fr: {
    subject: "Mi-essai — avez-vous téléchargé votre premier rapport PDF ?",
    headline: "Vous êtes à mi-chemin de votre essai Pro.",
    intro: "Il vous reste 7 jours d'accès complet. Beaucoup de nos utilisateurs n'activent les fonctionnalités les plus utiles qu'en deuxième semaine — voici la plus impactante :",
    featureTitle: "📄 Les rapports PDF régionaux",
    featureDesc: "Un résumé épidémiologique structuré par région — cas actifs, tendances, niveaux de risque — prêt à partager en réunion ou à joindre à un rapport institutionnel.",
    steps: [
      "Allez dans « Rapports » dans le menu",
      "Sélectionnez votre région",
      "Cliquez sur « Générer le PDF » → téléchargement en 3 secondes",
    ],
    tip: "💡 Ces rapports sont utilisés par les équipes terrain pour leurs briefings hebdomadaires. Essayez d'en générer un pour votre zone géographique.",
    ctaLabel: "Générer mon rapport PDF →",
    secondaryCta: "Ou aller au tableau de bord →",
    closing: "Bonne surveillance,\nL'équipe HealthWatch Global",
    unsubNote: "Vous recevez cet email car vous avez créé un compte sur healthwatch-global.com.",
  },
  en: {
    subject: "Mid-trial check-in — have you downloaded your first PDF report yet?",
    headline: "You're halfway through your Pro trial.",
    intro: "You still have 7 days of full access. Many of our users only activate the most useful features in their second week — here's the most impactful one:",
    featureTitle: "📄 Regional PDF reports",
    featureDesc: "A structured epidemiological summary by region — active outbreaks, trends, risk levels — ready to share in a meeting or attach to an institutional report.",
    steps: [
      "Go to 'Reports' in the menu",
      "Select your region",
      "Click 'Generate PDF' → download in 3 seconds",
    ],
    tip: "💡 These reports are used by field teams for their weekly briefings. Try generating one for your geographic area.",
    ctaLabel: "Generate my PDF report →",
    secondaryCta: "Or go to dashboard →",
    closing: "Stay safe,\nThe HealthWatch Global Team",
    unsubNote: "You're receiving this email because you created an account on healthwatch-global.com.",
  },
  es: {
    subject: "A mitad del ensayo — ¿ha descargado su primer informe PDF?",
    headline: "Está a mitad de su prueba Pro.",
    intro: "Todavía tiene 7 días de acceso completo. Muchos de nuestros usuarios activan las funciones más útiles en la segunda semana — aquí está la más impactante:",
    featureTitle: "📄 Informes PDF regionales",
    featureDesc: "Un resumen epidemiológico estructurado por región — brotes activos, tendencias, niveles de riesgo — listo para compartir en una reunión o adjuntar a un informe institucional.",
    steps: [
      "Vaya a 'Informes' en el menú",
      "Seleccione su región",
      "Haga clic en 'Generar PDF' → descarga en 3 segundos",
    ],
    tip: "💡 Estos informes son utilizados por equipos de campo para sus briefings semanales. Intente generar uno para su área geográfica.",
    ctaLabel: "Generar mi informe PDF →",
    secondaryCta: "O ir al panel →",
    closing: "Cuídese,\nEl equipo de HealthWatch Global",
    unsubNote: "Recibe este correo porque creó una cuenta en healthwatch-global.com.",
  },
  ar: {
    subject: "منتصف التجربة — هل حمّلت تقرير PDF الأول؟",
    headline: "أنت في منتصف تجربتك Pro.",
    intro: "لا يزال لديك 7 أيام من الوصول الكامل. يُفعِّل كثير من مستخدمينا الميزات الأكثر فائدة في الأسبوع الثاني — إليك الأكثر تأثيراً:",
    featureTitle: "📄 تقارير PDF الإقليمية",
    featureDesc: "ملخص وبائي منظَّم حسب المنطقة — التفشيات النشطة والاتجاهات ومستويات المخاطر — جاهز للمشاركة في اجتماع أو إرفاقه بتقرير مؤسسي.",
    steps: [
      "اذهب إلى 'التقارير' في القائمة",
      "اختر منطقتك",
      "انقر على 'إنشاء PDF' ← تحميل خلال 3 ثوانٍ",
    ],
    tip: "💡 تستخدم الفرق الميدانية هذه التقارير في إحاطاتها الأسبوعية. جرّب إنشاء تقرير لمنطقتك الجغرافية.",
    ctaLabel: "← إنشاء تقريري PDF",
    secondaryCta: "← أو الذهاب إلى لوحة التحكم",
    closing: "مع السلامة،\nفريق HealthWatch Global",
    unsubNote: "تتلقى هذا البريد لأنك أنشأت حساباً على healthwatch-global.com.",
  },
  id: {
    subject: "Pertengahan uji coba — sudahkah mengunduh laporan PDF pertama Anda?",
    headline: "Anda berada di pertengahan uji coba Pro.",
    intro: "Anda masih memiliki 7 hari akses penuh. Banyak pengguna kami baru mengaktifkan fitur paling berguna di minggu kedua — inilah yang paling berdampak:",
    featureTitle: "📄 Laporan PDF regional",
    featureDesc: "Ringkasan epidemiologi terstruktur per wilayah — wabah aktif, tren, tingkat risiko — siap dibagikan dalam rapat atau dilampirkan ke laporan institusional.",
    steps: [
      "Buka 'Laporan' di menu",
      "Pilih wilayah Anda",
      "Klik 'Buat PDF' → unduhan dalam 3 detik",
    ],
    tip: "💡 Laporan ini digunakan oleh tim lapangan untuk briefing mingguan mereka. Coba buat satu untuk area geografis Anda.",
    ctaLabel: "Buat laporan PDF saya →",
    secondaryCta: "Atau ke dasbor →",
    closing: "Jaga kesehatan,\nTim HealthWatch Global",
    unsubNote: "Anda menerima email ini karena membuat akun di healthwatch-global.com.",
  },
};

// ─── J+12 : Trial ends in 2 days — subscribe now ─────────────────────────────

const J12_CONTENT: Record<string, {
  subject: string;
  headline: string;
  intro: string;
  loseTitle: string;
  loseItems: string[];
  questionLabel: string;
  question: string;
  ctaLabel: string;
  altText: string;
  altLink: string;
  pilotText: string;
  pilotLink: string;
  closing: string;
  unsubNote: string;
}> = {
  fr: {
    subject: "Votre essai Pro se termine dans 2 jours",
    headline: "Votre essai Pro se termine dans 2 jours.",
    intro: "Vous avez utilisé HealthWatch Pro pendant 12 jours. Dans 48 heures, votre accès sera limité au plan gratuit si vous ne souscrivez pas.",
    loseTitle: "Ce que vous perdez à la fin de l'essai",
    loseItems: [
      "📊 Chiffres exacts — cas confirmés et décès (retour au floutage)",
      "📬 Alertes email régionales — plus de notifications en temps réel",
      "📄 Rapports PDF régionaux — plus d'exports en 1 clic",
      "📥 Export CSV — plus d'accès aux données brutes",
      "🦠 Alertes par maladie — plus d'alertes Mpox/Ebola/Choléra dans le monde",
    ],
    questionLabel: "Notre question :",
    question: "Est-ce que les données que vous avez vues ont déjà orienté une décision de votre équipe ?",
    ctaLabel: "Conserver mon accès Pro →",
    altText: "Des questions sur l'offre ou un tarif ONG ?",
    altLink: "Contactez-nous →",
    pilotText: "Ministère, ONG ou institution ? Pas de procurement nécessaire.",
    pilotLink: "Programme Pilot 35 jours gratuits →",
    closing: "Bonne surveillance,\nL'équipe HealthWatch Global",
    unsubNote: "Vous recevez cet email car vous avez créé un compte sur healthwatch-global.com.",
  },
  en: {
    subject: "Your Pro trial ends in 2 days",
    headline: "Your Pro trial ends in 2 days.",
    intro: "You've used HealthWatch Pro for 12 days. In 48 hours, your access will be limited to the free plan if you don't subscribe.",
    loseTitle: "What you lose at the end of the trial",
    loseItems: [
      "📊 Exact figures — confirmed cases and deaths (back to blurred data)",
      "📬 Regional email alerts — no more real-time notifications",
      "📄 Regional PDF reports — no more 1-click exports",
      "📥 CSV export — no more raw data access",
      "🦠 Disease-specific alerts — no more Mpox/Ebola/Cholera alerts worldwide",
    ],
    questionLabel: "Our question:",
    question: "Has the data you've seen already influenced a decision in your team?",
    ctaLabel: "Keep my Pro access →",
    altText: "Questions about the plans or an NGO rate?",
    altLink: "Contact us →",
    pilotText: "Ministry, NGO, or institution? No procurement process required.",
    pilotLink: "35-day free Pilot programme →",
    closing: "Stay safe,\nThe HealthWatch Global Team",
    unsubNote: "You're receiving this email because you created an account on healthwatch-global.com.",
  },
  es: {
    subject: "Su prueba Pro termina en 2 días",
    headline: "Su prueba Pro termina en 2 días.",
    intro: "Ha utilizado HealthWatch Pro durante 12 días. En 48 horas, su acceso se limitará al plan gratuito si no se suscribe.",
    loseTitle: "Lo que pierde al final de la prueba",
    loseItems: [
      "📊 Cifras exactas — casos confirmados y fallecidos (vuelta a datos borrosos)",
      "📬 Alertas email regionales — sin más notificaciones en tiempo real",
      "📄 Informes PDF regionales — sin más exportaciones en 1 clic",
      "📥 Exportación CSV — sin más acceso a datos brutos",
      "🦠 Alertas por enfermedad — sin más alertas de Mpox/Ébola/Cólera en el mundo",
    ],
    questionLabel: "Nuestra pregunta:",
    question: "¿Los datos que ha visto ya han orientado alguna decisión de su equipo?",
    ctaLabel: "Mantener mi acceso Pro →",
    altText: "¿Preguntas sobre los planes o una tarifa ONG?",
    altLink: "Contáctenos →",
    pilotText: "¿Ministerio, ONG o institución? Sin proceso de compras.",
    pilotLink: "Programa Pilot 35 días gratuitos →",
    closing: "Cuídese,\nEl equipo de HealthWatch Global",
    unsubNote: "Recibe este correo porque creó una cuenta en healthwatch-global.com.",
  },
  ar: {
    subject: "تجربتك Pro تنتهي خلال يومين",
    headline: "تجربتك Pro تنتهي خلال يومين.",
    intro: "لقد استخدمت HealthWatch Pro لمدة 12 يوماً. خلال 48 ساعة، سيُقيَّد وصولك بالخطة المجانية إذا لم تشترك.",
    loseTitle: "ما الذي ستفقده عند انتهاء التجربة",
    loseItems: [
      "📊 الأرقام الدقيقة — الحالات المؤكدة والوفيات (عودة إلى البيانات المطموسة)",
      "📬 التنبيهات البريدية الإقليمية — لن تصلك إشعارات فورية بعد الآن",
      "📄 تقارير PDF الإقليمية — لن تتمكن من التصدير بنقرة واحدة",
      "📥 تصدير CSV — لن تتمكن من الوصول إلى البيانات الخام",
      "🦠 تنبيهات خاصة بالأمراض — لن تصلك تنبيهات Mpox/إيبولا/كوليرا حول العالم",
    ],
    questionLabel: "سؤالنا:",
    question: "هل أثّرت البيانات التي رأيتها بالفعل في قرار ما لفريقك؟",
    ctaLabel: "← الاحتفاظ بوصولي Pro",
    altText: "أسئلة حول الخطط أو سعر المنظمات غير الحكومية؟",
    altLink: "← اتصل بنا",
    pilotText: "وزارة أو منظمة غير حكومية أو مؤسسة؟ لا إجراءات شراء مطلوبة.",
    pilotLink: "← برنامج تجريبي مجاني 35 يوماً",
    closing: "مع السلامة،\nفريق HealthWatch Global",
    unsubNote: "تتلقى هذا البريد لأنك أنشأت حساباً على healthwatch-global.com.",
  },
  id: {
    subject: "Uji coba Pro Anda berakhir dalam 2 hari",
    headline: "Uji coba Pro Anda berakhir dalam 2 hari.",
    intro: "Anda telah menggunakan HealthWatch Pro selama 12 hari. Dalam 48 jam, akses Anda akan dibatasi ke paket gratis jika tidak berlangganan.",
    loseTitle: "Yang Anda kehilangan di akhir uji coba",
    loseItems: [
      "📊 Angka tepat — kasus terkonfirmasi dan kematian (kembali ke data dikaburkan)",
      "📬 Peringatan email regional — tidak ada lagi notifikasi real-time",
      "📄 Laporan PDF regional — tidak ada lagi ekspor 1 klik",
      "📥 Ekspor CSV — tidak ada lagi akses data mentah",
      "🦠 Peringatan per penyakit — tidak ada lagi peringatan Mpox/Ebola/Kolera di seluruh dunia",
    ],
    questionLabel: "Pertanyaan kami:",
    question: "Apakah data yang Anda lihat sudah mempengaruhi keputusan tim Anda?",
    ctaLabel: "Pertahankan akses Pro saya →",
    altText: "Pertanyaan tentang paket atau tarif LSM?",
    altLink: "Hubungi kami →",
    pilotText: "Kementerian, LSM, atau institusi? Tidak perlu proses pengadaan.",
    pilotLink: "Program Pilot 35 hari gratis →",
    closing: "Jaga kesehatan,\nTim HealthWatch Global",
    unsubNote: "Anda menerima email ini karena membuat akun di healthwatch-global.com.",
  },
};

// ─── Trial expired (J+14) ─────────────────────────────────────────────────────

const TRIAL_EXPIRED_CONTENT: Record<string, {
  subject: string;
  headline: string;
  intro: string;
  lostTitle: string;
  lostItems: string[];
  reactivateTitle: string;
  ctaLabel: string;
  altText: string;
  altLink: string;
  pilotText: string;
  pilotLink: string;
  closing: string;
  unsubNote: string;
}> = {
  fr: {
    subject: "Votre essai Pro HealthWatch a expiré — réactivez en 1 clic",
    headline: "Votre essai Pro a pris fin.",
    intro: "Votre accès Pro est maintenant revenu au plan gratuit. Vous n'avez plus accès aux données exactes, alertes et rapports PDF que vous utilisiez.",
    lostTitle: "Ce que vous avez perdu",
    lostItems: [
      "📊 Chiffres exacts de cas et de décès (retour au floutage)",
      "📬 Alertes email régionales en temps réel",
      "📄 Rapports PDF régionaux téléchargeables",
      "📥 Export CSV des données brutes",
      "🦠 Alertes par maladie — Mpox, Ebola, Choléra dans le monde",
    ],
    reactivateTitle: "Réactivez votre accès Pro dès aujourd'hui",
    ctaLabel: `Réactiver mon accès Pro — ${PRICE_DISPLAY.fr.proMonthly}/mois →`,
    altText: "Tarif ONG ou gouvernemental disponible.",
    altLink: "Contactez-nous →",
    pilotText: "Ministère, ONG ou institution ? Pas de procurement nécessaire.",
    pilotLink: "Programme Pilot institutionnel 35 jours →",
    closing: "L'équipe HealthWatch Global",
    unsubNote: "Vous recevez cet email car vous avez créé un compte sur healthwatch-global.com.",
  },
  en: {
    subject: "Your HealthWatch Pro trial has expired — reactivate in 1 click",
    headline: "Your Pro trial has ended.",
    intro: "Your Pro access has reverted to the free plan. You no longer have access to the exact figures, alerts and PDF reports you were using.",
    lostTitle: "What you've lost",
    lostItems: [
      "📊 Exact case and death figures (back to blurred data)",
      "📬 Real-time regional email alerts",
      "📄 Downloadable regional PDF reports",
      "📥 CSV export of raw data",
      "🦠 Disease-specific alerts — Mpox, Ebola, Cholera worldwide",
    ],
    reactivateTitle: "Reactivate your Pro access today",
    ctaLabel: `Reactivate Pro access — ${PRICE_DISPLAY.en_eur.proMonthly}/month →`,
    altText: "NGO or government pricing available.",
    altLink: "Contact us →",
    pilotText: "Ministry, NGO, or institution? No procurement process required.",
    pilotLink: "35-day institutional Pilot programme →",
    closing: "The HealthWatch Global Team",
    unsubNote: "You're receiving this email because you created an account on healthwatch-global.com.",
  },
  es: {
    subject: "Su prueba Pro de HealthWatch ha expirado — reactive en 1 clic",
    headline: "Su prueba Pro ha terminado.",
    intro: "Su acceso Pro ha vuelto al plan gratuito. Ya no tiene acceso a las cifras exactas, alertas e informes PDF que utilizaba.",
    lostTitle: "Lo que ha perdido",
    lostItems: [
      "📊 Cifras exactas de casos y fallecidos (vuelta a datos borrosos)",
      "📬 Alertas email regionales en tiempo real",
      "📄 Informes PDF regionales descargables",
      "📥 Exportación CSV de datos brutos",
      "🦠 Alertas por enfermedad — Mpox, Ébola, Cólera en el mundo",
    ],
    reactivateTitle: "Reactive su acceso Pro hoy",
    ctaLabel: `Reactivar acceso Pro — ${PRICE_DISPLAY.es.proMonthly}/mes →`,
    altText: "Precios para ONG o gobierno disponibles.",
    altLink: "Contáctenos →",
    pilotText: "¿Ministerio, ONG o institución? Sin proceso de compras.",
    pilotLink: "Programa Pilot institucional 35 días →",
    closing: "El equipo de HealthWatch Global",
    unsubNote: "Recibe este correo porque creó una cuenta en healthwatch-global.com.",
  },
  ar: {
    subject: "انتهت تجربتك Pro في HealthWatch — أعد التفعيل بنقرة واحدة",
    headline: "انتهت تجربتك Pro.",
    intro: "عاد وصولك Pro إلى الخطة المجانية. لم تعد تتمكن من الوصول إلى الأرقام الدقيقة والتنبيهات وتقارير PDF التي كنت تستخدمها.",
    lostTitle: "ما الذي فقدته",
    lostItems: [
      "📊 الأرقام الدقيقة للحالات والوفيات (عودة إلى البيانات المطموسة)",
      "📬 تنبيهات البريد الإلكتروني الإقليمية الفورية",
      "📄 تقارير PDF الإقليمية القابلة للتحميل",
      "📥 تصدير CSV للبيانات الخام",
      "🦠 تنبيهات خاصة بالأمراض — Mpox، إيبولا، كوليرا حول العالم",
    ],
    reactivateTitle: "أعد تفعيل وصولك Pro اليوم",
    ctaLabel: `← إعادة تفعيل Pro — ${PRICE_DISPLAY.ar.proMonthly}/شهر`,
    altText: "أسعار خاصة للمنظمات غير الحكومية والحكومات.",
    altLink: "← اتصل بنا",
    pilotText: "وزارة أو منظمة غير حكومية أو مؤسسة؟ لا إجراءات شراء مطلوبة.",
    pilotLink: "← البرنامج التجريبي المؤسسي 35 يوماً",
    closing: "فريق HealthWatch Global",
    unsubNote: "تتلقى هذا البريد لأنك أنشأت حساباً على healthwatch-global.com.",
  },
  id: {
    subject: "Uji coba Pro HealthWatch Anda telah berakhir — aktifkan kembali dalam 1 klik",
    headline: "Uji coba Pro Anda telah berakhir.",
    intro: "Akses Pro Anda telah kembali ke paket gratis. Anda tidak lagi memiliki akses ke angka tepat, peringatan, dan laporan PDF yang Anda gunakan.",
    lostTitle: "Yang telah Anda kehilangan",
    lostItems: [
      "📊 Angka kasus dan kematian yang tepat (kembali ke data dikaburkan)",
      "📬 Peringatan email regional real-time",
      "📄 Laporan PDF regional yang dapat diunduh",
      "📥 Ekspor CSV data mentah",
      "🦠 Peringatan per penyakit — Mpox, Ebola, Kolera di seluruh dunia",
    ],
    reactivateTitle: "Aktifkan kembali akses Pro Anda hari ini",
    ctaLabel: `Aktifkan kembali Pro — ${PRICE_DISPLAY.id.proMonthly}/bulan →`,
    altText: "Harga khusus untuk LSM atau pemerintah tersedia.",
    altLink: "Hubungi kami →",
    pilotText: "Kementerian, LSM, atau institusi? Tidak perlu proses pengadaan.",
    pilotLink: "Program Pilot institusional 35 hari →",
    closing: "Tim HealthWatch Global",
    unsubNote: "Anda menerima email ini karena membuat akun di healthwatch-global.com.",
  },
};

// ─── HTML builders ────────────────────────────────────────────────────────────

function emailShell(locale: string, body: string): string {
  const dir = locale === "ar" ? "rtl" : "ltr";
  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:32px 16px;direction:${dir};">
  <div style="max-width:600px;margin:0 auto;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
    <div style="background:#dc2626;padding:24px 32px;">
      <h1 style="margin:0;font-size:20px;color:white;font-weight:700;">🌍 HealthWatch Global</h1>
    </div>
    ${body}
  </div>
</body>
</html>`;
}

export function buildJ3Email(locale: string, userId: string): { subject: string; html: string; unsubUrl: string } {
  const c = J3_CONTENT[locale] ?? J3_CONTENT.en;
  const dashboardUrl = `https://healthwatch-global.com/${locale}`;
  const unsubUrl = `https://healthwatch-global.com/api/unsubscribe-signal?id=${encodeURIComponent(userId)}&token=${signUnsubscribeToken(userId)}&locale=${locale}`;

  const body = `
    <div style="padding:36px 32px;">
      <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#f1f5f9;">${c.headline}</h2>
      <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 28px;">${c.intro}</p>

      <div style="background:#0f172a;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
        <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#34d399;text-transform:uppercase;letter-spacing:.05em;">${c.featuresTitle}</p>
        ${c.features.map((item) => `
        <div style="margin-bottom:10px;">
          <p style="margin:0;font-size:14px;color:#e2e8f0;line-height:1.6;">${item}</p>
        </div>`).join("")}
      </div>

      <div style="background:#1e3a2f;border:1px solid #16a34a44;border-radius:10px;padding:16px 20px;margin-bottom:28px;">
        <p style="margin:0;font-size:14px;color:#86efac;line-height:1.6;">${c.tip}</p>
      </div>

      <div style="text-align:center;">
        <a href="${dashboardUrl}"
           style="display:inline-block;background:#dc2626;color:white;text-decoration:none;
                  padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;">
          ${c.ctaLabel}
        </a>
      </div>
    </div>
    <div style="padding:20px 32px;border-top:1px solid #334155;">
      <p style="margin:0 0 8px;font-size:13px;color:#e2e8f0;white-space:pre-line;">${c.closing}</p>
      <p style="margin:0;font-size:11px;color:#475569;">${c.unsubNote} <a href="${unsubUrl}" style="color:#475569;text-decoration:underline;">Unsubscribe</a></p>
    </div>`;

  return { subject: c.subject, html: emailShell(locale, body), unsubUrl };
}

export function buildJ7Email(locale: string, userId: string): { subject: string; html: string; unsubUrl: string } {
  const c = J7_CONTENT[locale] ?? J7_CONTENT.en;
  const reportsUrl   = `https://healthwatch-global.com/${locale}/reports`;
  const dashboardUrl = `https://healthwatch-global.com/${locale}`;
  const unsubUrl = `https://healthwatch-global.com/api/unsubscribe-signal?id=${encodeURIComponent(userId)}&token=${signUnsubscribeToken(userId)}&locale=${locale}`;

  const body = `
    <div style="padding:36px 32px;">
      <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#f1f5f9;">${c.headline}</h2>
      <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 28px;">${c.intro}</p>

      <div style="background:#0f172a;border-radius:12px;padding:24px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#f1f5f9;">${c.featureTitle}</p>
        <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.7;">${c.featureDesc}</p>
        <div style="border-left:3px solid #dc2626;padding-left:16px;">
          ${c.steps.map((step, i) => `
          <p style="margin:0 0 8px;font-size:14px;color:#e2e8f0;line-height:1.5;">
            <span style="color:#dc2626;font-weight:700;">${i + 1}.</span> ${step}
          </p>`).join("")}
        </div>
      </div>

      <div style="background:#1e3a2f;border:1px solid #16a34a44;border-radius:10px;padding:16px 20px;margin-bottom:28px;">
        <p style="margin:0;font-size:14px;color:#86efac;line-height:1.6;">${c.tip}</p>
      </div>

      <div style="text-align:center;margin-bottom:12px;">
        <a href="${reportsUrl}"
           style="display:inline-block;background:#dc2626;color:white;text-decoration:none;
                  padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;">
          ${c.ctaLabel}
        </a>
      </div>
      <div style="text-align:center;">
        <a href="${dashboardUrl}"
           style="color:#60a5fa;font-size:13px;font-weight:500;text-decoration:none;">${c.secondaryCta}</a>
      </div>
    </div>
    <div style="padding:20px 32px;border-top:1px solid #334155;">
      <p style="margin:0 0 8px;font-size:13px;color:#e2e8f0;white-space:pre-line;">${c.closing}</p>
      <p style="margin:0;font-size:11px;color:#475569;">${c.unsubNote} <a href="${unsubUrl}" style="color:#475569;text-decoration:underline;">Unsubscribe</a></p>
    </div>`;

  return { subject: c.subject, html: emailShell(locale, body), unsubUrl };
}

export function buildJ12Email(locale: string, userId: string): { subject: string; html: string; unsubUrl: string } {
  const c = J12_CONTENT[locale] ?? J12_CONTENT.en;
  const pricingUrl = `https://healthwatch-global.com/${locale}/pricing`;
  const unsubUrl = `https://healthwatch-global.com/api/unsubscribe-signal?id=${encodeURIComponent(userId)}&token=${signUnsubscribeToken(userId)}&locale=${locale}`;
  const contactUrl = `https://healthwatch-global.com/${locale}/contact`;
  const pilotUrl   = `https://healthwatch-global.com/${locale}/pilot`;

  const body = `
    <div style="padding:36px 32px;">
      <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#f1f5f9;">${c.headline}</h2>
      <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px;">${c.intro}</p>

      <div style="background:#3b1515;border:1px solid #dc262644;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#fca5a5;text-transform:uppercase;letter-spacing:.05em;">${c.loseTitle}</p>
        ${c.loseItems.map((item) => `
        <div style="margin-bottom:8px;">
          <p style="margin:0;font-size:14px;color:#e2e8f0;line-height:1.5;">${item}</p>
        </div>`).join("")}
      </div>

      <div style="background:#1e3a5f;border:1px solid #2563eb44;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#93c5fd;text-transform:uppercase;letter-spacing:.05em;">${c.questionLabel}</p>
        <p style="margin:0;font-size:16px;font-weight:600;color:#f1f5f9;line-height:1.5;font-style:italic;">"${c.question}"</p>
      </div>

      <div style="text-align:center;margin-bottom:16px;">
        <a href="${pricingUrl}"
           style="display:inline-block;background:#dc2626;color:white;text-decoration:none;
                  padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;">
          ${c.ctaLabel}
        </a>
      </div>
      <div style="text-align:center;margin-bottom:16px;">
        <p style="margin:0 4px;font-size:13px;color:#64748b;">${c.altText}</p>
        <a href="${contactUrl}" style="color:#60a5fa;font-size:13px;font-weight:600;text-decoration:none;">${c.altLink}</a>
      </div>
      <div style="background:#1e3a5f;border:1px solid #2563eb44;border-radius:10px;padding:14px 20px;text-align:center;">
        <p style="margin:0 0 6px;font-size:13px;color:#93c5fd;">${c.pilotText}</p>
        <a href="${pilotUrl}" style="color:#60a5fa;font-size:13px;font-weight:700;text-decoration:none;">${c.pilotLink}</a>
      </div>
    </div>
    <div style="padding:20px 32px;border-top:1px solid #334155;">
      <p style="margin:0 0 8px;font-size:13px;color:#e2e8f0;white-space:pre-line;">${c.closing}</p>
      <p style="margin:0;font-size:11px;color:#475569;">${c.unsubNote} <a href="${unsubUrl}" style="color:#475569;text-decoration:underline;">Unsubscribe</a></p>
    </div>`;

  return { subject: c.subject, html: emailShell(locale, body), unsubUrl };
}

// ─── Pilot J+32 : 3 days left → upgrade to Team ──────────────────────────────
// Sent to pilot users (35-day trial) at day 32, before expire-trials kicks in.
// By day 32, regular 14-day pro users are already on free — plan=pro here = pilot.

const PILOT_CONVERSION_CONTENT: Record<string, {
  banner: string;
  subject: string;
  headline: string;
  intro: string;
  loseTitle: string;
  loseItems: string[];
  ctaLabel: string;
  altText: string;
  altLink: string;
  invoiceText: string;
  invoiceLink: string;
  closing: string;
  unsubNote: string;
}> = {
  fr: {
    banner: "⏳ Programme Pilot — 3 jours restants",
    subject: "Votre accès Pilot expire dans 3 jours — passez à l'offre Team",
    headline: "Votre programme Pilot touche à sa fin.",
    intro: "Vous avez bénéficié d'un accès complet pendant 32 jours. Dans 72 heures, votre compte sera limité au plan gratuit si vous ne souscrivez pas. Répondez à cet email pour continuer — on cale un tarif Team adapté (à partir de 149€/mois pour 5 sièges).",
    loseTitle: "Ce que votre équipe perd à l'expiration",
    loseItems: [
      "📊 Chiffres exacts — cas confirmés et décès (retour au floutage)",
      "📬 Alertes email et push en temps réel",
      "📄 Rapports PDF régionaux exportables",
      "📥 Export CSV des données brutes",
      "🔗 Intégrations Slack et Teams",
      "🪝 Webhooks et API outbreaks",
    ],
    ctaLabel: `Répondre pour continuer →`,
    altText: "Tarif institutionnel, ONG ou gouvernemental disponible.",
    altLink: "Contactez-nous pour un devis →",
    invoiceText: "Pas de procurement requis — facturation sur devis disponible.",
    invoiceLink: "Demander une facture proforma →",
    closing: "L'équipe HealthWatch Global",
    unsubNote: "Vous recevez cet email car vous avez créé un compte sur healthwatch-global.com.",
  },
  en: {
    banner: "⏳ Pilot Programme — 3 days remaining",
    subject: "Your Pilot access expires in 3 days — continue with Team",
    headline: "Your Pilot programme is ending.",
    intro: "You've had full access for 32 days. In 72 hours, your account will be limited to the free plan unless you subscribe. Reply to this email to continue — we'll set up a Team plan that fits (from €149/month for 5 seats).",
    loseTitle: "What your team loses at expiry",
    loseItems: [
      "📊 Exact figures — confirmed cases and deaths (back to blurred data)",
      "📬 Real-time email and push alerts",
      "📄 Exportable regional PDF reports",
      "📥 CSV export of raw data",
      "🔗 Slack and Teams integrations",
      "🪝 Webhooks and outbreak API",
    ],
    ctaLabel: `Reply to continue →`,
    altText: "Institutional, NGO or government pricing available.",
    altLink: "Contact us for a quote →",
    invoiceText: "No procurement process required — invoice-based billing available.",
    invoiceLink: "Request a pro-forma invoice →",
    closing: "The HealthWatch Global Team",
    unsubNote: "You're receiving this email because you created an account on healthwatch-global.com.",
  },
  es: {
    banner: "⏳ Programa Pilot — 3 días restantes",
    subject: "Su acceso Pilot expira en 3 días — continúe con Team",
    headline: "Su programa Pilot está llegando a su fin.",
    intro: "Ha tenido acceso completo durante 32 días. En 72 horas, su cuenta se limitará al plan gratuito si no se suscribe. Responda a este email para continuar — buscamos juntos un plan Team adaptado (desde 149€/mes para 5 puestos).",
    loseTitle: "Lo que su equipo pierde al vencer",
    loseItems: [
      "📊 Cifras exactas — casos confirmados y fallecidos (vuelta a datos borrosos)",
      "📬 Alertas email y push en tiempo real",
      "📄 Informes PDF regionales exportables",
      "📥 Exportación CSV de datos brutos",
      "🔗 Integraciones Slack y Teams",
      "🪝 Webhooks y API de brotes",
    ],
    ctaLabel: `Responder para continuar →`,
    altText: "Precios institucionales, ONG o gubernamentales disponibles.",
    altLink: "Contáctenos para un presupuesto →",
    invoiceText: "Sin proceso de compras — facturación bajo demanda disponible.",
    invoiceLink: "Solicitar factura pro forma →",
    closing: "El equipo de HealthWatch Global",
    unsubNote: "Recibe este correo porque creó una cuenta en healthwatch-global.com.",
  },
  ar: {
    banner: "⏳ البرنامج التجريبي — 3 أيام متبقية",
    subject: "وصولك التجريبي ينتهي خلال 3 أيام — استمر مع خطة Team",
    headline: "يقترب برنامجك التجريبي من نهايته.",
    intro: "تمتّعت بوصول كامل لمدة 32 يوماً. خلال 72 ساعة، سيُقيَّد حسابك بالخطة المجانية إذا لم تشترك. ردّ على هذا البريد للاستمرار — سنحدد معاً خطة Team مناسبة (ابتداءً من 149€/شهر لـ 5 مقاعد).",
    loseTitle: "ما الذي سيفقده فريقك عند الانتهاء",
    loseItems: [
      "📊 الأرقام الدقيقة للحالات والوفيات (عودة إلى البيانات المطموسة)",
      "📬 تنبيهات البريد والدفع الفوري",
      "📄 تقارير PDF الإقليمية القابلة للتصدير",
      "📥 تصدير CSV للبيانات الخام",
      "🔗 تكاملات Slack وTeams",
      "🪝 Webhooks وواجهة برمجة التفشيات",
    ],
    ctaLabel: `← الرد للاستمرار`,
    altText: "أسعار مؤسسية ومنظمات غير حكومية وحكومية متاحة.",
    altLink: "← اتصل بنا للحصول على عرض",
    invoiceText: "لا إجراءات شراء مطلوبة — الفوترة بالفاتورة متاحة.",
    invoiceLink: "← طلب فاتورة أولية",
    closing: "فريق HealthWatch Global",
    unsubNote: "تتلقى هذا البريد لأنك أنشأت حساباً على healthwatch-global.com.",
  },
  id: {
    banner: "⏳ Program Pilot — 3 hari tersisa",
    subject: "Akses Pilot Anda berakhir dalam 3 hari — lanjutkan dengan Team",
    headline: "Program Pilot Anda hampir berakhir.",
    intro: "Anda telah memiliki akses penuh selama 32 hari. Dalam 72 jam, akun Anda akan dibatasi ke paket gratis jika tidak berlangganan. Balas email ini untuk melanjutkan — kami akan menyiapkan paket Team yang sesuai (mulai €149/bulan untuk 5 kursi).",
    loseTitle: "Yang akan hilang dari tim Anda saat berakhir",
    loseItems: [
      "📊 Angka tepat — kasus terkonfirmasi dan kematian (kembali ke data dikaburkan)",
      "📬 Peringatan email dan push real-time",
      "📄 Laporan PDF regional yang dapat diekspor",
      "📥 Ekspor CSV data mentah",
      "🔗 Integrasi Slack dan Teams",
      "🪝 Webhook dan API wabah",
    ],
    ctaLabel: `Balas untuk melanjutkan →`,
    altText: "Harga institusional, LSM, atau pemerintah tersedia.",
    altLink: "Hubungi kami untuk penawaran →",
    invoiceText: "Tidak perlu proses pengadaan — penagihan berbasis faktur tersedia.",
    invoiceLink: "Minta faktur pro-forma →",
    closing: "Tim HealthWatch Global",
    unsubNote: "Anda menerima email ini karena membuat akun di healthwatch-global.com.",
  },
};

export function buildPilotConversionEmail(locale: string, userId: string, organization: string | null = null): { subject: string; html: string; unsubUrl: string } {
  const c = PILOT_CONVERSION_CONTENT[locale] ?? PILOT_CONVERSION_CONTENT.en;
  const org = organization || (locale === "fr" ? "votre organisation" : "your organization");
  // Every recipient of this email is, by construction (the J+32 cohort query
  // in app/api/cron/onboarding-sequence/route.ts only matches genuine pilot
  // trials), an actual institutional pilot — so the primary CTA goes straight
  // to a human conversation, not through /pricing. Routing through /pricing
  // would now hit the same is_pilot branch as every other upgrade surface
  // (see PricingCards.tsx) and just redirect them back to this same mailto
  // conversation, one confusing hop later.
  const ctaMailtoHref = "mailto:david.deheunynck@gmail.com?subject=" + encodeURIComponent(
    locale === "fr" ? `Suite du pilote — ${org}` : `Following up on our pilot — ${org}`
  );
  const contactUrl = `https://healthwatch-global.com/${locale}/contact`;
  const unsubUrl   = `https://healthwatch-global.com/api/unsubscribe-signal?id=${encodeURIComponent(userId)}&token=${signUnsubscribeToken(userId)}&locale=${locale}`;

  const body = `
    <div style="padding:36px 32px;">
      <div style="background:#1e3a5f;border:1px solid #2563eb55;border-radius:10px;padding:12px 20px;margin-bottom:24px;text-align:center;">
        <p style="margin:0;font-size:12px;font-weight:700;color:#93c5fd;text-transform:uppercase;letter-spacing:.06em;">${c.banner}</p>
      </div>

      <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#f1f5f9;">${c.headline}</h2>
      <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px;">${c.intro}</p>

      <div style="background:#3b1515;border:1px solid #dc262644;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#fca5a5;text-transform:uppercase;letter-spacing:.05em;">${c.loseTitle}</p>
        ${c.loseItems.map((item) => `
        <div style="margin-bottom:8px;">
          <p style="margin:0;font-size:14px;color:#e2e8f0;line-height:1.5;">${item}</p>
        </div>`).join("")}
      </div>

      <div style="text-align:center;margin-bottom:16px;">
        <a href="${ctaMailtoHref}"
           style="display:inline-block;background:#dc2626;color:white;text-decoration:none;
                  padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;">
          ${c.ctaLabel}
        </a>
      </div>

      <div style="background:#0f172a;border-radius:10px;padding:16px 20px;text-align:center;">
        <p style="margin:0 0 6px;font-size:13px;color:#64748b;">${c.altText}</p>
        <a href="${contactUrl}" style="color:#60a5fa;font-size:13px;font-weight:600;text-decoration:none;display:block;margin-bottom:8px;">${c.altLink}</a>
        <p style="margin:0 0 4px;font-size:12px;color:#475569;">${c.invoiceText}</p>
        <a href="${contactUrl}" style="color:#60a5fa;font-size:12px;text-decoration:none;">${c.invoiceLink}</a>
      </div>
    </div>
    <div style="padding:20px 32px;border-top:1px solid #334155;">
      <p style="margin:0 0 8px;font-size:13px;color:#e2e8f0;">${c.closing}</p>
      <p style="margin:0;font-size:11px;color:#475569;">${c.unsubNote} <a href="${unsubUrl}" style="color:#475569;text-decoration:underline;">Unsubscribe</a></p>
    </div>`;

  return { subject: c.subject, html: emailShell(locale, body), unsubUrl };
}

export function buildTrialExpiredEmail(locale: string, userId: string): { subject: string; html: string; unsubUrl: string } {
  const c = TRIAL_EXPIRED_CONTENT[locale] ?? TRIAL_EXPIRED_CONTENT.en;
  const pricingUrl = `https://healthwatch-global.com/${locale}/pricing`;
  const unsubUrl = `https://healthwatch-global.com/api/unsubscribe-signal?id=${encodeURIComponent(userId)}&token=${signUnsubscribeToken(userId)}&locale=${locale}`;
  const contactUrl = `https://healthwatch-global.com/${locale}/contact`;
  const pilotUrl   = `https://healthwatch-global.com/${locale}/pilot`;

  const body = `
    <div style="padding:36px 32px;">
      <div style="background:#dc2626;border-radius:12px;padding:16px 24px;margin-bottom:24px;text-align:center;">
        <p style="margin:0;font-size:14px;font-weight:700;color:white;text-transform:uppercase;letter-spacing:.05em;">⏰ Trial Expired</p>
      </div>

      <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#f1f5f9;">${c.headline}</h2>
      <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px;">${c.intro}</p>

      <div style="background:#3b1515;border:1px solid #dc262644;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#fca5a5;text-transform:uppercase;letter-spacing:.05em;">${c.lostTitle}</p>
        ${c.lostItems.map((item) => `
        <div style="margin-bottom:8px;">
          <p style="margin:0;font-size:14px;color:#e2e8f0;line-height:1.5;">${item}</p>
        </div>`).join("")}
      </div>

      <p style="margin:0 0 20px;font-size:15px;font-weight:600;color:#f1f5f9;">${c.reactivateTitle}</p>

      <div style="text-align:center;margin-bottom:16px;">
        <a href="${pricingUrl}"
           style="display:inline-block;background:#dc2626;color:white;text-decoration:none;
                  padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;">
          ${c.ctaLabel}
        </a>
      </div>
      <div style="text-align:center;margin-bottom:16px;">
        <p style="margin:0 4px;font-size:13px;color:#64748b;">${c.altText}</p>
        <a href="${contactUrl}" style="color:#60a5fa;font-size:13px;font-weight:600;text-decoration:none;">${c.altLink}</a>
      </div>
      <div style="background:#1e3a5f;border:1px solid #2563eb44;border-radius:10px;padding:14px 20px;text-align:center;">
        <p style="margin:0 0 6px;font-size:13px;color:#93c5fd;">${c.pilotText}</p>
        <a href="${pilotUrl}" style="color:#60a5fa;font-size:13px;font-weight:700;text-decoration:none;">${c.pilotLink}</a>
      </div>
    </div>
    <div style="padding:20px 32px;border-top:1px solid #334155;">
      <p style="margin:0 0 8px;font-size:13px;color:#e2e8f0;">${c.closing}</p>
      <p style="margin:0;font-size:11px;color:#475569;">${c.unsubNote} <a href="${unsubUrl}" style="color:#475569;text-decoration:underline;">Unsubscribe</a></p>
    </div>`;

  return { subject: c.subject, html: emailShell(locale, body), unsubUrl };
}

export function buildJ1Email(locale: string, userId: string): { subject: string; html: string; unsubUrl: string } {
  const c = J1_CONTENT[locale] ?? J1_CONTENT.en;
  const alertsUrl = `https://healthwatch-global.com/${locale}/account#regional-alerts`;
  const dashUrl   = `https://healthwatch-global.com/${locale}`;
  const unsubUrl  = `https://healthwatch-global.com/api/unsubscribe-signal?id=${encodeURIComponent(userId)}&token=${signUnsubscribeToken(userId)}&locale=${locale}`;

  const body = `
    <div style="padding:36px 32px;">
      <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#f1f5f9;">${c.headline}</h2>
      <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 28px;">${c.intro}</p>

      <div style="background:#1e3a2f;border:1px solid #16a34a44;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
        <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#34d399;">${c.actionTitle}</p>
        <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.7;">${c.actionDesc}</p>
        <a href="${alertsUrl}"
           style="display:inline-block;background:#16a34a;color:white;text-decoration:none;
                  padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;">
          ${c.ctaLabel}
        </a>
      </div>

      <div style="text-align:center;">
        <a href="${dashUrl}"
           style="color:#60a5fa;font-size:13px;font-weight:500;text-decoration:none;">${c.secondaryLabel}</a>
      </div>
    </div>
    <div style="padding:20px 32px;border-top:1px solid #334155;">
      <p style="margin:0 0 8px;font-size:13px;color:#e2e8f0;white-space:pre-line;">${c.closing}</p>
      <p style="margin:0;font-size:11px;color:#475569;">${c.unsubNote} <a href="${unsubUrl}" style="color:#475569;text-decoration:underline;">Unsubscribe</a></p>
    </div>`;

  return { subject: c.subject, html: emailShell(locale, body), unsubUrl };
}
