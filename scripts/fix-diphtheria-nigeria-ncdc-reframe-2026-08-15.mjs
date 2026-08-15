// Diphtérie / Nigéria — run du 2026-08-15, sur demande explicite de David.
//
// Contexte : le contrôle qualité du 14/08 a signalé cette ligne comme périmée (180j,
// palier "dashboard"). Investigation la veille (voir conversation) : la source en place
// (WHO SAGE Rapid Risk Assessment v.2, PDF daté du 16/03/2026) n'a pas de v.3 — reconfirmé
// aujourd'hui (URL v.3 en 404, page de la v.2 ne référence aucune version plus récente).
// Mais elle ne couvrait de toute façon qu'une fenêtre partielle : "1 January 2025 to
// 15 February 2026" (18 295 cas suspects / 15 273 confirmés / 939 décès), PAS le cumul
// complet depuis le début de l'épidémie (mai/2022 selon la presse, Epi-Week 19 2022 selon
// le NCDC lui-même). David a demandé de recadrer la ligne sur le chiffre NCDC cumulé.
//
// Chiffre retenu : 65 759 cas suspects cumulés / 2 229 décès au 22/03/2026, létalité 3,4 %
// (calculée sur les suspects, aucun chiffre de confirmés disponible pour cette date précise —
// voir plus bas pourquoi je n'invente pas de proportion de confirmés au 22/03).
//   Source principale : Leadership (Nigeria), 07/07/2026, citant le NCDC et le ministère de
//   la Santé de l'État de Kano via MSF — https://leadership.ng/nigeria-records-65759-suspected-diphtheria-cases-2229-deaths/
//   Repris à l'identique par AllAfrica (08/07) et par la couverture MSF elle-même
//   (thisdaylive.com 09/07, avec citation nommée du coordinateur de projet MSF
//   Abdoul-Aziz Djibrilla ; guardian.ng, businessday.ng, thesun.ng — tous concordants).
//   Corroboré indépendamment via prezly.msf.org.uk (portail presse MSF UK) : conclusion de
//   la réponse d'urgence de 3 ans à Kano le 30/05/2026, 14 700+ enfants pris en charge,
//   létalité en structures MSF passée de 25 % à <5 %, 835 028 doses en deux campagnes
//   (348 080 au 27/04, 486 948 du 20 au 24/06 dans 20 quartiers).
//
// Vérification de cohérence faite avant d'écrire : le PDF du dernier sitrep NUMÉROTÉ du
// NCDC (Epi Week 3, 12-18/01/2026 — confirmé être le plus récent sur la page de listing des
// sitreps, aucun Week 4+ 2026 publié) donne 61 930 suspects / 40 460 confirmés / 2 151 décès
// (létalité 5,3 % SUR LES CONFIRMÉS, pas les suspects) au 18/01. La trajectoire 61 930 (18/01)
// -> 65 759 (22/03) est cohérente avec le ralentissement documenté par ailleurs (~3 830 cas
// suspects supplémentaires en 9 semaines, en décélération) — pas de saut incohérent entre les
// deux sources. Extraction PDF faite localement via pdf-parse (WebFetch ne décode pas ce PDF).
//
// Ce qu'on ne fait PAS ici, volontairement :
//  - Ne pas donner de chiffre de cas confirmés au 22/03 : la source (Leadership/MSF) ne
//    fournit que suspects+décès pour cette date, le seul chiffre de confirmés disponible
//    (40 460) date du 18/01 et est cité comme tel, jamais réutilisé comme s'il datait du 22/03.
//  - Ne pas recalculer la létalité "à la NCDC" (sur les confirmés) pour le 22/03 : impossible
//    sans un compte de confirmés à cette date. La létalité de 3,4 % affichée ici est
//    explicitement sur la base des suspects (cohérent avec la façon dont le WHO RRA v.2
//    calculait déjà son propre 5,1 % — sur 18 295 suspects, pas sur les 15 273 confirmés).
//  - Ne pas désactiver la ligne malgré le seuil de péremption de 180j franchi : l'épidémie est
//    manifestement toujours active (nouveau cluster suspect Niger State/Minna signalé le
//    20/07, la 2e campagne de vaccination MSF ne s'est terminée que le 24/06). Désactiver
//    laisserait croire à tort que l'épidémie est terminée.
//  - Ne pas changer source_priority (reste 5, pas de raison d'en changer).
//
// Traductions FR/ES/AR/ID écrites à la main (comme pour Tchad/Wallis-et-Futuna/American
// Samoa) : le texte dépasse largement la limite de 500 caractères par requête de MyMemory
// (lib/translate.ts), translateDescription() n'est donc pas utilisable ici.
//
// ⚠️ Bug trouvé et corrigé avant écriture en prod (15/08) : la première rédaction de
// description_ar avait chaque nombre à groupes multiples inversé ("759,65" au lieu de
// "65,759", et pareil pour les 8 autres) — artefact de composition bidirectionnelle en
// écrivant des chiffres LTR à séparateurs de milliers dans du texte RTL, pas une convention
// arabe valide. Corrigé puis revérifié programmatiquement (extraction de tous les groupes de
// chiffres des 5 langues, comparés un par un aux valeurs sources) avant le PATCH ci-dessous.
//
// Conservé en historique git (git add -f, hors politique par défaut de suppression des
// scripts de correction ponctuels — voir .gitignore) sur demande explicite de David : même
// niveau de nuance méthodologique que les scripts Tchad/choléra déjà conservés (deux fenêtres
// de comptage à ne pas confondre, cf. section "Ce qu'on ne fait PAS" ci-dessus).

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

