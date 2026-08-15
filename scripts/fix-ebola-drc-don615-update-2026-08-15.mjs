// Ebola (Bundibugyo virus) / RD Congo — run du 2026-08-15, sur demande explicite de David
// ("Mets à jour avec le DON").
//
// Contexte : check-new-don a détecté 2026-DON615 (publié 14/08, données au 12/08) et l'a
// correctement classé "🔵 foyer déjà suivi via une autre source" — cette ligne est verrouillée
// (source_priority=10) sur l'ECDC plutôt que sur les DON de l'OMS depuis la décision de David
// du 16/07 (voir [[project_ebola_drc_priority10_frozen_no_autofeed]]), car l'ECDC actualisait
// jusqu'ici plus souvent que la série DON. Comparaison faite avant d'écrire : le chiffre ECDC
// en base (4 566/2 128) datait du 11/08 ; DON615 (4 665/2 184) date du 12/08 — un jour plus
// récent, pas un désaccord entre deux sources sur la même date. Progression cohérente avec le
// rythme déjà observé (+185 cas la veille dans le contrôle qualité du 14/08). David a tranché :
// utiliser ce DON pour cette mise à jour (question ouverte séparément : si la préférence
// ECDC-par-défaut tient toujours pour la suite — pas résolue ici, à reconfirmer si l'ECDC
// reprend l'avance).
//
// Nouveau dans DON615 par rapport à la description en base :
//  - 6e province touchée : Bas-Uélé (1/11 zones de santé) — absente de la description ECDC.
//    Détail complet par province maintenant disponible (zones de santé touchées / total).
//  - Infections chez les soignants : 155 cas confirmés, 45 décès (CFR 29 %), 68 guéris, au 09/08
//    — jamais mentionné dans la ligne jusqu'ici.
//  - Guérisons : 986 au total (965 RDC + 18 Ouganda + 2 Allemagne + 1 France) au 12/08,
//    remplace le chiffre RDC-seul de 849 au 08/08 (explicitement daté comme "dernier chiffre
//    disponible" dans l'ancienne description — DON615 est simplement plus récent ET plus complet).
//  - Suivi des contacts : 84,2 % (17 460/20 740) au 12/08, remplace 82,4 % (non daté précisément
//    dans l'ancienne version).
//  - "Plus grande épidémie d'Ebola jamais enregistrée dans le pays, dépassant le Nord-Kivu
//    2018-2020 (3 317 cas)" — cadrage de sévérité présent dans le DON, absent de la description
//    ECDC actuelle.
//
// Ce qui NE change PAS depuis le DON (repris tel quel de la description existante, DON615 ne le
// contredit pas) :
//  - Ouganda : 20 cas / 2 décès, épidémie déclarée terminée le 28/07 (dernier cas 21/06) — DON615
//    confirme les mêmes 20 cas/2 décès, rien à corriger.
//  - Cas isolés traités à l'étranger (1 France, 2 Allemagne) — cohérent avec le détail des
//    guérisons du DON615 (2 Allemagne, 1 France parmi les 986 guéris).
//  - PHEIC déclarée le 17/05/2026.
//
// Chiffre gardé mais explicitement re-daté plutôt que supprimé ou silencieusement laissé tel
// quel : "570 patients hospitalisés en isolement" (ECDC, au 11/08) — DON615 ne donne pas ce
// chiffre, donc je ne l'invente pas pour le 12/08 ; il reste affiché mais étiqueté "au 11 août"
// pour ne pas laisser croire qu'il est aussi frais que le reste.
//
// Champs additionnels mis à jour : `recovered` (849 -> 986) et `who_don_published_at`
// (2026-08-01 -> 2026-08-14, date de publication de ce DON) — `source`/`cases`/`deaths`/`date`
// restent la seule source de vérité pour le compte principal, ces deux colonnes sont un miroir.
//
// Traductions FR/ES/ID écrites à la main (texte trop long pour translateDescription(),
// cf. lib/translate.ts, limite 500 caractères/requête MyMemory). AR écrit SANS séparateurs de
// milliers (ex. "4665" pas "4,665") : c'est la convention déjà en place sur cette ligne
// (vérifiée sur la description_ar existante avant d'écrire) et elle évite structurellement le
// bug de composition bidirectionnelle trouvé le 15/08 sur la ligne Diphtérie/Nigéria (groupes de
// chiffres séparés par virgule inversés en RTL) — plus sûr que corriger après coup.
//
// Conservé en historique git (git add -f) : même ligne PHEIC phare que
// fix-ebola-drc-don614-20260802.mjs et fix-ebola-drc-dup-afro-sitrep13-2026-08-12.mjs, déjà
// conservés — cohérent de garder celui-ci aussi.

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

