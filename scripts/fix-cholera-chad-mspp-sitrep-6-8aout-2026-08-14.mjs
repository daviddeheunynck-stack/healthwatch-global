// Choléra / Tchad — run du 2026-08-14
//
// Découverte du jour : un rapport de situation MSPP NATIONAL couvrant les trois
// provinces existe désormais (arrêté 6-8/08/2026, relayé par OCHA, repris par
// Anadolu le 10/08) : 320 cas / 15 décès, létalité 4,7 %, 52 nouveaux cas en 72 h,
// 58 villages et quartiers dans 12 zones de responsabilité sanitaire actives.
// Ventilation : N'Djamena 92/8, Hadjer-Lamis 168/5, Lac 60/2.
//   -> 92+168+60 = 320 et 8+5+2 = 15 : la ventilation somme EXACTEMENT au total
//      national, ce qui prouve que le MSPP compose lui-même son national comme la
//      somme des provinces. Ça valide la méthode composite retenue par David le 09/08.
//
// Deux conséquences :
//  1. Hadjer-Lamis/Karal = 168 cas (pas 167). Le 167 venait de la circulaire du
//     24/07 et du DREF MDRTD026 (arrêté 09/07) ; le SITREP national d'août tranche
//     à 168/5 (létalité 3 %, cohérent : 5/168 = 2,98 %). Composite 376 -> 377.
//  2. Les 5 descriptions affirmaient « le ministère n'a pas encore publié de rapport
//     de situation national couvrant les trois » — c'est désormais FAUX. Réécrites.
//
// Ce qu'on ne fait PAS aujourd'hui, volontairement :
//  - Ne pas basculer la ligne sur le national officiel 320/15. La règle du SKILL.md
//    (« dès qu'un SITREP national inclut le Lac, ce total remplace le composite »)
//    a bien déclenché, mais ce national est arrêté au 6-8/08, soit AVANT le point
//    provincial du 11/08 déjà en base. L'appliquer littéralement régresserait la
//    ligne de 377 à 320. Règle concurrente et prioritaire : ne jamais corriger une
//    ligne vers le bas avec un chiffre plus ancien qu'elle. À rebasculer dès qu'un
//    SITREP national plus récent que le 11/08 paraît. Signalé à David.
//  - Ne pas appliquer le Lac à 126 cas (bilan officiel du jeudi 13/08). Mono-sourcé
//    à french.china.org.cn, dont le TLS est cassé (source http inutilisable, cf.
//    l'effet de bord sourceStatus() résolu le 07/08), et aucun chiffre de décès
//    associé. Aucune reprise https trouvée au 14/08. À corroborer au prochain run.
//
// Faux positif écarté ce matin : ndarason.com « 821 cas suspects / 56 décès en six
// semaines » date du 27/08/2025 et porte sur le Ouaddaï et le Sila (débordement
// soudanais), rien à voir avec l'épidémie 2026. Même famille que le faux positif IRC
// déjà documenté dans le SKILL.md.

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

const ID = "06541c4a-6b67-4c2c-a44e-818ba7621d76";

