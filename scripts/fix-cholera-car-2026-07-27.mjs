// Morning DON check 2026-07-27 — Cholera / Central African Republic
//
// Section 4 ter (silent nulls) flagged CAR: wired into CHOLERA_ISO3 in
// sync-who-regional but zero Cholera rows in the database, and not in the
// documented CHOLERA_EXPECTED_NULLS list. Verified against primary reporting
// before concluding it is a real coverage hole:
//   - Ministry of Health declared the outbreak on 26 June 2026 after lab
//     confirmation by Institut Pasteur Bangui (multiple wires, 26-29/06).
//   - UNICEF CAR Humanitarian Flash Update No. 1 (6 July 2026): 435 suspected
//     cases, 36 deaths, cumulative CFR 8.3%, children under 10 = 44% of cases.
//   - Xinhua/UN OCHA briefing (15-16 July 2026): "more than 400 suspected
//     cases", "36 community deaths", spread from Bimbo and Mbaiki to all
//     districts of Bangui; US$1m in UN emergency funds released.
// CAR is absent from WHO Multi-country Cholera Epidemiological Update #38
// (30/06, data to 31/05), which is why the ArcGIS-backed fetcher yields nothing.
//
// source_priority=10 so no cron overwrites it, and so section 4 bis of the
// morning routine keeps it under weekly staleness review.
// push_notified_at is set on insert to SUPPRESS the outbound push alert — a
// notification to real users is David's call, not the routine's. Setting it to
// NULL would make app/api/cron/push-alerts fire on its next run.
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

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

// Guard against a concurrent session having inserted the row in the meantime.
const existing = await fetch(
  `${SUPABASE_URL}/rest/v1/outbreaks?disease_en=eq.Cholera&country_en=eq.Central%20African%20Republic&select=id,active,cases,deaths`,
  { headers }
).then((r) => r.json());
if (existing.length > 0) {
  console.log("Ligne déjà présente, insertion annulée :", JSON.stringify(existing));
  process.exit(0);
}

const SOURCE = "https://english.news.cn/20260716/be57e3870fa842b99707e6cb8b21d9aa/c.html";

