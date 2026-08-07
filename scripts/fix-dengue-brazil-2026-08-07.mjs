// Vérification hebdomadaire manuelle (section 5) du 2026-08-07 — Dengue/Brésil (5ffa5759).
//
// Dashboard PowerBI illisible par extraction de texte (canvas/WebGL) — capture d'écran fournie
// par David des tuiles KPI en haut du Painel de Monitoramento das Arboviroses (gov.br) :
//   Casos prováveis 425 437 | Óbitos em investigação 174 | Óbitos por Dengue 276
//   Coeficiente de incidência 199,3 | Letalidade em casos prováveis 0,06 | Letalidade em casos graves 2,87
//
// Ancienne valeur en base (lue le 28/07/2026) : 424 971 cas / 275 décès / 176 en investigation / incidence 199,1.
// Écart : +466 cas (+0,1%) / +1 décès / -2 en investigation (basculés en confirmés) / incidence +0,2 —
// progression cohérente sur ~10 jours, pas de saut suspect vers un cumul multi-années
// (WebSearch de corroboration externe n'a rien donné de plus précis que des points antérieurs de la
// saison — projection saisonnière ~1,8M, très au-dessus, donc pas de confusion possible avec un cumul
// pluriannuel). Corroboration interne acceptée (règle section 5, fallback WebSearch infructueux).

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

const BRAZIL_ID = "5ffa5759-37c6-438f-b7dc-ddaa1bbddd77";

const brazil = {
  cases: 425437,
  deaths: 276,
  date: "2026-08-07",
  updated_at: new Date().toISOString(),

  description:
    "Dengue — Brésil. Chiffre officiel national du Painel de Arboviroses (Ministério da Saúde) au 2026-08-07 : 425 437 cas probables, 276 décès confirmés, 174 en investigation, incidence 199,3/100k. Ligne maintenue manuellement (dashboard gov.br illisible par extraction de texte, lu par capture d'écran) ; ne pas auto-écraser.",

  description_fr:
    "Dengue au Brésil, cumul national pour l'année épidémiologique 2026 : 425 437 cas probables, 276 décès confirmés (plus 174 décès encore en cours d'investigation), létalité de 0,06 % parmi les cas probables (2,87 % parmi les cas graves). Incidence de 199,3 pour 100 000 habitants. Source : Panel de surveillance des arboviroses du Ministère de la Santé brésilien.",

  description_es:
    "Dengue en Brasil, acumulado nacional para el año epidemiológico 2026: 425.437 casos probables, 276 muertes confirmadas (más 174 muertes aún en investigación), letalidad del 0,06% entre los casos probables (2,87% entre los casos graves). Incidencia de 199,3 por 100.000 habitantes. Fuente: Panel de Monitoreo de Arbovirosis del Ministerio de Salud de Brasil.",

  description_ar:
    "حمى الضنك في البرازيل، الإجمالي الوطني للعام الوبائي 2026: 425,437 حالة محتملة، 276 حالة وفاة مؤكدة (بالإضافة إلى 174 حالة وفاة قيد التحقيق)، معدل الوفيات 0.06% بين الحالات المحتملة (2.87% بين الحالات الشديدة). معدل الإصابة 199.3 لكل 100,000 نسمة. المصدر: لوحة مراقبة الأمراض الفيروسية المنقولة بالمفصليات التابعة لوزارة الصحة البرازيلية.",

  description_id:
    "Demam berdarah dengue di Brasil, akumulasi nasional untuk tahun epidemiologi 2026: 425.437 kasus probable, 276 kematian terkonfirmasi (ditambah 174 kematian masih dalam investigasi), tingkat fatalitas kasus 0,06% di antara kasus probable (2,87% di antara kasus berat). Insidensi 199,3 per 100.000 penduduk. Sumber: Panel Pemantauan Arbovirus Kementerian Kesehatan Brasil.",
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
  console.log(`   cases=${row.cases} deaths=${row.deaths} date=${row.date}`);
  const missing = ["description", "description_fr", "description_es", "description_ar", "description_id"]
    .filter((k) => !row[k]);
  console.log(missing.length ? `   /!\\ descriptions manquantes: ${missing.join(", ")}` : `   5/5 descriptions écrites`);
  return row;
}

await patch(BRAZIL_ID, "Dengue / Brésil", brazil);
