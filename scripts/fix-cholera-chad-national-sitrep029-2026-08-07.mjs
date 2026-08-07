// Routine matinale du 2026-08-07 — Choléra / Tchad (06541c4a).
//
// Un TOTAL NATIONAL CONSOLIDÉ OFFICIEL est enfin paru : rapport de situation n°029 du
// ministère de la Santé publique et de la Prévention, couvrant la période du 02 au 03 août 2026.
//   → 239 cas cumulés, 13 décès (dont 5 communautaires, 38,5 %), létalité 5,4 %, 212 guéris.
//   → Ventilation : Hadjer-Lamis / district de Karal 168 cas (épicentre) ; N'Djamena ~71 cas, 8 décès.
//   → Âge médian 10 ans ; ~78 % des patients arrivent déshydratés (modéré/sévère).
//
// Deux sources indépendantes le même jour (06/08) :
//   - tchadinfos.com (Chadien, cite directement le rapport ministériel) — lu via le Browser pane (403 WebFetch).
//   - wakatsera.com (Burkinabè) — donne en plus le n° de SITREP (029) et la ventilation Karal 168 / N'Djamena 72.
//
// Décision : on applique la règle de la routine (§4 bis) « si un total national consolidé officiel
// paraît un jour, le préférer à la somme maison ». La somme maison 167+75 = 242 sur-comptait
// légèrement (l'officiel donne 168 pour Karal et ~71 pour N'Djamena au 03/08). 242 → 239.
// Décès inchangés (13). Guérisons 59 (N'Djamena seul) → 212 (national, même rapport).
// Date d'arrêté 2026-08-04 → 2026-08-03 (arrêté du SITREP n°029).
//
// Effet de bord réglé au passage : la source précédente était en http:// (french.china.org.cn,
// https en échec TLS), ce qui faisait retomber la ligne en `unverified` côté affichage
// (`sourceStatus()` dans lib/outbreaks.ts exige https://). La nouvelle source est en https.
//
// Signal plus récent conservé en description, PAS dans `cases` : le 06/08, le ministre de la Santé
// publique a annoncé 81 cas / 8 décès pour la seule N'Djamena (réunion avec les maires de la ville),
// postérieur à l'arrêté du SITREP. Progression N'Djamena cohérente : 15 (29/07) → 55/6 (30/07)
// → ~71-72 (02-03/08) → 75/8 (04/08, Xinhua) → 81/8 (06/08). Jamais de sous-total N'Djamena dans `cases`.
//
// Pas de source plus autoritaire disponible : série SITREP choléra AFRO/Tchad toujours arrêtée
// à juin 2026 (revérifié ce jour), pas d'operation update DREF IFRC MDRTD026 postérieure au 27/07.

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
console.log("Prod confirmée:", SUPABASE_URL, "\n");

const CHAD_ID = "06541c4a-6b67-4c2c-a44e-818ba7621d76";
const CHAD_SRC =
  "https://tchadinfos.com/2026/08/06/sante-lepidemie-de-cholera-franchit-la-barre-des-239-cas-et-13-deces-au-plan-national/";

