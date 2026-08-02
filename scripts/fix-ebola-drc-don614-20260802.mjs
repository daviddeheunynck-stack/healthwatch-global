import { readFileSync } from "fs";

const env = readFileSync(".env.local.live", "utf-8");
function getEnv(key) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return "";
  return m[1].replace(/^﻿/, "").replace(/[\r\n]+$/, "").trim();
}

const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");

const ID = "bd1c3a46-a921-49b7-b79e-10ad715c4c38";
const DON614_URL = "https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON614";

const description = "Ebola disease caused by Bundibugyo virus in the Democratic Republic of the Congo. As of 30 July 2026: 3,605 confirmed cases and 1,587 deaths, a case fatality ratio of 44% (WHO Disease Outbreak News DON614), with 651 people recovered. Five provinces are affected (Haut-Uele, Ituri, North Kivu, South Kivu and Tshopo), covering 49 of the country's 140 health zones, of which 33 remain active; Ituri province alone accounts for 88% of all confirmed cases (3,176 of 3,605). 17,863 contacts have been identified, with follow-up rates ranging from 66.2% (Tshopo) to 80.6% (Haut-Uele). Health workers account for 151 confirmed cases, including 44 deaths and 68 recoveries. There is no approved vaccine or treatment for the Bundibugyo strain. Uganda, which recorded 20 cases and 2 deaths imported from this outbreak, has declared its own outbreak over after 42 days without a new locally transmitted case. Isolated cases have also been diagnosed in DRC and treated abroad: 1 in France, 2 in Germany. Declared a Public Health Emergency of International Concern (PHEIC) on 17 May 2026.";

const description_fr = "Maladie à virus Ebola causée par le virus Bundibugyo en République démocratique du Congo. Au 30 juillet 2026 : 3 605 cas confirmés et 1 587 décès, soit un taux de létalité de 44 % (Disease Outbreak News DON614 de l'OMS), avec 651 personnes guéries. Cinq provinces sont touchées (Haut-Uélé, Ituri, Nord-Kivu, Sud-Kivu et Tshopo), couvrant 49 des 140 zones de santé du pays, dont 33 restent actives ; la seule province de l'Ituri concentre 88 % de l'ensemble des cas confirmés (3 176 sur 3 605). 17 863 contacts ont été identifiés, avec des taux de suivi allant de 66,2 % (Tshopo) à 80,6 % (Haut-Uélé). Les agents de santé représentent 151 cas confirmés, dont 44 décès et 68 guérisons. Il n'existe ni vaccin ni traitement homologué contre la souche Bundibugyo. L'Ouganda, qui a enregistré 20 cas et 2 décès importés de cette épidémie, a déclaré la fin de sa propre épidémie après 42 jours sans nouveau cas de transmission locale. Des cas isolés ont également été diagnostiqués en RDC puis traités à l'étranger : 1 en France, 2 en Allemagne. Déclarée Urgence de Santé Publique de Portée Internationale (USPPI) le 17 mai 2026.";

const description_es = "Enfermedad del Ébola causada por el virus Bundibugyo en la República Democrática del Congo. Al 30 de julio de 2026: 3.605 casos confirmados y 1.587 muertes, una tasa de letalidad del 44 % (Disease Outbreak News DON614 de la OMS), con 651 personas recuperadas. Cinco provincias están afectadas (Alto Uele, Ituri, Kivu del Norte, Kivu del Sur y Tshopo), que abarcan 49 de las 140 zonas sanitarias del país, de las cuales 33 permanecen activas; la provincia de Ituri concentra por sí sola el 88 % de todos los casos confirmados (3.176 de 3.605). Se han identificado 17.863 contactos, con tasas de seguimiento que van del 66,2 % (Tshopo) al 80,6 % (Alto Uele). El personal sanitario representa 151 casos confirmados, incluidas 44 muertes y 68 recuperaciones. No existe vacuna ni tratamiento aprobado contra la cepa Bundibugyo. Uganda, que registró 20 casos y 2 muertes importados de este brote, ha declarado el fin de su propio brote tras 42 días sin un nuevo caso de transmisión local. También se han diagnosticado casos aislados en la RDC y tratados en el extranjero: 1 en Francia, 2 en Alemania. Declarada Emergencia de Salud Pública de Importancia Internacional (ESPII) el 17 de mayo de 2026.";

