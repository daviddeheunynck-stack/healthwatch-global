// 2026-07-31 — morning-don-check
// 1. Choléra/Tchad : premier bilan chiffré pour N'Djamena (55 cas / 6 décès au 30/07).
//    Karal clos à 167/4. Ligne pays = somme des deux épisodes = 222 cas / 10 décès.
//    risk_level medium -> high (décision conditionnelle de David du 30/07 : rejuger dès
//    qu'un chiffre N'Djamena existe ; capitale, 55 cas en 11 j, létalité 10,9 %, 2 districts).
// 2. West Nile/France : rafraîchissement vers le bulletin SpF du 23/07 (données au 20/07).
//    Chiffres inchangés (1 cas autochtone, 0 décès) — seule l'édition citée change.
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
console.log("DB:", SUPABASE_URL);

async function patch(id, payload) {
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
  const body = await r.json();
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(body)}`);
  const [row] = body;
  console.log(
    `\nOK ${row.disease_en}/${row.country_en}: cases=${row.cases} deaths=${row.deaths} ` +
      `date=${row.date} risk=${row.risk_level} src=${row.source}`
  );
  for (const k of ["description", "description_fr", "description_es", "description_ar", "description_id"]) {
    if (row[k] == null) throw new Error(`ALERTE: ${k} est null après écriture`);
  }
  console.log("   5 descriptions non-null OK");
}

// ---------------------------------------------------------------- Choléra / Tchad
const CHAD_SRC =
  "https://tchadinfos.com/2026/07/30/cholera-a-ndjamena-55-cas-confirmes-et-six-deces-le-ministere-appelle-a-la-vigilance/";

await patch("06541c4a-6b67-4c2c-a44e-818ba7621d76", {
  cases: 222,
  deaths: 10,
  date: "2026-07-30",
  source: CHAD_SRC,
  risk_level: "high",
  description:
    "Cholera in Chad — two distinct episodes, combined here. Karal health district (Hadjer-Lamis province): outbreak confirmed on 13 June 2026 after detection of Vibrio cholerae O1, serotype Ogawa. A Ministry of Public Health and Prevention circular dated 24 July 2026 puts this episode at 167 cumulative cases and states that the rapid response halted transmission; its most recent official death toll remains 4, published on 2 July 2026 when the count stood at 129 cases. N'Djamena: a separate epidemic confirmed on 24 July 2026, the first three suspected cases having been reported on 19 July in the Farcha neighbourhood (1st arrondissement). As of 30 July 2026 the capital reports 55 confirmed cases, 6 deaths, 33 recoveries and 15 patients still hospitalised, across the north health district (1st arrondissement) and the centre district (2nd to 5th arrondissements). The 222 cases and 10 deaths shown here are the sum of the two episodes, which have different cut-off dates: Karal deaths are as of 2 July, N'Djamena figures as of 30 July. Chad does not appear in WHO's Multi-country Cholera Epidemiological Update #38 (30 June 2026, data to 31 May 2026), and WHO AFRO's Chad cholera situation report series stops in mid-June 2026, so this event is tracked from national authority reporting.",
  description_fr:
    "Choléra au Tchad — deux épisodes distincts, cumulés ici. District sanitaire de Karal (province du Hadjer-Lamis) : épidémie confirmée le 13 juin 2026 après détection de Vibrio cholerae O1, sérotype Ogawa. Une circulaire du ministère de la Santé publique et de la Prévention datée du 24 juillet 2026 porte cet épisode à 167 cas cumulés et indique que la riposte rapide a permis d'arrêter la transmission ; son dernier bilan officiel de décès reste 4, publié le 2 juillet 2026 alors que le cumul était de 129 cas. N'Djamena : épidémie distincte confirmée le 24 juillet 2026, les trois premiers cas suspects ayant été signalés le 19 juillet dans le quartier de Farcha (1er arrondissement). Au 30 juillet 2026, la capitale compte 55 cas confirmés, 6 décès, 33 guérisons et 15 patients encore hospitalisés, répartis entre le district sanitaire nord (1er arrondissement) et le district centre (2e au 5e arrondissement). Les 222 cas et 10 décès affichés ici sont la somme des deux épisodes, dont les dates d'arrêté diffèrent : les décès de Karal sont arrêtés au 2 juillet, les chiffres de N'Djamena au 30 juillet. Le Tchad n'apparaît pas dans la Mise à jour épidémiologique multipays de l'OMS sur le choléra n° 38 (30 juin 2026, données au 31 mai 2026), et la série de rapports de situation de l'OMS AFRO sur le choléra au Tchad s'arrête à la mi-juin 2026 : cet événement est donc suivi à partir des rapports des autorités nationales.",
  description_es:
    "Cólera en Chad — dos episodios distintos, sumados aquí. Distrito sanitario de Karal (provincia de Hadjer-Lamis): brote confirmado el 13 de junio de 2026 tras la detección de Vibrio cholerae O1, serotipo Ogawa. Una circular del Ministerio de Salud Pública y Prevención con fecha 24 de julio de 2026 sitúa este episodio en 167 casos acumulados e indica que la respuesta rápida logró detener la transmisión; su último balance oficial de fallecidos sigue siendo 4, publicado el 2 de julio de 2026 cuando el acumulado era de 129 casos. Yamena: brote distinto confirmado el 24 de julio de 2026, tras notificarse los tres primeros casos sospechosos el 19 de julio en el barrio de Farcha (1.er distrito municipal). A 30 de julio de 2026 la capital registra 55 casos confirmados, 6 fallecidos, 33 recuperaciones y 15 pacientes aún hospitalizados, repartidos entre el distrito sanitario norte (1.er distrito municipal) y el distrito centro (del 2.º al 5.º). Los 222 casos y 10 fallecidos que se muestran aquí son la suma de ambos episodios, con fechas de corte distintas: las muertes de Karal están cerradas a 2 de julio y las cifras de Yamena a 30 de julio. Chad no aparece en la Actualización epidemiológica multipaís de la OMS sobre el cólera n.º 38 (30 de junio de 2026, datos al 31 de mayo de 2026), y la serie de informes de situación de la OMS AFRO sobre el cólera en Chad se detiene a mediados de junio de 2026, por lo que este evento se sigue a partir de los informes de las autoridades nacionales.",
  description_ar:
    "الكوليرا في تشاد — حلقتان منفصلتان، مجمّعتان هنا. منطقة كارال الصحية (مقاطعة حجر لاميس): تأكد التفشي في 13 يونيو 2026 بعد الكشف عن ضمة الكوليرا من النمط O1 المصلي Ogawa. ويفيد تعميم لوزارة الصحة العامة والوقاية مؤرخ في 24 يوليو 2026 بأن هذه الحلقة بلغت 167 حالة تراكمية وأن الاستجابة السريعة أوقفت انتقال المرض؛ ولا تزال أحدث حصيلة رسمية للوفيات فيها 4 وفيات، نُشرت في 2 يوليو 2026 حين كان المجموع 129 حالة. نجامينا: تفشٍّ منفصل تأكد في 24 يوليو 2026، بعد الإبلاغ عن أول ثلاث حالات مشتبه بها في 19 يوليو في حي فرشا (الدائرة الأولى). وحتى 30 يوليو 2026، سجّلت العاصمة 55 حالة مؤكدة و6 وفيات و33 حالة تعافٍ و15 مريضًا لا يزالون في المستشفى، موزعين بين المنطقة الصحية الشمالية (الدائرة الأولى) والمنطقة الوسطى (الدوائر من الثانية إلى الخامسة). والرقمان المعروضان هنا، 222 حالة و10 وفيات، هما مجموع الحلقتين اللتين تختلف تواريخ إغلاق بياناتهما: وفيات كارال حتى 2 يوليو، وأرقام نجامينا حتى 30 يوليو. ولا تظهر تشاد في التحديث الوبائي للكوليرا متعدد البلدان رقم 38 الصادر عن منظمة الصحة العالمية (30 يونيو 2026، بيانات حتى 31 مايو 2026)، كما تتوقف سلسلة تقارير الحالة الصادرة عن المكتب الإقليمي لأفريقيا بشأن الكوليرا في تشاد عند منتصف يونيو 2026، لذلك يُتابع هذا الحدث من تقارير السلطات الوطنية.",
  description_id:
    "Kolera di Chad — dua episode terpisah, digabungkan di sini. Distrik kesehatan Karal (provinsi Hadjer-Lamis): wabah dikonfirmasi pada 13 Juni 2026 setelah terdeteksi Vibrio cholerae O1, serotipe Ogawa. Sebuah surat edaran Kementerian Kesehatan Masyarakat dan Pencegahan bertanggal 24 Juli 2026 menyebut episode ini mencapai 167 kasus kumulatif dan menyatakan bahwa respons cepat berhasil menghentikan penularan; angka kematian resmi terakhirnya tetap 4, dipublikasikan pada 2 Juli 2026 ketika kumulatif masih 129 kasus. N'Djamena: wabah terpisah yang dikonfirmasi pada 24 Juli 2026, setelah tiga kasus suspek pertama dilaporkan pada 19 Juli di lingkungan Farcha (arondisemen ke-1). Per 30 Juli 2026 ibu kota mencatat 55 kasus terkonfirmasi, 6 kematian, 33 kesembuhan dan 15 pasien yang masih dirawat, tersebar di distrik kesehatan utara (arondisemen ke-1) dan distrik tengah (arondisemen ke-2 hingga ke-5). Angka 222 kasus dan 10 kematian yang ditampilkan di sini adalah jumlah dari kedua episode, yang memiliki tanggal batas berbeda: kematian Karal per 2 Juli, angka N'Djamena per 30 Juli. Chad tidak muncul dalam Pembaruan Epidemiologi Kolera Multi-negara WHO #38 (30 Juni 2026, data hingga 31 Mei 2026), dan seri laporan situasi WHO AFRO tentang kolera di Chad berhenti pada pertengahan Juni 2026, sehingga peristiwa ini dilacak dari pelaporan otoritas nasional.",
});

// ------------------------------------------------------------ West Nile / France
const WNV_SRC =
  "https://www.santepubliquefrance.fr/maladies-a-transmission-vectorielle/chikungunya/bulletin-national/chikungunya-dengue-zika-et-17";

await patch("906bf26a-8867-4a9c-ad7c-976e4e2c5bab", {
  cases: 1,
  deaths: 0,
  date: "2026-07-23",
  source: WNV_SRC,
  description:
    "One autochthonous human case of West Nile virus infection identified in France in 2026, in the Pyrénées-Orientales department (Occitanie region) — the first detection of local virus circulation in humans in France this year, and still the only one. No deaths reported. Source: Santé publique France, national arbovirus (chikungunya/dengue/Zika/West Nile) enhanced surveillance bulletin of 23 July 2026, data as at 20 July 2026.",
  description_fr:
    "Un cas autochtone d'infection à virus West Nile chez l'homme en France en 2026, identifié dans le département des Pyrénées-Orientales (région Occitanie) — première détection de la circulation du virus chez l'homme en France cette année, et toujours la seule. Aucun décès rapporté. Source : Santé publique France, bulletin de surveillance renforcée des arboviroses (chikungunya, dengue, Zika, West Nile) du 23 juillet 2026, données arrêtées au 20 juillet 2026.",
  description_es:
    "Un caso humano autóctono de infección por el virus del Nilo Occidental identificado en Francia en 2026, en el departamento de los Pirineos Orientales (región de Occitania): la primera detección de circulación local del virus en humanos en Francia este año, y todavía la única. No se han notificado fallecidos. Fuente: Santé publique France, boletín nacional de vigilancia reforzada de arbovirosis (chikungunya/dengue/Zika/Nilo Occidental) del 23 de julio de 2026, datos a 20 de julio de 2026.",
  description_ar:
    "حالة بشرية أصلية واحدة للإصابة بفيروس غرب النيل في فرنسا في عام 2026، تم تحديدها في محافظة البرانس الشرقية (منطقة أوكسيتانيا) — وهي أول رصد لتداول الفيروس محليًا بين البشر في فرنسا هذا العام، ولا تزال الوحيدة. ولم يُبلَّغ عن أي وفيات. المصدر: الوكالة الفرنسية للصحة العامة، نشرة المراقبة المعززة للأمراض المنقولة بالمفصليات (شيكونغونيا/حمى الضنك/زيكا/غرب النيل) الصادرة في 23 يوليو 2026، ببيانات حتى 20 يوليو 2026.",
  description_id:
    "Satu kasus autokton infeksi virus West Nile pada manusia di Prancis pada 2026, teridentifikasi di departemen Pyrénées-Orientales (wilayah Occitanie) — deteksi pertama sirkulasi virus secara lokal pada manusia di Prancis tahun ini, dan masih satu-satunya. Tidak ada kematian yang dilaporkan. Sumber: Santé publique France, buletin surveilans arbovirus nasional (chikungunya/dengue/Zika/West Nile) tanggal 23 Juli 2026, data per 20 Juli 2026.",
});

console.log("\nTerminé.");