const chad = {
  cases: 239,
  deaths: 13,
  recovered: 212,
  date: "2026-08-03",
  source: CHAD_SRC,
  updated_at: new Date().toISOString(),

  description:
    "Cholera in Chad — national consolidated total. Situation report no. 029 from the Ministry of Public Health and Prevention, covering 2-3 August 2026, puts the national count at 239 cumulative cases and 13 deaths, a case fatality ratio of 5.4% — well above the 1% threshold set by WHO — with 5 of the 13 deaths occurring in the community (38.5%). 212 patients, close to nine in ten, have recovered. Two provinces are affected. Hadjer-Lamis, where the Karal health district (168 cumulative cases) remains the epicentre: the outbreak was confirmed there on 13 June 2026 after detection of Vibrio cholerae O1, serotype Ogawa, and a ministerial circular dated 24 July 2026 states that the rapid response halted transmission in that episode. And N'Djamena, a separate episode confirmed on 24 July 2026 after three suspected cases on 19 July in the Farcha neighbourhood (1st arrondissement), now covering nine neighbourhoods of the capital; on 6 August 2026, after the situation report's cut-off, the Minister of Public Health reported 81 cases and 8 deaths for the capital alone. The median age of patients is 10 years, and close to 78% reach health facilities with moderate or severe dehydration, a sign of late presentation.",

  description_fr:
    "Choléra au Tchad — total national consolidé. Le rapport de situation n°029 du ministère de la Santé publique et de la Prévention, couvrant la période du 2 au 3 août 2026, établit le bilan national à 239 cas cumulés et 13 décès, soit un taux de létalité de 5,4 % — largement au-dessus du seuil de 1 % fixé par l'OMS — dont 5 décès survenus en communauté (38,5 %). 212 patients, près de neuf sur dix, ont été guéris. Deux provinces sont touchées. Le Hadjer-Lamis, où le district sanitaire de Karal (168 cas cumulés) reste l'épicentre : l'épidémie y a été confirmée le 13 juin 2026 après détection de Vibrio cholerae O1, sérotype Ogawa, et une circulaire ministérielle du 24 juillet 2026 indique que la riposte rapide a permis d'arrêter la transmission sur cet épisode. Et N'Djamena, épisode distinct confirmé le 24 juillet 2026 après trois cas suspects le 19 juillet dans le quartier de Farcha (1er arrondissement), étendu désormais à neuf quartiers de la capitale ; le 6 août 2026, postérieurement à l'arrêté du rapport, le ministre de la Santé publique a fait état de 81 cas et 8 décès pour la seule capitale. L'âge médian des malades est de 10 ans, et près de 78 % arrivent dans les structures sanitaires avec une déshydratation modérée ou sévère, signe d'une consultation tardive.",

  description_es:
    "Cólera en Chad — total nacional consolidado. El informe de situación n.º 029 del Ministerio de Salud Pública y Prevención, correspondiente al periodo del 2 al 3 de agosto de 2026, sitúa el balance nacional en 239 casos acumulados y 13 fallecidos, una letalidad del 5,4 % — muy por encima del umbral del 1 % fijado por la OMS —, de los cuales 5 fallecimientos se produjeron en la comunidad (38,5 %). 212 pacientes, cerca de nueve de cada diez, se han recuperado. Dos provincias están afectadas. Hadjer-Lamis, donde el distrito sanitario de Karal (168 casos acumulados) sigue siendo el epicentro: el brote se confirmó allí el 13 de junio de 2026 tras la detección de Vibrio cholerae O1, serotipo Ogawa, y una circular ministerial del 24 de julio de 2026 indica que la respuesta rápida logró detener la transmisión en ese episodio. Y Yamena, episodio distinto confirmado el 24 de julio de 2026 tras tres casos sospechosos el 19 de julio en el barrio de Farcha (1.er distrito), extendido ya a nueve barrios de la capital; el 6 de agosto de 2026, con posterioridad a la fecha de corte del informe, el ministro de Salud Pública informó de 81 casos y 8 fallecidos solo en la capital. La edad mediana de los enfermos es de 10 años y cerca del 78 % llega a los centros sanitarios con deshidratación moderada o grave, señal de una consulta tardía.",

  description_ar:
    "الكوليرا في تشاد — الإجمالي الوطني الموحّد. يحدد تقرير الحالة رقم 029 الصادر عن وزارة الصحة العامة والوقاية، والذي يغطي الفترة من 2 إلى 3 أغسطس 2026، الحصيلة الوطنية بـ239 حالة تراكمية و13 وفاة، أي بمعدل إماتة قدره 5.4 بالمئة — وهو أعلى بكثير من عتبة 1 بالمئة التي حددتها منظمة الصحة العالمية — منها 5 وفيات وقعت داخل المجتمع (38.5 بالمئة). وقد تعافى 212 مريضاً، أي نحو تسعة من كل عشرة. وتتأثر مقاطعتان. حجر لاميس، حيث تظل منطقة كارال الصحية (168 حالة تراكمية) بؤرة التفشي: تأكد التفشي هناك في 13 يونيو 2026 بعد الكشف عن ضمة الكوليرا من النمط O1 المصلي Ogawa، ويشير تعميم وزاري مؤرخ في 24 يوليو 2026 إلى أن الاستجابة السريعة أوقفت انتقال المرض في تلك الحلقة. ونجامينا، وهي حلقة منفصلة تأكدت في 24 يوليو 2026 بعد ثلاث حالات مشتبه بها في 19 يوليو في حي فرشا (الدائرة الأولى)، وامتدت الآن إلى تسعة أحياء في العاصمة؛ وفي 6 أغسطس 2026، أي بعد تاريخ إقفال بيانات التقرير، أفاد وزير الصحة العامة بتسجيل 81 حالة و8 وفيات في العاصمة وحدها. ويبلغ متوسط عمر المرضى 10 سنوات، ويصل نحو 78 بالمئة منهم إلى المرافق الصحية وهم مصابون بجفاف متوسط أو شديد، وهو مؤشر على تأخر طلب الرعاية.",

  description_id:
    "Kolera di Chad — total nasional terkonsolidasi. Laporan situasi no. 029 dari Kementerian Kesehatan Masyarakat dan Pencegahan, yang mencakup periode 2-3 Agustus 2026, menetapkan angka nasional sebesar 239 kasus kumulatif dan 13 kematian, dengan tingkat kematian kasus 5,4 persen — jauh di atas ambang 1 persen yang ditetapkan WHO — dengan 5 dari 13 kematian terjadi di komunitas (38,5 persen). Sebanyak 212 pasien, hampir sembilan dari sepuluh, telah sembuh. Dua provinsi terdampak. Hadjer-Lamis, tempat distrik kesehatan Karal (168 kasus kumulatif) tetap menjadi episentrum: wabah dikonfirmasi di sana pada 13 Juni 2026 setelah terdeteksi Vibrio cholerae O1, serotipe Ogawa, dan surat edaran kementerian tertanggal 24 Juli 2026 menyatakan bahwa respons cepat berhasil menghentikan penularan pada episode tersebut. Dan N'Djamena, episode terpisah yang dikonfirmasi pada 24 Juli 2026 setelah tiga kasus suspek pada 19 Juli di lingkungan Farcha (arondisemen ke-1), kini meluas ke sembilan lingkungan di ibu kota; pada 6 Agustus 2026, setelah tanggal batas data laporan tersebut, Menteri Kesehatan Masyarakat melaporkan 81 kasus dan 8 kematian untuk ibu kota saja. Usia median pasien adalah 10 tahun, dan hampir 78 persen tiba di fasilitas kesehatan dengan dehidrasi sedang atau berat, tanda keterlambatan mencari pengobatan.",
};

async function patch(id, label, payload) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`${label}: HTTP ${r.status} — ${await r.text()}`);
  const [row] = await r.json();
  console.log(`OK ${label}`);
  console.log(`   cases=${row.cases} deaths=${row.deaths} recovered=${row.recovered} date=${row.date}`);
  console.log(`   source=${row.source}`);
  console.log(`   active=${row.active} risk=${row.risk_level} prio=${row.source_priority} seed=${row.is_seed}`);
  const missing = ["description", "description_fr", "description_es", "description_ar", "description_id"]
    .filter((k) => !row[k]);
  console.log(missing.length ? `   /!\\ descriptions manquantes: ${missing.join(", ")}` : `   5/5 descriptions écrites`);
  return row;
}

await patch(CHAD_ID, "Choléra / Tchad", chad);
