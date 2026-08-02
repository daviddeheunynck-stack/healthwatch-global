// fix-cholera-chad-karal-deaths-2026-08-02.mjs
//
// Contexte (routine morning-don-check du 2026-08-02, section 4 bis — surveillance
// spécifique Choléra/Tchad) :
//
// Le volet Karal était bloqué depuis le 24/07 sur une incohérence de dates d'arrêté
// documentée exprès dans la routine : 167 cas (circulaire ministérielle du 24/07) mais
// 4 décès (bilan du 02/07, quand le cumul était à 129). Consigne explicite : ne pas
// « corriger » ce mélange sans un nouveau bilan de décès.
//
// Ce bilan est arrivé, et d'une source institutionnelle meilleure que la presse
// tchadienne : l'opération DREF de l'IFRC « Cholera Outbreak in Chad - 2026 »
// (MDRTD026, publiée le 27/07/2026), qui cite la correspondance officielle
// n° 2533/MSPP/SE/SG/COUSP/2026 du ministère de la Santé publique et de la Prévention :
//
//   « As of 9 July 2026, a cumulative total of 167 cases and 5 deaths, including
//     3 community deaths, had been reported, corresponding to a 3 per cent case
//     fatality rate (CFR). »
//
// Les deux chiffres ont enfin la même date d'arrêté (09/07) et sont cohérents entre eux
// (5/167 = 3,0 %, exactement le CFR annoncé ; 4/167 aurait donné 2,4 %). Le 167 est donc
// confirmé par deux sources indépendantes, et le compte de décès de Karal passe de 4 à 5.
//
// Périmètres bien disjoints, pas de double comptage : le DREF décrit une flambée
// concentrée sur les aires de santé Karal 1, Karal 2, Baltram et Alkouk, et ne mentionne
// N'Djamena qu'au titre de cas *suspects* signalés le 07/07 — soit avant la confirmation
// de l'épidémie de N'Djamena le 24/07.
//
//   Karal      : 167 cas /  5 décès  (arrêté 09/07/2026, IFRC DREF MDRTD026 citant le MSPP)
//   N'Djamena  :  55 cas /  6 décès  (arrêté 30/07/2026, médecin-chef district N'Djamena-Est)
//   -------------------------------------------------------------------------------------
//   Total pays : 222 cas / 11 décès  (cases inchangé, deaths 10 → 11)
//
// `recovered` passait de 0 à 33 : les 33 guérisons de N'Djamena sont documentées, celles
// de Karal ne le sont pas — c'est donc un plancher, dit comme tel dans les descriptions.
//
// `date` reste au 30/07 (point de données le plus récent = N'Djamena) et `source` reste
// l'article du 30/07 qui porte ce bilan ; le DREF est cité nommément dans les descriptions
// pour la partie Karal. `risk_level` reste `high` (décision du 31/07, inchangée).
//
// Les 5 descriptions sont réécrites ensemble (piège connu : les scripts fix-* qui
// n'écrivent que l'EN laissent fr/es/ar/id périmées).

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

