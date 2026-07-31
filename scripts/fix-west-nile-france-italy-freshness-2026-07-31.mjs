// 2026-07-31 — linkedin-hwg-content-proposal, demande explicite de David
// ("soyons sûr que les données sur HWG soient bien à jour avant de publier").
//
// Deux lignes West Nile trouvées périmées en préparant le post MWF du 31/07 :
//
// 1. France (id 906bf26a…) : encore à 1 cas / bulletin SPF du 23/07 (données au
//    20/07), alors qu'un bulletin SPF plus récent (29/07, données au 27/07,
//    slug "...-et-18") rapporte DEUX cas autochtones : Pyrénées-Orientales
//    (déjà connu) + Bouches-du-Rhône (nouveau). Vérifié par WebFetch direct sur
//    la page SPF (FR et EN), littéralement : « Au 27 juillet 2026, deux cas
//    autochtones d'infection à virus West Nile ont été identifiés dans les
//    départements des Pyrénées-Orientales (Occitanie) et des Bouches-du-Rhône
//    (Provence-Alpes-Côte d'Azur). » Aucun décès mentionné, deaths laissé à 0
//    comme avant (rien ne le contredit).
//    ⚠️ Cette ligne a `source_priority=10` (verrouillée), donc le cron
//    sync-spf ne peut structurellement jamais la rafraîchir automatiquement
//    (garde `.lte("source_priority", 5)` dans app/api/cron/sync-spf/route.ts).
//    Même classe de piège que Ebola/RDC (voir mémoire
//    project_ebola_drc_priority10_frozen_no_autofeed_2026_07_16). Un script
//    manuel exécuté CE MATIN (fix-cholera-chad-ndjamena-wnv-2026-07-31.mjs)
//    a même re-écrit cette ligne en la laissant sur le bulletin du 23/07,
//    déjà périmé de 6 jours à ce moment-là — signalé à David séparément.
//    source_priority laissé à 10 ici (pas de nouvelle politique décidée),
//    seule la donnée est corrigée.
//
// 2. Italie (id d0dcfdbd…) : à 46 cas (ECDC, données au 22/07, source_priority
//    5), alors que l'ISS (institut national italien) publie un bulletin bien
//    plus frais et plus granulaire : 84 cas confirmés au 28/07/2026, dont 37
//    neuro-invasifs, 27 fièvre, 1 symptomatique, 19 asymptomatiques identifiés
//    chez des donneurs de sang, et 2 décès (dont 1 cas importé). PDF
//    téléchargé et parsé en session (pdf-parse), texte « In Evidenza » relu
//    mot pour mot, arithmétique recalculée (37+27+1+19=84 ✅).
//    source_priority laissé à 5 (pas 10) : contrairement au cas Ebola/RDC, il
//    n'existe aucun cron automatisé pour les rapports ECDC/ISS West Nile de
//    toute façon (backfill du 29/07 était un script manuel unique) — verrouiller
//    à 10 n'apporterait donc aucune protection réelle et reproduirait le même
//    piège de gel que celui documenté pour Ebola/RDC.
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
      `date=${row.date} risk=${row.risk_level} prio=${row.source_priority} src=${row.source}`
  );
  for (const k of ["description", "description_fr", "description_es", "description_ar", "description_id"]) {
    if (row[k] == null) throw new Error(`ALERTE: ${k} est null après écriture`);
  }
  console.log("   5 descriptions non-null OK");
}

// ------------------------------------------------------------ West Nile / France
const FRANCE_SRC =
  "https://www.santepubliquefrance.fr/maladies-a-transmission-vectorielle/chikungunya/bulletin-national/chikungunya-dengue-zika-et-18";

