-- ✅ APPLIQUÉE le 2026-09-07 (vérifié en production le 2026-09-08 par
-- daily-security-audit-healthwatch : la clé publiable reçoit HTTP 401 sur
-- select=cases,deaths,description, les colonnes publiques restent lisibles).
-- Voir docs/migrations-en-attente/README.md pour l'historique.
--
-- ---------------------------------------------------------------------------
--
-- Le mur payant sur cases/deaths/description est contournable en une requete.
--
-- Constat de l'audit du 2026-09-07, verifie EN PRODUCTION : la cle publiable
-- (`sb_publishable_…`) est extraite du bundle JS public de
-- healthwatch-global.com en quelques secondes — c'est sa nature, elle est faite
-- pour vivre dans le navigateur. Or `outbreaks` porte
-- `outbreaks_public_read … FOR SELECT USING (true)` PLUS un GRANT SELECT au
-- niveau TABLE pour anon/authenticated. Une seule requete PostgREST rend donc
-- les 121 lignes actives avec `cases`, `deaths` et `description` en clair, a
-- n'importe quel visiteur anonyme :
--
--   GET /rest/v1/outbreaks?select=cases,deaths,description&active=eq.true
--
-- Tout le dispositif de masquage construit du 2026-09-05 au 2026-09-06 (bande
-- qualitative, `RealStatsProvider`, les gates cote serveur, la fermeture de
-- /compare par fd646a97, les 4 routes d'API refermees par 9684d407) ne ferme
-- que les chemins empruntes par l'application. La porte, elle, reste ouverte :
-- le masquage est applique par du code que le client n'est pas oblige de
-- traverser.
--
-- C'est exactement la direction que David a validee le 2026-09-06 en poussant
-- fd646a97 juste apres le revert : chercher les chiffres reels atteignables
-- cote client sans passer par le serveur. C'en est la forme generale — /compare
-- n'en etait qu'une instance.
--
-- RLS filtre les LIGNES, pas les COLONNES : aucune policy ne peut exprimer
-- « tout le monde lit la ligne, mais deux colonnes restent payantes ». C'est un
-- GRANT au niveau colonne qui le dit, d'ou cette migration.
--
-- La policy `outbreaks_public_read` reste inchangee et volontairement permissive
-- (toute ligne active est publique — c'est le produit). Seules les 7 colonnes
-- que le mur payant masque deja partout ailleurs sortent du perimetre lisible
-- par anon/authenticated.
--
-- Consommateurs verifies un par un, et TOUS DEJA CORRIGES ET DEPLOYES en prod
-- (commit e9bb2123, 2026-09-07) : plus aucun ne lit ces colonnes avec la cle
-- publiable, donc cette migration peut etre appliquee sans rien casser.
--   - components/GlobalSearch.tsx, components/NotificationBell.tsx — n'ont
--     jamais lu de colonne sensible, inchanges.
--   - components/RealtimeAlertFeed.tsx — recuperait les chiffres dans le
--     payload Realtime, dont le garde de plan etait purement cote client ;
--     passe par /api/outbreak-stats (gate Pro cote serveur).
--   - app/widget/page.tsx, app/api/country-scorecard, /api/outbreak-benchmark,
--     /api/outbreak-cluster — lisaient avec la cle publiable ; passes au
--     service_role, derriere le gate d'autorisation qu'ils avaient deja.
-- Tout le reste du depot (~80 routes, les crons, lib/outbreaks.ts) lit deja en
-- service_role, que ni RLS ni ces GRANTs ne contraignent.
--
-- Effet de bord a connaitre : le GRANT etant desormais colonne par colonne,
-- une colonne AJOUTEE plus tard a `outbreaks` ne sera PAS lisible par
-- anon/authenticated tant qu'elle n'est pas ajoutee ici. C'est un defaut
-- fail-closed, choisi comme tel : une nouvelle colonne se decouvre absente
-- cote client, pas exposee en silence.

REVOKE SELECT ON public.outbreaks FROM anon, authenticated;

GRANT SELECT (
  id,
  disease,
  disease_en,
  disease_ar,
  country,
  country_en,
  country_ar,
  region,
  lat,
  lng,
  risk_level,
  date,
  source,
  active,
  is_seed,
  created_at,
  updated_at,
  is_pheic,
  push_notified_at,
  recovered,
  admin1,
  admin1_lat,
  admin1_lng,
  event_id,
  verification_status,
  response_phase,
  ihr_event_id,
  first_seen_at,
  who_don_published_at,
  source_priority,
  is_backfill,
  source_confirmed_at
) ON public.outbreaks TO anon, authenticated;

COMMENT ON COLUMN public.outbreaks.cases IS
  'Payant : non lisible par anon/authenticated (audit 2026-09-07). Passer par le service_role derriere un gate, cf. /api/outbreak-stats.';
COMMENT ON COLUMN public.outbreaks.deaths IS
  'Payant : non lisible par anon/authenticated (audit 2026-09-07). Passer par le service_role derriere un gate, cf. /api/outbreak-stats.';
COMMENT ON COLUMN public.outbreaks.description IS
  'Payant : non lisible par anon/authenticated (audit 2026-09-07) — le bulletin cite les chiffres exacts que la bande masque.';
