-- Backfills outbreaks.source_confirmed_at (migration 20260822120000) for the
-- 9 rows already verified by hand against their primary source on 2026-08-20
-- and 2026-08-21 — previously tracked only as a hardcoded disease_en|
-- country_en|date Set (VERIFIED_STALE) in app/api/cron/data-quality/
-- route.ts, which this migration retires in favour of this column. Keyed by
-- disease_en/country_en/date, same as the old Set, so each UPDATE only
-- touches the exact row it was verified against — if `date` has since
-- advanced (a real new bulletin landed), the WHERE clause simply matches
-- nothing, which is correct: a stale confirmation shouldn't silently attach
-- to newer data.
update outbreaks set source_confirmed_at = '2026-08-21'
  where lower(disease_en) = 'diphtheria' and lower(country_en) = 'nigeria' and date = '2026-03-22';
-- Leadership (Nigeria)/NCDC/MSF cumulative since 2022 — David's reframe of
-- 2026-08-15. NCDC's own numbered sitrep series tracks a different (YTD-only)
-- window, already rejected as a substitute, not a fresher replacement.
-- Re-verified 2026-08-21: still no newer "since 2022" cumulative exists.

update outbreaks set source_confirmed_at = '2026-08-21'
  where lower(disease_en) = 'diphtheria' and lower(country_en) = 'guinea' and date = '2026-02-22';
-- WHO SAGE RRA v.2 (16 Mar 2026), summary table: "Guinea 795 151 (19%)" —
-- matches exactly. No v.3 exists (confirmed 2026-07-30, re-confirmed
-- 2026-08-21 by extracting the PDF text directly).

update outbreaks set source_confirmed_at = '2026-08-21'
  where lower(disease_en) = 'dengue fever' and lower(country_en) = 'american samoa' and date = '2026-07-21';
-- SPC/WHO Pacific multi-country dengue report, 14 Aug 2026 edition —
-- American Samoa's own country-update section is itself still dated 21 Jul
-- in that newer edition; no fresher country-specific figure published.

update outbreaks set source_confirmed_at = '2026-08-20'
  where lower(disease_en) = 'cholera' and lower(country_en) = 'kenya' and date = '2026-07-12';
-- WHO AFRO Week 28 bulletin remains the newest in the series (no Week 29+
-- found despite direct URL attempts); cross-checked against ECDC's cholera
-- monthly (refreshed 27 Jul), identical Kenya figures — genuinely no new
-- cases since, not a reporting gap.

update outbreaks set source_confirmed_at = '2026-08-20'
  where lower(disease_en) = 'marburg virus disease' and lower(country_en) = 'uganda' and date = '2026-07-16';
-- No WHO DON was ever issued for this event; WHO's own IHR information
-- request to Uganda remains unanswered as of this check. Genuine reporting
-- silence, not a missed update.

update outbreaks set source_confirmed_at = '2026-08-20'
  where lower(disease_en) = 'measles' and lower(country_en) = 'canada' and date = '2026-07-25';
-- PAHO Situation Report #8 (31 Jul 2026): "Canada: 1,107 cumulative
-- confirmed cases" — matches exactly.

update outbreaks set source_confirmed_at = '2026-08-20'
  where lower(disease_en) = 'measles' and lower(country_en) = 'peru' and date = '2026-07-25';
-- PAHO Situation Report #8 (31 Jul 2026), summary table: "Peru* 1,139 0" —
-- matches exactly.

update outbreaks set source_confirmed_at = '2026-08-20'
  where lower(disease_en) = 'measles' and lower(country_en) = 'bolivia' and date = '2026-07-25';
-- PAHO Situation Report #8 (31 Jul 2026), summary table: "Bolivia* 85 1" —
-- matches exactly.

update outbreaks set source_confirmed_at = '2026-08-21'
  where lower(disease_en) = 'polio' and lower(country_en) = 'pakistan' and date = '2026-07-22';
-- endpolio.com.pk district-wise page (the row's own cited source): 3
-- confirmed WPV1 cases (Bannu, North Waziristan, Sujawal) — matches exactly.
-- Cross-checked against GPEI's own weekly "polio this week" page, no new
-- Pakistan case that week either.
