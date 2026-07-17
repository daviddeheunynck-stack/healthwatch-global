// Escapes "<" so a JSON-LD payload embedded via dangerouslySetInnerHTML can never be
// interpreted as closing the enclosing <script> tag (or opening a new one) — e.g. if a
// scraped disease/country/description field ever contained the literal string
// "</script><script>alert(1)</script>". `<` is valid inside a JSON string and
// application/ld+json parsers (and JSON.parse) decode it identically to the literal "<",
// so this is safe for both HTML and JSON semantics. Found 2026-07-16: none of the 12
// JSON-LD sites across the app escaped this — currently unexploitable in practice since
// disease/country names are resolved through a fixed dictionary, but the outbreak page
// also embeds `o.date`/`o.updated_at`/free-text `description`, so this is latent, not
// theoretical.
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
