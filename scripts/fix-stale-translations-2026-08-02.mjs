// Fix 2026-08-02 — descriptions traduites désynchronisées de la description EN.
//
// Trouvé par le scan du run matinal : 11 lignes actives dont les 4 colonnes
// description_{fr,es,ar,id} portaient encore le texte d'une version antérieure
// de la ligne (parfois des chiffres 2025), alors que `description` (EN) avait
// été rafraîchie par une session manuelle. Origine : les crons appellent
// translateDescription() à l'insertion, mais les scripts de correction manuelle
// (audit cluster choléra 17/07, refresh dengue 25/07, Somalie 27/07) écrivaient
// `description` seule. Les colonnes traduites n'étaient donc jamais nulles —
// invisibles au check "traductions partielles" qui ne cherche que des NULL.
//
// Traductions rédigées à la main (MyMemory anonyme = 1 000 mots/jour, insuffisant
// pour 44 textes, et rend des artefacts type "L'OMS A signalé" / "2026 -06 -21").
//
// Chikungunya/Cuba porte en plus un rafraîchissement d'édition : chiffres
// identiques (+0 vérifié dans le PDF NY DOH du 30/07), seule la citation
// d'édition passe du 27/05 au 30/07 pour s'aligner sur les 7 autres lignes du
// cluster mises à jour le 01/08.
import { readFileSync } from "fs";

const env = readFileSync(".env.local.live", "utf-8");
function getEnv(key) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return "";
  return m[1].replace(/^﻿/, "").replace(/[\r\n]+$/, "").trim().replace(/^"(.*)"$/, "$1");
}
const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL.includes("tqznwmpkokdzrszysbcm")) throw new Error("Pas la prod — arrêt.");

const CHOLERA_38_EN = "WHO Multi-country Cholera Epidemiological Update #38 (30 June 2026): ";
const CHOLERA_38_FR = "Point épidémiologique de l'OMS sur l'épidémie multi-pays de choléra n° 38 (30 juin 2026) : ";
const CHOLERA_38_ES = "Actualización epidemiológica de la OMS sobre el brote multipaís de cólera n.º 38 (30 de junio de 2026): ";
const CHOLERA_38_AR = "التحديث الوبائي لمنظمة الصحة العالمية بشأن تفشي الكوليرا متعدد البلدان رقم 38 (30 يونيو 2026): ";
const CHOLERA_38_ID = "Pembaruan epidemiologis WHO tentang wabah kolera multinegara #38 (30 Juni 2026): ";