const ID = "1ca31b07-6f83-4967-9f59-b599f7574642";
const SOURCE_URL = "https://leadership.ng/nigeria-records-65759-suspected-diphtheria-cases-2229-deaths/";

const description = `Diphtheria in Nigeria — the country accounts for the majority of diphtheria cases in the WHO African Region, in an outbreak running since 2022. Per Nigeria's Centre for Disease Control and Prevention (NCDC) and Kano State's Ministry of Health, cited by Médecins Sans Frontières (MSF), 65,759 cumulative suspected cases and 2,229 deaths (case fatality ratio 3.4%) had been recorded nationally as at 22 March 2026. The outbreak is concentrated in Kano, Yobe, Katsina, Bauchi, Borno, Kaduna and Sokoto states, which NCDC's most recent numbered situation report (Epi Week 3, 18 January 2026) put at 94.6% of suspected cases; that report also recorded 40,460 confirmed cases nationally and a 5.3% case fatality ratio among confirmed cases specifically. Kano State alone, the hardest-hit, recorded more than 31,900 suspected cases and over 1,260 deaths between March 2022 and 22 March 2026. MSF concluded its three-year emergency response there on 30 May 2026, having treated more than 14,700 children — the case fatality rate at MSF-supported facilities fell from 25% to under 5% during the intervention — and closed out with two mass vaccination rounds reaching 835,028 children in total (348,080 by 27 April 2026, a further 486,948 across 20 wards from 20-24 June 2026). "Although the number of cases has declined in recent months, mainly due to mass vaccination campaigns, the disease remains a serious health threat to children in Kano," said MSF project coordinator Abdoul-Aziz Djibrilla. Source: Leadership (Nigeria), 7 July 2026, citing NCDC and MSF; corroborated by NCDC's Epi Week 3 situation report.`;

const description_fr = `Diphtérie au Nigeria — le pays concentre la majorité des cas de diphtérie de la Région Afrique de l'OMS, dans une épidémie en cours depuis 2022. Selon le Centre nigérian de contrôle des maladies (NCDC) et le ministère de la Santé de l'État de Kano, cités par Médecins Sans Frontières (MSF), 65 759 cas suspects cumulés et 2 229 décès (taux de létalité de 3,4 %) avaient été enregistrés au niveau national au 22 mars 2026. L'épidémie est concentrée dans les États de Kano, Yobe, Katsina, Bauchi, Borno, Kaduna et Sokoto, qui représentaient 94,6 % des cas suspects selon le dernier rapport de situation numéroté du NCDC (semaine épidémiologique 3, 18 janvier 2026) ; ce même rapport recensait aussi 40 460 cas confirmés au niveau national et une létalité de 5,3 % parmi les seuls cas confirmés. L'État de Kano, le plus touché, a recensé à lui seul plus de 31 900 cas suspects et plus de 1 260 décès entre mars 2022 et le 22 mars 2026. MSF y a mis fin à sa réponse d'urgence de trois ans le 30 mai 2026, après avoir pris en charge plus de 14 700 enfants — le taux de létalité dans les structures soutenues par MSF est passé de 25 % à moins de 5 % au cours de l'intervention — et a clôturé son action par deux campagnes de vaccination de masse ayant touché 835 028 enfants au total (348 080 au 27 avril 2026, puis 486 948 supplémentaires dans 20 quartiers du 20 au 24 juin 2026). « Si le nombre de cas a diminué ces derniers mois, principalement grâce aux campagnes de vaccination de masse, la maladie reste une menace sérieuse pour les enfants à Kano », a déclaré Abdoul-Aziz Djibrilla, coordinateur de projet MSF. Source : Leadership (Nigeria), 7 juillet 2026, citant le NCDC et MSF ; recoupé avec le rapport de situation semaine 3 du NCDC.`;

