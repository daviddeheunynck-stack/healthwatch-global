-- ============================================================
-- HealthWatch Global — Seed data
-- 20 representative outbreaks spread across all 5 regions.
-- These rows are permanent (is_seed = true) and are protected
-- from the stale-deactivation cron by the WHERE clause in
-- sync-outbreaks (add: .neq("is_seed", true) to the update).
--
-- Run once in your Supabase SQL editor:
--   https://supabase.com/dashboard → SQL Editor → New query
-- ============================================================

-- Ensure the is_seed column exists (safe to run multiple times)
ALTER TABLE outbreaks
  ADD COLUMN IF NOT EXISTS is_seed BOOLEAN NOT NULL DEFAULT FALSE;

-- Wipe existing seed rows before re-seeding (idempotent)
DELETE FROM outbreaks WHERE is_seed = TRUE;

-- Insert seed data
INSERT INTO outbreaks
  (disease, disease_en, disease_ar, country, country_en, country_ar,
   region, lat, lng, cases, deaths, risk_level, date, source, description, active, is_seed)
VALUES

-- ── AFRICA ──────────────────────────────────────────────────────────────────
('Mpox (variole du singe)', 'Mpox (Monkeypox)', 'جدري القردة',
 'République démocratique du Congo', 'Democratic Republic of Congo', 'جمهورية الكونغو الديمقراطية',
 'africa', -4.03, 21.76, 19845, 612, 'high',
 CURRENT_DATE - INTERVAL '3 days',
 'https://www.who.int/emergencies/disease-outbreak-news/item/mpox-drc-2024',
 'Ongoing mpox outbreak with clade Ib variant. Highest case burden in Équateur and South Kivu provinces.',
 true, true),

('Choléra', 'Cholera', 'الكوليرا',
 'Éthiopie', 'Ethiopia', 'إثيوبيا',
 'africa', 9.14, 40.49, 8320, 187, 'high',
 CURRENT_DATE - INTERVAL '5 days',
 'https://www.who.int/emergencies/disease-outbreak-news/item/cholera-ethiopia-2024',
 'Cholera outbreak linked to contaminated water sources in Oromia and Somali regions.',
 true, true),

('Fièvre hémorragique de Marburg', 'Marburg Haemorrhagic Fever', 'حمى ماربورغ النزفية',
 'Rwanda', 'Rwanda', 'رواندا',
 'africa', -1.94, 29.87, 66, 15, 'high',
 CURRENT_DATE - INTERVAL '10 days',
 'https://www.who.int/emergencies/disease-outbreak-news/item/marburg-rwanda-2024',
 'Marburg virus disease outbreak under active investigation. Contact tracing ongoing in Kigali.',
 true, true),

('Méningite à méningocoques', 'Meningococcal Meningitis', 'التهاب السحايا',
 'Niger', 'Niger', 'النيجر',
 'africa', 17.61, 8.08, 1240, 89, 'medium',
 CURRENT_DATE - INTERVAL '8 days',
 'https://www.who.int/emergencies/disease-outbreak-news/item/meningitis-niger-2024',
 'Meningococcal meningitis surge during dry season. Vaccination campaign under way.',
 true, true),

('Dengue', 'Dengue Fever', 'حمى الضنك',
 'Côte d''Ivoire', 'Côte d''Ivoire', 'ساحل العاج',
 'africa', 7.54, -5.55, 3450, 41, 'medium',
 CURRENT_DATE - INTERVAL '12 days',
 'https://www.who.int/emergencies/disease-outbreak-news/item/dengue-cotedivoire-2024',
 'Urban dengue transmission in Abidjan following heavy rains. Vector control operations activated.',
 true, true),

-- ── ASIA ────────────────────────────────────────────────────────────────────
('Grippe aviaire H5N1', 'Avian Influenza H5N1', 'إنفلونزا الطيور H5N1',
 'Cambodge', 'Cambodia', 'كمبوديا',
 'asia', 12.57, 104.99, 14, 9, 'high',
 CURRENT_DATE - INTERVAL '6 days',
 'https://www.who.int/emergencies/disease-outbreak-news/item/h5n1-cambodia-2024',
 'Sporadic human cases of H5N1. All cases linked to backyard poultry. No sustained human-to-human transmission detected.',
 true, true),

('Choléra', 'Cholera', 'الكوليرا',
 'Bangladesh', 'Bangladesh', 'بنغلاديش',
 'asia', 23.68, 90.36, 12600, 98, 'medium',
 CURRENT_DATE - INTERVAL '7 days',
 'https://www.who.int/emergencies/disease-outbreak-news/item/cholera-bangladesh-2024',
 'Seasonal cholera surge in Cox''s Bazar refugee settlements. ORS distribution and water chlorination ongoing.',
 true, true),

('Dengue', 'Dengue Fever', 'حمى الضنك',
 'Philippines', 'Philippines', 'الفلبين',
 'asia', 12.88, 121.77, 87400, 320, 'medium',
 CURRENT_DATE - INTERVAL '4 days',
 'https://www.who.int/emergencies/disease-outbreak-news/item/dengue-philippines-2024',
 'Nationwide dengue increase. National dengue alert issued by Department of Health.',
 true, true),

('Encéphalite japonaise', 'Japanese Encephalitis', 'التهاب الدماغ الياباني',
 'Inde', 'India', 'الهند',
 'asia', 22.35, 78.66, 945, 112, 'high',
 CURRENT_DATE - INTERVAL '14 days',
 'https://www.who.int/emergencies/disease-outbreak-news/item/je-india-2024',
 'Japanese encephalitis cases reported in Uttar Pradesh and Bihar. Children under 15 most affected.',
 true, true),