const description = `Cholera in Chad — composite national figure. Chad is facing three provincial episodes. The Ministry of Public Health and Prevention has now published a consolidated national situation report covering all three — 320 cases and 15 deaths as at 6-8 August 2026, a case fatality ratio of 4.7%, with 52 new cases in 72 hours across 58 villages and neighbourhoods in 12 active health response zones (relayed by UN OCHA) — but its cut-off predates the Ministry's 11 August provincial update, so the count shown here (377 cases, 15 deaths) instead sums the most recent figure available for each province. That national report breaks down as N'Djamena 92, Hadjer-Lamis 168 and Lac 60 cases, and 8, 5 and 2 deaths respectively, summing exactly to its own national totals — confirming that the Ministry itself composes the national count as the sum of its provinces. Hadjer-Lamis: the Karal health district, where the outbreak was confirmed on 13 June 2026 after detection of Vibrio cholerae O1, serotype Ogawa, stands at 168 cases and 5 deaths, a case fatality ratio of 3%, and remains the largest of the three foci; a ministerial circular dated 24 July 2026 states that the rapid response halted transmission in that episode, and the Ministry's 11 August update confirms no new data has been released for the province since. N'Djamena: a separate episode confirmed on 24 July 2026 after three suspected cases on 19 July in the Farcha neighbourhood (1st arrondissement), now covering nine neighbourhoods of the capital; the Ministry reports 96 cumulative cases and 8 deaths as at 11 August 2026, with 84 patients discharged recovered and 4 still hospitalised. Lac: declared on 8 August 2026 by the government's general delegate, with three active foci in island areas and at Ngorerom, in the Bol sub-prefecture; it is growing fastest of the three, reaching 113 cases and 2 deaths by 11 August, with 60 discharges and 52 patients still hospitalised. Situation report no. 029, cut-off 2-3 August 2026, recorded 212 recoveries nationally, with 5 of its 13 deaths occurring in the community, a median patient age of 10 years and close to 78% of patients reaching health facilities with moderate or severe dehydration, a sign of late presentation. The recovery count shown here is still that 2-3 August figure and understates the current total, as no recovery figure has been published for Karal since that episode closed.`;

const description_fr = `Choléra au Tchad — chiffre national composite. Le pays fait face à trois épisodes provinciaux. Le ministère de la Santé publique et de la Prévention a désormais publié un rapport de situation national couvrant les trois — 320 cas et 15 décès arrêtés au 6-8 août 2026, soit un taux de létalité de 4,7 %, avec 52 nouveaux cas en 72 heures répartis sur 58 villages et quartiers dans 12 zones de responsabilité sanitaire actives (relayé par OCHA) — mais sa date d'arrêté est antérieure au point provincial du ministère au 11 août : le bilan affiché ici (377 cas, 15 décès) est donc la somme du chiffre le plus récent disponible pour chaque province. Ce rapport national se ventile en 92 cas à N'Djamena, 168 dans le Hadjer-Lamis et 60 dans le Lac, pour respectivement 8, 5 et 2 décès, soit exactement ses propres totaux nationaux — ce qui confirme que le ministère compose lui-même son décompte national comme la somme de ses provinces. Hadjer-Lamis : le district sanitaire de Karal, où l'épidémie a été confirmée le 13 juin 2026 après détection de Vibrio cholerae O1, sérotype Ogawa, s'établit à 168 cas et 5 décès, soit une létalité de 3 %, et reste le plus important des trois foyers ; une circulaire ministérielle du 24 juillet 2026 indique que la riposte rapide a permis d'arrêter la transmission sur cet épisode, et le point de situation du ministère au 11 août confirme qu'aucune donnée nouvelle n'a été publiée depuis pour cette province. N'Djamena : épisode distinct confirmé le 24 juillet 2026 après trois cas suspects le 19 juillet dans le quartier de Farcha (1er arrondissement), étendu désormais à neuf quartiers de la capitale ; le ministère fait état de 96 cas cumulés et 8 décès au 11 août 2026, avec 84 patients sortis guéris et 4 encore hospitalisés. Lac : province déclarée le 8 août 2026 par le délégué général du gouvernement, avec trois foyers actifs en zones insulaires et à Ngorerom, dans la sous-préfecture de Bol ; c'est la plus rapide des trois, à 113 cas et 2 décès au 11 août, pour 60 sorties et 52 patients encore hospitalisés. Le rapport de situation n°029, arrêté au 2-3 août 2026, faisait état de 212 guérisons au plan national, dont 5 de ses 13 décès survenus en communauté, un âge médian des malades de 10 ans et près de 78 % de patients arrivant dans les structures sanitaires avec une déshydratation modérée ou sévère, signe d'une consultation tardive. Le nombre de guérisons affiché ici reste celui du 2-3 août et sous-estime le total actuel, aucun chiffre de guérison n'ayant été publié pour Karal depuis la clôture de cet épisode.`;

