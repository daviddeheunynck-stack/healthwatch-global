// Routine matinale du 2026-08-12 — Ebola/RDC : doublon actif + re-sourçage LinkedIn → WHO AFRO.
//
// PROBLÈME 1 — doublon actif (scan section 4, morning-don-check) :
//   [bd1c3a46] prio=10, 4 381 cas / 2 011 décès au 09/08, source = post LinkedIn
//   [6a5e9fc9] prio=5,  4 120 cas / 1 887 décès au 07/08, source = news-item Africa CDC
//   Les deux `active=true` → le site public raconte deux fois le plus gros foyer du produit,
//   avec deux totaux qui se contredisent (4 381 vs 4 120).
//   Mécanisme : la ligne curatée est verrouillée à source_priority=10, donc le guard
//   `.lte("source_priority", 5)` de sync-africa-cdc a bloqué l'update et le cron a inséré
//   une seconde ligne (app/api/cron/sync-africa-cdc/route.ts:507 puis :521).
//   Arbitrage : on garde [bd1c3a46] — chiffres plus récents (09/08 vs 07/08), description
//   curatée en 5 langues, contexte USPPI/Ouganda/cas exportés — et on désactive [6a5e9fc9],
//   dont la description n'est que le chapeau du communiqué Africa CDC, sans aucun chiffre épi.
//   Pas de ré-insertion à craindre au prochain run du cron : `indexRow` (route.ts:294) préfère
//   une ligne active à une ligne inactive, donc le cron retrouvera [bd1c3a46] et repartira sur
//   le chemin "blocked by source_priority guard" (skip), pas sur un insert.
//
// PROBLÈME 2 — source LinkedIn sur la ligne conservée :
//   `source = https://www.linkedin.com/feed/update/urn:li:activity:7492851407071391744/`
//   → `sourceStatus()` (lib/outbreaks.ts:689) ne teste que `startsWith("https://")` : le lien
//     est donc affiché comme 'official' (badge vérifié) alors qu'il est derrière un login.
//   → `sourceName()` (lib/outbreaks.ts:770) ne connaît pas linkedin.com : label générique
//     "Official" sur le foyer phare du produit.
//   Re-sourçage vers la source primaire qui porte exactement ces chiffres (heuristique
//   "source secondaire évitable", section 4).
//
// VÉRIFICATION SOURCE PRIMAIRE (12/08, deux sources indépendantes concordantes) :
//   • WHO AFRO, "Ebola Bundibugyo Virus Disease Outbreak — DRC | Uganda, Weekly External
//     Situation Report 13, data as of 09 August 2026" : 4 381 cas confirmés, 2 011 décès,
//     létalité 45,9 %, Ituri = 85,8 % des cas cumulés et 80,6 % des décès, +579 cas et
//     +304 décès depuis le sitrep précédent, cap des 2 000 décès franchi 86 jours après la
//     déclaration du 15 mai 2026.
//   • ECDC (page dédiée, mise à jour 11/08 16h50, données au 09/08) : mêmes 4 381 / 2 011,
//     704 patients hospitalisés en isolement, 53 des 140 zones de santé, 5 provinces,
//     86,7 % des contacts identifiés sous suivi.
//   → cases/deaths/date déjà justes en base : NON réécrits ici, seulement vérifiés en garde.
//
//   `recovered` : 810 en base, chiffre non retrouvé dans aucune source primaire (venait
//   vraisemblablement du post LinkedIn). Le rapport de situation du gouvernement congolais
//   (données au 08/08, relayé par Radio Okapi le 11/08) donne 849 guéris — c'est la seule
//   valeur sourcée disponible, et elle est cohérente avec la progression (708 au 01/08).
//   → 810 (non sourcé) remplacé par 849 (sourcé, daté du 08/08 et présenté comme tel).
//
// Usage: node scripts/fix-ebola-drc-dup-afro-sitrep13-2026-08-12.mjs

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

const KEEP_ID = "bd1c3a46-a921-49b7-b79e-10ad715c4c38"; // ligne curatée, prio=10
const DROP_ID = "6a5e9fc9-50d4-4461-a945-bd77208e4786"; // doublon Africa CDC, prio=5

const AFRO_SRC =
  "https://www.afro.who.int/countries/democratic-republic-of-congo/publication/ebola-bundibugyo-virus-disease-outbreak-4";

