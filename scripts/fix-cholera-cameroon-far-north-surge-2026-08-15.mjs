// Choléra / Cameroun — run du 2026-08-15
//
// Découverte du jour : un communiqué UNICEF du 12/08 sur la propagation régionale
// du choléra en Afrique de l'Ouest/Centre liste le Cameroun parmi 6 pays à
// épidémie active (sans chiffre). La ligne existe déjà en base (pas un trou de
// couverture — le Cameroun est dans CHOLERA_EXPECTED_NULLS pour le fetcher ArcGIS
// choléra, mais cette ligne est alimentée par une autre source, source_priority=5,
// cron sync-who-regional, dernier passage 04/08) mais elle est très en retard :
//   - En base avant ce fix : 588 cas / 19 décès, arrêtés au 20/07 (bilan
//     Extrême-Nord du 23/07 relayé par china.org.cn le 25/07 : 584/19, cohérent).
//   - Sur le terrain : ~1 000 cas / 28 décès (provisoires) au 10/08, corroboré par
//     deux sources indépendantes (237actu.com et allAfrica.com, toutes deux 10/08,
//     citant les mêmes chiffres "environ 1 000 contaminations et 28 décès").
//   Progression connue : 166/10 (02/07) -> 585/19 (23/07) -> >800/25 (28/07) ->
//   ~1 000/28 (10/08). Toujours la région Extrême-Nord (districts de Fotokol,
//   Mada, Makary, Kolofata) — même cadrage régional que la ligne en base, donc
//   comparaison légitime (pas un piège de cadrage type Rougeole/US).
//
// Aucun bilan MINSANTE officiel chiffré trouvé (la page MINSANTE trouvée en
// cherchant date du 19/06 et ne porte qu'un chiffre national 2021-2023). Les
// chiffres restent donc "environ"/"provisoires" au sens des sources elles-mêmes —
// assumé explicitement dans la description plutôt que présenté comme un compte
// officiel exact.
//
// Décision de David (session interactive du 2026-08-15) : option (a) — relever la
// ligne aux chiffres de presse et verrouiller source_priority=10 pour la sortir du
// cron (qui ne l'aurait pas rattrapée avant longtemps et l'aurait laissée dériver
// silencieusement). Ajoutée à la surveillance de la section 4 bis du SKILL.md
// (hors cluster de seeds, is_seed=false -> re-signalée si updated_at > 7j).
//
// Contre-vérification faite le 15/08 sur les autres pays cités par ce communiqué
// UNICEF (RDC, Nigéria) : la base était déjà à jour ou au-dessus, seul le
// Cameroun ressortait en retard.

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

const ID = "d3af80c2-30be-4878-89b4-9fd8310eb8db";

const description = `Cholera in Cameroon — the outbreak in the Far North region (Fotokol, Mada, Makary and Kolofata health districts) has grown sharply since detection in mid-July 2026: 166 cases / 10 deaths (2 July), 585 cases / 19 deaths (23 July), over 800 cases / 25 deaths (28 July), reaching approximately 1,000 cases and 28 deaths — both figures described as provisional — by 10 August 2026, per two independent Cameroonian press reports (237actu.com, allAfrica.com). No official Ministry of Public Health (MINSANTE) bulletin with an exact case count was found as of this update; the approximate figure is used as-is rather than rounded to a false precision. Source: Cameroonian press (237actu.com, corroborated by allAfrica.com).`;

const description_fr = `Choléra au Cameroun — l'épidémie dans la région de l'Extrême-Nord (districts sanitaires de Fotokol, Mada, Makary et Kolofata) a fortement progressé depuis sa détection mi-juillet 2026 : 166 cas / 10 décès (2 juillet), 585 cas / 19 décès (23 juillet), plus de 800 cas / 25 décès (28 juillet), pour atteindre environ 1 000 cas et 28 décès — les deux chiffres qualifiés de provisoires — au 10 août 2026, selon deux sources de presse camerounaises indépendantes (237actu.com, allAfrica.com). Aucun bulletin officiel chiffré du ministère de la Santé publique (MINSANTE) n'a été trouvé à ce jour ; le chiffre approximatif est repris tel quel plutôt qu'arrondi à une fausse précision. Source : presse camerounaise (237actu.com, corroborée par allAfrica.com).`;

