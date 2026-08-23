# Ce que fait chaque cron

**Ce fichier ne dit rien des horaires, et c'est délibéré.**

La seule source des horaires est `vercel.json` — c'est le fichier que Vercel lit
réellement pour enregistrer les Cron Jobs. `scripts/check-cron-schedule.mjs`
rapproche chaque commentaire `Schedule: <cron>` d'un fichier de route de cette
source unique, et fait échouer le build en cas de divergence.

Une première version de ce document portait une colonne « cron » à côté de chaque
entrée. Elle a été retirée le 2026-08-23 au soir : un second fichier d'horaires
est une nouvelle chose à tenir synchronisée, pas une réparation de l'ancienne.
L'argument est celui de `check-cron-schedule.mjs`, et il est juste.

Ce qui reste ici est ce que le code ne dit nulle part ailleurs : **à quoi sert
chaque cron, en une ligne.** Cinquante routes dont les noms se ressemblent, et
rien qui permette de savoir laquelle lit une source, laquelle écrit à un client,
laquelle surveille les deux autres.

**Preuve de run** : uniforme pour tous. Chaque route appelle
`logCronRun(supabase, "<nom>", …)` — l'historique est en base, pas dans des
fichiers d'archive dispersés.

**Tenue à jour** : un cron ajouté ou retiré de `vercel.json` gagne ou perd sa
ligne ici dans la même passe. Un cron retiré descend dans « Crons retirés »
plutôt que de disparaître sans trace. Rien ici n'est vérifié par un script — ce
fichier décrit des intentions, pas des valeurs.

## Crons récurrents (13) — infra-quotidiens

| Chemin | Rôle |
|---|---|
| `/api/cron/sync-outbreaks` | Ingestion horaire du flux WHO Disease Outbreak News — source primaire de `outbreaks`. |
| `/api/cron/trigger-webhooks` | Tire les webhooks clients pour les foyers risque haut/moyen modifiés depuis leur dernier envoi. |
| `/api/cron/trigger-tripwires` | Vérifie si le compteur de cas d'un foyer a franchi le seuil d'un tripwire client. |
| `/api/cron/trigger-pheic-alerts` | Alertes sur déclaration ou évolution d'une urgence de santé publique internationale. |
| `/api/cron/trigger-subscriber-alerts` | Alertes aux abonnés d'un foyer précis. |
| `/api/admin/enrich-admin1` | Enrichissement admin1 des lignes restées à « ~ ». Seul cron hors `/api/cron/`, pour raisons historiques. |
| `/api/cron/trigger-category-alerts` | Alertes par catégorie de maladie. |
| `/api/cron/check-new-don` | Détecte les articles WHO DON jamais vus et prévient l'admin. Décalé de 20 min après `sync-outbreaks`, exprès. |
| `/api/cron/disease-coverage` | Contrôle des trous de couverture dans la couche de référence maladies, 30 min après le cycle d'ingestion. |
| `/api/cron/sync-cdc-han` | Flux CDC Health Alert Network. |
| `/api/cron/trigger-country-risk-alerts` | Alertes de changement de niveau de risque pays. |
| `/api/cron/sync-signals` | **Désactivé pour raison légale** (ToS ReliefWeb) mais toujours planifié — voir « Écarts ouverts ». |
| `/api/cron/trigger-geofence-alerts` | Alertes de zone géographique. |

## Crons quotidiens (30)

| Chemin | Rôle |
|---|---|
| `/api/cron/sync-taiwan-cdc` | Surveillance dengue du CDC taïwanais. |
| `/api/cron/signup-canary` | Canari : vérifie que le parcours d'inscription fonctionne encore. |
| `/api/cron/sync-brevo-blocklist` | Synchronise la blocklist Brevo vers `profiles.email_blocked_at`. Alimente la suppression des envois. |
| `/api/cron/sync-ukhsa` | Flux ATOM gov.uk de l'UKHSA. Deux passages : matin et après-midi. |
| `/api/cron/sync-malaysia-dengue` | Tableau de bord iDengue malaisien. |
| `/api/cron/health-check` | Contrôle de santé applicatif. Homonyme de la routine Claude Desktop « Daily health check » — les deux n'ont rien à voir. |
| `/api/cron/sync-spf` | Flux RSS de Santé Publique France. Deux passages. |
| `/api/cron/sync-drc-sitrep` | Détection des sitreps Ebola RDC **désactivée** (ToS ReliefWeb) ; ne subsiste que le contrôle « ligne Ebola RDC manquante ». |
| `/api/cron/sync-endemic-data` | Lignes « officielles » hors WHO DON : agences nationales et bureaux régionaux OMS. |
| `/api/cron/sync-who-regional` | Surveillance des maladies endémiques et à forte charge non couvertes systématiquement par WHO DON. |
| `/api/cron/sync-who-afro` | Bureau régional OMS Afrique. Publie 1 à 3 jours avant le siège pour les foyers africains. |
| `/api/cron/check-mpox-sitrep` | Sitreps Mpox de l'OMS : télécharge le PDF et en extrait les chiffres globaux. |
| `/api/cron/pilot-follow-up` | Relance des comptes **pilotes** activés 8 jours plus tôt. Le filtre `is_pilot` a été ajouté le 23/08 : jusque-là il écrivait à tous les essais. |
| `/api/cron/pilot-closing-reminder` | Relance de la session de clôture promise aux candidats pilotes institutionnels. |
| `/api/cron/sync-ecdc-threats` | Flux « Epidemiological update » de l'ECDC. |
| `/api/cron/sync-africa-cdc` | Actualités Africa CDC — foyers subsahariens souvent absents de WHO DON. |
| `/api/cron/sync-ncdc` | NCDC Nigeria (Lassa, choléra, mpox, diphtérie, rougeole, méningite, fièvre jaune). |
| `/api/cron/sync-who-emro` | Bureau régional OMS Méditerranée orientale — MERS-CoV, CCHF, choléra. |
| `/api/cron/onboarding-sequence` | Séquence d'emails d'accueil. |
| `/api/cron/trial-reminders` | Rappels de fin d'essai, restreints aux jours ouvrés. |
| `/api/cron/sync-paho-alerts` | Alertes et mises à jour épidémiologiques de la PAHO. |
| `/api/cron/data-quality` | Contrôle qualité et corrections automatiques. **Écrit `cases`, `deaths` et `active` 30 min avant la chaîne d'alerte** — couplage par effet de bord, pas un verrou. |
| `/api/cron/expire-trials` | Expire les essais jamais convertis en abonnement Stripe. |
| `/api/cron/sync-cdc-notices` | Travel Health Notices du CDC (niveaux 1/2/3). |
| `/api/cron/regional-alerts` | **Chaîne d'alerte 1/4** — alertes régionales. |
| `/api/cron/watchlist-alerts` | **Chaîne d'alerte 2/4** — listes de surveillance. |
| `/api/cron/push-alerts` | **Chaîne d'alerte 3/4** — notifications push. Un seul push par foyer, à sa première apparition. |
| `/api/cron/disease-alerts` | **Chaîne d'alerte 4/4** — alertes par maladie suivie. |
| `/api/cron/winback-sequence` | Email de reconquête, 3 jours après expiration de l'essai. |
| `/api/cron/sync-usda-aphis` | H5N1 bovin de l'USDA APHIS, agrégé par État. |