const patch = {
  cases: 222,
  deaths: 11,
  recovered: 33,
  description:
    "Cholera in Chad — two distinct episodes, combined here. Karal health district (Hadjer-Lamis province): outbreak confirmed on 13 June 2026 after detection of Vibrio cholerae O1, serotype Ogawa. The IFRC DREF operation MDRTD026 (27 July 2026), citing official Ministry of Public Health and Prevention correspondence, reports 167 cumulative cases and 5 deaths as of 9 July 2026 (3 of them community deaths, CFR 3%); a ministerial circular of 24 July 2026 confirms the same case total and states that the rapid response halted transmission in this episode. N'Djamena: a separate outbreak, confirmed on 24 July 2026 after three suspected cases on 19 July in the Farcha neighbourhood (1st arrondissement), since extended to the northern and central health districts (1st to 5th arrondissements); the chief medical officer of the N'Djamena-Est health district reported 55 confirmed cases, 6 deaths, 33 recoveries and 15 people hospitalised as of 30 July 2026. Country total shown here: 222 cases and 11 deaths — the two episodes have different cut-off dates. Recoveries counted here cover N'Djamena only.",
  description_fr:
    "Choléra au Tchad — deux épisodes distincts, cumulés ici. District sanitaire de Karal (province du Hadjer-Lamis) : épidémie confirmée le 13 juin 2026 après détection de Vibrio cholerae O1, sérotype Ogawa. L'opération DREF MDRTD026 de la FICR (27 juillet 2026), citant une correspondance officielle du ministère de la Santé publique et de la Prévention, fait état de 167 cas cumulés et 5 décès au 9 juillet 2026 (dont 3 décès communautaires, létalité 3 %) ; une circulaire ministérielle du 24 juillet 2026 confirme le même total de cas et indique que la riposte rapide a permis d'arrêter la transmission sur cet épisode. N'Djamena : épidémie distincte, confirmée le 24 juillet 2026 après trois cas suspects le 19 juillet dans le quartier de Farcha (1er arrondissement), étendue depuis aux districts sanitaires nord et centre (1er au 5e arrondissement) ; le médecin-chef du district sanitaire de N'Djamena-Est faisait état de 55 cas confirmés, 6 décès, 33 guérisons et 15 personnes hospitalisées au 30 juillet 2026. Total pays affiché ici : 222 cas et 11 décès — les deux épisodes n'ont pas la même date d'arrêté. Les guérisons comptées ici ne portent que sur N'Djamena.",
  description_es:
    "Cólera en Chad — dos episodios distintos, sumados aquí. Distrito sanitario de Karal (provincia de Hadjer-Lamis): brote confirmado el 13 de junio de 2026 tras la detección de Vibrio cholerae O1, serotipo Ogawa. La operación DREF MDRTD026 de la FICR (27 de julio de 2026), que cita correspondencia oficial del Ministerio de Salud Pública y Prevención, informa de 167 casos acumulados y 5 fallecidos al 9 de julio de 2026 (3 de ellos fallecimientos comunitarios, letalidad del 3 %); una circular ministerial del 24 de julio de 2026 confirma el mismo total de casos e indica que la respuesta rápida logró detener la transmisión en este episodio. Yamena: brote distinto, confirmado el 24 de julio de 2026 tras tres casos sospechosos el 19 de julio en el barrio de Farcha (1.er distrito), extendido después a los distritos sanitarios norte y centro (1.º a 5.º distrito); el médico jefe del distrito sanitario de Yamena-Este informó de 55 casos confirmados, 6 fallecidos, 33 recuperados y 15 personas hospitalizadas al 30 de julio de 2026. Total nacional mostrado aquí: 222 casos y 11 fallecidos — los dos episodios no tienen la misma fecha de corte. Las recuperaciones contabilizadas aquí corresponden solo a Yamena.",
  description_ar:
    "الكوليرا في تشاد — حلقتان منفصلتان، مجمّعتان هنا. منطقة كارال الصحية (مقاطعة حجر لاميس): تأكد التفشي في 13 يونيو 2026 بعد الكشف عن ضمة الكوليرا من النمط O1 المصلي Ogawa. ويفيد نداء الطوارئ DREF MDRTD026 الصادر عن الاتحاد الدولي لجمعيات الصليب الأحمر والهلال الأحمر (27 يوليو 2026)، نقلاً عن مراسلة رسمية من وزارة الصحة العامة والوقاية، بتسجيل 167 حالة تراكمية و5 وفيات حتى 9 يوليو 2026 (منها 3 وفيات مجتمعية، بمعدل إماتة 3 بالمئة)؛ ويؤكد تعميم وزاري مؤرخ في 24 يوليو 2026 المجموع نفسه من الحالات ويشير إلى أن الاستجابة السريعة أوقفت انتقال المرض في هذه الحلقة. أما نجامينا: فهي حلقة منفصلة، تأكدت في 24 يوليو 2026 بعد ثلاث حالات مشتبه بها في 19 يوليو في حي فرشا (الدائرة الأولى)، ثم امتدت إلى المنطقتين الصحيتين الشمالية والوسطى (الدوائر من الأولى إلى الخامسة)؛ وأفاد الطبيب رئيس منطقة نجامينا-الشرق الصحية بتسجيل 55 حالة مؤكدة و6 وفيات و33 حالة شفاء و15 شخصاً في المستشفى حتى 30 يوليو 2026. الإجمالي الوطني المعروض هنا: 222 حالة و11 وفاة — وللحلقتين تاريخا إقفال مختلفان. وحالات الشفاء المحتسبة هنا تخص نجامينا وحدها.",
  description_id:
    "Kolera di Chad — dua episode terpisah, digabungkan di sini. Distrik kesehatan Karal (provinsi Hadjer-Lamis): wabah dikonfirmasi pada 13 Juni 2026 setelah terdeteksi Vibrio cholerae O1, serotipe Ogawa. Operasi DREF MDRTD026 dari IFRC (27 Juli 2026), yang mengutip surat resmi Kementerian Kesehatan Masyarakat dan Pencegahan, melaporkan 167 kasus kumulatif dan 5 kematian per 9 Juli 2026 (3 di antaranya kematian di komunitas, CFR 3 persen); surat edaran kementerian tertanggal 24 Juli 2026 menegaskan total kasus yang sama dan menyatakan bahwa respons cepat berhasil menghentikan penularan pada episode ini. N'Djamena: wabah terpisah, dikonfirmasi pada 24 Juli 2026 setelah tiga kasus suspek pada 19 Juli di lingkungan Farcha (arondisemen ke-1), yang kemudian meluas ke distrik kesehatan utara dan tengah (arondisemen ke-1 sampai ke-5); kepala dokter distrik kesehatan N'Djamena-Est melaporkan 55 kasus terkonfirmasi, 6 kematian, 33 kesembuhan, dan 15 orang dirawat di rumah sakit per 30 Juli 2026. Total nasional yang ditampilkan di sini: 222 kasus dan 11 kematian — kedua episode memiliki tanggal batas data yang berbeda. Angka kesembuhan di sini hanya mencakup N'Djamena.",
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

if (!res.ok) throw new Error(`PATCH ${res.status}: ${await res.text()}`);

const [row] = await res.json();
console.log("OK — ligne mise à jour :");
console.log({
  id: row.id,
  country_en: row.country_en,
  cases: row.cases,
  deaths: row.deaths,
  recovered: row.recovered,
  date: row.date,
  risk_level: row.risk_level,
  active: row.active,
  source_priority: row.source_priority,
});
console.log("\nTraductions non nulles :", {
  fr: !!row.description_fr,
  es: !!row.description_es,
  ar: !!row.description_ar,
  id: !!row.description_id,
});
