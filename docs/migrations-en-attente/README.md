# Migrations prêtes, en attente d'application

Une migration déposée ici est **écrite, relue et prête**, mais **pas encore
appliquée en base**. Elle attend une action de David.

## Pourquoi pas dans `supabase/migrations/` ?

Parce que le hook de pre-push (`scripts/check-migrations-applied.mjs`) lit ce
répertoire **sur le disque** — pas l'index git. Un fichier `.sql` qui y traîne
sans être appliqué en base fait **refuser le push de toutes les routines du
dépôt**, pas seulement de celle qui l'a écrit. Ce dossier-ci évite ce dégât
collatéral tout en gardant la migration versionnée et visible.

## Comment appliquer une migration en attente

```bash
# 1. Vérifier que la CLI est bien liée à la PROD (et non à dev)
cat supabase/.temp/project-ref     # doit afficher tqznwmpkokdzrszysbcm

# 2. Remettre le fichier à sa place
mv docs/migrations-en-attente/<fichier>.sql supabase/migrations/

# 3. Appliquer
npx supabase db push --linked

# 4. Vérifier
node scripts/check-migrations-applied.mjs   # doit dire "toutes appliquees en base"

# 5. Committer le fichier depuis supabase/migrations/
```

Une fois appliquée et committée, retirer son entrée de la liste ci-dessous.

---

## En attente

_(aucune pour le moment)_

## Historique

### `20260907050000_revoke_paywalled_columns_from_public_roles.sql` — APPLIQUÉE le 2026-09-07

Déposée le 2026-09-07 par `daily-security-audit-healthwatch`, appliquée le
même jour en session interactive sur ordre explicite de David (« applique la
migration »). Corrigeait une fuite du mur payant : `outbreaks` accordait
`SELECT` sur toutes ses colonnes (dont `cases`/`deaths`/`description`) à
`anon`/`authenticated`, contournable en une requête PostgREST avec la clé
publiable lisible dans le bundle JS public.

Vérifié après application : `GET .../outbreaks?select=cases,deaths` avec la
clé publiable renvoie `401 permission denied for table outbreaks` ; les
colonnes non payantes (`id`, `disease_en`, `risk_level`, `region`, …) restent
lisibles ; smoke check des pages publiques (dashboard, hub disease/country/
region, widget) tous 200 ; `check-migrations-applied.mjs` confirme 90
migrations locales, toutes appliquées en base.

**Question restée ouverte, non tranchée à cette occasion** : la page permalien
`app/[locale]/outbreak/[id]/page.tsx` réimprime les chiffres exacts dans sa
`meta description` (l. 262) et son JSON-LD, alors que son corps les masque —
c'est désormais la dernière surface publique à le faire. Arbitrage SEO, pas un
bug ; voir le rapport d'audit du 2026-09-07.