const keep = {
  recovered: 849,
  source: AFRO_SRC,
  updated_at: new Date().toISOString(),

  description:
    "Ebola disease caused by Bundibugyo virus in the Democratic Republic of the Congo. As of 9 August 2026: 4,381 confirmed cases and 2,011 deaths, a case fatality ratio of 45.9%, with 704 patients hospitalised in isolation. 53 of the country's 140 health zones are affected across five provinces — Ituri, North Kivu, Haut-Uele, Tshopo and South Kivu — with Ituri alone accounting for 85.8% of cumulative cases and 80.6% of deaths. Contact tracing follow-up stands at 86.7%. The outbreak added 579 confirmed cases and 304 deaths in a single reporting week, passing 2,000 deaths just 86 days after being declared on 15 May 2026. 849 people had been declared recovered as of 8 August 2026 (DRC Ministry of Health situation report). There is no approved vaccine or treatment for the Bundibugyo strain. Uganda, which recorded 20 cases and 2 deaths imported from this outbreak, declared its own outbreak over on 28 July 2026, its last confirmed case dating from 21 June 2026. Isolated cases diagnosed in DRC were treated abroad: 1 in France, 2 in Germany. Declared a Public Health Emergency of International Concern (PHEIC) on 17 May 2026. Source: WHO AFRO Weekly External Situation Report 13.",

  description_fr:
    "Maladie à virus Ebola causée par le virus Bundibugyo en République démocratique du Congo. Au 9 août 2026 : 4 381 cas confirmés et 2 011 décès, soit un taux de létalité de 45,9 %, avec 704 patients hospitalisés en isolement. 53 des 140 zones de santé du pays sont touchées dans cinq provinces — Ituri, Nord-Kivu, Haut-Uélé, Tshopo et Sud-Kivu — l'Ituri concentrant à elle seule 85,8 % des cas cumulés et 80,6 % des décès. Le taux de suivi des contacts s'établit à 86,7 %. L'épidémie a enregistré 579 cas confirmés et 304 décès supplémentaires en une seule semaine de notification, franchissant le cap des 2 000 décès 86 jours seulement après sa déclaration, le 15 mai 2026. 849 personnes avaient été déclarées guéries au 8 août 2026 (rapport de situation du ministère congolais de la Santé). Il n'existe ni vaccin ni traitement homologué contre la souche Bundibugyo. L'Ouganda, qui a enregistré 20 cas et 2 décès importés de cette épidémie, a déclaré la fin de sa propre épidémie le 28 juillet 2026, son dernier cas confirmé remontant au 21 juin 2026. Des cas isolés diagnostiqués en RDC ont été traités à l'étranger : 1 en France, 2 en Allemagne. Déclarée Urgence de Santé Publique de Portée Internationale (USPPI) le 17 mai 2026. Source : rapport de situation externe hebdomadaire n° 13 de l'OMS AFRO.",

  description_es:
    "Enfermedad del Ébola causada por el virus Bundibugyo en la República Democrática del Congo. Al 9 de agosto de 2026: 4.381 casos confirmados y 2.011 muertes, una tasa de letalidad del 45,9 %, con 704 pacientes hospitalizados en aislamiento. 53 de las 140 zonas sanitarias del país están afectadas en cinco provincias — Ituri, Kivu del Norte, Alto Uele, Tshopo y Kivu del Sur —, y solo Ituri concentra el 85,8 % de los casos acumulados y el 80,6 % de las muertes. La tasa de seguimiento de contactos se sitúa en el 86,7 %. El brote sumó 579 casos confirmados y 304 muertes en una sola semana de notificación, superando las 2.000 muertes apenas 86 días después de ser declarado, el 15 de mayo de 2026. 849 personas habían sido declaradas recuperadas al 8 de agosto de 2026 (informe de situación del Ministerio de Salud de la RDC). No existe vacuna ni tratamiento aprobado para la cepa Bundibugyo. Uganda, que registró 20 casos y 2 muertes importadas de este brote, declaró el fin de su propio brote el 28 de julio de 2026, con su último caso confirmado el 21 de junio de 2026. Casos aislados diagnosticados en la RDC fueron tratados en el extranjero: 1 en Francia, 2 en Alemania. Declarada Emergencia de Salud Pública de Importancia Internacional (ESPII) el 17 de mayo de 2026. Fuente: informe de situación externa semanal n.º 13 de la OMS AFRO.",

  description_ar:
    "مرض الإيبولا الناجم عن فيروس بونديبوغيو في جمهورية الكونغو الديمقراطية. حتى 9 أغسطس 2026: 4381 حالة مؤكدة و2011 حالة وفاة، أي معدل إماتة قدره 45.9 بالمئة، مع وجود 704 مرضى في المستشفى قيد العزل. تأثرت 53 من أصل 140 منطقة صحية في البلاد ضمن خمس مقاطعات — إيتوري، وكيفو الشمالية، وأويلي العليا، وتشوبو، وكيفو الجنوبية — وتستأثر إيتوري وحدها بنسبة 85.8 بالمئة من الحالات التراكمية و80.6 بالمئة من الوفيات. ويبلغ معدل متابعة المخالطين 86.7 بالمئة. وسجّل التفشي 579 حالة مؤكدة و304 وفيات إضافية في أسبوع إبلاغ واحد، متجاوزاً عتبة 2000 وفاة بعد 86 يوماً فقط من إعلانه في 15 مايو 2026. وكان قد أُعلن تعافي 849 شخصاً حتى 8 أغسطس 2026 (تقرير الحالة الصادر عن وزارة الصحة في جمهورية الكونغو الديمقراطية). لا يوجد لقاح أو علاج معتمد لسلالة بونديبوغيو. وأعلنت أوغندا، التي سجلت 20 حالة و2 وفاة مستوردة من هذا التفشي، انتهاء تفشيها الخاص في 28 يوليو 2026، وكانت آخر حالة مؤكدة لديها في 21 يونيو 2026. كما عولجت حالات معزولة شُخصت في جمهورية الكونغو الديمقراطية في الخارج: حالة واحدة في فرنسا، وحالتان في ألمانيا. أُعلن التفشي طارئة صحية عامة تثير قلقاً دولياً في 17 مايو 2026. المصدر: التقرير الأسبوعي الخارجي رقم 13 للمكتب الإقليمي لأفريقيا التابع لمنظمة الصحة العالمية.",

  description_id:
    "Penyakit Ebola yang disebabkan oleh virus Bundibugyo di Republik Demokratik Kongo. Per 9 Agustus 2026: 4.381 kasus terkonfirmasi dan 2.011 kematian, dengan tingkat kematian kasus 45,9 persen, serta 704 pasien dirawat dalam isolasi. 53 dari 140 zona kesehatan di negara itu terdampak di lima provinsi — Ituri, Kivu Utara, Haut-Uele, Tshopo, dan Kivu Selatan — dengan Ituri sendiri menyumbang 85,8 persen kasus kumulatif dan 80,6 persen kematian. Tingkat pemantauan kontak berada di angka 86,7 persen. Wabah ini bertambah 579 kasus terkonfirmasi dan 304 kematian hanya dalam satu pekan pelaporan, melampaui 2.000 kematian hanya 86 hari setelah dinyatakan pada 15 Mei 2026. Sebanyak 849 orang telah dinyatakan sembuh per 8 Agustus 2026 (laporan situasi Kementerian Kesehatan RD Kongo). Tidak ada vaksin atau pengobatan yang disetujui untuk galur Bundibugyo. Uganda, yang mencatat 20 kasus dan 2 kematian impor dari wabah ini, menyatakan wabahnya sendiri berakhir pada 28 Juli 2026, dengan kasus terkonfirmasi terakhir pada 21 Juni 2026. Kasus terisolasi yang didiagnosis di RD Kongo dirawat di luar negeri: 1 di Prancis, 2 di Jerman. Dinyatakan sebagai Kedaruratan Kesehatan Masyarakat yang Meresahkan Dunia (PHEIC) pada 17 Mei 2026. Sumber: Laporan Situasi Eksternal Mingguan ke-13 WHO AFRO.",
};

