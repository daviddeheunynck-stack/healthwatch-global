# Registre canonique des crons Vercel

Source de vérité **indépendante** de `vercel.json`, et c'est tout son intérêt.

`vercel.json` dit ce qui *tourne*. Ce fichier dit ce qui *doit* tourner, et pourquoi.
Tant qu'il n'existait qu'une seule source, une dérive était invisible par
construction : rien ne pouvait la contredire. Quatre routes ont ainsi tourné tous
les jours pendant des semaines en annonçant dans leur propre en-tête un rythme
bihebdomadaire ou trihebdomadaire, sans qu'aucun contrôle ne puisse le voir —
voir la section « Écarts ouverts » en bas.

Repris de `~/.claude/scheduled-tasks/_shared/schedules.md`, qui joue exactement ce
rôle pour les routines Claude Desktop depuis le 17/08 après trois pertes du
registre live. Le registre live des crons, lui, ne se perd pas — `vercel.json` est
versionné. Le risque ici n'est pas la perte, c'est la **dérive silencieuse entre
l'horaire réel et ce que le code prétend faire**.

**Créé le 2026-08-23**, à partir de l'état de `vercel.json` ce jour-là, après
l'étalement des minutes (pic de simultanéité ramené de 9 à 3).

## Comment ce fichier est tenu

`scripts/check-cron-registry.mjs` compare ce fichier à `vercel.json` et **fait
échouer le build** en cas d'écart. Il tourne via `prebuild`, donc aussi bien en
local que chez Vercel — un garde-fou qui dépend d'un geste manuel n'en est pas un
(même raisonnement que `scripts/setup-git-hooks.mjs`).

Le contrôle est volontairement **strict et bête** : il ne compare que le chemin et
l'expression cron, deux chaînes exactes des deux côtés. Il ne lit jamais la
colonne « Rôle », qui est de la prose pour humains. Un build ne peut donc pas
casser sur une tournure de phrase.

À chaque ajout, suppression ou changement d'horaire d'un cron :
1. modifier `vercel.json` **et** la ligne correspondante ici, dans la même passe ;
2. si l'en-tête du fichier de route nomme son créneau, le corriger aussi —
   c'est la troisième source, celle qui a dérivé ;
3. une route retirée de `vercel.json` descend dans « Crons retirés », elle ne
   disparaît pas d'ici.

**Preuve de run** : uniforme pour tous, contrairement aux routines Desktop.
Chaque route appelle `logCronRun(supabase, "<nom>", …)` — l'historique est en
base, pas dans des fichiers d'archive dispersés.

## Crons récurrents (13) — infra-quotidiens

| Chemin | Cron | Rôle |
|---|---|---|
| `/api/cron/sync-outbreaks` | `0 * * * *` | Ingestion horaire du flux WHO Disease Outbreak News — source primaire de `outbreaks`. |
| `/api/cron/trigger-webhooks` | `0,30 * * * *` | Tire les webhooks clients pour les foyers risque haut/moyen modifiés depuis leur dernier envoi. |
| `/api/cron/trigger-tripwires` | `2,32 * * * *` | Vérifie si le compteur de cas d'un foyer a franchi le seuil d'un tripwire client. |
| `/api/cron/trigger-pheic-alerts` | `4,34 * * * *` | Alertes sur déclaration ou évolution d'une urgence de santé publique internationale. |
| `/api/cron/trigger-subscriber-alerts` | `10,40 * * * *` | Alertes aux abonnés d'un foyer précis. |
| `/api/admin/enrich-admin1` | `15 * * * *` | Enrichissement admin1 des lignes restées à « ~ ». Seul cron hors `/api/cron/`, pour raisons historiques. |
| `/api/cron/trigger-category-alerts` | `15,45 * * * *` | Alertes par catégorie de maladie. |
| `/api/cron/check-new-don` | `20 * * * *` | Détecte les articles WHO DON jamais vus et prévient l'admin. Décalé de 20 min après `sync-outbreaks`, exprès. |
| `/api/cron/disease-coverage` | `30 * * * *` | Contrôle des trous de couverture dans la couche de référence maladies, 30 min après le cycle d'ingestion. |
| `/api/cron/sync-cdc-han` | `36 */4 * * *` | Flux CDC Health Alert Network. |
| `/api/cron/trigger-country-risk-alerts` | `5 */6 * * *` | Alertes de changement de niveau de risque pays. |
| `/api/cron/sync-signals` | `6 */6 * * *` | **Désactivé pour raison légale** (ToS ReliefWeb) mais toujours planifié — voir « Écarts ouverts ». |
| `/api/cron/trigger-geofence-alerts` | `8 */6 * * *` | Alertes de zone géographique. |