const description_es = `Difteria en Nigeria — el país concentra la mayoría de los casos de difteria de la Región de África de la OMS, en un brote en curso desde 2022. Según el Centro Nigeriano para el Control de Enfermedades (NCDC) y el Ministerio de Salud del estado de Kano, citados por Médicos Sin Fronteras (MSF), se habían registrado a nivel nacional 65.759 casos sospechosos acumulados y 2.229 muertes (tasa de letalidad del 3,4 %) al 22 de marzo de 2026. El brote se concentra en los estados de Kano, Yobe, Katsina, Bauchi, Borno, Kaduna y Sokoto, que según el último informe de situación numerado del NCDC (semana epidemiológica 3, 18 de enero de 2026) representaban el 94,6 % de los casos sospechosos; ese mismo informe registraba además 40.460 casos confirmados a nivel nacional y una letalidad del 5,3 % entre los casos confirmados. Solo el estado de Kano, el más afectado, registró más de 31.900 casos sospechosos y más de 1.260 muertes entre marzo de 2022 y el 22 de marzo de 2026. MSF puso fin allí a su respuesta de emergencia de tres años el 30 de mayo de 2026, tras haber atendido a más de 14.700 niños — la letalidad en los centros apoyados por MSF cayó del 25 % a menos del 5 % durante la intervención — y cerró su actuación con dos campañas de vacunación masiva que alcanzaron a 835.028 niños en total (348.080 hasta el 27 de abril de 2026, y otros 486.948 en 20 distritos del 20 al 24 de junio de 2026). «Aunque el número de casos ha disminuido en los últimos meses, principalmente gracias a las campañas de vacunación masiva, la enfermedad sigue siendo una amenaza grave para los niños en Kano», declaró Abdoul-Aziz Djibrilla, coordinador de proyecto de MSF. Fuente: Leadership (Nigeria), 7 de julio de 2026, citando al NCDC y a MSF; contrastado con el informe de situación de la semana 3 del NCDC.`;

const description_ar = `الدفتيريا في نيجيريا — تستأثر نيجيريا بغالبية حالات الدفتيريا في إقليم أفريقيا التابع لمنظمة الصحة العالمية، في تفشٍّ مستمر منذ عام 2022. وفقاً للمركز النيجيري لمكافحة الأمراض (NCDC) ووزارة الصحة في ولاية كانو، نقلاً عن منظمة أطباء بلا حدود (MSF)، سُجّلت على المستوى الوطني 65,759 حالة مشتبهاً بها تراكمياً و2,229 حالة وفاة (بمعدل إماتة 3.4 بالمئة) حتى 22 مارس 2026. ويتركز التفشي في ولايات كانو ويوبي وكاتسينا وباوتشي وبورنو وكادونا وصكتو، التي مثّلت 94.6 بالمئة من الحالات المشتبه بها بحسب آخر تقرير حالة مرقّم صادر عن المركز (الأسبوع الوبائي 3، 18 يناير 2026)؛ وسجّل التقرير نفسه أيضاً 40,460 حالة مؤكدة على المستوى الوطني ومعدل إماتة قدره 5.3 بالمئة بين الحالات المؤكدة تحديداً. وسجّلت ولاية كانو وحدها، الأكثر تضرراً، أكثر من 31,900 حالة مشتبه بها وأكثر من 1,260 حالة وفاة بين مارس 2022 و22 مارس 2026. وأنهت منظمة أطباء بلا حدود استجابتها الطارئة هناك التي استمرت ثلاث سنوات في 30 مايو 2026، بعد أن عالجت أكثر من 14,700 طفل؛ وانخفض معدل الإماتة في المرافق التي تدعمها المنظمة من 25 بالمئة إلى أقل من 5 بالمئة خلال فترة التدخل؛ واختتمت عملها بحملتي تطعيم جماعي شملتا 835,028 طفلاً إجمالاً (348,080 طفلاً بحلول 27 أبريل 2026، ثم 486,948 طفلاً إضافياً في 20 حياً بين 20 و24 يونيو 2026). وقال منسق مشاريع منظمة أطباء بلا حدود عبد العزيز جبريلا: «رغم تراجع عدد الحالات في الأشهر الأخيرة، ويرجع ذلك أساساً إلى حملات التطعيم الجماعي، فإن المرض لا يزال يشكل تهديداً خطيراً على الأطفال في كانو». المصدر: صحيفة Leadership (نيجيريا)، 7 يوليو 2026، نقلاً عن المركز النيجيري لمكافحة الأمراض ومنظمة أطباء بلا حدود؛ جرى التحقق منها مقارنة بتقرير حالة الأسبوع 3 الصادر عن المركز.`;

