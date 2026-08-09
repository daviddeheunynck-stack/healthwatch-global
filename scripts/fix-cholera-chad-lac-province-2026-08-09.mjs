// Choléra / Tchad — ajout de la 3e province touchée (Lac), déclarée le 08/08/2026.
//
// Contexte : le rapport de situation n°029 du MSPP (arrêté 02-03/08, 239 cas / 13 décès)
// ne couvre que Hadjer-Lamis (Karal) et N'Djamena. Le 08/08/2026, le délégué général du
// gouvernement a officiellement déclaré une épidémie de choléra dans la province du Lac
// (46 cas depuis le 02/08). Ces cas ne sont PAS inclus dans le total national de 239.
//
// Décision : on NE touche PAS cases/deaths/recovered/date/source — le total officiel
// consolidé reste la base (revérifié ce jour, inchangé), et fabriquer une somme maison
// 239+46=285 mélangerait deux dates d'arrêté. Seules les descriptions sont mises à jour
// pour dire que trois provinces sont désormais touchées et que les 46 cas du Lac ne sont
// pas encore dans le total national. Arbitrage `cases` composite laissé à David.
//
// Sources (2 médias tchadiens indépendants, vérifiées via Browser pane le 09/08 —
// tchadinfos et lepaystchad renvoient 403 sur WebFetch) :
//  - https://www.lepaystchad.com/province-du-lac-46-cas-de-cholera-recenses/  (08/08/2026)
//  - https://tchadinfos.com/2026/08/08/le-cholera-declare-dans-la-province-du-lac/ (08/08/2026)

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

const OLD = {
  en: "Two provinces are affected.",
  fr: "Deux provinces sont touchées.",
  es: "Dos provincias están afectadas.",
  ar: "وتتأثر مقاطعتان.",
  id: "Dua provinsi terdampak.",
};

const NEW = {
  en: "Three provinces are affected.",
  fr: "Trois provinces sont touchées.",
  es: "Tres provincias están afectadas.",
  ar: "وتتأثر ثلاث مقاطعات.",
  id: "Tiga provinsi terdampak.",
};

const TAIL = {
  en: " On 8 August 2026 the government's general delegate officially declared a cholera epidemic in a third province, Lac, where 46 cases have been recorded since 2 August, some confirmed by the national reference laboratory in N'Djamena and two of them at Kangalam-Ouest; three active foci have been identified in island areas and at Ngorerom, in the Bol sub-prefecture. Those 46 cases are not yet included in the national total above, whose cut-off predates the declaration.",
  fr: " Le 8 août 2026, le délégué général du gouvernement a officiellement déclaré une épidémie de choléra dans une troisième province, le Lac, où 46 cas ont été enregistrés depuis le 2 août, certains confirmés par le laboratoire national de référence de N'Djamena et deux d'entre eux à Kangalam-Ouest ; trois foyers actifs ont été identifiés en zones insulaires et à Ngorerom, dans la sous-préfecture de Bol. Ces 46 cas ne sont pas encore inclus dans le total national ci-dessus, dont l'arrêté est antérieur à cette déclaration.",
  es: " El 8 de agosto de 2026, el delegado general del gobierno declaró oficialmente una epidemia de cólera en una tercera provincia, Lac, donde se han registrado 46 casos desde el 2 de agosto, algunos confirmados por el laboratorio nacional de referencia de Yamena y dos de ellos en Kangalam-Ouest; se han identificado tres focos activos en zonas insulares y en Ngorerom, en la subprefectura de Bol. Esos 46 casos aún no están incluidos en el total nacional anterior, cuya fecha de corte es previa a la declaración.",
  ar: " وفي 8 أغسطس 2026، أعلن المندوب العام للحكومة رسمياً تفشي الكوليرا في مقاطعة ثالثة هي مقاطعة البحيرة (Lac)، حيث سُجلت 46 حالة منذ 2 أغسطس، أكّد المختبر الوطني المرجعي في نجامينا بعضها، ومنها حالتان في كنغلام الغربية؛ وحُددت ثلاث بؤر نشطة في مناطق جزرية وفي نغوريروم بمحافظة بول الفرعية. ولم تُدرج هذه الحالات الـ46 بعد في الإجمالي الوطني المذكور أعلاه، إذ يسبق تاريخ إقفال بياناته هذا الإعلان.",
  id: " Pada 8 Agustus 2026, delegasi jenderal pemerintah secara resmi mengumumkan wabah kolera di provinsi ketiga, Lac, dengan 46 kasus tercatat sejak 2 Agustus, sebagian dikonfirmasi oleh laboratorium rujukan nasional di N'Djamena dan dua di antaranya di Kangalam-Ouest; tiga fokus aktif teridentifikasi di wilayah kepulauan dan di Ngorerom, subprefektur Bol. Ke-46 kasus tersebut belum termasuk dalam total nasional di atas, yang tanggal batas datanya mendahului pengumuman ini.",
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

// Garde-fou : ne rien écrire si les chiffres ont bougé depuis la vérification.
if (row.cases !== 239 || row.deaths !== 13) {
  throw new Error(`Chiffres inattendus (${row.cases}/${row.deaths}) — vérifier avant d'écrire.`);
}

const patch = {};
for (const [lang, col] of Object.entries(COLS)) {
  const current = row[col];
  if (typeof current !== "string" || !current.length) throw new Error(`${col} vide`);
  if (current.includes(NEW[lang]) || current.includes("Kangalam")) {
    console.log(`${col} : déjà à jour, ignoré`);
    continue;
  }
  if (!current.includes(OLD[lang])) throw new Error(`${col} : gabarit "${OLD[lang]}" introuvable — ne pas deviner.`);
  patch[col] = current.replace(OLD[lang], NEW[lang]).trimEnd() + TAIL[lang];
}

if (!Object.keys(patch).length) {
  console.log("Rien à écrire.");
  process.exit(0);
}

const upd = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks?id=eq.${ID}`, {
  method: "PATCH",
  headers,
  body: JSON.stringify(patch),
});
if (!upd.ok) throw new Error(`PATCH échoué: ${upd.status} ${await upd.text()}`);
const [after] = await upd.json();

// Vérifier qu'aucune traduction n'est retombée à null (piège connu).
for (const col of Object.values(COLS)) {
  if (!after[col]) throw new Error(`${col} est null après écriture !`);
}
console.log("OK — 5 descriptions mises à jour.");
console.log(`cases=${after.cases} deaths=${after.deaths} date=${after.date} (inchangés)`);
console.log("\n--- description (EN) ---\n" + after.description);