const description_es = `Cólera en Chad — cifra nacional compuesta. El país afronta tres episodios provinciales. El Ministerio de Salud Pública y Prevención ya ha publicado un informe de situación nacional que cubre los tres — 320 casos y 15 fallecidos con fecha de corte del 6-8 de agosto de 2026, una letalidad del 4,7 %, con 52 casos nuevos en 72 horas repartidos por 58 aldeas y barrios en 12 zonas de responsabilidad sanitaria activas (difundido por OCHA) —, pero su fecha de corte es anterior al informe provincial del ministerio del 11 de agosto, por lo que el balance mostrado aquí (377 casos, 15 fallecidos) suma la cifra más reciente disponible para cada provincia. Ese informe nacional se desglosa en 92 casos en Yamena, 168 en Hadjer-Lamis y 60 en Lac, con 8, 5 y 2 fallecidos respectivamente, lo que suma exactamente sus propios totales nacionales, confirmando que el propio ministerio compone su recuento nacional como la suma de sus provincias. Hadjer-Lamis: el distrito sanitario de Karal, donde el brote se confirmó el 13 de junio de 2026 tras la detección de Vibrio cholerae O1, serotipo Ogawa, se sitúa en 168 casos y 5 fallecidos, una letalidad del 3 %, y sigue siendo el mayor de los tres focos; una circular ministerial del 24 de julio de 2026 indica que la respuesta rápida logró detener la transmisión en ese episodio, y el informe ministerial del 11 de agosto confirma que no se han publicado datos nuevos para esa provincia desde entonces. Yamena: episodio distinto confirmado el 24 de julio de 2026 tras tres casos sospechosos el 19 de julio en el barrio de Farcha (1.er distrito), extendido ya a nueve barrios de la capital; el ministerio informa de 96 casos acumulados y 8 fallecidos a 11 de agosto de 2026, con 84 pacientes dados de alta curados y 4 aún hospitalizados. Lac: provincia declarada el 8 de agosto de 2026 por el delegado general del gobierno, con tres focos activos en zonas insulares y en Ngorerom, en la subprefectura de Bol; es la de crecimiento más rápido de las tres, con 113 casos y 2 fallecidos a 11 de agosto, 60 altas y 52 pacientes aún hospitalizados. El informe de situación n.º 029, con fecha de corte del 2-3 de agosto de 2026, registraba 212 recuperaciones a escala nacional, con 5 de sus 13 fallecimientos producidos en la comunidad, una edad mediana de los enfermos de 10 años y cerca del 78 % de pacientes que llegan a los centros sanitarios con deshidratación moderada o grave, señal de una consulta tardía. El número de recuperaciones mostrado aquí sigue siendo el del 2-3 de agosto y subestima el total actual, ya que no se ha publicado ninguna cifra de recuperados para Karal desde el cierre de ese episodio.`;

