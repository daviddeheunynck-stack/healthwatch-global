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

### `20260907050000_revoke_paywalled_columns_from_public_roles.sql`

Déposée le **2026-09-07** par `daily-security-audit-healthwatch`.

**Ce qu'elle corrige.** Le mur payant sur `cases`/`deaths`/`description` est
contournable en une requête : la clé publiable se lit dans le bundle JS public,
et `outbreaks` accorde `SELECT` sur **toutes** ses colonnes à `anon` /
`authenticated`. Vérifié en production le jour même — les 121 lignes actives
sortent en clair sur un simple `GET /rest/v1/outbreaks?select=cases,deaths`.
Tout le masquage construit les 05–06/09 ne ferme que les chemins que
l'application emprunte ; celui-ci ne passe pas par elle.

**Sans risque de casse au moment de l'appliquer.** La moitié « code » est déjà
poussée et déployée (commit `e9bb2123`) : plus aucune surface ne lit ces
colonnes avec la clé publiable. C'est justement pour ça qu'elle a été séparée.

**Pourquoi elle n'a pas été appliquée par la routine.** Les deux tentatives de
`supabase db push` ont été refusées par le classificateur de permissions de la
session (modification de schéma en production). Refus non contourné,
délibérément.

**Question de conception laissée ouverte, à trancher par David** (elle n'est
pas un préalable à cette migration, qui vaut le coup indépendamment) : la page
permalien `app/[locale]/outbreak/[id]/page.tsx` réimprime toujours les chiffres
exacts dans sa `meta description` (l. 262) et son JSON-LD, alors que son corps
les masque. C'est un arbitrage SEO, pas un bug — voir le rapport d'audit du
2026-09-07.
