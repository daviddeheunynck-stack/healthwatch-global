import { errorMessage } from "@/lib/error";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

// Optional — free registration at mymemory.translated.net gives 10k words/day
// instead of the 1k/day anonymous limit.
const MYMEMORY_EMAIL = clean(process.env.MYMEMORY_EMAIL);

export interface DescriptionTranslations {
  fr: string | null; es: string | null; ar: string | null; id: string | null;
}

// ── MyMemory translation (100% gratuit, sans CB) ──────────────────────────────
// API publique : 1 000 mots/jour sans compte, 10 000/jour avec un email gratuit.
// Pour enregistrer : https://mymemory.translated.net/register.php
//
// Shared by every ingestion cron that writes an outbreak `description` — call
// this at insert time so each source is responsible for its own translations
// rather than relying on another cron's backfill sweep to catch it later.
export async function translateDescription(text: string): Promise<DescriptionTranslations> {
  const empty: DescriptionTranslations = { fr: null, es: null, ar: null, id: null };
  if (!text?.trim()) return empty;

  const base = "https://api.mymemory.translated.net/get";
  const pairs = [
    { key: "fr" as const, langpair: "en|fr" },
    { key: "es" as const, langpair: "en|es" },
    { key: "ar" as const, langpair: "en|ar" },
    { key: "id" as const, langpair: "en|id" },
  ];

  const results: DescriptionTranslations = { ...empty };

  try {
    const calls = pairs.map(({ langpair }) => {
      const url = new URL(base);
      url.searchParams.set("q", text);
      url.searchParams.set("langpair", langpair);
      if (MYMEMORY_EMAIL) url.searchParams.set("de", MYMEMORY_EMAIL);
      return fetch(url.toString()).then((r) => r.ok ? r.json() : null);
    });

    const responses = await Promise.all(calls);
    for (let i = 0; i < pairs.length; i++) {
      // MyMemory returns HTTP 200 with an in-body error (e.g. responseStatus 403
      // "QUERY LENGTH LIMIT EXCEEDED. MAX ALLOWED QUERY : 500 CHARS") whose
      // translatedText is the error message itself, not a translation — reject
      // anything that isn't an explicit 200 before trusting translatedText.
      if (Number(responses[i]?.responseStatus) !== 200) continue;
      const t = responses[i]?.responseData?.translatedText ?? null;
      // MyMemory returns the original text when it can't translate — discard those
      if (t && t !== text) results[pairs[i].key] = t;
    }
  } catch (e: unknown) {
    console.warn("[translate] MyMemory translation error:", errorMessage(e));
  }

  return results;
}
