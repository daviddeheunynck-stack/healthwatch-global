// Truncates ingested source text to a max length without cutting mid-word or
// mid-parenthetical. A plain `.slice(0, maxLen)` was producing outbreak
// descriptions that stopped abruptly (e.g. "...in an intensive care unit
// (ICU" with no closing paren or period) — see
// project_nipah_india_outcome_recovered_2026_07_27 and
// project_truncated_descriptions_audit_2026_07_27 memory for the audit that
// found ~40 affected rows across WHO DON ingestion.
export function truncateAtSentence(text: string, maxLen: number): string {
  if (!text || text.length <= maxLen) return text;
  const slice = text.slice(0, maxLen);
  const lastSentenceEnd = Math.max(slice.lastIndexOf("."), slice.lastIndexOf("!"), slice.lastIndexOf("?"));
  if (lastSentenceEnd > maxLen * 0.5) return slice.slice(0, lastSentenceEnd + 1);
  const lastSpace = slice.lastIndexOf(" ");
  return lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
}