## Crons hebdomadaires (7) — tous le lundi

Les quatre premiers sont les mailers du lundi. **Leur ordre est porteur** : le
verrou `weekly_email_send_log` accorde une adresse au premier arrivé, donc
l'ordre d'exécution *est* l'ordre de priorité — sitrep payant d'abord, signal
gratuit en dernier. Les réordonner change qui gagne.

| Chemin | Rôle |
|---|---|
| `/api/cron/send-sitrep-emails` | **Mailer 1/4** — sitrep aux rapports programmés (payant). Prioritaire : réserve ses destinataires avant les autres. |
| `/api/cron/trigger-regional-digest` | **Mailer 2/4** — digest régional des comptes Pro. |
| `/api/cron/weekly-digest` | **Mailer 3/4** — digest de la newsletter (`subscriptions`, sans lien avec `profiles`). |
| `/api/cron/weekly-signal` | **Mailer 4/4** — signal hebdo aux comptes gratuits. Le moins prioritaire, donc le dernier. |
| `/api/cron/sync-pacific-surveillance` | Veille des îles du Pacifique, région quasi sans couverture automatique. |
| `/api/cron/sync-wpro-dengue-update` | Bulletin dengue bimensuel de l'OMS WPRO. |
| `/api/cron/sync-samoa-dengue` | Sitrep dengue du ministère de la santé samoan. |

## Écarts ouverts — décisions en attente

Relevés le 2026-08-23 en construisant ce registre. Aucun n'a été corrigé : ce
sont des arbitrages, pas des bugs.

**Quatre routes annoncent un rythme restreint et tournent tous les jours.**
Aucune ne contient de garde sur le jour de la semaine — vérifié fichier par
fichier, ce n'est pas une auto-limitation interne :

| Route | En-tête | Si l'en-tête a raison |
|---|---|---|
| `check-mpox-sitrep` | « Twice-weekly (Wed + Sat) » | `10 8 * * 3,6` |
| `sync-africa-cdc` | « runs Wed + Sat » | `10 9 * * 3,6` |
| `sync-who-afro` | « runs Mon/Wed/Fri » | `0 8 * * 1,3,5` |
| `sync-who-emro` | « runs Mon/Wed/Fri » | `20 9 * * 1,3,5` |

Soit le planning a été élargi exprès et les quatre en-têtes ont dérivé, soit ces
scrapers sollicitent l'OMS et Africa CDC deux à trois fois plus que voulu. Les quatre sont signalés par `scripts/check-cron-schedule.mjs` tant que leur
commentaire et `vercel.json` disent des choses différentes.

**`sync-signals` est désactivé mais toujours planifié** — 4 exécutions par jour
d'une route dont l'en-tête dit « DISABLED (legal) ». Soit le retirer de
`vercel.json`, soit documenter ici pourquoi il doit rester armé.

**`sync-drc-sitrep` est dans le même cas partiel** : sa fonction principale est
désactivée, seul subsiste un contrôle de présence de ligne. Un cron quotidien
pour ça se défend, mais ça mérite d'être dit plutôt que déduit.

**`sync-endemic-data` s'annonce « Weekly sync »** et tourne quotidiennement. À la
lecture, « weekly » y décrit la cadence de publication des sources, pas celle du
cron — formulation à clarifier plutôt qu'écart réel.

## Crons retirés

Aucun à ce jour. Une route retirée de `vercel.json` vient ici avec sa date et son
motif, plutôt que de disparaître sans trace.
