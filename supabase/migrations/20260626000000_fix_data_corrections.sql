-- Data corrections — 2026-06-26
-- Manual fixes for entries with incorrect/hallucinated data discovered during audit.
-- Root causes documented inline. Pipeline guards added in same commit.

-- 1. France Ebola — hallucinated entry (no Ebola case ever confirmed in France).
--    Created by sync-spf misattributing an SPF advisory about DRC outbreak to France.
UPDATE outbreaks SET active = false
WHERE id = '020b129c-d283-4a2c-a95b-3827322a77c1';

-- 2. Hantavirus Mondial — duplicate of DON604 "Plusieurs pays" (cruise ship cluster).
--    Created by sync-ecdc-threats "worldwide overview" article; WHO DON row is canonical.
UPDATE outbreaks SET active = false
WHERE id = '93dd656a-9783-40c4-8b56-db343d1d44d4';

-- 3. Fièvre jaune — DON610 only parsed Africa (16 cases from DRC/CAR).
--    Americas total (PAHO sitrep 2026): 79 cases (Bolivia 34, Brazil 31, Peru 14).
--    Combined global total = 79 + 16 = 95.
UPDATE outbreaks SET cases = 95
WHERE id = '2a574b83-2236-4a9b-be3e-ed45b5257277';

-- 4. Rougeole États-Unis — stale 2025-DON561 data (4,318 cases).
--    CDC as of 2026-06-18: 2,104 confirmed cases, 3 deaths.
UPDATE outbreaks
SET cases  = 2104,
    deaths = 3,
    date   = '2026-06-18',
    source = 'https://www.cdc.gov/measles/data-research/index.html'
WHERE id = '7d519ce6-c281-4945-a2ef-ebead0600b67';

-- 5. Mpox RDC — stale 2024-DON528 data (19,845 / 612).
--    WHO Mpox global tracker as of 2026-06-14: DRC 37,503 confirmed, 78 deaths.
UPDATE outbreaks
SET cases  = 37503,
    deaths = 78,
    date   = '2026-06-14',
    source = 'https://worldhealthorg.shinyapps.io/mpx_global'
WHERE id = 'c5632295-8df7-4546-9225-60f844d40a00';

-- 6. Mpox Mondial — ECDC-sourced 0/0 placeholder (check-mpox-sitrep not yet triggered).
--    WHO Mpox global tracker 2026-01-31 snapshot: 179,612 confirmed cases globally.
--    check-mpox-sitrep cron will override with latest WHO sitrep when next successful.
UPDATE outbreaks
SET cases  = 179612,
    date   = '2026-01-31',
    source = 'https://worldhealthorg.shinyapps.io/mpx_global'
WHERE id = 'dbc9c1d0-9299-4607-a027-f229ec8c25ce';

-- 7. Dengue Brésil — no reliable automated source available.
--    Brasil.io requires auth, PAHO returning 502, InfoDengue JS-only.
--    Deactivate until a static/parseable source is found.
UPDATE outbreaks SET active = false
WHERE id = 'dfc8f147-7803-4d28-9627-9070a1a38368';