const description_es = `Cólera en Camerún — el brote en la región del Extremo Norte (distritos sanitarios de Fotokol, Mada, Makary y Kolofata) ha crecido con fuerza desde su detección a mediados de julio de 2026: 166 casos / 10 muertes (2 de julio), 585 casos / 19 muertes (23 de julio), más de 800 casos / 25 muertes (28 de julio), hasta alcanzar aproximadamente 1.000 casos y 28 muertes —ambas cifras calificadas de provisionales— el 10 de agosto de 2026, según dos fuentes de prensa camerunesas independientes (237actu.com, allAfrica.com). No se ha encontrado ningún boletín oficial con cifras exactas del Ministerio de Salud Pública (MINSANTE) hasta la fecha; la cifra aproximada se mantiene tal cual en lugar de redondearla a una falsa precisión. Fuente: prensa camerunesa (237actu.com, corroborada por allAfrica.com).`;

const description_ar = `الكوليرا في الكاميرون — تفاقم تفشي المرض في منطقة أقصى الشمال (المناطق الصحية فوتوكول ومادا وماكاري وكولوفاتا) بشدة منذ اكتشافه في منتصف يوليو 2026: 166 حالة و10 وفيات (2 يوليو)، 585 حالة و19 وفاة (23 يوليو)، أكثر من 800 حالة و25 وفاة (28 يوليو)، ليصل إلى نحو 1000 حالة و28 وفاة — وكلا الرقمين مؤقت — بحلول 10 أغسطس 2026، وفقاً لمصدرين صحفيين كاميرونيين مستقلين (237actu.com وallAfrica.com). لم يُعثر على أي بيان رسمي بأرقام دقيقة من وزارة الصحة العامة حتى تاريخه؛ ويُستخدم الرقم التقريبي كما هو دون تقريبه إلى دقة زائفة. المصدر: الصحافة الكاميرونية (237actu.com، بتأكيد من allAfrica.com).`;

const description_id = `Kolera di Kamerun — wabah di wilayah Far North (distrik kesehatan Fotokol, Mada, Makary, dan Kolofata) meningkat tajam sejak terdeteksi pertengahan Juli 2026: 166 kasus / 10 kematian (2 Juli), 585 kasus / 19 kematian (23 Juli), lebih dari 800 kasus / 25 kematian (28 Juli), mencapai sekitar 1.000 kasus dan 28 kematian — kedua angka masih bersifat sementara — pada 10 Agustus 2026, menurut dua laporan media Kamerun yang independen (237actu.com, allAfrica.com). Belum ditemukan buletin resmi dari Kementerian Kesehatan Masyarakat (MINSANTE) dengan angka pasti hingga pembaruan ini; angka perkiraan digunakan apa adanya, bukan dibulatkan menjadi presisi semu. Sumber: media Kamerun (237actu.com, dikonfirmasi oleh allAfrica.com).`;

const patch = {
  cases: 1000,
  deaths: 28,
  date: "2026-08-10",
  source: "https://237actu.com/extreme-nord-une-epidemie-de-cholera-fait-28-morts-la-riposte-sorganise/",
  source_priority: 10, // verrouillée : décision David 15/08, la ligne était en retard de ~40% sous cron
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
console.log(`  source_priority=${row.source_priority}  active=${row.active}`);
for (const k of ["description", "description_fr", "description_es", "description_ar", "description_id"]) {
  const v = row[k];
  console.log(`  ${k}: ${v ? `${v.length} car.` : "!! NULL !!"}${v && v.includes("1,000") || v && v.includes("1 000") || v && v.includes("1.000") ? " ✓1000" : v ? " !! 1000 absent" : ""}`);
}