await patch("906bf26a-8867-4a9c-ad7c-976e4e2c5bab", {
  cases: 2,
  deaths: 0,
  date: "2026-07-27",
  source: FRANCE_SRC,
  description:
    "Two autochthonous human cases of West Nile virus infection identified in France in 2026, as at 27 July 2026: one in the Pyrénées-Orientales department (Occitanie region, the first detection of local virus circulation in humans in France this year) and one in the Bouches-du-Rhône department (Provence-Alpes-Côte d'Azur region). No deaths reported. Source: Santé publique France, national arbovirus (chikungunya/dengue/Zika/West Nile) enhanced surveillance bulletin of 29 July 2026, data as at 27 July 2026.",
  description_fr:
    "Deux cas autochtones d'infection à virus West Nile chez l'homme en France en 2026, au 27 juillet 2026 : un dans le département des Pyrénées-Orientales (région Occitanie, première détection de la circulation du virus chez l'homme en France cette année) et un dans le département des Bouches-du-Rhône (région Provence-Alpes-Côte d'Azur). Aucun décès rapporté. Source : Santé publique France, bulletin de surveillance renforcée des arboviroses (chikungunya, dengue, Zika, West Nile) du 29 juillet 2026, données arrêtées au 27 juillet 2026.",
  description_es:
    "Dos casos humanos autóctonos de infección por el virus del Nilo Occidental identificados en Francia en 2026, a 27 de julio de 2026: uno en el departamento de los Pirineos Orientales (región de Occitania, la primera detección de circulación local del virus en humanos en Francia este año) y otro en el departamento de Bouches-du-Rhône (región de Provenza-Alpes-Costa Azul). No se han notificado fallecidos. Fuente: Santé publique France, boletín nacional de vigilancia reforzada de arbovirosis (chikungunya/dengue/Zika/Nilo Occidental) del 29 de julio de 2026, datos a 27 de julio de 2026.",
  description_ar:
    "حالتان بشريتان أصليتان للإصابة بفيروس غرب النيل في فرنسا في عام 2026، حتى 27 يوليو 2026: واحدة في محافظة البرانس الشرقية (منطقة أوكسيتانيا، وهي أول رصد لتداول الفيروس محليًا بين البشر في فرنسا هذا العام) وأخرى في محافظة بوش دو رون (منطقة بروفانس ألب كوت دازور). ولم يُبلَّغ عن أي وفيات. المصدر: الوكالة الفرنسية للصحة العامة، نشرة المراقبة المعززة للأمراض المنقولة بالمفصليات (شيكونغونيا/حمى الضنك/زيكا/غرب النيل) الصادرة في 29 يوليو 2026، ببيانات حتى 27 يوليو 2026.",
  description_id:
    "Dua kasus autokton infeksi virus West Nile pada manusia di Prancis pada 2026, per 27 Juli 2026: satu di departemen Pyrénées-Orientales (wilayah Occitanie, deteksi pertama sirkulasi virus secara lokal pada manusia di Prancis tahun ini) dan satu di departemen Bouches-du-Rhône (wilayah Provence-Alpes-Côte d'Azur). Tidak ada kematian yang dilaporkan. Sumber: Santé publique France, buletin surveilans arbovirus nasional (chikungunya/dengue/Zika/West Nile) tanggal 29 Juli 2026, data per 27 Juli 2026.",
});

// ------------------------------------------------------------ West Nile / Italie
const ITALY_SRC = "https://www.epicentro.iss.it/westnile/bollettino/Bollettino_WND_2026_1.pdf";

