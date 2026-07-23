// Ebola/Ouganda — mise en cohérence avec ECDC (page 22/07/2026 : "As of 17 July 2026,
// a total of 20 confirmed cases, including two deaths").
// Chiffres cases/deaths inchangés (20/2, déjà corrects) ; seules la date "as of" (14→17 juillet)
// et la mention de guérisons dans les descriptions (17 → 18) sont corrigées — 18 guérisons est
// confirmé mot pour mot par WHO DON613 ("18 recoveries have been reported").
// Ajout : DON613 rapporte en plus "one probable case resulting in death", absent de la ligne.
// On garde le cadrage "confirmés" pour cases/deaths (cohérent avec la ligne RDC et avec ECDC,
// qui ne compte que les confirmés) et on mentionne le cas probable dans le texte, attribué à l'OMS.
// description_es / _ar / _id sont NULL sur cette ligne — gap signalé à David, non comblé ici.
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

const ID = "63ba952c-1965-473a-999f-705921159e87";

const patch = {
  date: "2026-07-17",
  description:
    "Ebola disease caused by Bundibugyo virus in Uganda, linked to the ongoing outbreak in the Democratic Republic of the Congo — 20 confirmed cases and 2 deaths as of 17 July 2026 (Uganda Ministry of Health, reported via ECDC), with 18 recoveries. WHO additionally reports one probable case that resulted in death (Disease Outbreak News, 17 July 2026). Uganda discharged its final Ebola patient on 16 July 2026 and started the 42-day countdown to declaring the outbreak over. Cases concentrated in Kampala and Wakiso districts (Kampala Metropolitan Area); no new cases since 21 June 2026 and no documented community transmission. Declared a Public Health Emergency of International Concern (PHEIC) on 17 May 2026.",
  description_fr:
    "Maladie à virus Ebola causée par le virus Bundibugyo en Ouganda, liée à l'épidémie en cours en République démocratique du Congo — 20 cas confirmés et 2 décès au 17 juillet 2026 (ministère de la Santé ougandais, rapporté via l'ECDC), dont 18 guérisons. L'OMS signale en outre un cas probable ayant entraîné un décès (Disease Outbreak News du 17 juillet 2026). L'Ouganda a renvoyé son dernier patient Ebola le 16 juillet 2026 et a lancé le compte à rebours de 42 jours avant de pouvoir déclarer la fin de l'épidémie. Cas concentrés dans les districts de Kampala et Wakiso (zone métropolitaine de Kampala) ; aucun nouveau cas depuis le 21 juin 2026 et aucune transmission communautaire documentée. Déclarée urgence de santé publique de portée internationale (PHEIC) le 17 mai 2026.",
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
