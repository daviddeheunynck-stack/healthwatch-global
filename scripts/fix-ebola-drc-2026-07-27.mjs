// Morning DON check 2026-07-27 — Ebola / DR Congo
//
// Row bd1c3a46 carried 3,075 cases / 1,354 deaths dated 2026-07-24, sourced to a
// tweet (x.com/Com_mediasRDC). Two problems:
//   1. Stale by one government release: DRC government data released 26 July 2026
//      gives 3,200 confirmed cases and 1,405 deaths. Corroborated by Reuters
//      (26/07), Al Jazeera (27/07) and INSP SitRep N°072 (as at 25/07).
//   2. "Source secondaire évitable": a tweet is not an acceptable source for the
//      largest outbreak in the product. Re-sourced to Al Jazeera's 27/07 article.
//
// Unverifiable sub-figures from the superseded 24/07 release (556 recovered,
// 755 hospitalised, 76.4% contact tracing) are dropped rather than carried over
// next to fresh totals. CFR is recomputed: 1405/3200 = 43.9%.
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

const ID = "bd1c3a46-a921-49b7-b79e-10ad715c4c38";
const SOURCE = "https://www.aljazeera.com/news/2026/7/27/ebola-infections-in-dr-congo-surge-to-3200-with-1405-deaths";

const patch = {
  cases: 3200,
  deaths: 1405,
  recovered: null,
  date: "2026-07-26",
  source: SOURCE,
  description:
    "Ebola disease caused by Bundibugyo virus in the Democratic Republic of the Congo. DRC government data released on 26 July 2026: 3,200 confirmed cases and 1,405 deaths (case fatality rate 43.9%). Cases rose by around 1,000 in ten days, making this the fastest-spreading Ebola outbreak on record. WHO reports that nearly 90% of cases are in Ituri province; at least five provinces are affected (Haut-Uele, Ituri, North Kivu, South Kivu and Tshopo). There is no approved vaccine or treatment for the Bundibugyo strain. Declared a Public Health Emergency of International Concern (PHEIC) on 17 May 2026.",
  description_fr:
    "Maladie à virus Ebola causée par le virus Bundibugyo en République démocratique du Congo. Données gouvernementales publiées le 26 juillet 2026 : 3 200 cas confirmés et 1 405 décès (taux de létalité de 43,9 %). Les cas ont augmenté d'environ 1 000 en dix jours, ce qui en fait l'épidémie d'Ebola à la propagation la plus rapide jamais enregistrée. L'OMS indique que près de 90 % des cas se trouvent dans la province de l'Ituri ; au moins cinq provinces sont touchées (Haut-Uélé, Ituri, Nord-Kivu, Sud-Kivu et Tshopo). Il n'existe ni vaccin ni traitement homologué contre la souche Bundibugyo. Déclarée Urgence de Santé Publique de Portée Internationale (USPPI) le 17 mai 2026.",
  description_es:
    "Enfermedad del Ébola causada por el virus Bundibugyo en la República Democrática del Congo. Datos gubernamentales publicados el 26 de julio de 2026: 3.200 casos confirmados y 1.405 muertes (tasa de letalidad del 43,9 %). Los casos aumentaron en unos 1.000 en diez días, lo que la convierte en el brote de ébola de propagación más rápida jamás registrado. La OMS indica que cerca del 90 % de los casos se concentran en la provincia de Ituri; al menos cinco provincias están afectadas (Alto Uele, Ituri, Kivu del Norte, Kivu del Sur y Tshopo). No existe vacuna ni tratamiento aprobado para la cepa Bundibugyo. Declarada Emergencia de Salud Pública de Importancia Internacional (ESPII) el 17 de mayo de 2026.",
  description_ar:
    "مرض الإيبولا الناجم عن فيروس بونديبوغيو في جمهورية الكونغو الديمقراطية. بيانات حكومية صدرت في 26 يوليو 2026: 3200 حالة مؤكدة و1405 حالات وفاة (معدل إماتة الحالات 43.9%). ارتفعت الحالات بنحو 1000 حالة خلال عشرة أيام، ما يجعله أسرع تفشٍّ للإيبولا انتشارًا على الإطلاق. وتفيد منظمة الصحة العالمية بأن نحو 90% من الحالات في مقاطعة إيتوري؛ وتأثرت خمس مقاطعات على الأقل (أويلي العليا، وإيتوري، وكيفو الشمالية، وكيفو الجنوبية، وتشوبو). ولا يوجد لقاح أو علاج معتمد لسلالة بونديبوغيو. أُعلنت حالة طوارئ صحية عامة تثير قلقًا دوليًا في 17 مايو 2026.",
  description_id:
    "Penyakit Ebola yang disebabkan oleh virus Bundibugyo di Republik Demokratik Kongo. Data pemerintah yang dirilis pada 26 Juli 2026: 3.200 kasus terkonfirmasi dan 1.405 kematian (tingkat kematian kasus 43,9%). Kasus bertambah sekitar 1.000 dalam sepuluh hari, menjadikannya wabah Ebola dengan penyebaran tercepat yang pernah tercatat. WHO melaporkan hampir 90% kasus berada di Provinsi Ituri; sedikitnya lima provinsi terdampak (Haut-Uele, Ituri, Kivu Utara, Kivu Selatan, dan Tshopo). Belum ada vaksin atau pengobatan yang disetujui untuk galur Bundibugyo. Dinyatakan sebagai Public Health Emergency of International Concern (PHEIC) pada 17 Mei 2026.",
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
const out = await res.json();
if (!res.ok) {
  console.error("ÉCHEC", res.status, JSON.stringify(out));
  process.exit(1);
}
const [row] = out;
console.log(
  `OK ${row.disease_en} / ${row.country_en} : cases=${row.cases} deaths=${row.deaths} recovered=${row.recovered} date=${row.date}\n  src=${row.source}`
);