const row = {
  disease: "Choléra",
  disease_en: "Cholera",
  disease_ar: "الكوليرا",
  country: "République centrafricaine",
  country_en: "Central African Republic",
  country_ar: "جمهورية أفريقيا الوسطى",
  region: "africa",
  lat: 6.6,
  lng: 20.9,
  cases: 435,
  deaths: 36,
  recovered: null,
  risk_level: "high",
  date: "2026-07-06",
  source: SOURCE,
  active: true,
  is_seed: false,
  is_pheic: false,
  is_backfill: false,
  verification_status: "confirmed",
  response_phase: "active_response",
  source_priority: 10,
  push_notified_at: new Date().toISOString(),
  description:
    "Cholera outbreak in the Central African Republic, declared by the Ministry of Health on 26 June 2026 after laboratory confirmation by the Institut Pasteur in Bangui. As of 6 July 2026, 435 suspected cases and 36 deaths had been reported, a cumulative case fatality rate of 8.3% (UNICEF Humanitarian Flash Update No. 1). The affected health districts are Bangui 2, Bimbo and Mbaïki, where transmission remains active; cases have spread from the rural districts of Bimbo and Mbaïki to all districts of the capital Bangui, and along the Ubangi River which borders the Democratic Republic of the Congo. Children under 10 account for 44% of cases. The United Nations released US$1 million in emergency funds on 15 July 2026. The Central African Republic does not appear in WHO's Multi-country Cholera Epidemiological Update #38 (30 June 2026, data as of 31 May 2026), so this outbreak is tracked from UNICEF and UN humanitarian reporting.",
  description_fr:
    "Épidémie de choléra en République centrafricaine, déclarée par le ministère de la Santé le 26 juin 2026 après confirmation en laboratoire par l'Institut Pasteur de Bangui. Au 6 juillet 2026, 435 cas suspects et 36 décès avaient été signalés, soit un taux de létalité cumulé de 8,3 % (Flash humanitaire UNICEF n° 1). Les districts sanitaires touchés sont Bangui 2, Bimbo et Mbaïki, où la transmission reste active ; les cas se sont propagés des districts ruraux de Bimbo et Mbaïki à tous les arrondissements de la capitale Bangui, ainsi que le long du fleuve Oubangui qui borde la République démocratique du Congo. Les enfants de moins de 10 ans représentent 44 % des cas. Les Nations unies ont débloqué 1 million de dollars US de fonds d'urgence le 15 juillet 2026. La République centrafricaine n'apparaît pas dans la Mise à jour épidémiologique multipays de l'OMS sur le choléra n° 38 (30 juin 2026, données au 31 mai 2026), de sorte que cette épidémie est suivie à partir des rapports humanitaires de l'UNICEF et des Nations unies.",
  description_es:
    "Brote de cólera en la República Centroafricana, declarado por el Ministerio de Salud el 26 de junio de 2026 tras la confirmación de laboratorio por el Instituto Pasteur de Bangui. Al 6 de julio de 2026 se habían notificado 435 casos sospechosos y 36 muertes, una tasa de letalidad acumulada del 8,3 % (Flash Humanitario de UNICEF n.º 1). Los distritos sanitarios afectados son Bangui 2, Bimbo y Mbaïki, donde la transmisión sigue activa; los casos se han extendido desde los distritos rurales de Bimbo y Mbaïki a todos los distritos de la capital, Bangui, y a lo largo del río Ubangui, que hace frontera con la República Democrática del Congo. Los menores de 10 años representan el 44 % de los casos. Las Naciones Unidas liberaron 1 millón de dólares estadounidenses en fondos de emergencia el 15 de julio de 2026. La República Centroafricana no aparece en la Actualización epidemiológica multinacional sobre el cólera n.º 38 de la OMS (30 de junio de 2026, datos al 31 de mayo de 2026), por lo que este brote se rastrea a partir de los informes humanitarios de UNICEF y las Naciones Unidas.",
  description_ar:
    "تفشي الكوليرا في جمهورية أفريقيا الوسطى، أعلنته وزارة الصحة في 26 يونيو 2026 بعد التأكيد المخبري من معهد باستور في بانغي. واعتبارًا من 6 يوليو 2026، أُبلغ عن 435 حالة مشتبه بها و36 حالة وفاة، بمعدل إماتة تراكمي قدره 8.3% (التحديث الإنساني العاجل رقم 1 لليونيسف). والمناطق الصحية المتأثرة هي بانغي 2 وبيمبو ومبايكي، حيث لا يزال انتقال العدوى نشطًا؛ وقد انتشرت الحالات من منطقتي بيمبو ومبايكي الريفيتين إلى جميع أحياء العاصمة بانغي، وعلى طول نهر أوبانغي الذي يحد جمهورية الكونغو الديمقراطية. ويمثل الأطفال دون سن العاشرة 44% من الحالات. وأفرجت الأمم المتحدة عن مليون دولار أمريكي من أموال الطوارئ في 15 يوليو 2026. ولا تظهر جمهورية أفريقيا الوسطى في التحديث الوبائي للكوليرا متعدد البلدان لمنظمة الصحة العالمية رقم 38 (30 يونيو 2026، البيانات حتى 31 مايو 2026)، لذلك يُتابع هذا التفشي من التقارير الإنسانية لليونيسف والأمم المتحدة.",
  description_id:
    "Wabah kolera di Republik Afrika Tengah, dinyatakan oleh Kementerian Kesehatan pada 26 Juni 2026 setelah konfirmasi laboratorium oleh Institut Pasteur di Bangui. Per 6 Juli 2026, dilaporkan 435 kasus suspek dan 36 kematian, dengan tingkat kematian kasus kumulatif 8,3% (UNICEF Humanitarian Flash Update No. 1). Distrik kesehatan yang terdampak adalah Bangui 2, Bimbo, dan Mbaïki, di mana penularan masih aktif; kasus telah menyebar dari distrik pedesaan Bimbo dan Mbaïki ke seluruh distrik ibu kota Bangui, serta di sepanjang Sungai Ubangi yang berbatasan dengan Republik Demokratik Kongo. Anak-anak di bawah 10 tahun mencakup 44% dari kasus. PBB mencairkan dana darurat sebesar US$1 juta pada 15 Juli 2026. Republik Afrika Tengah tidak muncul dalam WHO Multi-country Cholera Epidemiological Update #38 (30 Juni 2026, data per 31 Mei 2026), sehingga wabah ini dilacak dari pelaporan kemanusiaan UNICEF dan PBB.",
};

const res = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks`, {
  method: "POST",
  headers: { ...headers, Prefer: "return=representation" },
  body: JSON.stringify(row),
});
const out = await res.json();
if (!res.ok) {
  console.error("ÉCHEC", res.status, JSON.stringify(out));
  process.exit(1);
}
const [created] = out;
console.log(
  `OK inséré ${created.disease_en} / ${created.country_en} : id=${created.id} cases=${created.cases} deaths=${created.deaths} date=${created.date} prio=${created.source_priority} push_notified_at=${created.push_notified_at}`
);
