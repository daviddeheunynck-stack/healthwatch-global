// Ebola/Ouganda — description_es/ar/id manquantes. MyMemory (limite 500 caractères)
// échoue systématiquement sur cette ligne car la description anglaise fait 709
// caractères (ajout du cas probable ce matin). Traductions écrites à la main,
// alignées sur description_fr déjà en base. description_fr non touchée.
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
  description_es:
    "Enfermedad del Ébola causada por el virus Bundibugyo en Uganda, vinculada al brote en curso en la República Democrática del Congo — 20 casos confirmados y 2 muertes al 17 de julio de 2026 (Ministerio de Salud de Uganda, informado a través del ECDC), con 18 recuperaciones. La OMS informa además de un caso probable que resultó en muerte (Disease Outbreak News, 17 de julio de 2026). Uganda dio de alta a su último paciente de Ébola el 16 de julio de 2026 e inició el período de 42 días antes de poder declarar el fin del brote. Casos concentrados en los distritos de Kampala y Wakiso (área metropolitana de Kampala); no se han reportado casos nuevos desde el 21 de junio de 2026 ni transmisión comunitaria documentada. Declarada Emergencia de Salud Pública de Preocupación Internacional (ESPII) el 17 de mayo de 2026.",
  description_ar:
    "مرض فيروس الإيبولا الناجم عن فيروس بونديبوغيو في أوغندا، المرتبط بتفشي المرض الجاري في جمهورية الكونغو الديمقراطية — 20 حالة مؤكدة وحالتا وفاة حتى 17 يوليو 2026 (وزارة الصحة الأوغندية، عبر ECDC)، مع تعافي 18 حالة. تشير منظمة الصحة العالمية أيضًا إلى حالة محتملة أدت إلى الوفاة (تقرير تفشي الأمراض الصادر في 17 يوليو 2026). خرجت أوغندا آخر مريض إيبولا في 16 يوليو 2026 وبدأت فترة الـ42 يومًا قبل إمكانية إعلان نهاية التفشي. تتركز الحالات في مقاطعتي كمبالا وواكيسو (منطقة كمبالا الحضرية الكبرى)؛ لم تُسجَّل حالات جديدة منذ 21 يونيو 2026 ولم يوثَّق انتقال مجتمعي. أُعلنت حالة طوارئ صحية عامة تثير قلقًا دوليًا (PHEIC) في 17 مايو 2026.",
  description_id:
    "Penyakit Ebola yang disebabkan oleh virus Bundibugyo di Uganda, terkait dengan wabah yang sedang berlangsung di Republik Demokratik Kongo — 20 kasus terkonfirmasi dan 2 kematian per 17 Juli 2026 (Kementerian Kesehatan Uganda, dilaporkan melalui ECDC), dengan 18 kesembuhan. WHO juga melaporkan satu kasus probable yang berujung kematian (Disease Outbreak News, 17 Juli 2026). Uganda memulangkan pasien Ebola terakhirnya pada 16 Juli 2026 dan memulai periode 42 hari sebelum berakhirnya wabah dapat dideklarasikan. Kasus terkonsentrasi di distrik Kampala dan Wakiso (wilayah metropolitan Kampala); tidak ada kasus baru sejak 21 Juni 2026 dan tidak ada penularan komunitas yang terdokumentasi. Dinyatakan sebagai Kedaruratan Kesehatan Masyarakat yang Meresahkan Dunia (PHEIC) pada 17 Mei 2026.",
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
console.log(JSON.stringify(Array.isArray(body) ? body.map((o) => ({ id: o.id, has_es: !!o.description_es, has_ar: !!o.description_ar, has_id: !!o.description_id })) : body, null, 2));
