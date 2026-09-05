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

  if (results.fr) results.fr = sanitizeFr(results.fr);
  if (results.id) results.id = sanitizeId(results.id);

  return results;
}

// MyMemory is a translation-MEMORY service, not an LLM — the same English
// input reliably produces the same output. Found 2026-09-05 auditing 114
// already-published rows: on certain sentence shapes (an em-dash or colon
// right before "WHO reported"/"has notified"/etc.), it mis-capitalizes the
// French auxiliary "a" and preposition "de" as "A"/"DE", and the Indonesian
// relative pronoun "yang" as "YANG" — deterministically, so every row this
// recurs on breaks again the next time its English description changes and
// sync-who-regional (or any other fetcher) nulls the translation fields for
// re-translation (`existingRow.description !== found.description` — see that
// file). Sanitizing here, at the one call site every cron shares, fixes it at
// the source instead of needing a fresh one-off data patch each time.
//
// Deliberately narrow: `A` is fixed only when immediately followed by one of
// these five verbs, found by tallying every word MyMemory actually produced
// after a mis-capitalized "A" across the full table before writing this list.
// A blanket `/\bA\b/` was tried first and rejected — it also matches the
// genuinely-capitalized "A" in "grippe A(H5N1)"/"A(H3N2)" (the WHO influenza
// type letter) and in "Hépatite A" (a real disease name, vs B/C) — neither is
// followed by one of these words, so this list can't touch either.
// No trailing \b: a word ending in an accented letter (é) is "non-word" to
// JS's default (non-unicode) \b, so a boundary check right after one of these
// verbs silently never matches — found the hard way (this exact mistake) in
// an earlier throwaway probe script tonight, before it made it into this file.
const FR_A_VERB = /\bA (signalé|estimé|notifié|été|reçu|rapporté|indiqué|not[ée]|confirmé)/g;
// "DE" and "QUI": no legitimate capitalized use of either found anywhere in
// the table (verified by tallying every word before/after each occurrence),
// so both are safe to lowercase unconditionally. Note "QUI" only fixes the
// case where MyMemory chose the right word ("qui", a relative pronoun) in the
// wrong case — it does NOT fix the rarer, different bug where MyMemory
// mistranslates "WHO" as the interrogative "who"/"QUI" outright (a wrong
// WORD, not just a wrong case; found twice — New Caledonia, Laos — fixed by
// hand, not covered here since a blanket "qui" -> "L'OMS" swap would be
// unsafe on the many legitimate relative-pronoun "qui"s elsewhere).
function sanitizeFr(text: string): string {
  return text.replace(FR_A_VERB, "a $1").replace(/\bDE\b/g, "de").replace(/\bQUI\b/g, "qui");
}

// "yang" (Indonesian relative pronoun): same reasoning as DE/QUI above — no
// legitimate capitalized use found. The digit-space-hyphen-digit spacing fix
// covers both calendar dates ("2026 -09 -02") and any other numeric range
// (an age range, a week range, a citation range) MyMemory renders the same
// mis-spaced way.
function sanitizeId(text: string): string {
  return text.replace(/\bYANG\b/g, "yang").replace(/(\d)\s-(\d)/g, "$1-$2");
}