const description_id = `Difteri di Nigeria — negara ini menyumbang mayoritas kasus difteri di Wilayah Afrika WHO, dalam wabah yang berlangsung sejak 2022. Menurut Pusat Pengendalian Penyakit Nigeria (NCDC) dan Kementerian Kesehatan Negara Bagian Kano, sebagaimana dikutip oleh Dokter Lintas Batas (MSF), tercatat secara nasional 65.759 kasus suspek kumulatif dan 2.229 kematian (tingkat kematian kasus 3,4 persen) per 22 Maret 2026. Wabah ini terkonsentrasi di negara bagian Kano, Yobe, Katsina, Bauchi, Borno, Kaduna, dan Sokoto, yang menurut laporan situasi bernomor terbaru dari NCDC (Minggu Epidemiologi 3, 18 Januari 2026) menyumbang 94,6 persen dari kasus suspek; laporan yang sama juga mencatat 40.460 kasus terkonfirmasi secara nasional dan tingkat kematian kasus 5,3 persen khusus di antara kasus terkonfirmasi. Negara bagian Kano sendiri, yang paling parah terdampak, mencatat lebih dari 31.900 kasus suspek dan lebih dari 1.260 kematian antara Maret 2022 dan 22 Maret 2026. MSF mengakhiri respons daruratnya selama tiga tahun di sana pada 30 Mei 2026, setelah menangani lebih dari 14.700 anak — tingkat kematian kasus di fasilitas yang didukung MSF turun dari 25 persen menjadi kurang dari 5 persen selama intervensi — dan menutup kegiatannya dengan dua putaran kampanye vaksinasi massal yang menjangkau total 835.028 anak (348.080 anak pada 27 April 2026, ditambah 486.948 anak di 20 distrik pada 20-24 Juni 2026). "Meskipun jumlah kasus telah menurun dalam beberapa bulan terakhir, terutama berkat kampanye vaksinasi massal, penyakit ini masih menjadi ancaman serius bagi anak-anak di Kano," kata koordinator proyek MSF, Abdoul-Aziz Djibrilla. Sumber: Leadership (Nigeria), 7 Juli 2026, mengutip NCDC dan MSF; dicocokkan dengan laporan situasi Minggu 3 NCDC.`;

// Garde-fou : la létalité affichée (suspects) doit rester cohérente avec les deux chiffres.
const CASES = 65759, DEATHS = 2229;
const cfr = Math.round((DEATHS / CASES) * 1000) / 10;
if (cfr !== 3.4) throw new Error(`CFR inattendue: ${cfr}% (attendu 3.4%)`);

const patch = {
  cases: CASES,
  deaths: DEATHS,
  date: "2026-03-22",
  source: SOURCE_URL,
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
console.log(`  cases=${row.cases} deaths=${row.deaths} date=${row.date} (CFR ${cfr}%)`);
console.log(`  risk_level=${row.risk_level}  source_priority=${row.source_priority}  active=${row.active}`);
for (const k of ["description", "description_fr", "description_es", "description_ar", "description_id"]) {
  const v = row[k];
  console.log(`  ${k}: ${v ? `${v.length} car.` : "!! NULL !!"}`);
}