('Leptospirose', 'Leptospirosis', 'داء البريميات',
 'Thaïlande', 'Thailand', 'تايلاند',
 'asia', 15.87, 100.99, 3210, 38, 'low',
 CURRENT_DATE - INTERVAL '9 days',
 'https://www.who.int/emergencies/disease-outbreak-news/item/leptospirosis-thailand-2024',
 'Post-flood leptospirosis surge in northern Thailand. Public health advisories issued.',
 true, true),

-- ── AMERICAS ────────────────────────────────────────────────────────────────
('Dengue', 'Dengue Fever', 'حمى الضنك',
 'Brésil', 'Brazil', 'البرازيل',
 'americas', -14.24, -51.93, 6200000, 4180, 'high',
 CURRENT_DATE - INTERVAL '2 days',
 'https://www.who.int/emergencies/disease-outbreak-news/item/dengue-brazil-2024',
 'Record dengue season. National emergency declared. Serotypes DENV-1 and DENV-3 co-circulating.',
 true, true),

('Grippe aviaire H5N2', 'Avian Influenza H5N2', 'إنفلونزا الطيور H5N2',
 'Mexique', 'Mexico', 'المكسيك',
 'americas', 23.63, -102.55, 1, 1, 'high',
 CURRENT_DATE - INTERVAL '30 days',
 'https://www.who.int/emergencies/disease-outbreak-news/item/h5n2-mexico-2024',
 'First confirmed human fatality from H5N2 globally. No linked cases identified. Investigation ongoing.',
 true, true),

('Oropouche', 'Oropouche Fever', 'حمى أوروبوشي',
 'Cuba', 'Cuba', 'كوبا',
 'americas', 21.52, -77.78, 74, 2, 'medium',
 CURRENT_DATE - INTERVAL '18 days',
 'https://www.who.int/emergencies/disease-outbreak-news/item/oropouche-cuba-2024',
 'Imported Oropouche virus cases from Brazil. Island-wide vector surveillance activated.',
 true, true),

('Choléra', 'Cholera', 'الكوليرا',
 'Haïti', 'Haiti', 'هايتي',
 'americas', 18.97, -72.29, 28500, 430, 'high',
 CURRENT_DATE - INTERVAL '1 days',
 'https://www.who.int/emergencies/disease-outbreak-news/item/cholera-haiti-2024',
 'Ongoing cholera transmission amid civil unrest. Médecins Sans Frontières and PAHO responding.',
 true, true),

-- ── EUROPE ──────────────────────────────────────────────────────────────────
('Mpox (variole du singe)', 'Mpox (Monkeypox)', 'جدري القردة',
 'Allemagne', 'Germany', 'ألمانيا',
 'europe', 51.17, 10.45, 312, 0, 'low',
 CURRENT_DATE - INTERVAL '20 days',
 'https://www.who.int/emergencies/disease-outbreak-news/item/mpox-germany-2024',
 'Sporadic mpox cases in Germany. All cases clade II. Vaccination available for high-risk groups.',
 true, true),

('Rougeole', 'Measles', 'الحصبة',
 'Roumanie', 'Romania', 'رومانيا',
 'europe', 45.94, 24.97, 2890, 12, 'medium',
 CURRENT_DATE - INTERVAL '15 days',
 'https://www.ecdc.europa.eu/en/news-events/measles-romania-2024',
 'Measles outbreak driven by low vaccination coverage in rural communities. ECDC monitoring.',
 true, true),

('Fièvre de West Nile', 'West Nile Fever', 'حمى غرب النيل',
 'Italie', 'Italy', 'إيطاليا',
 'europe', 41.87, 12.57, 184, 8, 'medium',
 CURRENT_DATE - INTERVAL '11 days',
 'https://www.ecdc.europa.eu/en/news-events/west-nile-italy-2024',
 'West Nile virus season. Cases reported in Po Valley. Blood supply safety measures in place.',
 true, true),

-- ── OCEANIA ─────────────────────────────────────────────────────────────────
('Dengue', 'Dengue Fever', 'حمى الضنك',
 'Fidji', 'Fiji', 'فيجي',
 'oceania', -17.71, 178.07, 6740, 14, 'medium',
 CURRENT_DATE - INTERVAL '16 days',
 'https://www.who.int/emergencies/disease-outbreak-news/item/dengue-fiji-2024',
 'Dengue type 2 epidemic in Fiji. Urban and semi-urban areas affected. WHO supporting response.',
 true, true),

('Leptospirose', 'Leptospirosis', 'داء البريميات',
 'Papouasie-Nouvelle-Guinée', 'Papua New Guinea', 'بابوا غينيا الجديدة',
 'oceania', -6.31, 143.96, 890, 22, 'medium',
 CURRENT_DATE - INTERVAL '22 days',
 'https://www.who.int/emergencies/disease-outbreak-news/item/leptospirosis-png-2024',
 'Leptospirosis cases following floods in Highlands region. Remote communities with limited healthcare access.',
 true, true),

('Typhus des broussailles', 'Scrub Typhus', 'حمى الأدغال',
 'Australie', 'Australia', 'أستراليا',
 'oceania', -25.27, 133.78, 145, 1, 'low',
 CURRENT_DATE - INTERVAL '25 days',
 'https://www.health.gov.au/diseases/scrub-typhus',
 'Scrub typhus cases in Queensland and Northern Territory. Travellers and outdoor workers advised.',
 true, true);