async function get(id) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/outbreaks?id=eq.${id}&select=id,disease_en,country_en,cases,deaths,recovered,date,active,source,source_priority`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  if (!r.ok) throw new Error(`GET ${id}: HTTP ${r.status} — ${await r.text()}`);
  const [row] = await r.json();
  if (!row) throw new Error(`Ligne introuvable: ${id}`);
  return row;
}

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
  if (!row) throw new Error(`${label}: 0 ligne mise à jour — rien écrit.`);
  return row;
}

// ── Gardes : on n'écrit que si la base est bien dans l'état diagnostiqué ──────
const before1 = await get(KEEP_ID);
const before2 = await get(DROP_ID);

console.log(`Avant [KEEP ${KEEP_ID}] cases=${before1.cases} deaths=${before1.deaths} recovered=${before1.recovered} date=${before1.date} prio=${before1.source_priority} active=${before1.active}`);
console.log(`       source=${before1.source}`);
console.log(`Avant [DROP ${DROP_ID}] cases=${before2.cases} deaths=${before2.deaths} date=${before2.date} prio=${before2.source_priority} active=${before2.active}`);
console.log(`       source=${before2.source}\n`);

const abort = (msg) => { console.error(`❌ ABORT — ${msg} Rien écrit.`); process.exit(1); };

// La ligne conservée doit porter exactement les chiffres vérifiés ce matin contre AFRO + ECDC.
if (before1.cases !== 4381 || before1.deaths !== 2011 || before1.date !== "2026-08-09")
  abort(`[KEEP] attendu 4381/2011 au 2026-08-09, trouvé ${before1.cases}/${before1.deaths} au ${before1.date} — la ligne a bougé depuis le diagnostic.`);
if (before1.source_priority !== 10)
  abort(`[KEEP] attendu source_priority=10, trouvé ${before1.source_priority} — la ligne a changé de propriétaire.`);
if (!before1.source?.includes("linkedin.com"))
  abort(`[KEEP] la source n'est plus le post LinkedIn (${before1.source}) — quelqu'un l'a déjà re-sourcée.`);