const FIXES = [
  {
    id: "25c51a93-d607-441b-9a1a-ba4e5e4bd7d1",
    label: "Chikungunya / Cuba",
    patch: {
      date: "2026-07-30",
      source: "https://globalhealthreports.health.ny.gov/sites/default/files/2026-07/Global%20Health%20Update%207.30.26%20-%20Final.pdf",
      description:
        "PAHO data via NY State DOH Global Health Update (30 July 2026): Cuba has reported 1,457 chikungunya cases (114 lab-confirmed) and 2 deaths in 2026, unchanged since the previous update — the outbreak began in July 2025 after 9 years without local circulation.",
      description_fr:
        "Données de l'OPS via NY State DOH Global Health Update (30 juillet 2026) : Cuba a signalé 1 457 cas de chikungunya (114 confirmés en laboratoire) et 2 décès en 2026, chiffres inchangés depuis la mise à jour précédente. L'épidémie a débuté en juillet 2025, après 9 ans sans circulation locale.",
      description_es:
        "Datos de la OPS a través de NY State DOH Global Health Update (30 de julio de 2026): Cuba ha reportado 1.457 casos de chikungunya (114 confirmados por laboratorio) y 2 muertes en 2026, sin cambios desde la actualización anterior. El brote comenzó en julio de 2025, tras 9 años sin circulación local.",
      description_ar:
        "بيانات منظمة الصحة للبلدان الأمريكية عبر تحديث الصحة العالمية لدائرة الصحة في ولاية نيويورك (30 يوليو 2026): أبلغت كوبا عن 1,457 حالة شيكونغونيا (114 حالة مؤكدة مختبريًا) وحالتي وفاة في عام 2026، دون تغيير منذ التحديث السابق. وقد بدأ التفشي في يوليو 2025 بعد 9 سنوات دون انتقال محلي.",
      description_id:
        "Data PAHO melalui NY State DOH Global Health Update (30 Juli 2026): Kuba melaporkan 1.457 kasus chikungunya (114 dikonfirmasi laboratorium) dan 2 kematian pada tahun 2026, tidak berubah sejak pembaruan sebelumnya. Wabah dimulai pada Juli 2025 setelah 9 tahun tanpa transmisi lokal.",
    },
  },
  {
    id: "134cacfb-d073-49a7-b32a-aac7576b6980",
    label: "Choléra / RD Congo",
    patch: {
      description_fr:
        CHOLERA_38_FR +
        "la République démocratique du Congo a signalé 28 567 cas cumulés de choléra et 815 décès (létalité 2,9 %) du 1er janvier au 31 mai 2026, dont 3 651 nouveaux cas et 82 décès pour le seul mois de mai (en baisse de 18 % et 36 % par rapport au mois précédent). 17 des 26 provinces sont touchées, principalement le Nord-Kivu (35 %) et le Sud-Kivu (24 %).",
      description_es:
        CHOLERA_38_ES +
        "la República Democrática del Congo notificó 28.567 casos acumulados de cólera y 815 muertes (letalidad del 2,9 %) del 1 de enero al 31 de mayo de 2026, con 3.651 casos nuevos y 82 muertes solo en mayo (una disminución del 18 % y del 36 % respecto al mes anterior). Hay 17 de las 26 provincias afectadas, sobre todo Kivu del Norte (35 %) y Kivu del Sur (24 %).",
      description_ar:
        CHOLERA_38_AR +
        "أبلغت جمهورية الكونغو الديمقراطية عن 28,567 حالة كوليرا تراكمية و815 وفاة (معدل إماتة 2.9%) في الفترة من 1 يناير إلى 31 مايو 2026، منها 3,651 حالة جديدة و82 وفاة في مايو وحده (انخفاض بنسبة 18% و36% مقارنة بالشهر السابق). وتأثرت 17 مقاطعة من أصل 26، وتتركز الحالات في شمال كيفو (35%) وجنوب كيفو (24%).",
      description_id:
        CHOLERA_38_ID +
        "Republik Demokratik Kongo melaporkan 28.567 kasus kolera kumulatif dan 815 kematian (CFR 2,9%) dari 1 Januari hingga 31 Mei 2026, dengan 3.651 kasus baru dan 82 kematian pada Mei saja (turun 18% dan 36% dibandingkan bulan sebelumnya). Sebanyak 17 dari 26 provinsi terdampak, terutama Kivu Utara (35%) dan Kivu Selatan (24%).",
    },
  },
  {
    id: "5930e417-2cc5-4e45-8ac3-980acaa81110",
    label: "Choléra / Congo",
    patch: {
      description_fr:
        CHOLERA_38_FR +
        "la République du Congo a signalé 651 cas cumulés de choléra et 34 décès (létalité 5,2 %) du 1er janvier au 31 mai 2026, dont 266 nouveaux cas et 13 décès au cours des 28 derniers jours de la période de notification.",
      description_es:
        CHOLERA_38_ES +
        "la República del Congo notificó 651 casos acumulados de cólera y 34 muertes (letalidad del 5,2 %) del 1 de enero al 31 de mayo de 2026, con 266 casos nuevos y 13 muertes en los últimos 28 días del período de notificación.",
      description_ar:
        CHOLERA_38_AR +
        "أبلغت جمهورية الكونغو عن 651 حالة كوليرا تراكمية و34 وفاة (معدل إماتة 5.2%) في الفترة من 1 يناير إلى 31 مايو 2026، منها 266 حالة جديدة و13 وفاة خلال آخر 28 يومًا من فترة الإبلاغ.",
      description_id:
        CHOLERA_38_ID +
        "Republik Kongo melaporkan 651 kasus kolera kumulatif dan 34 kematian (CFR 5,2%) dari 1 Januari hingga 31 Mei 2026, dengan 266 kasus baru dan 13 kematian dalam 28 hari terakhir periode pelaporan.",
    },
  },
  {
    id: "974156ff-d9a9-4b06-b7f1-2b3d60d52992",
    label: "Choléra / Soudan du Sud",
    patch: {
      description_fr:
        CHOLERA_38_FR +
        "le Soudan du Sud a signalé 7 712 cas cumulés de choléra et 84 décès (létalité 1,1 %) du 1er janvier au 31 mai 2026, dont 1 579 nouveaux cas et 14 décès pour le seul mois de mai, soit une hausse de 15 % et 75 % respectivement. Les États les plus touchés sont l'Unité (81 %), le Jonglei (11 %) et le Haut-Nil (5 %), sur fond de déplacements de population et de conflit.",
      description_es:
        CHOLERA_38_ES +
        "Sudán del Sur notificó 7.712 casos acumulados de cólera y 84 muertes (letalidad del 1,1 %) del 1 de enero al 31 de mayo de 2026, con 1.579 casos nuevos y 14 muertes solo en mayo, un aumento del 15 % y del 75 % respectivamente. Los estados más afectados son Unidad (81 %), Jonglei (11 %) y Alto Nilo (5 %), en un contexto de desplazamiento de población y conflicto.",
      description_ar:
        CHOLERA_38_AR +
        "أبلغ جنوب السودان عن 7,712 حالة كوليرا تراكمية و84 وفاة (معدل إماتة 1.1%) في الفترة من 1 يناير إلى 31 مايو 2026، منها 1,579 حالة جديدة و14 وفاة في مايو وحده، بزيادة قدرها 15% و75% على التوالي. وسُجلت أعلى الأعداد في ولايات الوحدة (81%) وجونقلي (11%) وأعالي النيل (5%)، في ظل نزوح السكان والنزاع.",
      description_id:
        CHOLERA_38_ID +
        "Sudan Selatan melaporkan 7.712 kasus kolera kumulatif dan 84 kematian (CFR 1,1%) dari 1 Januari hingga 31 Mei 2026, dengan 1.579 kasus baru dan 14 kematian pada Mei saja — masing-masing naik 15% dan 75%. Kasus terbanyak berada di negara bagian Unity (81%), Jonglei (11%), dan Upper Nile (5%), dipicu oleh pengungsian penduduk dan konflik.",
    },
  },
  {
    id: "527d4257-c321-4f09-8c08-97f42bc9a2e0",
    label: "Choléra / Soudan",
    patch: {
      description_fr:
        CHOLERA_38_FR +
        "le Soudan a signalé 527 cas cumulés de choléra et 61 décès (létalité 11,6 %, le taux de létalité le plus élevé de tous les pays de cette mise à jour) du 1er janvier au 31 mai 2026.",
      description_es:
        CHOLERA_38_ES +
        "Sudán notificó 527 casos acumulados de cólera y 61 muertes (letalidad del 11,6 %, la más alta de todos los países de esta actualización) del 1 de enero al 31 de mayo de 2026.",
      description_ar:
        CHOLERA_38_AR +
        "أبلغ السودان عن 527 حالة كوليرا تراكمية و61 وفاة (معدل إماتة 11.6%، وهو الأعلى بين جميع البلدان في هذا التحديث) في الفترة من 1 يناير إلى 31 مايو 2026.",
      description_id:
        CHOLERA_38_ID +
        "Sudan melaporkan 527 kasus kolera kumulatif dan 61 kematian (CFR 11,6%, tertinggi di antara seluruh negara dalam pembaruan ini) dari 1 Januari hingga 31 Mei 2026.",
    },
  },
  {
    id: "6296cad0-8fdb-4b26-a670-c23c541e2c43",
    label: "Choléra / Somalie",
    patch: {
      description_fr:
        CHOLERA_38_FR +
        "la Somalie a signalé 233 cas cumulés de choléra et aucun décès (létalité 0,0 %) du 1er janvier au 31 mai 2026, sans nouveau cas au cours des 28 derniers jours de la période de notification. Remarque : le tableau de bord ArcGIS en temps réel de l'OMS n'intègre plus aucune mise à jour somalienne depuis la mi-janvier 2026 et sous-estime ce chiffre — cette ligne s'appuie donc sur le point épidémiologique mensuel.",
      description_es:
        CHOLERA_38_ES +
        "Somalia notificó 233 casos acumulados de cólera y ninguna muerte (letalidad del 0,0 %) del 1 de enero al 31 de mayo de 2026, sin casos nuevos en los últimos 28 días del período de notificación. Nota: el panel ArcGIS en vivo de la OMS no refleja actualizaciones de Somalia desde mediados de enero de 2026 y subestima esta cifra, por lo que esta línea se basa en la actualización epidemiológica mensual.",
      description_ar:
        CHOLERA_38_AR +
        "أبلغت الصومال عن 233 حالة كوليرا تراكمية ولا وفيات (معدل إماتة 0.0%) في الفترة من 1 يناير إلى 31 مايو 2026، دون حالات جديدة خلال آخر 28 يومًا من فترة الإبلاغ. ملاحظة: لوحة معلومات ArcGIS المباشرة لمنظمة الصحة العالمية لم تُحدَّث بشأن الصومال منذ منتصف يناير 2026 وتقلّل من هذا الرقم، لذا تعتمد هذه البيانات على التحديث الوبائي الشهري.",
      description_id:
        CHOLERA_38_ID +
        "Somalia melaporkan 233 kasus kolera kumulatif dan 0 kematian (CFR 0,0%) dari 1 Januari hingga 31 Mei 2026, tanpa kasus baru dalam 28 hari terakhir periode pelaporan. Catatan: dasbor ArcGIS langsung WHO tidak memuat pembaruan Somalia sejak pertengahan Januari 2026 dan menyajikan angka yang terlalu rendah — baris ini bersumber dari pembaruan epidemiologis bulanan.",
    },
  },
  {
    id: "9c7cf0b2-786e-4117-aa4c-55454e01b616",
    label: "MERS-CoV / Arabie saoudite",
    patch: {
      description_fr:
        "MERS-CoV en Arabie saoudite : 2 cas confirmés en laboratoire, dont 1 décès, signalés depuis le début de 2026 (au 2 juillet 2026). Ce bilan fait suite aux 17 cas signalés par le pays sur l'ensemble de 2025 et s'inscrit dans une tendance de fond à la baisse — le nombre de nouveaux cas de MERS-CoV détectés par la surveillance est au plus bas depuis 2014. Le virus reste endémique chez les dromadaires du pays, principale source de transmission zoonotique.",
      description_es:
        "MERS-CoV en Arabia Saudita: 2 casos confirmados por laboratorio, incluida 1 muerte, notificados desde principios de 2026 (al 2 de julio de 2026). Esta cifra sigue a los 17 casos notificados por el país en todo 2025 y se inscribe en una tendencia decreciente de fondo: el número de casos nuevos de MERS-CoV detectados por la vigilancia está en su nivel más bajo desde 2014. El virus sigue siendo endémico en la población de dromedarios del país, principal fuente de transmisión zoonótica.",
      description_ar:
        "فيروس كورونا المسبب لمتلازمة الشرق الأوسط التنفسية (MERS-CoV) في المملكة العربية السعودية: حالتان مؤكدتان مختبريًا، إحداهما وفاة، أُبلغ عنهما منذ بداية عام 2026 (حتى 2 يوليو 2026). ويأتي ذلك بعد 17 حالة أبلغت عنها المملكة خلال عام 2025 بأكمله، ضمن اتجاه تنازلي طويل الأمد — إذ بلغ عدد الحالات الجديدة المكتشفة عبر الترصد أدنى مستوى له منذ عام 2014. ولا يزال الفيروس مستوطنًا بين الإبل في البلاد، وهي المصدر الرئيسي للانتقال الحيواني المنشأ.",
      description_id:
        "MERS-CoV di Arab Saudi: 2 kasus terkonfirmasi laboratorium, termasuk 1 kematian, dilaporkan sejak awal 2026 (per 2 Juli 2026). Angka ini menyusul 17 kasus yang dilaporkan Arab Saudi sepanjang 2025 dan merupakan bagian dari tren penurunan jangka panjang — jumlah kasus MERS-CoV baru yang terdeteksi melalui surveilans berada pada level terendah sejak 2014. Virus ini tetap endemik pada populasi unta dromedaris di negara tersebut, sumber utama penularan zoonosis.",
    },
  },
  {
    id: "b7813f6c-d98f-43d1-aff9-7b385ee44384",
    label: "Dengue / Pérou",
    patch: {
      description_fr:
        "Dengue au Pérou — le ministère de la Santé (CDC Perú) a signalé 34 820 cas cumulés et 36 décès en 2026 jusqu'à la semaine épidémiologique 26 (close le 28 juin 2026), soit une hausse de 22 % des cas par rapport à la même période de 2025. Piura et San Martín représentent 32 % du total national.",
      description_es:
        "Dengue en Perú — el Ministerio de Salud (CDC Perú) notificó 34.820 casos acumulados y 36 muertes en 2026 hasta la semana epidemiológica 26 (finalizada el 28 de junio de 2026), un aumento del 22 % en los casos respecto al mismo período de 2025. Piura y San Martín concentran el 32 % del total nacional.",
      description_ar:
        "حمى الضنك في بيرو — أبلغت وزارة الصحة (CDC Perú) عن 34,820 حالة تراكمية و36 وفاة في عام 2026 حتى الأسبوع الوبائي 26 (المنتهي في 28 يونيو 2026)، بزيادة قدرها 22% في الحالات مقارنة بالفترة نفسها من عام 2025. وتمثل بيورا وسان مارتين 32% من الإجمالي الوطني.",
      description_id:
        "Demam berdarah di Peru — Kementerian Kesehatan (CDC Perú) melaporkan 34.820 kasus kumulatif dan 36 kematian pada 2026 hingga minggu epidemiologi ke-26 (berakhir 28 Juni 2026), naik 22% dibandingkan periode yang sama pada 2025. Piura dan San Martín menyumbang 32% dari total nasional.",
    },
  },
  {
    id: "4159390e-5e96-4217-a7cd-32eebbd149d9",
    label: "Dengue / Malaisie",
    patch: {
      description_fr:
        "Dengue en Malaisie — le ministère de la Santé a signalé 45 101 cas cumulés et 34 décès en 2026 au 14 juillet 2026, soit une hausse de 34,8 % des cas et de 78,9 % des décès sur un an. Selangor, Kuala Lumpur/Putrajaya et Johor sont les zones les plus touchées et concentrent 63,5 % des cas.",
      description_es:
        "Dengue en Malasia — el Ministerio de Salud notificó 45.101 casos acumulados y 34 muertes en 2026 hasta el 14 de julio de 2026, un aumento interanual del 34,8 % en los casos y del 78,9 % en las muertes. Selangor, Kuala Lumpur/Putrajaya y Johor son las zonas más afectadas y concentran el 63,5 % de los casos.",
      description_ar:
        "حمى الضنك في ماليزيا — أبلغت وزارة الصحة عن 45,101 حالة تراكمية و34 وفاة في عام 2026 حتى 14 يوليو 2026، بزيادة سنوية قدرها 34.8% في الحالات و78.9% في الوفيات. وتُعد سيلانغور وكوالالمبور/بوتراجايا وجوهور الأكثر تضررًا، إذ تستأثر بنسبة 63.5% من الحالات.",
      description_id:
        "Demam berdarah di Malaysia — Kementerian Kesehatan melaporkan 45.101 kasus kumulatif dan 34 kematian pada 2026 per 14 Juli 2026, naik 34,8% untuk kasus dan 78,9% untuk kematian dibandingkan tahun sebelumnya. Selangor, Kuala Lumpur/Putrajaya, dan Johor paling terdampak dengan 63,5% dari seluruh kasus.",
    },
  },
  {
    id: "30961b24-f228-4f16-8861-8131cab5aa85",
    label: "Dengue / Nicaragua",
    patch: {
      description_fr:
        "Dengue au Nicaragua — les bulletins hebdomadaires du ministère de la Santé (MINSA) font état de 1 993 cas cumulés au 9 mai 2026, avec un recul des cas les semaines suivantes (66 cas pour la semaine close le 18 juillet 2026). Aucun décès signalé en 2026.",
      description_es:
        "Dengue en Nicaragua — los boletines semanales del Ministerio de Salud (MINSA) registran 1.993 casos acumulados al 9 de mayo de 2026, con un descenso de los casos en las semanas siguientes (66 casos en la semana finalizada el 18 de julio de 2026). No se han notificado muertes en 2026.",
      description_ar:
        "حمى الضنك في نيكاراغوا — تُظهر النشرات الأسبوعية لوزارة الصحة (MINSA) 1,993 حالة تراكمية حتى 9 مايو 2026، مع تراجع الحالات في الأسابيع التالية (66 حالة في الأسبوع المنتهي في 18 يوليو 2026). ولم يُبلَّغ عن أي وفيات في عام 2026.",
      description_id:
        "Demam berdarah di Nikaragua — buletin mingguan Kementerian Kesehatan (MINSA) mencatat 1.993 kasus kumulatif per 9 Mei 2026, dengan penurunan kasus pada minggu-minggu berikutnya (66 kasus pada minggu yang berakhir 18 Juli 2026). Tidak ada kematian yang dilaporkan pada 2026.",
    },
  },
  {
    id: "d5aa229f-0568-45db-b223-747d25014718",
    label: "Dengue / Viêt Nam",
    patch: {
      description_fr:
        "Dengue au Viêt Nam — le Bureau régional OMS du Pacifique occidental a signalé plus de 50 000 cas cumulés et 5 décès de janvier à mai 2026, soit 2,5 fois plus que sur la même période de 2025. La majorité des cas se concentre dans le sud du pays. Source : WHO Dengue Situation Update 748.",
      description_es:
        "Dengue en Vietnam — la Oficina Regional de la OMS para el Pacífico Occidental notificó más de 50.000 casos acumulados y 5 muertes entre enero y mayo de 2026, 2,5 veces más que en el mismo período de 2025. La mayoría de los casos se concentra en la región sur. Fuente: WHO Dengue Situation Update 748.",
      description_ar:
        "حمى الضنك في فيتنام — أبلغ المكتب الإقليمي لمنظمة الصحة العالمية لغرب المحيط الهادئ عن أكثر من 50,000 حالة تراكمية و5 وفيات في الفترة من يناير إلى مايو 2026، أي 2.5 ضعف الفترة نفسها من عام 2025. وتتركز معظم الحالات في المنطقة الجنوبية. المصدر: WHO Dengue Situation Update 748.",
      description_id:
        "Demam berdarah di Vietnam — Kantor Regional WHO Pasifik Barat melaporkan lebih dari 50.000 kasus kumulatif dan 5 kematian dari Januari hingga Mei 2026, 2,5 kali lipat dibandingkan periode yang sama pada 2025. Sebagian besar kasus berada di wilayah selatan. Sumber: WHO Dengue Situation Update 748.",
    },
  },
];

const DRY = process.argv.includes("--dry");

for (const f of FIXES) {
  if (DRY) {
    console.log(`[dry] ${f.label} — champs: ${Object.keys(f.patch).join(", ")}`);
    continue;
  }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks?id=eq.${f.id}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(f.patch),
  });
  const body = await r.json();
  if (!r.ok || !Array.isArray(body) || body.length !== 1) {
    console.log(`ÉCHEC ${f.label}: ${r.status} ${JSON.stringify(body).slice(0, 300)}`);
    continue;
  }
  const x = body[0];
  const ok = ["description_fr", "description_es", "description_ar", "description_id"].every((k) => x[k]);
  console.log(`OK ${f.label} — 4 traductions ${ok ? "non nulles" : "!! UNE OU PLUSIEURS NULLES"} | date=${x.date} | updated_at=${x.updated_at}`);
}
