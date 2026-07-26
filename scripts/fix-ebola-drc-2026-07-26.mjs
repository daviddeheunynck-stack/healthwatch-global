// Ebola/RDC — rafraîchissement depuis le point de situation gouvernemental du 24/07/2026,
// publié par le Ministère de la Communication et des Médias RDC le 26/07 à 02h15
// (https://x.com/Com_mediasRDC/status/2081171553387950121).
//
// Avant : 2905 cas / 1269 décès / 519 guéris, date 2026-07-22 (SitRep n°69 relayé par ECDC).
// Après  : 3075 cas / 1354 décès / 556 guéris, date 2026-07-24, 755 en isolement/hospitalisés.
//
// Pourquoi pas ECDC : la page ECDC était encore à 2905/1269 au 22/07 (mise à jour "24 July at 15:23",
// relue ce matin), soit 2 jours de retard sur le point de situation national. Retard structurel connu.
//
// ⚠️ Écart connu à documenter : Wikipédia et BNO News attribuent tous deux à "SitRep N°071/MVB_24/07/2026"
// des valeurs légèrement différentes pour la même date — 3096 cas / 1356 décès / 575 guéris.
// Le point de situation du Ministère de la Communication (source retenue ici) donne 3075/1354/556.
// Choix : garder la source officielle gouvernementale directement citable et vérifiable par l'utilisateur,
// et rester cohérent entre `source` et les chiffres écrits, plutôt que d'écrire des chiffres que la page
// liée ne montre pas. L'écart (+21 cas, +2 décès, soit 0,7 %) est du bruit de reporting entre deux
// documents officiels du même jour, pas une contradiction de fond. Si une session future voit 3096/1356
// arriver via ECDC, c'est une HAUSSE cohérente, pas une régression.
//
// Cohérence interne vérifiée : 1354/3075 = 44,03 %, conforme au "taux de létalité de 44,0 %" annoncé
// dans le même communiqué. Dynamique depuis le SitRep n°69 (22/07, 2905/1269) : +170 cas et +85 décès
// en 2 jours, soit ~85 cas/j et ~43 décès/j, cohérent avec les jours précédents.
//
// source_priority reste 5 (cf. memory project_ebola_drc_priority10_frozen_no_autofeed_2026_07_16 :
// ne jamais re-verrouiller à 10, la ligne cesserait de s'alimenter). `active` non touché.
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
  cases: 3075,
  deaths: 1354,
  recovered: 556,
  date: "2026-07-24",
  source: "https://x.com/Com_mediasRDC/status/2081171553387950121",
  description:
    "Ebola disease caused by Bundibugyo virus in the Democratic Republic of the Congo. DRC government situation update for 24 July 2026 (Ministry of Communication and Media): 3,075 confirmed cases and 1,354 deaths, with 556 recovered and 755 patients in isolation or hospitalised. Case fatality rate 44.0% and contact tracing rate 76.4%. Affected provinces: Haut-Uele, Ituri, North Kivu, South Kivu and Tshopo. Declared a Public Health Emergency of International Concern (PHEIC) on 17 May 2026.",
  description_fr:
    "Maladie à virus Ebola causée par le virus Bundibugyo en République démocratique du Congo. Point de situation gouvernemental du 24 juillet 2026 (Ministère de la Communication et des Médias) : 3 075 cas confirmés et 1 354 décès, dont 556 guéris et 755 patients en isolement ou hospitalisés. Taux de létalité de 44,0 % et taux de suivi des contacts de 76,4 %. Provinces touchées : Haut-Uélé, Ituri, Nord-Kivu, Sud-Kivu et Tshopo. Déclaré Urgence de Santé Publique de Portée Internationale (USPPI) le 17 mai 2026.",
  description_es:
    "Enfermedad del Ébola causada por el virus Bundibugyo en la República Democrática del Congo. Informe gubernamental de situación del 24 de julio de 2026 (Ministerio de Comunicación y Medios): 3.075 casos confirmados y 1.354 muertes, con 556 recuperados y 755 pacientes en aislamiento u hospitalizados. Tasa de letalidad del 44,0 % y tasa de seguimiento de contactos del 76,4 %. Provincias afectadas: Alto Uele, Ituri, Kivu del Norte, Kivu del Sur y Tshopo. Declarada Emergencia de Salud Pública de Importancia Internacional (ESPII) el 17 de mayo de 2026.",
  description_ar:
    "مرض الإيبولا الناجم عن فيروس بونديبوغيو في جمهورية الكونغو الديمقراطية. تقرير الحالة الحكومي ليوم 24 يوليو 2026 (وزارة الاتصالات والإعلام): 3075 حالة مؤكدة و1354 حالة وفاة، مع تعافي 556 شخصًا و755 مريضًا في العزل أو في المستشفى. معدل إماتة الحالات 44.0% ومعدل تتبع المخالطين 76.4%. المقاطعات المتأثرة: أويلي العليا، وإيتوري، وكيفو الشمالية، وكيفو الجنوبية، وتشوبو. أُعلنت حالة طوارئ صحية عامة تثير قلقًا دوليًا في 17 مايو 2026.",
  description_id:
    "Penyakit Ebola yang disebabkan oleh virus Bundibugyo di Republik Demokratik Kongo. Laporan situasi pemerintah untuk 24 Juli 2026 (Kementerian Komunikasi dan Media): 3.075 kasus terkonfirmasi dan 1.354 kematian, dengan 556 sembuh dan 755 pasien dalam isolasi atau dirawat di rumah sakit. Tingkat kematian kasus 44,0% dan tingkat pelacakan kontak 76,4%. Provinsi terdampak: Haut-Uele, Ituri, Kivu Utara, Kivu Selatan, dan Tshopo. Dinyatakan sebagai Public Health Emergency of International Concern (PHEIC) pada 17 Mei 2026.",
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
          source: o.source,
        }))
      : body,
    null,
    2
  )
);