const ID = "bd1c3a46-a921-49b7-b79e-10ad715c4c38";
const SOURCE_URL = "https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON615";

const description = `Ebola disease caused by Bundibugyo virus in the Democratic Republic of the Congo. As of 12 August 2026, WHO reports 4,665 confirmed cases and 2,184 deaths, a case fatality ratio of 46.8% — the largest Ebola outbreak ever recorded in the country, surpassing the 2018-2020 North Kivu outbreak (3,317 cases). Cases have been reported from 54 of the country's health zones across six provinces: Ituri (28/36 health zones), North Kivu (12/34), South Kivu (1/34), Haut-Uele (6/13), Tshopo (6/23) and, newly affected, Bas-Uele (1/11). 84.2% of contacts were followed up in the 24 hours to 12 August (17,460 of 20,740 due). At least 986 patients have recovered as of the same date: 965 in the DRC, 18 in Uganda, 2 in Germany and 1 in France. Infections among healthcare workers continue: at least 155 confirmed cases, 45 deaths (CFR 29%) and 68 recoveries since the start of the outbreak, as of 9 August. 570 patients were hospitalised in isolation as of 11 August (most recent figure available for that metric). There is no approved vaccine or treatment for the Bundibugyo strain. Uganda, which recorded 20 cases and 2 deaths imported from this outbreak, declared its own outbreak over on 28 July 2026, its last confirmed case dating from 21 June 2026. Isolated cases diagnosed in DRC were treated abroad: 1 in France, 2 in Germany. Declared a Public Health Emergency of International Concern (PHEIC) on 17 May 2026. Source: WHO Disease Outbreak News (DON615), 14 August 2026, data as of 12 August.`;

const description_fr = `Maladie à virus Ebola causée par le virus Bundibugyo en République démocratique du Congo. Au 12 août 2026, l'OMS recense 4 665 cas confirmés et 2 184 décès, soit un taux de létalité de 46,8 % — la plus grande épidémie d'Ebola jamais enregistrée dans le pays, dépassant celle du Nord-Kivu de 2018-2020 (3 317 cas). Des cas ont été rapportés dans 54 zones de santé réparties dans six provinces : Ituri (28/36 zones de santé), Nord-Kivu (12/34), Sud-Kivu (1/34), Haut-Uélé (6/13), Tshopo (6/23) et, nouvellement touché, le Bas-Uélé (1/11). 84,2 % des contacts ont été suivis dans les 24 heures précédant le 12 août (17 460 sur 20 740 à suivre). Au moins 986 patients ont été déclarés guéris à la même date : 965 en RDC, 18 en Ouganda, 2 en Allemagne et 1 en France. Les infections chez les soignants se poursuivent : au moins 155 cas confirmés, 45 décès (létalité de 29 %) et 68 guérisons depuis le début de l'épidémie, au 9 août. 570 patients étaient hospitalisés en isolement au 11 août (dernier chiffre disponible pour cet indicateur). Il n'existe ni vaccin ni traitement homologué contre la souche Bundibugyo. L'Ouganda, qui a enregistré 20 cas et 2 décès importés de cette épidémie, a déclaré la fin de sa propre épidémie le 28 juillet 2026, son dernier cas confirmé remontant au 21 juin 2026. Des cas isolés diagnostiqués en RDC ont été traités à l'étranger : 1 en France, 2 en Allemagne. Déclarée Urgence de Santé Publique de Portée Internationale (USPPI) le 17 mai 2026. Source : Disease Outbreak News de l'OMS (DON615), 14 août 2026, données au 12 août.`;

