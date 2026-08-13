// Choléra / Tchad — mise à jour du composite avec les chiffres MSPP arrêtés au 11/08/2026 18h25
// (point de situation Lac + N'Djaména publié le 12/08, repris par tchadinfos).
//
//   Hadjer-Lamis / Karal : 167 cas / 5 décès, arrêté au 09/07 (DREF FICR MDRTD026 + circulaire
//                          MSPP du 24/07). Épisode clos, aucune donnée nouvelle depuis — le
//                          point du 12/08 le confirme explicitement ("pas de nouvelles données
//                          pour la province du Hadjer-Lamis"). L'article cite 129/4 au 02/07,
//                          chiffre ANTÉRIEUR : ne pas régresser la ligne dessus.
//   N'Djaména            : 96 cas / 8 décès (84 sortis guéris, 4 hospitalisés)
//   Lac                  : 113 cas / 2 décès (60 sorties, 52 hospitalisés)
//   → composite 167+96+113 = 376 cas, 5+8+2 = 15 décès.
//
// Contrôle de cohérence : le dernier national officiel (SITREP n°029, arrêté 02-03/08) donnait
// 13 décès = 5 (Karal) + 8 (N'Djaména), donc la somme des décès par province reproduit
// exactement le total officiel. Rassurant sur la méthode du composite.
//
// `recovered` reste à 212 (chiffre national du SITREP n°029) : aucun chiffre de guérison n'a
// jamais été publié pour Karal, donc un total consolidé réel est indevinable. 212 est sous-estimé
// (N'Djaména + Lac à eux seuls déclarent 144 sorties au 11/08) — la sous-estimation est dite
// explicitement dans les 5 descriptions plutôt que comblée par une supposition.
//
// Correction au passage : les descriptions disaient "168 cas cumulés" pour Karal, dérive d'un
// chiffre par ailleurs sourcé à 167 partout (DREF MDRTD026, circulaire, note ministérielle
// du 13/06). Aligné sur 167.
//
// risk_level laissé à "high" (relevé le 31/07) : les deux épisodes ouverts progressent, le Lac
// a plus que doublé en 3 jours (46 le 08/08 → 113 le 11/08).

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
const SOURCE =
  "https://tchadinfos.com/2026/08/12/sante-209-cas-de-cholera-enregistres-a-ndjamena-et-dans-le-lac/";