const description_ar = `الكوليرا في تشاد — رقم وطني مُركّب. تواجه البلاد ثلاث حلقات تفشٍّ في ثلاث مقاطعات. وقد نشرت وزارة الصحة العامة والوقاية الآن تقرير حالة وطنياً يغطيها جميعاً — 320 حالة و15 وفاة بتاريخ إقفال 6-8 أغسطس 2026، أي بمعدل إماتة قدره 4.7 بالمئة، مع 52 حالة جديدة خلال 72 ساعة موزعة على 58 قرية وحياً في 12 منطقة مسؤولية صحية نشطة (نقلها مكتب الأمم المتحدة لتنسيق الشؤون الإنسانية) — غير أن تاريخ إقفاله يسبق تحديث الوزارة الإقليمي في 11 أغسطس، لذا فإن الحصيلة المعروضة هنا (377 حالة و15 وفاة) تجمع أحدث رقم متاح لكل مقاطعة. ويتوزع ذلك التقرير الوطني على 92 حالة في نجامينا و168 في حجر لاميس و60 في مقاطعة البحيرة، مع 8 و5 ووفاتين على التوالي، وهو ما يساوي تماماً إجمالياته الوطنية، ما يؤكد أن الوزارة نفسها تُركّب عدّها الوطني كمجموع مقاطعاتها. حجر لاميس: تبلغ منطقة كارال الصحية، حيث تأكد التفشي في 13 يونيو 2026 بعد الكشف عن ضمة الكوليرا من النمط O1 المصلي Ogawa، 168 حالة و5 وفيات، أي بمعدل إماتة قدره 3 بالمئة، وتظل أكبر البؤر الثلاث؛ ويشير تعميم وزاري مؤرخ في 24 يوليو 2026 إلى أن الاستجابة السريعة أوقفت انتقال المرض في تلك الحلقة، ويؤكد تحديث الوزارة في 11 أغسطس أنه لم تُنشر بيانات جديدة لهذه المقاطعة منذ ذلك الحين. نجامينا: حلقة منفصلة تأكدت في 24 يوليو 2026 بعد ثلاث حالات مشتبه بها في 19 يوليو في حي فرشا (الدائرة الأولى)، وامتدت الآن إلى تسعة أحياء في العاصمة؛ وتفيد الوزارة بتسجيل 96 حالة تراكمية و8 وفيات حتى 11 أغسطس 2026، مع خروج 84 مريضاً بعد التعافي وبقاء 4 في المستشفى. مقاطعة البحيرة (Lac): أعلنها المندوب العام للحكومة في 8 أغسطس 2026، مع ثلاث بؤر نشطة في مناطق جزرية وفي نغوريروم بمحافظة بول الفرعية؛ وهي الأسرع نمواً بين الثلاث، إذ بلغت 113 حالة ووفاتين بحلول 11 أغسطس، مع 60 حالة خروج و52 مريضاً لا يزالون في المستشفى. أما تقرير الحالة رقم 029، بتاريخ إقفال 2-3 أغسطس 2026، فقد سجّل 212 حالة تعافٍ على الصعيد الوطني، منها 5 وفيات من أصل 13 وقعت داخل المجتمع، وبلغ متوسط عمر المرضى 10 سنوات، ووصل نحو 78 بالمئة منهم إلى المرافق الصحية وهم مصابون بجفاف متوسط أو شديد، وهو مؤشر على تأخر طلب الرعاية. وعدد المتعافين المعروض هنا لا يزال رقم 2-3 أغسطس، وهو أقل من الإجمالي الحالي، إذ لم يُنشر أي رقم للمتعافين في كارال منذ إغلاق تلك الحلقة.`;