const description_es = `Enfermedad del Ébola causada por el virus Bundibugyo en la República Democrática del Congo. Al 12 de agosto de 2026, la OMS reporta 4.665 casos confirmados y 2.184 muertes, una tasa de letalidad del 46,8 % — el mayor brote de Ébola jamás registrado en el país, superando el de Kivu del Norte de 2018-2020 (3.317 casos). Se han notificado casos en 54 zonas sanitarias de seis provincias: Ituri (28/36 zonas sanitarias), Kivu del Norte (12/34), Kivu del Sur (1/34), Alto Uele (6/13), Tshopo (6/23) y, recién afectada, Bajo Uele (1/11). El 84,2 % de los contactos fueron objeto de seguimiento en las 24 horas previas al 12 de agosto (17.460 de 20.740 pendientes). Al menos 986 pacientes se han recuperado a la misma fecha: 965 en la RDC, 18 en Uganda, 2 en Alemania y 1 en Francia. Las infecciones entre el personal sanitario continúan: al menos 155 casos confirmados, 45 muertes (letalidad del 29 %) y 68 recuperaciones desde el inicio del brote, al 9 de agosto. 570 pacientes estaban hospitalizados en aislamiento al 11 de agosto (última cifra disponible para ese indicador). No existe vacuna ni tratamiento aprobado para la cepa Bundibugyo. Uganda, que registró 20 casos y 2 muertes importadas de este brote, declaró el fin de su propio brote el 28 de julio de 2026, con su último caso confirmado el 21 de junio de 2026. Casos aislados diagnosticados en la RDC fueron tratados en el extranjero: 1 en Francia, 2 en Alemania. Declarada Emergencia de Salud Pública de Importancia Internacional (ESPII) el 17 de mayo de 2026. Fuente: Disease Outbreak News de la OMS (DON615), 14 de agosto de 2026, datos al 12 de agosto.`;

const description_ar = `مرض الإيبولا الناجم عن فيروس بونديبوغيو في جمهورية الكونغو الديمقراطية. حتى 12 أغسطس 2026، سجّلت منظمة الصحة العالمية 4665 حالة مؤكدة و2184 حالة وفاة، أي معدل إماتة قدره 46.8 بالمئة — وهو أكبر تفشٍّ للإيبولا يُسجَّل في البلاد على الإطلاق، متجاوزاً تفشي كيفو الشمالية 2018-2020 (3317 حالة). سُجّلت حالات في 54 منطقة صحية ضمن ست مقاطعات: إيتوري (28/36 منطقة صحية)، وكيفو الشمالية (12/34)، وكيفو الجنوبية (1/34)، وأويلي العليا (6/13)، وتشوبو (6/23)، ومقاطعة أويلي السفلى المتأثرة حديثاً (1/11). وخضع 84.2 بالمئة من المخالطين للمتابعة خلال الـ24 ساعة السابقة لـ12 أغسطس (17460 من أصل 20740 كان يتعين متابعتهم). وتعافى ما لا يقل عن 986 مريضاً حتى التاريخ نفسه: 965 في جمهورية الكونغو الديمقراطية، و18 في أوغندا، واثنان في ألمانيا، وواحد في فرنسا. وتتواصل الإصابات بين العاملين الصحيين: 155 حالة مؤكدة على الأقل، و45 حالة وفاة (بمعدل إماتة 29 بالمئة)، و68 حالة تعافٍ منذ بداية التفشي، حتى 9 أغسطس. وكان 570 مريضاً في المستشفى قيد العزل حتى 11 أغسطس (آخر رقم متاح لهذا المؤشر). لا يوجد لقاح أو علاج معتمد لسلالة بونديبوغيو. وأعلنت أوغندا، التي سجلت 20 حالة و2 وفاة مستوردة من هذا التفشي، انتهاء تفشيها الخاص في 28 يوليو 2026، وكانت آخر حالة مؤكدة لديها في 21 يونيو 2026. كما عولجت حالات معزولة شُخصت في جمهورية الكونغو الديمقراطية في الخارج: حالة واحدة في فرنسا، وحالتان في ألمانيا. أُعلن التفشي طارئة صحية عامة تثير قلقاً دولياً في 17 مايو 2026. المصدر: تقرير حالة تفشي المرض الصادر عن منظمة الصحة العالمية (DON615)، 14 أغسطس 2026، بيانات حتى 12 أغسطس.`;