const DESCRIPTIONS = {
  description: `Cholera in Chad — composite national figure. Chad is facing three provincial episodes and the Ministry of Public Health and Prevention has not yet published a consolidated national situation report covering all three, so the count shown here (376 cases, 15 deaths) is the sum of the best available figure for each province, not an official national total. Hadjer-Lamis: the Karal health district, where the outbreak was confirmed on 13 June 2026 after detection of Vibrio cholerae O1, serotype Ogawa, closed at 167 cases and 5 deaths as at 9 July 2026 (IFRC DREF operation MDRTD026, citing ministerial correspondence); a ministerial circular dated 24 July 2026 states that the rapid response halted transmission in that episode, and the Ministry's 11 August update confirms no new data has been released for the province since. N'Djamena: a separate episode confirmed on 24 July 2026 after three suspected cases on 19 July in the Farcha neighbourhood (1st arrondissement), now covering nine neighbourhoods of the capital; the Ministry reports 96 cumulative cases and 8 deaths as at 11 August 2026, with 84 patients discharged recovered and 4 still hospitalised. Lac: declared on 8 August 2026 by the government's general delegate, with three active foci in island areas and at Ngorerom, in the Bol sub-prefecture; it is growing fastest of the three, reaching 113 cases and 2 deaths by 11 August, with 60 discharges and 52 patients still hospitalised. The last officially consolidated national figures — situation report no. 029, cut-off 2-3 August 2026 — were 239 cases, 13 deaths and 212 recoveries, a case fatality ratio of 5.4%, well above the 1% threshold set by WHO, with 5 of the 13 deaths occurring in the community; the median age of patients is 10 years and close to 78% reach health facilities with moderate or severe dehydration, a sign of late presentation. The recovery count shown here is still that 2-3 August national figure and understates the current total, as no recovery figure has been published for Karal since that episode closed.`,

  description_fr: `Choléra au Tchad — chiffre national composite. Le pays fait face à trois épisodes provinciaux et le ministère de la Santé publique et de la Prévention n'a pas encore publié de rapport de situation national couvrant les trois : le bilan affiché ici (376 cas, 15 décès) est donc la somme du meilleur chiffre disponible pour chaque province, et non un total national officiel. Hadjer-Lamis : le district sanitaire de Karal, où l'épidémie a été confirmée le 13 juin 2026 après détection de Vibrio cholerae O1, sérotype Ogawa, s'est clos sur 167 cas et 5 décès arrêtés au 9 juillet 2026 (opération DREF de la FICR MDRTD026, citant une correspondance ministérielle) ; une circulaire ministérielle du 24 juillet 2026 indique que la riposte rapide a permis d'arrêter la transmission sur cet épisode, et le point de situation du ministère au 11 août confirme qu'aucune donnée nouvelle n'a été publiée depuis pour cette province. N'Djamena : épisode distinct confirmé le 24 juillet 2026 après trois cas suspects le 19 juillet dans le quartier de Farcha (1er arrondissement), étendu désormais à neuf quartiers de la capitale ; le ministère fait état de 96 cas cumulés et 8 décès au 11 août 2026, avec 84 patients sortis guéris et 4 encore hospitalisés. Lac : province déclarée le 8 août 2026 par le délégué général du gouvernement, avec trois foyers actifs en zones insulaires et à Ngorerom, dans la sous-préfecture de Bol ; c'est la plus rapide des trois, à 113 cas et 2 décès au 11 août, pour 60 sorties et 52 patients encore hospitalisés. Les derniers chiffres nationaux consolidés — rapport de situation n°029, arrêté au 2-3 août 2026 — étaient de 239 cas, 13 décès et 212 guérisons, soit un taux de létalité de 5,4 %, largement au-dessus du seuil de 1 % fixé par l'OMS, dont 5 des 13 décès survenus en communauté ; l'âge médian des malades est de 10 ans et près de 78 % arrivent dans les structures sanitaires avec une déshydratation modérée ou sévère, signe d'une consultation tardive. Le nombre de guérisons affiché ici reste celui du 2-3 août et sous-estime le total actuel, aucun chiffre de guérison n'ayant été publié pour Karal depuis la clôture de cet épisode.`,

  description_es: `Cólera en Chad — cifra nacional compuesta. El país afronta tres episodios provinciales y el Ministerio de Salud Pública y Prevención aún no ha publicado un informe de situación nacional que cubra los tres, por lo que el balance mostrado aquí (376 casos, 15 fallecidos) es la suma de la mejor cifra disponible para cada provincia y no un total nacional oficial. Hadjer-Lamis: el distrito sanitario de Karal, donde el brote se confirmó el 13 de junio de 2026 tras la detección de Vibrio cholerae O1, serotipo Ogawa, se cerró con 167 casos y 5 fallecidos con fecha de corte del 9 de julio de 2026 (operación DREF de la FICR MDRTD026, que cita correspondencia ministerial); una circular ministerial del 24 de julio de 2026 indica que la respuesta rápida logró detener la transmisión en ese episodio, y el informe ministerial del 11 de agosto confirma que no se han publicado datos nuevos para esa provincia desde entonces. Yamena: episodio distinto confirmado el 24 de julio de 2026 tras tres casos sospechosos el 19 de julio en el barrio de Farcha (1.er distrito), extendido ya a nueve barrios de la capital; el ministerio informa de 96 casos acumulados y 8 fallecidos a 11 de agosto de 2026, con 84 pacientes dados de alta curados y 4 aún hospitalizados. Lac: provincia declarada el 8 de agosto de 2026 por el delegado general del gobierno, con tres focos activos en zonas insulares y en Ngorerom, en la subprefectura de Bol; es la de crecimiento más rápido de las tres, con 113 casos y 2 fallecidos a 11 de agosto, 60 altas y 52 pacientes aún hospitalizados. Las últimas cifras nacionales consolidadas — informe de situación n.º 029, con fecha de corte del 2-3 de agosto de 2026 — eran de 239 casos, 13 fallecidos y 212 recuperaciones, una letalidad del 5,4 %, muy por encima del umbral del 1 % fijado por la OMS, con 5 de los 13 fallecimientos producidos en la comunidad; la edad mediana de los enfermos es de 10 años y cerca del 78 % llega a los centros sanitarios con deshidratación moderada o grave, señal de una consulta tardía. El número de recuperaciones mostrado aquí sigue siendo el del 2-3 de agosto y subestima el total actual, ya que no se ha publicado ninguna cifra de recuperados para Karal desde el cierre de ese episodio.`,

  description_ar: `الكوليرا في تشاد — رقم وطني مُركّب. تواجه البلاد ثلاث حلقات تفشٍّ في ثلاث مقاطعات، ولم تنشر وزارة الصحة العامة والوقاية بعد تقرير حالة وطنياً يغطيها جميعاً، لذا فإن الحصيلة المعروضة هنا (376 حالة و15 وفاة) هي مجموع أفضل رقم متاح لكل مقاطعة، وليست إجمالاً وطنياً رسمياً. حجر لاميس: أُغلقت منطقة كارال الصحية، حيث تأكد التفشي في 13 يونيو 2026 بعد الكشف عن ضمة الكوليرا من النمط O1 المصلي Ogawa، عند 167 حالة و5 وفيات بتاريخ إقفال 9 يوليو 2026 (عملية DREF التابعة للاتحاد الدولي لجمعيات الصليب الأحمر والهلال الأحمر MDRTD026، نقلاً عن مراسلة وزارية)؛ ويشير تعميم وزاري مؤرخ في 24 يوليو 2026 إلى أن الاستجابة السريعة أوقفت انتقال المرض في تلك الحلقة، ويؤكد تحديث الوزارة في 11 أغسطس أنه لم تُنشر بيانات جديدة لهذه المقاطعة منذ ذلك الحين. نجامينا: حلقة منفصلة تأكدت في 24 يوليو 2026 بعد ثلاث حالات مشتبه بها في 19 يوليو في حي فرشا (الدائرة الأولى)، وامتدت الآن إلى تسعة أحياء في العاصمة؛ وتفيد الوزارة بتسجيل 96 حالة تراكمية و8 وفيات حتى 11 أغسطس 2026، مع خروج 84 مريضاً بعد التعافي وبقاء 4 في المستشفى. مقاطعة البحيرة (Lac): أعلنها المندوب العام للحكومة في 8 أغسطس 2026، مع ثلاث بؤر نشطة في مناطق جزرية وفي نغوريروم بمحافظة بول الفرعية؛ وهي الأسرع نمواً بين الثلاث، إذ بلغت 113 حالة ووفاتين بحلول 11 أغسطس، مع 60 حالة خروج و52 مريضاً لا يزالون في المستشفى. أما آخر أرقام وطنية موحّدة — تقرير الحالة رقم 029، بتاريخ إقفال 2-3 أغسطس 2026 — فكانت 239 حالة و13 وفاة و212 حالة تعافٍ، أي بمعدل إماتة قدره 5.4 بالمئة، وهو أعلى بكثير من عتبة 1 بالمئة التي حددتها منظمة الصحة العالمية، منها 5 وفيات من أصل 13 وقعت داخل المجتمع؛ ويبلغ متوسط عمر المرضى 10 سنوات، ويصل نحو 78 بالمئة منهم إلى المرافق الصحية وهم مصابون بجفاف متوسط أو شديد، وهو مؤشر على تأخر طلب الرعاية. وعدد المتعافين المعروض هنا لا يزال رقم 2-3 أغسطس، وهو أقل من الإجمالي الحالي، إذ لم يُنشر أي رقم للمتعافين في كارال منذ إغلاق تلك الحلقة.`,

  description_id: `Kolera di Chad — angka nasional gabungan. Negara ini menghadapi tiga episode wabah di tiga provinsi dan Kementerian Kesehatan Masyarakat dan Pencegahan belum menerbitkan laporan situasi nasional yang mencakup ketiganya, sehingga angka yang ditampilkan di sini (376 kasus, 15 kematian) merupakan penjumlahan angka terbaik yang tersedia untuk tiap provinsi, bukan total nasional resmi. Hadjer-Lamis: distrik kesehatan Karal, tempat wabah dikonfirmasi pada 13 Juni 2026 setelah terdeteksi Vibrio cholerae O1, serotipe Ogawa, ditutup pada 167 kasus dan 5 kematian dengan batas data 9 Juli 2026 (operasi DREF IFRC MDRTD026, mengutip korespondensi kementerian); surat edaran kementerian tertanggal 24 Juli 2026 menyatakan bahwa respons cepat berhasil menghentikan penularan pada episode tersebut, dan pembaruan kementerian per 11 Agustus menegaskan tidak ada data baru yang dirilis untuk provinsi itu sejak saat itu. N'Djamena: episode terpisah yang dikonfirmasi pada 24 Juli 2026 setelah tiga kasus suspek pada 19 Juli di lingkungan Farcha (arondisemen ke-1), kini meluas ke sembilan lingkungan di ibu kota; kementerian melaporkan 96 kasus kumulatif dan 8 kematian per 11 Agustus 2026, dengan 84 pasien dipulangkan dalam keadaan sembuh dan 4 masih dirawat. Lac: provinsi yang diumumkan pada 8 Agustus 2026 oleh delegasi jenderal pemerintah, dengan tiga fokus aktif di wilayah kepulauan dan di Ngorerom, subprefektur Bol; provinsi ini tumbuh paling cepat di antara ketiganya, mencapai 113 kasus dan 2 kematian pada 11 Agustus, dengan 60 pasien dipulangkan dan 52 masih dirawat. Angka nasional terkonsolidasi terakhir — laporan situasi no. 029, batas data 2-3 Agustus 2026 — adalah 239 kasus, 13 kematian, dan 212 kesembuhan, dengan tingkat kematian kasus 5,4 persen, jauh di atas ambang 1 persen yang ditetapkan WHO, dan 5 dari 13 kematian terjadi di komunitas; usia median pasien adalah 10 tahun dan hampir 78 persen tiba di fasilitas kesehatan dengan dehidrasi sedang atau berat, tanda keterlambatan mencari pengobatan. Jumlah kesembuhan yang ditampilkan di sini masih angka 2-3 Agustus dan lebih rendah dari total saat ini, karena tidak ada angka kesembuhan yang dipublikasikan untuk Karal sejak episode tersebut ditutup.`,
};

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const res = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks?id=eq.${ID}&select=*`, { headers });
const [row] = await res.json();
if (!row) throw new Error("Ligne introuvable");

// Garde-fou : on n'écrit que par-dessus l'état attendu (composite 285/13 du 09/08).
if (row.cases !== 285 || row.deaths !== 13) {
  throw new Error(`Chiffres inattendus (${row.cases}/${row.deaths}) — vérifier avant d'écrire.`);
}
if (row.source_priority !== 10 || row.active !== true) {
  throw new Error(`État inattendu (priority=${row.source_priority} active=${row.active}).`);
}

const patch = {
  cases: 376,
  deaths: 15,
  date: "2026-08-11",
  source: SOURCE,
  ...DESCRIPTIONS,
};

const upd = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks?id=eq.${ID}`, {
  method: "PATCH",
  headers,
  body: JSON.stringify(patch),
});
if (!upd.ok) throw new Error(`PATCH échoué: ${upd.status} ${await upd.text()}`);
const [after] = await upd.json();

for (const col of Object.keys(DESCRIPTIONS)) {
  if (!after[col]) throw new Error(`${col} est null après écriture !`);
  if (!after[col].includes("376")) throw new Error(`${col} ne cite pas le nouveau total !`);
}

console.log("OK.");
console.log(
  `cases=${after.cases} deaths=${after.deaths} recovered=${after.recovered} date=${after.date} risk=${after.risk_level}`
);
console.log(`source=${after.source}`);
console.log(`longueurs: ${Object.keys(DESCRIPTIONS).map((c) => `${c}=${after[c].length}`).join(" ")}`);