const description_id = `Kolera di Chad — angka nasional gabungan. Negara ini menghadapi tiga episode wabah di tiga provinsi. Kementerian Kesehatan Masyarakat dan Pencegahan kini telah menerbitkan laporan situasi nasional yang mencakup ketiganya — 320 kasus dan 15 kematian dengan batas data 6-8 Agustus 2026, tingkat kematian kasus 4,7 persen, dengan 52 kasus baru dalam 72 jam yang tersebar di 58 desa dan lingkungan pada 12 zona tanggung jawab kesehatan aktif (disiarkan oleh OCHA) — tetapi batas datanya mendahului pembaruan provinsi dari kementerian per 11 Agustus, sehingga angka yang ditampilkan di sini (377 kasus, 15 kematian) menjumlahkan angka terbaru yang tersedia untuk tiap provinsi. Laporan nasional tersebut terurai menjadi 92 kasus di N'Djamena, 168 di Hadjer-Lamis, dan 60 di Lac, dengan masing-masing 8, 5, dan 2 kematian, yang persis sama dengan total nasionalnya sendiri — menegaskan bahwa kementerian sendiri menyusun hitungan nasionalnya sebagai penjumlahan provinsi-provinsinya. Hadjer-Lamis: distrik kesehatan Karal, tempat wabah dikonfirmasi pada 13 Juni 2026 setelah terdeteksi Vibrio cholerae O1, serotipe Ogawa, berada pada 168 kasus dan 5 kematian, tingkat kematian kasus 3 persen, dan tetap menjadi fokus terbesar di antara ketiganya; surat edaran kementerian tertanggal 24 Juli 2026 menyatakan bahwa respons cepat berhasil menghentikan penularan pada episode tersebut, dan pembaruan kementerian per 11 Agustus menegaskan tidak ada data baru yang dirilis untuk provinsi itu sejak saat itu. N'Djamena: episode terpisah yang dikonfirmasi pada 24 Juli 2026 setelah tiga kasus suspek pada 19 Juli di lingkungan Farcha (arondisemen ke-1), kini meluas ke sembilan lingkungan di ibu kota; kementerian melaporkan 96 kasus kumulatif dan 8 kematian per 11 Agustus 2026, dengan 84 pasien dipulangkan dalam keadaan sembuh dan 4 masih dirawat. Lac: provinsi yang diumumkan pada 8 Agustus 2026 oleh delegasi jenderal pemerintah, dengan tiga fokus aktif di wilayah kepulauan dan di Ngorerom, subprefektur Bol; provinsi ini tumbuh paling cepat di antara ketiganya, mencapai 113 kasus dan 2 kematian pada 11 Agustus, dengan 60 pasien dipulangkan dan 52 masih dirawat. Laporan situasi no. 029, batas data 2-3 Agustus 2026, mencatat 212 kesembuhan secara nasional, dengan 5 dari 13 kematiannya terjadi di komunitas, usia median pasien 10 tahun, dan hampir 78 persen pasien tiba di fasilitas kesehatan dengan dehidrasi sedang atau berat, tanda keterlambatan mencari pengobatan. Jumlah kesembuhan yang ditampilkan di sini masih angka 2-3 Agustus dan lebih rendah dari total saat ini, karena tidak ada angka kesembuhan yang dipublikasikan untuk Karal sejak episode tersebut ditutup.`;

// Garde-fou : le composite doit rester la somme explicite des trois provinces.
const KARAL = 168, NDJAMENA = 96, LAC = 113;
const cases = KARAL + NDJAMENA + LAC;
const deaths = 5 + 8 + 2;
if (cases !== 377 || deaths !== 15) throw new Error(`Composite inattendu: ${cases}/${deaths}`);

const patch = {
  cases,
  deaths,
  // recovered inchangé (212, chiffre national du SITREP n°029) : aucun chiffre de
  // guérison n'a jamais été publié pour Karal, le vrai total est indevinable.
  date: "2026-08-11", // arrêté du point provincial le plus récent, inchangé
  source: "https://tchadinfos.com/2026/08/12/sante-209-cas-de-cholera-enregistres-a-ndjamena-et-dans-le-lac/",
  description,
  description_fr,
  description_es,
  description_ar,
  description_id,
  updated_at: new Date().toISOString(),
};

const res = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks?id=eq.${ID}`, {
  method: "PATCH",
  headers: {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  },
  body: JSON.stringify(patch),
});
if (!res.ok) throw new Error(`PATCH échoué ${res.status}: ${await res.text()}`);
const [row] = await res.json();
console.log("OK —", row.disease_en, "/", row.country_en);
console.log(`  cases=${row.cases} (168 Karal + 96 N'Djamena + 113 Lac)`);
console.log(`  deaths=${row.deaths}  recovered=${row.recovered}  date=${row.date}`);
console.log(`  risk_level=${row.risk_level}  source_priority=${row.source_priority}  active=${row.active}`);
for (const k of ["description", "description_fr", "description_es", "description_ar", "description_id"]) {
  const v = row[k];
  console.log(`  ${k}: ${v ? `${v.length} car.` : "!! NULL !!"}${v && v.includes("377") ? " ✓377" : v ? " !! 377 absent" : ""}`);
}