const description_id = `Penyakit Ebola yang disebabkan oleh virus Bundibugyo di Republik Demokratik Kongo. Per 12 Agustus 2026, WHO melaporkan 4.665 kasus terkonfirmasi dan 2.184 kematian, tingkat kematian kasus 46,8 persen — wabah Ebola terbesar yang pernah tercatat di negara ini, melampaui wabah Kivu Utara 2018-2020 (3.317 kasus). Kasus telah dilaporkan dari 54 zona kesehatan di enam provinsi: Ituri (28/36 zona kesehatan), Kivu Utara (12/34), Kivu Selatan (1/34), Haut-Uele (6/13), Tshopo (6/23), dan yang baru terdampak, Bas-Uele (1/11). Sebanyak 84,2 persen kontak dipantau dalam 24 jam menjelang 12 Agustus (17.460 dari 20.740 yang harus dipantau). Sedikitnya 986 pasien telah sembuh per tanggal yang sama: 965 di RD Kongo, 18 di Uganda, 2 di Jerman, dan 1 di Prancis. Infeksi di kalangan tenaga kesehatan terus berlanjut: sedikitnya 155 kasus terkonfirmasi, 45 kematian (tingkat kematian kasus 29 persen), dan 68 kesembuhan sejak awal wabah, per 9 Agustus. Sebanyak 570 pasien dirawat dalam isolasi per 11 Agustus (angka terbaru yang tersedia untuk indikator ini). Tidak ada vaksin atau pengobatan yang disetujui untuk galur Bundibugyo. Uganda, yang mencatat 20 kasus dan 2 kematian impor dari wabah ini, menyatakan wabahnya sendiri berakhir pada 28 Juli 2026, dengan kasus terkonfirmasi terakhir pada 21 Juni 2026. Kasus terisolasi yang didiagnosis di RD Kongo dirawat di luar negeri: 1 di Prancis, 2 di Jerman. Dinyatakan sebagai Kedaruratan Kesehatan Masyarakat yang Meresahkan Dunia (PHEIC) pada 17 Mei 2026. Sumber: Disease Outbreak News WHO (DON615), 14 Agustus 2026, data per 12 Agustus.`;

// Garde-fous : les deux CFR affichées doivent rester cohérentes avec les chiffres cités.
const CASES = 4665, DEATHS = 2184;
const cfr = Math.round((DEATHS / CASES) * 1000) / 10;
if (cfr !== 46.8) throw new Error(`CFR principale inattendue: ${cfr}% (attendu 46.8%)`);
const hcwCfr = Math.round((45 / 155) * 100);
if (hcwCfr !== 29) throw new Error(`CFR soignants inattendue: ${hcwCfr}% (attendu 29%)`);

const patch = {
  cases: CASES,
  deaths: DEATHS,
  date: "2026-08-12",
  source: SOURCE_URL,
  recovered: 986,
  who_don_published_at: "2026-08-14",
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
console.log(`  cases=${row.cases} deaths=${row.deaths} recovered=${row.recovered} date=${row.date} (CFR ${cfr}%)`);
console.log(`  risk_level=${row.risk_level}  source_priority=${row.source_priority}  active=${row.active}  is_pheic=${row.is_pheic}`);
console.log(`  who_don_published_at=${row.who_don_published_at}`);
for (const k of ["description", "description_fr", "description_es", "description_ar", "description_id"]) {
  const v = row[k];
  console.log(`  ${k}: ${v ? `${v.length} car.` : "!! NULL !!"}`);
}