await patch("d0dcfdbd-b656-4d4f-91a9-ddd271025af8", {
  cases: 84,
  deaths: 2,
  date: "2026-07-28",
  source: ITALY_SRC,
  description:
    "West Nile virus, 2026 transmission season: Italy's national institute (ISS) has confirmed 84 human cases as at 28 July 2026, across 47 provinces with demonstrated virus circulation in vectors, animals or humans. Cases break down by detection route: 37 neuroinvasive (severe: encephalitis, meningitis, acute flaccid paralysis), 27 fever, 1 otherwise symptomatic, and 19 asymptomatic infections identified in blood donors. Two deaths have been reported, one of them in an imported case. One case was imported from the Maldives. Source: Istituto Superiore di Sanità, surveillance report on human West Nile and Usutu virus cases in Italy, 2026 season, updated 28 July 2026.",
  description_fr:
    "Virus du Nil occidental, saison de transmission 2026 : l'institut national italien (ISS) a confirmé 84 cas humains au 28 juillet 2026, dans 47 provinces où la circulation du virus est démontrée chez les vecteurs, les animaux ou l'homme. Répartition par voie de détection : 37 cas neuro-invasifs (forme sévère : encéphalite, méningite, paralysie flasque aiguë), 27 cas de fièvre, 1 cas symptomatique, et 19 infections asymptomatiques identifiées chez des donneurs de sang. Deux décès ont été rapportés, dont un dans un cas importé. Un cas a été importé des Maldives. Source : Istituto Superiore di Sanità, rapport de surveillance des cas humains de virus West Nile et Usutu en Italie, saison 2026, mis à jour le 28 juillet 2026.",
  description_es:
    "Virus del Nilo Occidental, temporada de transmisión 2026: el instituto nacional italiano (ISS) ha confirmado 84 casos humanos al 28 de julio de 2026, en 47 provincias con circulación demostrada del virus en vectores, animales o humanos. Desglose por vía de detección: 37 casos neuroinvasivos (forma grave: encefalitis, meningitis, parálisis flácida aguda), 27 casos de fiebre, 1 caso sintomático, y 19 infecciones asintomáticas identificadas en donantes de sangre. Se han notificado dos muertes, una de ellas en un caso importado. Un caso fue importado de las Maldivas. Fuente: Istituto Superiore di Sanità, informe de vigilancia de casos humanos de virus West Nile y Usutu en Italia, temporada 2026, actualizado el 28 de julio de 2026.",
  description_ar:
    "فيروس غرب النيل، موسم الانتقال 2026: أكد المعهد الوطني الإيطالي (ISS) 84 حالة بشرية حتى 28 يوليو 2026، في 47 مقاطعة تم فيها إثبات انتشار الفيروس لدى النواقل أو الحيوانات أو البشر. توزيع الحالات حسب طريقة الاكتشاف: 37 حالة عصبية غازية (الشكل الشديد: التهاب الدماغ، التهاب السحايا، الشلل الرخو الحاد)، 27 حالة حمى، حالة واحدة مصحوبة بأعراض أخرى، و19 إصابة بلا أعراض تم تحديدها لدى متبرعين بالدم. وسُجّلت وفاتان، إحداهما في حالة مستوردة. واستُوردت حالة واحدة من جزر المالديف. المصدر: المعهد العالي الإيطالي للصحة (ISS)، تقرير مراقبة حالات فيروس غرب النيل وأوسوتو لدى البشر في إيطاليا، موسم 2026، محدّث في 28 يوليو 2026.",
  description_id:
    "Virus West Nile, musim penularan 2026: institut kesehatan nasional Italia (ISS) telah mengonfirmasi 84 kasus manusia per 28 Juli 2026, di 47 provinsi dengan sirkulasi virus yang terbukti pada vektor, hewan, atau manusia. Rincian kasus berdasarkan jalur deteksi: 37 kasus neuroinvasif (bentuk parah: ensefalitis, meningitis, kelumpuhan lembek akut), 27 kasus demam, 1 kasus simtomatik lainnya, dan 19 infeksi asimtomatik yang teridentifikasi pada pendonor darah. Dua kematian telah dilaporkan, salah satunya pada kasus impor. Satu kasus diimpor dari Maladewa. Sumber: Istituto Superiore di Sanità, laporan surveilans kasus manusia virus West Nile dan Usutu di Italia, musim 2026, diperbarui 28 Juli 2026.",
});

console.log("\nTerminé.");
