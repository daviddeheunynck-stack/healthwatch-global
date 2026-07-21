/**
 * Unit test for sync-africa-cdc country detection.
 * Run: npx tsx scripts/test-africa-cdc-country-match.ts
 *
 * Regression guard for the 2026-07-21 Ebola/Congo phantom: a DRC-only article
 * was mis-attributed to Republic of the Congo because "Republic of the Congo"
 * (RoC's COUNTRIES key, name_en "Congo") is a substring of "Democratic Republic
 * of the Congo". See lib/africa-cdc-countries.ts.
 */

import { findMentionedAfricanCountries } from "@/lib/africa-cdc-countries";

let failures = 0;

// Asserts the FIRST detected country (the "primary" the route keys off) and
// optionally that a country is absent from the full detected list.
function check(
  name: string,
  text: string,
  expectPrimary: string | null,
  mustBeAbsent: string[] = [],
): void {
  const got     = findMentionedAfricanCountries(text);
  const primary = got.length > 0 ? got[0] : null;

  const primaryOk = primary === expectPrimary;
  const absentOk  = mustBeAbsent.every((c) => !got.includes(c));

  if (primaryOk && absentOk) {
    console.log(`  ✓ ${name}  ->  [${got.join(", ")}]`);
  } else {
    failures++;
    console.log(`  ✗ ${name}`);
    console.log(`      text:     ${JSON.stringify(text.slice(0, 90))}`);
    console.log(`      expected: primary=${expectPrimary}${mustBeAbsent.length ? `, absent=[${mustBeAbsent.join(", ")}]` : ""}`);
    console.log(`      got:      [${got.join(", ")}]`);
  }
}

console.log("── sync-africa-cdc country matching ─────────────────────────────────");

// THE phantom: real RSS-style text from the DRC-only Bundibugyo article.
// Must resolve to DRC and must NOT surface Republic of the Congo.
check(
  "DRC-only Bundibugyo article → DRC, not RoC",
  "The Democratic Republic of the Congo (DRC) has activated an emergency delivery " +
    "plan to break Bundibugyo Ebola transmission, with 2011 cases and 754 deaths reported.",
  "Democratic Republic of the Congo",
  ["Republic of the Congo"],
);

// DRC referenced only by the full name (no abbreviation).
check(
  "DRC full name only → DRC, not RoC",
  "An Ebola outbreak continues in the Democratic Republic of the Congo.",
  "Democratic Republic of the Congo",
  ["Republic of the Congo"],
);

// DRC referenced only by abbreviation.
check(
  "DRC abbreviation only (DRC) → DRC",
  "Health officials in (DRC) confirmed new Ebola cases this week.",
  "Democratic Republic of the Congo",
  ["Republic of the Congo"],
);

// A genuine Republic of the Congo article must still resolve to RoC.
check(
  "Genuine RoC article → RoC",
  "The Republic of the Congo reported a new cluster of mpox in Brazzaville.",
  "Republic of the Congo",
);

// Both Congos mentioned — DRC first — both detected, DRC primary.
check(
  "Both Congos, DRC first → DRC primary, both present",
  "The Democratic Republic of the Congo and the Republic of the Congo both reported cases.",
  "Democratic Republic of the Congo",
);

// Both Congos mentioned — RoC first — RoC primary, both present.
check(
  "Both Congos, RoC first → RoC primary",
  "The Republic of the Congo, unlike the Democratic Republic of the Congo, saw a decline.",
  "Republic of the Congo",
  [],
);

// Latent substring family the same fix covers.
check("Nigeria article → Nigeria, not Niger", "Lassa fever cases rose in Nigeria.", "Nigeria", ["Niger"]);
check("Niger article → Niger, not Nigeria", "A measles outbreak was reported in Niger this month.", "Niger", ["Nigeria"]);
check("South Sudan article → South Sudan, not Sudan", "Cholera spread across South Sudan.", "South Sudan", ["Sudan"]);

// Order = first mention, not declaration order.
check(
  "Ordering: Uganda mentioned before DRC → Uganda primary",
  "Uganda notified WHO before the Democratic Republic of the Congo did.",
  "Uganda",
);

console.log("─────────────────────────────────────────────────────────────────────");
if (failures === 0) {
  console.log("All checks passed ✓");
  process.exit(0);
} else {
  console.log(`${failures} check(s) FAILED ✗`);
  process.exit(1);
}
