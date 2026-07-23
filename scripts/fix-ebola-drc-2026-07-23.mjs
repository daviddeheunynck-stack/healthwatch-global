// Ebola/RDC — rafraîchissement depuis ECDC (page mise à jour 22/07/2026 16:50, données au 20/07).
// Avant : 2423 cas / 967 décès / 469 guéris, date 2026-07-19 (lecture ECDC du 21/07).
// Après  : 2473 cas / 999 décès / 482 guéris, date 2026-07-20, 737 hospitalisés en isolement.
// source_priority reste 5 (cf. memory project_ebola_drc_priority10_frozen_no_autofeed_2026_07_16 :
// ne jamais re-verrouiller à 10, la ligne cesserait de s'alimenter).
import { readFileSync } from "fs";

const env = readFileSync(".env.local.live", "utf-8");
const getEnv = (k) =>
  (env.match(new RegExp(`^${k}=(.*)$`, "m")) || ["", ""])[1]
    .replace(/^﻿/, "")
    .replace(/[\r\n]+$/, "")
    .trim()
    .replace(/^"(.*)"$/, "$1");

const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL.includes("tqznwmpkokdzrszysbcm")) throw new Error("Pas la prod — arrêt.");

const ID = "bd1c3a46-a921-49b7-b79e-10ad715c4c38";

const patch = {
  cases: 2473,
  deaths: 999,
  recovered: 482,
  date: "2026-07-20",
  description:
    "Ebola disease caused by Bundibugyo virus in the Democratic Republic of the Congo. ECDC outbreak page (last updated 22 July 2026): 2,473 confirmed cases and 999 deaths as of 20 July 2026, with 482 recovered and 737 patients hospitalised in isolation. Declared a Public Health Emergency of International Concern (PHEIC) on 17 May 2026.",
  description_fr:
    "Maladie à virus Ebola causée par le virus Bundibugyo en République démocratique du Congo. Page de l'éclosion de l'ECDC (dernière mise à jour le 22 juillet 2026) : 2 473 cas confirmés et 999 décès au 20 juillet 2026, dont 482 guéris et 737 patients hospitalisés en isolement. Déclaré Urgence de Santé Publique de Préoccupation Internationale (PHEIC) le 17 mai 2026.",
  description_es:
    "Enfermedad del Ébola causada por el virus Bundibugyo en la República Democrática del Congo. Página de brotes del ECDC (última actualización el 22 de julio de 2026): 2.473 casos confirmados y 999 muertes al 20 de julio de 2026, con 482 pacientes recuperados y 737 hospitalizados de forma aislada. Declarada Emergencia de Salud Pública de Preocupación Internacional (ESPII) el 17 de mayo de 2026.",
  description_ar:
    "مرض الإيبولا الناجم عن فيروس بونديبوغيو في جمهورية الكونغو الديمقراطية. صفحة تفشي ECDC (آخر تحديث في 22 يوليو 2026): 2473 حالة مؤكدة و 999 حالة وفاة اعتبارًا من 20 يوليو 2026، مع تعافي 482 مريضًا ونقل 737 مريضًا إلى المستشفى في عزلة. أعلنت حالة طوارئ صحية عامة مثيرة للقلق الدولي (PHEIC) في 17 مايو 2026.",
  description_id:
    "Penyakit Ebola yang disebabkan oleh virus Bundibugyo di Republik Demokratik Kongo. Halaman wabah ECDC (terakhir diperbarui 22 Juli 2026): 2.473 kasus terkonfirmasi dan 999 kematian pada 20 Juli 2026, dengan 482 sembuh dan 737 pasien dirawat di rumah sakit dalam isolasi. Mendeklarasikan Public Health Emergency of International Concern (PHEIC) pada 17 Mei 2026.",
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

const body = await res.json();
console.log("status", res.status);
console.log(
  JSON.stringify(
    Array.isArray(body)
      ? body.map((o) => ({
          id: o.id,
          cases: o.cases,
          deaths: o.deaths,
          recovered: o.recovered,
          date: o.date,
          active: o.active,
          source_priority: o.source_priority,
        }))
      : body,
    null,
    2
  )
);
