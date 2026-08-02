// fix-ebola-germany-resolved-2026-08-02.mjs
//
// Contexte (routine morning-don-check du 2026-08-02, section 4 « auto-contradiction »
// + « périmé déguisé en actif ») :
//
// La ligne Ebola/Allemagne (2 cas importés, active=true, date=2026-07-13) était encore
// affichée comme foyer actif alors que :
//   1. les deux patients sont sortis guéris — le 1er (citoyen américain évacué en mai,
//      Charité Berlin) le 06/06/2026, le 2nd (travailleur humanitaire évacué le 13/07,
//      CHU de Francfort) le 28/07/2026, tous deux rétablis, 0 décès ;
//   2. il n'y a jamais eu de transmission locale en Allemagne (deux évacuations
//      sanitaires depuis la RDC) ;
//   3. le DON614 de l'OMS (publié 01/08/2026) compte explicitement ces deux cas DANS
//      le total RDC : « 3605 in the Democratic Republic of the Congo (including two
//      cases diagnosed in the Democratic Republic of the Congo and subsequently
//      treated in Germany) » — les garder actifs les comptait donc deux fois côté produit.
//
// Sa propre description disait « outcome not reported for either patient » : elle n'a
// jamais été rafraîchie parce qu'AUCUN cron ne la maintient. `sync-ecdc-threats` exclut
// délibérément les pays européens cités seulement dans le corps de la page RDC/Ouganda
// (cf. commentaire « two cases were exported to Germany », route.ts ~l.390-396), donc la
// ligne est orpheline depuis sa création — updated_at figé au 23/07 pendant que la ligne
// RDC, elle, était rafraîchie le 01/08.
//
// Traitement identique à celui déjà appliqué à la ligne Ebola/France (1 cas importé,
// désactivée le 27/07 à la guérison du patient).
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

const ID = "5f87a5bb-93f9-4c6b-a1f6-b731936df1c3";

const patch = {
  active: false,
  date: "2026-07-28", // dernière sortie d'hôpital (Francfort)
  recovered: 2,
  cases: 2,
  deaths: 0,
  response_phase: "contained", // valeurs autorisées : monitoring | investigating | active_response | contained
  source: "https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON614",
  description:
    "Two Ebola cases (Bundibugyo strain) were imported into Germany from the DR Congo outbreak; both were US citizens medically evacuated from the DRC, and neither was infected in Germany. The first, treated at the Charité (Berlin), was discharged on 6 June 2026; the second, evacuated on 13 July and treated at Frankfurt University Hospital, was discharged fully recovered on 28 July 2026. No deaths and no local transmission. WHO DON614 counts both within the DRC total. Event closed.",
  description_fr:
    "Deux cas d'Ebola (souche Bundibugyo) ont été importés en Allemagne depuis l'épidémie en RD Congo ; il s'agissait de deux citoyens américains évacués médicalement de RDC, aucun n'a été infecté en Allemagne. Le premier, soigné à la Charité (Berlin), est sorti de l'hôpital le 6 juin 2026 ; le second, évacué le 13 juillet et soigné au CHU de Francfort, est sorti guéri le 28 juillet 2026. Aucun décès, aucune transmission locale. Le DON614 de l'OMS les comptabilise dans le total de la RDC. Événement clos.",
  description_es:
    "Se importaron a Alemania dos casos de ébola (cepa Bundibugyo) procedentes del brote de la RD del Congo; ambos eran ciudadanos estadounidenses evacuados médicamente desde la RDC, y ninguno se infectó en Alemania. El primero, atendido en el Charité (Berlín), recibió el alta el 6 de junio de 2026; el segundo, evacuado el 13 de julio y atendido en el Hospital Universitario de Fráncfort, recibió el alta totalmente recuperado el 28 de julio de 2026. Sin fallecidos ni transmisión local. El DON614 de la OMS los contabiliza dentro del total de la RDC. Evento cerrado.",
  description_ar:
    "أُدخلت إلى ألمانيا حالتان من الإيبولا (سلالة بونديبوغيو) من تفشي المرض في جمهورية الكونغو الديمقراطية؛ وكلتاهما لمواطنَين أمريكيَّين جرى إجلاؤهما طبياً من الكونغو الديمقراطية، ولم تحدث أي عدوى داخل ألمانيا. خرج الأول، الذي عولج في مستشفى شاريتيه (برلين)، في 6 يونيو 2026؛ وخرج الثاني، الذي أُجلي في 13 يوليو وعولج في مستشفى جامعة فرانكفورت، متعافياً تماماً في 28 يوليو 2026. لا وفيات ولا انتقال محلي للعدوى. ويحتسب تقرير منظمة الصحة العالمية DON614 كلتا الحالتين ضمن إجمالي جمهورية الكونغو الديمقراطية. أُغلق الحدث.",
  description_id:
    "Dua kasus Ebola (strain Bundibugyo) diimpor ke Jerman dari wabah di RD Kongo; keduanya warga negara AS yang dievakuasi secara medis dari RDK, dan tidak ada yang tertular di Jerman. Pasien pertama, dirawat di Charité (Berlin), dipulangkan pada 6 Juni 2026; pasien kedua, dievakuasi pada 13 Juli dan dirawat di Rumah Sakit Universitas Frankfurt, dipulangkan dalam keadaan sembuh total pada 28 Juli 2026. Tidak ada kematian dan tidak ada penularan lokal. WHO DON614 menghitung keduanya dalam total RDK. Peristiwa ditutup.",
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
  active: row.active,
  source: row.source,
});
console.log("\nTraductions non nulles :", {
  fr: !!row.description_fr,
  es: !!row.description_es,
  ar: !!row.description_ar,
  id: !!row.description_id,
});
