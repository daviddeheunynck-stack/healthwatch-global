// Dengue / Brésil — run du 2026-08-15
//
// Vérification hebdo manuelle (section 5 du SKILL.md) : le dashboard PowerBI
// gov.br reste illisible par extraction de texte (iframe cross-origin), David a
// fourni une capture d'écran des tuiles KPI en session.
//
// Tuiles lues : Casos prováveis 432 617 | Óbitos por Dengue 296 |
// Óbitos em investigação 141 | Coeficiente de incidência 202,7 |
// Letalidade em casos prováveis 0,07 | Letalidade em casos graves 2,87.
//
// Corroboration interne (pas de WebSearch fiable trouvé pour un chiffre national
// aussi récent, cf. section 5 du SKILL.md) : 296/432617 = 0,0684 % -> arrondi à
// 0,07 %, cohérent avec la tuile "Letalidade em casos prováveis". Même contrôle
// que la ligne précédente (276/425437 = 0,0649 % -> 0,06 %, déjà en base).
//
// Ancien état : 425 437 cas / 276 décès, arrêté au 07/08. Nouveaux chiffres au-
// dessus sur les deux axes (cas +7 180, décès +20 sur 8 jours) — progression
// plausible, pas de régression suspecte à signaler.
//
// `date` = jour de cette capture (2026-08-15) : le dashboard ne montre pas de
// date d'arrêté explicite au niveau des tuiles (contrairement au tableau du bas),
// même convention que l'entrée précédente (date = jour de vérification).

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

const ID = "5ffa5759-37c6-438f-b7dc-ddaa1bbddd77";

const description = `Dengue — Brésil. Chiffre officiel national du Painel de Arboviroses (Ministério da Saúde) au 2026-08-15 : 432 617 cas probables, 296 décès confirmés, 141 en investigation, incidence 202,7/100k. Ligne maintenue manuellement (dashboard gov.br illisible par extraction de texte, lu par capture d'écran) ; ne pas auto-écraser.`;

const description_fr = `Dengue au Brésil, cumul national pour l'année épidémiologique 2026 : 432 617 cas probables, 296 décès confirmés (plus 141 décès encore en cours d'investigation), létalité de 0,07 % parmi les cas probables (2,87 % parmi les cas graves). Incidence de 202,7 pour 100 000 habitants. Source : Panel de surveillance des arboviroses du Ministère de la Santé brésilien.`;

const description_es = `Dengue en Brasil, acumulado nacional para el año epidemiológico 2026: 432.617 casos probables, 296 muertes confirmadas (más 141 muertes aún en investigación), letalidad del 0,07% entre los casos probables (2,87% entre los casos graves). Incidencia de 202,7 por 100.000 habitantes. Fuente: Panel de Monitoreo de Arbovirosis del Ministerio de Salud de Brasil.`;

const description_ar = `حمى الضنك في البرازيل، الإجمالي الوطني للعام الوبائي 2026: 432,617 حالة محتملة، 296 حالة وفاة مؤكدة (بالإضافة إلى 141 حالة وفاة قيد التحقيق)، معدل الوفيات 0.07% بين الحالات المحتملة (2.87% بين الحالات الشديدة). معدل الإصابة 202.7 لكل 100,000 نسمة. المصدر: لوحة مراقبة الأمراض الفيروسية المنقولة بالمفصليات التابعة لوزارة الصحة البرازيلية.`;

const description_id = `Demam berdarah dengue di Brasil, akumulasi nasional untuk tahun epidemiologi 2026: 432.617 kasus probable, 296 kematian terkonfirmasi (ditambah 141 kematian masih dalam investigasi), tingkat fatalitas kasus 0,07% di antara kasus probable (2,87% di antara kasus berat). Insidensi 202,7 per 100.000 penduduk. Sumber: Panel Pemantauan Arbovirus Kementerian Kesehatan Brasil.`;

const patch = {
  cases: 432617,
  deaths: 296,
  date: "2026-08-15",
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
console.log(`  cases=${row.cases}  deaths=${row.deaths}  date=${row.date}`);
for (const k of ["description", "description_fr", "description_es", "description_ar", "description_id"]) {
  const v = row[k];
  console.log(`  ${k}: ${v ? `${v.length} car.` : "!! NULL !!"}${v && v.includes("432") ? " ✓432" : v ? " !! 432 absent" : ""}`);
}
