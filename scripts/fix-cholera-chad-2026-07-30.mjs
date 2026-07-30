// Requalification de la ligne Choléra/Tchad (06541c4a-6b67-4c2c-a44e-818ba7621d76)
// suite à la circulaire du ministère de la Santé publique et de la Prévention du 24/07/2026 :
//  - épisode de Karal requalifié à 167 cas cumulés, transmission arrêtée
//  - épidémie distincte confirmée à N'Djamena, aucun chiffre officiel publié à ce jour
// Décès : 4 reste le dernier bilan officiel publié (02/07/2026, à 129 cas) — la circulaire
// du 24/07 ne le réactualise pas, les deux chiffres n'ont donc pas la même date d'arrêté.
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
const SOURCE =
  "https://www.onama.td/alerte-sanitaire-le-ministere-confirme-une-epidemie-de-cholera-a-ndjamena-et-appelle-a-la-vigilance/";

const patch = {
  cases: 167,
  deaths: 4,
  date: "2026-07-24",
  source: SOURCE,
  description:
    "Cholera in Chad — two successive episodes. Karal health district (Hadjer-Lamis province): outbreak confirmed on 13 June 2026 after detection of Vibrio cholerae O1, serotype Ogawa. A Ministry of Public Health and Prevention circular dated 24 July 2026 puts this episode at 167 cumulative cases and states that the rapid response halted transmission. The most recent official death toll for Karal remains 4 (case fatality 3.1%), published on 2 July 2026 when the cumulative count stood at 129 cases; the 24 July circular did not restate deaths, so the two figures have different cut-off dates. Separately, the same circular confirms a distinct cholera epidemic in the city of N'Djamena, after laboratory confirmation of gastroenteritis cases in several health facilities — no official case or death count has been published for N'Djamena as of 30 July 2026. Chad does not appear in WHO's Multi-country Cholera Epidemiological Update #38 (30 June 2026, data to 31 May 2026), so this event is tracked from national authority reporting.",
  description_fr:
    "Choléra au Tchad — deux épisodes successifs. District sanitaire de Karal (province du Hadjer-Lamis) : épidémie confirmée le 13 juin 2026 après détection de Vibrio cholerae O1, sérotype Ogawa. Une circulaire du ministère de la Santé publique et de la Prévention datée du 24 juillet 2026 porte cet épisode à 167 cas cumulés et indique que la riposte rapide a permis d'arrêter la transmission. Le dernier bilan officiel de décès pour Karal reste 4 (létalité 3,1 %), publié le 2 juillet 2026 alors que le cumul était de 129 cas ; la circulaire du 24 juillet ne réactualise pas les décès, les deux chiffres n'ont donc pas la même date d'arrêté. Par ailleurs, cette même circulaire confirme une épidémie de choléra distincte dans la ville de N'Djamena, après confirmation en laboratoire de cas de gastro-entérite dans plusieurs formations sanitaires — aucun bilan officiel de cas ou de décès n'a été publié pour N'Djamena au 30 juillet 2026. Le Tchad n'apparaît pas dans la Mise à jour épidémiologique multipays de l'OMS sur le choléra n° 38 (30 juin 2026, données au 31 mai 2026) : cet événement est donc suivi à partir des rapports des autorités nationales.",
  description_es:
    "Cólera en Chad — dos episodios sucesivos. Distrito sanitario de Karal (provincia de Hadjer-Lamis): brote confirmado el 13 de junio de 2026 tras la detección de Vibrio cholerae O1, serotipo Ogawa. Una circular del Ministerio de Salud Pública y Prevención con fecha 24 de julio de 2026 sitúa este episodio en 167 casos acumulados e indica que la respuesta rápida logró detener la transmisión. El último balance oficial de fallecidos para Karal sigue siendo 4 (letalidad del 3,1 %), publicado el 2 de julio de 2026 cuando el acumulado era de 129 casos; la circular del 24 de julio no actualiza las muertes, por lo que ambas cifras tienen fechas de corte distintas. Además, esa misma circular confirma un brote de cólera distinto en la ciudad de Yamena, tras la confirmación en laboratorio de casos de gastroenteritis en varios establecimientos de salud — no se ha publicado ningún recuento oficial de casos ni de muertes para Yamena a 30 de julio de 2026. Chad no aparece en la Actualización epidemiológica multipaís de la OMS sobre el cólera n.º 38 (30 de junio de 2026, datos al 31 de mayo de 2026), por lo que este evento se sigue a partir de los informes de las autoridades nacionales.",
  description_ar:
    "الكوليرا في تشاد — حلقتان متعاقبتان. منطقة كارال الصحية (مقاطعة حجر لاميس): تأكد التفشي في 13 يونيو 2026 بعد الكشف عن ضمة الكوليرا من النمط O1 المصلي Ogawa. وتفيد تعميم لوزارة الصحة العامة والوقاية مؤرخ في 24 يوليو 2026 بأن هذه الحلقة بلغت 167 حالة تراكمية وأن الاستجابة السريعة أوقفت انتقال المرض. ولا يزال أحدث حصيلة رسمية للوفيات في كارال هي 4 وفيات (معدل إماتة 3.1%)، نُشرت في 2 يوليو 2026 حين كان المجموع التراكمي 129 حالة؛ ولم يحدِّث تعميم 24 يوليو عدد الوفيات، فللرقمين تاريخا إغلاق مختلفان. ومن جهة أخرى، يؤكد التعميم نفسه تفشيًا منفصلًا للكوليرا في مدينة نجامينا بعد تأكيد مخبري لحالات التهاب المعدة والأمعاء في عدة مرافق صحية — ولم تُنشر أي حصيلة رسمية للحالات أو الوفيات في نجامينا حتى 30 يوليو 2026. ولا تظهر تشاد في التحديث الوبائي للكوليرا متعدد البلدان رقم 38 الصادر عن منظمة الصحة العالمية (30 يونيو 2026، بيانات حتى 31 مايو 2026)، لذلك يُتابع هذا الحدث من تقارير السلطات الوطنية.",
  description_id:
    "Kolera di Chad — dua episode berurutan. Distrik kesehatan Karal (provinsi Hadjer-Lamis): wabah dikonfirmasi pada 13 Juni 2026 setelah terdeteksi Vibrio cholerae O1, serotipe Ogawa. Sebuah surat edaran Kementerian Kesehatan Masyarakat dan Pencegahan bertanggal 24 Juli 2026 menyebut episode ini mencapai 167 kasus kumulatif dan menyatakan bahwa respons cepat berhasil menghentikan penularan. Angka kematian resmi terakhir untuk Karal tetap 4 (tingkat kematian 3,1%), dipublikasikan pada 2 Juli 2026 ketika kumulatif masih 129 kasus; surat edaran 24 Juli tidak memperbarui angka kematian, sehingga kedua angka memiliki tanggal batas yang berbeda. Selain itu, surat edaran yang sama mengonfirmasi wabah kolera terpisah di kota N'Djamena, setelah konfirmasi laboratorium atas kasus gastroenteritis di beberapa fasilitas kesehatan — belum ada angka kasus atau kematian resmi yang dipublikasikan untuk N'Djamena per 30 Juli 2026. Chad tidak muncul dalam Pembaruan Epidemiologi Kolera Multi-negara WHO #38 (30 Juni 2026, data hingga 31 Mei 2026), sehingga peristiwa ini dilacak dari pelaporan otoritas nasional.",
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
console.log("OK", {
  cases: row.cases,
  deaths: row.deaths,
  date: row.date,
  source: row.source,
  source_priority: row.source_priority,
  active: row.active,
  descs_non_null: ["description", "description_fr", "description_es", "description_ar", "description_id"]
    .filter((k) => row[k])
    .join(","),
});
