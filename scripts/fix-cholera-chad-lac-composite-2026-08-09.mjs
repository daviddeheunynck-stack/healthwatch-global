// Choléra / Tchad — bascule sur David du 09/08 : cases devient un composite
// 239 (total national officiel SITREP n°029, 02-03/08) + 46 (Lac, déclaré 08/08) = 285.
// deaths/recovered inchangés (aucun décès annoncé au Lac, aucun chiffre de guérison publié
// pour ce foyer — additionner un guéri inconnu serait deviner).
//
// Suite de scripts/fix-cholera-chad-lac-province-2026-08-09.mjs (mêmes 5 descriptions,
// qui disaient jusqu'ici "ces 46 cas ne sont pas encore inclus dans le total national").
// On remplace cette dernière phrase par une clarification : le chiffre affiché ici (285)
// est désormais un composite volontaire, distinct du SITREP officiel (239) qui n'a pas
// encore absorbé le Lac.

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

const OLD_TAIL = {
  en: "Those 46 cases are not yet included in the national total above, whose cut-off predates the declaration.",
  fr: "Ces 46 cas ne sont pas encore inclus dans le total national ci-dessus, dont l'arrêté est antérieur à cette déclaration.",
  es: "Esos 46 casos aún no están incluidos en el total nacional anterior, cuya fecha de corte es previa a la declaración.",
  ar: "ولم تُدرج هذه الحالات الـ46 بعد في الإجمالي الوطني المذكور أعلاه، إذ يسبق تاريخ إقفال بياناته هذا الإعلان.",
  id: "Ke-46 kasus tersebut belum termasuk dalam total nasional di atas, yang tanggal batas datanya mendahului pengumuman ini.",
};

const NEW_TAIL = {
  en: "Those 46 cases are not yet part of the Ministry's official SITREP count (239, cut-off 2-3 August, which predates the declaration); the case count shown here (285) is a composite of the two figures, pending a national SITREP that absorbs the Lac focus.",
  fr: "Ces 46 cas ne sont pas encore intégrés au décompte officiel du SITREP ministériel (239, arrêté au 2-3 août, antérieur à cette déclaration) ; le nombre de cas affiché ici (285) est un composite des deux chiffres, en attendant un SITREP national qui absorbe le foyer du Lac.",
  es: "Esos 46 casos aún no forman parte del recuento oficial del SITREP ministerial (239, con fecha de corte del 2-3 de agosto, anterior a la declaración); el número de casos mostrado aquí (285) es un compuesto de ambas cifras, a la espera de un SITREP nacional que incorpore el foco del Lac.",
  ar: "ولم تُدرج هذه الحالات الـ46 بعد في الإحصاء الرسمي لتقرير SITREP الوزاري (239 حالة، بتاريخ إقفال 2-3 أغسطس، أي قبل هذا الإعلان)؛ وعدد الحالات المعروض هنا (285) هو مُركّب من الرقمين، في انتظار تقرير SITREP وطني يستوعب بؤرة مقاطعة البحيرة.",
  id: "Ke-46 kasus tersebut belum termasuk dalam hitungan resmi SITREP Kementerian (239, batas data 2-3 Agustus, yang mendahului pengumuman ini); jumlah kasus yang ditampilkan di sini (285) merupakan gabungan dari kedua angka tersebut, menunggu SITREP nasional yang mencakup fokus wabah Lac.",
};

const COLS = { en: "description", fr: "description_fr", es: "description_es", ar: "description_ar", id: "description_id" };

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const res = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks?id=eq.${ID}&select=*`, { headers });
const [row] = await res.json();
if (!row) throw new Error("Ligne introuvable");

if (row.cases !== 239 || row.deaths !== 13) {
  throw new Error(`Chiffres inattendus (${row.cases}/${row.deaths}) — vérifier avant d'écrire.`);
}

const patch = { cases: 285 };
for (const [lang, col] of Object.entries(COLS)) {
  const current = row[col];
  if (typeof current !== "string" || !current.length) throw new Error(`${col} vide`);
  if (current.includes(NEW_TAIL[lang])) {
    console.log(`${col} : déjà à jour, ignoré`);
    continue;
  }
  if (!current.includes(OLD_TAIL[lang])) throw new Error(`${col} : ancienne phrase introuvable — ne pas deviner.`);
  patch[col] = current.replace(OLD_TAIL[lang], NEW_TAIL[lang]);
}

const upd = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks?id=eq.${ID}`, {
  method: "PATCH",
  headers,
  body: JSON.stringify(patch),
});
if (!upd.ok) throw new Error(`PATCH échoué: ${upd.status} ${await upd.text()}`);
const [after] = await upd.json();

for (const col of Object.values(COLS)) {
  if (!after[col]) throw new Error(`${col} est null après écriture !`);
}
console.log("OK.");
console.log(`cases=${after.cases} deaths=${after.deaths} recovered=${after.recovered} date=${after.date}`);
console.log("\n--- description (EN), fin ---\n..." + after.description.slice(-400));