## Crons quotidiens (30)

| Chemin | Cron | Rôle |
|---|---|---|
| `/api/cron/sync-taiwan-cdc` | `0 5 * * *` | Surveillance dengue du CDC taïwanais. |
| `/api/cron/signup-canary` | `10 5 * * *` | Canari : vérifie que le parcours d'inscription fonctionne encore. |
| `/api/cron/sync-brevo-blocklist` | `0 6 * * *` | Synchronise la blocklist Brevo vers `profiles.email_blocked_at`. Alimente la suppression des envois. |
| `/api/cron/sync-ukhsa` | `4 6,14 * * *` | Flux ATOM gov.uk de l'UKHSA. Deux passages : matin et après-midi. |
| `/api/cron/sync-malaysia-dengue` | `8 6 * * *` | Tableau de bord iDengue malaisien. |
| `/api/cron/health-check` | `5 7 * * *` | Contrôle de santé applicatif. Homonyme de la routine Claude Desktop « Daily health check » — les deux n'ont rien à voir. |
| `/api/cron/sync-spf` | `10 7,15 * * *` | Flux RSS de Santé Publique France. Deux passages. |
| `/api/cron/sync-drc-sitrep` | `12 7 * * *` | Détection des sitreps Ebola RDC **désactivée** (ToS ReliefWeb) ; ne subsiste que le contrôle « ligne Ebola RDC manquante ». |
| `/api/cron/sync-endemic-data` | `30 7 * * *` | Lignes « officielles » hors WHO DON : agences nationales et bureaux régionaux OMS. |
| `/api/cron/sync-who-regional` | `0 8 * * *` | Surveillance des maladies endémiques et à forte charge non couvertes systématiquement par WHO DON. |
| `/api/cron/sync-who-afro` | `4 8 * * *` | Bureau régional OMS Afrique. Publie 1 à 3 jours avant le siège pour les foyers africains. |
| `/api/cron/check-mpox-sitrep` | `8 8 * * *` | Sitreps Mpox de l'OMS : télécharge le PDF et en extrait les chiffres globaux. |
| `/api/cron/pilot-follow-up` | `12 8 * * *` | Relance des comptes Pro activés 8 jours plus tôt. |
| `/api/cron/pilot-closing-reminder` | `16 8 * * *` | Relance de la session de clôture promise aux candidats pilotes institutionnels. |
| `/api/cron/sync-ecdc-threats` | `0 9 * * *` | Flux « Epidemiological update » de l'ECDC. |
| `/api/cron/sync-africa-cdc` | `4 9 * * *` | Actualités Africa CDC — foyers subsahariens souvent absents de WHO DON. |
| `/api/cron/sync-ncdc` | `8 9 * * *` | NCDC Nigeria (Lassa, choléra, mpox, diphtérie, rougeole, méningite, fièvre jaune). |
| `/api/cron/sync-who-emro` | `12 9 * * *` | Bureau régional OMS Méditerranée orientale — MERS-CoV, CCHF, choléra. |
| `/api/cron/onboarding-sequence` | `16 9 * * *` | Séquence d'emails d'accueil. |
| `/api/cron/trial-reminders` | `30 9 * * *` | Rappels de fin d'essai, restreints aux jours ouvrés. |
| `/api/cron/sync-paho-alerts` | `35 9 * * *` | Alertes et mises à jour épidémiologiques de la PAHO. |
| `/api/cron/data-quality` | `0 10 * * *` | Contrôle qualité et corrections automatiques. **Écrit `cases`, `deaths` et `active` 30 min avant la chaîne d'alerte** — couplage par effet de bord, pas un verrou. |
| `/api/cron/expire-trials` | `5 10 * * *` | Expire les essais jamais convertis en abonnement Stripe. |
| `/api/cron/sync-cdc-notices` | `10 10 * * *` | Travel Health Notices du CDC (niveaux 1/2/3). |
| `/api/cron/regional-alerts` | `30 10 * * *` | **Chaîne d'alerte 1/4** — alertes régionales. |
| `/api/cron/watchlist-alerts` | `40 10 * * *` | **Chaîne d'alerte 2/4** — listes de surveillance. |
| `/api/cron/push-alerts` | `45 10 * * *` | **Chaîne d'alerte 3/4** — notifications push. Un seul push par foyer, à sa première apparition. |
| `/api/cron/disease-alerts` | `50 10 * * *` | **Chaîne d'alerte 4/4** — alertes par maladie suivie. |
| `/api/cron/winback-sequence` | `0 11 * * *` | Email de reconquête, 3 jours après expiration de l'essai. |
| `/api/cron/sync-usda-aphis` | `0 14 * * *` | H5N1 bovin de l'USDA APHIS, agrégé par État. |