const description_ar = "مرض الإيبولا الناجم عن فيروس بونديبوغيو في جمهورية الكونغو الديمقراطية. حتى 30 يوليو 2026: 3605 حالة مؤكدة و1587 حالة وفاة، أي معدل إماتة قدره 44% (تقرير الأمراض الوبائية DON614 الصادر عن منظمة الصحة العالمية)، مع تعافي 651 شخصًا. تأثرت خمس مقاطعات (أويلي العليا، وإيتوري، وكيفو الشمالية، وكيفو الجنوبية، وتشوبو)، تغطي 49 منطقة صحية من أصل 140 منطقة في البلاد، لا تزال 33 منها نشطة؛ وتستأثر مقاطعة إيتوري وحدها بنسبة 88% من إجمالي الحالات المؤكدة (3176 من أصل 3605). تم تحديد 17863 مخالطًا، بمعدلات متابعة تتراوح بين 66.2% (تشوبو) و80.6% (أويلي العليا). يمثل العاملون الصحيون 151 حالة مؤكدة، منها 44 حالة وفاة و68 حالة تعافٍ. لا يوجد لقاح أو علاج معتمد لسلالة بونديبوغيو. أعلنت أوغندا، التي سجلت 20 حالة و2 وفاة مستوردة من هذا التفشي، انتهاء تفشيها الخاص بعد مرور 42 يومًا دون تسجيل حالة انتقال محلي جديدة. كما شُخصت حالات معزولة في جمهورية الكونغو الديمقراطية وعولجت في الخارج: حالة واحدة في فرنسا، وحالتان في ألمانيا. أُعلن التفشي طارئة صحية عامة تثير قلقًا دوليًا في 17 مايو 2026.";

const description_id = "Penyakit Ebola yang disebabkan oleh virus Bundibugyo di Republik Demokratik Kongo. Per 30 Juli 2026: 3.605 kasus terkonfirmasi dan 1.587 kematian, dengan tingkat kematian kasus 44% (Disease Outbreak News DON614 dari WHO), serta 651 orang sembuh. Lima provinsi terdampak (Haut-Uele, Ituri, Kivu Utara, Kivu Selatan, dan Tshopo), mencakup 49 dari 140 zona kesehatan di negara itu, 33 di antaranya masih aktif; provinsi Ituri sendiri menyumbang 88% dari seluruh kasus terkonfirmasi (3.176 dari 3.605). Sebanyak 17.863 kontak telah diidentifikasi, dengan tingkat pemantauan berkisar antara 66,2% (Tshopo) hingga 80,6% (Haut-Uele). Tenaga kesehatan menyumbang 151 kasus terkonfirmasi, termasuk 44 kematian dan 68 kesembuhan. Tidak ada vaksin atau pengobatan yang disetujui untuk galur Bundibugyo. Uganda, yang mencatat 20 kasus dan 2 kematian impor dari wabah ini, telah menyatakan wabahnya sendiri berakhir setelah 42 hari tanpa kasus penularan lokal baru. Kasus terisolasi juga telah didiagnosis di RD Kongo dan dirawat di luar negeri: 1 di Prancis, 2 di Jerman. Dinyatakan sebagai Kedaruratan Kesehatan Masyarakat yang Meresahkan Dunia (PHEIC) pada 17 Mei 2026.";

const payload = {
  cases: 3605,
  deaths: 1587,
  recovered: 651,
  date: "2026-07-30",
  source: DON614_URL,
  source_priority: 10,
  who_don_published_at: "2026-08-01",
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
  body: JSON.stringify(payload),
});

if (!res.ok) {
  console.error("UPDATE FAILED", res.status, await res.text());
  process.exit(1);
}
const updated = await res.json();
console.log("✅ Mis à jour :");
console.log(JSON.stringify(updated, null, 2));