if (before1.recovered !== 810)
  abort(`[KEEP] attendu recovered=810, trouvé ${before1.recovered} — un chiffre plus frais a peut-être été écrit entre-temps.`);

// La ligne à désactiver doit bien être le doublon Africa CDC, encore actif.
if (before2.source_priority !== 5)
  abort(`[DROP] attendu source_priority=5, trouvé ${before2.source_priority}.`);
if (!before2.active)
  abort(`[DROP] déjà inactive — doublon déjà résolu ailleurs, ne rien refaire.`);
if (!before2.source?.includes("africacdc.org"))
  abort(`[DROP] la source n'est plus Africa CDC (${before2.source}).`);
if (before2.disease_en !== before1.disease_en || before2.country_en !== before1.country_en)
  abort(`[DROP] ce n'est pas le même couple maladie/pays que la ligne conservée.`);

// ── Écritures ────────────────────────────────────────────────────────────────
const after1 = await patch(KEEP_ID, "KEEP re-sourçage + guéris + descriptions", keep);
console.log(`✅ [KEEP] cases=${after1.cases} deaths=${after1.deaths} recovered=${after1.recovered} date=${after1.date} active=${after1.active} prio=${after1.source_priority}`);
console.log(`         source=${after1.source}`);

const after2 = await patch(DROP_ID, "DROP désactivation du doublon", {
  active: false,
  updated_at: new Date().toISOString(),
});
console.log(`✅ [DROP] active=${after2.active} (doublon Africa CDC désactivé, ligne conservée en base)`);

// ── Contrôle final : plus qu'une seule ligne Ebola/RDC active ─────────────────
const check = await fetch(
  `${SUPABASE_URL}/rest/v1/outbreaks?disease_en=eq.${encodeURIComponent(before1.disease_en)}&country_en=eq.${encodeURIComponent(before1.country_en)}&active=eq.true&select=id,cases,deaths,date,source`,
  { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
);
const remaining = await check.json();
console.log(`\nContrôle — lignes ${before1.disease_en}/${before1.country_en} actives : ${remaining.length}`);
for (const r of remaining) console.log(`  [${r.id}] ${r.cases}/${r.deaths} au ${r.date} — ${r.source}`);

// Vérifie qu'aucune traduction n'est restée nulle (piège MyMemory documenté dans la routine).
const tr = await fetch(
  `${SUPABASE_URL}/rest/v1/outbreaks?id=eq.${KEEP_ID}&select=description_fr,description_es,description_ar,description_id`,
  { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
);
const [t] = await tr.json();
const missing = Object.entries(t).filter(([, v]) => !v).map(([k]) => k);
console.log(missing.length ? `⚠️ Traductions manquantes: ${missing.join(", ")}` : "Traductions: 4/4 présentes.");