## Crons hebdomadaires (7) — tous le lundi

Les quatre premiers sont les mailers du lundi. **Leur ordre est porteur** : le
verrou `weekly_email_claim` accorde une adresse au premier arrivé, donc l'ordre
d'exécution *est* l'ordre de priorité. Les réordonner change qui gagne.

| Chemin | Cron | Rôle |
|---|---|---|
| `/api/cron/send-sitrep-emails` | `50 6 * * 1` | **Mailer 1/4** — sitrep aux rapports programmés (payant). Prioritaire : réserve ses destinataires avant les autres. |
| `/api/cron/trigger-regional-digest` | `0 7 * * 1` | **Mailer 2/4** — digest régional des comptes Pro. |
| `/api/cron/weekly-digest` | `5 7 * * 1` | **Mailer 3/4** — digest de la newsletter (`subscriptions`, sans lien avec `profiles`). |
| `/api/cron/weekly-signal` | `20 7 * * 1` | **Mailer 4/4** — signal hebdo aux comptes gratuits. Le moins prioritaire, donc le dernier. |
| `/api/cron/sync-pacific-surveillance` | `15 8 * * 1` | Veille des îles du Pacifique, région quasi sans couverture automatique. |
| `/api/cron/sync-wpro-dengue-update` | `20 8 * * 1` | Bulletin dengue bimensuel de l'OMS WPRO. |
| `/api/cron/sync-samoa-dengue` | `25 8 * * 1` | Sitrep dengue du ministère de la santé samoan. |

## Écarts ouverts — décisions en attente

Relevés le 2026-08-23 en construisant ce registre. Aucun n'a été corrigé : ce
sont des arbitrages, pas des bugs.

**Quatre routes annoncent un rythme restreint et tournent tous les jours.**
Aucune ne contient de garde sur le jour de la semaine — vérifié fichier par
fichier, ce n'est pas une auto-limitation interne :

| Route | En-tête | Cron réel | Si l'en-tête a raison |
|---|---|---|---|
| `check-mpox-sitrep` | « Twice-weekly (Wed + Sat) » | quotidien | `8 8 * * 3,6` |
| `sync-africa-cdc` | « runs Wed + Sat » | quotidien | `4 9 * * 3,6` |
| `sync-who-afro` | « runs Mon/Wed/Fri » | quotidien | `4 8 * * 1,3,5` |
| `sync-who-emro` | « runs Mon/Wed/Fri » | quotidien | `12 9 * * 1,3,5` |

Soit le planning a été élargi exprès et les quatre en-têtes ont dérivé, soit ces
scrapers sollicitent l'OMS et Africa CDC deux à trois fois plus que voulu. Les
en-têtes de `check-mpox-sitrep` et `sync-africa-cdc` ont été corrigés le 23/08
pour décrire la réalité ; ceux de `sync-who-afro` et `sync-who-emro` ne l'ont
pas encore été, faute de décision.

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
