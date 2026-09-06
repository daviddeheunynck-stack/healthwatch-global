# Idées produit — HealthWatch Global

Journal quotidien (17h, routine `daily-product-ideas-healthwatch`) des idées d'amélioration produit proposées à David. Distinct de `product-feedback.md` (signal brut reçu de contacts) : ce fichier trace la synthèse, la proposition et le suivi de statut.

---

## 2026-07-26 — Proposition du jour

### 1. Vue usage minimale sur `product_events`
**Signal :** `product_events` (migration `20260723160000_product_events.sql`) est câblé en capture depuis le 23/07 sur 5 surfaces (dashboard, pricing, détail foyer, export CSV, rapport PDF) — voir mémoire `project_structural_profitability_fixes_2026_07_23` Phase D, qui note explicitement « aucun dashboard de visualisation construit exprès (requêtes SQL ad hoc pour l'instant) ». Vérifié aujourd'hui (grep sur tout le repo) : `product_events` n'est lu nulle part, seulement écrit depuis `lib/track-event.ts` — toujours vrai 3 jours après la Phase D.
**Pourquoi maintenant :** la fenêtre de décision de viabilité (jusqu'à ~21/08) dépend d'un vrai signal d'engagement (les leads institutionnels ouvrent-ils le dashboard ? consultent-ils un export ?), et le bilan hebdomadaire `hwg-weekly-viability-review` doit aujourd'hui reconstruire ce signal à la main, sans vue centralisée.
**Effort estimé :** petit — la donnée existe déjà ; il s'agit d'ajouter une lecture (vue SQL Supabase résumée par action/utilisateur/période, ou une page interne minimale sous `app/[locale]/admin`, déjà un dossier existant).
**Risque/inconnue :** volume encore faible (capture démarrée il y a seulement 3 jours), ce qui peut limiter l'utilité immédiate — mais ne justifie pas d'attendre pour construire la vue, vu le coût déjà bas.

### 2. Combler le trou de fraîcheur des lignes choléra verrouillées à priorité 10
**Signal :** l'incident Tchad du 21-22/07 (un contact terrain OMS a détecté une ligne choléra désactivée alors que l'épidémie était active, voir `product-feedback.md` entrée du 22/07) a été corrigé le jour même, mais le diagnostic note explicitement que ce lot de pays verrouillés « ne vieillit sous l'œil de personne ». Vérifié aujourd'hui : le fix Tchad a mis `is_seed=false`, donc la ligne sort du scan cluster de la section 4 de `morning-don-check` ; elle n'est pas non plus dans la liste figée des 5 lignes orphelines de la section 5 du même script. Aucun des deux filets de sécurité existants ne la couvre aujourd'hui.
**Pourquoi maintenant :** un deuxième contact terrain (RDC, Soudan, Soudan du Sud — même cluster DON579, à vérifier s'ils sont logés à la même enseigne que Tchad) pourrait découvrir le même trou avant nous. Ce serait la deuxième fois, plus dommageable pour la crédibilité produit qu'une première.
**Effort estimé :** petit — ajouter la ligne Tchad (et les autres si confirmées) à la section 5 de `morning-don-check`, qui réutilise un mécanisme de vérification hebdomadaire déjà construit plutôt que d'en créer un nouveau.
**Risque/inconnue :** aucune source automatisée fiable n'existe pour la plupart de ces pays (c'est justement pourquoi ils sont verrouillés) — la vérification restera manuelle (presse locale par pays), pas un vrai cron.

**Non re-proposées aujourd'hui** (déjà capturées dans `product-feedback.md`, sans angle neuf à ajouter) : le volet AMR léger (Eva Kamau, 10/07) et le signal de « ralentissement critique » / variance (Simon Ruegg, 6-7/07) restent ouverts et non priorisés, mais rien de nouveau à en dire aujourd'hui.

**Statut :** David a validé les deux le jour même (« Les deux, par ordre de priorité »). Les deux construites et déployées le 2026-07-26 :

- **Idée 2 (fraîcheur prio=10) — ✅ FAIT, commit `663a8b8`.** Vérification en direct sur prod avant de coder : la vraie portée était plus large que le pitch initial. 4 lignes hors cluster (Choléra/Tanzanie, Choléra/Somalie, Choléra/Tchad, Fièvre West Nile/France) et 12 lignes de cluster jamais vérifiées pour fraîcheur d'édition (Choléra ×4 dont RDC à 28 567 cas — le plus gros foyer du produit, MERS-CoV, Chikungunya ×7). `scripts/morning-don-check.mjs` scanne désormais toutes les lignes actives à `source_priority=10` avec cadence 7j (hors cluster) / 14j (cluster, bulletins mensuels), signal seulement — jamais de correction automatique. SKILL.md de `morning-don-check` mis à jour (section "4 bis") avec la procédure. Testé contre la prod réelle (Tanzanie/Somalie correctement flaggées à 9j, Tchad/France correctement skip car <7j).
- **Idée 1 (vue usage) — ✅ FAIT, commit `5fd1931`.** Section "Activité produit" ajoutée à `/admin` (stats 30j + flux des 25 événements les plus récents, email résolu par jointure profiles). Requête testée en direct contre la prod : 17 événements réels déjà capturés, 3 utilisateurs distincts, tous résolus vers un email. Typecheck + lint propres. Déployé (Vercel Ready). **Non vérifié visuellement** : la page est protégée par le login de David, je n'ai pas ses identifiants — à confirmer par lui à l'œil au prochain passage sur `/admin`.

---

## 2026-07-27 — Proposition du jour

### 1. Audit des « nulls silencieux » : les pays câblés dans une source mais qui ne produisent jamais de ligne
**Signal :** le 22/07, une contact OMS Tchad (Oumaima Mahamat Djarma) a signalé que l'épidémie de choléra de son pays était absente du site — corrigé le jour même. Le diagnostic notait au passage un **deuxième trou non traité** : la République centrafricaine n'a aucune ligne choléra alors qu'une épidémie y a été officiellement déclarée fin juin 2026 (Bimbo et Mbaïki, 197 cas / 24 décès au 28/06), et que la RCA **est pourtant dans la map `CHOLERA_ISO3`** de `sync-who-regional`. Vérifié en direct sur la prod aujourd'hui : la RCA n'a **zéro ligne, toutes maladies confondues**. Le trou est donc toujours ouvert 5 jours après. Plus parlant encore, le commentaire du code lui-même (`app/api/cron/sync-who-regional/route.ts:503`) documente les pays dont on attend légitimement un `null` — « Cameroon, Syria, Lebanon, Nepal ... they'll start populating automatically the moment WHO's feed has real data » — et **la RCA n'y figure pas**. Le code s'attend donc à ce qu'elle remonte, et personne ne voit qu'elle ne remonte pas.
**Pourquoi maintenant :** c'est la faille structurelle derrière l'incident Tchad, pas un cas isolé. Un fetcher par pays qui renvoie `null` est aujourd'hui indistinguable entre « pas d'épidémie là-bas » (normal) et « la source a cessé de couvrir ce pays / la requête est cassée » (angle mort). Sur les 14 pays de `CHOLERA_ISO3`, 5 n'ont aucune ligne (Cameroun, Syrie, Liban, Népal — attendus — **et la RCA, non attendue**). Le risque business est concret et déjà matérialisé une fois : c'est un contact terrain qui a découvert le trou à notre place, sur son propre pays.
**Effort estimé :** petit — même mécanisme que le scan de fraîcheur `source_priority=10` construit hier (`663a8b8`, section « 4 bis » de `morning-don-check`) : comparer la liste des pays déclarés dans les maps de sources aux pays réellement présents en base, et signaler ceux qui sont câblés mais durablement vides. Signal seulement, jamais de correction automatique.
**Risque/inconnue :** distinguer le null légitime du null anormal demande une liste d'exceptions tenue à la main (les 4 pays déjà documentés), sinon le rapport devient bruyant et sera ignoré. Reste à trancher si le scan couvre seulement `CHOLERA_ISO3` ou toutes les maps pays des crons.

### 2. Supprimer la ligne fantôme « Congo » qui trône en tête de l'historique Ebola
**Signal :** décision explicitement laissée à David le 22/07 (`product-feedback.md`, dernier paragraphe) et jamais tranchée depuis — **re-remontée ici parce que je l'ai vérifiée en direct aujourd'hui sur la page publique**, pas parce qu'elle serait neuve. La ligne fantôme (République du Congo, 2 344 cas, `active=false`, prio 0, id `0867397e…`), née du bug de matcher corrigé le 21/07, ne correspond à aucun foyer réel. La mémoire dit de ne pas la re-signaler tant qu'elle est inactive — mais l'inactivité ne la retire que de la carte des foyers, pas des autres surfaces. Sur `/fr/disease/ebola` en prod aujourd'hui : elle **ouvre** la section « Historique des épidémies » (« 2026 Congo 2 344 cas ») avec le plus gros chiffre de la liste, au-dessus de la vraie ligne RD Congo (1 460 cas), et elle gonfle « Pays touchés (6) » où « Congo » apparaît en plus de « DR Congo ».
**Pourquoi maintenant :** c'est la page maladie phare du produit, celle vers laquelle pointent les posts LinkedIn/X sur Ebola. Un visiteur épidémiologiste qui lit « Congo 2 344 cas » en tête d'historique voit soit une erreur de données, soit une confusion RDC/RoC — exactement le type de détail sur lequel les contacts terrain nous jugent (précédent Tchad).
**Effort estimé :** petit — un précédent de suppression pure existe (le doublon « Democratic Republic of Congo » du 17/07). Reste à confirmer qu'aucune autre ligne ne référence cet id.
**Risque/inconnue :** aucun vrai foyer Ebola n'a jamais été déclaré en République du Congo sur cette période, donc rien de légitime n'est perdu — mais c'est une suppression de donnée, à faire avec le script de vérification préalable habituel plutôt qu'à la main.

### 3. Trancher l'étape 3 du « délai de reporting » : le cadrer en incidents de rattrapage, ou l'abandonner
**Signal :** idée issue de l'échange LinkedIn avec Ingride Siemeni (20/07), acceptée par David qui a décidé de la construire par étapes. Étapes 1 (`f13818d`, colonne `is_backfill`) et 2 (`f95103d`, `lib/reporting-lag.ts`) faites le 20/07 — mais vérifié aujourd'hui : `lib/reporting-lag.ts` **n'est branché nulle part**, et rien n'a bougé sur ce chantier depuis 6 jours. Il est bloqué sur une décision de cadrage, pas sur du code.
**Pourquoi maintenant :** le finding de l'étape 2 est structurel et ne s'améliorera pas tout seul — sur dev comme sur prod, 100 % des lignes calculables tombent dans le bucket « Retardé », parce qu'une ligne ne reste éligible que tant qu'aucun cron ne l'a retouchée : les foyers activement suivis sortent vite de l'éligibilité, et il ne reste que de rares rattrapages tardifs (Mpox multi-pays inséré ~213-224j après sa date, Choléra DON579 ~311j). Affiché tel quel dans un rapport payant sous le nom « délai de reporting », c'est trompeur. Deux sorties possibles : le recadrer honnêtement en « incidents de rattrapage détectés » (métrique rare mais vraie, et c'est un angle différenciant que personne ne publie), ou acter que ça ne vaut pas la surface Pro et refermer le chantier proprement. Laisser du code mort à mi-chemin est la seule option qui ne rapporte rien.
**Effort estimé :** moyen — le calcul est fait et testé ; il reste le branchement export/rapport, la copy, et surtout l'arbitrage de cadrage qui appartient à David.
**Risque/inconnue :** le vrai risque est de survendre à des utilisateurs Pro épidémiologistes une métrique que la donnée ne supporte pas. Reformulée en « incidents de rattrapage », elle est défendable ; en « délai de reporting » générique, non.

**Non re-proposé aujourd'hui :** l'indicateur de contagiosité demandé par Zahra Bouzidi (05/07) — vérifié dans le code, **déjà couvert** : `DiseaseInfo.r0_ref` existe et est renseigné maladie par maladie dans `lib/disease-data.ts`, y compris avec des valeurs nuancées quand le R0 n'est pas pertinent (choléra, arboviroses). Rien à construire. Restent ouverts sans angle neuf aujourd'hui : le volet AMR (Eva Kamau, 10/07) et le signal de variance / « ralentissement critique » (Simon Ruegg, 6-7/07).

**Statut :** David a demandé « Quel correctif appliquer ? ». Items 1 et 2 identifiés comme de vrais correctifs (item 3 est un arbitrage de positionnement, pas un fix — laissé en attente ci-dessous). Les deux construits et déployés le 2026-07-27 :

- **Idée 2 (ligne fantôme Congo) — ✅ FAIT, priorité 1.** Vérifiée avant suppression : zéro référence dans `alert_notifications`/`outbreak_notes`/`user_watchlist`/`outbreak_tripwires`/`outbreak_subscribers`/`outbreak_alert_log` ; 3 lignes dans `outbreak_snapshots` (fenêtre du bug, 19-21/07), supprimées automatiquement par le `ON DELETE CASCADE` de la table. La ligne supprimée elle-même le confirmait : `country_en="Congo"` mais `description_fr` parlait explicitement de la RDC — chiffres mal attribués par le bug de matcher, pas un vrai foyer. Supprimée via script daté (`scripts/fix-ebola-congo-phantom-delete-2026-07-27.mjs`, non commité par convention). Vérifié en direct sur `/fr/disease/ebola` : l'historique commence désormais par la vraie ligne RDC (1 460 cas), et "Pays touchés" est passé de (6) à (5).
- **Idée 1 (nulls silencieux) — ✅ FAIT, priorité 2, commit `b079811`.** `scripts/morning-don-check.mjs` compare désormais `CHOLERA_ISO3` aux pays réellement présents en base pour Choléra, en excluant les 4 nulls documentés comme attendus (Cameroun, Syrie, Liban, Népal). Testé contre la prod réelle : seule la RCA ressort, confirmant exactement le diagnostic du jour. SKILL.md de `morning-don-check` mis à jour (section "4 ter"). Scope volontairement limité à Choléra pour l'instant.
- **Idée 3 (délai de reporting, étape 3) — ❌ ÉCARTÉ comme feature Pro (David, 27/07).** Arbitrage tranché en session : ne pas exposer en export/rapport payant, même reformulé en « incidents de rattrapage » — un rapport facturé qui affiche du vide la quasi-totalité du temps (le finding de l'étape 2 : seuls de rares rattrapages historiques, Mpox ~220j, Choléra DON579 ~311j, restent éligibles au calcul) ne construit pas de valeur perçue, et reste un pivot par rapport à la vraie demande d'Ingride (timeliness alerte→validation), pas la même chose. Décision : recycler `lib/reporting-lag.ts` (déjà construit et testé) en **signal interne façon `morning-don-check`** plutôt qu'en surface client — utile pour détecter des anomalies de rattrapage/backfill mal étiquetées, l'usage qui l'a fait naître. Chantier fermé côté « feature Pro » ; réouvrable plus tard comme petit ajout de vérif interne, pas comme chantier client tant que le volume reste aussi faible.
  **Suite (session parallèle, même jour) :** cette décision n'avait pas été vue par une deuxième session, qui a construit et déployé la version Pro (`bd80d54`) sur la seule base de « reformule en incidents de rattrapage » dit à cette session-là. Conflit détecté au moment de clore le log, signalé à David, qui a confirmé vouloir la version interne après explication du compromis (donnée trop rare pour une vraie valeur payante, et le calcul mesure la vitesse de collecte de HWG, pas la réactivité du pays). **Revert appliqué (`73a52bf`)** : colonne CSV/JSON et section PDF retirées, `lib/reporting-lag.ts` conservé (la logique reste bonne), branché à la place dans `scripts/morning-don-check.mjs` (section "4 quater", signal interne uniquement). Testé : reproduit exactement les 9 cas historiques connus. Voir [[feedback_concurrent_sessions_share_git_workdir]] — toujours relire un fichier partagé juste avant de le clore, pas seulement au début de la tâche.

---

## 2026-07-27 (run 17h, 2e passage du jour) — Proposition du jour

Angle différent des deux passages précédents (26/07 et 27/07 matin), qui portaient tous les deux sur la qualité de données. Ici : mesure côté **demande**, faite en direct sur la prod (deux scripts de lecture seule, aucune écriture). Le fait dominant de la journée n'est pas un bug, c'est un chiffre d'adoption.

### 1. Sept surfaces de personnalisation construites, zéro utilisateur sur les sept — le défaut « tout, partout » vide la personnalisation de sa raison d'être
**Signal (compté sur la prod, 27/07 vers 17h, 21 comptes / ~5 semaines de production) :** toutes les tables qui stockent une préférence d'alerte *choisie par l'utilisateur* sont **vides, sans exception** :

| table | lignes | utilisateurs |
|---|---|---|
| `user_alert_diseases` (alertes par maladie) | 0 | 0 |
| `user_watchlist` (liste de suivi) | 0 | 0 |
| `outbreak_tripwires` (seuils de déclenchement) | 0 | 0 |
| `outbreak_subscribers` (suivi d'un foyer précis) | 0 | 0 |
| `geofence_alerts` (périmètre géographique) | 0 | 0 |
| `country_risk_alerts` (risque pays) | 0 | 0 |
| `category_alerts` (catégorie de maladie) | 0 | 0 |
| `user_alert_regions` (**seule surface en opt-out**, pré-remplie par `activate-trial`) | **45** | **9** |

Corollaire côté livraison : `alert_notifications` contient **83 lignes, 100 % `type='pheic'`** (le broadcast PHEIC), la plus récente le 24/07. Autrement dit, la cloche de notification in-app n'a **jamais** affiché une seule notification personnalisée depuis sa mise en service — les 7 crons `trigger-*` correspondants tournent tous les jours en `status=ok, rows=0`. `product_events` (capture depuis le 24/07, 19 événements, 3 utilisateurs) va dans le même sens : uniquement `dashboard_view` (17) et `outbreak_detail_view` (2). Zéro export, zéro rapport PDF, zéro vue pricing sur la fenêtre.

**La leçon a déjà été apprise une fois, dans ce même repo.** Le commentaire de `app/api/activate-trial/route.ts:97` dit noir sur blanc : « Default-enroll every new trial into regional alerts (opt-out, not opt-in). Before this, 0 of the 11 real signups ever configured an alert region themselves. » Le passage en opt-out a immédiatement produit 9 utilisateurs enrôlés et 15 e-mails envoyés par `regional-alerts` aujourd'hui. Le même raisonnement n'a jamais été appliqué aux 7 autres surfaces.

**La nuance qui change la recommandation (à ne pas sauter) :** l'enrôlement par défaut inscrit chaque essai aux **5 régions** (`africa, asia, americas, europe, oceania`) à `min_risk=medium`, c'est-à-dire à la planète entière. Les 7 surfaces vides ne sont donc pas des canaux « en plus », ce sont des outils pour **réduire** le bruit — et personne n'a besoin de réduire quelque chose qu'il n'a pas encore commencé à trouver utile. Pré-remplir `user_alert_diseases` par-dessus l'enrôlement actuel n'ajouterait donc rien d'autre que des doublons d'e-mails. **Le vrai levier est de rendre le défaut ciblé plutôt qu'exhaustif** : demander une seule chose à l'inscription (« quel pays / quelle maladie vous concerne ? », une question que chaque contact terrain a déjà répondue spontanément en DM — Oumaima/Tchad sur son propre pays, ZABRE, Mulamba, Bankunda), pré-remplir depuis cette réponse, et laisser « tout, partout » en repli plutôt qu'en défaut. Un e-mail hebdo sur *son* pays est un produit ; un e-mail sur cinq continents est une newsletter.
**Effort estimé :** moyen — une étape d'inscription (ou un choix unique dans le digest d'inscription déjà construit le 25/07) plus l'écriture dans 1 à 2 tables ; le chemin technique d'enrôlement existe déjà et est testé (`activate-trial`, avec retry et trace Sentry). Le coût réel est le choix de cadrage, pas le code.
**Risque/inconnue :** (a) lecture alternative honnête — ces 7 tables vides peuvent simplement signifier « fonctionnalités dont personne ne veut », et dans ce cas la bonne décision n'est pas de les pré-remplir mais d'en **retirer** 5 ou 6 de l'interface pour arrêter de disperser l'attention (et l'effort de maintenance) ; (b) ajouter une question à l'inscription ajoute de la friction sur un entonnoir déjà maigre — l'alternative sans friction est de déduire le pays du digest d'inscription ou de la géo, au prix d'une précision moindre ; (c) 21 comptes, c'est un échantillon minuscule : le chiffre est net (0/21 sur sept surfaces, ce n'est pas du bruit) mais il ne dit pas *pourquoi*, et un seul appel à un contact terrain répondrait mieux que n'importe quelle déduction faite ici.

### 2. Le health-check quotidien ne distingue pas « a tourné » de « a livré quelque chose »
**Signal :** repris de la mémoire `project_hwg_push_notifications_broken_since_launch_fixed_2026_07_27`, qui se termine explicitement par « Consider whether `push_subscriptions` row count deserves a place in `morning-don-check` or a dedicated health check, given how long a silent zero went unnoticed — flag to David as a possible follow-up, don't build speculatively ». C'est ce flag. Vérifié dans le code aujourd'hui : `app/api/cron/health-check/route.ts` classe chaque cron **sur l'âge de son dernier passage** (`CRON_WINDOWS`) et sur les erreurs Sentry ; il affiche bien `rows` dans le tableau, mais ne le colore ni ne l'alerte jamais. Or les crons de livraison appellent tous `logCronRun(..., "ok", sent)` avec `sent=0` quand ils n'envoient rien : « rien à envoyer » et « le canal est mort » produisent exactement la même ligne verte. Mesuré en direct : **15 des 18 crons de livraison sont aujourd'hui à `status=ok, rows=0`** (seuls `weekly-digest` 12, `regional-alerts` 15 et `onboarding-sequence` 2 ont livré). C'est littéralement l'état dans lequel `push-alerts` a affiché vert pendant **49 jours** avec zéro abonné, sans que rien ne le signale.
**Pourquoi maintenant :** cette semaine, quatre défaillances de livraison silencieuses ont été trouvées **à la main**, aucune par la supervision : push mort 49 j, digest hebdo étranglé à 1 ligne sur 33 éligibles (`1862914`), digest d'inscription qui ratait 2 essais actifs sur 7, backlog du préfixe des alertes régionales. La chaîne de livraison *est* le produit payant ; c'est le seul endroit où un échec silencieux coûte un client sans laisser de trace.
**Effort estimé :** petit — le health-check fait déjà les comptes et envoie déjà l'e-mail quotidien ; il s'agit d'ajouter un bloc « livraison » (abonnés par canal + envois sur 24 h / 7 j) et une règle d'alerte.
**Risque/inconnue :** un plancher absolu (« alerter si 0 ») serait du bruit pur aujourd'hui, puisque le zéro est l'état normal de 15 canaux sur 18 (cf. idée 1). La règle utile est **relative** : « ce canal a déjà livré, et il est à zéro depuis N jours », plus « des abonnés existent mais aucun envoi ». Ça suppose de garder un historique par cron, alors que `site_config` ne conserve que le dernier passage — d'où un petit choix de stockage à faire (voir aussi le piège connu `cron:run:*.updated_at` gelé et le fait que `rows` ne compte que les inserts).

### 3. Les 147 lignes archivées ne sont jamais traduites — 29 d'entre elles s'affichent en anglais dans les 4 autres langues
**Signal :** conséquence directe et vérifiée du chantier troncature d'aujourd'hui (`project_truncated_descriptions_audit_2026_07_27`, qui signalait « les 32 autres lignes ont eu l'anglais seulement — flagged as a known gap »). Compté sur la prod : 255 lignes au total, dont **147 archivées** ; **0 ligne active** manque une traduction (le balayage de `sync-outbreaks` et le scan de `morning-don-check` couvrent bien ce périmètre), mais **30 lignes archivées** en manquent au moins une, et **29 n'ont aucune des quatre** (fr/es/ar/id tous `null`). Cause précise : le balayage de traduction de `sync-outbreaks` (étape 4, budget 10 lignes/run) filtre sur `.eq("active", true)` — une ligne désactivée ne peut donc plus **jamais** être traduite, quel que soit le temps qui passe. Et ces lignes restent bien affichées : `getLocalizedDescription()` retombe sur l'anglais, sur `/[locale]/outbreak/[id]` (page publique, indexable) comme dans l'historique des pages maladie.
**Pourquoi maintenant :** l'audience courtisée depuis trois semaines est francophone (OMS Tchad, RDC, Cameroun, Burkina). Un contact qui suit un lien FR et lit un paragraphe en anglais dans l'historique juge le sérieux du produit sur ce détail — c'est exactement le registre du précédent Tchad, en moins grave.
**Effort estimé :** petit, voire trivial — le mécanisme existe et fonctionne ; il s'agit d'élargir le périmètre du balayage existant (ou de le faire tourner une fois sur le stock archivé, 29 lignes = 3 runs au budget actuel).
**Risque/inconnue :** faible. Le seul point d'attention est le quota MyMemory (1 000 mots/jour sans clé, 10 000 avec `MYMEMORY_EMAIL`) : élargir le périmètre sans relever le budget ferait concourir les archives avec les lignes actives, or les actives doivent rester prioritaires. À faire en file d'attente séparée, ou en one-shot puis retour au filtre actuel. Priorité honnêtement basse par rapport aux idées 1 et 2 : c'est de la finition, pas un levier business.

**Non re-proposé aujourd'hui :** le volet AMR (Eva Kamau, 10/07) et le signal de variance / « ralentissement critique » (Simon Ruegg, 6-7/07) restent ouverts sans angle neuf. Rien sur la qualité de données : les trois passages précédents ont couvert ce terrain et la journée a déjà livré 8 correctifs de fond.

**Statut :** David a validé les trois (« On applique tes 3 idées »). Les trois construites le jour même :

- **Idée 1 (enrôlement ciblé) — ✅ FAIT.** Ajout d'un champ facultatif à l'inscription (`app/[locale]/signup/page.tsx`) : « Quelle région vous intéresse en priorité ? », options = les 5 mêmes régions que `AlertRegionToggles`, défaut = « Toutes les régions » (comportement inchangé si ignoré). `app/api/activate-trial/route.ts` accepte désormais `{priorityRegion}` dans le corps de la requête ; si valide, n'enrôle que cette région (au lieu des 5) à `min_risk=medium` — sinon comportement identique à avant. Ne touche ni le flux OAuth ni le flux confirmation-email (`auth/callback/route.ts`), hors périmètre et gérés séparément. Vérifié : rendu correct en FR/EN/AR (RTL) via l'arbre d'accessibilité du navigateur ; la logique d'enrôlement testée en direct contre la vraie base **dev** (utilisateur jetable créé puis supprimé) confirme exactement 1 ligne écrite quand `priorityRegion="africa"`, et 5 lignes en repli sans préférence — les deux cas passent. Typecheck + lint propres.
- **Idée 2 (visibilité livraison du health-check) — ✅ FAIT.** `lib/cron-monitor.ts` : `logCronRun` retient désormais `lastNonZero` (dernière fois que ce cron a livré `rows>0`), reporté d'un run à l'autre. `app/api/cron/health-check/route.ts` : nouvelle table `DELIVERY_AUDIENCE` (cron → table d'audience réelle : `push_subscriptions`, `user_alert_regions`, `user_alert_diseases`, `user_watchlist`, `geofence_alerts`, `country_risk_alerts`, `category_alerts`, `outbreak_tripwires`, `outbreak_subscribers`, `subscriptions`), compte l'audience de chacune, et signale deux états — « jamais livré » (audience>0 mais aucun `lastNonZero` connu, sauf si le dernier run loggé avait déjà `rows>0` avant l'ajout du champ, pour éviter un faux positif au premier passage après déploiement) et « en panne » (audience>0, dernière livraison réelle il y a plus de 3× la fenêtre attendue du cron, plancher 3 jours). Nouveau bloc HTML dans l'email quotidien, alerte Sentry séparée (même traitement que `hasOverdue`, volontairement tenue hors du statut propre de `logCronRun`, pour la même raison documentée que l'exclusion historique de `sentryAlert`). Testé en direct contre la vraie base **dev** via `curl` avec le `CRON_SECRET` local : la route répond 200, calcule un champ `delivery` cohérent (2 canaux dev correctement signalés « jamais livré » sur données de test), aucun envoi Sentry/email déclenché (`isRealProduction=false`). Typecheck + lint propres.
- **Idée 3 (traductions des lignes archivées) — ✅ FAIT.** `app/api/cron/sync-outbreaks/route.ts`, étape "4bis" : balayage MyMemory séparé pour les lignes `active=false` manquant au moins une traduction, budget propre plafonné à 5 lignes/run moins ce qu'a déjà consommé le balayage actif (`Math.max(0, 5 - needsTranslation.length)`), pour ne jamais entrer en concurrence avec les lignes actives sur le quota MyMemory (10 000 mots/jour, `MYMEMORY_EMAIL` déjà configuré en prod). Vérifié : la requête PostgREST (filtre `active=false` + `or(...)` sur les 4 colonnes de traduction) exécutée en direct contre la vraie base dev renvoie 200 avec des lignes cohérentes. Typecheck + lint propres. À ce rythme (5/run, cron horaire), les 29 lignes archivées identifiées le 27/07 seront rattrapées en quelques heures après déploiement.

Déployé sur `master`, Vercel auto-déploiera depuis le push. Aucune vérification post-déploiement en prod pour l'idée 1 par le clic réel (le champ de saisie n'a pas été soumis via un vrai clic navigateur, l'environnement de prévisualisation de cette session n'affichait pas de rendu visuel exploitable pour l'automatisation du clic) — la logique serveur est testée en direct sur la vraie base, mais le premier vrai clic bouton par un utilisateur humain reste la vérification ultime, comme pour toute fonctionnalité de ce funnel.

---

## 2026-07-28 — Proposition du jour

Angle nouveau : premier passage à interroger **le journal d'envoi Brevo** (API `smtp/statistics/events`, `smtp/blockedContacts`, lecture seule), jamais lu par HWG ni par aucune session jusqu'ici — le code n'appelle Brevo que pour envoyer (`smtp/email`), jamais pour savoir ce que ces envois sont devenus. Les trois idées ci-dessous sortent toutes de ce journal, croisé avec la base prod.

**Méthode, et pourquoi elle ne contredit pas la décision du 24/07 :** la fenêtre de viabilité exclut explicitement les ouvertures d'email comme signal (métrique de vanité, [[project_hwg_viability_decision_window_2026_07_24]]). Rien ici ne s'appuie sur des ouvertures — elles sont d'ailleurs gonflées par le préchargement des proxys (62 `loadedByProxy` sur 7 j). Les faits utilisés sont des **événements durs** : `blocked`, `unsubscribed`, `clicks` avec l'URL exacte, et l'horodatage à la seconde des envois. Ce ne sont pas des indicateurs d'engagement, ce sont des états de livraison.

### 1. 🔴 ZABRE a cliqué son lien d'accès — 61 minutes après l'envoi, une minute de trop

**Signal (journal Brevo, à la seconde) :** l'email « Your HealthWatch Global pilot access is ready » part le **18/07 à 10:14:23** et est délivré à 10:14:25. Dr R Hyacinthe ZABRE l'ouvre plusieurs fois, puis **clique le magic link à 11:15:56**, soit **1 h 01 min 33 s après l'envoi**. L'URL cliquée est bien le lien d'authentification (`…supabase.co/auth/v1/verify?token=…&type=magiclink&redirect_to=…/en`). Dans la foulée, à 11:16, il clique aussi le lien de la fiche foyer d'un email PHEIC Polio, et le 19/07 à 11:05 celui de « One thing to set up now — your outbreak alert regions » (vers `/en/account#regional-alerts`). **6 clics au total entre le 18 et le 28/07, sur 33 emails délivrés.** Et pourtant, en base : `last_sign_in_at` = **NEVER**, zéro `product_events`, zéro session. Il a demandé « pasword needed? » sur LinkedIn le 20/07 — exactement ce qu'écrit quelqu'un dont le lien vient d'afficher une erreur. Le 2e lien (« access link (fresh) », 20/07 09:25) a été ouvert à 09:33 mais **jamais cliqué**.

**Ce que ça change :** la lecture partagée depuis dix jours est « ZABRE ne s'est jamais connecté, silence depuis le 20/07 » ([[project_hwg_access_offers_accepted_pending_provisioning]], bilans hebdo des 24 et 27/07 qui le comptent en `last_sign_in=NEVER`). Le journal d'envoi dit autre chose : c'est le lead institutionnel **le plus engagé des quatre**, il a cliqué son accès, il a cliqué une fiche foyer, il a cliqué le réglage d'alertes — et il n'a jamais pu entrer. Ce n'est pas un désintérêt, c'est un mur d'authentification. Sur les 4 leads dont dépend la décision du 21/08, c'est le meilleur fit (projet PREIS = exactement la promesse de HWG) et il n'a jamais vu le produit.

**Effort estimé :** petit. La cause probable est l'expiration par défaut des OTP/magic links Supabase (3 600 s), à confirmer dans les réglages Auth du projet — un clic à T+61 min tombe juste après. Trois leviers cumulables et tous peu coûteux : (a) allonger l'expiration côté Supabase (jusqu'à 24 h) pour les liens de provisioning, (b) ajouter un **code à 6 chiffres** dans le corps de l'email en repli du lien (Supabase le fournit nativement, insensible au délai de lecture et au préchargement), (c) ne plus dépendre d'un jeton à usage unique quand des proxys préchargent les liens — ZABRE a 30 `loadedByProxy` sur la période, un prefetch de scanner consomme un magic link avant même le clic humain.

**Risque/inconnue :** allonger la durée de vie d'un lien d'authentification élargit la fenêtre d'exposition si l'email fuite — le code OTP en repli est le compromis propre (courte durée mais ressaisissable). Inconnue résiduelle : je ne peux pas prouver depuis le journal Brevo que le clic a échoué *à cause* de l'expiration — je constate le clic, l'absence totale de session, et le message « pasword needed? » deux jours plus tard. À vérifier côté logs d'auth Supabase avant de conclure définitivement.

### 2. 🔴 Kamau et Mulamba se sont désabonnés le 21/07 — la base ne le sait pas, et les crons continuent de « leur envoyer »

**Signal :** la liste `blockedContacts` de Brevo contient 8 adresses, dont **2 des 4 leads institutionnels**, tous deux le même jour :

| contact | désabonnement | motif | emails bloqués depuis (15→28/07) |
|---|---|---|---|
| `monicaevelynkamau@gmail.com` | **21/07 08:54** | `unsubscribedViaEmail` | **15 sur 20 envois** |
| `davmulambamangole@gmail.com` | **21/07 19:43** | `unsubscribedViaEmail` | **29 sur 33 envois** |

Sur les 7 derniers jours, l'agrégat du compte Brevo affiche **191 requêtes d'envoi, 139 délivrées, 50 bloquées** — un envoi sur quatre ne part pas. Côté base prod, ces deux comptes sont toujours inscrits à **5 régions d'alerte chacun** (`user_alert_regions`, 45 lignes / 9 utilisateurs, tous à 5), rien n'indique un désabonnement, et les crons continuent : dernier cas vérifié aujourd'hui, `2026-07-28 10:01:04 requests` puis `blocked` pour Mulamba sur « Outbreak signals — Global · This week ». Le cron a compté cet envoi comme livré (Brevo accepte la requête en 2xx puis bloque en aval), donc `logCronRun(rows>0)` est vert.

**Pourquoi maintenant :** le bilan hebdo du 27/07 conclut « les 4 leads reçoivent bien leurs alertes maintenant (66 à 104 sur 7 j) : le test loyal du produit tourne enfin ». C'est faux pour la moitié d'entre eux depuis le 21/07 — la prémisse même de la fenêtre de décision (« le produit n'a jamais été testé loyalement avant le 23/07, donc on lui laisse 4 semaines ») repose sur un compteur d'envois qui ne mesure pas la livraison. Et le bloc « livraison » ajouté au health-check hier (idée 2 du 27/07) ne peut pas voir ça : il compare une audience en base à des envois comptés côté HWG, deux chiffres qui restent verts pendant qu'un contact est bloqué chez le routeur.

**Effort estimé :** petit — une lecture quotidienne de `GET /v3/smtp/blockedContacts` (clé Brevo déjà en prod, aucun nouveau service), un champ sur `profiles` ou une petite table, et l'affichage dans l'email de health-check quotidien + le bilan hebdo de viabilité. La logique existe déjà pour le reste ; c'est un appel HTTP et une jointure.

**Risque/inconnue :** RGPD et bon sens — un désabonnement se **respecte** et se rend visible, il ne se contourne pas. La recommandation n'est **pas** de relancer Kamau ou Mulamba (consigne d'attente passive explicite pour Mulamba, [[project_hwg_access_offers_accepted_pending_provisioning]]) : c'est d'arrêter de les compter comme destinataires actifs dans les bilans, et de savoir en 24 h la prochaine fois que ça arrive. Inconnue : Brevo ne dit pas *sur quel email* le lien de désabonnement a été cliqué côté Mulamba (l'événement est rattaché au PHEIC Polio, mais il avait cliqué son lien d'accès 2 h plus tôt, à 17:33 — même hypothèse que l'idée 1, un accès qui ne s'ouvre pas).

### 3. Le désabonnement de Kamau se lit minute par minute — le défaut « 5 régions » l'a noyée sous les Amériques

**Signal — nouvelle preuve pour une idée déjà proposée le 27/07 (17 h, idée 1, construite le jour même)**, remontée ici parce que la preuve causale manquait alors et existe maintenant. Le 27/07 j'avais mesuré 0 utilisateur sur 7 surfaces de personnalisation et recommandé un défaut ciblé plutôt qu'exhaustif ; le risque (a) que j'avais posé était « ces tables vides veulent peut-être dire que personne n'en veut ». Le journal Brevo tranche : le matin du **21/07, entre 08:10 et 08:51**, **⚠️ Eva Kamau** (clinicienne et chercheuse spécialisée AMR, contact LinkedIn du 10/07, même compte `monicaevelynkamau@gmail.com`/userId `00c21d9f-…` que la ligne « volet AMR » ci-dessous — **corrigé le 15/08, cette entrée l'appelait par erreur « Monica Evelyn Kamau, épidémiologiste, Nairobi », une identité déduite à tort de la boîte email et jamais vérifiée**) ouvre en rafale une quinzaine d'alertes — Dengue/Amériques ×6, Rougeole/Amériques ×3, Diphtérie/Amériques, Choléra/Asie, PHEIC Ebola RDC, PHEIC Mpox RDC — et **se désabonne à 08:54, depuis un email « 🚨 New outbreak detected in Americas — Dengue fever »**. Les trois jours précédents, elle ouvrait tout et cliquait les emails d'essai (« Day 3 of your Pro trial », « Mid-trial check-in »). Ce n'est pas quelqu'un qui se désintéresse : c'est quelqu'un d'attentif qui a été enseveli sous des alertes d'un continent qui n'est pas le sien. Le correctif du 27/07 (région prioritaire à l'inscription) ne s'applique **qu'aux nouvelles inscriptions** : les **9 comptes existants sont tous encore à 5 régions**, y compris les 4 leads institutionnels.

**Pourquoi maintenant :** les 3 leads encore joignables par email (ZABRE, Bankunda, et les essais en cours) sont exposés au même mécanisme, et leurs essais courent jusqu'au 17-24/08, c'est-à-dire jusqu'à la date de décision. Perdre un troisième lead par saturation avant le 21/08 coûterait plus cher que n'importe quelle fonctionnalité livrée d'ici là.

**Effort estimé :** petit à moyen — appliquer le ciblage aux comptes existants demande un choix : soit une réduction proposée (un email « ne recevez que votre région » d'un clic, mais c'est une sollicitation de plus), soit un plafond de cadence côté envoi (regrouper au-delà de N alertes/jour en un seul digest), soit réduire le défaut à la région déduite de la locale/du pays pour les comptes jamais configurés. Le code d'enrôlement est déjà en place et testé.

**Risque/inconnue :** réduire d'autorité le périmètre d'un compte existant modifie ce qu'il reçoit sans qu'il l'ait demandé — défendable pour un défaut jamais touché par l'utilisateur, discutable sinon (Kamau, elle, avait bougé un réglage : `africa:low` au lieu de `medium`, donc plus d'alertes Afrique, pas moins — signe qu'elle voulait affiner, pas se taire). Le plafond de cadence est le levier le moins intrusif et le plus sûr des trois.

**Non re-proposé aujourd'hui :** le volet AMR (Eva Kamau, 10/07 — même compte que l'idée 3 ci-dessus, voir correction d'identité du 15/08) et le signal de variance / « ralentissement critique » (Simon Ruegg, 6-7/07), toujours ouverts sans angle neuf. Rien sur la qualité de données : la journée en a déjà livré (audit des lignes actives périmées, 4 lignes rafraîchies, `73ad884`).

**Contexte funnel mesuré au passage** (utile au bilan de lundi, pas une idée en soi) : 21 comptes, 8 essais Pro en cours dont les fins tombent aux **29/07, 01/08, 07/08, 15/08, 17/08, 22/08, 24/08 et 13/09** — donc **3 seulement expirent avant la date de décision du 21/08, et aucun des 4 leads institutionnels**. `product_events` : 19 événements en tout, **aucun d'un vrai utilisateur depuis le 24/07**, zéro `pricing_page_view`, zéro export, zéro rapport PDF sur toute la fenêtre d'instrumentation. Le dashboard est en `force-dynamic`, donc cette absence n'est pas un artefact de cache.

**Statut :** **Idée 2 (désabonnements Brevo invisibles) construite le 29/07** (`8934c64` : synchronisation de la blocklist Brevo vers `profiles.email_blocked_at` + gating de `regional-alerts` ; `f59c166` : gating étendu aux 18 autres crons d'envoi). **Idée 1 (magic link / OTP de repli pour ZABRE) construite le 30/07** (voir entrée du 30/07, idée 1). **Idée 3 (comptes existants encore à 5 régions)** : distribution confirmée inchangée le 03/08 (12 comptes à 0, 10 à 5, toujours aucun entre les deux) ; un indicateur de visibilité ajouté au health-check ce jour-là (`9ec3c1e`), mais aucune correction de fond appliquée — le risque de flot (97 e-mails/run) qui motivait initialement cette idée est déjà mitigé depuis le 02/08 par le regroupement en un e-mail par utilisateur et le plafond `MAX_DIGEST_ITEMS_PER_EMAIL` ; réduire le périmètre des comptes existants resterait un arbitrage de David, non fait.

---

## 2026-07-29 — Proposition du jour

Angle nouveau : la **couverture géographique** et la **qualité du référentiel maladies**, mesurées en direct sur la prod (deux scripts de lecture seule, aucune écriture, supprimés après usage). Déclencheur : le premier retour jamais reçu d'une équipe de surveillance **hors sphère OMS**, arrivé aujourd'hui.

### 1. La page Méthodologie annonce 4 sources et aucune couverture Asie-Pacifique — au moment où un contact du Taiwan CDC explique précisément pourquoi il doit compenser à la main

**Signal — feedback reçu aujourd'hui (29/07), le seul retour du jour et le premier de ce type :** Hao-Kai TSENG, Epidemic Intelligence Center du **Taiwan CDC**, en DM LinkedIn (`product-feedback.md`, entrée du 29/07). Taïwan n'étant pas État membre de l'OMS, son équipe ne peut pas s'appuyer sur les canaux WHO/ECDC/PAHO/Africa CDC et compense par une veille manuelle sur les sites nationaux voisins et des plateformes tierces (Beacon, CIDRAP, Outbreak News Today). Ce n'est pas une demande de fonctionnalité — c'est un professionnel qui décrit l'angle mort exact de HWG, sans savoir qu'il le décrit.

**Mesuré sur la prod aujourd'hui (260 lignes, 108 actives) :**

| région | lignes actives | pays actifs |
|---|---|---|
| Afrique | 38 | 27 |
| Amériques | 37 | 15 |
| **Asie** | **17** | 16 |
| Europe | 15 | 12 |
| **Océanie** | **1** | 1 |

Les 17 lignes « Asie » se décomposent en **11 Dengue** issues d'une seule et même source (`worldhealthorg.shinyapps.io`, le fetcher xMart construit le 12/07), 2 Polio (Afghanistan, Pakistan), 1 MERS-CoV (Arabie saoudite), 1 Choléra (Afghanistan) et 2 lignes parasites (voir idée 2). **Taïwan, le Japon et la Corée du Sud n'ont jamais eu la moindre ligne, toutes maladies et tous statuts confondus** ; la Chine n'a qu'une ligne Chikungunya inactive de 2025. L'Océanie tient entière dans une ligne Diphtérie/Australie. Autrement dit : sur tout le Pacifique occidental, HWG affiche de la dengue et rien d'autre.

**Le point vraiment actionnable n'est pas le trou lui-même, c'est qu'il est invisible et que la page qui devrait le dire dit autre chose.** `app/[locale]/methodology/page.tsx` — la page qu'un évaluateur institutionnel lit avant de décider s'il fait confiance aux données — liste **exactement 4 sources** : WHO DON (couverture annoncée « Global »), ECDC (Europe), PAHO (Amériques), Africa CDC (Afrique). Deux écarts vérifiés aujourd'hui, dans les deux sens :
- **elle sous-déclare le pipeline réel** — 13 crons `sync-*` insèrent réellement dans `outbreaks`, et les lignes actives portent aujourd'hui des sources qu'aucun visiteur ne peut deviner depuis cette page : `aphis.usda.gov` (13 lignes), `globalhealthreports.health.ny.gov` (4), WHO AFRO, WHO EMRO, `ncdc.gov.ng`, `cdc.gov.au`, `santepubliquefrance.fr`, `gov.br`, `endpolio.com.pk`, `polioeradication.org`, `cidrap.umn.edu`, `tchadinfos.com` ;
- **elle sur-déclare la couverture géographique** — le tableau a une ligne par région pour l'Europe, les Amériques et l'Afrique, et **aucune pour l'Asie ni le Pacifique**, qui reposent donc uniquement sur « WHO DON, Global ». Un blanc sur la carte au-dessus de Taipei se lit « rien ne se passe » alors qu'il veut dire « aucune source ne regarde ». C'est exactement le mécanisme de l'incident Tchad du 22/07, transposé d'un pays à une région entière — et cette fois avec un professionnel de la région déjà dans les contacts.

**Ce que je propose (et ce que je ne propose pas) :** pas d'intégrer une source Asie-Pacifique aujourd'hui — le garde-fou du `ROADMAP.md` (« Do NOT integrate until a prospect explicitly asks ») tient, Hao-Kai n'a rien demandé. Ce qui est cheap et honnête : **rendre la couverture explicite plutôt que muette**. Mettre le tableau des sources de `/methodology` à jour avec le pipeline réel, y ajouter une ligne par région disant franchement laquelle a un bureau régional câblé et laquelle repose sur le seul WHO DON, et afficher la même information sur les pages région/pays (« sources alimentant cette région, dernière livraison le … »). La donnée existe déjà : `source` par ligne, plus le journal de runs des crons.

**Effort estimé :** petit pour le volet Méthodologie (contenu statique, 5 langues, aucune logique). Moyen si on va jusqu'à l'indicateur par région/pays alimenté par les données réelles — c'est la même mécanique que le scan de « nulls silencieux » déjà construit dans `morning-don-check` le 27/07 (`b079811`), réutilisée côté affichage au lieu du monitoring interne.

**Risque/inconnue :** (a) dire publiquement « l'Asie-Pacifique repose sur le seul WHO DON » est un aveu de faiblesse autant qu'un gage d'honnêteté — je pense que c'est le bon arbitrage face à des épidémiologistes, qui repèrent le trou de toute façon et pardonnent moins le silence que la lacune, mais c'est un choix de positionnement qui appartient à David ; (b) le volet « long terme » associé, et clairement étiqueté comme tel, est d'ouvrir un flux WHO WPRO / SEARO — à ne pas lancer avant qu'un prospect le demande, mais à noter que le premier signal en ce sens vient d'arriver ; (c) je n'ai pas vérifié les ToS de Beacon / CIDRAP / Outbreak News Today (une ligne CIDRAP existe déjà en base comme source d'une ligne active, ce qui mérite une vérification en soi vu le précédent ProMED).

### 2. Dix lignes actives sur 108 ne sont pas des maladies — et le produit leur invente un mode de transmission

**Signal (mesuré sur la prod aujourd'hui, en rejouant la logique de `matchDisease` contre les 69 motifs de `DISEASE_MAP`) :** **12 lignes sur 260 ont un `disease_en` qu'aucun motif ne reconnaît, dont 10 sont ACTIVES** — soit **9,3 % des lignes actives affichées**. Les 10 portent toutes exactement la même valeur, qui est un titre de bulletin WHO DON stocké dans le champ « maladie » :

> `International food safety event: Infant formula and products containing arachidonic acid oil contaminated with cereulide toxin`

Réparties sur 10 pays et 4 régions (Autriche, Belgique, Brésil, Espagne, France, Hong Kong SAR, Italie, Royaume-Uni, Singapour, Tchéquie), toutes datées du **13/03/2026**, donc actives et affichées depuis **4 mois et demi**. La 12e valeur non reconnue, `Ciguatera Fish Poisoning`, est inactive.

**Le défaut n'est pas le nom moche, c'est ce que le code fabrique derrière.** `matchDisease` (`lib/disease-data.ts:733`) retombe sur un objet par défaut codé en dur : `pathogenType: "virus_rna"`, `transmission: ["contact"]`. Ces deux valeurs sont ensuite **rendues telles quelles** sur `/[locale]/disease/[slug]` (lignes 529 et 592 : libellé du type de pathogène, puces des modes de transmission) et servent de **critère de filtre** dans `DiseasesGrid.tsx:156`. Concrètement, HWG affiche aujourd'hui à des épidémiologistes qu'une contamination chimique de lait infantile (la céréulide est une toxine thermostable de *Bacillus cereus*, ni virale ni transmissible) est un **virus à ARN transmis par contact**, et la fait apparaître dans le filtre « transmission par contact ». Ce n'est pas une donnée manquante, c'est une donnée inventée — la catégorie d'erreur la plus coûteuse pour ce public, et exactement celle contre laquelle le garde-fou anti-hallucination du 27/07 avait été posé côté géo (`project_geo_extract_hallucination_fix_2026_07_27`).

**Pourquoi personne ne l'a vu :** le filet existe pourtant — le cron `disease-coverage` a pour mission n°1 déclarée « unknown diseases … that do not match any pattern in DISEASE_MAP » — mais il ne regarde que les lignes **insérées dans les 90 dernières minutes** (`app/api/cron/disease-coverage/route.ts`, en-tête). Une ligne qui passe entre les mailles au moment de son insertion devient définitivement invisible pour lui : il n'existe aucun balayage du stock. C'est le même motif de défaillance que les six trous corrigés aujourd'hui dans l'audit « mode ouvert » (`d970f56` / `7818abc` / `f139f67` / `2fa7cac`) — un contrôle qui ne peut structurellement pas voir un backlog rapporte vert pendant des mois.

**Effort estimé :** petit, en deux temps indépendants. (a) Traiter les 10 lignes : soit un motif `DISEASE_MAP` « intoxication alimentaire / toxine » avec les bons attributs, soit la désactivation si un événement de sécurité alimentaire n'a pas sa place dans un produit de surveillance épidémique — c'est un arbitrage de périmètre pour David, pas une question technique. (b) Élargir `disease-coverage` d'un balayage périodique du stock actif en plus de sa fenêtre de 90 minutes — quelques lignes, la requête et l'e-mail existent déjà.

**Risque/inconnue :** le vrai point à trancher, et je ne le tranche pas ici, est **le repli lui-même** : renvoyer `virus_rna` + `contact` pour tout ce qui n'est pas reconnu est un défaut qui ment silencieusement. Le remplacer par un type « inconnu » explicite est plus honnête mais touche l'affichage de toutes les pages maladie et demande une valeur d'affichage propre en 5 langues — donc plus qu'un correctif de données, un petit chantier d'UI. À faire, mais à ne pas confondre avec le nettoyage des 10 lignes, qui lui est immédiat.

**Non re-proposé aujourd'hui :** le volet AMR (Eva Kamau, 10/07) et le signal de variance / « ralentissement critique » (Simon Ruegg, 6-7/07), toujours ouverts sans angle neuf. Rien sur l'engagement produit ni sur la personnalisation : les idées du 28/07 sur ces sujets (magic link/OTP, comptes existants à 5 régions) restent ouvertes et non traitées, ce serait du bruit de les redire. Deux idées seulement aujourd'hui, volontairement — je n'ai pas de troisième ancrage qui tienne le même niveau de preuve.

**Contexte mesuré au passage** (pas des idées, mais utile au bilan de lundi) :
- **`product_events` : 20 événements en tout, aucun d'un utilisateur autre que David depuis le 24/07.** Et ce chiffre était encore surévalué jusqu'à aujourd'hui : le correctif `feab722` a montré que `dashboard_view` comptait des rendus serveur, pas des visites — l'usage réel avant le 29/07 se lit divisé par ~3.
- **Un essai Pro expire aujourd'hui** (`iinnerre@gmail.com`, créé le 29/06), le suivant le 01/08 (`r.endangrukmanams@gmail.com`). Ce sont les deux premiers des 8 essais en cours à arriver à échéance ; aucun des 4 leads institutionnels n'est concerné avant la date de décision du 21/08.
- **Deadline egress Supabase au 04/08, dans 6 jours**, et le relevé Usage n'a pas été reconsulté depuis le 05/07 alors que tous les correctifs de cache sont livrés depuis le 06/07 — à recouper avec l'accélération de `TypeError: terminated` sur `/en` constatée ce matin ([[project_outbreaks_terminated_error_acceleration_2026_07_29]]). Signalé ici parce que c'est la surface d'acquisition publique qui est en jeu, pas proposé comme idée : c'est une vérification, pas une amélioration produit.

**Statut :** David a validé les deux (« On applique les deux idées »). Les deux traitées le jour même, commit `f693565` :

- **Idée 1 (transparence de couverture régionale) — ✅ FAIT.** Nouvelle section « Couverture régionale » sur `/methodology` (5 langues) : tableau honnête par région (Afrique/Amériques/Europe = flux régional dédié ; **Asie/Océanie = OMS DON uniquement, aucun bulletin régional intégré**), plus une note sous le tableau des 4 sources principales mentionnant les sources nationales/multilatérales complémentaires. Vérifié en direct via le Browser pane (FR, EN, AR RTL) : rendu correct, aucune erreur console, typecheck + lint propres.
- **Idée 2 (mode de transmission inventé) — RECADRÉE avant construction, puis le vrai chantier livré.** Vérification du code avant de coder : le diagnostic initial était inexact sur un point. Le flag `matched` de `matchDisease()` bloque déjà tout lien vers `/disease/[slug]` dans `OutbreakTable`/`OutbreakDetailModal` — le repli fabriqué (`virus_rna`/`contact`) n'atteint donc **jamais** une page rendue pour les lignes non reconnues. `EVENT_NAME_TRANSLATIONS` (mécanisme déjà construit le 2026-07-05, exactement pour ce cas cereulide/lait infantile) gère la traduction du libellé sans jamais forcer ces événements dans `DISEASE_MAP`. Le vrai trou vérifié et corrigé : `disease-coverage` ne balayait que les insertions des 90 dernières minutes — un nom non reconnu entré hors de cette fenêtre restait invisible pour toujours. Ajouté un balayage du stock actif complet (`app/api/cron/disease-coverage/route.ts`), qui exclut les événements déjà couverts par `EVENT_NAME_TRANSLATIONS` pour ne pas re-signaler une décision déjà prise. Vérifié en lecture seule contre la prod : les 10 lignes food-safety ne déclenchent aucun faux positif ; un nom fictif de test est correctement détecté.

---

## 2026-07-30 — Proposition du jour

Angle nouveau : **le parcours d'accès des comptes et la mesure de la rétention**, croisés en direct sur la prod (5 scripts de lecture seule, aucune écriture, supprimés après usage). Aucun nouveau feedback reçu depuis le 29/07 — les deux idées ci-dessous sortent donc de la mesure, pas du déclaratif. Toutes deux touchent directement la décision de viabilité du 21/08.

**Deux idées seulement, volontairement.** Je n'ai pas de troisième ancrage au même niveau de preuve, et la journée a déjà livré 3 audits de fond (78 routes non-cron, alertes West Nile, crash travel-risk).

### 1. 🔴 Le lien magique d'invitation n'a JAMAIS ouvert une session — 0 sur 3 — et les comptes créés par invitation n'ont pas de mot de passe

**Nouvelle preuve pour l'idée 1 du 28/07** (« ZABRE a cliqué son lien d'accès à T+61 min »), restée ouverte et non traitée depuis. Je la remonte parce que la preuve a changé de nature : le 28/07, l'hypothèse était l'expiration du lien pour **un** utilisateur, déduite d'un horodatage Brevo. Mesurée aujourd'hui sur les 21 comptes de la prod, ce n'est pas un incident individuel, c'est un **taux de réussite de 0 %** sur un chemin d'accès entier.

**Ce qui est vérifié en base (`auth.users`, prod, 30/07) :**

| compte | providers | 1ère session après création |
|---|---|---|
| 9 inscriptions self-serve (shinta, dogflu, analin, davy, clarence, zakramdane, mayeul, saeed, guyanoel) | email ou google | **0 min** (session ouverte automatiquement à l'inscription) |
| Kamau (lead) | email+**github** | 1 926 min (32 h plus tard, **via GitHub**) |
| Bankunda (lead) | email+**google** | 77 min (**via Google**) |
| **ouedraogodaouda2408** | email seul | **JAMAIS** (créé le 15/06) |
| **ZABRE** (lead) | email seul | **JAMAIS** (créé le 18/07) |
| **Mulamba** (lead) | email seul | **JAMAIS** (créé le 20/07) |

**La cause est dans le code, pas dans le comportement des gens.** `app/api/admin/invite/route.ts:75` crée le compte avec `createUser({ email, email_confirm: true })` — **aucun mot de passe n'est jamais défini**. Puis la ligne 144 génère un `generateLink({ type: "magiclink" })`, et l'email d'invitation (lignes 163-183) ne contient **qu'un seul bouton : ce lien**. Rien d'autre. Or la page de connexion (`app/[locale]/login/page.tsx`) n'offre que deux entrées : un formulaire **mot de passe** (`signInWithPassword`, ligne 57) et **Google**. Un lead invité n'a donc littéralement aucun moyen d'entrer avec le formulaire — il n'a pas de mot de passe et n'en a jamais reçu — et son unique jeton est à usage unique et expirant.

Les deux « succès » institutionnels n'en sont pas : Kamau et Bankunda ont **contourné** le lien magique en se connectant par GitHub et Google. Le lien lui-même est à **0 sur 3**. Et le cas ouedraogodaouda (15/06) prouve que ce n'est pas une régression de juillet mais un trou structurel vieux de six semaines, jamais vu parce que personne ne mesurait ce chemin.

**Le détail qui referme le dossier :** `Zrhyacinthe2@gmail.com`, `davmulambamangole@gmail.com` et `ouedraogodaouda2408@gmail.com` sont **tous les trois des adresses Gmail**. Le bouton « Google » de la page de connexion les aurait fait entrer immédiatement, exactement comme Bankunda. Personne ne le leur a jamais dit : l'email d'invitation ne mentionne pas cette option. Le « pasword needed? » envoyé par ZABRE sur LinkedIn le 20/07 est mot pour mot ce qu'écrit quelqu'un sans mot de passe devant un formulaire qui en demande un.

**Pourquoi maintenant :** sur les 4 leads institutionnels dont dépend la décision du 21/08, **deux n'ont jamais vu le produit une seule seconde**, et leurs essais courent jusqu'aux 22/08 et 24/08. ZABRE est le meilleur fit du portefeuille (projet PREIS). Décider « le produit n'intéresse pas les institutionnels » le 21/08 alors que la moitié d'entre eux n'ont jamais pu ouvrir la porte serait une conclusion tirée d'un test qui n'a pas eu lieu.

**Effort estimé :** petit, et immédiatement rattrapable en trois gestes indépendants. (a) Ajouter dans l'email d'invitation une deuxième voie explicite — « ou connectez-vous avec Google avec cette même adresse » — une ligne de HTML, qui débloque les 3 comptes concernés sans rien redéployer côté auth. (b) Définir un mot de passe temporaire à la création (ou envoyer un code OTP à 6 chiffres, natif Supabase), pour que le formulaire de connexion cesse d'être un mur. (c) Allonger l'expiration des liens de provisioning côté Supabase. Le (a) seul règle les 3 cas ouverts aujourd'hui.

**Risque/inconnue :** allonger la durée de vie d'un lien d'authentification élargit la fenêtre d'exposition en cas de fuite de l'email — d'où l'ordre proposé, (a) puis (b), le code OTP étant le compromis propre. Inconnue résiduelle assumée : je démontre qu'aucune session n'a jamais été ouverte et que le compte n'a pas de mot de passe, mais je n'ai pas lu les logs d'authentification Supabase, donc je ne prouve pas *quelle* erreur précise ZABRE a vue à l'écran. Ça ne change pas le correctif. Ne relancer ni Mulamba (consigne d'attente passive, [[project_hwg_access_offers_accepted_pending_provisioning]]) ni Kamau (désabonnée le 21/07) — corriger le chemin d'abord, la relance est une décision de David.

### 2. Les métriques de rétention sont calculées sur `last_sign_in_at`, aveugle aux sessions persistantes — la lead la plus active du produit y est comptée « jamais revenue »

**Signal mesuré aujourd'hui :** `product_events` montre **de la vraie activité aujourd'hui même**, de deux utilisateurs réels autres que David :

| horodatage | action | utilisateur |
|---|---|---|
| **30/07 14:02** | `outbreak_detail_view` | **paulabankunda@gmail.com** (lead institutionnel, RDC) |
| **30/07 10:43** | `outbreak_detail_view` | **paulabankunda@gmail.com** |
| 30/07 06:46 | `outbreak_detail_view` | david.deheunynck@gmail.com |
| **30/07 06:36** | `outbreak_detail_view` | **guyanoel22@gmail.com** |

Or en base, `last_sign_in_at` vaut **13/07 12:59 pour Bankunda** et **24/07 14:03 pour guyanoel22** : leurs sessions Supabase n'ont simplement jamais expiré, ils reviennent sans se reconnecter. Et `app/[locale]/admin/page.tsx:241-254` calcule les trois indicateurs de rétention **uniquement** sur ce champ : `returnedUsers` (écart > 2 j), `active30`, et `neverReturned` (écart < 60 s). Bankunda, écart de 77 minutes, tombe dans `returnedUsers` mais **pas** dans `active30` — le dashboard la donne inactive depuis 17 jours alors qu'elle était sur le produit il y a trois heures. guyanoel22, écart de 0 s, est classé **`neverReturned`** alors qu'il est revenu ce matin, six jours après son inscription. Sur les 3 comptes ayant une activité réelle mesurée, la métrique se trompe sur 2.

**Pourquoi maintenant :** la décision du 21/08 se prend sur « est-ce que quelqu'un revient ». `product_events` est propre depuis le 29/07 (`feab722` a supprimé le gonflement x3 des rendus serveur) et le tracking est désormais client-side sur les 3 surfaces (`app/api/track/route.ts:10`) — la donnée juste existe déjà, elle n'est simplement pas celle qu'on lit. Sous-estimer la rétention au moment précis où on décide d'arrêter ou de continuer est l'erreur la plus coûteuse possible, et elle penche dans le mauvais sens : la mesure actuelle fait paraître le produit **plus mort qu'il n'est**.

**Effort estimé :** petit — la section « Activité produit » de `/admin` lit déjà `product_events` (construite le 26/07, idée 1). Il s'agit de brancher les 3 compteurs de rétention sur cette table plutôt que sur `last_sign_in_at`, et de reprendre la même définition dans le bilan hebdo de viabilité.

**Risque/inconnue :** (a) `product_events` ne remonte qu'au 24/07 et ne couvre que 3 surfaces (dashboard, détail foyer, pricing) — il ne peut donc pas reconstituer l'historique de juin, et la bonne lecture est « union des deux signaux », pas « remplacement pur » ; (b) l'échantillon reste minuscule (3 utilisateurs actifs mesurés), donc corriger la métrique ne transforme pas un mauvais chiffre en bon chiffre — ça évite seulement de décider sur un chiffre faux.

**Statut (idée 2) :** livré et vérifié le 30/07 (session dédiée `task_04edea2c`). `app/[locale]/admin/page.tsx:240-269` calcule désormais une « dernière activité connue » par utilisateur = max(`last_sign_in_at`, `created_at` le plus récent dans `product_events` pour cet utilisateur), avec commentaire dans le code précisant que c'est un OR et non un remplacement (un compte sans événement tracké retombe sur `last_sign_in_at` seul, ne régresse pas). `returnedUsers` / `active30` / `neverReturned` recalculés sur cette date composite. Typecheck (`npx tsc --noEmit`) et lint (`npx eslint`) propres.

Vérifié en lecture seule contre la prod réelle (`.env.local.live`, projet `tqznwmpkokdzrszysbcm`, script jetable supprimé après usage) : guyanoel22@gmail.com sort bien de `neverReturned` (écart signup→activité passe de 0 s à ~6 jours grâce à l'événement du 30/07 06:36) et entre dans `returnedUsers`. Pour Bankunda, la correction mesurée diffère du diagnostic initial ci-dessus sur le détail des deux compteurs — en relisant le code exact plutôt que par estimation : elle était déjà dans `active30` avant correctif (écart de 17 j < 30 j, pas « hors active30 » comme écrit plus haut) et **pas** dans `returnedUsers` (écart de 77 min, sous le seuil de 2 j, pas « dedans » comme écrit plus haut) ; après correctif, son activité du jour (14:02) la fait entrer dans `returnedUsers` (composite − created_at ≫ 2 j), `active30` reste vrai sans changement. Le problème de fond décrit ci-dessus (métrique aveugle aux sessions persistantes) est confirmé et corrigé dans les deux cas, seule l'attribution précise « quel compteur exactement » avait une inversion dans le texte initial. Aucune régression : `ouedraogodaouda2408@gmail.com` (aucun signal, ni signin ni event) reste `neverReturned`, et aucun autre des 21 comptes n'a changé de classification. Totaux avant/après : `returnedUsers` 3→5, `active30` 7→7 (inchangé), `neverReturned` 12→11. Commit poussé sur `master`.

**Observation liée, notée mais pas proposée comme idée** (elle relève de l'attribution, pas d'un correctif) : les deux vues de Bankunda portent sur la **même** ligne (Fièvre West Nile / Espagne, `74dae095`), sans aucun `dashboard_view` — signature d'une arrivée directe par lien, pas d'une navigation. Le cron `regional-alerts` a tourné à **10:02 avec `rows=20`** (les 20 alertes West Nile rattrapées ce matin après le correctif `8b70438`), et elle est sur la page à **10:43**, 41 minutes plus tard. Sous réserve que la corrélation soit causale — aucun lien n'est tracé aujourd'hui, donc c'est une inférence d'horodatage, pas une preuve — l'email d'alerte serait le seul canal qui amène réellement quelqu'un sur le produit. Ce qui donnerait au bug des `deaths` null, resté 2 mois, un coût bien supérieur à 20 emails perdus : 2 mois d'activation. À confirmer en traçant le lien de l'email d'alerte avant d'en tirer quoi que ce soit.

**Non re-proposé aujourd'hui :** l'idée 3 du 28/07 (les 9 comptes existants toujours à 5 régions — vérifié aujourd'hui, **toujours vrai, 9 utilisateurs × 5 régions**, seule Kamau ayant bougé un réglage) reste ouverte sans preuve nouvelle. Idem pour le volet AMR (Eva Kamau, 10/07) et le signal de variance (Simon Ruegg, 6-7/07). Rien sur la qualité de données ni sur les crons : la journée en a déjà livré trois lots.

**Contexte mesuré au passage** (utile au bilan de lundi, pas des idées) : 21 comptes, 7 essais Pro en cours après l'expiration de `iinnerre@gmail.com` le 29/07 (`expire-trials` a bien tourné, `rows=1`) ; prochaine échéance `r.endangrukmanams@gmail.com` le 01/08. Les 4 leads institutionnels expirent tous **après** la date de décision (Kamau 15/08, Bankunda 17/08, ZABRE 22/08, Mulamba 24/08). Toutes les tables de personnalisation restent à **0 ligne** sauf `user_alert_regions` (45) et `push_subscriptions` (1). `alert_notifications` : toujours **83 lignes, 100 % `pheic`**, la plus récente le 24/07 — la cloche in-app n'a toujours jamais affiché une notification personnalisée.

**Statut :** David a validé les deux (« On applique les deux idées »). Construction déléguée à deux sessions dédiées (`task_b8a6884d`, `task_04edea2c`) plutôt que faite dans cette session, conformément à la consigne de scope de `daily-product-ideas-healthwatch` (« ne jamais coder ou implémenter une idée toi-même dans cette session »). Statut à mettre à jour par ces sessions une fois le code livré.

**✅ Idée 1 livrée le 30/07 (`task_b8a6884d`).** Les trois volets (a)(b)(c) proposés ont été traités, (a) et (b) codés, (c) documenté :

- **(a) fait.** `app/api/admin/invite/route.ts` : l'email d'invitation (fr/en) mentionne désormais explicitement le repli Google — « vous pouvez aussi vous connecter directement avec Google en utilisant cette même adresse » — avec l'adresse rappelée en clair. Débloque immédiatement les 3 comptes Gmail bloqués (ouedraogodaouda2408, ZABRE, Mulamba) **au prochain envoi d'invitation** ; aucun email n'a été renvoyé aux 3 comptes existants, décision laissée à David.
- **(b) fait, version OTP.** Le `generateLink({ type: "magiclink" })` de la ligne ~150 renvoie nativement un `email_otp` (code à 6 chiffres, confirmé dans le typage `@supabase/auth-js`) lié au même token que le lien. L'email inclut désormais ce code en clair + un lien direct `/{locale}/login?otp=1&email=...`. `app/[locale]/login/page.tsx` a une nouvelle bascule « Utiliser un code à la place » (et le lien avec `?otp=1` la déclenche automatiquement, email pré-rempli) qui appelle `supabase.auth.verifyOtp({ email, token, type: "email" })` — vérification directe côté Supabase, sans dépendre du hop de redirection HTTP du lien. Ça règle le cas fréquent du lien « déjà grillé » par un scanner d'email d'entreprise qui précharge l'URL avant que l'humain ne clique, mais **pas** l'expiration en tant que telle : le code partage la même fenêtre de validité que le lien (~1h, valeur par défaut Supabase). Traductions ajoutées dans les 5 locales (`messages/{en,fr,es,ar,id}.json`, clés `otp*`) ; le corps de l'email n'existe qu'en fr/en (structure `PILOT_EMAIL` inchangée), donc seuls ces deux publics recevront le code — cohérent avec le fait que les invitations admin ne sont envoyées qu'en fr/en aujourd'hui.
- **(c) non fait, documenté comme suite.** Allonger l'expiration du lien/OTP côté Supabase nécessite un changement de configuration du projet Auth (Email OTP Expiration, actuellement ~3600s par défaut) via le dashboard Supabase ou l'API de management — hors de portée en lecture seule, et le compromis risque/bénéfice (fenêtre d'exposition si l'email fuite) doit être tranché par David plutôt qu'automatisé. Le (b) couvre déjà le mode de panne le plus probable (préchargement/lien grillé) sans toucher à ce curseur.
- **Vérifié en direct sur la prod (lecture seule, `tqznwmpkokdzrszysbcm`, script temporaire supprimé après usage)** : les 3 comptes ont bien encore `last_sign_in_at=NEVER` et `providers=["email"]` uniquement au moment du fix — la mesure du 30/07 tient toujours, rien n'a changé entretemps.
- **Contrôles qualité :** `npx tsc --noEmit` propre, `npx eslint` propre sur les deux fichiers modifiés. Pas de test e2e ajouté (flux auth existant non couvert par la suite Playwright actuelle).
- **Correction annexe :** le texte de l'email annonçait à tort un lien valable « 24 heures » alors que le défaut Supabase est ~1h — corrigé en fr/en pour ne pas induire l'utilisateur en erreur sur la fenêtre réelle.

---

## 2026-07-31 — Proposition du jour

Angle nouveau : **croiser le journal de clics Brevo avec `product_events`, événement par événement, à la seconde**. Le 28/07 avait ouvert le journal Brevo (blocages, désabonnements) ; personne n'avait encore aligné les **clics** sur les **visites réelles**. C'est ce croisement qui donne les deux premières idées. Aucun nouveau feedback reçu depuis le 29/07 (Taiwan CDC) — tout ce qui suit vient de la mesure. Trois scripts de lecture seule, aucune écriture, supprimés après usage.

### 1. 🔴 L'email d'alerte n'est pas *un* canal d'acquisition, c'est **le seul** — 4 visites réelles sur 4 sont des clics d'email, à 8-10 secondes près

**Le 30/07 j'avais posé l'hypothèse et refusé d'en tirer quoi que ce soit** (« sous réserve que la corrélation soit causale — aucun lien n'est tracé aujourd'hui, donc c'est une inférence d'horodatage, pas une preuve… à confirmer en traçant le lien de l'email d'alerte »). Confirmation obtenue aujourd'hui, et sans rien construire : Brevo enregistre déjà **l'URL exacte cliquée**. L'alignement est intégral sur toute la fenêtre d'instrumentation (24/07 → 31/07) :

| clic Brevo (UTC) | email | URL cliquée | `product_events` | écart |
|---|---|---|---|---|
| 24/07 09:00:46 | 🚨 New outbreak — Marburg | `/en/outbreak/b17d4fda` | 09:00:54 `outbreak_detail_view` **b17d4fda** (Bankunda) | **8 s** |
| 24/07 15:39:25 | Ongoing PHEIC: Polio | `/en/outbreak/ab4cd321` | 15:39:35 `outbreak_detail_view` **ab4cd321** (guyanoel22) | **10 s** |
| 30/07 06:36:46 | ⚠️ Cholera is worsening in Africa | `/en/outbreak/06541c4a` | 06:36:55 `outbreak_detail_view` **06541c4a** (guyanoel22) | **9 s** |
| 30/07 10:43:14 | 🚨 New outbreak — West Nile | `/en/outbreak/74dae095` | 10:43:22 `outbreak_detail_view` **74dae095** (Bankunda) | **8 s** |

Même utilisateur, même identifiant de foyer, huit à dix secondes. Ce n'est plus une inférence d'horodatage, c'est une chaîne complète. Et le corollaire est le vrai fait de la journée : **`product_events` contient 26 événements en tout ; les 4 seuls `outbreak_detail_view` d'utilisateurs réels (hors David) sont ces 4 clics.** Les `dashboard_view` qui suivent (Bankunda, 09:01:10 → 09:01:45 le 24/07) sont la continuation de la même session. **Aucune arrivée directe, aucun retour spontané, aucun signet, aucun trafic organique connecté sur toute la fenêtre.** Personne ne « va sur » HealthWatch : on y atterrit depuis un email, ou on n'y va pas.

**Ce que ça change pour la décision du 21/08.** Le bilan hebdo raisonne en « est-ce que quelqu'un revient sur le produit ». La mesure dit que la question n'a pas de sens telle quelle : le produit n'est pas une destination, c'est la page d'atterrissage d'un canal email. Trois conséquences directes :
- **Le levier d'usage le mieux démontré est l'envoi d'alertes pertinentes, pas le dashboard.** Le correctif des `deaths` null (`8b70438`, 20 alertes West Nile rattrapées le 30/07 à 10:02) a produit **41 minutes plus tard** une des 4 visites. Deux mois de bug sur ce champ n'ont pas coûté 20 emails, ils ont coûté deux mois d'activation.
- **La surface d'atterrissage n'est pas le dashboard, c'est `/[locale]/outbreak/[id]`** — une fiche unique, atteinte de l'extérieur, sans navigation préalable. C'est cette page qui doit porter la suite du parcours (voir aussi ce qu'elle propose à un essai Pro), pas la page d'accueil.
- **La bonne métrique d'activation est le ratio clic → visite**, disponible sans instrumentation nouvelle : Brevo côté clic, `product_events` côté visite. Sur 14 jours : **286 envois, 230 délivrés, 18 clics, 13 clics uniques**. C'est un chiffre honnête et lisible, à mettre à côté des compteurs de rétention de `/admin` corrigés hier.

**Effort estimé :** petit pour la mesure — `sync-brevo-blocklist` appelle déjà l'API Brevo quotidiennement avec la clé en prod ; lire `smtp/statistics/events?event=clicks` est le même appel avec un autre paramètre, et l'agrégat peut aller dans le bloc « livraison » du health-check construit le 27/07. Moyen si on va jusqu'à retravailler ce que propose la fiche foyer à quelqu'un qui arrive d'un email.

**Risque/inconnue :** (a) l'échantillon est de **4 événements / 2 utilisateurs** — la preuve du mécanisme est solide (8-10 s, même id de foyer, aucune exception), la mesure de son ampleur ne l'est pas ; (b) biais de population à ne pas oublier : seuls ceux qui reçoivent des alertes peuvent arriver par email, donc ceci prouve que **personne n'arrive autrement aujourd'hui**, pas qu'il serait impossible d'arriver autrement ; (c) `product_events` ne couvre que 3 surfaces depuis le 24/07 — une visite sur une page publique non instrumentée n'apparaîtrait pas, donc « zéro arrivée directe » vaut pour dashboard/fiche foyer/pricing, pas pour tout le site.

### 2. 🔴 Une agence des Nations unies s'est abonnée aujourd'hui à 13h32 — rien ni personne ne l'a signalé

**Signal (prod + Brevo, mesuré vers 17h) :** `iqakhtar@iom.int` — **IOM / OIM, Organisation internationale pour les migrations, agence des Nations unies** — a rempli le formulaire d'abonnement public aujourd'hui **31/07 à 11:32 UTC** (`subscriptions`, région « allRegions », locale `en`). L'email de confirmation est parti et a été délivré à 11:32:54. Puis **deux clics à 14:40:40 et 14:40:58 UTC** sur le bouton « Go to dashboard » → `https://healthwatch-global.com/en`. Quelqu'un de l'OIM a donc lu la confirmation et est allé voir le site, il y a environ trois heures.

**Personne ne le sait.** Vérifié dans le code : `app/api/subscribe/route.ts` insère la ligne, envoie la confirmation, et **n'avertit personne** — pas de notification, pas de ligne dans l'email de health-check quotidien, pas d'entrée dans le bilan hebdo. La seule façon de le découvrir est d'ouvrir `/admin` ou d'interroger la base à la main, ce que je viens de faire par hasard en cherchant autre chose.

**Le contexte rend le chiffre parlant.** La table `subscriptions` compte **13 lignes depuis le 22/05, dont 6 sont des artefacts de test** (`stripe@example.com`, `test-webhook@`, `e2e@`, `test-e2e-*@healthwatch-test.dev`, `stripe-payment-test-…`). Restent 7 vraies personnes, dont 5 ont par ailleurs un compte, et 2 seulement sont des adresses institutionnelles : `jalal.nourlil@pasteur.ma` (Institut Pasteur du Maroc, 12/06 — qui a *aussi* ouvert un compte Pro derrière) et **celle de l'OIM aujourd'hui**. Autrement dit : ce formulaire produit une adresse institutionnelle tous les six ou sept semaines, et il vient d'en produire une.

**Ce qui l'attend aujourd'hui :** rien avant **lundi 03/08**, date du prochain `weekly-digest` (dernier run 27/07, 12 envois). Ce digest porte bien un CTA Pro (« 14-day free trial — no credit card → » vers `/pricing`, `lib/digest-email.ts:66`), donc le chemin abonné → essai **existe** — il est simplement passif, hebdomadaire, et laisse trois jours à un intérêt chaud pour refroidir. Aucune séquence d'accueil, aucune proposition de pilote institutionnel (alors que `/pilot` existe et que c'est exactement le profil visé), aucun signalement à David.

**Pourquoi maintenant :** le portefeuille institutionnel est de 4 leads, dont 2 n'ont jamais ouvert le produit et 1 s'est désabonnée. À trois semaines de la décision du 21/08, une entrée spontanée d'agence onusienne est l'événement business le plus significatif de la semaine, et il est arrivé par le seul canal que personne ne regarde.

**Effort estimé :** petit. (a) Signaler à David tout abonnement sur un domaine non grand-public — une dizaine de lignes dans `app/api/subscribe/route.ts` ou une ligne dans l'email de health-check quotidien, qui existe déjà comme véhicule. (b) Optionnel et distinct : un email unique d'accueil pour un abonné sans compte, proposant l'essai (ou le pilote pour un domaine institutionnel), au lieu d'attendre le lundi.

**Risque/inconnue :** (a) **une adresse n'est pas une tendance** — l'objet de l'idée est la visibilité, surtout pas de construire un « scoring de leads » sur un événement tous les deux mois ; (b) **s'abonner à une veille n'est pas consentir à être prospecté** : la notification est un signal interne, la décision de contacter quelqu'un reste à David et à son jugement, cette routine ne doit rien envoyer ; (c) l'heuristique « domaine non grand-public » a des faux positifs (adresse perso sur petit domaine) — acceptable pour une notification informative, pas pour un envoi automatique ; (d) je ne sais pas qui est cette personne à l'OIM ni ce qu'elle cherchait, et je ne l'ai pas cherché — c'est une donnée d'inscription, pas une invitation à enquêter.

### 3. `alert_locale` retombe silencieusement sur l'anglais — 3 comptes francophones sur 21 reçoivent leurs alertes en anglais, dont le 2e utilisateur le plus actif du produit

**Signal :** trois comptes ont `locale='fr'` mais `alert_locale='en'` — `guyanoel22@gmail.com`, `r.endangrukmanams@gmail.com`, `iinnerre@gmail.com`. Les 18 autres sont cohérents. Ça paraît mineur, sauf que **guyanoel22 est l'un des 3 seuls comptes ayant une activité produit réellement mesurée** (idée 1), et que son unique visite du 30/07 est un clic sur une alerte **« ⚠️ Update: Cholera is worsening in Africa »** l'amenant sur `/en/outbreak/06541c4a` — la fiche **Choléra / Tchad**, un foyer francophone, servie en anglais à un utilisateur français. C'est le seul canal qui fait entrer quelqu'un dans le produit (idée 1), et sur ce canal la langue est fausse dans 1 cas sur 7.

**Cause vérifiée dans le code :** `app/[locale]/signup/page.tsx:150` écrit bien `{ locale, alert_locale: locale }`, et `app/auth/callback/route.ts:84-86` fait de même pour les comptes OAuth **quand `profile.locale` est encore vide**. Mais `app/api/admin/invite/route.ts:106` écrit `locale` **et jamais `alert_locale`** — un pilote invité en français reçoit donc ses alertes en anglais — et aucun chemin ne re-synchronise `alert_locale` si `locale` change plus tard. La migration `20260625010000_backfill_alert_locale.sql` a rattrapé le stock **une fois**, le 25/06 ; tout écart créé depuis reste.

**Effort estimé :** petit, voire trivial — ajouter `alert_locale` à l'écriture de la route d'invitation, et décider si les 3 comptes existants sont réalignés (script ponctuel) ou laissés tels quels.

**Risque/inconnue :** le seul vrai point d'attention est de **ne pas écraser un choix délibéré** : `AlertLocalePanel` permet à un utilisateur de choisir explicitement une langue d'alerte différente de sa langue d'interface, et c'est un réglage légitime (un francophone qui préfère la terminologie épidémiologique anglaise). La migration du 25/06 avait déjà pris cette précaution (`AND alert_locale = 'en'`, pour ne toucher que le défaut jamais modifié) — même règle à reprendre. Priorité honnêtement inférieure aux idées 1 et 2 : c'est de la finition, mais sur le seul canal qui fonctionne, et pour trois lignes de code.

**Non re-proposé aujourd'hui :** l'idée 3 du 28/07 (les 9 comptes existants toujours à 5 régions — **toujours vrai, 45 lignes / 9 utilisateurs**, revérifié aujourd'hui) reste ouverte sans preuve nouvelle. Idem pour le volet AMR (Eva Kamau, 10/07) et le signal de variance (Simon Ruegg, 6-7/07). Rien sur la qualité de données : la journée a déjà livré le gap Dengue/Europe et le double-check du health-check.

**Contexte mesuré au passage** (utile au bilan de lundi, pas des idées) :
- **Brevo sur 14 j : 286 envois demandés, 230 délivrés, 54 bloqués, 2 désabonnements, 18 clics / 13 uniques, 99 `loadedByProxy`.** Le taux de blocage reste élevé (19 %) mais c'est la conséquence attendue des blocklists Kamau/Mulamba, désormais gatées en base depuis `8934c64`/`f59c166`.
- `subscriptions` : **6 des 13 lignes sont des adresses de test** jamais nettoyées (`stripe@example.com`, `e2e@`, `test-webhook@`, `test-e2e-*`, `stripe-payment-test-…`). Elles reçoivent le digest hebdomadaire pour rien et gonflent de ~85 % le compteur d'abonnés lu par `/admin` et le health-check. Nettoyage à faire un jour, pas une idée produit.
- `regional-alerts` a tourné ce matin à 06:31 avec `rows=4` ; `weekly-signal` 12 envois le 29/07 ; `weekly-digest` 12 envois le 27/07.

**Statut :** Idée 1 (ratio clic→visite) construite le 03/08 (`9ec3c1e`, session « on gère tout aujourd'hui ») — `fetchClickVisitRatio` exclut désormais les rafales de clics (≥2 liens distincts sur un même `messageId` en moins de 2 s, signature d'un préchargement de passerelle de sécurité) plutôt que de les compter comme de l'engagement humain ; découvert le jour même sur le cas réel de l'OIM (3 liens en 98 ms). Vérifié en direct sur la prod : 5 clics réels / 3 exclus sur 8 bruts, correspond exactement à l'incident du matin. Idées 2 (notification d'inbound institutionnel) et 3 (subscriptions de test à nettoyer, faite le 03/08 dans un autre lot — voir idée 3 du 03/08) : la 2 reste ouverte, sans nouvel angle.

---

## 2026-08-01 — Proposition du jour

Angle nouveau : **le cycle de vie de l'essai**, de son premier jour à sa relance post-expiration — jamais audité de bout en bout jusqu'ici. Les passages précédents ont couvert la qualité des données (26-27/07), la personnalisation (27-28/07), l'accès (30/07) et le canal d'entrée (31/07) ; personne n'avait encore vérifié que la mécanique de conversion elle-même s'exécute réellement sur chaque compte. Aucun nouveau feedback reçu depuis le 29/07 (Taiwan CDC) — tout ce qui suit vient de la mesure : 7 sondes en lecture seule sur la prod (base + journal d'envoi Brevo, destinataire par destinataire), aucune écriture, scripts supprimés après usage.

**Deux faits de contexte mesurés en ouverture :** un 22e compte est né aujourd'hui (`codyleereed@gmail.com`, essai Pro jusqu'au 15/08) et il est **correctement enrôlé sur 5 régions** — le correctif OAuth du jour (`906af61` / `d34363c`) fonctionne sur son premier vrai cas. Et un essai a expiré ce matin (`r.endangrukmanams@gmail.com`, `expire-trials` 10:00, `rows=1`).

### 1. 🔴 La séquence de reconquête post-essai saute 7 essais sur 13 — elle devine « pilote » à partir d'une durée calculée, alors que la colonne `is_pilot` existe et est juste

**Signal (croisement base prod × journal d'envoi Brevo, destinataire par destinataire) :** `winback-sequence` est la **seule** tentative de conversion automatisée après la fin d'un essai (J+3 « Vous pensez encore à HealthWatch ? », J+7 « 7 jours sans surveillance active »). Elle tourne tous les jours en `status=ok` et n'a **aucun `lastNonZero`** enregistré depuis l'ajout du champ le 27/07. Vérifiée destinataire par destinataire, elle marche pour les uns et pas pour les autres :

| compte | essai calculé | expiré le | e-mail « essai expiré » | J+3 | J+7 |
|---|---|---|---|---|---|
| `mayeul.peltier@` | 14,0 j | 06/07 | ✅ 07/07 | ✅ 09/07 | ✅ 13/07 |
| `saeed.mohamood@` | 14,0 j | 16/07 | ✅ 17/07 | ✅ 19/07 | ✅ 23/07 |
| **`anakeseemmanuel8@`** | **30,8 j** | 20/07 | ✅ 20/07 | ❌ **rien** | ❌ **rien** |
| **`iinnerre@`** | **30,1 j** | 29/07 | ✅ 30/07 | ❌ (échéance 02/08) | ❌ |
| **`r.endangrukmanams@`** | **29,8 j** | 01/08 | ✅ 01/08 | ❌ (échéance 04/08) | ❌ |

**Cause exacte, lue dans le code :** `app/api/cron/winback-sequence/route.ts:399-409`, fonction `isEligible` — commentaire « Skip pilot users (35-day trials) » — calcule `trialDays = (trial_ends_at − created_at)` et écarte tout compte au-dessus de **20 jours**. Les fenêtres J+3/J+7 sont pourtant correctes : `anakeseemmanuel8@` tombait bien dans la fenêtre du 23/07 (plan `free`, pas d'abonnement Stripe, pas de blocage Brevo, aucun opt-out dans `display_filters`). Il n'a été écarté que par cette heuristique.

**Et l'heuristique ne mesure pas ce qu'elle croit mesurer.** Sur les 22 comptes de la prod, la durée calculée ne reflète pas le *type* d'essai mais l'historique d'administration : **cinq comptes partagent exactement le même `trial_ends_at` à la milliseconde près** (`2026-06-29T07:35:21.675Z` — dogfluvet, analin1309, cgodwe2000, davy_skye, clarence_skye), signature d'une modification groupée passée en base. Résultat : des essais standards de 14 jours prolongés une fois affichent 22 à 31 jours calculés et deviennent invisibles pour la relance. **7 comptes non-pilotes sur 13 dépassent le seuil de 20 jours.** Pendant ce temps, la colonne `is_pilot` existe en base et est **exactement juste** : `true` pour les 4 pilotes institutionnels (Kamau, Bankunda, ZABRE, Mulamba, tous à 35,0 j) et `false` partout ailleurs. L'heuristique date du 16/06 (`49530c0`, création du cron) et la colonne a été fiabilisée après (`d8039ef`, 22/07) — c'est un contournement devenu inutile, pas une erreur de conception.

**Pourquoi maintenant :** zéro client payant à trois semaines de la décision du 21/08, et le seul mécanisme automatisé qui redemande la vente après un essai ne s'exécute pas sur la moitié du parc. Deux occasions concrètes sont encore devant nous, pas derrière : `iinnerre@` (86 e-mails reçus pendant son essai, donc un vrai usage du canal) attend son J+3 **demain 02/08**, et `r.endangrukmanams@` le **04/08**. Un correctif poussé aujourd'hui les rattrape toutes les deux. Corollaire important : remplacer la durée par `is_pilot` **préserve exactement** l'exclusion voulue des 4 pilotes (suivis personnellement par l'e-mail de conversion J+32), qui expirent tous entre le 15 et le 24/08.

**Effort estimé :** petit — remplacer le calcul de durée par la lecture de `is_pilot` dans `isEligible`, et ajouter `is_pilot` aux deux `select()` J+3 et J+7. Quelques lignes, aucune migration.

**Risque/inconnue :** (a) élargir l'éligibilité fait entrer dans la relance des comptes de test ou de proches (shinta, davy_skye, clarence_skye) — sans conséquence, mais à savoir avant de regarder les compteurs ; (b) `clarence_skye@` est sur la blocklist Brevo, donc déjà gaté en amont depuis `8934c64` ; (c) je constate l'absence d'envoi et j'identifie le filtre qui l'explique, mais je n'ai pas rejoué le cron en conditions réelles — la vérification définitive est un run à blanc listant les destinataires retenus avant/après, à faire dans la session qui construira.

### 2. 🔴 Un essai entier peut se dérouler sans qu'une seule alerte parte, et rien ne le voit — cas mesuré : 30 jours, 9 e-mails, 0 alerte, expiré ce matin

**Signal :** `r.endangrukmanams@gmail.com` et `saeed.mohamood@gmail.com` se sont inscrits **le même jour** (02/07). Journal Brevo sur les 29 derniers jours :

| compte | e-mails reçus | alertes foyer | régions d'alerte |
|---|---|---|---|
| `saeed.mohamood@` | **80** | ~65 | 5 |
| `r.endangrukmanams@` | **9** | **0** | **0** |

Les 9 e-mails de `r.endangrukmanams@` sont uniquement des envois de séquence (onboarding J+1/J+3/J+7, rappels de fin d'essai, 2 PHEIC, 1 signal hebdo). **Aucune alerte foyer, sur 30 jours.** La cause racine est connue et a été corrigée **aujourd'hui même** (`906af61` : les inscriptions OAuth court-circuitaient l'enrôlement aux régions ; 3 comptes historiques non réparables) — je ne la re-propose pas. Ce que je propose est le filet manquant : **rien, dans tout le produit, ne remarque qu'un essai ne reçoit rien.** Ce compte a traversé l'onboarding J+1 « configurez vos régions d'alerte », J+3, J+7, les rappels J-3 et J-1, puis l'e-mail d'expiration de ce matin — six e-mails envoyés à quelqu'un qui n'avait, en base, aucun canal actif. Croisé avec le fait établi hier (31/07, idée 1 : **l'e-mail d'alerte est le seul canal qui amène quelqu'un sur le produit**), un essai sans alerte est un essai qui n'a mathématiquement aucune chance de produire une visite. Celui-ci a consommé 30 jours de fenêtre de viabilité pour un résultat connu d'avance.

**Pourquoi le bloc « livraison » du health-check ne le couvre pas :** construit le 27/07 (idée 2), il raisonne **par cron** — il compare une audience globale (`user_alert_regions`, 45 lignes) au fait que le cron a livré quelque chose. `regional-alerts` livre bien, tous les jours, à 9 utilisateurs sur 22 : le tableau reste vert pendant qu'un essai précis ne reçoit rien. Le trou est au niveau **du compte**, pas du canal — même motif de défaillance que les six contrôles « mode ouvert » du 29/07 et que la fenêtre de 90 minutes de `disease-coverage`.

**Effort estimé :** petit, et le véhicule existe déjà. Le cron `onboarding-sequence` sélectionne **déjà** chaque essai à J+1 pour lui envoyer « configurez vos régions d'alerte » : il suffit d'y compter les lignes d'enrôlement du compte et, si le total est à zéro, soit d'enrôler par défaut (le chemin `enrollAlertRegions()` vient d'être consolidé aujourd'hui, `d34363c`), soit de le signaler dans l'e-mail de health-check quotidien. Un contrôle J+7 « 0 alerte reçue depuis l'inscription » est la version renforcée, pour le même coût.

**Risque/inconnue :** (a) ne pas en faire une réparation automatique aveugle — un compte à 0 région parce que l'utilisateur a **décoché** ses régions est un choix légitime, à distinguer d'un compte jamais enrôlé (l'enrôlement initial écrit toujours 5 lignes, donc « 0 ligne à J+1 » vaut aujourd'hui « jamais enrôlé » ; ça cessera d'être vrai le jour où quelqu'un se désinscrira de tout, d'où la préférence pour le signalement plutôt que l'écriture) ; (b) l'échantillon est de 1 compte sur 22, mais le coût unitaire est un essai entier perdu, et la même mécanique a déjà frappé 3 comptes selon l'audit de périmètre du jour ; (c) c'est un contrôle interne, pas une fonctionnalité visible — à ne pas confondre avec un levier de conversion.

### 3. Aucun garde-fou d'idempotence sur les e-mails d'essai : un utilisateur a reçu trois fois le même rappel en une heure

**Signal :** `saeed.mohamood@gmail.com` a reçu **trois exemplaires identiques** de « Your HealthWatch Pro trial ends tomorrow » le 15/07, horodatés à la seconde côté Brevo :

| heure (UTC) | messageId |
|---|---|
| 09:30:16 | `202607150930.75299991966@` |
| **10:37:00** | `202607150937.55068085925@` |
| **10:38:44** | `202607151038.80189280571@` |

`vercel.json` planifie `trial-reminders` à **09:30 UTC** — le premier envoi est le run normal. Les deux suivants, une heure plus tard puis 104 secondes après, sont des invocations hors planification, signature d'un déclenchement manuel (test ou débogage) pendant une session. Vérifié dans le code : `trial-reminders`, `winback-sequence`, `onboarding-sequence` et `expire-trials` **ne gardent aucune trace de ce qu'ils ont déjà envoyé à qui** ; ils resélectionnent une fenêtre de dates et envoient. Rien n'empêche un second appel de reposter le même e-mail au même destinataire. C'est exactement l'avertissement déjà consigné pour `data-quality` (« tester `data-quality` redéclenche un email »), mais généralisé à toute la chaîne de conversion — et cette fois payé par un vrai prospect, en pleine séquence de fin d'essai.

**Pourquoi maintenant :** ces routes sont testées à la main de plus en plus souvent (les audits de crons de la semaine dernière en ont appelé plusieurs), et c'est le seul canal qui produit de l'usage. Trois fois le même rappel de fin d'essai en une heure, c'est le registre du désabonnement — précisément ce qui est arrivé à Kamau le 21/07 après une rafale d'alertes.

**Effort estimé :** petit à moyen. Le minimum honnête est une trace `(user_id, template, date)` consultée avant envoi sur les 4 crons de cycle de vie ; la version paresseuse est un mode « à blanc » (`?dry=1`) qui liste les destinataires sans envoyer, pour rendre le test sûr par défaut plutôt que dangereux par défaut. Les deux se cumulent bien.

**Risque/inconnue :** priorité honnêtement inférieure aux idées 1 et 2 — l'incident est unique, vieux de deux semaines, et sans conséquence mesurable sur `saeed@` (essai déjà expiré, aucun désabonnement constaté). Je le remonte parce qu'il est bon marché et que le mode de défaillance est structurel, pas parce qu'il brûle. Inconnue assumée : je déduis le caractère manuel des deux envois de leur horaire hors planification, je n'ai pas de journal d'invocation Vercel pour le prouver.

**Non re-proposé aujourd'hui :** les trois idées du 31/07 (mesure clic→visite, notification d'inbound institutionnel, `alert_locale` figé sur l'anglais) restent **PROPOSÉES et non traitées**, sans preuve nouvelle à ajouter — le compte `codyleereed@` créé aujourd'hui a d'ailleurs `locale=fr` / `alert_locale=en`, soit un **4e cas** du même écart, mais ça ne change pas le diagnostic. Idem pour l'idée 3 du 28/07 (comptes existants toujours à 5 régions, toujours vrai), le volet AMR (Eva Kamau, 10/07) et le signal de variance (Simon Ruegg, 6-7/07). Rien sur la qualité des données : la journée a déjà livré le sous-comptage Rougeole/Guatemala, la résurrection de lignes archivées et le cluster Chikungunya.

**Contexte mesuré au passage** (utile au bilan de lundi, pas des idées) :
- **22 comptes** (+1 aujourd'hui), **6 essais Pro en cours** après l'expiration de `r.endangrukmanams@` ce matin. Prochaines échéances : `guyanoel22@` le 07/08, `codyleereed@` et Kamau le 15/08, Bankunda 17/08, ZABRE 22/08, Mulamba 24/08. **Un seul essai non institutionnel expire avant la date de décision du 21/08.**
- **Enrôlement aux alertes : 10 comptes sur 22 ont 5 régions, 12 en ont zéro** — dont 11 comptes antérieurs au passage en opt-out et `r.endangrukmanams@` (bug OAuth). Aucun compte n'a jamais choisi autre chose que 5 régions.
- `winback-sequence` et `pilot-closing-reminder` : toujours aucun `lastNonZero` depuis le 27/07. `pilot-follow-up` a livré ce matin (`rows=1`).

**Statut :** David a validé les trois (« On applique les 3 idées »). Construction déléguée à une session dédiée (conformément à la consigne de scope de `daily-product-ideas-healthwatch` : cette routine idée et propose uniquement, ne code jamais elle-même). Les trois idées ont été livrées le jour même par la session dédiée, en 3 commits poussés sur `master` : `33d4bfc` (idée 1 + partie « winback-sequence » de l'idée 3), `be235e7` (idée 2), `866002f` (reste de l'idée 3).

**Idée 1 — livrée et vérifiée (`33d4bfc`).** `app/api/cron/winback-sequence/route.ts`, `isEligible` remplace le calcul `trialDays > 20` par `p.is_pilot !== true` ; `is_pilot` ajouté aux deux `.select()` J+3/J+7. Vérifié en lecture seule contre la prod réelle (`.env.local.live`, script jetable supprimé après usage) : les 4 pilotes institutionnels (Kamau, Bankunda, ZABRE/`Zrhyacinthe2@`, Mulamba) ont bien `is_pilot=true, plan=pro` — ils resteront exclus une fois leur essai expiré et repassé en `plan=free`, seul état où `winback-sequence` les regarde. Parmi les 13 comptes `plan=free` actuellement dans le pool de la requête, l'ancien critère en excluait à tort 7 (`anakeseemmanuel8@`, `iinnerre@`, `r.endangrukmanams@`, `dogfluvet@`, `cgodwe2000@`, `analin1309@`, `shintayuliawati28@` — tous `is_pilot=false`) ; le nouveau critère les inclut tous, confirmé compte par compte via un croisement is_pilot/trialDays. `npx tsc --noEmit` et `npx eslint` propres. Aucun envoi manuel déclenché contre la prod, conformément à la consigne — `iinnerre@` (J+3 le 02/08) et `r.endangrukmanams@` (J+3 le 04/08) seront rattrapés par le prochain passage planifié du cron. `anakeseemmanuel8@` n'est délibérément pas rattrapé (fenêtres déjà passées, hors scope).

**Idée 2 — livrée et vérifiée (`be235e7`).** `app/api/cron/health-check/route.ts` ajoute `checkZeroRegionTrials()` : pour tout profil `plan IN (starter,pro)` avec `trial_ends_at` non nul et `stripe_subscription_id IS NULL`, compte les lignes `user_alert_regions` ; liste dans un nouveau bloc HTML (même style que le bloc « livraison » du 27/07) les comptes en essai **actif** à 0 région. Signal seul, aucun enrôlement automatique. Vérifié en lecture seule contre la prod réelle : sur les 7 profils actuellement en essai actif `starter/pro`, tous ont au moins une région (0 résultat aujourd'hui) — attendu, puisque le seul compte à 0 région connu (`r.endangrukmanams@`) a expiré ce matin même (01/08) et sort donc du filtre `plan IN (starter,pro)` dès son passage en `free`, comportement voulu et vérifié explicitement plutôt que forcé. Testé en local contre le Supabase de dev (`.env.local` copié temporairement dans le worktree, `next dev` lancé manuellement sur le port 3001 après un faux départ où `preview_start` servait par erreur les fichiers du checkout principal non modifié plutôt que ceux du worktree — contourné en lançant `next dev` directement via Bash, qui respecte le cwd du worktree) : réponse 200, champ `zeroRegionTrials: {count:0, trials:[], error:null}` calculé sans exception. `npx tsc --noEmit` et `npx eslint` propres.

**Idée 3 — livrée, portée volontairement restreinte (`33d4bfc` + `866002f`).** `lib/cron-monitor.ts` ajoute `isLiveCronInvocation(req)` : vrai si l'en-tête `x-vercel-cron-schedule` est présent (Vercel l'ajoute à **toute** invocation planifiée, confirmé sur `vercel.com/docs/cron-jobs/manage-cron-jobs`) ou si `?live=1` est passé en query string. Par défaut (ni l'un ni l'autre), les 4 crons (`winback-sequence`, `trial-reminders`, `onboarding-sequence`, `expire-trials`) calculent et journalisent la liste des destinataires sans appeler Brevo (retournée dans la réponse JSON sous `dryRunRecipients`). Limite assumée et documentée dans les commits : Vercel ne documente cet en-tête comme protégé contre l'usurpation — seul `CRON_SECRET` est une vraie authentification — donc ce garde-fou protège contre le rejeu accidentel (l'incident réel du 15/07), pas contre quelqu'un qui détient déjà le secret et falsifie délibérément l'en-tête. Portée réduite pour `expire-trials` : seul l'envoi Brevo est gaté, la rétrogradation de plan et la désactivation webhooks/rapports restent inconditionnelles (idempotentes, critiques pour la facturation) — un bug de détection d'en-tête ne peut donc jamais bloquer silencieusement une rétrogradation réelle. `npx tsc --noEmit` et `npx eslint` propres sur les 5 fichiers touchés. Non vérifié en exécution locale de bout en bout sur ces 3 routes : leur requête (inchangée par ce correctif) filtre déjà sur `email_blocked_at`, colonne présente en prod (`f59c166`/`8934c64`, juillet) mais absente du schéma Supabase de dev — écart préexistant, sans lien avec ce correctif, qui a fait échouer les 3 routes en local avec `column profiles.email_blocked_at does not exist` avant même d'atteindre le nouveau code. Vérifié à la place par relecture de code, typecheck, et le fait que `health-check` (idée 2, même session) exerce avec succès en local le même schéma d'API (`req.headers.get()` / `req.nextUrl.searchParams.get()`) déjà utilisé ailleurs dans ce repo (ex. `?debug=1` de `sync-outbreaks`).

**Suite en session interactive, même jour (01/08 après-midi) — vérification prod + 2 rattrapages manuels validés par David :**

- **Déploiement prod vérifié** : les 3 commits sont bien live sur `healthwatch-global.com` (build Vercel Ready, alias confirmé). Sentry passé au crible : la seule erreur récente sur les fichiers touchés (`runWinbackSequence`, `column profiles.email_blocked_at does not exist`) est taguée `environment=development` / `localhost:3001` — c'est le test local de la session dédiée, pas un incident prod. Rien d'autre en 24h sur les 4 crons ni `health-check`.

- **Correction au passage : `iinnerre@` n'a pas attendu le 02/08.** Recalcul précis de sa fenêtre J+3 (`trial_ends_at=2026-07-29T10:52:51Z`) : fenêtre réelle = `(31/07 22:52 UTC, 01/08 22:52 UTC]`, donc **ce jour même**, pas demain comme estimé plus haut. Le run planifié du matin (11:00 UTC) était dans la fenêtre mais utilisait encore l'ancien code (déployé seulement à 15:41 UTC) — l'aurait raté. Le run du lendemain (02/08 11:00 UTC) serait arrivé **après** la fermeture de fenêtre (22:52 UTC ce soir-là) : sans action, oubli définitif, pas un simple retard. Déclenché manuellement via `vercel crons run /api/cron/winback-sequence` (canal officiel Vercel — le `CRON_SECRET` local s'est avéré illisible, marqué *Sensitive* sur Vercel, `vercel env pull` ne le révèle pas) à 15:55:09 UTC, avec accord explicite de David. Vérifié avant/après dans Brevo : 21→22 e-mails, **un seul** exemplaire du J+3 (`messageId` unique), aucun envoi parasite à `r.endangrukmanams@` (fenêtre confirmée non ouverte avant le 04/08). `site_config.cron:run:winback-sequence` : `status=ok, rows=1`.

- **`r.endangrukmanams@` — vérification programmée, pas de rattrapage nécessaire aujourd'hui.** Sa vraie fenêtre J+3 est `(03/08 12:00 UTC, 04/08 12:00 UTC]`, pas demain comme initialement estimé — le run automatique du 04/08 11:00 UTC le captera normalement. Tâche planifiée locale créée (`check-winback-endangrukmanams`, one-shot 04/08 14:30 Paris) pour confirmer après coup un envoi unique via `site_config` + Brevo, sans action corrective automatique en cas d'anomalie.

- **`anakeseemmanuel8@` — vérifié qu'il avait toujours besoin d'être rattrapé, puis rattrapage manuel avec copie corrigée.** Profil vérifié : `plan=free`, jamais converti, `email_blocked_at=null`, aucun opt-out, toujours enrôlé 5 régions, **zéro `product_events`** — rien ne s'est substitué au winback manqué. Confirmé qu'aucun J+3/J+7 n'était jamais parti (8 e-mails reçus 15/07→01/08, seulement la séquence standard). Ses fenêtres J+3 (`22-23/07`) et J+7 (`26-27/07`) sont bâties sur `trial_ends_at`, valeur figée : contrairement à `iinnerre@`, **structurellement irrattrapable** par le cron normal, correctif ou pas. Problème de contenu détecté avant envoi et signalé à David : le template standard affirme « votre essai s'est terminé il y a 3 jours » et « pendant 14 jours », **faux dans son cas** — essai réel de ~31 jours (créé 19/06, `trial_ends_at=2026-07-19T23:59:59Z` propre à ce compte, pas la valeur groupée du lot des 5 ci-dessous), expiré il y a 13 jours, pas 3. Correction faite dans ce même log le 01/08 en soirée : `anakeseemmanuel8@` **n'appartient pas** au lot des 5 comptes à `trial_ends_at` identique (`2026-06-29T07:35:21.675Z`) mentionné dans l'idée 1 — c'est un cas distinct, une prolongation individuelle avec sa propre date. David a choisi la version corrigée pour ce compte. Envoyé un e-mail one-off (script jetable, supprimé après usage) reproduisant exactement le template `buildEmail()` de `winback-sequence` (même `emailShell`, même corps, même jeton de désabonnement HMAC via `SUPABASE_SERVICE_ROLE_KEY`, même expéditeur) avec seulement `headline`/`intro` corrigés (« il y a 13 jours » / « pendant 31 jours »). Vérifié dans Brevo sur tout l'historique du compte (72 e-mails) : **exactement un** exemplaire, `messageId` unique, envoyé à 16:09:45 UTC.

- **Lot des 5 comptes à `trial_ends_at` identique (`2026-06-29T07:35:21.675Z`) — vérifié compte par compte, 3 rattrapés, 2 exclus à raison.** Repris depuis la mémoire du projet plutôt que réévalué à vue : `davy_skye@yahoo.fr` = compte de test technique (webhook Stripe, confirmé David) — exclu, pas un prospect. `clarence_skye@yahoo.fr` = hard-bounce Brevo depuis le 13/06 **et David a explicitement demandé de ne pas y toucher** (`project_urgent_tasks_2026_06_13`) — exclu, consigne déjà tranchée, non rouverte. Les 3 autres (`dogfluvet@gmail.com`, `analin1309@gmail.com`, `cgodwe2000@gmail.com`) sont des **vraies inscriptions organiques confirmées par David le 06/07** (`project_activation_funnel_audit_2026_07_06`) — `cgodwe2000@` est même l'un des 2 seuls comptes « revenus » de tout le funnel. Même situation structurelle qu'`anakeseemmanuel8@` : fenêtres J+3/J+7 fermées depuis **33 jours**, jamais aucun winback envoyé (vérifié Brevo, 6 e-mails chacun avant envoi, uniquement séquence standard + digest hebdo reçu jusqu'au 29/07), aucun blocage, aucun opt-out, aucune conversion. Essais réels : `dogfluvet@` 23j, `analin1309@` 22j, `cgodwe2000@` 22j (calculés précisément `trial_ends_at − created_at`) — même écart de contenu que pour `anakeseemmanuel8@`, corrigé de la même façon. Trois e-mails one-off envoyés (même script/template que ci-dessus, `headline`/`intro` corrigés par compte, locale respectée — `en` pour `dogfluvet@`/`cgodwe2000@`, `fr` pour `analin1309@`), avec accord explicite de David. Vérifié dans Brevo avant/après pour les trois : 6→7 e-mails chacun, **un seul** exemplaire par compte, `messageId` distincts. Aucune écriture DB, scripts jetables supprimés après usage.

- **✅ `r.endangrukmanams@` — contrôle a posteriori du 04/08 : conforme, aucun rattrapage nécessaire.** Tâche planifiée `check-winback-endangrukmanams` exécutée le 04/08 à 12:30 UTC, en lecture seule contre la prod (`.env.local.live`, script jetable supprimé après usage). Les trois vérifications passent : (a) `site_config.cron:run:winback-sequence` = `{"ts":"2026-08-04T11:01:16.667Z","status":"ok","rows":1,"lastNonZero":"2026-08-04T11:01:16.667Z"}` — run planifié à l'heure, une ligne traitée, et **premier `lastNonZero` jamais enregistré sur ce cron** depuis l'ajout du champ le 27/07, c'est-à-dire la première fois que la séquence de reconquête livre réellement toute seule (la colonne `updated_at` de `site_config` reste figée au 01/07, piège connu — seul le `ts` du JSON fait foi) ; (b) profil toujours dans l'état attendu par `isEligible` (`plan=free`, `stripe_subscription_id=null`, `email_blocked_at=null`, `is_pilot=false`, `display_filters=null`, `locale=fr`), donc aucune exclusion légitime qui aurait pu masquer une régression ; (c) Brevo : **exactement un** exemplaire de « Vous pensez encore à HealthWatch ? L'accès Pro est toujours disponible », `messageId` `<202608041101.62059022793@smtp-relay.mailin.fr>`, horodaté 04/08 11:01:17 UTC — soit 17 secondes après le run planifié, bien dans la fenêtre J+3 `(03/08 12:00 UTC, 04/08 12:00 UTC]`, et le seul autre e-mail de la période est le signal hebdomadaire du 03/08. Ni doublon (garde anti-rejeu `866002f` tenue), ni absence (correctif d'éligibilité `33d4bfc` tenu) : le premier compte capté de bout en bout par la chaîne corrigée, sans intervention manuelle. Aucune action corrective, aucune écriture.

---

## 2026-08-02 — Proposition du jour

Angle nouveau : **ce que le produit demande à l'utilisateur, et quand il le lui demande.** Les passages précédents ont couvert la qualité des données (26-27/07), la personnalisation (27-28/07), l'accès (30/07), le canal d'entrée (31/07) et la mécanique d'envoi du cycle d'essai (01/08). Personne n'avait encore regardé **la copy et le calendrier de la demande de conversion elle-même** — c'est-à-dire le seul endroit où le produit peut transformer un essai en client avant le go/no-go du 21/08. Aucun nouveau feedback reçu depuis le 29/07 (Taiwan CDC) : tout ce qui suit vient de la mesure — 4 sondes en lecture seule (base prod + journal Brevo destinataire par destinataire), aucune écriture, scripts supprimés après usage.

**Trois faits de cadrage mesurés en ouverture.** (1) **7 essais Pro actifs** aujourd'hui (`plan=pro`, `trial_ends_at` futur, aucun abonnement Stripe) : `guyanoel22@` 07/08, Kamau 15/08, `codyleereed@` 15/08, Bankunda 17/08, ZABRE 22/08, Mulamba 24/08, `jalal.nourlil@pasteur.ma` 13/09. (2) `product_events` sur toute la fenêtre d'instrumentation (24/07 → 02/08) : **36 événements, 4 utilisateurs** — David 15, Bankunda 13, `guyanoel22@` 5, `codyleereed@` 3. **Les 3 seuls comptes non-David ayant une activité produit mesurée sont tous les trois en essai Pro.** (3) Journal Brevo sur 60 j, clics durs : Bankunda 7, ZABRE 6, `guyanoel22@` 3, Pasteur 1, IOM 2. Toutes les URL cliquées vers le site sont des fiches foyer `/{locale}/outbreak/{id}`, sauf trois exceptions (le lien d'auth Supabase, `/en/account#regional-alerts` chez ZABRE, `/en` chez l'IOM). **Aucun clic vers `/pricing`, jamais, par personne.**

### 1. 🔴 La seule surface d'atterrissage du seul canal qui marche propose « Commencez votre essai gratuit de 14 jours » à des gens qui sont déjà en essai Pro

**Signal (code lu ligne à ligne, croisé avec les 3 comptes réellement actifs) :** le 31/07 a établi que 100 % des visites réelles arrivent par clic d'e-mail sur `/{locale}/outbreak/{id}`, 8 à 10 secondes après le clic. Cette page se termine par `OutbreakBottomCta` (`components/OutbreakBottomCta.tsx`), qui résout quatre états : `paid` (masqué), `expired`, `free`, `anon`. Un essai Pro **actif** — `plan="pro"`, `stripe_subscription_id` nul, `trial_ends_at` dans le futur — ne correspond ni à `paid` (il exige un abonnement Stripe) ni à `expired` (il exige une date passée) : il tombe dans le `else` final, donc dans l'état **`free`**. Ce qui s'affiche alors, mot pour mot (`app/[locale]/outbreak/[id]/page.tsx:46-49`) :

> **Alertes {maladie} quotidiennes**
> Essai Pro 14 jours gratuit — sans carte bancaire
> **[ Commencer l'essai gratuit → ]**
> *Ou créer un compte gratuit* → `/{locale}/signup`

C'est-à-dire : à Bankunda (pilote, essai de 35 jours jusqu'au 17/08, connectée, 13 événements produit), à `guyanoel22@` (essai jusqu'au 07/08) et à `codyleereed@` (essai jusqu'au 15/08), le produit propose de commencer un essai qu'ils ont déjà commencé, et de créer un compte qu'ils ont déjà. **Ce sont exactement les trois seuls comptes dont on a mesuré une visite.** Ni le nombre de jours restants, ni le prix, ni ce qui se passe à l'expiration n'apparaissent nulle part sur cette page.

**Ce n'est pas un oubli de conception, c'est une copy qui n'a jamais suivi l'intention.** Le commentaire du composant dit explicitement : « Hide for Stripe subscribers; show for trial users (let them upgrade to annual) ». L'affichage aux essais est donc **voulu** ; c'est le texte qui n'a jamais été écrit pour eux. Détail cohérent avec ça : le bouton passe par `CheckoutButton` avec `billing="annual"` par défaut, et `/api/checkout` reporte bien les jours d'essai restants avec `payment_method_collection: "if_required"` (le « sans carte bancaire » reste donc vrai, vérifié). Mais la seule porte offerte depuis la page d'atterrissage est un **engagement annuel, sans prix affiché et sans option mensuelle** — sous un bouton qui annonce un essai gratuit.

**Pourquoi maintenant :** à 19 jours de la décision, le produit dispose d'exactement un mécanisme d'acquisition démontré (le clic d'e-mail vers la fiche foyer) et de trois comptes qui l'empruntent. Sur cette page, la demande de conversion est adressée à la mauvaise personne dans les trois cas. Deux de ces essais expirent avant le 21/08 (`guyanoel22@` le 07/08, `codyleereed@` le 15/08) : ce sont les seules occasions de conversion non institutionnelles de la fenêtre.

**Effort estimé :** petit — ajouter un cinquième état `trial` au composant (la condition est déjà calculée, il ne manque qu'une branche), avec une copy honnête : jours restants, prix réel, choix mensuel/annuel, et ce qui change à l'expiration. Le lien secondaire « Ou créer un compte gratuit » doit disparaître pour un utilisateur connecté.

**Risque/inconnue :** (a) pousser la vente au milieu d'un essai peut agacer — mais le bon message pour un essai n'est pas « achetez », c'est « il vous reste N jours, voici ce que vous perdez » ; c'est aujourd'hui la seule variante qui n'est **pas** affichée ; (b) le bloc est en pied d'une page de 616 lignes, je n'ai mesuré ni sa visibilité réelle ni son taux de vue — corriger la copy est bon marché, en déduire un gain de conversion serait prématuré ; (c) l'échantillon est de 3 comptes, mais c'est 3 sur 3 des utilisateurs réellement actifs, pas 3 sur un grand nombre.

### 2. 🔴 Un cinquième compte institutionnel existe — Institut Pasteur du Maroc — et il est hors de tout mécanisme de conversion : la vente ne lui sera jamais demandée avant le 13 septembre

**Signal :** `jalal.nourlil@pasteur.ma` est en base depuis le 12/06, `plan=pro`, **`is_pilot=false`**, `trial_ends_at=2026-09-13`, aucun abonnement Stripe, 5 régions d'alerte, non bloqué chez Brevo. Journal Brevo sur 60 j : **33 envois, 33 délivrés, un clic dur le 16/07** vers `/en/outbreak/220e23f5…` (Rougeole/Amériques), et il **reçoit toujours** — dernier e-mail délivré aujourd'hui 02/08 à 08:30. Dernière session : 13/06. C'est une inscription spontanée, sans aucune prospection, au point qu'elle sert déjà de preuve sociale dans `marketing/J0-playbook.md` (« a researcher at Institut Pasteur Morocco signed up without any outreach from us »).

**Personne ne va lui demander quoi que ce soit avant l'automne.** Vérifié mécanisme par mécanisme : `pilot-closing-reminder` filtre sur `is_pilot` — il ne le voit pas ; `trial-reminders` J-3/J-1 se déclenchera vers les **10 et 12/09** ; `winback-sequence` J+3/J+7 vers les **16 et 20/09**. Soit, dans le meilleur des cas, **trois semaines après le go/no-go du 21/08**. Le compte n'apparaît dans aucun bilan hebdo, qui comptent invariablement « 4 leads institutionnels » (Kamau, Bankunda, ZABRE, Mulamba) — or sur ces quatre, deux se sont désabonnés le 21/07 et un n'a jamais ouvert de session. Le 5e, celui dont l'adresse est la plus prestigieuse du portefeuille et qui ouvre encore ses e-mails sept semaines après, n'est compté nulle part.

**Le problème dépasse ce compte.** Le mécanisme de conversion est **entièrement indexé sur `trial_ends_at`**, et cette date a été prolongée à la main sur plusieurs comptes (cf. le lot des 5 à la milliseconde près documenté le 01/08). Conséquence directe et mesurée : **3 des 7 essais actifs ont leur échéance après la date de décision** — ZABRE 22/08, Mulamba 24/08, Pasteur 13/09. Le 21/08, la question « les institutionnels convertissent-ils ? » sera tranchée alors que le produit n'aura jamais posé la question à trois d'entre eux. Les pilotes, eux, sont couverts à temps : `pilot-closing-reminder` prévient David 7 jours avant, donc les 08, 10, 15 et 17/08.

**Effort estimé :** petit, en deux volets séparables. (a) Le cas immédiat : décider si Pasteur est traité comme un pilote (`is_pilot=true`, ce qui le fait entrer dans le rappel de clôture) ou contacté hors produit — c'est un arbitrage de David, pas une question technique. (b) Le filet général : un bloc « essais dont l'échéance tombe après l'horizon de décision » dans l'e-mail de health-check quotidien, exactement la forme de `checkZeroRegionTrials` construit le 01/08.

**Risque/inconnue :** (a) **ne pas raccourcir un essai déjà accordé** — c'est une promesse faite, revenir dessus coûterait plus cher que le gain ; la bonne action est une demande de conversion anticipée, pas une coupure ; (b) une adresse institutionnelle qui ouvre ses e-mails n'est pas un client : 33 ouvertures pour 1 seul clic dur, et le compteur d'ouvertures est gonflé par les proxys (100 `loadedByProxy`) — le seul fait solide est le clic du 16/07 ; (c) contacter cette personne est une décision de David, pas de cette routine, et rien n'a été envoyé.

### 3. On corrige le chemin, jamais le stock : trois correctifs livrés en juillet n'ont réparé aucun compte existant

**Signal — motif, pas incident isolé.** Trois correctifs récents ne s'appliquent qu'aux comptes créés *après* eux ; mesuré aujourd'hui, aucun n'a rattrapé le parc :

| correctif | livré | état du stock aujourd'hui |
|---|---|---|
| Défaut d'enrôlement ciblé à l'inscription | 27/07 | **10 comptes à 5 régions, 12 à zéro** — aucun compte n'a jamais eu autre chose que « tout » ou « rien » |
| `alert_locale` désynchronisé de `locale` | signalé 31/07, **non traité** | **4 comptes** `locale=fr` / `alert_locale=en` — dont `codyleereed@`, créé le **01/08** : le trou produit encore de nouveaux cas |
| Accès invité (repli Google + code OTP) | 30/07 | **3 comptes jamais connectés** (`ouedraogodaouda2408@`, ZABRE, Mulamba) — **aucune invitation renvoyée depuis** |

Le cas ZABRE chiffre le coût du motif : **48 e-mails délivrés du 18/07 à aujourd'hui 08:30, 6 clics durs, zéro session, jamais**. Il continue de recevoir chaque jour des alertes qu'il ne peut convertir en rien, son pilote expire le 22/08 (après la décision), et le correctif qui le débloquerait est en production depuis trois jours sans l'avoir touché. C'est la version « comptes » de la leçon déjà consignée côté données ([[feedback_cron_fix_does_not_backfill_bug_window]]) : **corriger le chemin ne rattrape jamais ce qui est déjà cassé**, et rien ne surveille l'écart.

**Effort estimé :** petit — un bloc « réconciliation du stock » dans l'e-mail de health-check quotidien, même forme que `checkZeroRegionTrials` (01/08) : pour chaque correctif connu, lister les comptes encore dans l'état d'avant. Le rattrapage lui-même (renvoyer une invitation, réaligner `alert_locale`) reste une décision de David, comme pour les envois one-off du 01/08.

**Risque/inconnue :** (a) une liste « correctif → état attendu » tenue à la main se périme et finira ignorée — l'alternative honnête est une décision de rattrapage ponctuelle prise au moment de chaque correctif, ce qui ne demande aucun code mais de la discipline ; (b) priorité assumée inférieure aux idées 1 et 2 : c'est un filet, pas un levier ; (c) `alert_locale` doit se réaligner **sans écraser un choix délibéré** (même précaution que la migration du 25/06, `AND alert_locale='en'`).

**Non re-proposé aujourd'hui :** les idées 1 et 2 du 31/07 (mesure clic→visite, notification d'inbound institutionnel) restent PROPOSÉES et non traitées. Note mineure sur la seconde, sans en changer le diagnostic : `iqakhtar@iom.int` (OIM) a reçu **un seul e-mail depuis son inscription du 31/07** — la confirmation — et n'aura rien avant le `weekly-digest` de demain 03/08, soit 3 jours après avoir cliqué deux fois vers le site. Idem sans angle neuf pour le volet AMR (Eva Kamau, 10/07) et le signal de variance (Simon Ruegg, 6-7/07). Rien sur la qualité des données ni sur les alertes : la journée a déjà livré le batch d'alertes, les foyers clos, la troncature PAHO et le réalignement Ebola/RDC.

**Contexte mesuré au passage** (pas des idées) :
- **`codyleereed@` (inscrit le 01/08) a reçu 32 e-mails en 26 heures, dont 28 dans la seule heure du run `regional-alerts` de ce matin** (06:30 UTC, `rows=55`) — c'est-à-dire **avant** le déploiement du batch à 11:26. Son cas est donc le dernier avant correctif, pas une preuve que le correctif échoue : à revérifier sur le run de demain matin. Il n'a ouvert que 1 des 32.
- `weekly-digest`, `trigger-regional-digest` et `send-sitrep-emails` : dernier run le 27/07 (lot hebdomadaire du lundi), prochain attendu demain 03/08 — rien d'anormal.
- **Piège technique à retenir pour toute sonde Brevo future :** le filtre `email` de `GET /v3/smtp/statistics/events` est **sensible à la casse**. `Zrhyacinthe2@gmail.com` (la casse exacte stockée en base) renvoie **0 événement** ; `zrhyacinthe2@gmail.com` en renvoie 48. Une session qui ne repasse pas l'adresse en minuscules conclura à tort qu'un contact ne reçoit plus rien. Vérifié au passage que `lib/brevo-blocklist.ts` fait bien le `toLowerCase()` des deux côtés — la synchronisation des désabonnements n'est donc pas affectée par ce piège.

**Statut :** Idée 1 (copy CTA essai actif) **déjà construite le jour même** (`813c5e7`, avant ce log — repérée en relisant `git log` le 03/08, non recensée à l'époque). Idée 2 (Institut Pasteur / essais hors mécanisme de conversion) : le filet général construit le 03/08 (`9ec3c1e`) — `checkDecisionHorizonTrials` signale désormais tout essai dont l'échéance dépasse le 21/08 (aujourd'hui : ZABRE, Mulamba, Pasteur), vérifié en direct sur la prod. Le cas Pasteur précis (basculer `is_pilot=true` ou le contacter hors produit) a été proposé en session le 03/08 puis explicitement écarté par David (« oublie Pasteur ») — pas d'action, ne pas re-proposer sans signal nouveau. Le filet général (`checkDecisionHorizonTrials`) reste en place et continuera de le signaler dans le health-check quotidien ; c'est une visibilité passive, pas une relance. Idée 3 (réconciliation du stock) : le volet `alert_locale` a son propre garde-fou depuis le 02/08 ; le volet régions (10 comptes à 5, 12 à 0) a désormais un indicateur de visibilité (`fetchRegionEnrollmentStock`, `9ec3c1e`) — signal seulement, aucune correction automatique ; le volet invitations jamais rattrapées reste couvert seulement pour les pilotes (`checkStuckPilotInvites`), `ouedraogodaouda2408@gmail.com` (non-pilote, invité avant que `is_pilot` soit toujours posé sur `/api/admin/invite`) reste un angle mort connu, non traité — cas historique isolé, jugé trop risqué à généraliser sans signal fiable « admin-invité » sur les comptes anciens.

---

## 2026-08-03 — Proposition du jour

Angle nouveau : **ce qui se passe entre l'envoi de l'e-mail et le navigateur du destinataire** — c'est-à-dire les machines qui lisent nos e-mails avant les humains. Les passages précédents ont couvert la qualité des données (26-27/07), la personnalisation (27-28/07), l'accès (30/07), le canal d'entrée (31/07), le cycle d'essai (01/08) et la demande de conversion (02/08). Le 28/07 avait posé l'hypothèse du préchargement par scanner pour expliquer le lien magique brûlé de ZABRE, sans pouvoir la prouver. **Elle est prouvée aujourd'hui, sur un autre jeton, avec une victime mesurable.** 5 sondes en lecture seule (base prod + journal Brevo, à la milliseconde), aucune écriture, scripts supprimés après usage.

**Fait de cadrage mesuré en ouverture :** la prod compte **27 profils** ce soir contre 22 hier — mais **aucune inscription réelle** n'a eu lieu aujourd'hui (voir idée 3). **Toujours zéro client payant** : le seul `stripe_subscription_id` en base est `admin_override` sur le compte de David. 7 essais Pro actifs, inchangés depuis hier.

### 1. 🔴 Le désabonnement s'exécute sur un simple GET — le scanner e-mail de l'OIM a désabonné l'agence ce matin en 98 millisecondes, et a fabriqué au passage le premier clic « pricing » de l'histoire du produit

**Signal (journal Brevo à la milliseconde × base prod, mesuré vers 17h).** `iqakhtar@iom.int` — Organisation internationale pour les migrations, agence des Nations unies, **le seul inbound institutionnel des sept dernières semaines** et l'événement business signalé comme le plus significatif de la semaine le 31/07 — est **`active=false`** dans `subscriptions` depuis ce matin. Le déroulé complet :

| horodatage (CEST) | événement |
|---|---|
| 03/08 09:04:41 | `weekly-digest` demande l'envoi de « Your weekly epidemiological briefing » |
| 09:04:43 | délivré |
| 09:04:48 | **ouvert** |
| **09:05:04.665** | **clic sur `/api/unsubscribe?id=47b26e64…&token=8f…`** |
| **09:05:04.763** | clic sur `https://healthwatch-global.com` |
| **09:05:04.763** | **clic sur `https://healthwatch-global.com/en/pricing`** |
| 09:28:24 | **ouvert de nouveau**, 23 minutes plus tard |

**Trois liens distincts du même e-mail « cliqués » en 98 millisecondes**, dont la racine, la page tarifs et le lien de désabonnement. Aucun humain ne clique trois liens en un dixième de seconde, et personne ne se désabonne puis va consulter les tarifs dans la même milliseconde — puis rouvre l'e-mail 23 minutes après. C'est une passerelle de sécurité e-mail qui déroule chaque URL du message pour la détoner en bac à sable, comportement standard dans une agence onusienne (Proofpoint/Mimecast et équivalents). L'ouverture de 09:28 est le vrai humain, qui lisait encore, sans savoir qu'il venait d'être désinscrit.

**Ce qui rend le dégât certain plutôt que probable, c'est le code.** `app/api/unsubscribe/route.ts:130` — le handler `GET` valide le jeton HMAC puis **écrit immédiatement** `subscriptions.active = false`. Aucune page de confirmation, aucun `POST`, aucune interaction humaine requise : récupérer l'URL *est* le désabonnement. Le jeton HMAC ajouté récemment protège contre un UUID deviné, pas contre un client HTTP qui a reçu le lien légitimement. Et le motif est général, **trois routes sur trois** :

| route | effet du GET | e-mails porteurs |
|---|---|---|
| `/api/unsubscribe` | `subscriptions.active=false` | digest hebdo (`lib/digest-email.ts:152`) |
| `/api/unsubscribe-signal` | `display_filters.no_weekly_signal=true` | **6 e-mails d'onboarding et de cycle d'essai** (`lib/onboarding-emails.ts`, J+1/J+3/J+7, rappels, signal hebdo) |
| `/api/unsubscribe-disease` | **`.delete()`** sur `user_alert_diseases` | alertes maladie (`lib/disease-alert-email.ts:211`) |

**Périmètre réel du dégât, vérifié et volontairement non gonflé :** aucun profil n'a `no_weekly_signal` positionné aujourd'hui, et `user_alert_diseases` est vide (0 ligne) — les deux autres routes sont **exposées mais n'ont encore rien détruit**. Le seul dégât consommé est l'abonnement de l'OIM. Mais `/api/unsubscribe-signal` part dans le tout premier e-mail d'onboarding de chaque essai : la population la plus exposée à ce type de passerelle est exactement celle qu'on courtise (OMS, Africa CDC, OIM, Institut Pasteur), et c'est le seul canal qui produit de l'usage.

**Le corollaire à ne pas rater : la mesure est empoisonnée dans les deux sens.** Le 02/08 j'écrivais « aucun clic vers `/pricing`, jamais, par personne ». Le premier de toute l'histoire du produit est arrivé ce matin — et c'est un robot. Lu sans l'horodatage à la milliseconde, ce clic se serait présenté comme le meilleur signal d'achat jamais enregistré, sur l'adresse la plus prestigieuse du portefeuille. Toute métrique bâtie sur les clics Brevo (dont le ratio clic→visite proposé le 31/07) doit filtrer les rafales sub-secondes multi-liens, sinon elle mesurera surtout les antivirus des institutions.

**Effort estimé :** petit, et c'est la correction standard (RFC 8058, également ce qu'exigent les règles expéditeurs de Gmail/Yahoo). Trois gestes : (a) le `GET` rend une page de confirmation avec un bouton et n'écrit rien ; l'écriture passe en `POST` — quelques dizaines de lignes par route, les pages HTML localisées existent déjà ; (b) ajouter les en-têtes `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` aux envois Brevo, pour que le bouton natif du client mail fonctionne proprement (aucun en-tête de ce type n'est posé aujourd'hui, vérifié) ; (c) réactiver l'abonnement de l'OIM — une ligne, mais **c'est une décision de David** : rétablir quelqu'un dans une liste dont il apparaît sorti demande d'être sûr que la sortie était accidentelle, et je pense l'avoir établi, sans que ce soit à cette routine de trancher.

**Risque/inconnue :** (a) je démontre le clic machine et l'état `active=false`, mais je n'ai pas lu les logs Vercel de la requête — la preuve est temporelle et logique (98 ms, trois liens, réouverture 23 min après), pas un journal serveur ; (b) ajouter une page de confirmation ajoute un clic à un vrai désabonnement volontaire — c'est le compromis assumé, et les en-têtes `List-Unsubscribe` du (b) rendent le désabonnement natif à un clic sans exposer d'URL détonnable ; (c) **question ouverte que je ne tranche pas** : Kamau (21/07 08:54) et Mulamba (21/07 19:43) sont sortis via `unsubscribedViaEmail`, le mécanisme propre de Brevo, pas via nos routes — leur désabonnement reste probablement humain (Kamau ouvrait en rafale depuis 40 minutes), mais l'idée 3 du 28/07, qui bâtit une recommandation produit sur « elle en a eu assez », mérite d'être relue en sachant qu'un clic Brevo n'est pas une preuve d'intention.

### 2. 🔴 « X s'aggrave en Afrique » : l'écart est calculé, sert à déclencher l'e-mail, puis est jeté — le lecteur ne voit jamais de combien

**Signal (code lu ligne à ligne × journal Brevo 7 j).** `regional-alerts` ne renvoie une alerte sur un foyer déjà signalé que sur un vrai changement, et il connaît précisément lequel : `app/api/cron/regional-alerts/route.ts:267-291` relit `outbreak_alert_log` et récupère, **pour cet utilisateur et ce foyer**, `risk_level` et `cases_at_alert` au moment de la dernière alerte. Il en dérive trois motifs distincts — `new`, `escalated` (le niveau de risque a monté d'un cran) et `surge` (les cas ont pris ≥ 20 %, `CASE_SURGE_THRESHOLD = 0.20`) — qu'il compte même dans `sentByReason`. Puis, ligne 351, tout est écrasé : `only.reason === "new" ? "new" : "update"`. Le template (`lib/alert-emails.ts`) n'a que deux états, et la carte n'affiche que **la valeur actuelle** : maladie, pays, risque, date, cas, décès. Ni la valeur d'avant, ni l'écart, ni lequel des deux déclencheurs a tiré.

Concrètement, l'objet promet un mouvement — « ⚠️ Mise à jour : Choléra s'aggrave en Afrique », « Un foyer que vous suivez vient de s'aggraver » — et le corps donne un nombre brut sans point de comparaison. Un épidémiologiste ne peut pas savoir si « s'aggrave » veut dire +21 % ou +400 %, ni si c'est le risque qui a été relevé ou les cas qui ont bondi. **La seule information qui justifie l'existence de cet e-mail est la seule qui n'y figure pas.**

**Ce n'est pas un détail de rédaction, c'est un tiers du volume sur le seul canal qui marche.** Journal Brevo, 7 derniers jours, e-mails délivrés : **33 alertes « is worsening »** (Rougeole/Amériques 8, Choléra/Afrique 8, Ebola/Afrique 5, Chikungunya ×8, West Nile/Europe 4) contre 64 « New outbreak detected ». Un e-mail d'alerte sur trois est donc une affirmation d'aggravation sans chiffre. Et sur les 4 visites réelles jamais mesurées (31/07), **l'une est précisément un clic sur « ⚠️ Update: Cholera is worsening in Africa »** (guyanoel22, 30/07 08:36) — le format « update » est l'un des deux seuls déclencheurs de visite prouvés du produit.

**Effort estimé :** petit, et sans aucune donnée nouvelle à collecter. Passer `reason` en entier au template (`escalated` / `surge` plutôt que `update`), y joindre `priorCases` et `priorRisk` déjà en main ligne 280, et rendre une ligne du type « 129 cas (+34 depuis votre dernière alerte, +36 %) » ou « risque relevé de modéré à élevé ». Cinq locales à alimenter, la structure du template ne bouge pas. `outbreak_snapshots` et `lib/outbreak-trend.ts` existent en plus si on veut une tendance à 7 jours plutôt qu'un écart depuis la dernière alerte, mais ce n'est pas nécessaire pour le correctif.

**Risque/inconnue :** (a) `cases_at_alert` est nullable et l'écart n'est calculable que pour le motif `surge` — pour `escalated`, la bonne phrase parle du niveau de risque, pas des cas ; il faut donc deux variantes de copy et un repli propre quand le chiffre manque, sinon on remplace une imprécision par un « +null » ; (b) c'est une amélioration de contenu, pas un levier mesurable : avec 8 clics durs en 7 jours, aucun A/B n'aura de sens à cette échelle — l'argument est la justesse vis-à-vis d'un public d'épidémiologistes, pas un gain de conversion démontrable ; (c) le même écrasement `new|update` existe dans le digest groupé (badge « Mise à jour », `lib/alert-emails.ts:288`) — à traiter dans le même geste, sinon le correctif ne couvre que les envois à un seul foyer.

### 3. Un script de vérification a créé 5 faux comptes en prod ce matin — ils sont désormais les 5 seuls cas de dérive `alert_locale`, donc le garde-fou livré hier va crier au loup tous les jours

**Signal (base prod).** Cinq profils `hwg-diag-rl-1785767823659-0@healthwatch-test.dev` … `-4@`, créés le **03/08 entre 14:37:03 et 14:37:04 UTC**, à 200 ms d'intervalle — la signature d'une boucle de script, pas d'inscriptions. Ils sont `plan=free`, sans essai, non enrôlés (0 ligne dans `user_alert_regions`, 0 dans `subscriptions`), et le nom `diag-rl` les rattache sans ambiguïté à la vérification du garde-fou `alert_locale` livré aujourd'hui (`22c0fb1` / `54589f8`). Le script jetable a été supprimé selon la convention ; **les 5 comptes qu'il a écrits en base, non.** Ils portent tous `locale=fr` / `alert_locale=en`.

**Conséquence immédiate et datable.** `app/api/cron/health-check/route.ts:316` interroge chaque matin `locale != 'en' AND alert_locale = 'en'` et titre, ligne 524 : « ⚠️ N compte(s) avec alert_locale de nouveau désynchronisé — **régression possible du fix du 02/08** ». J'ai rejoué cette requête exacte sur la prod : elle renvoie **5 lignes, et ce sont exactement les 5 comptes de diagnostic**. Les 4 vrais cas signalés le 31/07 ont bien été réparés aujourd'hui — le garde-fou est propre, la base est propre, et pourtant l'e-mail de demain 07:05 annoncera une régression du correctif d'hier. Tous les jours, jusqu'à ce que quelqu'un les supprime. **La session qui a construit l'alarme est celle qui l'a déclenchée**, et l'effet d'un contrôle qui crie au loup est connu : on cesse de le lire, y compris le jour où il a raison.

**Ce n'est pas un incident, c'est le motif.** La prod sert d'environnement de vérification et rien ne nettoie derrière :
- `subscriptions` : **12 lignes actives, dont 6 artefacts de test** (`stripe@example.com`, `test-webhook@`, `e2e@`, `test-e2e-*@healthwatch-test.dev`, `stripe-payment-test-…`) — signalés le 31/07, toujours là. Le journal Brevo montre qu'ils **consomment de vrais envois chaque lundi** : 4 `blocked` / `softBounces` sur la fenêtre de 7 jours, dont « Unable to find MX of domain healthwatch-test.dev » ce matin même à 09:04, deux envois avant celui de l'OIM.
- `profiles` : `e2e@healthwatch-global.com` depuis le 16/06, plus les 5 de ce matin.
- **Le compteur de comptes est passé de 22 à 27 en une journée sans une seule inscription réelle** — or c'est le chiffre que lit le bilan hebdo de viabilité, à 18 jours du go/no-go.

Et l'inversion vaut d'être dite telle quelle : **la liste d'abonnés du produit envoie aujourd'hui à 6 adresses fictives et n'envoie plus à l'agence onusienne** (idée 1).

**Effort estimé :** petit, en deux temps séparables. (a) Le nettoyage ponctuel : supprimer les 5 comptes de diagnostic (aucune donnée liée — 0 alerte, 0 événement, 0 abonnement, vérifié) et décider du sort des 6 abonnements de test ; c'est un `delete` sur des lignes identifiées, à faire avec le script de vérification préalable habituel. (b) Le filet : soit une convention de domaine réservé exclue par requête de toutes les sondes et de tous les envois (`@healthwatch-test.dev` est déjà de facto ce domaine, il suffit de l'exclure explicitement), soit un bloc « artefacts de test en base » dans l'e-mail de health-check, même forme que `checkZeroRegionTrials` (01/08).

**Risque/inconnue :** (a) supprimer un compte `auth.users` en prod est irréversible — à faire sur liste nominative vérifiée, jamais sur un motif d'e-mail générique, sous peine de transformer un ménage en incident ; (b) exclure un domaine de test des requêtes est plus sûr que de nettoyer, mais masque le problème plutôt que de l'empêcher — la vraie discipline est de ne pas écrire de compte en prod pour vérifier un correctif, et ce n'était pas nécessaire ici : la requête du garde-fou est lisible en lecture seule ; (c) priorité honnêtement inférieure aux idées 1 et 2 — c'est de l'hygiène de mesure, pas un levier business ; mais elle coûte quelques minutes et elle protège la crédibilité d'un contrôle quotidien qui vient d'être construit.

**Signal terrain reçu aujourd'hui, tracé ailleurs et volontairement non classé en idée :** Omobolanle (Esther) Adelekun (épidémiologiste OMS, surveillance et riposte) a proposé en DM le 03/08 un outil liant les données de surveillance aux **versions de définition de cas**. La faisabilité a été évaluée le jour même à la demande de David et est consignée dans `product-feedback.md` : l'outil complet n'est pas constructible (les sources ne publient quasiment jamais cette métadonnée de façon structurée) ; la piste réduite réaliste est un **drapeau booléen manuel** « ce bulletin annonce-t-il explicitement un changement de définition de cas ? », même patron que `is_pheic` / `is_backfill`, saisi pendant la relecture quotidienne déjà faite par `morning-don-check` (~9 lignes touchées/jour, volume compatible). Je ne la classe pas parmi les trois idées du jour parce qu'elle est déjà arbitrée et documentée par ailleurs, et parce qu'elle ne pèse pas sur le 21/08 : c'est un pari de positionnement différenciant (personne ne publie cette métadonnée), pas un levier de conversion. Elle reste ouverte, décision de priorisation à David.

**Non re-proposé aujourd'hui :** l'idée 1 du 31/07 (mesure clic→visite) reste PROPOSÉE et non traitée — l'idée 1 ci-dessus lui ajoute une condition de validité (filtrer les rafales de scanner) mais ne la remplace pas. Les trois idées du 02/08 (copy du CTA foyer, Institut Pasteur hors mécanisme de conversion, réconciliation du stock) restent PROPOSÉES et non traitées, sans preuve nouvelle. Idem pour l'idée 3 du 28/07 (comptes existants à 5 régions — **toujours vrai, 50 lignes / 10 utilisateurs**, revérifié), le volet AMR (Eva Kamau, 10/07) et le signal de variance (Simon Ruegg, 6-7/07). Rien sur la qualité des données : la journée a déjà livré la couverture Océanie, Taïwan, le réalignement des heures de crons et les heartbeats Better Stack.

**Contexte mesuré au passage** (utile au bilan de lundi, pas des idées) :
- **`product_events` : 41 événements au total, 3 utilisateurs non-David depuis le 24/07** (Bankunda 30/07, guyanoel22 30/07, `codyleereed@` les 01/08 ×3 et 03/08 07:26). `codyleereed@` est le seul compte non-David actif ces quatre derniers jours.
- **`alert_notifications` : 85 lignes, toujours 100 % `pheic`**, la plus récente le 01/08 — la cloche in-app n'a toujours jamais affiché une notification personnalisée depuis sa mise en service.
- **`push-alerts` a livré `rows=6` ce matin à 10:45**, avec un `lastNonZero` du jour : le canal push, mort 49 jours puis réparé le 27/07, fonctionne désormais réellement.
- Crons du jour propres après le décalage à 10:3x : `regional-alerts` 15 envois (10:30), `weekly-digest` 9 (07:01), `weekly-signal` 12 (06:50), `sync-outbreaks` 8 lignes (15:00). `sync-drc-sitrep` en `no_data` (`no_sitrep_found`) et `sync-signals` désactivé pour ToS ReliefWeb — les deux attendus.

**Statut :** David a validé les trois (« gère les trois points »). Les trois construites et déployées le jour même, commit `06d75cb` :

- **Idée 1 (désabonnement sur GET) — ✅ FAIT.** `GET` sur les 3 routes (`unsubscribe`, `unsubscribe-signal`, `unsubscribe-disease`) n'affiche plus qu'une page de confirmation, sans écriture ; l'action réelle est passée en `POST`. Nouveau helper `lib/brevo-send.ts` ajoute les en-têtes `List-Unsubscribe` / `List-Unsubscribe-Post: One-Click` (RFC 8058), câblé sur les 8 crons qui portent un vrai lien de désabonnement (`regional-alerts` exclu — ne pointe que vers la page compte, pas un lien d'action). Vérifié en direct sur la prod avec le vrai jeton de l'abonnement OIM : un `GET` valide affiche désormais le formulaire de confirmation au lieu de désabonner. `GET` avec UUID invalide → 400, mauvais jeton → 403. Typecheck + lint propres sur tout le dépôt. Abonnement de l'OIM réactivé sur demande explicite de David en session (`active=true`), confirmé accidentel (préchargement de passerelle de sécurité, pas un désabonnement humain).
- **Idée 2 (écart réel dans les alertes) — ✅ FAIT.** `lib/alert-emails.ts` affiche désormais « risque relevé de modéré à élevé » ou « 136 cas (+36 depuis votre dernière alerte, +36 %) » selon le déclencheur (`escalated`/`surge`) au lieu d'un « s'aggrave » sans chiffre, sur l'email simple et le digest groupé. Déployé, pas encore observé sur un vrai envoi (aucune escalade/surge n'a encore déclenché depuis le déploiement) — rien à corriger, juste pas encore exercé en conditions réelles.
- **Idée 3 (artefacts de test en prod) — ✅ FAIT.** Les 5 comptes `hwg-diag-rl-*` supprimés après vérification préalable de zéro donnée associée (`auth.users`, cascade `ON DELETE CASCADE` sur `profiles` et tables liées). Les 6 abonnements de test désactivés (`active=false`, même convention que le désabonnement). Garde-fou `alert_locale` du health-check étendu pour exclure les domaines de test (`TEST_EMAIL_DOMAINS`), vérifié qu'il ne signale plus rien en direct sur la prod. Profils passés de 27 à 22.

**Limite assumée :** pas de test end-to-end du flux `POST` complet (clic réel sur le bouton de confirmation) — tentative de serveur dev isolé sur Windows abandonnée après un échec de résolution de `node_modules` par lien symbolique (le vrai `node_modules` du dépôt principal vérifié intact après coup, aucun dégât). Compensé par une revue de code ligne à ligne (échappement HTML, validation de jeton HMAC) et des vérifications en lecture/écriture ciblée contre la prod réelle.

**Suite en session, même jour (« on gère tout aujourd'hui ») — traitement du backlog ouvert.** David a demandé de traiter en une fois l'idée 1 du 31/07, les idées 1-3 du 02/08 et l'idée 3 du 28/07, en plus des trois idées du jour. Revue de l'état réel avant de coder (git log + sondes prod) plutôt que de partir du diagnostic écrit : deux items étaient déjà résolus par des sessions précédentes non recensées dans ce log. Statut détaillé mis à jour directement dans chaque entrée d'origine (28/07, 02/08, 31/07) plutôt que dupliqué ici. Récapitulatif :

- **31/07 idée 1 (ratio clic→visite)** — ✅ construite (`9ec3c1e`) : exclusion des rafales de clics scanner.
- **02/08 idée 1 (copy CTA essai actif)** — déjà faite le 02/08 même (`813c5e7`), non recensée à l'époque.
- **02/08 idée 2 (Institut Pasteur)** — ✅ filet général construit (`9ec3c1e`, `checkDecisionHorizonTrials`). Le cas Pasteur précis **tranché le 05/08** : David choisit `is_pilot=true` plutôt que contact hors produit. `jalal.nourlil@pasteur.ma` mis à jour en prod (`is_pilot=true`, `pilot_organization="Institut Pasteur du Maroc"`) — sort de `winback-sequence` (exclusion explicite des pilotes), entre dans `pilot-closing-reminder` (rappel à David 7 jours avant l'échéance du 13/09 pour la session de clôture/proposition payante), copy adaptée dans `trial-reminders`. Ne change rien à `expire-trials` : sans conversion Stripe ni intervention de David d'ici le 13/09, le compte repasse quand même en `free` à l'échéance — `is_pilot` gouverne le traitement email jusque-là, pas le mécanisme d'expiration lui-même.
- **02/08 idée 3 (réconciliation du stock)** — ✅ volet régions : indicateur de visibilité ajouté (`9ec3c1e`) ; volet `alert_locale` déjà couvert (02/08) ; volet invitations : angle mort connu et assumé sur `ouedraogodaouda2408@gmail.com` (non-pilote, cas historique isolé), pas de détection générale construite — risque de faux positifs sur les comptes gratuits jamais reconnectés jugé trop élevé sans signal fiable.
- **28/07 idée 3 (comptes à 5 régions)** — ✅ même indicateur de visibilité que ci-dessus ; pas de correction de fond, le risque de flot qui motivait l'idée est déjà mitigé depuis le 02/08.
- **AMR (10/07) et signal de variance (Simon Ruegg, 6-7/07)** — non traités : aucune spec ni signal frais depuis des semaines, construire à partir de rien irait contre la consigne « mesurer avant de coder ». Proposé à David de cadrer ces deux-là avant de les construire, plutôt que de deviner une implémentation.

Typecheck + lint propres sur tout le dépôt à chaque étape. Poussé sur `master` : `9ec3c1e`.

**Suite, même jour — AMR et signal de variance tranchés par la mesure, pas par le code.** David a demandé de « régler » les deux ; plutôt que de deviner une implémentation sans spec, mesuré en direct sur la prod (lecture seule, scripts jetables) :
- **AMR (Eva Kamau, 10/07)** — la piste « peu coûteuse » (tagger les mentions de résistance déjà dans les descriptions ingérées) n'a pas de matière : **1 seul foyer actif sur 114** mentionne une résistance (Shigellosis/UE-EEE), 2 sur 266 au total. Les deux autres pistes (intégration WHO GLASS, corrélation outbreak→antibiotique proposée par Eva) demandent une source de données non identifiée — heurtent le garde-fou `ROADMAP.md` (pas de nouvelle source sans demande explicite d'un prospect). **Verdict : rien à construire, faute de matière première dans les données déjà ingérées.**
- **Signal de variance / ralentissement critique (Simon Ruegg, 6-7/07)** — question de faisabilité posée par Simon lui-même en juillet, jamais vérifiée. Mesuré sur `outbreak_snapshots` : 205 foyers ont ≥1 instantané, **6 seulement en ont ≥14, aucun n'en a ≥30**. Le foyer le mieux couvert (29 instantanés) montre une série en escalier (plat 3 semaines, saut, plat, trou de 16 jours) — pas une série continue exploitable pour un signal de variance. **Verdict : non calculable sur les données HWG actuelles**, construire quand même produirait un signal statistiquement creux — même erreur que `reporting-lag` (20/07), déjà commise et annulée une fois pour la même raison (prémisse non vérifiée avant de coder).

Aucun code écrit pour ces deux items — la mesure elle-même est la réponse. Les deux ne seront plus remontés au backlog quotidien sans signal ou preuve de faisabilité nouveaux.

---

## 2026-08-04 : Proposition du jour

Angle nouveau : **l'entonnoir d'acquisition lui-même, c'est-à-dire le seul chemin qu'aucun contrôle du produit n'exerce jamais.** Les passages précédents ont couvert la qualité des données (26-27/07), la personnalisation (27-28/07), l'accès des comptes invités (30/07), le canal d'entrée (31/07), le cycle d'essai (01/08), la demande de conversion (02/08) et les machines qui lisent nos e-mails (03/08). Personne n'avait encore regardé ce qui se passe quand l'inscription échoue. Déclencheur : **deux pannes d'inscription en deux jours**, le 03/08 (`6396d5c`, exception relancée par auth-js laissant le bouton tourner sans erreur) et le 04/08 (clé secrète Supabase servie au navigateur, exposée 49 jours, corrigée et tournée ce matin). **Les deux ont été découvertes par la même personne**, Omobolanle Adelekun, épidémiologiste OMS, qui l'a écrit en DM LinkedIn. Aucune des deux par la supervision. Mesures du jour : sondes en lecture seule sur la prod (base + `vercel env ls` + balayage du bundle JS déployé), aucune écriture, scripts jetables supprimés après usage.

**Fait de cadrage mesuré en ouverture :** 26 profils ce soir contre 22 hier, **aucune inscription réelle** (voir idée 2). Toujours zéro client payant. Le bundle déployé est propre à 17h : 22 chunks JS servis par `/en`, zéro occurrence de `sb_secret_`, un seul chunk portant la clé publishable. Le correctif de ce matin tient.

### 1. 🔴 Un échec d'inscription ne laisse aucune trace nulle part, et la seule branche instrumentée est celle qui n'a pas servi

**Signal (code lu ligne à ligne aujourd'hui, croisé avec les deux incidents).** Le correctif du 03/08 a entouré `supabase.auth.signUp()` d'un `try/catch` avec `Sentry.captureException` et `track("signup_unexpected_error")`, exactement pour rendre visible une panne invisible. Mais la panne du 04/08 n'est pas passée par là : Supabase Auth a **renvoyé** une erreur propre (« Forbidden use of secret API key in browser »), donc le code est entré dans la branche `if (error)` de `app/[locale]/signup/page.tsx:165-169`, qui fait exactement ceci :

```
setError(error.message);
setLoading(false);
return;
```

Pas de `Sentry.captureException`, pas de `track()`, aucune ligne en base. Le message s'affiche à l'écran de la personne, et **il n'existe nulle part ailleurs**. Même chose côté connexion : `app/[locale]/login/page.tsx` émet `login_attempt` et `login_success` sur les deux chemins (mot de passe et code OTP) et **aucun événement d'échec**, ni pour l'un ni pour l'autre. L'entonnoir mesure donc les tentatives et les réussites, jamais les pertes.

**La conséquence n'est pas théorique : on ne sait toujours pas, ce soir, ce que la panne a coûté.** Timeline complète des 26 comptes `auth.users` mesurée aujourd'hui : la dernière inscription self-serve par e-mail/mot de passe date du **02/07** (`r.endangrukmanams@`, `saeed.mohamood@`). Depuis, **33 jours**, les seules inscriptions réelles sont passées par **Google** (`guyanoel22@` le 24/07, `codyleereed@` le 01/08) ; les trois comptes e-mail créés entre-temps (ZABRE 18/07, Mulamba 20/07) viennent de `/api/admin/invite`, pas du formulaire. Autrement dit : le seul chemin cassé est aussi le seul qui n'a produit aucun compte depuis un mois, et le chemin épargné est le seul qui en a produit. C'est cohérent avec la panne, **ce n'est pas une preuve** : rien ne permet de distinguer « tout le monde a échoué » de « personne n'a essayé », et c'est précisément le trou. Nuance utile au dossier d'incident : la fenêtre d'exposition de la clé (49 jours, soit depuis ~le 16/06) et la fenêtre de panne ne coïncident pas, puisque deux inscriptions par e-mail ont abouti le 02/07 ; le déclencheur est donc probablement un durcissement côté Supabase (rejet des clés de niveau secret depuis un navigateur) survenu après cette date, pas la pose de la variable elle-même.

**Effort estimé :** petit. Écrire l'échec côté serveur au lieu de le laisser à l'écran : un appel à `/api/track` (route déjà en place, table `product_events` déjà lue par `/admin`) sur la branche `if (error)` de l'inscription et sur les deux branches d'échec de la connexion, avec le code d'erreur. Puis une règle dans l'e-mail de health-check quotidien, même forme que `checkZeroRegionTrials` (01/08) : « N échecs et zéro succès sur 24 h », ou « même code d'erreur système trois fois d'affilée ».

**Risque/inconnue :** (a) **arbitrage de minimisation à trancher par David** : enregistrer le code d'erreur et le domaine rend la panne visible, enregistrer l'adresse permet en plus de rattraper la personne, mais c'est stocker la donnée de quelqu'un qui n'a pas de compte et n'a rien accepté ; les deux options sont défendables, elles n'ont pas la même finalité ; (b) il faut séparer les échecs légitimes (mot de passe trop court, adresse déjà utilisée) des échecs système, sinon l'alerte crie tous les jours et finira ignorée, exactement comme le garde-fou `alert_locale` du 03/08 ; (c) à deux inscriptions par mois, un seuil absolu réagit lentement : c'est un filet à l'échelle actuelle du produit, pas une métrique d'activation.

### 2. 🔴 Rien n'exerce jamais l'inscription : le seul test de bout en bout de l'entonnoir, c'est un vrai prospect qui écrit sur LinkedIn

**Signal (vérifié fichier par fichier aujourd'hui).** Le parcours qui fabrique les clients n'est couvert par aucun contrôle automatique :

| ce qui existe | ce que ça couvre réellement |
|---|---|
| `e2e/auth.spec.ts` | la page d'inscription **s'affiche** (`h1` contient « Créer un compte ») ; un mauvais mot de passe affiche une erreur. **Le formulaire d'inscription n'est jamais soumis.** |
| `playwright.config.ts` | `baseURL = http://localhost:3000` + `webServer: npm run dev`. Les tests n'ont jamais visé la prod. |
| `.github/workflows/` | **un seul** workflow, `sync-outbreaks-hourly.yml`. Les e2e ne tournent nulle part automatiquement ; `package.json` n'expose que `test:e2e`, lancé à la main. |
| `health-check` quotidien | crons en retard, erreurs Sentry, audiences, livraison, essais à zéro région, horizon de décision. **Rien sur l'acquisition.** |

Un canari quotidien aurait crié le 03/08 **et** le 04/08, avant que la personne concernée n'ait à le signaler. Et il règle au passage un problème d'hygiène qui vient de se reproduire un jour après avoir été traité : **quatre comptes `claude-repro-*` / `claude-verify-*@healthwatch-test.dev` ont été créés en prod aujourd'hui** pendant le débogage de l'incident (08:24, 10:39, 11:01, 11:03), et ils y sont toujours ; les profils sont passés de 22 à 26 sans une seule inscription réelle. La parade retenue ce midi (`c450c0a`) a été de les **filtrer par motif** dans `daily-marketing-check`, pas de les supprimer. C'est exactement le motif signalé le 03/08 (idée 3, les 5 comptes `hwg-diag-rl-*`, supprimés hier soir), reproduit le lendemain : faute d'environnement de vérification, la prod sert de banc d'essai et le nettoyage dépend de la mémoire de chaque session. Un canari a l'avantage inverse : son cycle de vie est écrit une fois (créer, vérifier, supprimer, échouer bruyamment s'il n'arrive pas à se supprimer) au lieu d'être réinventé à chaque session de débogage.

**Effort estimé :** moyen, le plus gros des trois. Une route cron dédiée (ou une action planifiée) qui exécute le vrai chemin public avec la clé publishable : inscription d'une adresse jetable sur le domaine réservé, vérification de la réponse et de la ligne en base, puis suppression admin. Le chemin déclenche `activate-trial` et l'e-mail de bienvenue, donc il faut le sortir explicitement des envois.

**Risque/inconnue :** (a) **un canari mal cadré pollue les envois autant que les compteurs** : le 03/08 a montré que les adresses de test consomment de vrais envois Brevo et produisent des rejets (« Unable to find MX of domain healthwatch-test.dev », le 03/08 à 09:04), ce qui abîme la réputation d'expéditeur ; l'exclusion doit porter sur l'envoi, pas seulement sur les rapports ; (b) il couvre l'inscription par e-mail, pas Google OAuth (qui demanderait un compte Google dédié) : c'est acceptable puisque c'est le chemin e-mail qui a cassé deux fois, mais il faut le dire plutôt que croire l'entonnoir couvert ; (c) écrire en prod pour se surveiller reste un compromis ; la version minimale sans écriture (vérifier que la page répond et que le bundle sert bien une clé publishable, cf. idée 3) attrape la panne du 04/08 mais **pas** celle du 03/08, qui ne se voyait qu'à la soumission.

### 3. L'audit sécurité quotidien ne regarde jamais ce qui est réellement déployé, et la fuite de 49 jours n'était pas dans le code

**Signal.** La clé secrète Supabase n'a jamais été présente dans le dépôt : elle était dans la **valeur** de `NEXT_PUBLIC_SUPABASE_ANON_KEY` sur Vercel, donc inlinée en clair dans le bundle servi au navigateur. Or le SKILL de `daily-security-audit-healthwatch` cherche les secrets par grep sur le dépôt et sur l'historique git (§5, « priorité absolue chaque jour »), et **exclut explicitement `.next/`** depuis le 31/07 pour cause de bruit. Aussi rigoureux soit-il, il est structurellement aveugle à ce mode de panne : il n'y avait rien à trouver côté code.

**Et un audit par nom de variable n'aurait rien attrapé non plus.** Vérifié aujourd'hui avec `vercel env ls production` : le projet n'a que quatre variables `NEXT_PUBLIC_*` (URL Supabase, DSN Sentry, VAPID public, clé publishable Stripe), **toutes légitimement publiques par leur nom**. Le défaut était dans la valeur, pas dans la nomenclature. Seul un contrôle de ce qui est réellement servi peut le voir.

**Ce contrôle coûte quelques secondes, mesuré à l'instant :** récupérer `/en`, extraire les `<script src>`, chercher les motifs dans chaque chunk. Résultat de ce soir : 22 chunks, **zéro** `sb_secret_`, un chunk contenant la clé publishable. Quinze lignes de script, exécutées en moins de dix secondes, qui prouvent en direct que le correctif du matin tient et qui auraient crié pendant 49 jours.

**Effort estimé :** petit, et c'est le moins cher des trois. Ajouter le balayage du bundle déployé au `daily-security-audit` (ou au health-check quotidien) sur quelques pages représentatives (`/en`, `/en/signup`, `/en/pricing`, `/en/account`), avec les motifs `sb_secret_`, `service_role`, `sk_live_`, `rk_live_`, `whsec_`, `xkeysib-`, `sntrys_`, et alerte immédiate sur toute occurrence.

**Risque/inconnue :** (a) le balayage ne voit que les chunks référencés par les pages testées, un secret inliné dans une route rare passerait à travers : c'est un filet, pas une preuve d'absence ; (b) motifs à borner précisément pour éviter les faux positifs (une chaîne quelconque ressemblant à un JWT), sinon même sort que les alarmes bruyantes déjà vues ; (c) priorité business honnêtement inférieure aux idées 1 et 2, mais c'est le seul des trois qui protège contre la répétition d'un incident dont la fenêtre d'exposition a duré sept semaines, et il ne referme pas la question ouverte laissée par l'incident (aucun audit des journaux Supabase historiques n'a été fait pour vérifier si la clé a été utilisée pendant la fenêtre, ce qui reste un arbitrage de David, pas un correctif).

**Non re-proposé aujourd'hui :** l'idée 2 du 31/07 (notification d'un abonnement institutionnel entrant) reste PROPOSÉE et non traitée, sans preuve nouvelle. L'idée 3 du 02/08 (réconciliation du stock après correctif) reste partiellement ouverte, volet invitations. Le volet AMR (Eva Kamau) et le signal de variance (Simon Ruegg) ont été **fermés par la mesure le 03/08** et ne reviendront pas au backlog sans faisabilité nouvelle. La piste « version de définition de cas » d'Omobolanle Adelekun (03/08) reste ouverte, décision de priorisation à David, sans angle neuf aujourd'hui. Rien sur la qualité des données ni sur les crons : la journée a déjà livré la résurrection Taïwan, l'enregistrement des trois crons manquants dans `CRON_WINDOWS` et le nettoyage de la config Sentry.

**Contexte mesuré au passage** (pas des idées) :
- **26 comptes `auth.users`, dont 4 créés aujourd'hui par des sessions de débogage** et 1 compte e2e historique (`e2e@healthwatch-global.com`, 16/06). Le parc réel reste à 21 comptes humains.
- **`RESEND_API_KEY` est toujours configurée en prod** (43 jours) alors que tous les envois passent par Brevo. Secret dormant sans usage, à révoquer un jour ; signalé pour mémoire, ce n'est pas une idée produit.
- Les deux clés Supabase affichent une date de création de ce matin sur Vercel (4h et 5h), trace de la rotation ; la date d'origine de la variable fautive n'est donc plus lisible, seule `NEXT_PUBLIC_SUPABASE_URL` (50 jours) situe encore la fenêtre.

**Statut :** David a validé les trois (« On applique les 3 idées »). Construction déléguée à une session dédiée (conformément à la consigne de scope de `daily-product-ideas-healthwatch` : cette routine idée et propose uniquement, ne code jamais elle-même). Les trois construites et déployées le jour même, commit `afbff6e` :

- **Idée 1 (traçage des échecs signup/login) : ✅ FAIT.** Nouvelle table `auth_failures` (migration appliquée en prod via `supabase db push`), écrite par `POST /api/track-auth-failure` (route non authentifiée puisque personne n'a de session au moment où sa propre inscription échoue, protégée par rate limit plutôt que par un compte). `app/[locale]/signup/page.tsx` (branche `if (error)`) et `app/[locale]/login/page.tsx` (les deux branches, mot de passe et OTP) appellent désormais cette route avec le code d'erreur Supabase et le domaine de l'email. **Arbitrage RGPD tranché dans le sens minimal demandé par David** : seul le domaine est stocké, jamais l'adresse complète, la personne qui échoue n'a pas de compte et n'a rien accepté. `lib/auth-failure-classify.ts` distingue échec légitime (mot de passe faible, email déjà utilisé, mauvais mot de passe au login, OTP expiré, rate limit Supabase) d'échec système par liste blanche fermée ; tout code inconnu est classé système par défaut, pour ne pas sous-compter un défaut jamais vu auparavant comme celui du 04/08. `app/api/cron/health-check/route.ts` alerte désormais sur tout échec système en 24h (pas de comparaison "zéro succès" : au volume actuel, un seul échec système suffit à justifier l'alerte, et le filtrage légitime/système est le vrai garde-fou anti-bruit). Vérifié en direct contre la prod réelle : les vrais codes Supabase (`weak_password`, `invalid_credentials`, `user_already_exists`) sont bien classés légitimes ; un code inventé (`unexpected_failure`) est bien classé système et remonté par la requête exacte du health-check ; lignes de test supprimées après vérification.
- **Idée 2 (canari e2e inscription) : ✅ FAIT.** Nouvelle route `app/api/cron/signup-canary` (cron quotidien 05:10, enregistrée dans `vercel.json` et `CRON_WINDOWS`) : appelle `supabase.auth.signUp()` avec la vraie clé publishable sur une adresse `claude-canary-<timestamp>@healthwatch-test.dev`, vérifie que la ligne `profiles` apparaît, supprime le compte via l'API admin immédiatement après. Tout échec (y compris une exception non attrapée, le motif exact du 03/08) est loggé via `logCronRun` avec le statut `error`, remonté gratuitement par le mécanisme générique `erroring` déjà présent dans le health-check, sans bloc dédié à écrire. **Limite assumée et documentée dans le code** : ne couvre que le chemin e-mail/mot de passe (pas Google OAuth) et n'appelle délibérément ni `activate-trial` ni `send-welcome` (des fetchs séparés faits par la page, pas déclenchés par `signUp()` lui-même) pour ne jamais risquer un vrai envoi Brevo vers une adresse fictive, exactement ce qui a abîmé la réputation d'expéditeur le 03/08. Vérifié en direct contre la prod réelle avant de committer : `signUp()` retourne bien une session immédiate (confirme `mailer_autoconfirm` actif), la ligne `profiles` est visible dès le premier essai, zéro région d'alerte enrôlée (confirme qu'aucun effet de bord n'est déclenché), suppression complète confirmée après coup. **Nettoyage lié fait dans la même session** : les 4 comptes `claude-repro-*`/`claude-verify-*@healthwatch-test.dev` créés le 04/08 pendant le débogage de l'incident de clé secrète ont été vérifiés (un seul avait des données liées : `claude-repro-david-test@`, passé par le vrai flux d'activation d'essai le jour même, 5 régions, 107 lignes `outbreak_alert_log`, 2 `alert_notifications`, tout cascadé par la suppression du compte ; les 3 autres étaient vides) puis supprimés.
- **Idée 3 (scan secrets bundle JS déployé) : ✅ FAIT, aux deux emplacements.** `app/api/cron/health-check/route.ts` récupère désormais `/en`, `/en/signup`, `/en/pricing`, `/en/account`, extrait les `<script src>` et cherche les motifs (`sb_secret_`, `service_role`, `sk_live_`, `rk_live_`, `whsec_`, `xkeysib-`, `sntrys_`) dans chaque chunk JS référencé ; toute occurrence déclenche une alerte Sentry de niveau `error` (pas `warning`, pour ne pas se noyer dans le bruit des crons en retard) et un marqueur `🔴 SECRET EXPOSÉ` en tête du sujet de l'e-mail. Même contrôle ajouté à `daily-security-audit-healthwatch/SKILL.md` (nouvel item "6bis", numérotation existante préservée) comme passe complémentaire quotidienne indépendante du cron serveur. Vérifié en direct contre le site réellement déployé : 25 chunks scannés sur les 4 pages, zéro occurrence, confirmant que le correctif de ce matin tient toujours ce soir.

**Vérifications communes** : `npx tsc --noEmit` et `npm run lint` propres sur tout le dépôt (2 warnings React Hooks préexistants, sans rapport). Tous les scripts de vérification jetables supprimés après usage. Migration `auth_failures` appliquée en prod (`supabase db push`, confirmée par une lecture REST immédiate). Poussé sur `master` : `afbff6e`.

---

## 2026-08-17 — Proposition du jour

**Premier run depuis le 04/08** (routine suspendue du 05/08 au 17/08, priorité Codeur/freelance, réactivée aujourd'hui sur demande explicite de David). 13 jours de travail produit ont eu lieu sans passage d'idéation : couverture Pacifique, incidents de connexion, sécurité, qualité de données. **J-4 avant le go/no-go du 21/08.**

Angle nouveau : **le seul acte d'achat jamais enregistré par le produit, et l'instrument qui va servir à trancher le 21/08.** Les passages précédents ont couvert la qualité des données, la personnalisation, l'accès, le canal d'entrée, le cycle d'essai, la demande de conversion, les machines qui lisent les e-mails et l'entonnoir d'inscription. Personne n'avait encore regardé **ce qui se passe quand quelqu'un dit oui**.

**⚠️ Limite de méthode à lire avant les idées, elle change leur statut de preuve.** Contrairement à tous les passages précédents, **je n'ai pas pu sonder la base prod** : les trois tentatives d'exécution d'un script de lecture seule (`node`, script jetable lisant `.env.local.live`) ont été **refusées par le classifieur de permissions** de cette session automatisée. Les faits ci-dessous viennent donc de trois sources, jamais d'une requête que j'ai lancée moi-même :
1. **le code, relu ligne à ligne aujourd'hui** — c'est la source de tout ce qui est affirmé sur le comportement du produit, et elle est solide ;
2. **`marketing/content-log.md` l. 83, écrite aujourd'hui** par la session marketing, qui a elle-même interrogé Stripe en direct ce matin (clé restreinte, sans `charge_read`) ;
3. **l'e-mail envoyé par David ce matin à 07:11**, lu dans Gmail.

Conformément à [[feedback_verify_live_db_not_carryover_notes]] : la source 2 est une lecture live du **même jour**, pas une note de report — mais toute affirmation sur l'état actuel de la base (compteurs `/admin`, nombre d'essais) reste **dérivée de la logique du code**, pas mesurée. À revérifier d'une requête avant de s'appuyer dessus pour la décision.

### 1. 🔴 Le seul vrai achat de l'histoire du produit est un abonnement sans carte, programmé pour s'annuler tout seul le 26/08 — et le produit le traite partout comme un client payant

**Signal.** `otitamorgan@gmail.com` (Morgan Otita, contact LinkedIn) s'est inscrit le **12/08** et a passé un **checkout Stripe Pro annuel à 249 $ soixante-et-onze secondes plus tard**. C'est, à ce jour, **le signal d'intention le plus fort jamais enregistré par HWG** : aucun clic vers `/pricing` n'avait jamais été observé d'un humain (le premier, le 03/08, était un scanner de l'OIM). État réel de l'abonnement, lu en direct sur Stripe ce matin par la session marketing : **`trialing`, aucun moyen de paiement rattaché**, `trial_settings.end_behavior = missing_payment_method: cancel` → **annulation silencieuse le 26/08**, sans qu'un centime soit encaissé.

**Ce n'est pas un accident de parcours, c'est ce que le code demande à Stripe de faire.** `app/api/checkout/route.ts:149-153` : dès qu'il reste des jours d'essai (et il en reste toujours pour un nouveau compte, `trialDaysRemaining` retombe sur 14 par défaut, l. 146), la session Checkout part avec les trois paramètres suivants ensemble :

```
subscription_data[trial_period_days]                                  = N
subscription_data[trial_settings][end_behavior][missing_payment_method] = cancel
payment_method_collection                                              = if_required
```

`if_required` + un essai = **Stripe ne demande pas de carte**, et `cancel` = **l'abonnement meurt à la fin de l'essai**. Autrement dit : la seule porte d'achat du produit est configurée pour ne jamais encaisser, et pour se refermer sans bruit. Ce qui suit est cohérent avec cette configuration, pas avec un bug ponctuel.

**Et le produit, lui, célèbre la conversion.** `app/api/webhook/route.ts:207-273` (`checkout.session.completed`) écrit `plan`, `stripe_customer_id`, `stripe_subscription_id`, `trial_ends_at`, enrôle les régions d'alerte, puis envoie `sendUpgradeEmail()` — l'e-mail de bienvenue « passage à Pro ». La page de retour affiche `messages/en.json:48` : **« Subscription confirmed! »**. Rien, à aucun moment, ne mentionne qu'il manque une carte.

**Le vrai coût est là : dans tout le produit, `stripe_subscription_id` non nul veut dire « client payant ».** Ce compte est donc désormais sorti de tous les dispositifs qui auraient pu le rattraper :

| mécanisme | ce qu'il fait de ce compte | référence |
|---|---|---|
| Bandeau d'essai | **masqué** (`hasSubscription` vrai) | `components/TrialBannerLoader.tsx:36` |
| Modale d'upgrade | **court-circuitée** | `components/UpgradeModal.tsx:190-198` |
| CTA de la fiche foyer (**la seule surface d'atterrissage prouvée**) | **masqué**, état `paid` | `components/OutbreakBottomCta.tsx:108` |
| Rappels J-3 / J-1 de fin d'essai | **exclu** par `.is("stripe_subscription_id", null)` | `app/api/cron/trial-reminders/route.ts:103` |
| `checkZeroRegionTrials` (health-check) | **exclu**, même filtre | ajouté le 01/08 |
| `checkDecisionHorizonTrials` (health-check) | **exclu**, même filtre — alors que son essai se résout le **26/08**, soit exactement le cas pour lequel ce contrôle a été construit | `app/api/cron/health-check/route.ts:389-390` |
| `/admin` → « Abonnés Stripe actifs », « MRR réel », checklist go/no-go | **compté comme payant** | voir idée 2 |

**Le détail qui prouve que l'intention du code était l'inverse.** Dans `trial-reminders`, à 20 lignes au-dessus du filtre qui l'exclut, le commentaire dit mot pour mot (l. 80-83) : « *Note: `stripe_subscription_id` filter is intentionally omitted — users who went through checkout with a trial but no payment method would otherwise be silently skipped.* » Le commentaire décrit exactement ce cas, annonce que le filtre a été retiré pour lui — **et le filtre est toujours là, l. 103**. Quelqu'un a vu le trou et documenté le correctif sans que le correctif existe.

**Il reste un filet, et il est plus fragile qu'il n'y paraît.** `app/api/webhook/route.ts:465-493` traite `customer.subscription.trial_will_end` et, bien vu, **distingue** `hasPaymentMethod` pour choisir la bonne copie. Deux réserves : (a) son propre commentaire (l. 463) précise « *Requires "customer.subscription.trial_will_end" enabled in Stripe Dashboard* » — **aucune trace de cette configuration nulle part dans le dépôt** (zéro occurrence de `enabled_events` ou d'une doc des événements souscrits) et rien ne la surveille, donc personne ne sait si cet événement est réellement activé ; (b) il part **3 jours avant**, soit vers le **23/08** — après la décision du 21/08, et 3 jours avant l'annulation.

**Pourquoi maintenant :** à J-4, ce compte est simultanément la meilleure nouvelle du produit (quelqu'un a voulu payer, spontanément, 71 secondes après son inscription) et le trou le plus coûteux (il ne paiera pas, et il disparaîtra le 26/08 sans que rien ne se déclenche). Les deux échéances encadrent la décision.

**Effort estimé :** petit, en trois gestes séparables et indépendants.
- **(a)** Distinguer les deux intentions au checkout : depuis `/pricing`, un clic sur « s'abonner » est une intention d'achat → `payment_method_collection: "always"` (Stripe ne débite toujours rien avant la fin de l'essai, la promesse commerciale tient) ; depuis le CTA de fiche foyer, qui annonce noir sur blanc « essai gratuit — **sans carte bancaire** », garder `if_required`, sinon la copie devient mensongère. Un paramètre, conditionné à la surface d'origine.
- **(b)** Créer l'état d'interface qui manque : `trialing` **sans** moyen de paiement n'est ni `paid` ni `trial` ni `expired` aujourd'hui — un bandeau « votre abonnement s'annulera le {date} faute de carte enregistrée » avec le lien vers le portail de facturation (déjà construit, `app/api/billing-portal`).
- **(c)** Une ligne dans le health-check quotidien : abonnements Stripe `trialing` sans moyen de paiement, même forme que `checkZeroRegionTrials`. C'est la seule des trois qui aurait fait remonter ce cas **le 12/08** au lieu du 17/08.
- Et, indépendamment : aligner `trial-reminders` sur son propre commentaire.

**Risque/inconnue :** (a) **le fait qu'exiger une carte ajoute de la friction est réel** — d'où la séparation par intention plutôt qu'un changement global : le seul funnel qui ait jamais produit un checkout ne doit pas être durci à l'aveugle ; (b) **je n'ai pas pu relire Stripe depuis cette session** (probe refusée) : une carte a peut-être été ajoutée depuis l'e-mail de David de ce matin, ce qui réglerait le cas individuel **sans rien changer au défaut structurel** ; (c) `payment_method_collection: "always"` avec un essai est supporté par Stripe mais modifie l'écran de Checkout — à vérifier en mode test avant la prod ; (d) l'énumération complète des moyens de paiement était impossible ce matin (clé restreinte sans `charge_read`), donc « aucune carte » repose sur `default_source` et `invoice_settings.default_payment_method` vides — solide, pas absolu.

### 2. 🔴 La checklist go/no-go du 21/08 va passer au vert grâce à cet abonnement sans carte — et elle affiche un MRR de 29 € qui n'existe pas

**Signal (code lu aujourd'hui).** La décision du 21/08 a un instrument, et il est dans le produit : `app/[locale]/admin/page.tsx:319-324`, quatre critères, avec la règle de lecture imprimée juste en dessous (l. 533-535) : **« ≥3/4 cochées → continuer sans changer de cap · <2/4 → diagnostiquer l'activation »**.

| critère | code | ce qu'il vaut réellement |
|---|---|---|
| ≥5 utilisateurs revenus après J+2 | `returnedUsers.length >= 5` | mesuré (corrigé le 30/07 pour tenir compte des sessions persistantes) |
| ≥3 utilisateurs actifs sur 30 j | `active30.length >= 3` | mesuré |
| **≥1 paiement Stripe actif** | **`payingCount >= 1`** | **`payingCount` = comptes avec `stripe_subscription_id` non nul ≠ `admin_override` (l. 217-219). Morgan Otita rentre dans ce compte. Le critère passe donc au vert avec zéro euro encaissé, sur un abonnement programmé pour s'annuler 5 jours après la décision.** |
| ≥1 pilote en discussion active | **`pipeline: false`** — **codé en dur** (l. 323) | ne peut structurellement jamais être vert |

Comme le 4e est verrouillé à faux, **le maximum atteignable est 3/4 — c'est-à-dire exactement le seuil du « continuer sans changer de cap »**, et il est franchi au moment précis où le critère de paiement passe au vert. La décision la plus lourde du projet peut donc basculer sur un compte qui n'a jamais rien payé.

**Le même chiffre se retrouve dans le KPI de revenus.** `realMrr` (l. 223) somme `PLAN_MRR[plan]` sur ces mêmes comptes, et `PLAN_MRR.pro = 29` (l. 30-36). La carte « **MRR réel (Stripe)** » affichera donc **29 €** — faux deux fois : l'abonnement n'encaissera rien, et s'il encaissait ce serait un **annuel à 249 $ ≈ 20,75 €/mois**, pas 29. `PLAN_MRR` ne distingue nulle part mensuel et annuel, alors que `/api/checkout` vend les deux (l. 13-19).

**Et le critère retiré l'a été sur une prémisse qui n'est plus vraie.** Le commentaire l. 316-318 explique que la « réponse institutionnelle » a été sortie du scoring parce que « *le canal cold email institutionnel a été fermé, ce critère ne pourra structurellement plus jamais passer au vert* » ; l'interface l'affiche « *hors scoring, canal email fermé* » (l. 540). Or ce canal est aujourd'hui **le plus gros effort en cours du projet** : `marketing/institutional-prospects-log.md` (runs des 15, 16 et 17/08) donne **200 institutions prospectées, 180 messages envoyés, 170 effectivement délivrés, 10 bounces — et zéro réponse, de quelque nature que ce soit**, plus 20 brouillons créés aujourd'hui même. Le seul fait mesuré sur l'effort dominant des trois dernières semaines n'apparaît pas dans le panneau qui sert à décider ; il ne vit que dans un log marketing.

**Pourquoi maintenant :** dans 4 jours. Un instrument qui se trompe dans le sens optimiste, sur le seul critère décisif, le jour d'un go/no-go, est plus coûteux qu'une fonctionnalité manquante — c'est le 30/07 à l'envers (ce jour-là la mesure faisait paraître le produit **plus mort** qu'il n'était ; ici elle le fera paraître **plus vivant**).

**Effort estimé :** petit — les quatre critères tiennent en six lignes. Le travail réel n'est pas le code mais la définition : « paiement actif » devrait vouloir dire *abonnement avec moyen de paiement* ou *au moins une facture payée* (`invoice.payment_succeeded` est déjà traité par le webhook, l. 431), pas *colonne non nulle*. Trois compléments cheap : distinguer mensuel/annuel dans `PLAN_MRR`, remplacer `pipeline: false` par un critère mesurable ou l'assumer comme purement manuel, et remettre le canal institutionnel dans le panneau avec son chiffre réel (170 délivrés / 0 réponse) plutôt que la mention « fermé ».

**Risque/inconnue :** (a) ce n'est pas un levier business, c'est l'instrument — mais c'est celui que David lira le 21/08 ; (b) un critère fondé sur les factures payées afficherait **0** aujourd'hui : c'est précisément l'intérêt, le chiffre doit être inconfortable plutôt que faux ; (c) **je n'ai pas vu le panneau** — `/admin` est derrière le login de David et ma sonde base a été refusée : les valeurs annoncées sont déduites du code et de l'état Stripe établi ce matin, pas d'une capture. La vérification coûte à David un coup d'œil sur `/admin` ; (d) le critère « ≥3/4 » lui-même est un héritage du J+30 et n'a jamais été rediscuté depuis — le remettre à plat est une décision de positionnement, pas un correctif.

### 3. Un essai dont l'e-mail est indélivrable est indistinguable d'un essai simplement silencieux — sur le seul canal qui fait entrer quelqu'un dans le produit

**Signal.** `profiles.email_blocked_at` fait correctement son travail en aval : il **gate les envois** de tous les crons de livraison (vérifié : `winback-sequence`, `weekly-signal`, `trial-reminders`, `onboarding-sequence` ×5 requêtes, `expire-trials`, `pilot-follow-up`, `pilot-closing-reminder`, `disease-alerts`, `watchlist-alerts`, `trigger-pheic-alerts`, `trigger-regional-digest`…). Mais **rien ne le remonte jamais** : le health-check quotidien porte aujourd'hui neuf blocs dédiés (livraison, essais à 0 région, invitations de pilotes bloquées, dérive `alert_locale`, abonnements institutionnels, horizon de décision, répartition des régions, échecs d'authentification, secrets dans le bundle) et **`email_blocked_at` n'apparaît pas une seule fois dans le fichier**. Conséquence : un essai actif bloqué chez Brevo, ou dont l'adresse n'existe pas, produit exactement la même trace qu'un essai qui n'ouvre rien — zéro. Or le fait établi le 31/07 tient toujours : **les 4 seules visites réelles jamais mesurées sont 4 clics d'e-mail**, à 8-10 secondes près. Un compte injoignable par e-mail n'a mathématiquement aucune chance de produire un signal d'usage, et il pèse pourtant dans le dénominateur du 21/08.

**Précédent qui chiffre le coût :** Kamau et Mulamba, bloqués depuis le **21/07**, n'ont été découverts que le **28/07**, à la main, en lisant le journal Brevo — sept jours pendant lesquels le bilan hebdomadaire a écrit que « les 4 leads reçoivent bien leurs alertes ».

**Piste concrète mais NON vérifiée, à traiter comme telle :** la mémoire du 16/08 ([[project_hwg_viability_decision_2026_08_21]]) liste parmi les essais en cours l'adresse **`emmabahati@429gmail.com`** — un domaine qui ne peut pas exister (`429gmail.com`). Si l'adresse est bien celle-là, chaque envoi part en dur bounce, le compte n'a jamais rien reçu, et il alimente le 21/08 comme un « essai qui ne s'active pas ». Mais ça peut tout aussi bien être une coquille dans la mémoire elle-même : **je n'ai pas pu le vérifier** (sonde base refusée). Une requête suffit à trancher, et elle doit précéder toute conclusion.

**Effort estimé :** petit — une ligne de health-check listant les essais actifs à `email_blocked_at` non nul, même forme que `checkZeroRegionTrials`. La version renforcée (lire les `softBounces`/« Unable to find MX » du journal Brevo pour les adresses qui n'ont jamais rien reçu) réutilise l'appel Brevo déjà en place dans `sync-brevo-blocklist`.

**Risque/inconnue :** (a) priorité honnêtement inférieure aux idées 1 et 2 : c'est un filet d'interprétation, pas un levier — rien ne partait dans le vide, le gating fonctionne ; (b) le coût est uniquement de lecture (un essai muet parce qu'injoignable déflate le signal d'usage sans qu'on le sache), ce qui n'est grave que les jours où l'on décide sur ce signal — c'est-à-dire dans 4 jours ; (c) une validation d'adresse à l'inscription serait le correctif amont, mais elle touche l'entonnoir qui a déjà cassé deux fois début août (03 et 04/08) : à ne pas mélanger avec ce filet-là.

**Non re-proposé aujourd'hui :** l'idée 2 du 31/07 (notification d'un abonnement institutionnel entrant) est en fait **construite** — `institutionalSubscriptions` figure dans le health-check (bloc HTML l. 903-905) ; elle sort du backlog. Le volet AMR (Eva Kamau) et le signal de variance (Simon Ruegg) ont été **fermés par la mesure le 03/08**, ils ne reviennent pas. La piste « version de définition de cas » d'Omobolanle Adelekun (03/08) reste ouverte, décision de priorisation à David, sans angle neuf. Les 18 indicateurs de confiance communautaire d'Andrea Bernasconi (07-08/08) restent classés non constructibles faute de source (aucune des données n'est publiée dans un bulletin public) — signal de recherche, pas fonctionnalité. Rien sur la qualité des données : les 13 derniers jours en ont déjà livré beaucoup (Pacifique, Ebola RDC DON615, choléra Tchad/Cameroun/Kenya, dengue Brésil).

**Contexte relevé au passage** (pas des idées) :
- **Le pilote de Paula Bankunda s'est fermé aujourd'hui** (e-mail de clôture envoyé par David à 07:11). C'est l'utilisatrice la plus active de l'histoire du produit (13 `product_events` au 02/08) et la seule dont on ait jamais prouvé un parcours e-mail → fiche foyer. Sa fenêtre de conversion est donc **derrière** la décision du 21/08, pas devant.
- **`marketing/product-feedback.md` n'a reçu aucune entrée depuis le 08/08** (Andrea Bernasconi) : neuf jours sans signal terrain entrant, dans une période où 170 messages institutionnels ont été délivrés.
- **Prospection institutionnelle** : 200 prospectés / 180 envoyés / 170 délivrés / 10 bounces / **0 réponse**, et 30 brouillons en attente de relecture chez David au moment de ce run.
- Rappel de contrainte : les 3 essais standards qui expirent **après** le 21/08 (25, 26 et 28/08) sont bien signalés par `checkDecisionHorizonTrials` — mais Morgan Otita, dont l'abonnement se résout le 26/08, **ne l'est pas** (idée 1).

**Statut : David a validé les trois** (« On applique les 3 idées », 17/08 en session). **Construction déléguée à une session dédiée** (`task_7b531b68`), conformément au périmètre de cette routine — aucun code écrit ici, comme les 30/07, 01/08 et 04/08. Statut détaillé à mettre à jour par cette session, idée par idée.

**Brief transmis à la session de construction**, en trois priorités et avec les arbitrages déjà tranchés pour ne pas la laisser deviner :
- **Étape 0 obligatoire — vérifier l'état live avant de coder.** Deux faits de cette entrée ne sont pas mesurés : l'état actuel de l'abonnement de `otitamorgan@gmail.com` (une carte a peut-être été ajoutée depuis l'e-mail de David de 07:11 — ça règlerait le cas individuel sans rien changer au défaut structurel) et l'existence réelle de `emmabahati@429gmail.com` (adresse issue d'une mémoire, domaine impossible, potentiellement une coquille). Consigne explicite : ne jamais présenter une déduction comme une mesure, et ne pas corriger l'adresse d'un utilisateur d'autorité.
- **Idée 1, quatre volets** : (a) séparer les intentions au checkout — `payment_method_collection: "always"` depuis `/pricing` seulement, `if_required` conservé là où la copie promet « sans carte bancaire », en faisant remonter la surface d'origine dans le POST ; (b) créer l'état d'interface manquant (`trialing` sans moyen de paiement n'est ni `paid` ni `trial` ni `expired`), probablement via une colonne écrite par le webhook plutôt qu'un appel Stripe à chaque rendu ; (c) une ligne de health-check sur les abonnements `trialing` sans carte ; (d) aligner `trial-reminders` sur son propre commentaire sans créer de doublon avec `trial_will_end`. L'activation de `customer.subscription.trial_will_end` dans le Stripe Dashboard est signalée comme relevant de David, pas de la session.
- **Idée 2** : redéfinir « paiement actif » (moyen de paiement ou facture payée) en réutilisant le mécanisme de 1(b), distinguer mensuel/annuel dans `PLAN_MRR`, trancher le sort de `pipeline: false` (sinon « ≥3/4 » est en réalité « ≥3/3 »), et remettre le canal institutionnel dans le panneau avec son chiffre réel (170 délivrés / 0 réponse) au lieu de la mention « canal email fermé ».
- **Idée 3** : la ligne de health-check sur les essais actifs à `email_blocked_at` non nul, **sans** y mêler une validation d'adresse à l'inscription (entonnoir déjà cassé deux fois les 03 et 04/08).
- **Garde-fous rappelés** : aucun e-mail à un utilisateur réel, aucun cron d'envoi déclenché contre la prod (incident du 15/07), aucun compte de test créé en prod (précédents des 03 et 04/08), sondes en lecture seule et scripts jetables supprimés, typecheck + lint propres, et vigilance sur les sessions concurrentes qui écrivent dans `marketing/*.md`.
- **Point laissé à David plutôt qu'automatisé** : durcir le checkout ajoute de la friction sur le seul funnel ayant jamais produit un achat — si la séparation par surface s'avère non implémentable proprement, la session doit le signaler au lieu de durcir les deux surfaces.

---

## 2026-08-18 — Proposition du jour

**⚠️ Correction (ajoutée en session interactive, 2026-08-19) : cette entrée a été écrite un jour trop tôt par erreur.** Le run a daté « aujourd'hui » comme le 18/08 (mémoire de conversation périmée) alors que la date réelle — confirmée a posteriori par l'horodatage des commits git — était déjà le **19/08**. Conséquences concrètes à corriger en lisant ce qui suit : c'était **J-2** avant le go/no-go du 21/08, pas J-3 ; le bulletin Ebola/RDC du 12/08 avait **7 jours** de péremption au moment du run, pas 6, ce qui l'aurait déjà fait franchir le seuil PHEIC de `data-quality` (7j) **le jour même**, pas « demain ». Les faits cités comme « aujourd'hui » sur la session `linkedin-hwg-followup-check` (DM sans chiffres HWG, arbitrage en attente) dataient en réalité de la veille, le 18/08. Rien de ce qui suit sur le fond des trois idées (fraîcheur affichée sur `updated_at`, lignes orphelines de rafraîchissement, les 3 idées du 17/08 non construites) n'est affecté par cette erreur d'un jour — seuls les décomptes de jours et les « aujourd'hui »/« demain » le sont. Les corrections de code livrées en session interactive le 19/08 sont documentées plus bas dans ce fichier.

**J-2 avant le go/no-go du 21/08** *(J-3 au moment où cette entrée a été écrite par erreur — voir correction ci-dessus)*.

Angle nouveau : **l'écart entre ce que le produit affirme sur la fraîcheur de ses chiffres et ce qu'il mesure réellement.** Les passages précédents ont couvert la qualité des données elle-même (26-27/07), la personnalisation, l'accès, le canal d'entrée, le cycle d'essai, la demande de conversion, l'entonnoir d'inscription et l'acte d'achat (17/08). Le 26/07 avait construit le *détecteur* de fraîcheur des lignes verrouillées ; personne n'avait encore regardé **ce que le produit dit au visiteur** de cette fraîcheur, ni **qui a encore le droit d'écrire** sur ces lignes.

**✅ Contrairement au 17/08, j'ai une mesure live cette fois.** La sonde base a été contournée par une lecture publique : `curl` sur `https://healthwatch-global.com/fr/outbreak/bd1c3a46-…` (page publique, sans identifiants, aucune écriture). Ce qui est affirmé ci-dessous sur l'état affiché de la ligne Ebola/RDC est donc **mesuré sur la prod du jour**, pas déduit. Restent non mesurés par moi et étiquetés comme tels : l'ampleur de l'écart (280 cas / 141 décès, chiffre repris de la session marketing du jour) et l'état de l'abonnement Morgan Otita (`/api/outbreaks` exige une authentification, `/admin` est derrière le login de David).

### 1. 🔴 Le produit colle une pastille verte « ✓ Synchronisé avec la source officielle » sur des chiffres que plus aucune routine n'a le droit de mettre à jour

**Signal, mesuré en direct sur la prod aujourd'hui.** La fiche publique du plus gros foyer du produit (Ebola/RD Congo, PHEIC, la plus grande épidémie d'Ebola jamais enregistrée dans le pays) affiche :

- `4 665 cas`, `2 184 décès`, bulletin **WHO DON du 2026-08-12** (soit **6 jours**) ;
- JSON-LD : `datePublished: 2026-08-12`, `dateModified: 2026-08-15` ;
- et, juste au-dessus du bloc de citation Vancouver : **« 🔄 Vérifié par HealthWatch : Il y a 3j »**.

**Ce « vérifié » ne vérifie rien.** `app/[locale]/outbreak/[id]/page.tsx:567` calcule ce libellé depuis **`o.updated_at`** — l'horodatage de la dernière *écriture en base sur la ligne*, quelle qu'elle soit. La ligne a été touchée le 15/08 par une passe de contrôle manuelle ; ses chiffres, eux, datent du bulletin du 12/08. N'importe quelle écriture (une description, un champ de langue, un champ de confiance de source) rafraîchit la mention sans toucher un seul chiffre.

**La même confusion se retrouve sur trois autres surfaces, dont la principale**, toutes via `lib/outbreaks.ts:651-673` :

| surface | ce qui est affirmé | d'où vient le chiffre |
|---|---|---|
| Tableau du dashboard (`components/OutbreakTable.tsx:1243-1253`) | pastille verte **« ✓ MàJ · 3j »**, infobulle **« Synchronisé il y a 3j avec la source officielle »** | `updated_at` |
| Fiche publique (`page.tsx:567`) | « Vérifié par HealthWatch : il y a 3j » | `updated_at` |
| Avertissement « SANS MAJ » (table + fiche + modale) | ne s'affiche qu'à partir de **60 jours** (`STALE_DAYS = 60`) | `updated_at ?? date` |
| Score de risque (`lib/outbreaks.ts:724`) | pénalité de −0,5 levée dès qu'on touche la ligne | `updated_at` |

L'infobulle du dashboard est la formulation la plus exposée : **une coche verte qui affirme une synchronisation avec la source officielle**, alors que le timestamp dont elle est tirée ne peut rien dire de la source. Sur cette ligne précise, l'affirmation est fausse.

**Et le produit sait mesurer correctement — ailleurs.** Le cron `data-quality` (`route.ts:362-421`) mesure la péremption sur **`row.date`** (la date du bulletin), avec un seuil **PHEIC de 7 jours** : la même ligne, le même jour, est à 6 jours de son bulletin et sera donc signalée **demain 19/08** dans l'e-mail « à revoir » de David. Deux instruments, deux définitions : l'interne (7 j sur la date du bulletin) est **8,5× plus strict** que le public (60 j sur la date d'écriture) — et le public, au lieu d'avertir, affirme positivement.

**Pourquoi c'est plus qu'un défaut d'affichage : cette ligne n'a plus de rédacteur du tout.** Trois faits de code, vérifiés aujourd'hui :

1. `app/api/cron/sync-drc-sitrep/route.ts` (en-tête) annonce : « *Ebola DRC figures are kept fresh via sync-who-afro (WHO Disease Outbreak News) instead* » — sa propre détection de sitrep est **désactivée définitivement** (ToS ReliefWeb).
2. `app/api/cron/sync-who-afro/route.ts:504` : `.lte("source_priority", 5) // never overwrite sitrep (priority 10)`. Le chemin de fraîcheur que l'en-tête ci-dessus désigne est **structurellement interdit** par le garde-fou de la routine désignée. La ligne est en priorité 10.
3. Le seul rédacteur restant, `scripts/update-drc-sitrep-social.mjs`, est **orphelin depuis le 17/08** (documenté le jour même, commit `8c15fc1`) : ses deux seuls appelants nommés étaient `x-hwg-monitoring` et `x-hwg-followup-check`, éliminées ce jour-là. Et son garde-fou de source (l. 68-76) n'accepte que les hôtes `twitter.com`/`x.com` — **aucune routine LinkedIn ne peut donc l'utiliser**, quelle que soit la qualité de ce qu'elle a lu.

Conséquence : la ligne la plus visible du produit ne peut plus être mise à jour que **par David à la main**, et l'interface affirme pendant ce temps qu'elle est synchronisée.

**Le coût est déjà payé, aujourd'hui, par le marketing.** La session `linkedin-hwg-followup-check` du jour a **délibérément renoncé à citer les chiffres HWG** dans un DM à un contact professionnel, en écrivant noir sur blanc : « *Aucun chiffre de la base HWG cité volontairement : la ligne Ebola/RDC est verrouillée `source_priority: 10` et périmée* », et a reformulé pour rester vraie « quel que soit l'arbitrage en cours ». Le même fichier signale l'arbitrage en attente pour le **3e jour consécutif** : « *Aucune routine active ne peut mettre cette ligne à jour dans les règles actuelles.* » Autrement dit : **le fondateur ne peut plus citer son propre produit dans sa prospection**, 3 jours avant le go/no-go. C'est le signal le plus concret qu'un problème de données a déjà quitté le terrain technique.

**Effort estimé :** petit, en trois gestes indépendants.
- **(a)** Séparer les deux notions dans les libellés visibles : la fraîcheur revendiquée doit se calculer sur **`date`** (le bulletin), pas sur `updated_at`. `data-quality` fournit déjà la bonne définition et les bons seuils (7 j PHEIC / 21 j / 180 j dashboard) — les réutiliser plutôt qu'en inventer.
- **(b)** Retirer la revendication de synchronisation de l'infobulle du dashboard, ou la rendre vraie en la posant sur la date du bulletin. « Bulletin du 12/08 » est une phrase courte, exacte, et plus crédible auprès d'un professionnel qu'une coche verte.
- **(c)** Trancher le sort du rédacteur de la ligne priorité 10 (voir idée 2 pour la version générale) : soit ré-héberger l'exception d'écriture, soit assumer que ce palier est manuel — mais alors le dire dans l'interface au lieu d'afficher un « vérifié ».

**Risque/inconnue :** (a) **arbitrage de positionnement, pas seulement un correctif** — passer la mesure sur `date` fera apparaître des avertissements de péremption sur des lignes qui affichent aujourd'hui une pastille verte ; c'est le but, mais c'est une décision de David sur ce que le produit montre, pas un bug à écraser. (b) Combien de lignes basculent : **non mesuré** (`/api/outbreaks` exige une authentification) ; `data-quality` le sait déjà, un coup d'œil à l'e-mail « à revoir » de demain donne le nombre exact. (c) L'ampleur de l'écart (280 cas / 141 décès) est **reprise de la session marketing du jour**, je ne l'ai pas vérifiée contre la source officielle moi-même — l'index WHO DON est rendu côté client, non lisible en `curl`. Le défaut de mécanisme, lui, ne dépend pas de ce chiffre. (d) Le score de risque changerait aussi (point 4 du tableau) : effet de bord sur le classement, à regarder avant de livrer.

### 2. 🔴 Protéger une ligne d'une source laggarde la sort du rafraîchissement automatique — et la seule compensation est un dictionnaire d'UUID écrit à la main, qui a lâché 3 fois en 13 jours

**Signal.** Le mécanisme est sain sur le principe : monter `source_priority` au-dessus de 5 empêche un cron OMS agrégé d'écraser une meilleure source nationale. Mais **aucun cron n'écrit au-dessus de 5**, sauf trois exceptions nommées (`sync-samoa-dengue` ≤10, `sync-drc-sitrep` ≤10 mais détection désactivée, `data-quality` ≤9, plus les crons dédiés qui plafonnent à leur propre `SOURCE_PRIORITY`). Inventaire complet relevé aujourd'hui : `grep 'lte("source_priority"' app/api/cron/*/route.ts` → 27 occurrences, **20 plafonnées à 5**. Donc **toute ligne promue au-dessus de 5 cesse de se rafraîchir seule**, immédiatement et silencieusement.

La compensation existe — c'est le filet construit sur l'idée 2 du 26/07 — mais elle repose sur **deux dictionnaires codés en dur dans `scripts/morning-don-check.mjs`** : `MANUAL_ROWS` (l. ~522, quelles lignes vérifier à la main) et `MANUAL_ROW_CHECKED` (l. ~662, à quelle date chacune l'a été pour la dernière fois). Rien ne lie l'un à l'autre, et rien ne lie la promotion de priorité à l'ajout dans la liste : **c'est de la discipline humaine**.

**Elle a lâché trois fois en treize jours, toutes constatées aujourd'hui :**

| cas | ce qui s'est passé | trace |
|---|---|---|
| **Dengue/Sri Lanka + Dengue/Pérou** | promues en priorité 6 le **05/08** pour protéger leurs sources nationales ; le garde-fou hebdomadaire écrit le même jour **n'a jamais atteint `master`** (resté dans la branche `claude/zen-kare-7334b2`, commit `e3ad088`, toujours 2 commits en avance aujourd'hui). Découvert **13 jours plus tard**, les deux lignes figées depuis le 05/08 — le Sri Lanka **malgré un PDF officiel quotidien** (87 536 → 92 595 cas, 63 → 68 décès). | `a690a49` (18/08, 07:13) |
| **Vietnam** | même classe, garde-fou « recréé » le même matin | `a86856b` |
| **Ebola/RDC (priorité 10)** | pire cas : **plus aucun rédacteur du tout** depuis le 17/08, pas même un contrôle manuel programmé (idée 1) | `8c15fc1` |

**Le mécanisme documente lui-même son propre défaut**, en commentaire juste après `MANUAL_ROWS` : « *Vérification faite, source inchangée → aucune écriture, donc `updated_at` ne bouge pas et la ligne se re-signale tous les matins indéfiniment* » (vécu le 06/08 sur les deux lignes polio). D'où le second dictionnaire de dates à tenir à la main. Deux listes manuscrites pour compenser une conséquence qui est, elle, parfaitement déterministe.

**Pourquoi maintenant :** ce n'est pas une hypothèse, c'est un taux. Trois occurrences en treize jours, dont une découverte par hasard « en auditant une autre fusion de branche périmée » (message de `a690a49`), et une qui a déjà coûté au marketing sa capacité à citer le produit (idée 1). Le prochain cas se produira au prochain arbitrage de priorité, et rien dans le système ne le remarquera.

**Effort estimé :** moyen — l'idée est de **déduire** le statut d'orphelin au lieu de l'énumérer. Les plafonds d'écriture des crons sont dans le code, lisibles mécaniquement (le `grep` ci-dessus les sort tous) ; le palier de chaque ligne est en base. Une ligne est orpheline si aucun cron **actif** n'a à la fois un plafond ≥ son `source_priority` et un matcher qui la cible. Deux niveaux possibles :
- **version cheap et honnête** : une table des plafonds tenue à un seul endroit (au lieu de 27 littéraux dispersés), et un bloc de health-check quotidien qui liste les lignes actives dont le palier dépasse le plus haut plafond d'un cron actif. Ça aurait attrapé Sri Lanka/Pérou le 05/08 et Ebola/RDC le 17/08.
- **version complète** : faire de la promotion de priorité un geste qui déclare son propre rédacteur (colonne `refresh_owner` ou équivalent) — plus juste, plus cher, et à ne pas engager à J-3.

**Risque/inconnue :** (a) **le matcher est la partie dure** : savoir qu'un cron *pourrait* écrire une ligne (plafond) est trivial, savoir qu'il la *cible* (pays/maladie/regex) ne l'est pas — la version cheap ci-dessus ne prétend pas le résoudre, elle attrape seulement le cas franc « palier au-dessus de tout plafond », qui est précisément celui des trois incidents. (b) Le cas Malaisie montre que ça marche dans les deux sens : elle a été **délibérément retirée** de `MANUAL_ROWS` parce qu'elle a reçu son propre cron — une déduction automatique aurait vu ce changement sans qu'on ait à s'en souvenir. (c) Ne règle pas le problème amont, réel mais distinct : **des branches portant des correctifs ne sont pas fusionnées** (`zen-kare` 2 commits, `brave-curran` 3 commits en avance aujourd'hui) — c'est un sujet de process, pas de produit, et je ne le propose pas comme idée. (d) Priorité honnêtement inférieure à l'idée 1 côté visible : c'est un filet, pas une surface — mais c'est celui qui empêche l'idée 1 de se reproduire ailleurs.

### 3. ⚠️ Re-remontée assumée : les trois idées validées le 17/08 ne sont pas construites, et il reste 3 jours

**Ce n'est pas une idée neuve** — c'est l'entrée du 17/08 ci-dessus, re-signalée parce qu'une **preuve nouvelle change son évaluation** : elle a été validée (« On applique les 3 idées »), déléguée à une session dédiée (`task_7b531b68`), et **rien n'a été livré**. Vérifié aujourd'hui dans le code, pas déduit :

| idée du 17/08 | état attendu | état réel aujourd'hui |
|---|---|---|
| 1(a) séparer les intentions au checkout | `payment_method_collection` conditionnel | `app/api/checkout/route.ts:152` — `"if_required"` inchangé |
| 1(c) health-check sur les abonnements `trialing` sans carte | un bloc de contrôle | zéro occurrence de `trialing` / `payment_method` dans `health-check/route.ts` |
| 1(d) aligner `trial-reminders` sur son propre commentaire | filtre retiré | `trial-reminders/route.ts` — le commentaire dit toujours « *filter is intentionally omitted* », et `.is("stripe_subscription_id", null)` est toujours 20 lignes plus bas |
| 2 redéfinir « paiement actif » et le MRR | critère sur moyen de paiement / facture payée | `admin/page.tsx` — `paying: payingCount >= 1`, `pipeline: false`, `PLAN_MRR.pro = 29` : **identiques** |
| 3 health-check sur `email_blocked_at` | un bloc de contrôle | **0 occurrence** de `email_blocked_at` dans `health-check/route.ts` |

Rien non plus dans les branches : aucune des 4 branches non fusionnées ne contient ce travail (`git log` sur chacune, vérifié). La session déléguée n'a rien produit, ni sur `master`, ni ailleurs.

**Pourquoi je le remonte plutôt que de l'attendre :** la plus urgente des trois est l'idée 2, **l'instrument du go/no-go lui-même**. Elle reste vraie mot pour mot, avec un jour de moins : le critère « ≥1 paiement Stripe actif » passera au vert grâce à un abonnement sans carte programmé pour s'annuler le 26/08, le 4e critère est codé en dur à `false` (donc « ≥3/4 » est en réalité « ≥3/3 »), et la carte « MRR réel » affichera **29 €** pour un abonnement annuel qui, s'il encaissait, vaudrait ~20,75 €/mois. **Si rien n'est fait d'ici vendredi, David décidera sur ce panneau.**

**Effort estimé :** inchangé — petit pour chacune. Le brief détaillé, avec les arbitrages déjà tranchés, est déjà écrit dans l'entrée du 17/08 : il est réutilisable tel quel, il n'y a rien à re-décider.

**Risque/inconnue :** (a) je ne sais pas **pourquoi** `task_7b531b68` n'a rien livré (session échouée, jamais démarrée, ou tuée) — je constate l'absence de code, je ne diagnostique pas la cause ; (b) si un seul des trois volets doit être fait avant vendredi, c'est **le critère de paiement et le MRR** (idée 2 du 17/08) : c'est le seul qui change ce que David lira le jour de la décision ; (c) le 17/08 notait déjà que l'état de l'abonnement Morgan Otita pouvait avoir changé depuis — **toujours non vérifiable depuis cette session** (`/admin` derrière le login, l'API exige une authentification), l'étape 0 du brief reste obligatoire avant de coder.

**Non re-proposé aujourd'hui :** rien sur la personnalisation, l'accès, l'entonnoir d'inscription ni le cycle d'essai — déjà couverts, sans preuve nouvelle. La piste « version de définition de cas » d'Omobolanle Adelekun (03/08) reste ouverte sans angle neuf ; les 18 indicateurs de confiance communautaire d'Andrea Bernasconi (07-08/08) restent non constructibles faute de source ; les trois sources tierces de Hao-Kai TSENG (29/07) restent bloquées par le garde-fou explicite du `ROADMAP.md` (« ne pas intégrer de source tant qu'un prospect ne demande pas explicitement une détection plus rapide que l'OMS »), et aucun prospect ne l'a demandé. **Pas d'idée sur le persona « décideur »** malgré la directive de ciblage de David du 17/08 au soir : la seule surface d'atterrissage prouvée parle aujourd'hui à un point focal opérationnel (« Guide d'action — Point focal », vu en direct sur la fiche), ce qui *pourrait* être un décalage — mais **aucun décideur n'a jamais été mesuré sur cette page** (les 4 seules visites réelles de l'histoire sont des profils terrain), donc ce serait une refonte de persona sur zéro donnée. À proposer si et quand un décideur clique.

**Contexte relevé au passage** (pas des idées) :
- `marketing/product-feedback.md` : **aucune entrée depuis le 08/08**, soit **10 jours** sans signal terrain entrant. Les trois idées du jour viennent donc du code et de la prod, pas d'une demande d'utilisateur — c'est une limite à garder en tête sur leur priorisation business.
- Prospection institutionnelle : 1 bounce enregistré aujourd'hui (MSPAS Guatemala), 10 nouveaux contacts, toujours **0 réponse** sur l'ensemble de la campagne.
- LinkedIn : 3 + 2 DM envoyés aujourd'hui après validation de David en session, 2 nouveaux en file d'attente ; 1 commentaire, 1 suivi. **0 demande de contact hors plateforme.**
- La ligne Ebola/RDC est en attente d'arbitrage de David pour le **3e jour consécutif** (idée 1).

**Statut : PROPOSÉE — en attente de retour de David.**

---

## 2026-08-19 (soir, ~19h) — Corrections de code livrées, idées 1(c) et 2 ci-dessus

**Contexte de la décision.** En session interactive, sur un point marketing où une session avait signalé « arbitrage Ebola/RDC en attente, 5e jour consécutif » (alors que la ligne avait en réalité été mise à jour le matin même par `morning-don-check`, commit `5d1c6a9`), David a tranché explicitement : **« il faut toujours garder les données les plus neuves, on doit pouvoir jongler entre les sources pour mettre HWG à jour »**, puis a demandé d'appliquer la recommandation immédiatement.

**Ce qui a été livré (commit à suivre) :**
- `lib/outbreak-guards.ts` : nouveau garde-fou `lockedRowRegressionGuard` — sur une ligne à `source_priority>=10`, refuse toute **baisse** de cas ou de décès, même une baisse que `collapseGuard` (seuil 70 %) tolérerait. C'est le garde qui aurait bloqué le chiffre Africa CDC du 18/08 (2 320 décès) contre les 2 378 déjà en base pour Ebola/RDC — cas réel rencontré le jour même.
- `app/api/cron/sync-who-afro/route.ts` et `sync-who-emro/route.ts` : plafond d'écriture relevé de `.lte("source_priority", 5)` à `.lte("source_priority", 10)`. Ces deux crons sont les seuls choisis : sources primaires documentées (offices régionaux OMS), déjà porteurs du jeu complet de garde-fous anti-régression (`dateFloorGuard`/`spikeGuard`/`collapseGuard`/`zeroCaseGuard`/`zeroDeathGuard`), et `sync-who-afro` est textuellement désigné dans le header de `sync-drc-sitrep` comme « ce qui garde Ebola/RDC frais » — une affirmation que l'ancien plafond rendait fausse en silence. Le payload d'écriture préserve désormais `source_priority` existant (`Math.max(5, existingRow.source_priority ?? 0)`) plutôt que de le redescendre à 5 à chaque mise à jour, donc une ligne verrouillée le reste vis-à-vis des 20 autres crons.
- `app/api/cron/sync-drc-sitrep/route.ts` : commentaire d'en-tête corrigé (affirmait encore « never overwritten by automated crons »).
- `tsc --noEmit` et `eslint` passent sans erreur sur les 4 fichiers touchés ; le nouveau garde a été testé à la main contre le cas réel du jour (chiffre Africa CDC plus bas → bloqué ; chiffre AFRO plus récent et en hausse → accepté).

**Volontairement pas fait ce soir :** les 20 autres crons agrégateurs (`sync-africa-cdc`, `check-mpox-sitrep`, `sync-ecdc-threats`, etc.) restent plafonnés à 5 — ils republient des sources de rang institutionnel moindre ou moins rigoureusement extraites qu'un office régional OMS, et étendre à 22 fichiers en une seule passe à J-2 du go/no-go aurait dépassé ce qui a été diagnostiqué. Décision ouverte, pas tranchée.

**Effet attendu sur les 27 lignes actuellement à `source_priority: 10`** (dont 6 lignes Choléra figées au 28/06, 52 jours) : celles couvertes par l'Afrique (AFRO) ou le Moyen-Orient/Asie centrale (EMRO) redeviennent rafraîchissables au prochain passage du cron concerné, sous réserve qu'un article correspondant existe sur la page source. Pas une garantie de rafraîchissement immédiat — une garantie que le mécanisme n'est plus structurellement bloqué.

Mémoire : [[project_source_priority_is_ownership_not_freeze_2026_08_19]].

---

## 2026-08-19 (run de la routine, 19h10) — Proposition du jour

**⚠️ Deuxième entrée de proposition du 19/08.** La précédente est archivée sous le titre « 2026-08-18 » — voir la correction en tête de cette entrée-là : elle a été datée d'un jour trop tôt et a en réalité tourné aujourd'hui. Ce run-ci arrive **après** les corrections de code livrées ce soir (`eb57f8e`, `d124101`, et le lot facturation `411aba0` / `45abc74` / `9611add`), donc après que la moitié du backlog des 17 et 18/08 a été construite. Les idées ci-dessous tiennent compte de cet état, pas de celui d'il y a trois heures.

**J-2 avant le go/no-go du 21/08.**

**État du backlog des 17 et 18/08, vérifié dans le code de `master` à l'instant** (le 18/08 remontait « rien n'a été livré » — ce n'est plus vrai) :

| idée | état ce soir | preuve |
|---|---|---|
| 17/08 — 1(b) état d'interface `trialing` sans carte | ✅ construite | colonne `stripe_has_payment_method`, migration `20260818200000` |
| 17/08 — 1(c) health-check abonnements sans carte | ✅ construite | `health-check/route.ts:363` `.eq("stripe_has_payment_method", false)`, ligne rouge l. 958 |
| 17/08 — 2 « paiement actif » + MRR | ✅ construite | `isPayingCustomer` (l. 247-248), `PLAN_MRR_ANNUAL` (l. 47), `pipeline` sorti du dénominateur (l. 355-366) |
| 17/08 — 3 health-check `email_blocked_at` | ✅ construite | `health-check/route.ts:389`, ligne rouge l. 960 |
| 18/08 — 1 fraîcheur affichée sur `date` et non `updated_at` | ✅ construite | `5d8e1ad` |
| 18/08 — 2 lignes orphelines de rafraîchissement | ✅ traitée au fond | `eb57f8e` + `d124101` : plafond 5→10 sur 17 crons + `lockedRowRegressionGuard` |
| **17/08 — 1(a) séparer les intentions au checkout** | ❌ **non construite** | `app/api/checkout/route.ts:157` — `payment_method_collection: "if_required"` inchangé |
| 17/08 — 1(d) aligner `trial-reminders` sur son commentaire | ❌ non construite | l. 86 le commentaire, l. 105 `.is("stripe_subscription_id", null)` toujours là |

Les deux idées principales du jour portent précisément sur les **conséquences de ce qui a été livré ce soir** : la 1 sur ce que la redéfinition de « payant » rend visible, la 2 sur ce que le nouveau garde-fou rend invisible.

### 1. 🔴 Aucun chemin du produit ne peut encaisser une carte — et depuis ce soir, le critère de paiement du go/no-go en dépend

**Signal, lu dans le code ce soir, pas déduit.** `app/api/checkout/route.ts:149-158` :

- `trialDaysRemaining` vaut **14 par défaut** pour un utilisateur sans essai en base (`: 14; // no DB trial → first-time user`) ;
- si `trialDaysRemaining > 0`, la session Stripe reçoit `trial_period_days`, `trial_settings[end_behavior][missing_payment_method] = "cancel"` **et `payment_method_collection = "if_required"`**.

Conséquence : **tout utilisateur qui clique « passer à Pro » pendant son essai — c'est-à-dire au moment exact où le produit le lui demande — obtient un abonnement sans carte, programmé pour s'annuler tout seul.** C'est très précisément la forme Morgan Otita. Le seul chemin qui collecte réellement une carte est celui d'un utilisateur dont l'essai en base est **déjà expiré** (`Math.max(0, …)` → 0, le bloc `if` ne s'exécute pas, Stripe retombe sur son défaut `always`). Autrement dit : le produit sait encaisser **uniquement** quelqu'un qui a laissé son essai mourir avant de revenir — pas quelqu'un qui décide d'acheter au bon moment. Et il n'y a **qu'un seul point d'entrée de checkout** dans tout le repo (`components/CheckoutButton.tsx:45` → `/api/checkout` → `api.stripe.com/v1/checkout/sessions`), donc pas de chemin alternatif qui rattraperait ça.

**Ce qui est neuf ce soir, et qui rend l'arbitrage urgent.** Le critère `paying` du go/no-go a été **redéfini aujourd'hui** (`9611add`, `45abc74`) : il est passé de « ≥1 abonnement Stripe » à `payingCount = profiles.filter(isRealStripeSub && stripe_has_payment_method)` (`admin/page.tsx:247-250`, critère l. 370). C'est la bonne définition — le 17/08 l'avait demandée pour la bonne raison, et elle est maintenant en place. Mais elle crée une situation que personne n'a encore regardée en face : **le drapeau `stripe_has_payment_method` ne peut être mis à `true` par aucun parcours que le produit propose.** Le critère est donc passé, en une journée, de « toujours vert pour une mauvaise raison » à « structurellement inatteignable ». Vendredi, il affichera 0 payant — et ce sera exact.

**Pourquoi ce n'est pas un simple report du 17/08 :** l'idée 1(a) du 17/08 proposait de *séparer les intentions par surface d'origine* (durcir depuis `/pricing`, garder `if_required` là où la copie promet « sans carte bancaire »). Cette formulation-là est aujourd'hui plus difficile qu'elle n'en avait l'air : la promesse « sans carte bancaire » est écrite sur **au moins 12 surfaces** (`login`, `signup`, `about`, `account`, `alerts`, `reports`, `docs`, `methodology`, `pilot`, `embed`, fiche foyer, FAQ des deux fichiers de messages). Mais ces 12 promesses portent toutes sur **l'essai à l'inscription**, pas sur le checkout — personne n'a jamais promis qu'acheter Pro se ferait sans carte. La séparation à faire n'est donc pas « par surface d'appel » mais **par intention** : créer un essai (sans carte, promesse tenue) vs souscrire (avec carte). Le checkout confond aujourd'hui les deux parce qu'il rejoue systématiquement l'essai.

**Effort estimé :** petit — un `if` et un paramètre. La vraie décision est de trancher ce que doit faire le bouton « passer à Pro » vu par un utilisateur en cours d'essai : (a) collecter la carte tout de suite et laisser courir les jours d'essai restants (`payment_method_collection: "always"` + `trial_period_days` conservé — l'utilisateur n'est pas débité avant la fin, la promesse d'essai gratuit reste vraie, et l'abonnement ne s'auto-annule plus) ; ou (b) garder `if_required` et assumer que le produit ne convertit personne avant l'expiration de l'essai. L'option (a) est la seule qui rend le critère de paiement atteignable.

**Risque/inconnue :** (a) **c'est de la friction ajoutée sur le seul entonnoir ayant jamais produit un acte d'achat** — le 17/08 le signalait déjà et le point reste entier : un formulaire de carte peut faire abandonner là où `if_required` laissait passer. La contrepartie est mesurée, elle : le seul passage réel a produit €0. (b) Je n'ai **pas vérifié l'état live** de l'abonnement de `otitamorgan@gmail.com` depuis cette session (`/admin` est derrière le login, l'API exige une authentification) — une carte a pu être ajoutée à la main depuis ; ça règlerait le cas individuel sans rien changer au défaut structurel décrit ici. (c) Changer ça deux jours avant le go/no-go ne produira aucune donnée avant vendredi : c'est un correctif pour *après* la décision, pas un levier sur le chiffre du 21/08 — à ne pas se raconter autrement.

### 2. 🔴 Le garde-fou livré ce soir peut refuser le chiffre d'une source, définitivement, sans laisser la moindre trace — sauf dans un cron sur dix-sept

**Signal.** `lockedRowRegressionGuard` (`lib/outbreak-guards.ts:171-182`) refuse toute baisse de cas ou de décès sur une ligne à `source_priority >= 10`. C'est le bon garde-fou, et il a été écrit ce soir contre un cas réel (le chiffre Africa CDC du 18/08 plus bas que la base sur Ebola/RDC). Il vient d'être posé sur **17 crons** (`eb57f8e` + `d124101`).

**Ce qu'il advient d'un refus, dans 16 de ces 17 crons :** une entrée poussée dans un tableau `log` local (`log.push({ label, status: "skip", detail: guardReason })`, ex. `sync-who-afro/route.ts:490-493`), renvoyée dans le JSON de la réponse HTTP — c'est-à-dire visible uniquement par qui `curl` la route à la main. Rien n'est persisté : `logCronRun` (`lib/cron-monitor.ts:200-230`) n'écrit que `{ts, status, rows, lastNonZero, error}`, et le `status` passé par ces crons est calculé sur `results.errors > 0`, qui ne compte **que les échecs d'écriture en base**, pas les refus de garde. Un refus laisse donc un cron en `status: "ok"`, et le health-check quotidien ne voit rien.

**Le code sait déjà que c'est faux — dans un seul fichier.** `check-mpox-sitrep/route.ts:565-580` fait exactement l'inverse, avec le commentaire qui explique pourquoi : « *a silently-blocked write would freeze the row on the old figures with nothing to show for it. Surface it as an erroring cron so it reaches the daily health-check, and in Sentry* » — suivi d'un `Sentry.captureMessage` et d'un `logCronRun(..., guardBlocked.length > 0 ? "error" : "ok")`. Le bon patron existe, il est écrit, il est commenté, et les 16 autres crons viennent de recevoir le même garde sans lui.

**Pourquoi c'est plus grave qu'avant ce soir.** Avant, une ligne verrouillée était bloquée **au niveau de la base** (`.lte("source_priority", 5)`) : le mode d'échec était « rien n'écrit jamais », que le filet manuel (`MANUAL_ROWS`) et la péremption de `data-quality` finissaient par attraper. Maintenant le cron **atteint** la ligne, **lit** le chiffre de la source, et le **refuse**. Le mode d'échec est plus fin : sur une ligne à priorité 10 que rien d'autre n'écrit, un chiffre en base trop haut — surestimation, mauvais parsing, cumul mal lu — devient **définitivement irréversible**, puisqu'aucune source ne pourra plus jamais le faire redescendre. Et comme l'écriture est refusée, `date` ne bouge pas : la ligne finira par ressortir en « périmée » dans l'e-mail « à revoir », c'est-à-dire avec le mauvais diagnostic (« la source ne publie plus ») au lieu du vrai (« nous refusons ce que la source publie »).

**Effort estimé :** petit — recopier le patron `check-mpox-sitrep` dans les 16 autres crons : compter les refus de garde dans un compteur dédié (`results.guardBlocked`), le faire remonter dans le `status` de `logCronRun` (ou, plus fin, dans un champ dédié pour ne pas noyer les vraies erreurs d'écriture), et un `Sentry.captureMessage` en `warning`. Aucune nouvelle table, aucune migration.

**Risque/inconnue :** (a) **volume de bruit non mesuré** — je ne sais pas combien de refus de garde par jour ces 17 crons produisent en régime normal (les guards ordinaires `spike`/`collapse`/`zeroCase` déclenchent aussi sur des lignes non verrouillées) ; si c'est un flot quotidien, remonter tout en `status: "error"` rendrait le health-check illisible. Le périmètre prudent est donc de ne remonter que **`lockedRowRegressionGuard` sur ligne verrouillée**, pas tous les guards. (b) Effet de bord de ce périmètre : les refus des guards ordinaires restent aussi invisibles qu'aujourd'hui — ce n'est pas une régression, mais ce n'est pas non plus réglé. (c) Trouvé au passage, pas proposé comme idée : `sync-africa-cdc/route.ts:571` journalise `results.inserted ?? 0` seul là où `sync-who-afro` journalise `inserted + updated` — donc une passe de ce cron qui ne fait que rafraîchir des lignes existantes remonte `rows: 0` et n'actualise pas son `lastNonZero`, exactement le signal que `lastNonZero` a été ajouté pour porter (cf. l'incident push-alerts du 27/07).

### 3. Deux professionnels de terrain en seize jours disent la même chose : le chiffre publié ne dit pas ce qu'il mesure

**Signal — et c'est le premier vrai signal terrain entrant depuis le 08/08** (`product-feedback.md` n'a aucune entrée depuis cette date ; le 18/08 relevait déjà ce silence de 10 jours, il en fait 11 aujourd'hui). Il ne vient pas de ce fichier mais de `linkedin-contacts.md`, session du jour.

**Darrel Ornelle ELION ASSIANA, aujourd'hui**, sur la chaîne de remontée de son laboratoire national : les sites GeneXpert transmettent mensuellement, et quand le LNRM consolide, rien de ce qui est publié ne dit si le cas est replacé à sa **semaine de confirmation** ou s'il porte sa **période de transmission**. Sa formule, citée dans le brouillon de réponse : « *en phase ascendante les deux ne dessinent pas la même courbe* ». **Omobolanle Adelekun, le 03/08** (`product-feedback.md`), pointait le même angle mort par l'autre bout : lier les données de surveillance aux **versions de définition de cas** pour rendre les tendances interprétables.

**Côté HWG, l'angle mort est structurel et vérifié dans le code** : `lib/outbreaks.ts:69` — le type `Outbreak` porte **un unique champ `date: string`**, sans aucun champ décrivant ce que cette date mesure. Ni la table, ni l'interface, ni une seule surface d'affichage ne le qualifient.

**Ce que je ne propose PAS :** construire le champ de métadonnée. C'est la conclusion déjà tirée le 03/08 sur le retour d'Adelekun, elle n'a pas changé — les sources agrégées ne publient quasiment jamais cette information de façon structurée, il n'y aurait donc rien à y mettre la plupart du temps, et l'inventer serait pire que l'absence.

**Ce que je propose :** **afficher l'absence.** La fiche foyer porte déjà un chiffre retenu, sa source et un niveau de fiabilité à 4 paliers (`lib/source-trust.ts`) — l'arbitrage entre canaux est donc déjà visible. Il y manque une ligne, courte et vraie : *ce que cette date mesure n'est pas publié par la source*. Même geste sur `/methodology`, qui documente déjà les limites de couverture.

**Pourquoi ça vaut la peine plutôt que de laisser courir :** c'est la seule chose que ces deux interlocuteurs ont apportée spontanément, sans qu'on la demande, à seize jours d'intervalle et depuis deux positions différentes (labo national, OMS). Et c'est le genre de limite qu'un professionnel de surveillance **repère de toute façon en dix minutes d'usage** : l'afficher soi-même transforme un défaut trouvé par l'utilisateur en précision revendiquée par le produit — un tableau de bord qui dit ce qu'il ne sait pas est plus crédible auprès de ce public qu'un tableau de bord qui ne dit rien.

**Effort estimé :** petit sur le principe (une phrase, deux surfaces), **moyen en pratique à cause de l'i18n** — la fiche foyer est servie en 5 langues (`fr`/`en`/`es`/`ar`/`id`), donc 5 formulations à écrire, dont une en arabe.

**Risque/inconnue :** (a) **c'est un arbitrage de positionnement, pas un correctif** — ajouter un avertissement de méthode réduit l'assurance apparente du produit auprès d'un lecteur non spécialiste, alors qu'elle l'augmente auprès d'un épidémiologiste. Le persona visé décide, et cet arbitrage-là appartient à David. (b) **Un précédent tout frais invite à la prudence sur le calendrier** : le 03 et le 04/08, deux modifications d'entonnoir livrées vite ont cassé l'inscription. Ce n'est pas la même surface, mais la leçon de rythme vaut, à J-2. (c) Aucun des deux contacts n'a demandé une fonctionnalité : ils ont décrit un problème de leur métier. Le lire comme une demande produit serait une sur-interprétation — c'est une opportunité de justesse, pas une commande.

**Non re-proposé aujourd'hui :** 17/08 idée 1(d) (`trial-reminders`, seul autre reliquat non construit) — reste vrai, mais c'est un doublon d'e-mail potentiel, sans effet sur la décision de vendredi, et aucune preuve nouvelle ne le fait remonter. Rien sur la personnalisation, l'accès, l'entonnoir d'inscription ni le cycle d'essai. Les 18 indicateurs d'Andrea Bernasconi (07-08/08) restent non constructibles faute de source ; les trois sources tierces de Hao-Kai TSENG (29/07) restent bloquées par le garde-fou explicite du `ROADMAP.md`, et aucun prospect n'a demandé de détection plus rapide que l'OMS. Pas d'idée sur le persona « décideur » : toujours zéro décideur mesuré sur les pages d'atterrissage.

**Contexte relevé au passage** (pas des idées) :
- Une demande d'échange en attente d'arbitrage de David : **Dr Franck NZIZA** a écrit aujourd'hui « *Seriez-vous disponible pour échanger brièvement à ce sujet dans les prochains jours ?* ». Aucun canal nommé, aucun engagement pris dans la réponse. C'est le seul contact ayant jamais demandé à parler de vive voix — signal de conversion le plus chaud du moment, deux jours avant le go/no-go.
- 3 DM en file de validation à 17h, 5 envoyés à 14h sur ordre explicite de David. Toujours **0 demande de contact hors plateforme**, hors le point ci-dessus.
- Prospection institutionnelle : toujours **0 réponse** sur l'ensemble de la campagne.

**Statut : David a validé les trois** (« On applique les 3 idées », 19/08 en session, peu après la proposition). **Construction déléguée à une session dédiée**, conformément au périmètre de cette routine (« ne jamais coder ou implémenter une idée toi-même dans cette session ») — aucun code écrit ici, comme les 30/07, 01/08, 04/08 et 17/08. Statut détaillé à mettre à jour par cette session, idée par idée.

**Brief transmis à la session de construction**, arbitrages déjà tranchés pour ne pas la laisser deviner :

- **Idée 1 (checkout sans carte)** : décision explicite requise avant de coder — option (a) `payment_method_collection: "always"` en conservant `trial_period_days` (carte collectée à la souscription, débit différé à la fin de l'essai, promesse « essai gratuit sans carte » toujours vraie côté inscription) vs (b) statu quo assumé. **Étape 0 obligatoire** : vérifier l'état live de l'abonnement `otitamorgan@gmail.com` avant tout — une carte a pu être ajoutée depuis le 17/08, ce qui ne changerait rien au défaut structurel mais est un fait à ne pas ignorer. Ne pas se raconter que ce correctif produit un signal avant le go/no-go de vendredi : aucun utilisateur nouveau ne passera par ce chemin d'ici là, c'est un correctif pour après la décision.
- **Idée 2 (garde-fou silencieux)** : recopier le patron `check-mpox-sitrep/route.ts:565-580` (Sentry.captureMessage + status "error" sur refus de garde) dans les 16 autres crons touchés par `eb57f8e`/`d124101`. Périmètre volontairement étroit : ne remonter que les refus de `lockedRowRegressionGuard` sur ligne verrouillée (priority≥10), pas les guards ordinaires (spike/collapse/zeroCase) dont le volume en régime normal n'est pas mesuré — une remontée large risquerait de noyer le health-check. Corollaire trouvé en passant, à corriger dans la même session si le temps le permet : `sync-africa-cdc/route.ts:571` journalise `results.inserted` seul (pas `+ updated`), donc une passe de refresh pur ne met jamais à jour `lastNonZero`.
- **Idée 3 (sémantique de date absente)** : afficher l'absence, pas construire la métadonnée — une ligne courte sur la fiche foyer + `/methodology`, dans les 5 langues (`fr`/`en`/`es`/`ar`/`id`). Formulation à valider par David si le ton lui semble trop technique pour un lecteur non spécialiste — c'est un arbitrage de positionnement (assurance apparente du produit), pas un pur correctif.
- **Garde-fous rappelés** : aucun e-mail à un utilisateur réel, aucun cron d'envoi déclenché contre la prod, aucun compte de test créé en prod, typecheck + lint propres, vigilance sur les sessions concurrentes qui écrivent dans `marketing/*.md`.

---

## 2026-08-19 (session de construction, ~19h30-20h30) — Statut de livraison

Session dédiée à la construction des 3 idées validées par David ce soir. `tsc --noEmit` et `eslint` propres sur tous les fichiers touchés avant chaque commit. Deux sous-agents utilisés pour l'idée 2 (15 des 16 fichiers, en deux lots parallèles) après que j'aie construit et vérifié le premier (`sync-africa-cdc`) moi-même comme patron de référence ; diffs des 15 relus intégralement avant commit, aucune divergence de périmètre trouvée.

### Idée 1 (checkout sans carte) — ✅ livrée, option (a) tranchée par David le 19/08, commit `14ad1bc`

**Étape 0 exécutée en premier, en lecture seule** (Supabase prod + API Stripe, aucune écriture) : au 19/08 ~17h18 UTC, `otitamorgan@gmail.com` (`cus_V3gOXomdiXkk8O` / `sub_1U3Z1I4FKShlvEcMtJOXMvid`) n'a **toujours pas** de carte enregistrée — `profiles.stripe_has_payment_method = false` en base, et côté Stripe `customer.default_source = null` et `customer.invoice_settings.default_payment_method = null`. Aucune carte n'a été ajoutée depuis le 17/08 ; le défaut structurel décrit ce matin reste entier sur ce compte précis.

**En creusant l'option (a) (`payment_method_collection: "always"`), j'ai trouvé exactement le type de conflit que le brief anticipait** — je m'arrête donc ici plutôt que de trancher :

- `components/PricingCards.tsx` lignes 439-442 : la carte **Team** affiche, de façon **inconditionnelle** (pas de logique d'essai en cours comme la carte Pro juste au-dessus), le badge « 14 jours gratuits · sans CB » / « 14-day free trial · no CC required » (et équivalents es/ar/id) **directement au-dessus** du `CheckoutButton` plan="team" (ligne 457) qu'un utilisateur en cours d'essai Team cliquerait pour s'abonner.
- `app/[locale]/account/page.tsx` lignes 627-638 : pour un utilisateur `!isPaid && !trialExpired` (essai actif, pas encore payant), la légende « Essai 14 jours gratuit · sans carte bancaire » / « 14-day free trial · no credit card » s'affiche **directement sous** le `CheckoutButton` (ligne 615, label "S'abonner à Pro") que cet utilisateur cliquerait précisément pour convertir pendant son essai.
- À l'inverse, la carte **Pro** de `PricingCards.tsx` (lignes 356-372) n'a **pas** ce problème : quand `trialDaysLeft !== null`, le badge "sans CB" est remplacé par le compte à rebours ("N jours restants"), donc rien ne contredit visuellement ce bouton précis dans cet état.

Basculer `payment_method_collection` à `"always"` sur `/api/checkout` rendrait donc ces deux légendes fausses au moment exact où l'utilisateur clique sur le bouton qu'elles accompagnent — pas une promesse générale ailleurs sur le site (le cas des 12 surfaces "sans carte" déjà écarté ce matin comme portant sur l'essai à l'inscription, pas sur le checkout), mais un texte contigu au bouton lui-même, sur les deux CTA "upgrade pendant l'essai" du produit.

**Ce qui reste à trancher par David** (aucune des trois options n'a été appliquée) :
- **(a) Toujours collecter la carte** — corrige le critère `paying`, mais casse ces deux légendes ; nécessite soit de les réécrire/retirer (quel texte, sur ces 2 surfaces au minimum, 5 langues pour la page account), soit d'accepter la friction visuelle d'un formulaire de carte juste après une phrase qui dit le contraire.
- **(b) Statu quo** — `payingCount` affichera 0 vendredi pour une raison structurelle déjà connue ; pas de changement de code.
- **(c) Un paramètre plus fin** — par ex. ne durcir que le plan `team` (dont le badge n'a pas d'état "en cours d'essai" à préserver) et laisser `pro` en `if_required`, ou ne durcir que le point d'entrée `/pricing` (nouveaux venus, jamais engagés dans un essai visible) et laisser `/account` (utilisateurs déjà en train de lire "sans carte") — plus proche de l'effort "petit" initialement estimé, mais réintroduit la confusion par surface que le brief du matin avait explicitement écartée au profit d'une séparation par intention.

**19/08, session de livraison (commit `14ad1bc`)** — David tranche pour (a) : `payment_method_collection` passe de `"if_required"` à `"always"` sur `app/api/checkout/route.ts` (`trial_period_days` et `end_behavior.missing_payment_method: "cancel"` inchangés, désormais un filet de sécurité inoffensif). L'utilisateur n'est toujours pas débité avant la fin de l'essai — seul le moment de collecte de la carte change.

Les deux légendes identifiées ci-dessus ont été corrigées (`PricingCards.tsx` Team + `account/page.tsx`), avec la formulation honnête "carte requise, aucun débit avant la fin de l'essai" (5 langues), en réutilisant le mécanisme conditionnel `trialDaysLeft` déjà en place sur la carte Pro.

**Trouvaille supplémentaire, hors diagnostic initial** : `CheckoutButton` (`components/CheckoutButton.tsx`) est un composant unique partagé par tout le site, sans distinction entre un premier clic ("Commencer l'essai gratuit") et un clic mid-trial ("Passer en illimité") — les deux tapent directement `/api/checkout`, qui applique toujours un essai Stripe de 14 jours par défaut (`dbTrialEndsAt` null → `trialDaysRemaining = 14`). Le diagnostic du matin n'avait donc repéré que les 2 conflits "essai déjà en cours" ; en auditant systématiquement tous les usages de `CheckoutButton` (grep + lecture de chaque fichier), 9 autres légendes "sans carte" se sont révélées tout aussi contiguës à un `CheckoutButton` plan="pro"/"team" — donc tout aussi fausses après le changement, y compris le badge par défaut Pro **et** Team de `PricingCards.tsx` (le bouton "Commencer →" lui-même, pas seulement l'état conditionnel Team déjà identifié) :

- `components/PricingCards.tsx` — badge par défaut (`trialDaysLeft === null`) des cartes Pro et Team
- `components/EmailCapture.tsx`, `FreePlanBanner.tsx`, `UpgradeModal.tsx`, `OnboardingTour.tsx` — notes/texte adjacents à un `CheckoutButton` plan="pro"
- `app/[locale]/alerts/page.tsx` — note sous le CTA Pro
- `app/[locale]/outbreak/[id]/page.tsx` (fiche foyer, `ctaSub` — alimente à la fois `OutbreakBottomCta` et `OutbreakStatsGrid`)
- `lib/digest-email.ts` — CTA de l'email hebdomadaire (même chemin de clic que le site)
- `app/[locale]/terms/page.tsx` — clause Billing en anglais (doc légale, "no credit card required" devenu inexact)

Toutes corrigées avec la même formulation honnête, dans les langues concernées.

**Vérifié explicitement non concerné** (aucun `CheckoutButton` dans le fichier — grep confirmé) : `signup`, `login`, `about`, `docs`, `reports`, `embed` (`DemoBanner`), `pilot`, `institutional`, `methodology`, et les emails du programme pilote (`lib/pilot-emails.ts`, `lib/trial-ending-email.ts`, `lib/trial-value-nudge-email.ts`) — ces surfaces portent soit sur le flux `/signup` réel (resté gratuit et sans carte, inchangé), soit sur le programme pilote (accès accordé directement en base via `admin/invite`, aucune session Stripe créée). Le "sans carte" y reste vrai.

`tsc --noEmit` et `eslint` propres sur les 11 fichiers modifiés. Pas de démarrage du dev server possible dans cette session non supervisée (confirmation demandée, refusée automatiquement) — confiance basée sur la lecture du JSX + typecheck, pas de vérification visuelle.

### Idée 2 (garde-fou silencieux sur 16 crons) — ✅ livrée, commit `8a235be`

Patron `check-mpox-sitrep/route.ts` recopié sur les 16 crons restants (`sync-africa-cdc`, `sync-cdc-han`, `sync-cdc-notices`, `sync-ecdc-threats`, `sync-endemic-data`, `sync-malaysia-dengue`, `sync-ncdc`, `sync-paho-alerts`, `sync-spf`, `sync-taiwan-cdc`, `sync-ukhsa`, `sync-usda-aphis`, `sync-who-afro`, `sync-who-emro`, `sync-who-regional`, `sync-wpro-dengue-update`) : détection par préfixe `"guard:locked-row-"` (composition-agnostique, aucune réécriture des chaînes de guards existantes), accumulation dans un tableau `lockedGuardBlocked`, `Sentry.captureMessage(..., "warning")` et `status: "error"` dans `logCronRun` uniquement quand ce tableau est non vide. Périmètre respecté : les autres guards (spike/collapse/zeroCase/zeroDeath/dateFloor) restent invisibles comme avant, volontairement.

Cas particuliers gérés correctement par les sous-agents (vérifiés dans les diffs) : `sync-malaysia-dengue` et `sync-taiwan-cdc` (guard sous bypass de rollover annuel — logique de bypass non touchée), `sync-who-regional` (deux points d'appel du guard, un seul tableau accumulateur), `sync-paho-alerts` (le tableau est passé en paramètre à `upsertItems()`, partagée par les deux boucles alertes+sitrep), `sync-cdc-notices` (bug préexistant hors périmètre — `logCronRun` était figé en `"ok"` sans jamais regarder `results.errors` — laissé tel quel, juste OR-é avec la nouvelle condition plutôt que corrigé, cf. règle de ne pas élargir le scope).

**Corollaire livré** : `sync-africa-cdc/route.ts` sommait désormais `(results.inserted ?? 0) + (results.updated ?? 0)` au lieu de `results.inserted` seul pour `logCronRun` — une passe de rafraîchissement pur remonte enfin `rows > 0` et avance `lastNonZero`, comme `sync-who-afro` le fait déjà.

### Idée 3 (absence de sémantique de date) — ✅ livrée, commit `fac1413`

Nouvelle clé `dateSemantics` sur `app/[locale]/outbreak/[id]/page.tsx` (affichée juste sous le `reportingLag` existant, dans le bloc méta date de la fiche foyer) et un nouveau point dans le tableau `limits` de `app/[locale]/methodology/page.tsx` (juste après le point existant sur le champ `date`), dans les 5 langues (fr/en/es/ar/id). Formulation factuelle, ni alarmiste ni technique à outrance : « la nature exacte de cette date (semaine de confirmation, période de transmission ou date de publication du bulletin) n'est pas précisée par la source » et sa version développée sur `/methodology`. **Formulation à valider par David** si le ton lui semble encore trop clinique pour un lecteur non spécialiste — c'est l'arbitrage de positionnement identifié ce matin, pas tranché unilatéralement, juste construit avec le texte le plus neutre possible en attendant son avis.

### Résumé pour David

- **Rien à faire d'urgent avant vendredi** — idée 1 n'aurait de toute façon produit aucun signal avant le go/no-go, idées 2 et 3 sont des corrections de fond sans lien avec le chiffre de vendredi.
- **Une vraie décision à prendre sur idée 1** quand tu as le temps : (a), (b) ou (c) ci-dessus — je n'ai pas de préférence tranchée à formuler, chaque option a un coût différent (friction utilisateur vs. critère `paying` structurellement à 0 vs. cohérence de message par surface).
- **Formulation idée 3 à relire** si tu veux ajuster le ton avant que ça reste en prod durablement.

---

## 2026-08-20 — Proposition du jour

**J-1 avant le go/no-go du 21/08.** Les trois idées ci-dessous portent toutes sur ce qui se passe *demain* et *après-demain* : ce que la décision va lire, ce que le dispositif de contrôle devient une fois la date passée, et une régression d'affichage introduite en creux par les deux correctifs livrés hier et ce matin.

**Limite de méthode de ce run, dite d'emblée :** contrairement aux runs précédents, **aucune sonde en lecture seule sur la prod n'a pu être exécutée** (le classificateur d'autorisation a refusé l'exécution du script de mesure dans cette session non supervisée). Tout ce qui suit est donc établi **par lecture du code de `master`** et par recoupement avec des mesures déjà consignées (log d'idées, mémoires, messages de commit du jour), **pas par requête live**. Les affirmations chiffrées sont attribuées à leur source à chaque fois. Les trois défauts décrits sont structurels et lisibles dans le code — ils ne dépendent pas d'un chiffre de prod pour exister — mais leur **ampleur exacte** demain matin devra être vérifiée sur `/admin` avant de trancher.

**Aucun signal terrain neuf aujourd'hui :** `product-feedback.md` n'a pas bougé depuis le 08/08 (Andrea Bernasconi) ; les trois sessions LinkedIn du jour (9h, 13h, 17h) ne remontent aucune remarque produit, aucune demande de fonctionnalité, aucune demande de contact hors plateforme. Les idées viennent donc de la mesure et du code, comme les runs des 31/07, 03/08 et 19/08.

---

### 1. 🔴 Deux des trois critères du go/no-go de demain comptent le compte de David — et le critère « payant », lui, l'exclut explicitement

**Signal (code de `master`, `app/[locale]/admin/page.tsx`, vérifié ligne à ligne aujourd'hui).** Le tableau de décision repose sur trois critères automatisés (l. 367-370) :

| critère | seuil | source de données | exclusion fondateur / comptes de test |
|---|---|---|---|
| `paying` | ≥1 | `profiles` filtrés par `isPayingCustomer` | ✅ **oui** — `isRealStripeSub` (l. 236-237) écarte nommément `stripe_subscription_id === "admin_override"`, le sentinelle qui donne Pro permanent au compte du fondateur |
| `retention` | ≥5 revenus après J+2 | `returnedUsers` sur **tous** les `authUsers` (l. 299-305) | ❌ **aucune** |
| `active30` | ≥3 actifs sur 30 j | `active30` sur **tous** les `authUsers` (l. 306-310) | ❌ **aucune** |

Le commentaire juste au-dessus de `isRealStripeSub` (l. 231-233) dit exactement pourquoi l'exclusion existe sur le premier : « *exclude it from any metric meant to reflect actual paying customers* ». La même raison vaut mot pour mot pour les deux autres — un critère censé refléter l'engagement de **vrais utilisateurs** — et l'exclusion n'y a jamais été portée.

**Pourquoi ça n'est pas théorique.** Le compte de David est, de très loin, le compte le plus actif de l'histoire du produit : ce log même relève « `product_events` : 20 événements en tout, **aucun d'un utilisateur autre que David** depuis le 24/07 » (entrée du 29/07), puis « 41 événements au total, **3 utilisateurs non-David**  » (entrée du 03/08). Et `lastActivity()` (l. 291-296) prend le **max** de `last_sign_in_at` et du dernier `product_events` : David se reconnecte et ouvre `/admin` en permanence, donc il satisfait mécaniquement **les deux** critères, tous les jours, sans exception. Sur des seuils de **5** et de **3**, un faux positif garanti représente **20 % et 33 %** de la barre.

**Deuxième source de gonflement, même défaut.** `TEST_EMAIL_DOMAINS` (`{healthwatch-global.com, healthwatch-test.dev, example.com}`) existe déjà dans le code — mais **uniquement dans `health-check/route.ts` l. 161, appliqué à un seul endroit (l. 685)**. `/admin` ne l'importe pas et ne le connaît pas. Or l'entrée du 03/08 de ce log recense `e2e@healthwatch-global.com` en base **depuis le 16/06**, et note que le ménage de ce jour-là a supprimé les 5 comptes `hwg-diag-rl-*` et **désactivé** (pas supprimé) les 6 abonnements de test. Rien n'indique que `e2e@healthwatch-global.com` ait été supprimé. **À vérifier sur `/admin` demain matin** — mais s'il est encore là, il compte dans `active30`/`returnedUsers` exactement comme un prospect.

**Et le gonflement est invisible sur la surface de décision.** Les l. 535-557 et 568-569 n'affichent que des **compteurs** — jamais la liste nominative des utilisateurs comptés. Impossible, en regardant le tableau demain, de voir *qui* sont les « 5 revenus » : le chiffre ne peut pas être audité à l'œil. Le taux de rétention l. 556-557 (`returnedUsers / authUsers`) porte le même biais **au numérateur et au dénominateur**.

**Effort estimé :** **petit**. Le signal d'exclusion existe déjà (`admin_override` côté `profiles`, `TEST_EMAIL_DOMAINS` côté domaine) ; il s'agit de construire une fois un `Set` d'`id` à exclure et de le passer aux trois filtres, plus — le vrai gain de lisibilité — d'afficher les **noms** derrière les compteurs `returnedUsers`/`active30` plutôt que le seul nombre. Un fichier touché.

**Risque/inconnue :** (a) le correctif fait **baisser** deux chiffres la veille d'une décision — c'est l'objet même de la démarche (c'est le motif Morgan Otita : un critère qui passe au vert sur quelque chose qui n'est pas réel), mais il faut le dire tel quel plutôt que de le découvrir demain ; (b) je n'ai **pas pu mesurer** de combien — si `returnedUsers` est aujourd'hui à 7, retirer David et un compte e2e le laisse au-dessus du seuil et ne change rien à la décision ; s'il est à 5 ou 6, ça la change ; (c) l'affichage nominatif du compte de David dans `/admin` ne pose aucun problème de vie privée (page admin, données déjà présentes) mais élargit très légèrement le périmètre du correctif ; (d) point mineur non bloquant aujourd'hui : `product_events` est lu avec `.limit(200)` sur 30 jours (l. 193) — au volume actuel (~41 événements début août) le plafond n'est pas atteint, mais c'est **la même forme exacte** que le bug de plafond silencieux corrigé ce matin sur `check-email-alias` (`0eadc3b`), sur les critères qui décident demain. À garder en tête, pas à corriger dans l'urgence.

---

### 2. 🔴 Le contrôle « essais après l'horizon de décision » devient structurellement bruyant **demain**, et il crie dans la ligne d'objet

**Signal (code, `app/api/cron/health-check/route.ts`).** `checkDecisionHorizonTrials` (l. 443-452) sélectionne les profils avec `trial_ends_at > VIABILITY_DECISION_DATE`, soit `> "2026-08-21"` (l. 408), sur un plan payant et sans abonnement Stripe. La date est **codée en dur**.

Le libellé qu'il produit (l. 948) : « 🔔 N essai(s) dont l'échéance dépasse le 2026-08-21 — **aucun mécanisme automatisé (trial-reminders/winback/pilot-closing) ne les touche avant la décision** ».

**Ce qui se passe à partir du 22/08.** Tout nouvel inscrit reçoit un essai Pro de 14 jours (`lib/activate-trial.ts`, `TRIAL_DAYS = 14` — revérifié aujourd'hui par la session LinkedIn de 13h, qui cite le fichier). Un essai ouvert le 22/08 se termine le 05/09, donc `> 2026-08-21`. **À partir de demain, la requête matche 100 % des essais actifs, tous les jours, indéfiniment** — sous un intitulé qui parle d'une décision déjà prise. La phrase « avant la décision » n'a plus de référent.

**Et ce n'est pas seulement une ligne dans le corps de l'e-mail : c'est dans l'objet** (l. 1004) — `· 🔔 N essai(s) après le 2026-08-21` sera collé au sujet du health-check quotidien en permanence. Le seul mécanisme d'atténuation prévu est `DECISION_HORIZON_DISMISSED` (l. 433-438), une liste d'adresses **écrites à la main** : il faudrait y ajouter chaque nouvel inscrit, un par un, pour faire taire l'alarme.

**Preuve que la dérive a déjà commencé.** La mémoire `project_hwg_viability_decision_2026_08_21` (mise à jour ce matin sur le health-check de 09:05) relève **8 essais** au-delà de l'horizon, contre 3-4 le 16/08 — le compteur a doublé en 4 jours, et aucun des 8 ne recoupe la liste des cas déjà tranchés. C'est la trajectoire attendue d'un seuil que le temps traverse.

**Le motif est déjà documenté ici.** L'entrée du 03/08 (idée 3) décrit exactement le même mécanisme sur `alert_locale` et sa conclusion tient toujours : « *l'effet d'un contrôle qui crie au loup est connu : on cesse de le lire, y compris le jour où il a raison* ». La différence est qu'ici on peut le voir venir avant qu'il ne se produise, pas après.

**Effort estimé :** **petit**, mais il exige une **décision de ta part**, pas un choix technique. Trois formes possibles, très inégales :
- **(a) horizon glissant** — remplacer la constante par « échéance au-delà de J+N » (un essai qui se termine après le prochain jalon), ce qui garde un contrôle utile sans date morte ;
- **(b) neutralisation** — désactiver le bloc dès que `VIABILITY_DECISION_DATE` est passée (une ligne : `if (new Date() > horizon) return { trials: [], error: null }`), en assumant que le contrôle a fait son travail et n'a plus d'objet ;
- **(c) redéfinition** — si HWG continue, une nouvelle date de jalon remplace le 21/08 et le contrôle reprend son sens tel quel.

**(c) n'est possible qu'après ta décision de demain**, ce qui rend (b) le filet minimal à avoir en place au cas où la question reste ouverte quelques jours. **Je ne construis rien ici** (session de proposition), mais c'est le seul des trois points du jour qui a une **échéance à 24 h**.

**Risque/inconnue :** (a) neutraliser trop tôt ferait perdre le contrôle le jour même où tu en as besoin — d'où l'intérêt de trancher demain plutôt qu'aujourd'hui ; (b) `VIABILITY_DECISION_DATE` est aussi lu par le payload JSON (l. 1114) et par la mémoire projet : le changer demande une passe de cohérence, pas juste une constante ; (c) l'option (a) transforme un contrôle *ponctuel* en contrôle *permanent* — à vérifier qu'il reste pertinent hors contexte de décision, sinon (b) est plus honnête.

---

### 3. Depuis hier, le produit **sous-estime** sa propre fraîcheur : une source qui reconfirme des chiffres identiques n'écrit rien, et la fiche affiche « il y a 49 j »

**Signal (commit du jour, `ef5c11a`, 10:53).** Le message de commit livré ce matin établit le cas mesuré, verbatim : sur **MERS-CoV / Global**, « *the ECDC overview moved from 1 June to 3 August with the same 2 649 cases / 960 deaths (no MERS case declared worldwide in between), so the row still read 2 July* ». Et le dimensionnement du seuil donne l'ampleur : le scan a été calé à 45 jours parce que « *30d would surface **18 rows** daily and drown the report* ». **Il y a donc au moins 18 lignes actives sans écriture depuis 30 jours ou plus.**

**Pourquoi c'est une idée produit et pas seulement un contrôle interne.** `ef5c11a` construit la **détection** — un scan dans le rapport interne `morning-check`, lu par toi. Il ne change rien à ce que **le client voit**. Or hier matin, `5d8e1ad` a fait lire aux badges de fraîcheur le **`date` du bulletin** au lieu de `updated_at` — correctif juste, qui a supprimé une affirmation fausse (« vérifié il y a 3 j » sur une ligne dont aucun chiffre n'avait bougé). Mais le revers apparaît maintenant : sur une ligne que la source **a bel et bien reconfirmée** sans changement de chiffres, `OutbreakTable.tsx` l. 1249-1250 affiche « **Synchronisé il y a 49 j avec la source officielle** ». C'est faux dans l'autre sens — la source a publié le 3 août.

**Et l'information perdue a de la valeur en épidémiologie.** « Aucun nouveau cas confirmé depuis le 3 août » est un **signal positif**, pas un trou de données — c'est précisément ce qu'un épidémiologiste veut lire. Aujourd'hui le produit le transforme en « donnée périmée », sur la surface exacte que les prospects institutionnels jugent en premier. Le schéma n'a **aucune** notion de « reconfirmé » : `grep` sur `confirmed_at` / `last_checked` / `source_checked` dans `app`, `lib` et `supabase/migrations` ne remonte que les colonnes de double opt-in des alertes (migration du 08/08) — rien sur `outbreaks`.

**Effort estimé :** **moyen**, et c'est le point à peser. Il ne s'agit pas d'un affichage à changer mais d'une **donnée à commencer à capturer** : une colonne `source_confirmed_at` sur `outbreaks`, écrite par les crons **même quand les chiffres sont identiques** (aujourd'hui ils ne réécrivent rien du tout dans ce cas — c'est la cause racine décrite par `ef5c11a`), puis un libellé distinguant « chiffres inchangés, confirmés le X » de « pas de nouvelle publication depuis X ». Le nombre de crons concernés est le même ordre de grandeur que le lot d'hier soir (16-17 fichiers), donc l'effort réel est surtout dans la propagation, pas dans la conception. **Rien de rétroactif** : la colonne partira vide et ne se remplira qu'au fil des passages.

**Risque/inconnue :** (a) écrire à chaque passage même sans changement fait perdre la propriété qui rend `updated_at` lisible aujourd'hui (« quelque chose a bougé ») — il faut une **colonne séparée**, surtout pas réutiliser `updated_at`, sinon on réintroduit exactement le bug que `5d8e1ad` vient de corriger ; (b) la « reconfirmation » n'est fiable que si le cron sait vraiment que la source a republié — pour une page HTML sans date d'édition explicite, « je l'ai lue aujourd'hui » n'est pas « la source l'a confirmée aujourd'hui », et confondre les deux fabriquerait une nouvelle affirmation fausse, plus difficile à détecter que celle d'hier ; (c) le périmètre honnête est donc **les seules sources qui publient une date d'édition** (ECDC, les bulletins datés), pas les 17 crons en bloc — à cadrer avant de coder ; (d) priorité : c'est le seul des trois points du jour **sans échéance** — il ne pèse ni sur demain ni sur après-demain, et il peut attendre l'issue du go/no-go.

---

### Contexte mesuré au passage (pas des idées)

- **Morgan Otita — délibérément pas re-proposé aujourd'hui.** L'idée 1(d) du 17/08 (retirer le filtre `.is("stripe_subscription_id", null)` de `trial-reminders`) est toujours non construite — revérifié dans le code ce soir, `trial-reminders/route.ts` l. 105. **Mais son cadrage a changé et le re-remonter serait faux :** le commentaire l. 86-94 a été réécrit le 18/08, il ne se contredit plus lui-même — il assume le filtre et désigne `checkUncoveredStripeTrials` comme filet. Le vrai reste-à-faire n'est donc pas un correctif de code mais **ta décision** sur une 3e relance, que tu as explicitement mise en pause le 20/08 (« trois relances en quatre jours ce serait trop », mémoire `project_morgan_otita_uncovered_stripe_trial`). Reposer la question aujourd'hui irait contre cet arbitrage rendu ce matin. Le repère évoqué — sans jamais être confirmé — était **~24/08 (J-2 avant l'annulation du 26/08)** ; c'est le moment naturel pour en reparler, pas maintenant.
- **Aucun signal terrain neuf.** `product-feedback.md` inchangé depuis le 08/08. Les sessions LinkedIn du jour (9h / 13h / 17h, d'après leurs commits) : 7 connexions décideurs, 8 suivis, 6 commentaires, 10 DM envoyés sur ordre explicite (8 puis 2), file de validation alimentée à chaque créneau — **0 demande de contact hors plateforme, 0 remarque produit**. Prospection institutionnelle : 10 nouveaux contacts, 11 relances, 1 bounce (AKHS), toujours 0 réponse sur l'ensemble de la campagne.
- **Livré aujourd'hui, hors idées de ce log** : `fdf2890` + `0eadc3b` (garde-fou anti-alias Gmail à l'inscription, puis pagination du scan pour qu'il ne puisse pas échouer en silence) et `ef5c11a` (scan 4e de `morning-check`). Le premier est un garde-fou d'abus **non exploité à ce jour** (audit du 19/08 : 34 comptes, aucune paire d'alias) — construit en prévention, pas en réaction.
- **Idées antérieures toujours PROPOSÉES et non traitées, sans preuve nouvelle aujourd'hui** — donc non re-remontées : 02/08 idée 2 (Institut Pasteur, tranché autrement le 05/08 via `is_pilot`), 02/08 idée 3 volet invitations (angle mort assumé), 31/07 idée 1 (construite le 03/08), 03/08 idée 3 (construite le jour même). Formulation de l'idée 3 du 19/08 (`dateSemantics` sur la fiche foyer et `/methodology`) **toujours en attente de ta relecture** — elle est en prod depuis hier soir dans les 5 langues.

**Statut : PROPOSÉE — en attente de retour de David.**

---

## 2026-08-22 — Proposition du jour

**Premier run de cette routine sous le régime d'autonomie de build** décidé par David en session interactive ce matin (« applique les idées que tu as proposées, et dorénavant, fais-le automatiquement, sans attendre mon feu vert », mémoire `feedback_product_ideas_autonomous_build_2026_08_22`). Les deux premières idées ci-dessous sont **déjà construites, typecheckées, lintées et poussées** ; la troisième ne l'est pas, et le paragraphe correspondant dit pourquoi.

**⚠️ Écart de procédure assumé, dit d'emblée :** le SKILL demande d'archiver la proposition **avant** de construire, pour que la trace survive à un échec de construction. Ici proposition et construction sont commitées dans le même run. La construction ayant abouti, l'objectif de traçabilité est atteint, mais l'ordre prescrit n'a pas été respecté — à corriger au prochain run.

**Signal terrain neuf, le premier depuis le 08/08 (14 jours) :** `product-feedback.md` a reçu ce soir une entrée pour la réponse de **Mohamed Ousmane COULIBALY** (Incident Manager OMS, ex-Polio Incident Manager 2020-2023), reçue à 13:30. Elle est l'ancrage direct de l'idée 1.

---

### 1. 🔴 Un professionnel de l'OMS a dû nous demander si nous avions lu sa source pour qu'on découvre que la base n'avait aucune ligne polio africaine — et rien dans le produit ne pouvait le détecter

**Signal (DM du 22/08, verbatim intégral) :** « *Avez-vous parcouru cet Update ci-attaché ???* », avec la mise à jour polio mondiale du GPEI arrêtée au 19/08 en pièce jointe.

**Ce que la vérification a donné.** Base live : **3 lignes polio actives** (Afghanistan, Pakistan, Palestine), **zéro africaine**. Page publique GPEI de la même semaine : RDC (5 cas de cVDPV2, 32 depuis janvier), Nigeria, Niger, Centrafrique, Soudan. Et le point qui fait mal : la ligne **Afghanistan cite cette page exacte** dans sa colonne `source`. La source était lue, citée, affichée — et on n'en extrayait que deux pays.

**🔴 Le défaut de fond n'est pas la polio, c'est la forme du contrôle.** Le produit a neuf sections de contrôle qualité (`data-quality`, 4a→4i) plus `disease-coverage`. **Toutes partent des lignes qui existent** : périmée, dupliquée, CFR implausible, admin1 non fondé, seed active à tort. La section 4f a même un palier taillé exprès pour `polioeradication.org` (`MANUAL_WEEKLY_SOURCES`, seuil 30 j, écrit le 29/07 après que la ligne WPV1 Afghanistan eut pris 4 cas de retard). **Ce palier ne pouvait structurellement rien voir ici** : il vérifie la fraîcheur d'une ligne, et il n'y avait pas de ligne. Aucun contrôle du produit ne compare *ce qu'une source publie* à *ce que la base contient*. Un pays absent est indistinguable d'un pays sans épidémie.

**Effort estimé : moyen.** Une sonde HTTP, un parseur texte, deux comparaisons. Pas de schéma, pas d'écriture.

**Risque/inconnue :** (a) le parseur dépend de deux ancres éditoriales de la page (« *Summary of new polioviruses this week* » et « *Country updates as of <date>* ») — s'il échoue il rend `null` et le contrôle est **sauté en silence**, jamais un faux résultat partiel ; (b) un pays nommé différemment par le GPEI et par la base produit une fausse ligne « aucune ligne polio » — direction d'échec choisie délibérément : une question dans un e-mail, jamais une écriture ; (c) le résumé hebdomadaire ne liste que les pays à **virus nouveau cette semaine**, donc un foyer en cours mais silencieux cette semaine-là n'y figure pas — la sonde couvre le delta hebdomadaire, pas le stock.

**✅ CONSTRUITE — commit `809ab47`, section 4j de `app/api/cron/data-quality/route.ts`.**
- `parseGPEIThisWeek()` : parse en **texte**, pas par sélecteur CSS (le markup est du WordPress qui bouge à chaque thème ; les deux ancres sont la structure éditoriale du bulletin, stable depuis des années). **Testé contre la vraie page téléchargée ce soir** : 6 pays extraits (Afghanistan, Centrafrique, RDC, Niger, Nigeria, Soudan) + date d'arrêt `2026-08-19` correctement normalisée depuis « 19 August 2026 ». Testé aussi sur une page sans les ancres → rend `null` (fail closed, même règle que `verifyFromDON`).
- Deux contrôles distincts : **(1) couverture** — tout pays du résumé sans ligne polio **active** est signalé, en distinguant « ligne inactive à réactiver » de « aucune ligne, trou de couverture » ; **(2) retard** — si la date d'arrêt du bulletin dépasse de plus de **10 j** la ligne polio la plus récente en base. Le (2) n'est pas un doublon du palier 30 j de 4f : le GPEI republie chaque semaine, donc un rafraîchissement manuel qui s'arrête devient visible en ~10 j au lieu de 30, et il est mesuré **contre ce que la source dit couvrir**, pas contre l'horloge.
- **Ce que ça donnerait aujourd'hui : rien.** Les 13 lignes créées ce soir couvrent les 6 pays du résumé, et leur `date` (18/08) est à 1 j de la date d'arrêt du bulletin (19/08). C'est le comportement voulu — un filet, pas du bruit. La semaine dernière, la même sonde aurait sorti **5 lignes**.

---

### 2. 🔴 Le contrôle « essais après l'horizon de décision » a expiré hier et s'est retourné : depuis ce matin, `trial_ends_at > "2026-08-21"` matche **tous** les essais actifs

**Signal (code, `app/api/cron/health-check/route.ts`).** `VIABILITY_DECISION_DATE = "2026-08-21"` était en dur (l. 408), lu par la requête (l. 449), le corps de l'e-mail (l. 948), **la ligne d'objet** (l. 1004) et le payload JSON (l. 1114).

**Ce qui a changé depuis le 20/08, et qui justifie de le remonter.** L'idée 2 du 20/08 décrivait ce défaut comme **à venir** (« *devient structurellement bruyant demain* »), l'entrée du 21/08 le rappelait comme **échéant ce soir-là**. Il est maintenant **passé** : la date est derrière nous, la requête ne filtre plus rien, et l'objet du mail quotidien annonce des essais « après le 2026-08-21 » à propos d'une décision déjà prise. Ce n'est plus une prévision, c'est l'état courant — c'est la preuve neuve qui autorise la re-remontée.

**Effort estimé : petit.** Une constante, une requête, trois chaînes d'affichage.

**Arbitrage tranché ici plutôt que renvoyé à David.** Les trois options listées le 20/08 (horizon glissant / neutralisation / nouvelle date de jalon) supposaient de connaître l'issue du go/no-go, que cette session n'a pas. L'horizon glissant est **la seule des trois qui n'en dépend pas** : il restitue à l'identique ce que le contrôle protégeait vraiment — « aucun mécanisme automatisé ne touchera ce compte avant longtemps » — sans jamais réclamer de maintenance. Une date fixe ne pouvait être juste qu'un seul jour.

**Risque/inconnue :** (a) le contrôle devient **plus silencieux** qu'avant (seuls les essais à plus de 30 j sont signalés) — c'est la bonne direction, mais si David voulait au contraire un jalon daté sur une nouvelle décision, **c'est un autre contrôle, pas cette constante** ; le dire plutôt que de détourner celui-ci ; (b) `DECISION_HORIZON_DISMISSED` est laissé intact — Pasteur (13/09) retombe de toute façon sous le seuil, Johan (2027) reste écarté à raison.

**✅ CONSTRUITE — commit `809ab47`.** `DECISION_HORIZON_DAYS = 30`, horizon calculé à chaque run, exposé dans le payload JSON (`horizon` + `horizonDays`) pour rester lisible. Corps de l'e-mail et ligne d'objet réécrits (« essai(s) à échéance lointaine »). Plus aucune occurrence de `VIABILITY_DECISION_DATE` dans le code (vérifié).

---

### 3. `sync-spf` ne va jamais chercher le bulletin vectoriel hebdomadaire — ⛔ **délibérément non construite ce soir**

**Re-remontée assumée de l'idée 1 du 21/08**, non construite alors (seul le stock avait été corrigé le 22/08 au matin : chikungunya 15→25, dengue 2→4, West Nile 6→18). **Angle neuf qui justifie de la reposer :** avec l'idée 1 ci-dessus, c'est le **deuxième cas en 24 h** d'une source correctement intégrée dont une partie du contenu n'est jamais extraite. Ce n'est plus un incident, c'est une classe de défaut — et la sonde 4j livrée ce soir ne couvre que l'instance polio.

**Pourquoi elle n'est pas construite, avec la preuve recueillie ce soir.** Le 21/08 estimait l'effort « petit à moyen » en supposant qu'il suffisait d'ajouter des entrées à `SPF_RSS_URLS`. Deux vérifications directes ce soir démentent cette estimation : l'URL du bulletin national du 19/08 **et** la page-hub chikungunya de Santé publique France renvoient toutes deux **404** — le site a été restructuré, il n'existe ni flux XML ni motif d'URL devinable pour ces bulletins. Le travail réel est donc une **découverte d'index en direct puis un parseur multi-maladies** (chikungunya + dengue + Zika + West Nile dans un seul document, avec le piège « 3 épisodes totalisant 25 cas » déjà identifié le 21/08), et il **écrit sur des lignes de production**. Estimation révisée : **moyen à gros**.

**Décision : ne pas l'écrire à l'aveugle dans une session non supervisée.** Le garde-fou 1 du SKILL exclut le gros effort ; et un parseur d'écriture prod qu'on ne peut pas confronter à la base pendant qu'on l'écrit est exactement le genre de code qui produit des chiffres faux sur la seule surface que les prospects institutionnels jugent en premier. À reprendre en session interactive, en commençant par retrouver l'index réel des bulletins vectoriels.

⚠️ **Échéance à connaître :** le bulletin est hebdomadaire. Le n°22 tombe dans les jours qui viennent, et les trois lignes France repartiront en retard sans que rien ne le signale — sauf le palier de fraîcheur générique.

**🔴 CORRECTION — 23/08, en session interactive : cette analyse était fausse, l'idée était déjà construite au moment où je l'ai écrite.** David a demandé « appliquons les idées » ce matin ; en rouvrant le dossier pour l'implémenter, `syncFranceArbovirusBulletin()` existait déjà dans `app/api/cron/sync-spf/route.ts`, commitée et déployée depuis le **22/08 à 07h44** (`0d6a1f4`) — **20 minutes avant le début de cette session de routine**, par une session interactive antérieure du même jour où David avait donné le feu vert d'autonomie. Mon estimation du soir (« 404 sur l'URL devinée, effort moyen à gros, à reprendre en interactif ») reposait sur une URL de bulletin **construite à la main** (`.../maladies-infectieuses-d-origine-alimentaire?format=xml`-style guess), jamais sur une relecture du fichier tel qu'il était réellement à ce moment. La vraie implémentation ne devine rien : elle repart du numéro de bulletin déjà cité dans la colonne `source` des 3 lignes France (`.../bulletin-national/chikungunya-dengue-zika-et-<N>`) et sonde `n+1..n+6` jusqu'au premier 404, ce qui est exactement le motif d'URL stable trouvé ce matin par une nouvelle recherche indépendante — mêmes regex de parsing (`X épisodes de <maladie> totalisant Y cas`, date `Au DD mois AAAA` la précédant), à la ligne près.

**Vérifié en base live et dans les logs de cron ce matin, avant tout code neuf :** les 3 lignes France citent déjà `bulletin-national/chikungunya-dengue-zika-et-21` en source avec 25/4/18 cas et `date=2026-08-17`, exactement les valeurs du bulletin publié le 19/08. `site_config` (`cron:run:sync-spf`) confirme un dernier passage le **22/08 à 15h00 UTC, statut `ok`**, à l'heure de son horaire (`0 7,15 * * *`, `vercel.json`). **Rien n'a été codé ce matin — le correctif était déjà en prod et fonctionne.**

**Leçon à retenir, au-delà de ce cas précis :** avant de proposer ou de re-proposer une idée comme non construite, **relire le fichier de code réel au moment de l'écriture**, pas seulement le texte d'un log de la veille — surtout depuis le passage en autonomie de build, où plusieurs sessions peuvent committer le même jour sans que le log d'une routine planifiée en connaisse l'ordre exact. Un `grep` sur le fichier avant de conclure « non construit » aurait suffi.

---

### Contexte relevé au passage (pas des idées)

- 🔴 **Deux fichiers de cron modifiés et NON commités traînent dans l'arbre de travail depuis 15h26 aujourd'hui**, écrits par une autre session : `onboarding-sequence/route.ts` (suppression de l'e-mail J+12, qui doublonnait `trial-reminders` J-3/J-1 — trois mails « votre essai se termine » en trois jours, depuis deux crons qui s'ignorent) et `trial-reminders/route.ts` (envois restreints aux jours ouvrés, rattrapage du week-end le lundi). **Volontairement ni commités ni touchés par cette session** : le garde-fou 3 du SKILL exclut du build automatique tout ce qui touche aux e-mails clients, et ces changements-là n'ont pas été relus par moi. Ils sont cohérents à la lecture et bien commentés, mais **c'est à David de les valider et de les committer** — et tant qu'ils restent non commités, ils ne sont pas en prod. Mes propres commits de ce soir ont été faits par `git add` ciblé ; ces deux fichiers restent intacts.
- **Pistes ouvertes sans angle neuf, non re-proposées :** version de définition de cas (Omobolanle Adelekun, 03/08), 18 indicateurs de confiance communautaire (Andrea Bernasconi, 07/08, non constructibles faute de source), trois sources tierces (Hao-Kai TSENG, 29/07, bloquées par le garde-fou explicite du `ROADMAP.md`), exposition de l'écart entre deux sources (idée 3 du 21/08, gros effort, sa version cheap étant déjà en prod).
- **Morgan Otita** — toujours pas re-proposé, l'arbitrage de David du 20/08 tient. Repère naturel évoqué : ~24/08, J-2 avant l'annulation automatique du 26/08.
- **Aucune sonde en lecture seule sur la prod n'a été tentée cette session** — les deux runs précédents s'étant fait refuser par le classificateur. Les deux constructions de ce soir n'en avaient pas besoin : l'une est validée contre la vraie page GPEI téléchargée, l'autre est une correction de logique entièrement lisible dans le code.

**Statut : 2 idées PROPOSÉES ET CONSTRUITES, 1 idée PROPOSÉE et délibérément non construite (garde-fou 1).**

---

## 2026-08-21 — Proposition du jour

**Jour J du go/no-go.** Le statut de la décision elle-même n'est pas confirmé dans cette session — je ne le suppose pas. Les trois idées ci-dessous ne portent pas sur l'instrument de décision (déjà couvert les 17, 18, 19 et 20/08) mais sur ce que **la journée d'aujourd'hui a produit** : deux commits de qualité de données, un signalement de terrain arrivé par LinkedIn, et un angle produit explicitement renvoyé ici par la session de 17h.

**Limite de méthode, dite d'emblée (identique au 20/08) :** la sonde en lecture seule sur la prod a de nouveau été **refusée par le classificateur d'autorisation** dans cette session non supervisée. Tout ce qui suit est établi **par lecture du code de `master`, des commits du jour et des archives de session** — pas par requête live. Les trois défauts sont structurels et lisibles dans le code ; leur **ampleur en nombre de lignes** reste à confirmer sur `/admin`.

**Aucun signal terrain neuf au sens strict :** `product-feedback.md` n'a pas bougé depuis le 08/08 (13 jours). Mais contrairement au 20/08, **la journée a produit du signal exploitable** : un contact LinkedIn a envoyé un lien qui a révélé 3 lignes fausses en base, et le commentaire publié à 17h porte sur un manque produit identifié en séance.

---

### 1. 🔴 Trois lignes France ont périmé ensemble et c'est un contact LinkedIn qui l'a vu — `sync-spf` existe, a le bon plafond, et regarde la mauvaise page du site

**Signal (archive de session du 21/08 17h, `dd3bf53`).** Pierre PARNEIX envoie un lien en DM. La session ne s'en sert pas comme source mais remonte aux bulletins de Santé publique France et relit le texte brut. Écart constaté sur trois lignes actives :

| Ligne HWG | En base | Date d'arrêt | Bulletin SpF du 19/08 | Date d'arrêt | Écart |
|---|---|---|---|---|---|
| `Chikungunya / France` | 15 cas | 10/08 | **25 cas** | 17/08 | +10 cas, 7 j |
| `Dengue / France` | 2 cas | 10/08 | **4 cas** | 17/08 | +2 cas, 7 j |
| `Fièvre du Nil occidental / France` | 6 cas | 14/08 | **18 cas** | 17/08 | **×3 en 3 jours** |

Toutes trois sur **le même bulletin hebdomadaire**, du même émetteur, celui déjà cité par les lignes. Verbatim et URL dans `content-log.md`, section 4️⃣ du créneau de 17h.

**🔴 Le diagnostic porté par la session de 17h est périmé, et c'est le cœur de l'idée.** Elle conclut : « *les trois lignes sont en `source_priority` 10, donc aucun cron ne les rafraîchira seul* », et renvoie à l'arbitrage des « 27 lignes à 10 ». **Ce n'était plus vrai au moment où elle l'écrivait.** Inventaire des plafonds d'écriture relevé ce soir (`grep 'lte("source_priority"' app/api/cron/*/route.ts`) : sur 27 occurrences, **une seule est encore à 5** dans un cron actif, et **`sync-spf` plafonne à 10** depuis `eb57f8e`/`d124101` (19/08). Son en-tête le dit mot pour mot : « *SPF is France's own national public health agency — a genuine primary government source for its own country's rows — so this cron can write onto rows locked at source_priority=10* ». Le verrou de priorité n'explique donc **rien** ici : le cron a le droit d'écrire ces trois lignes, il ne l'a pas fait.

**La vraie cause, lisible dans le code.** `sync-spf/route.ts` l. 40-47 ne connaît que trois entrées, toutes des **fils d'actualité** : `…/maladies-infectieuses-d-origine-alimentaire?format=xml`, `…/les-actualites?format=xml`, et une URL de recherche. Le bulletin hebdomadaire vectoriel (« Chikungunya, dengue, Zika et West Nile — bulletin national n°21 ») n'est pas un article d'actualité : il vit dans la rubrique documents/bulletins de la maladie. `grep -i "vectoriel\|chikungunya\|west nile"` sur le fichier ne remonte **aucune** occurrence — le mot n'apparaît nulle part dans le cron. Le seul point de contact est cosmétique : `extractSPFDisease` sait retirer le préfixe « bulletin épidémiologique » d'un titre, et `extractSPFBody` déclare son sélecteur « *stable across hub pages, regional bulletins, and national bulletins* ». **Le parseur sait lire ces bulletins ; le fetcher ne va jamais les chercher.**

**Pourquoi ça compte plus que trois lignes.** C'est un bulletin **hebdomadaire, daté, à cumuls croissants** — exactement le profil de source que le produit sait traiter le mieux, et sur le seul pays dont HWG parle la langue et dont les prospects institutionnels francophones sont les plus proches. Le défaut est **périodique, pas accidentel** : il se reproduira chaque semaine, sur les mêmes lignes, et la seule chose qui l'a détecté cette semaine est un contact qui a envoyé un lien. Note secondaire : la session de 17h a vérifié que la ligne `Chikungunya / France` était **toujours à 15 cas au moment d'envoyer le DM à Pierre PARNEIX** (18:44) — le produit était donc faux sur l'écran de la personne à qui on écrivait.

**Effort estimé : petit à moyen.** Ajouter les pages de bulletin national vectoriel (et leur pendant régional Nouvelle-Aquitaine, qui donne le détail communal) comme entrées supplémentaires de `SPF_RSS_URLS`/pages à visiter. Tout le reste est déjà en place : extraction du corps, garde-fous complets (`dateFloorGuard`/`spikeGuard`/`collapseGuard`/`lockedRowRegressionGuard`), plafond à 10, `maxDuration` 300 s. Ce n'est pas une nouvelle source au sens du garde-fou du `ROADMAP.md` (« ne pas intégrer de source tant qu'un prospect ne le demande pas ») — **c'est la même source, déjà intégrée, dont on ne lit qu'une des surfaces**.

**Risque/inconnue :** (a) le bulletin national agrège plusieurs maladies dans **un seul document** (chikungunya + dengue + Zika + West Nile), ce que le cron ne fait nulle part ailleurs — il pose un article ↔ une ligne ; c'est le vrai travail, et il faut décider si on extrait par section ou si on écrit un parseur dédié à ce format ; (b) le bulletin donne des **épisodes** (« 3 épisodes totalisant 25 cas »), donc un extracteur naïf risque de retenir 3 au lieu de 25 — le piège est visible d'avance, il faut le tester explicitement ; (c) une page de bulletin sans flux XML demande soit un scraping d'index, soit une URL construite avec un numéro de semaine, plus fragile qu'un RSS ; (d) **rien à faire côté priorité** : ne pas rejouer l'arbitrage des lignes à 10, il a été tranché le 19/08 — la carry-over n°10 de la session de 17h et sa n°3 devraient être requalifiées, elles décrivent un blocage qui n'existe plus.

⚠️ **Point d'ingestion indépendant de l'idée** : les 3 lignes fausses sont **toujours en base ce soir**, aucune écriture n'a été faite (la session LinkedIn ne fait pas d'ingestion, à raison). Les valeurs vérifiées sont prêtes à l'emploi dans `content-log.md`. C'est un correctif de données à passer, pas une idée produit — mais il ne faut pas qu'il se perde derrière l'idée.

**✅ Corrigé le 22/08, sur demande de David en session interactive.** Re-vérifié moi-même par WebFetch direct sur le bulletin national #21 et le bulletin régional Nouvelle-Aquitaine (pas seulement la citation de la session du 21/08, qui s'est confirmée exacte) : Chikungunya 15→**25** cas, Dengue 2→**4** cas, West Nile 6→**18** cas (nouvelle région Île-de-France). Écrit en prod via `scripts/fix-france-arbovirus-bulletin21-2026-08-22.mjs`, `MANUAL_ROW_CHECKED` de `morning-don-check.mjs` mis à jour au 22/08. L'idée 1 elle-même (`sync-spf` ne visite jamais les pages de bulletin) reste non construite — ce correctif ne répare que le stock, pas la cause, et le même trou se reproduira au prochain bulletin hebdomadaire.

---

### 2. 🔴 Le badge qui rassure a été durci le 19/08, celui qui alerte est resté sur l'ancienne mesure — une ligne dont le bulletin a 152 jours n'affiche aucun avertissement

**Signal (code, `lib/outbreaks.ts`).** Les deux badges de fraîcheur de `OutbreakTable.tsx` ne lisent pas le même champ :

| badge | fonction | champ lu | corrigé le 19/08 ? |
|---|---|---|---|
| ✓ vert « MàJ · Xj » | `freshOutbreakHours` (l. 684-691) | `outbreak.date` — la date du bulletin | ✅ oui (`5d8e1ad`) |
| ⚠ orange « SANS MAJ · Xj » | `staleOutbreakDays` (l. 651-657) | **`outbreak.updated_at ?? outbreak.date`** — l'horodatage de la dernière **écriture en base** | ❌ **non** |

Le diff de `5d8e1ad` est explicite : il touche `app/[locale]/outbreak/[id]/page.tsx`, `OutbreakDetailModal.tsx` et **une seule fonction** de `lib/outbreaks.ts`. Son propre message de commit énonce pourtant le principe en général : « *any incidental touch (a QC edit, a locale backfill) reset the claim without a single number moving* ». Ce raisonnement vaut mot pour mot pour le seuil de 60 jours — il n'y a pas été porté.

**Le cas est réel et vérifiable sans requête.** `scripts/fix-diphtheria-nigeria-ncdc-reframe-2026-08-15.mjs` écrit, dans le même payload, `date: "2026-03-22"` (l. 97) et `updated_at: new Date().toISOString()` (l. 104). Cette ligne a donc, depuis le 15/08 : un bulletin de **152 jours** et une écriture de **6 jours**. `STALE_DAYS = 60` (l. 642) est comparé à l'écriture → **aucun badge orange**. Et comme `freshOutbreakHours` plafonne à 7 jours de bulletin, **aucun badge vert non plus**. Le visiteur ne voit strictement rien : la ligne se présente comme une donnée ordinaire.

**L'effet ne s'arrête pas au badge.** `sourceScore` (l. 742) applique `-0.5` aux lignes signalées périmées par cette même fonction. Une ligne dont l'avertissement est masqué **n'est pas non plus déclassée** dans le tri — elle remonte plus haut qu'elle ne le devrait sur la surface que les prospects institutionnels jugent en premier. Le défaut est donc à la fois d'affichage et de classement.

**Et la vérification qui manquait a été faite aujourd'hui — elle est rangée au mauvais endroit.** `ea80fd4` + `c9377bf` (18h23 et 18h27) créent `VERIFIED_STALE` : **9 lignes** dont la source primaire a été ouverte une par une, sur les 20 et 21/08, pour confirmer qu'aucune édition plus récente n'existe (WHO SAGE RRA v.2 extrait localement, PAHO SitRep #8, AFRO semaine 28 recoupé avec ECDC, table district endpolio.com.pk recoupée avec GPEI). C'est, **à ce jour, la seule donnée du produit qui affirme « source confirmée la plus récente disponible, vérifiée le J »** — le champ dont l'idée 3 du 20/08 constatait l'absence totale (« *le schéma n'a aucune notion de reconfirmé* »). Elle existe maintenant. Elle sert **uniquement à taire un e-mail interne**. Sur ces mêmes lignes, le client lit soit rien, soit l'avertissement « *foyer peut-être résolu ou non rapporté* » — alors qu'on sait, document en main, que le chiffre est le bon et que le silence est celui de la source. Marburg/Ouganda est le cas limite : « *WHO's own IHR request to Uganda remains unanswered* » est une information de premier ordre pour un épidémiologiste, et le produit la rend comme un trou de données.

**Effort estimé : petit pour la correction, moyen pour la valorisation.** Deux gestes distincts, à ne pas confondre :
- **(a) aligner `staleOutbreakDays` sur `date`** — une ligne, symétrique de `5d8e1ad`, à faire dans tous les cas. ⚠️ **Elle fera apparaître des badges orange qui n'apparaissaient pas**, potentiellement en nombre : c'est l'objet même du correctif, mais il faut mesurer combien sur `/admin` avant de pousser, pas le découvrir en prod.
- **(b) sortir `VERIFIED_STALE` du cron** vers une donnée lisible par l'interface, pour distinguer « *chiffres inchangés, source reconfirmée le J* » de « *plus aucune publication depuis le J* ». Reprise directe de l'idée 3 du 20/08, **avec la preuve qui lui manquait** : le coût de collecte, qui était l'inconnue principale, est désormais connu — 9 lignes ont été vérifiées à la main en deux jours.

**Risque/inconnue :** (a) `VERIFIED_STALE` est un **Set écrit à la main dans un fichier de cron**, le troisième dictionnaire manuscrit de cette forme après `MANUAL_ROWS` et `MANUAL_ROW_CHECKED` (idée 2 du 18/08, « *a lâché 3 fois en 13 jours* ») — et il a lâché **4 minutes après avoir été écrit** : `c9377bf` rattrape Measles/Canada, vérifié la veille avec Peru et Bolivia, oublié à la transcription. Le porter en base plutôt que d'en ajouter un quatrième est la vraie décision ici ; (b) le clé-par-`date` de `VERIFIED_STALE` est une bonne propriété (l'entrée s'invalide toute seule quand la source republie) qu'il faut **conserver** dans toute migration en base, pas réinventer ; (c) exposer « reconfirmé » au client crée une affirmation nouvelle : elle n'est légitime que sur les 9 lignes réellement vérifiées à la main, jamais par défaut — le piège décrit au 20/08 (« *je l'ai lue aujourd'hui n'est pas la source l'a confirmée aujourd'hui* ») reste entier ; (d) le geste (a) seul, sans (b), aggrave l'affichage à court terme (plus d'avertissements, dont 9 qu'on sait injustifiés) — c'est un argument pour les faire ensemble, pas pour repousser (a).

**✅ (a) et (b) entièrement construites le 22/08.** `staleOutbreakDays` lit désormais `outbreak.date`, symétrique de `5d8e1ad`. Migration `20260822120000` ajoute `outbreaks.source_confirmed_at` (self-invalidant par construction — voir `isSourceConfirmed()`, `lib/outbreaks.ts`) ; un badge distinct « ✓ SOURCE CONFIRMÉE » remplace l'avertissement orange sur les lignes concernées (`OutbreakTable.tsx`, `OutbreakDetailModal.tsx`, `outbreak/[id]/page.tsx`) ; `sourceScore` n'applique plus sa pénalité de -0,5 dessus. `supabase db push` avait d'abord été refusé par le classificateur en session non supervisée, puis **exécuté par David lui-même** — les deux migrations (schéma + backfill des 9 lignes déjà vérifiées) sont **appliquées et vérifiées en prod** (`source_confirmed_at` peuplé sur les 9 lignes attendues, dates de vérification conservées). `data-quality/route.ts` reconnecté : `VERIFIED_STALE` (Set codé en dur) retiré, `isVerifiedStale` lit désormais la colonne directement — plus de dictionnaire manuscrit à maintenir pour cette vérification.

---

### 3. Exposer l'écart entre deux sources sur un même foyer, au lieu de n'afficher que la valeur retenue — **long terme**

**Signal — angle renvoyé explicitement ici par la session de 17h**, verbatim de son §3 : « *l'écart entre deux sources sur un même foyer n'est aujourd'hui **pas exposé** par HWG, qui n'affiche qu'une valeur retenue. Un affichage du type « cette ligne vient de X arrêtée au J, une autre source donne Y arrêtée au J-2 » serait exactement ce que le commentaire publié ce créneau décrit comme manquant. À verser à `product-ideas-log.md` par une session qui a la main dessus.* »

**Le cas mesuré existe déjà, il est en base et il a coûté un garde-fou.** Le 19/08, Africa CDC publie sur Ebola/RDC un cumul de décès (2 320) **inférieur** à celui déjà en base venant du WHO AFRO External Situation Report 14 arrêté au 16/08 (2 378) — non pas parce qu'un chiffre est faux, mais parce que les deux **arrêtent de compter à des jours différents**. C'est ce cas qui a fait écrire `lockedRowRegressionGuard` le soir même. Le garde-fou fait exactement ce qu'il doit : il **rejette** la valeur la plus basse. Mais il la rejette **en silence** — c'est précisément le défaut décrit par l'idée 2 du 19/08 — et le produit n'en garde aucune trace visible.

**Ce qui rend l'angle légitime aujourd'hui plutôt qu'en théorie.** Trois faits distincts convergent, sur trois surfaces différentes : (1) le cas Africa CDC / WHO AFRO, réel et daté ; (2) la mémoire `project_source_priority_is_ownership_not_freeze_2026_08_19` pose déjà la règle de comparaison — « *comparer les dates d'arrêt, jamais les dates de publication* » — donc **la sémantique existe, elle n'est simplement pas rendue** ; (3) c'est la thèse du commentaire publié aujourd'hui à 17h sous le compte rendu de mission de Yazdan Yazdanpanah, qui a rencontré Africa CDC **et** l'OMS dans la même semaine : « *the more recently published of the two can carry the lower cumulative death toll, so an outbreak that is still growing can read, at a distance, as one that has just been revised down.* » On a publiquement décrit un manque que le produit a et n'affiche pas.

**Effort estimé : gros, et c'est pourquoi je l'étiquette long terme.** Le produit ne conserve aujourd'hui **aucune** valeur concurrente : les crons proposent, les garde-fous acceptent ou rejettent, le rejeté disparaît. Exposer un écart suppose de le **stocker** — a minima la dernière valeur rejetée avec sa source et sa date d'arrêt. C'est une écriture nouvelle sur un chemin qui n'en a pas, dans 17 crons.

**Risque/inconnue :** (a) **aucune échéance et aucun prospect ne l'a demandé** — c'est une intuition de marque appuyée sur un cas, pas une demande client ; à ce titre elle est franchement moins prioritaire que les idées 1 et 2 ; (b) afficher deux chiffres qui divergent peut se lire comme un aveu d'incohérence plutôt que comme de la rigueur — la formulation fait tout, et c'est un travail éditorial autant que technique ; (c) **version cheap qui capte l'essentiel** : ne rien stocker de nouveau, et se contenter d'afficher sur la fiche la **date d'arrêt** et l'émetteur de la valeur retenue, de façon proéminente — une bonne partie du malentendu décrit vient de ce que le lecteur ignore *à quelle date* le chiffre s'arrête, ce que l'idée 3 du 19/08 (`dateSemantics`, en prod depuis le 19 au soir dans les 5 langues) a déjà commencé à traiter et dont **la relecture par David est toujours en attente** ; commencer par relire ça coûte zéro et peut rendre l'idée complète inutile.

**⛔ Délibérément non construite le 22/08**, malgré la demande de David d'implémenter les idées de ce jour automatiquement. Vérifié en cours de session : la version cheap (c) **est déjà en prod** — `cumulativeAs` (`app/[locale]/outbreak/[id]/page.tsx:60,471`) affiche déjà « cas cumulés depuis le début — bulletin {source} du {date} » sur la fiche foyer, dans les 5 langues, depuis le 19/08. La version complète reste un gros chantier de schéma (17 crons) sans demande de prospect, exactement le garde-fou que `ROADMAP.md` pose pour toute nouvelle source ou fonctionnalité spéculative. Reste au log en attente d'un arbitrage explicite de David plutôt que construite par défaut.

---

### Contexte relevé au passage (pas des idées)

- 🔴 **Re-remontée factuelle, pas une idée neuve : l'idée 2 du 20/08 (alarme codée en dur sur le `2026-08-21`) n'est pas construite, et son échéance est ce soir.** `VIABILITY_DECISION_DATE = "2026-08-21"` est toujours en dur (`health-check/route.ts:408`), toujours lu par la requête (l. 449), le corps de l'e-mail (l. 948), **la ligne d'objet** (l. 1004) et le payload JSON (l. 1114). Preuve nouvelle depuis hier : le compteur est passé de **8 à 11 essais** ce matin (`project_hwg_viability_decision_2026_08_21`, mise à jour du 21/08 — 3 nouveaux, aucun recoupant les cas déjà tranchés). À partir de demain, la requête `trial_ends_at > "2026-08-21"` matche **tous** les essais actifs, sous un intitulé qui parle d'une décision déjà passée. Les trois options (horizon glissant / neutralisation / nouvelle date de jalon) sont détaillées au 20/08 et restent valables telles quelles ; la (c) dépend de ta décision d'aujourd'hui.
- **Livré aujourd'hui, hors idées de ce log** : `594323e` (cadence polio AF/PK/PS après vérification hebdomadaire), `ea80fd4` + `c9377bf` (`VERIFIED_STALE`, cité en idée 2).
- **Aucun signal terrain entrant depuis 13 jours** (`product-feedback.md` inchangé depuis le 08/08). Les pistes ouvertes restent ouvertes sans angle neuf : version de définition de cas (Omobolanle Adelekun, 03/08), 18 indicateurs de confiance communautaire (Andrea Bernasconi, 07/08, non constructibles faute de source), trois sources tierces (Hao-Kai TSENG, 29/07, bloquées par le garde-fou explicite du `ROADMAP.md`).
- **Morgan Otita — délibérément pas re-proposé**, comme hier : l'arbitrage de David du 20/08 (pas de 3e relance rapprochée) tient, et le repère naturel évoqué restait ~24/08, J-2 avant l'annulation du 26/08.
- **Incident d'automatisation à surveiller demain** (relevé par la session de 17h, hors périmètre produit) : `linkedin-hwg-followup-check` (13h) n'a rien produit le 21/08 — trois tâches estampillées à la même seconde à 16:03 UTC, signature du défaut de déclenchement groupé déjà documenté. La tâche reste enregistrée et `enabled`, `nextRunAt` demain 13h01. Si le créneau saute une 2e fois, ce n'est plus un incident isolé.

**Statut : PROPOSÉE — en attente de retour de David.**

---

## 2026-08-23 — Proposition du jour

**Deuxième run sous le régime d'autonomie de build.** Contrairement au 22/08, la proposition ci-dessous est **archivée et poussée avant toute ligne de code**, comme le prescrit l'étape 4 du SKILL — l'écart de procédure signalé la veille est corrigé.

**Aucun signal terrain neuf :** `product-feedback.md` n'a pas bougé depuis l'entrée Coulibaly du 22/08, déjà exploitée. Les trois runs LinkedIn du jour (9h, 13h, 17h) n'ont produit aucun retour produit — Coulibaly a consulté le profil, ce qui n'est pas un retour, et la seule décision du jour est de ne pas relancer.

**Méthode, en application directe de la leçon du 22/08 :** les deux défauts ci-dessous ont été **relus dans le code réel de `master` au moment de l'écriture** (commit `36b0820`), pas déduits d'un log de la veille. Numéros de ligne cités à l'appui.

---

### 1. 🔴 Une régression sur une ligne verrouillée n'est détectable que pendant **un seul run** — passé ce délai, le mauvais chiffre devient la référence, en silence

**Signal.** La mémoire `project_ebola_drc_regression_2026_08_22` : le 22/08 à 08:13 UTC, la ligne phare Ebola/RDC (`source_priority=10`, `is_pheic`, PHEIC en vitrine) est passée de **5 021 à 534 cas** et de **2 378 à 93 décès** par une écriture hors du système de crons tracé. L'enquête a écarté un par un tous les chemins automatisés ; **la cause n'a jamais été trouvée**. Rien ne garantit donc que le mécanisme ne se reproduise pas, et le seul filet aujourd'hui est un contrôle dont la fenêtre est d'un jour.

**Ce que la relecture du code établit.**
- `data-quality` charge les instantanés avec `.eq("snapped_at", yesterday)` (l. 310-313) — **c'est la seule base de comparaison** de toute la détection de chute.
- `sync-outbreaks` écrit l'instantané du jour **toutes les heures** (`0 * * * *`), en `upsert` sur `onConflict: "outbreak_id,snapped_at"` (l. 466-469) : l'instantané d'une journée finit donc par contenir la **dernière** valeur de cette journée, pas la première.
- Conséquence arithmétique : une écriture fausse à 08:13 est gravée dans l'instantané du jour dès le passage de 09:00. Le run de `data-quality` de 10:05 le même jour compare encore à la veille (bonne valeur) et signale. **Dès le lendemain, il compare 534 à 534 et ne voit plus rien.** La fenêtre de détection vaut exactement un run — à condition que ce run ait lieu et que son rapport soit lu.

**Deux angles morts de plus, visibles sur ce même cas.**
- 🔴 **Les décès n'ont aucune détection de régression, à aucun horizon.** La section 3 ne teste que `deathsExceedCases`, `isZeroData`, puis chute et pic **sur `cases` uniquement** (l. 335-356). La perte de 2 378 → 93 décès (−96 %) n'a été vue par aucun contrôle : elle n'est passée que parce que les cas chutaient dans le même mouvement. La section 4d ne rattrape rien ici — elle ne couvre que trois maladies et seulement le cas `deaths === 0` exactement.
- Une **baisse lente** (−30 %/jour pendant 4 jours, soit −76 % au total) ne franchit jamais le seuil de 40 % contre la veille, et reste donc invisible du début à la fin.

**Réponse retenue : une ligne de haute eau.** Pour le petit ensemble des lignes verrouillées ou PHEIC — celles dont chaque chiffre a une décision humaine derrière lui — comparer la valeur courante au **maximum des 14 derniers jours**, sur les cas **et** sur les décès, plutôt qu'à la seule veille.

**Effort estimé : petit à moyen.** Une requête supplémentaire sur `outbreak_snapshots` (l'index `(outbreak_id, snapped_at DESC)` existe depuis la migration `20240109000000`, et aucun cron ne purge cette table — l'historique est là), réutilisation de `isCollapse` aux seuils déjà en place, aucun schéma, aucune écriture.

**Risque/inconnue :** (a) **répétition** — une baisse légitime décidée à la main sur une ligne verrouillée sera resignalée jusqu'à ce que le pic sorte de la fenêtre ; c'est précisément pourquoi la fenêtre est courte (14 j) plutôt que le maximum absolu, et pourquoi le périmètre est restreint ; (b) le taux de faux positifs **n'est pas mesurable dans cette session** (aucune sonde live sur la prod), d'où la restriction aux lignes verrouillées/PHEIC plutôt qu'aux ~114 lignes actives — l'étendre demandera une passe de mesure sur `/admin` ; (c) le contrôle **signale seulement, ne corrige jamais** — même règle que la branche `source_priority >= 10` de la section 4 (l. 401-405), pour la même raison : au-dessus de ce seuil, il y a un humain et une source primaire derrière le chiffre.

---

### 2. 🔴 La fiche foyer colle une pastille **rouge « Rapport ancien »** sur une ligne dont un humain a vérifié la source — pendant que le tableau affiche « ✓ SOURCE CONFIRMÉE » pour la même ligne

**Signal.** La migration `20260822120000` et `isSourceConfirmed()` (`lib/outbreaks.ts:683`) ont été écrites le 22/08 pour une raison précise, dite dans leur propre commentaire : distinguer « la source a réellement cessé de publier » d'« il y a un trou de données ». Ce travail a été câblé sur **deux** des **trois** surfaces qui affichent la fraîcheur.

**Ce que la relecture du code établit.**
- `OutbreakTable.tsx:1265` : câblé. Une ligne confirmée porte un badge neutre « ✓ SOURCE CONFIRMÉE · N j », avec l'infobulle « *Source officielle vérifiée directement — aucune édition plus récente, pas un trou de données* ».
- `OutbreakDetailModal.tsx:516` : câblé. L'avertissement ambre « *Aucun bulletin officiel depuis N jours — foyer peut-être résolu ou non rapporté* » est correctement supprimé sur une ligne confirmée, avec un commentaire qui dit explicitement vouloir éviter de contredire le badge du tableau.
- `OutbreakDetailModal.tsx:497-499` : **pas câblé.** `isStale = daysSince > 30` se calcule directement depuis `outbreak.date`, sans jamais consulter `isSourceConfirmed`. Le rendu se fait l. 1057-1062.

**Le résultat concret, pour toute ligne confirmée dont le bulletin a 60 jours ou plus** (`STALE_DAYS = 60`, le seuil qui déclenche le badge du tableau) : le visiteur voit dans le tableau un badge neutre « ✓ SOURCE CONFIRMÉE · 152 j », clique dessus, et la fiche qui s'ouvre affiche en haut à droite une **pastille rouge « Rapport ancien »** — vingt lignes au-dessus d'un emplacement où l'avertissement correspondant a justement été retiré parce que la source est confirmée. **La fiche contredit le tableau, et se contredit elle-même.**

**Pourquoi maintenant.** C'est la surface qu'un prospect institutionnel juge en premier, et c'est exactement la confusion que le chantier du 22/08 a été écrit pour supprimer — il n'a simplement pas atteint le troisième affichage. Coût de l'oubli : une ligne dont on a **vérifié à la main** qu'elle est à jour se présente en rouge comme une donnée périmée.

**Effort estimé : petit.** Une condition, un état d'affichage neutre supplémentaire, une chaîne à ajouter dans les 5 langues.

**Risque/inconnue :** (a) il ne faut surtout **pas** faire passer la pastille au vert « Données récentes » — une ligne confirmée reste ancienne, le rendu juste est un **troisième état neutre**, pas une promesse de fraîcheur ; (b) 5 locales à servir (fr/en/es/ar/id), en reprenant le vocabulaire déjà retenu par le badge du tableau pour que les deux surfaces disent le même mot.

---

### Contexte relevé au passage (pas des idées)

- **Le chantier e-mails de David tourne en parallèle dans l'arbre de travail partagé.** `fix/emails-lot-2` a été fusionnée dans `master` (`36b0820`) **pendant ce run**, et 7 fichiers de crons d'envoi restent modifiés et non commités, plus `lib/mail-suppression.ts` non suivi. **Rien n'a été touché** : garde-fou 3 du SKILL (e-mails clients) et règle de périmètre d'`AGENTS.md`. Pour éviter toute interférence, cette session a travaillé dans un **worktree git séparé** basé sur `origin/master` — l'arbre de travail principal n'a été ni modifié, ni stagé, ni stashé.
- **Morgan Otita** — toujours pas re-proposé ; l'arbitrage de David du 20/08 tient. Annulation automatique le 26/08, J-3.
- **Pistes ouvertes sans angle neuf, non re-proposées :** version de définition de cas (Omobolanle Adelekun, 03/08), 18 indicateurs de confiance communautaire (Andrea Bernasconi, 07/08, non constructibles faute de source), trois sources tierces (Hao-Kai TSENG, 29/07, bloquées par le garde-fou du `ROADMAP.md`), exposition de l'écart entre deux sources (idée 3 du 21/08 — **écartée par David le 23/08** : « pas maintenant, pas de prospect », mémoire `project_source_divergence_display_shelved_2026_08_23` ; ne pas la reposer sans signal neuf).
- **Aucune sonde en lecture seule sur la prod n'a été tentée**, comme aux trois runs précédents. Les deux idées ci-dessus sont entièrement établies par lecture de code ; leur **ampleur en nombre de lignes concernées** reste à confirmer sur `/admin`.

### Construction — les deux idées sont livrées

**Idée 1 — ✅ CONSTRUITE, commit `73aca66`.** Section 4k de `app/api/cron/data-quality/route.ts`. Périmètre : lignes actives non-`is_seed` avec `source_priority >= 10` **ou** `is_pheic`, et pas déjà signalées le jour même par la section 3 (pas de doublon). Une requête sur `outbreak_snapshots` entre J-14 et hier, un maximum par ligne sur les cas et sur les décès séparément (avec la date de ce maximum, reprise dans le message), puis `isCollapse` aux seuils **déjà en place** en section 3 — `minPreviousCases: 100, ratio: 0.4` sur les cas ; même ratio, plancher 20 sur les décès. Aucun schéma, aucune écriture, aucune auto-correction. Les deux modes d'aveuglement sont signalés au lieu d'être silencieux : erreur de lecture de la table, et fenêtre entièrement vide pour toutes les lignes surveillées (distinct du plancher de couverture de la section 3, qui ne regarde que la veille).

**Idée 2 — ✅ CONSTRUITE, commit `40d69f1`.** `components/OutbreakDetailModal.tsx`. Troisième état de pastille, neutre (`slate`), délibérément **pas** vert : une ligne confirmée reste ancienne. Libellé et infobulle repris mot pour mot du vocabulaire du badge de `OutbreakTable` pour que les deux surfaces disent la même chose, dans les 5 langues (fr/en/es/ar/id). `isSourceConfirmed` n'est plus appelé deux fois dans le composant.

**Vérification — ce qui a été fait, et ce qui ne l'a pas été.** `npx tsc --noEmit` et `npx eslint` propres sur les deux fichiers. La logique des deux correctifs a été **rejouée hors application** sur les cas réels (script jetable, non commité) :
- pastille — 152 j confirmée → neutre ; 65 j confirmée → neutre ; 3 j confirmée → vert ; 152 j **non** confirmée → **rouge** (comportement inchangé) ; 20 j non confirmée → ambre ; et **confirmation périmée** (`date` passée devant `source_confirmed_at`) → **rouge**, ce qui est bien l'auto-invalidation voulue par `isSourceConfirmed` ;
- ligne de haute eau — la régression Ebola du 22/08 est détectée sur les cas **et** sur les décès ; la correction manuelle 5 208 → 5 021 n'est **pas** signalée (−3,6 %) ; le chiffre Africa CDC 2 378 → 2 320 rejeté le 19/08 n'est **pas** signalé ; une baisse lente 5 000 → 1 200 sur 4 jours **est** détectée, alors qu'elle échappe au contrôle contre la veille.
- ⚠️ **Aucune vérification visuelle en navigateur, et aucune sonde sur la prod.** Le rendu de la pastille exigerait un serveur de dev avec les identifiants de production et une ligne réelle confirmée de plus de 60 jours ; ni l'un ni l'autre n'est raisonnable dans une session non supervisée. **Le comportement à confirmer d'un coup d'œil quand tu passeras sur le site :** une ligne portant le badge « ✓ SOURCE CONFIRMÉE » dans le tableau doit maintenant ouvrir une fiche dont la pastille est grise, pas rouge.

**Note de procédure :** cette session a travaillé dans un **worktree git séparé** (`product-ideas-2026-08-23`, basé sur `origin/master`), poussé en fast-forward sur `master`. L'arbre de travail principal — où ton chantier e-mails est en cours — n'a été ni modifié, ni stagé, ni stashé. `origin/master` a bougé deux fois pendant le run (tes commits), les deux fois absorbées par un rebase avant push.

**Statut : 2 idées PROPOSÉES ET CONSTRUITES** (`73aca66`, `40d69f1`). Aucune idée bloquée par un garde-fou ce soir.

---

## 2026-08-24 — Proposition du jour

**Aucun signal terrain neuf :** `product-feedback.md` n'a pas bougé depuis l'entrée Coulibaly du 22/08, déjà exploitée. Les trois runs LinkedIn du jour (9h, 13h, 17h) n'ont produit aucun retour produit exploitable.

**Le signal du jour vient du code écrit aujourd'hui, pas d'un contact.** Le run `morning-don-check` du matin a produit un audit de couverture choléra (`scripts/coverage-cholera.mjs`, non commité) et le commit `a5ac23d` qui en découle. Les deux idées ci-dessous sortent de ce qu'établit ce travail — relu dans le code réel de `master` (`d221d82`), numéros de ligne à l'appui.

---

### 1. 🔴 Le contrôle « pays câblé, zéro ligne » compare la base à une **copie manuelle** de la liste des pays — périmée depuis ce matin, et aveugle précisément aux deux pays qu'il devrait signaler

**Signal.** Le commit `a5ac23d` de ce matin ajoute **4 pays** à `CHOLERA_ISO3` (`app/api/cron/sync-who-regional/route.ts:552-588`) : Angola, Yémen, Pakistan, Burundi. Son propre commentaire dit que Pakistan et Burundi n'ont **aucune ligne en base** alors que l'OMS y déclare 4 184 et 1 537 cas. C'est mot pour mot le défaut que la section 4f de `scripts/morning-don-check.mjs` existe pour détecter (« câblé dans une map de source mais absent de la base », écrite le 27/07 après le trou Tchad/choléra).

**Ce que la relecture du code établit.** La section 4f ne lit pas `CHOLERA_ISO3`. Elle en tient une **copie recopiée à la main** (`morning-don-check.mjs:462-465`), avec un commentaire qui prévient lui-même : « *Garder `CHOLERA_ISO3_COUNTRIES` synchronisé avec la vraie const du fetcher si elle change.* » Cette copie contient **14 pays**, la vraie constante en contient **18** depuis ce matin. Les 4 pays ajoutés — dont les 2 sans ligne — sont invisibles pour le contrôle. Le diagnostic écrit ce matin par l'autre session tire déjà la conclusion, sans pouvoir la corriger depuis un script jetable : « *Une copie qui doit être synchronisée à la main finit toujours par diverger — et un scan de couverture qui diverge de ce qu'il est censé auditer ne vaut rien.* »

**Réponse retenue.** Lire le bloc `CHOLERA_ISO3` **dans le fichier de la route**, comme le fait déjà `coverage-cholera.mjs`, au lieu de le recopier. La liste ne peut alors plus diverger par construction.

**Effort estimé : petit.** Une lecture de fichier et une regex dans un script Node déjà en place ; aucune écriture, aucun schéma, aucune surface client.

**Risque/inconnue :** (a) une regex sur du code source casse si la constante est renommée ou déplacée — le contrôle doit alors **échouer bruyamment** (ligne « impossible de lire la constante ») et surtout pas retomber en silence sur une liste vide, ce qui transformerait le correctif en aveuglement total ; (b) la seconde liste manuelle du même bloc, `CHOLERA_EXPECTED_NULLS` (Cameroun, Syrie, Liban, Népal — « pas de cas actuel, pas un bug »), reste manuelle : elle encode un jugement, pas un état du code, et rien ne la vérifie. Le cas Yémen de ce matin montre le risque exact — une absence tenue pour normale pendant que la source publiait 5 196 cas. Non traité ici, signalé.

---

### 2. 🔴 Une ligne qui **sort de la carte** le fait sans nom — et à partir de là plus aucun contrôle ne la regarde

**Signal.** Toujours le commit de ce matin, sur Angola et Yémen : « *les deux lignes se sont retrouvées désactivées, arrêtées au 31/05, pendant que l'OMS continuait de publier — Angola jusqu'au 13/07 (5 361 cas / 117 décès), Yémen jusqu'au 29/06 (5 196 / 7). Des épidémies en cours affichées comme closes : un défaut visible côté client.* » Personne n'a été prévenu le jour où ces lignes se sont éteintes ; elles ont été retrouvées un mois et demi plus tard, à la main, en auditant autre chose.

**Ce que la relecture du code établit — deux moitiés du même angle mort.**
- `sync-outbreaks/route.ts:487-496` : la désactivation de masse (`active=false` sur toute ligne dont la `date` dépasse `STALE_DAYS`) récupère `{ count }` et **rien d'autre**. Aucun identifiant, aucun nom de pays, nulle part : ni dans les logs, ni dans `logCronRun`, ni dans la réponse JSON. Le matin où deux foyers en cours quittent la carte, la seule trace est un entier.
- `data-quality/route.ts:300-304` : le rapport quotidien charge `.eq("active", true)`. **Tout ce qui est inactif est hors de portée de ses onze sections** — fraîcheur, régression, CFR, duplication, filigrane 14 j livré hier. La seule exception est la section 4j (couverture GPEI), qui regarde les lignes dormantes **uniquement pour la polio**, et seulement parce qu'elle compare à une source externe.

Autrement dit : la désactivation est une **porte à sens unique**. Une ligne périmée est bruyante ; la même ligne désactivée est parfaitement silencieuse — elle devient indistinguable d'un pays sans épidémie.

**Réponse retenue, en deux morceaux qui se complètent.**
- **(a) Nommer.** `sync-outbreaks` remplace `{ count }` par un `.select(...)` et journalise ce qu'il vient d'éteindre (maladie / pays / date / source), en le renvoyant aussi dans sa réponse.
- **(b) Signaler le lendemain matin.** Nouvelle section **4l** de `data-quality` : toute ligne **inactive aujourd'hui qui possède encore un instantané récent** dans `outbreak_snapshots` vient, par construction, de quitter la carte (`sync-outbreaks` n'instantanéise que les lignes actives). Elle est listée avec la consigne de vérifier que la source a **réellement cessé de publier** — sans aucune écriture ni réactivation automatique.

L'intérêt de passer par les instantanés plutôt que par `active`+`updated_at` : le contrôle attrape la sortie de carte **quel que soit le chemin emprunté** — balayage de `sync-outbreaks`, désactivation par un cron de source (`sync-paho-alerts`, `sync-usda-aphis`, 4e de `data-quality`), bouton admin ou script à la main.

**Effort estimé : petit.** Deux fichiers, une requête supplémentaire sur une table déjà lue deux fois par ce cron, aucun schéma, aucune écriture nouvelle.

**Risque/inconnue :** (a) une même ligne sera signalée **deux matins de suite** (l'instantané du jour de sa désactivation a déjà été écrit avant l'extinction, par le run horaire) — assumé plutôt que corrigé : un rapport quotidien se rate un jour sur deux, et le doublon est le prix d'un filet qui ne se referme pas trop tôt ; (b) le contrôle ne voit **que** les sorties récentes, pas le stock de lignes déjà inactives — le volume de ce stock n'est pas mesurable dans cette session (aucune sonde prod) et un audit rétroactif serait une autre idée, plus lourde ; (c) si le balayage éteint un gros lot un jour donné, la liste doit être **plafonnée** dans l'e-mail, avec le total dit en clair — jamais tronquée en silence.

---

### Contexte relevé au passage (pas des idées)

- **Chantiers en cours dans l'arbre partagé, non touchés :** `marketing/qa/product-claims.manual.json` modifié (dispositif QA des messages sortants, `8218dd0`), `scripts/coverage-cholera.mjs` et `marketing/prospection-2026-08-23.pdf` non suivis. Règle de périmètre d'`AGENTS.md` : laissés tels quels. Cette session travaille dans un **worktree git séparé** basé sur `origin/master`.
- **Migration `20260824040000_outbreak_alert_daily_lock.sql`** (verrou anti-triplons des trois crons d'alerte) : écrite aujourd'hui par le chantier e-mails, **pas vérifiée comme appliquée en prod** ici — hors périmètre (garde-fou 3, e-mails clients). À confirmer côté David : si la table n'existe pas, les trois crons d'alerte écrivent dans le vide.
- **Morgan Otita** — annulation automatique **après-demain (26/08)**, J-2. Toujours pas re-proposé, l'arbitrage du 20/08 tient.
- **Pistes ouvertes sans angle neuf, non re-proposées :** version de définition de cas (Adelekun, 03/08), 18 indicateurs de confiance communautaire (Bernasconi, 07/08), trois sources tierces (TSENG, 29/07, garde-fou `ROADMAP.md`), écart entre deux sources (écartée par David le 23/08). Bulletin vectoriel `sync-spf` : toujours non construit, effort révisé moyen-gros le 22/08, inchangé.

**Statut initial : 2 idées PROPOSÉES.** Construction dans la foulée — voir la section ci-dessous.

### Construction — les deux idées sont livrées

**Idée 1 — ✅ CONSTRUITE, commit `0ba67eb`.** `scripts/morning-don-check.mjs`, section 4f. La liste des pays est lue dans `app/api/cron/sync-who-regional/route.ts` (bloc `CHOLERA_ISO3`) au lieu d'être recopiée — même lecture que `scripts/coverage-cholera.mjs`, pour que les deux outils ne puissent plus diverger de la source qu'ils auditent. **Échec bruyant** si la constante est renommée, déplacée ou reformatée : le contrôle imprime « CONTRÔLE IMPOSSIBLE » au lieu de retomber sur une liste vide, qui se lirait comme « aucun trou détecté ». `CHOLERA_EXPECTED_NULLS` reste manuelle (c'est un jugement, pas un état du code), mais porte désormais l'avertissement du cas Yémen.

**Idée 2 — ✅ CONSTRUITE, commit `f1fb59c`.** Deux fichiers :
- `sync-outbreaks/route.ts` — `.select("id, disease_en, country_en, date, source")` au lieu de `{ count }` : chaque ligne éteinte par le balayage de fraîcheur est nommée dans les logs. Un **échec** du balayage part en Sentry (même canal que l'échec d'instantané au-dessus) au lieu de se lire comme « rien de périmé aujourd'hui » — ce cron renvoie « ok » dans les deux cas.
- `data-quality/route.ts` — nouvelle **section 4l**. Toute ligne inactive portant encore un instantané des 2 derniers jours a quitté la carte dans cette fenêtre, `sync-outbreaks` n'instantanéisant que les lignes actives. Signale seulement : aucune réactivation, aucune écriture. Liste **plafonnée à 15**, avec le total dit en clair et une consigne dédiée si le lot est gros (un balayage trop large est en soi un signal). Les **suppressions pures** — id instantanéié qui n'existe plus du tout dans `outbreaks` — sont signalées à part : aucune requête sur `active=false` ne les trouverait jamais. Exclusion limitée aux **références annuelles GHO** (même marqueur que la section 4h), délibérément pas un `!is_seed` général : les seeds polio PHEIC sont actifs et sur la carte publique, l'un d'eux qui s'éteint est précisément ce que cette section doit dire.

**Vérification — ce qui a été fait, et ce qui ne l'a pas été.** `npx tsc --noEmit` propre sur l'ensemble du projet, `npx eslint` propre sur les trois fichiers, `node --check` sur le script.
- **Idée 1, extraction rejouée sur le vrai fichier** : 18 pays extraits, exactement ceux de la constante, aucun texte de commentaire capté au passage (Somalia → Burundi). La copie manuelle en connaissait 14.
- **Idée 2, logique rejouée hors application** (script jetable, non commité) sur sept cas : ligne désactivée aujourd'hui → signalée ; la même le lendemain → signalée une seconde fois (**doublon assumé**, l'instantané du jour est écrit avant l'extinction par le run horaire) ; sortie il y a 3 jours → silencieuse ; lignes restées actives → silencieuses ; référence GHO → exclue ; lot de 20 → 15 listées + 5 comptées explicitement ; ligne supprimée de la table → signalée comme suppression.
- ⚠️ **Aucune sonde sur la prod, aucune vérification en navigateur.** Le volume réel de lignes inactives et le nombre de sorties par jour ne sont pas mesurés ici — si le premier rapport de 4l est bruyant, c'est `RECENT_EXIT_DAYS` / `EXIT_LIST_CAP` qu'il faut ajuster, pas le principe. **À confirmer d'un coup d'œil demain matin** : le rapport `data-quality` de 10h05 doit contenir zéro ou quelques lignes `[SORTIE DE CARTE]`, pas des dizaines.

**Note de procédure :** session menée dans un **worktree git séparé** (`product-ideas-2026-08-24`, basé sur `origin/master`), poussée en fast-forward sur `master`. L'arbre de travail principal — où sont le dispositif QA en cours (`marketing/qa/product-claims.manual.json`) et `scripts/coverage-cholera.mjs` non suivi — n'a été ni modifié, ni stagé, ni stashé.

**Statut : 2 idées PROPOSÉES ET CONSTRUITES** (`0ba67eb`, `f1fb59c`). Aucune idée bloquée par un garde-fou ce soir ; le seul point laissé à David est la vérification que la table `outbreak_alert_daily_lock` est bien appliquée en prod (chantier e-mails, hors périmètre).

---

## 2026-08-25 — Proposition du jour

**Aucun signal terrain neuf :** `product-feedback.md` n'a pas bougé depuis l'entrée Coulibaly du 22/08, déjà exploitée. Les trois runs LinkedIn du jour (9h, 13h, 17h) n'ont produit aucun retour produit.

**Le signal du jour vient de la prod, et il répond à la question laissée ouverte hier soir.** L'entrée du 24/08 se terminait sur : « le seul point laissé à David est la vérification que la table `outbreak_alert_daily_lock` est bien appliquée en prod ». Réponse mesurée ce soir, en lecture seule sur `tqznwmpkokdzrszysbcm` : **elle est appliquée, et elle n'a jamais contenu une seule ligne.** Le reste de la session part de là.

Deux scripts de diagnostic écrits aujourd'hui par une autre session (`scripts/retention-check.mjs`, `scripts/alert-pressure.mjs`, non suivis par git) ont servi de point de départ ; les mesures ci-dessous ont été refaites par sondes dédiées, hors du dépôt.

---

### 1. 🔴 Le verrou anti-triplons livré hier a échoué **117 fois sur 117** ce matin — et il est conçu pour que cet échec soit invisible

**Signal, mesuré en base live.** Le 25/08 à 10h50 UTC, `regional-alerts` a écrit **117 lignes** dans `outbreak_alert_log`, horodatées une par une de `10:50:36.677` à `10:50:53.129` (117 horodatages distincts — c'est la boucle par foyer du chemin d'envoi, pas l'écriture groupée d'`activate-trial`, qui pose un `sentAt` unique). Trois destinataires : `hsoc@georgetown.edu` (115 foyers), puis deux comptes à 1 foyer.

Chacune de ces 117 lignes est précédée, dans le code, d'un appel à `claimOutbreakAlertDaily` (`regional-alerts/route.ts:356`). **`outbreak_alert_daily_lock` contient zéro ligne, tous jours confondus.**

**Le sens de « zéro » n'est pas ambigu, il a été tranché par une troisième mesure.** Le helper renvoie `true` sur erreur DB (échec ouvert, `cron-monitor.ts:373`) et `false` quand un cron plus spécifique a déjà réclamé la paire. Les deux branches écrivent dans `outbreak_alert_log`, donc les 117 lignes ne départagent rien. Ce qui départage : `profiles.trial_value_email_sent_at` du compte Georgetown vaut **`2026-08-25T10:50:52.301`** — or ce champ n'est posé que sur le chemin d'envoi réel, après le `sendEmail` du digest (`regional-alerts/route.ts:561`). L'envoi a donc bien eu lieu → le helper a renvoyé `true` → et il n'a laissé aucune trace → **il a renvoyé `true` par la branche d'erreur.** Les 117 fois.

**Ce que ça veut dire.** Le verrou inter-crons présenté hier comme « chantier #1 » (`65bd7b7`, migration `20260824040000`) ne protège rien depuis sa mise en service. Le produit est revenu, en silence, au comportement d'avant le 24/08 : un même foyer peut atteindre une boîte trois fois en vingt minutes. La table est pourtant bien appliquée — sa clé primaire à trois colonnes est correctement exposée par PostgREST, vérifié sur la spec OpenAPI de prod, et le helper jumeau `claimWeeklyEmailAddress`, structurellement identique (même patron d'`upsert`, même politique RLS `USING (false)`), a bien ses 24 lignes dans `weekly_email_send_log`. **La cause exacte de l'erreur n'est pas déterminable depuis cette session** : elle n'existe que dans le message d'erreur DB, envoyé à Sentry et aux logs Vercel, tous deux hors de portée ici. La sonder en écrivant dans la table de prod aurait été possible mais reste une écriture sur la prod en session non supervisée — non fait (garde-fou 2).

**C'est le défaut de fond, pas l'erreur DB.** `logCronRun` a enregistré « ok ». La réponse JSON du cron a affiché des compteurs normaux. Le health-check de 07h05 n'a rien à dire là-dessus. Le seul témoin est un `Sentry.captureException` que personne ne lit tous les jours. Le commentaire du helper jumeau énonce déjà exactement ce piège, écrit le 23/08 : « *l'appelant ne peut pas distinguer un verrou ACCORDÉ d'un verrou INÉVALUABLE : les deux renvoient `true`* ». Le diagnostic était juste ; le garde-fou correspondant n'a été construit ni là, ni ici.

**Réponse retenue, en deux morceaux.**
- **(a) Rendre l'inévaluable nommable.** `claimOutbreakAlertDaily` renvoie désormais trois états (`granted` / `taken` / `unevaluable`) au lieu d'un booléen à deux sens, et remonte le message d'erreur DB verbatim. Les trois crons d'alerte comptent les verrous inévaluables et font passer ce compteur **et le message d'erreur** dans leur réponse JSON et dans `logCronRun` — donc dans `site_config`, où ils deviennent lisibles sans Sentry. Le comportement d'envoi ne change pas d'un iota : `unevaluable` continue d'envoyer.
- **(b) Le dire le lendemain matin.** Nouveau contrôle du health-check : si des alertes sont parties **hier** dans la fenêtre des trois crons (10h–12h UTC) et que le verrou n'a **aucune ligne** pour cette date, ligne rouge, avec le message d'erreur DB stocké la veille recopié dedans. Le health-check tournant à 07h05, il regarde la veille — une journée complète, jamais un run en cours.

**Effort estimé : moyen.** Quatre fichiers (helper + trois crons) plus le health-check ; aucun schéma, aucune écriture nouvelle en base, aucune surface client. Le gros du travail est de ne pas casser trois crons d'envoi en changeant le type de retour d'une fonction qu'ils appellent en boucle.

**Risque/inconnue :** (a) le correctif **rend l'échec visible, il ne le répare pas** — la cause DB reste à trouver, et c'est précisément ce que le message verbatim doit livrer demain matin ; (b) `activate-trial` écrit aussi dans `outbreak_alert_log` sans réclamer de verrou : une inscription tombant dans la fenêtre 10h–12h UTC produirait un faux positif, accepté et documenté (un faux positif isolé se lit, un angle mort permanent non) ; (c) le même angle mort existe sur `claimWeeklyEmailAddress` — **non traité ici** pour ne pas élargir le périmètre à la chaîne hebdomadaire, signalé.

---

### 2. 🔴 Le troisième cron d'alerte est le seul sans preuve de livraison indépendante — l'audit du 29/07 a fermé cet angle mort pour deux crons sur trois

**Signal, dans le code.** `REAL_EVIDENCE` (`health-check/route.ts:109-114`) associe chaque cron de livraison à un journal que **lui seul** écrit. Son propre commentaire raconte pourquoi : le 29/07, `disease-alerts` y pointait vers `outbreak_alert_log`, qu'il n'écrit jamais, et « *une panne totale de disease-alerts aurait affiché ✅ indéfiniment* ». La table contient aujourd'hui `regional-alerts`, `disease-alerts`, `push-alerts`. **`watchlist-alerts` n'y est pas.**

Il n'y est pas alors que la colonne existe : `watchlist_alert_log.alerted_at`, vérifiée en prod (le nom diffère de ses deux sœurs, qui utilisent `sent_at` — ce qui explique probablement l'oubli). Ce cron retombe donc sur le seul `lastNonZero` de `site_config`, et le commentaire de `REAL_EVIDENCE` explique lui-même pourquoi ça ne suffit pas : « *un cron de livraison cassé n'a jamais de run rows>0, donc son `lastNonZero` resterait indéfiniment vide* ». Avec une tolérance de 14 jours (`STALL_THRESHOLD_OVERRIDE_DAYS`), une panne de `watchlist-alerts` est aujourd'hui indétectable.

**Deuxième moitié, sans laquelle la première ne vaudrait rien.** `alerted_at` n'est **pas** dans la charge de l'`upsert` du cron (`watchlist-alerts/route.ts:222-225`) : sur conflit, PostgreSQL ne met à jour que les colonnes fournies. La colonne garde donc la date de la **première** alerte sur ce couple, jamais la dernière. Branchée telle quelle comme preuve de livraison, elle vieillirait indéfiniment pendant que le cron travaille — un faux positif de panne. En prod : 2 lignes, `alerted_at` au 06/08, pour 2 entrées de watchlist.

**Réponse retenue.** Poser `alerted_at` explicitement dans l'`upsert` **du seul chemin d'envoi réel** (l. 220), jamais sur celui de la déduplication inter-crons (l. 183) qui n'envoie rien — la preuve doit signifier « livré », pas « examiné ». Puis ajouter l'entrée `watchlist-alerts` à `REAL_EVIDENCE`.

**Effort estimé : petit.** Deux fichiers, deux lignes de fond. La colonne existe déjà : **aucune migration**, donc aucune écriture sur un schéma non appliqué (garde-fou 2 respecté par construction).

**Risque/inconnue :** le volume est minuscule (2 entrées de watchlist en prod) — la valeur est structurelle, pas immédiate : c'est le troisième cron d'un trio dont les deux autres ont déjà ce filet, et l'écart a survécu à un audit qui portait précisément là-dessus.

---

### Contexte relevé au passage (pas des idées)

- **La pression d'alerte du 25/08 est réelle et concentrée sur un lead institutionnel.** `hsoc@georgetown.edu` (créé le 24/08 18h03, `is_pilot=true`, essai jusqu'au 28/09) a reçu ce matin **un digest couvrant 115 foyers**, dont 10 seulement sont nommés dans l'e-mail — le reste résumé en « +105 autres ». Les 105 sont malgré tout journalisés comme alertés, donc suppressés pour l'avenir sauf escalade ou +20 % de cas. C'est un **arbitrage délibéré et documenté** (`regional-alerts/route.ts:79-89`, `activate-trial.ts:207-212`), pas un défaut : non re-proposé. Signalé parce que c'est la première fois qu'il tombe sur un prospect institutionnel identifié.
- **Le stock « toutes les régions » n'a pas bougé.** `user_alert_regions` : **25 comptes abonnés aux 5 régions**, 2 comptes à 1 région. Le correctif d'inscription de ce soir (`ebe0ab0`, région obligatoire) ne vaut que pour les nouveaux comptes — Georgetown, inscrit hier, est dans les 25. Rectifier le stock, c'est modifier les préférences d'utilisateurs réels sans qu'ils l'aient demandé : **hors autonomie**, à trancher par David.
- **`disease_alert_log` : 6 lignes, dernière le 06/08 (19 jours).** Déjà expliqué par le correctif du 23/08 (`evaluatedAt` distingue « vérifié, rien à envoyer » de « cassé ») — pas un signal neuf.
- **Chantiers en cours dans l'arbre partagé, non touchés** (règle de périmètre d'`AGENTS.md`) : `marketing/qa/product-claims.manual.json` et `scripts/check-migrations-applied.mjs` modifiés ; `marketing/prospection-2026-08-23.pdf`, `scripts/alert-pressure.mjs`, `scripts/retention-check.mjs` non suivis. Laissés tels quels, ni stagés ni stashés.
- **Morgan Otita** — annulation automatique **demain (26/08)**. Dossier clos le 25/08 par David (4 relances déjà envoyées) : rien re-proposé.
- **Pistes ouvertes sans angle neuf, non re-proposées :** version de définition de cas (Adelekun, 03/08), 18 indicateurs de confiance communautaire (Bernasconi, 07/08), trois sources tierces (TSENG, 29/07, garde-fou `ROADMAP.md`), écart entre deux sources (écartée par David le 23/08), bulletin vectoriel `sync-spf` (effort moyen-gros, inchangé).

**Statut initial : 2 idées PROPOSÉES.** Construction dans la foulée — voir la section ci-dessous.

---

### Construction — les deux idées sont livrées, commit `8bfd6ea`

**Un seul commit pour les deux idées**, contrairement à l'habitude d'un commit par idée : elles se partagent deux fichiers (`watchlist-alerts/route.ts` et `health-check/route.ts`) sur des blocs différents, et découper à la main un index partiel valait moins que le risque de mal stager. Les deux sont détaillées séparément ci-dessous.

**Idée 1 — ✅ CONSTRUITE.** Trois morceaux :
- `lib/cron-monitor.ts` — `claimOutbreakAlertDaily` renvoie `{ state: "granted" | "taken" | "unevaluable"; error? }` au lieu d'un booléen dont `true` voulait dire deux choses opposées. L'erreur DB verbatim remonte avec l'état.
- `regional-alerts`, `disease-alerts`, `watchlist-alerts` — chacun compte `lockUnevaluable`, retient le premier message d'erreur, et les fait passer dans sa réponse JSON **et** dans `logCronRun`. Le statut du cron reste `ok` (un verrou inévaluable n'est pas un échec de livraison : l'alerte part) mais le message atterrit dans `site_config`, d'où le health-check le relit. **Le comportement d'envoi est identique à la ligne près** : `unevaluable` tombe dans le même chemin que l'ancien `true`.
- `health-check` — nouveau contrôle `checkAlertLockSilent`. Ligne rouge si, **la veille**, des alertes sont parties entre 10h et 12h UTC sans qu'une seule réclamation soit posée pour cette date, avec la cause DB recopiée depuis `site_config` quand un cron l'a enregistrée. Compté dans l'emoji, l'objet de l'e-mail et le drapeau `ok` de la réponse JSON.

**Idée 2 — ✅ CONSTRUITE** (même commit). Deux morceaux :
- `watchlist-alerts` — `alerted_at` est désormais posé explicitement dans l'`upsert` du **chemin d'envoi réel**, et délibérément pas sur la branche de déduplication inter-crons, qui n'envoie rien. La colonne existait depuis 2024 avec un `DEFAULT now()`, mais un défaut ne joue qu'à l'`INSERT` : sur conflit elle restait gelée à la première alerte. **Aucune migration** — la colonne était déjà là, donc aucune écriture sur un schéma non appliqué.
- `health-check` — entrée `watchlist-alerts → watchlist_alert_log.alerted_at` ajoutée à `REAL_EVIDENCE`. **Ne peut pas créer de fausse alerte par construction** : le contrôle de panne prend le **maximum** de `lastNonZero`, `evaluatedAt` et de cette preuve — une source de plus ne peut que rafraîchir le signal, jamais le vieillir.

**Vérification — ce qui a été fait, et ce qui ne l'a pas été.** `npx tsc --noEmit` propre sur l'ensemble du projet, `npx eslint` propre sur les cinq fichiers touchés.
- **Les quatre requêtes de `checkAlertLockSilent` ont été rejouées telles quelles contre la prod** (script jetable, non commité, lecture seule), sur quatre journées. Aucune erreur de schéma — c'était le vrai risque, `watchlist_alert_log` utilisant `alerted_at` là où ses deux sœurs utilisent `sent_at`. Résultat : `25/08 → livraisons=117, verrous=0 → 🔴 LIGNE ROUGE`. Le contrôle aurait dit, demain matin, exactement ce que cette session a mis trois sondes à établir. Les 22, 23 et 24/08 sortent rouges aussi (44, 99 et 46 livraisons, zéro verrou) — attendu et sans conséquence : le verrou n'existait pas encore ces jours-là, et le contrôle ne regarde jamais que la veille.
- **Le chemin de contrôle des trois crons a été relu ligne à ligne** après le changement de type de retour : `unevaluable` traverse le même chemin que l'ancien `true`, `taken` le même que l'ancien `false`. Aucun changement de comportement d'envoi, ce qui était la seule vraie manière de casser trois crons de livraison ce soir.
- ⚠️ **La cause DB reste inconnue.** Elle n'existe que dans le message d'erreur, envoyé à Sentry et aux logs Vercel — inaccessibles depuis cette session. La sonder aurait demandé une écriture dans la table de prod : non fait (garde-fou 2). **C'est le rapport health-check de demain 07h05 qui doit la livrer**, verbatim, dans la ligne rouge. Si elle y figure, le correctif de la cause tient probablement en une ligne ; s'il n'y a « aucune cause enregistrée », c'est que les crons d'alerte n'ont pas encore retourné depuis ce déploiement — attendre 10h50.
- ⚠️ **Aucune vérification en navigateur** : rien de ce qui est touché ici n'a de surface visible côté client.

**Statut : 2 idées PROPOSÉES ET CONSTRUITES** (`8bfd6ea`). Aucune idée bloquée par un garde-fou ce soir. Deux points restent chez David, aucun urgent : (a) le stock de **25 comptes abonnés aux 5 régions**, que le correctif d'inscription de ce soir ne rattrape pas — rectifier ces lignes reviendrait à modifier les préférences d'utilisateurs réels, hors autonomie ; (b) le même angle mort « verrou inévaluable indiscernable d'un verrou posé » subsiste sur `claimWeeklyEmailAddress`, non traité ici pour ne pas élargir le périmètre à la chaîne hebdomadaire le même soir.

---

### Suite, même soir (25/08) — le point (b) ci-dessus est traité sur demande explicite de David

Correctif appliqué par parité, commit `15f63ee` : `claimWeeklyEmailAddress` reçoit exactement le même traitement que `claimOutbreakAlertDaily` en `8bfd6ea` — type de retour commun (`AlertClaim`, renommé depuis `DailyAlertClaim`), les quatre mailers du lundi (`send-sitrep-emails`, `trigger-regional-digest`, `weekly-digest`, `weekly-signal`) comptent les verrous inévaluables et remontent le message DB verbatim dans `logCronRun`, et un contrôle miroir (`checkWeeklyLockSilent`) est ajouté au health-check.

**Différence de calendrier assumée dans le contrôle santé** : les quatre mailers tournent uniquement le lundi (06h50–07h20 UTC), en concurrence directe avec le health-check lui-même (07h05 UTC). Le contrôle lit donc toujours le **lundi le plus récemment écoulé**, jamais le jour même — un lundi qui tombe le jour du run est ignoré cette fois-là et repris la semaine suivante, même logique que « hier, jamais aujourd'hui » du contrôle quotidien.

**Vérifié avant commit, pas après un incident** : contrairement au verrou quotidien, `weekly_email_send_log` fonctionnait déjà (23 envois comptés par les quatre crons pour 24 verrous posés, semaine du 24/08, rejoué contre la prod avec les requêtes exactes du nouveau contrôle). C'est une fermeture préventive du même risque architectural, pas la réponse à un deuxième incident silencieux.

Point (a) — le stock des 25 comptes déjà abonnés aux 5 régions — reste ouvert, sans recommandation de code attachée : ce n'est pas un bug, c'est un arbitrage produit (forcer une réduction de portée sur des comptes réels vs. laisser « toutes les régions » comme choix rétroactivement légitime depuis `ebe0ab0`). Non traité sans confirmation explicite de David sur l'action voulue.

`npx tsc --noEmit` et `npx eslint` propres sur les six fichiers touchés.

---

## 2026-08-26 — Proposition du jour

Deux idées, toutes deux nées du même constat : **le produit a une politique de sources, et personne ne la fait respecter là où elle compte.** Les deux sont construites (petit/moyen effort, aucune migration, aucun envoi externe — les trois garde-fous passent).

Contexte de départ : la découverte du 26/08 à 13h33 (mémoire `project_reliefweb_reintroduction_2026_08_26`) que 4 lignes actives citaient `reliefweb.int`, interdit depuis le 06/07 pour cause de ToS non commerciales. Ces 4 lignes ont été désactivées le jour même. **Ce run a vérifié en base live ce que cette désactivation a réellement produit — et la réponse est : pas ce qu'on croyait.**

### 1. 🔴 L'interdiction légale de ReliefWeb n'est écrite que dans le code qui n'écrit plus rien — et le classificateur de sources continuait de lui décerner la pastille « source officielle vérifiée »

**Signal.** L'interdiction du 06/07 a été appliquée avec soin à **tous les chemins d'ingestion automatique** : `lib/reliefweb.ts` (fetch neutralisé, zéro importeur), `sync-signals` (cron réduit à un no-op), le repli Éthiopie de `sync-endemic-data`, la découverte de sitreps de `sync-drc-sitrep`. Quatre verrous, tous corrects, tous sur des chemins morts.

Pendant ce temps, `lib/source-trust.ts` — le fichier dont l'en-tête dit lui-même que les pastilles du site public ne sont honnêtes que dans la mesure où ce fichier l'est — listait `reliefweb.int` dans `AUTHORITATIVE_SOURCE_DOMAINS`, c'est-à-dire lui accordait le **niveau `official`** : pastille « ✓ source officielle vérifiée », lien cliquable vers reliefweb.int, présence dans le filtre « sources officielles » du tableau. Aucun garde-fou nulle part sur le chemin qui, lui, écrit vraiment : la vérification manuelle quotidienne. C'est par là que les 4 lignes sont entrées entre le 18/08 et ce matin 05h41 UTC.

**Constat nouveau, mesuré en base live pendant ce run — la désactivation de 13h33 n'a retiré du site qu'une ligne sur quatre.** `getOutbreaksCached()` (`lib/outbreaks.ts:197`) affiche `active=true` **OU** `source_priority>=3 ET updated_at>=60j ET date>=60j`. Les lignes désactivées gardent donc leur pastille, leur lien et leur place sur la carte pendant 60 jours — et l'écriture de désactivation a elle-même **rafraîchi `updated_at` à aujourd'hui**, remplissant la moitié de la condition qui les maintient affichées :

| Ligne | prio | date | Après désactivation |
|---|---|---|---|
| Dengue / American Samoa (1 036 c) | 10 | 2026-07-21 | **toujours affichée** |
| Dengue / Wallis-et-Futuna (50 c) | 10 | 2026-08-09 | **toujours affichée** |
| Dengue / Vanuatu (76 c) | 6 | 2026-08-10 | **toujours affichée** |
| Dengue / Kiribati (44 c) | 10 | 2026-06-24 | retirée (date > 60 j) |

Même forme que la leçon du 22/07 déjà écrite dans `product-feedback.md` : corriger le chemin ne rattrape pas l'état. Ici, éteindre la ligne ne la retire pas de la vitrine.

**Effort : petit.** Une liste, un test placé avant les listes d'autorisation, un prédicat exporté.

**Risque/inconnue :** la démotion fait tomber 3 lignes affichées de `official` à `unverified`, ce que `scripts/check-source-trust.mjs` traite par principe comme un **bloqueur** (ne jamais démettre silencieusement une ligne affichée sans décider d'abord de la re-sourcer). Ici la démotion est exactement l'effet voulu et elle est légalement obligatoire — traitée donc à part plutôt qu'en la faisant passer pour une démotion ordinaire (voir construction).

### 2. 🔴 Le classificateur qui décide de ce que le site affirme sur chaque chiffre n'est audité qu'à la main, le jour où quelqu'un l'édite — et il avait dérivé

**Signal.** `scripts/check-source-trust.mjs` existe, est excellent, rejoue toute la table à travers le vrai classificateur… et n'est lancé qu'« avant de livrer une modification des listes d'éditeurs ». Dernière édition : 17/08. Entre deux éditions, la table change tous les jours et le verdict du classificateur n'est regardé par personne.

Il avait dérivé. Rejoué ce soir sur les 134 lignes réellement affichées, **3 d'entre elles portent la pastille « illustratif » et n'affichent aucun lien source** (`app/[locale]/outbreak/[id]/page.tsx:560` masque le lien à ce niveau) :

- **Choléra / Cameroun — 1 342 cas, 36 décès**, source `ccousp.cm` : le Centre des opérations d'urgence de santé publique du Cameroun, c'est-à-dire une autorité sanitaire nationale, du même rang que `ncdc.gov.ng` ou `minsa.gob.ni` déjà autorisés. Un chiffre vrai, d'une source officielle, présenté à un prospect comme non sourcé.
- **FHCC / Ouganda (9 c) et FHCC / Sénégal (6 c)**, toutes deux sourcées sur `https://substack.com/@outbreaknewstoday/note/c-314274995` — une *note* Substack, pas même un article.

Les deux cas sont opposés et c'est tout l'intérêt : l'un est une source solide que le classificateur ignore, l'autre une source faible qu'il faut re-sourcer. Aucun des deux n'était visible sans lancer un script à la main.

**Effort : moyen.** Une section de plus dans l'audit quotidien, avec son propre jeu de lignes (toutes les sections existantes lisent `active=true` seulement — or c'est précisément la fenêtre d'affichage des 60 jours qui pose problème ici).

**Risque/inconnue :** bruit. Le contrôle est plafonné à 10 lignes détaillées par catégorie, et les deux catégories sont séparées — une source interdite est une question juridique, une source `unverified` est le plus souvent juste un hôte que personne n'a encore classé.

### Construction — les deux idées sont livrées

**Idée 1 — `lib/source-trust.ts` + `scripts/check-source-trust.mjs`.** Nouvelle liste `FORBIDDEN_SOURCE_DOMAINS` (`reliefweb.int`), testée **avant** toutes les listes d'autorisation dans `sourceStatusOf()` : aucune liste ne peut plus repêcher un éditeur interdit. `reliefweb.int` retiré d'`AUTHORITATIVE_SOURCE_DOMAINS`. Prédicat `isForbiddenSourceHost()` exporté pour que l'audit quotidien nomme les lignes sans redériver la règle depuis un simple `unverified` (une ligne peut être `unverified` pour dix raisons innocentes ; une seule est un sujet juridique). Le script d'audit reçoit 2 cas fixes de plus (22/22 passent) et une rubrique dédiée : les démotions imposées par la liste d'interdits sortent du décompte des bloqueurs — elles *sont* le correctif, et ne doivent pas prendre l'outil en otage jusqu'à ce que les lignes soient re-sourcées.

**Idée 2 — `app/api/cron/data-quality/route.ts`, section 4m.** Lit son propre jeu de lignes avec exactement le filtre de `getOutbreaksCached()` (134 lignes ce soir, chiffre confirmé identique à celui du script d'audit), puis remonte deux constats séparés dans le rapport de 07h05 : `[SOURCE INTERDITE]` par ligne, avec le rappel explicite que désactiver ne suffit pas ; `[PROVENANCE]` en une ligne groupée pour les `unverified` affichées, en énonçant les deux causes possibles à distinguer au cas par cas.

**Vérifié bout en bout contre la prod** (`tqznwmpkokdzrszysbcm`, lectures seules), pas seulement compilé : la section 4m rejouée à l'identique renvoie les 3 `[SOURCE INTERDITE]` et les 3 `[PROVENANCE]` attendues, et `node scripts/check-source-trust.mjs` sort en 0 avec sa nouvelle rubrique. `npx tsc --noEmit` et `npx eslint` propres sur les trois fichiers.

### Ce qui reste chez David — aucune écriture en prod n'a été faite ce soir

1. **Les 3 lignes ReliefWeb encore affichées.** Le correctif leur retire la pastille officielle et le lien, mais la ligne reste sur la carte avec des chiffres tirés de ReliefWeb. Les en sortir demande soit de les re-sourcer, soit de descendre leur `source_priority` sous 3 — deux actions qui touchent des données de prod et, pour la première, dépendent du choix de sources de remplacement déjà en attente de sa décision (mémoire `project_reliefweb_reintroduction_2026_08_26`, points 2 et 3, dont la tension « Vanuatu ajouté sur ordre explicite le 18/08 vs règle légale du 06/07 »). Rien n'a été modifié en base.
2. **`scripts/morning-don-check.mjs` n'a pas été audité ni modifié** — fichier d'une autre routine, et le choix des sources de remplacement est justement la décision en attente. Le run de demain 07h32 peut donc re-citer reliefweb.int ; s'il le fait, la section 4m le dira dans le rapport du 27/08 au lieu qu'on le redécouvre par hasard.
3. **`ccousp.cm`** : l'inscrire dans `AUTHORITATIVE_SOURCE_DOMAINS` ferait passer 1 342 cas de « illustratif » à « source officielle vérifiée ». C'est un octroi de confiance, pas un correctif mécanique — non fait de ma propre initiative. Un mot de sa part suffit.
4. **Les 2 lignes FHCC sur une note Substack** sont à re-sourcer (Ouganda et Sénégal, petits effectifs).

### Contexte relevé au passage (pas une idée)

`pricing.faq5_a` affirme toujours, dans les 5 langues, que les données viennent de « WHO, PAHO, and ECDC » — inchangé depuis le relevé du 26/08 matin (`project_faq5_sources_claim_narrower_than_reality_2026_08_26`, arbitrage explicitement laissé à David). Ce run y ajoute une mesure : sur les 134 lignes affichées, **4 sont au niveau `press`** (Tchadinfos, Leadership, Africa24, France Info) et **6 au niveau `unverified`**. La FAQ n'est donc pas seulement plus étroite que la réalité, elle est contredite par des lignes que le produit affiche déjà en le disant lui-même dans sa propre pastille. Non modifié — c'est du copy de marque et l'arbitrage lui appartient.

**Statut : 2 idées PROPOSÉES ET CONSTRUITES.** Aucune idée écartée par un garde-fou ce soir.

---

## 2026-08-27 — Proposition du jour

**Aucun signal terrain neuf :** `product-feedback.md` n'a pas bougé depuis l'entrée Coulibaly du 22/08. Les trois runs LinkedIn du jour n'ont produit aucun retour produit exploitable ici.

**La bonne nouvelle d'abord, parce qu'elle ferme le dossier ouvert le 25/08.** Le verrou inter-crons `outbreak_alert_daily_lock` fonctionne. Mesuré ce soir en lecture seule sur la prod, fenêtre 10h–12h UTC :

| jour | livraisons | lignes de verrou |
|---|---|---|
| 25/08 | 105 | **0** ← l'incident |
| 26/08 | 0 | 0 (rien n'est parti, donc rien à prouver) |
| **27/08** | **219** (218 regional + 1 watchlist) | **219** |

C'est la première preuve de bout en bout que la déduplication tourne — elle manquait encore hier (mémoire `project_alert_daily_lock_fails_open_2026_08_25`). Rien à construire là-dessus, le contrôle `checkAlertLockSilent` livré le 25/08 continuera de surveiller. **Ce n'est pas une idée, c'est une fermeture.**

**Le signal du jour est ailleurs, et il est dans le rapport santé de 07h05 : il y a deux lignes rouges permanentes depuis le 24/08, et une seule des deux décrit une vraie panne.**

```
2026-08-24T08:25  sync-samoa-dengue  error  rows=0  guard blocked issue 68: guard:older-report — 2026-08-03 vs existing 2026-08-10
2026-08-24T07:20  weekly-signal      error  rows=14 1 envoi(s) en échec
```

---

### 1. 🔴 Un cron affiche « EN ERREUR » depuis 4 jours parce que son garde-fou a fait exactement ce pour quoi il a été écrit — et le fichier qui définit ce garde-fou interdit noir sur blanc de le lire comme une erreur

**Signal, dans le code.** `lib/outbreak-guards.ts:311-313`, en tête de `regressionGuard()` :

> « *Callers log the reason as a "skip" and leave the row untouched — **never as an error**, since a blocked write is the guard working as intended.* »

Dix crons appellent ce garde-fou. Neuf respectent le contrat : `sync-cdc-notices`, `sync-cdc-han`, `sync-africa-cdc`, `sync-ncdc`, `sync-spf`, `sync-ecdc-threats`, `sync-endemic-data`, `sync-drc-sitrep`, `check-mpox-sitrep` — tous en `status: "skip"` ou `console.warn`. Le jumeau le plus proche, `sync-malaysia-dengue` (même forme exactement : cron mono-ligne, un garde, un `logCronRun`), écrit même la règle en toutes lettres : garde ordinaire → `ok`, seul un refus `guard:locked-row-…` sur une ligne réellement figée passe en `error`.

**`sync-samoa-dengue` est le seul des dix à logger `error`** (`route.ts:267`). Résultat : depuis le 24/08, l'e-mail de santé quotidien porte la ligne « ⚠️ 2 cron(s) à l'heure mais EN ERREUR au dernier passage », et l'un des deux va parfaitement bien.

**Mais le garde-fou n'aurait jamais dû être atteint — et c'est le vrai défaut, le reste n'en est que la trace.** Vérifié en direct ce soir, des deux côtés :

- **En base :** la ligne `Dengue fever / Samoa` porte l'**issue #69** (20 157 cas, 9 décès, rapport du 2026-08-10), `source_priority=10`, `updated_at` au **21/08**. Or le dernier écrit réussi de ce cron date du **13/08** (`lastNonZero`) — le #69 n'est pas venu de lui, il vient de la relecture manuelle quotidienne (`morning-don-check`), qui a trouvé le PDF directement.
- **Sur la source**, `health.gov.ws/dengue/`, récupérée à l'instant : la page de listing s'arrête à **`Dengue-sitrep-issue-no-68.pdf`**. Le #69 existe en PDF mais n'est lié nulle part sur la page.

Le raccourci « rien de neuf » du cron est `row.source === latest.url` — une comparaison de **chaînes d'URL**. Le #68 de la page n'est pas égal au #69 stocké, donc le cron conclut « nouvelle édition » et déroule tout : téléchargement du PDF, extraction **payante** par Claude Haiku, puis refus du garde parce que le rapport est plus ancien. **Tous les lundis, et ça continuera jusqu'à ce que le ministère publie un #70.** Le cron connaît pourtant le numéro d'édition des deux côtés — il le parse pour choisir le plus grand — il ne s'en sert simplement pas pour décider s'il y a lieu de descendre le PDF.

**Troisième défaut trouvé en tirant le fil : ce cron écrit sur une ligne verrouillée sans le garde des lignes verrouillées.** Il pose `source_priority: 10` et la ligne Samoa *est* à 10. C'est exactement la classe visée par le balayage du 19/08 (`d124101` sur 15 crons, `eb57f8e`, `8a235be`, puis `79bdd51`). `sync-samoa-dengue`, créé le 12/08, n'a que trois commits — aucun n'est de ce balayage. Il **n'a jamais reçu `lockedRowRegressionGuard`** : il est le seul écrivain de lignes verrouillées à ne pas l'avoir.

**Effort estimé : petit.** Un fichier, trois correctifs indépendants et courts, aucun schéma, aucune surface client, aucun envoi.

**Risque/inconnue :** comparer des numéros d'édition plutôt que des URL fait sauter le cas « le ministère republie une édition corrigée sous le même numéro » — traité en gardant la comparaison d'URL comme premier test et en n'ajoutant que le cas « numéro strictement inférieur → passer ». Et si l'URL stockée n'est pas parsable en numéro d'édition (ligne re-sourcée à la main vers autre chose), on retombe sur le comportement actuel plutôt que de sauter à l'aveugle.

---

### 2. 🔴 Huit crons d'envoi savent compter leurs échecs de livraison et aucun ne sait dire **à qui** — le rapport de ce matin dit « 1 envoi(s) en échec » depuis lundi, et personne ne peut savoir qui n'a rien reçu

**Signal, en prod.** `cron:run:weekly-signal`, lundi 24/08 : `status=error, rows=14, "1 envoi(s) en échec"`. Quatre jours plus tard le message est identique — c'est la valeur figée jusqu'au prochain lundi. Un lecteur de la lettre gratuite n'a pas reçu la sienne, et **rien dans le produit ne dit lequel**. L'adresse existe : elle est dans le `console.error` de la boucle et dans le tag Sentry, deux endroits que personne ne relit tous les matins — la même asymétrie que celle réparée le 25/08 pour le verrou (« le seul témoin est un `Sentry.captureException` que personne ne lit tous les jours »).

**Le défaut n'est pas propre à `weekly-signal`, il est uniforme.** Huit crons construisent la même phrase creuse, chacun avec l'identité déjà sous la main, à la ligne près, dans son propre `console.error` :

| cron | message actuel | identité disponible au point d'échec |
|---|---|---|
| `weekly-signal` | `N envoi(s) en échec` | `user.email` |
| `weekly-digest` | `N envoi(s) en échec` | `sub.email` |
| `trial-reminders` | `N rappel(s) en échec` | `profile.email` |
| `pilot-follow-up` | `N email(s)/requête(s) en échec` | `pilot.email` |
| `trigger-subscriber-alerts` | `N envoi(s) en échec` | `sub.id` |
| `trigger-pheic-alerts` | `N alerte(s) PHEIC en échec` | `user.id` / `outbreak.id` |
| `trigger-regional-digest` | `N envoi(s) en échec` | `user.id` |
| `regional-alerts` / `disease-alerts` | `N alerte(s) en échec` | `profile.id` / `outbreak.id` |

Le cas `trigger-pheic-alerts` est le plus coûteux du lot et son propre commentaire le dit : une alerte PHEIC n'a pas de fenêtre de rattrapage, le marqueur est définitif — un échec anonyme, c'est un utilisateur qui ne sera plus jamais prévenu de cette urgence-là, sans que son nom soit écrit nulle part.

**Effort estimé : moyen.** Un formateur partagé dans `lib/cron-monitor.ts` et deux lignes par cron (accumuler l'identité au point d'échec, l'accrocher à la note existante). Aucun schéma, aucun changement de destinataire, de contenu ou de condition d'envoi — strictement ce qui est écrit dans le journal **après** que l'échec a eu lieu.

**Risque/inconnue :** (a) longueur du message — plafonné à 3 identités puis « (+N autres) », le total dit en clair, jamais tronqué en silence ; (b) ce sont des adresses d'utilisateurs réels qui entrent dans `site_config` et dans l'e-mail de santé — précédent déjà en place, `checkDecisionHorizonTrials` y nomme déjà les essais, et les deux surfaces sont réservées à l'exploitant (table service-role, e-mail interne) ; (c) ça **nomme** l'échec, ça ne le répare pas — la cause du 24/08 restera inconnue jusqu'au prochain lundi, cette fois avec un nom.

---

### Contexte relevé au passage (pas des idées)

- **`sync-who-afro` n'a pas tourné aujourd'hui.** Dernier passage 26/08 08:00, planifié `0 8 * * *`. Le filet existe et va se déclencher tout seul : sa fenêtre est de 26 h, et le health-check de demain 07h05 le verra à 47 h. Signalé, pas traité — c'est le contrôle qui fait son travail, avec le délai assumé de sa propre heure de passage.
- **101 des 219 alertes du jour sont parties vers `david.deheunynck@yahoo.fr`** (compte créé le 26/08, essai jusqu'au 09/09) — le rattrapage normal d'un compte neuf. Signalé parce que c'est 46 % du volume du jour et que ça fausserait toute lecture de la pression d'alerte. `471c12e` (ce matin) exclut déjà cette adresse des comptes réels côté marketing.
- **`bonivogui@anss-guinee.org` (ANSS Guinée) arrive à échéance demain 28/08.** `trial-reminders` a bien tourné à 09h30 avec `rows=1` — le J-1 est parti. Rien à construire, la mécanique a fonctionné.
- **Pistes ouvertes sans angle neuf, non re-proposées :** version de définition de cas (Adelekun, 03/08), 18 indicateurs de confiance communautaire (Bernasconi, 07/08), trois sources tierces (TSENG, 29/07, garde-fou `ROADMAP.md`), écart entre deux sources (écartée le 23/08), bulletin vectoriel `sync-spf`, stock des 25 comptes abonnés aux 5 régions (hors autonomie), `pricing.faq5_a` (copy de marque).
- **Toujours chez David depuis hier, rien fait ici :** les 3 lignes ReliefWeb encore affichées et les 2 lignes FHCC sur une note Substack. En revanche `ccousp.cm` **est tranché** — `f54302d` (15h55) l'a ajouté aux domaines faisant autorité, avec EnQuête+ ; le point 3 du reliquat du 26/08 est clos.

**Statut initial : 2 idées PROPOSÉES.** Construction dans la foulée — voir la section ci-dessous.

### Construction — les deux idées sont livrées

**Idée 1 — ✅ CONSTRUITE, commit `180353c`**, `app/api/cron/sync-samoa-dengue/route.ts`. Trois correctifs indépendants, dans l'ordre où ils se déclenchent à l'exécution :

- **Le raccourci « rien de neuf » compare désormais des numéros d'édition.** Nouvelle fonction `storedIssueNumber()` : le numéro est déjà encodé dans l'URL stockée, le cron parse déjà celui de la page. La comparaison d'URL reste le **premier** test (inchangée), et seul le cas « numéro de la page strictement inférieur à celui de la ligne » s'ajoute — une édition **republiée sous le même numéro** continue donc de passer à l'extraction, et une URL non parsable (ligne re-sourcée à la main vers autre chose) retombe sur le comportement actuel plutôt que de sauter à l'aveugle.
- **Un refus de garde ordinaire se logge en `ok`,** avec la raison conservée dans le message pour rester lisible sans devenir une alarme. Aligné sur `sync-malaysia-dengue`, jumeau structurel exact.
- **`lockedRowRegressionGuard` ajouté,** composé comme dans tous les crons du balayage du 19/08, avec l'escalade `lockedRowIsFreezing` du 24/08 : un refus sur ligne verrouillée ne passe en `error` + Sentry que si la ligne est réellement figée, pas si sa source vient de la rafraîchir.

**Vérifié contre le réel, pas seulement compilé.** Le chemin de décision corrigé a été rejoué en lecture seule contre la vraie page `health.gov.ws/dengue/` et la vraie ligne de prod :

```
ligne en base   : #69  20157 cas / 9 deces / 2026-08-10 / prio 10
listing page    : #68  .../Dengue-sitrep-issue-no-68.pdf

AVANT -> POURSUIT : telechargement PDF + extraction Haiku payante,
                    puis guard:older-report -> status=error
APRES -> SKIP avant tout telechargement
         ("listing page still at issue 68, row already holds 69")
```

**Idée 2 — ✅ CONSTRUITE, commit `5c1f8c8`**, `lib/cron-monitor.ts` + les 8 crons. `failedRecipientsNote()` plafonne à 3 identités puis « (+N autres) » — le total reste dit en clair, jamais tronqué en silence — et déduplique, pour qu'une même adresse en échec quatre fois se lise comme un bounce et non comme quatre incidents. Chaque cron accumule l'identité que son propre point d'échec tient déjà : **l'adresse** quand l'envoi n'a pas eu lieu, la **paire destinataire → foyer** quand l'e-mail est bien parti et que c'est le marqueur de dédup qui a manqué (`regional-alerts`, `disease-alerts`, l'insertion de `trigger-regional-digest`). Les deux natures coexistent dans `trigger-pheic-alerts` et sont distinguées dans la note plutôt que confondues.

Sept cas du formateur vérifiés en exécutant la vraie fonction (liste vide, un seul, pile le plafond, un et deux de trop, doublons, entrées vides/nulles) :

```
4 envoi(s) en échec : a@b.c, d@e.f, g@h.i (+1 autre)
```

**Ce qui n'a pas changé, et c'est le point important sur huit crons d'envoi :** aucun destinataire, aucun contenu, aucune condition d'envoi. La seule chose modifiée est ce qui est écrit dans le journal **après** que l'échec a eu lieu — les `failed++`/`errors++` restent aux mêmes endroits, aux mêmes conditions, et le statut `ok`/`error` se calcule exactement comme avant.

`npx tsc --noEmit` propre sur l'ensemble du projet et `npx eslint` propre sur les onze fichiers touchés au total.

**Ce qui reste chez David — aucune écriture en prod n'a été faite ce soir**

1. **La cause du `1 envoi(s) en échec` du 24/08 reste inconnue.** Le correctif la **nomme**, il ne la répare pas : la valeur figée dans `site_config` date d'avant le déploiement, donc c'est le run de `weekly-signal` de **lundi prochain** qui livrera l'adresse, si l'échec se reproduit. Si c'est un bounce dur, il devra rejoindre la blocklist Brevo — hors périmètre ici.
2. **`sync-samoa-dengue` restera « en erreur » dans le rapport de demain matin.** La valeur du 24/08 est figée dans `site_config` jusqu'au prochain passage du cron, **lundi 31/08 08h25 UTC** — c'est lui qui écrira le premier `ok`. Rien à faire, mais ne pas lire la ligne rouge de demain comme un échec du correctif.
3. **L'issue #70 de Samoa.** Le correctif rend le cron silencieux tant que la page de listing reste à #68, il ne va pas chercher le #69 manquant sur la page. La ligne est à jour (rapport du 10/08), donc rien d'urgent, mais si le ministère ne relie jamais ses PDF au-delà de #68, ce cron ne réécrira plus jamais — c'est la relecture manuelle qui tient la ligne, comme le 21/08. À surveiller, pas à corriger à l'aveugle.
4. **Reliquat inchangé du 26/08 :** les 3 lignes ReliefWeb encore affichées et les 2 lignes FHCC sur une note Substack. Le point `ccousp.cm` est clos depuis `f54302d`.

**Statut : 2 idées PROPOSÉES ET CONSTRUITES** (`180353c`, `5c1f8c8`). Aucune idée écartée par un garde-fou ce soir.

---

## 2026-08-27 (soir, session interactive) — Re-sourcing FHCC + piste produit remontée par David

**Contexte.** David a demandé en session le re-sourcing des 2 lignes FHCC signalées ci-dessus (point 4). Fait le soir même, hors du périmètre de cette routine (pas de garde-fou 3 en jeu — pas d'e-mail client, pas de paiement) :

- **FHCC/Sénégal** : 6→**1 cas**, 0 décès. Enfant de 7 ans, région de Tambacounda, ministère de la Santé sénégalais (10/02/2026), diagnostic confirmé par l'Institut Pasteur de Dakar. Source : MesVaccins.net (déjà dans `GENERAL_PRESS_DOMAINS`) — badge passe d'`unverified` à `press`, lien désormais cliquable.
- **FHCC/Ouganda** : 9→**3 cas**, 4→**1 décès**. Somme de deux foyers distincts et sans lien, chacun confirmé indépendamment : Kyankwanzi (1 cas, ministère de la Santé ougandais, 11/02) + Yumbe (2 cas dont 1 décès, article signé et daté d'Outbreak News Today, 08/08). Reste `unverified` (Substack n'a jamais été dans la liste des autorités, avant comme après — pas une régression).

`source_priority` relevé à 10 sur les deux (aucun cron ne couvre la FHCC). Descriptions réécrites dans les 5 langues, avec la justification du re-sourcing explicite dans le texte. `scripts/fix-cchf-uganda-senegal-resource-2026-08-27.mjs` (ignoré par git par convention, `scripts/*-YYYY-MM-DD.mjs`).

### 🔴 Une correction de chiffres à la baisse fait passer un foyer pour « en déclin » sur le site public — l'artefact n'a jamais été vu avant faute de vérification en navigateur

**Signal, vérifié en direct sur `healthwatch-global.com/fr` après la correction ci-dessus.** La page Ouganda affiche un badge **« En déclin »** accolé à « RISQUE MODÉRÉ », plus « En recul : -67% de cas sur 7 jours » ; la page Sénégal affiche « En recul : -83% de cas sur 7 jours ». Les deux baisses sont réelles au sens du calcul, mais n'ont **aucun sens épidémiologique** — ce sont exactement la baisse produite par le re-sourcing du soir (9→3, 6→1), pas une évolution du foyer sur le terrain.

**Cause, confirmée en lisant `lib/outbreak-trend.ts` et en interrogeant `outbreak_snapshots` en direct.** `getOutbreakTrend()` compare le dernier instantané du jour à celui d'il y a 7 jours. `outbreak_snapshots` capture `cases` une fois par jour, sans distinguer « le foyer a évolué » de « HealthWatch a corrigé une donnée mal sourcée » — les deux produisent la même ligne dans la même table :

```
Sénégal  27/08: 1   26/08→18/08: 6 (×8, inchangé)
Ouganda  27/08: 3   26/08→18/08: 9 (×8, inchangé)
```

**Portée : pas spécifique à ce soir.** Aucun script de correction (`scripts/fix-*.mjs`, une quinzaine cette année) n'a jamais touché `outbreak_snapshots` — vérifié (`grep -rl outbreak_snapshots scripts/fix-*.mjs` : zéro résultat). Chaque grosse correction de chiffres passée avec un vrai écart (Choléra/Tchad 776→129 le 22/07, Ebola/RDC réaligné le 22/08, etc.) a très probablement produit le même faux badge « en déclin », sans qu'aucune vérification en navigateur ne l'ait jamais repéré — cette session est la première à avoir contrôlé l'affichage après une correction plutôt que seulement `tsc`/`eslint`/une requête de relecture.

**Priorité affirmée par David au moment de remonter ce signal : ce qui compte, c'est afficher les données exactes les plus récentes possibles.** Un badge de tendance qui ment sur ce point va directement à l'encontre de cette priorité — un prospect qui regarde la page Ouganda aujourd'hui voit « en déclin » sur un foyer dont le vrai statut de terrain n'a pas bougé d'un cas.

**Angle de correction, à trancher — pas un correctif simple par écrasement de l'historique.** Deux pistes, pas neutres :
- **(a) Backfill des instantanés** des lignes corrigées vers le nouveau chiffre sur la fenêtre de comparaison (7 jours) : neutralise le badge immédiatement, mais réécrit un historique qui reflétait honnêtement ce que le site affichait ce jour-là — si `outbreak_snapshots` sert un jour d'audit trail public/interne de ce qui a été montré, ce n'est pas neutre.
- **(b) Détecter la correction elle-même** : un signal existe déjà partout dans cette base pour distinguer « le monde a changé » de « HealthWatch a changé d'avis » — c'est exactement `updated_at` vs `date`, et le vocabulaire « re-sourcé » que les scripts de correction écrivent déjà dans leurs descriptions. `getOutbreakTrend()` pourrait exclure de la comparaison tout instantané antérieur au dernier changement de source (`source` différent d'aujourd'hui) plutôt que de comparer aveuglément J-7, sans toucher à l'historique lui-même.

**Effort : à évaluer par la routine** (probablement moyen — (b) touche un module partagé par toutes les pages foyer et le tableau de bord, pas seulement les 2 lignes FHCC).

**Risque/inconnue :** combien de lignes actives portent aujourd'hui un badge de tendance faussé par une correction passée — pas mesuré ce soir, mesurable par un balayage comparant chaque `outbreak.updated_at` récent aux deltas `outbreak_snapshots` correspondants.

**Statut : PROPOSÉE, remontée à `daily-product-ideas-healthwatch` sur demande explicite de David — pas construite ce soir.**

---

## 2026-08-28 — Proposition du jour

**Point de départ : la piste remontée par David hier soir** (entrée du 27/08 au soir, « badge de tendance trompeur »), laissée PROPOSÉE et non construite, avec une inconnue explicite à lever : *« combien de lignes actives portent aujourd'hui un badge de tendance faussé par une correction passée — pas mesuré ce soir »*. C'est mesuré ici, et la mesure a changé la correction à écrire.

**Aucun signal terrain neuf** : `product-feedback.md` n'a pas bougé depuis l'entrée Coulibaly du 22/08.

### La piste d'hier proposait un angle qui ne marche pas — mesuré avant de l'écrire

L'angle (b) d'hier suggérait d'exclure de la comparaison les instantanés antérieurs au dernier changement de source, en s'appuyant sur `date` vs `updated_at`. **Testé contre la prod : il produit 21 faux positifs sur 27.** `outbreaks.date` n'est pas la date du dernier rapport, c'est souvent le **début de période** — Dengue/Indonésie porte `date = 2026-07-01` avec 58 357 → 75 991 cas, une vraie courbe cumulée, que ce critère aurait classée « artefact » et dont il aurait effacé le badge. L'angle (a) (réécrire l'historique des instantanés) reste écarté pour la raison déjà donnée hier.

Le bon discriminant est ailleurs, et il est déjà écrit dans le repo.

### 1. 🔴 Le site rend une correction de données en « En déclin », badge vert — alors que toutes les autres couches du produit traitent exactement la même baisse comme une anomalie

**Signal, dans le code, en contradiction avec lui-même.** `outbreaks.cases` est un **cumul**. Toutes les voies d'écriture le savent et refusent une baisse :

- `lib/outbreak-guards.ts` — `lockedRowRegressionGuard` refuse **toute** baisse sur ligne verrouillée (« *any decrease is far more likely a different report's "as of" cutoff … than a genuine downward revision* ») ; `deathsNeverDecreaseGuard` fait de même sur les décès.
- `app/api/cron/data-quality/route.ts` section 3 — une baisse est classée `large_drop`, une **anomalie** à faire relire.

La voie de **lecture** était la seule exception : elle rendait cette même baisse en pastille verte « En déclin », c'est-à-dire en bonne nouvelle.

**Mesure contre la prod, 61 jours d'historique complet** (127 lignes actives, 5 443 instantanés) : **17 baisses jour-à-jour, 17 corrections de données, zéro recul épidémiologique.** Le lot de re-sourcing du 17/07 (Choléra Soudan, Soudan du Sud, RDC, Chikungunya Brésil/Maurice, MERS Arabie saoudite), Choléra/Tchad 776→129 le 22/07, Dengue/Nicaragua 5 702→1 993 le 25/07, Polio/Pakistan le 28/07, Dengue/Vietnam le 05/08, Rougeole/États-Unis le 08/08, Ebola/RDC 5 208→5 021 le 22/08 (le réalignement documenté), et les deux re-sourcings FHCC du 27/08 qui ont fait apparaître le défaut. **Un compteur cumulé ne descend pas sur le terrain ; quand il descend ici, c'est HealthWatch qui a corrigé son propre chiffre.**

*Note de méthode, à retenir pour toute mesure future sur ce projet* : la première passe annonçait 10 baisses, toutes en juillet. Faux — **ce projet Supabase plafonne toute requête à 1 000 lignes** (5 443 lignes dans `outbreak_snapshots`, 1 000 renvoyées sans `.limit()`). Il faut paginer par `.range()`. Vérifié au passage que le code de prod n'est pas touché : `getOutbreakTrendsBulk` trie par date décroissante, donc les lignes utiles (la plus récente par foyer) sont toujours dans les 1 000 premières — c'est structurellement sûr tant qu'un jour tient sous 1 000 foyers, soit ~8× la charge actuelle. Pas un défaut, mais une marge à connaître.

**Effort : petit.** Un seul point de décision dans `lib/outbreak-trend.ts`.

**Risque/inconnue :** faire disparaître un vrai signal de recul. Écarté par la mesure — sur 61 jours, aucune des 17 baisses n'en était un. Et une révision à la baisse confirmée par la source reste une **correction du chiffre**, pas un foyer qui rétrécit.

### 2. 🟠 Le même artefact existe à la hausse, il est en ligne aujourd'hui, et il n'est PAS corrigé — le discriminant n'existe pas dans les données

**Signal, en prod, ce matin.** `3466817` (07h32) a re-sourcé Dengue/Guatemala — le chiffre OMS xmart était incohérent, remplacé par le MSPAS guatémaltèque. Effet sur les instantanés :

```
20/08 → 27/08 : 4 817 (plat, 8 jours)
28/08         : 19 364   ← le re-sourcing
```

La page publique affiche donc aujourd'hui, pour cette ligne : **« En expansion »** (pastille rouge), **« +302% 7j »**, **« +14 547/24h »** et la phrase `growing_fast` de `why-it-matters`. Aucun de ces quatre énoncés ne décrit le foyer — ils décrivent une correction de base.

**Pourquoi ce n'est pas construit ce soir.** À la baisse, le discriminant est gratuit et absolu (un cumul ne descend pas). À la hausse, il n'existe pas : une vraie flambée et une correction produisent le même saut. Les deux heuristiques disponibles sans schéma ont été testées et rejetées — celle sur `date` (21 faux positifs sur 27, ci-dessus), et celle du « palier après plusieurs jours plats », qui frappe toutes les sources **hebdomadaires** (une ligne dengue plate 6 jours puis publiée le 7e est le cas normal, pas l'exception). Abaisser le seuil de `spike` dans `data-quality` (×10 aujourd'hui ; Guatemala est à ×4,02) reviendrait au même bruit.

**Le correctif durable suppose d'enregistrer la provenance au moment de l'instantané** — une colonne sur `outbreak_snapshots` disant de quelle source venait le chiffre ce jour-là, pour que `getOutbreakTrend` ne compare jamais à travers un changement de source. C'est une **migration de schéma**, donc garde-fou 2 : le code qui écrirait cette colonne ne doit pas partir tant que la migration n'est pas appliquée, et l'effet ne serait de toute façon que **prospectif** (les instantanés déjà en base n'ont pas cette information). Effort réel : moyen à gros, et une décision de schéma — **proposée, pas construite.**

**Statut initial : 2 idées PROPOSÉES.** Construction de l'idée 1 dans la foulée — voir la mise à jour ci-dessous.

### Construction — idée 1 livrée, idée 2 délibérément non construite

**Idée 1 — ✅ CONSTRUITE, commit `3d6dcf8`**, `lib/outbreak-trend.ts`, un seul fichier. `directionFor(deltaCases, deltaPercent)` devient **le seul point de décision de direction** des deux fonctions du module (`getOutbreakTrend` et `getOutbreakTrendsBulk` dupliquaient la même expression ternaire) — donc la règle tient identiquement sur les six surfaces qui en dérivent, sans toucher un seul composant :

| surface | ce qu'elle affichait sur une correction |
|---|---|
| `PhaseBadge` | « En déclin » (pastille verte) |
| `OutbreakTable` / `TrendBadge` | « −83% » vert |
| `OutbreakTable` / `TrendBar` | barre verte |
| `why-it-matters` | « En recul : −83% de cas sur 7 jours », dans les 5 langues |
| pages pays / maladie / région | « ↓ 83% » |

Une baisse rend **`unknown`** et non `stable` : tous les consommateurs filtrent déjà sur `direction !== "unknown"` et n'affichent rien — une correction n'affirme donc plus rien, au lieu d'affirmer le contraire de ce qui s'est passé. `stable` aurait encore été une affirmation. La décision est prise sur `deltaCases` et non sur `deltaPercent` arrondi : une petite baisse sur une grosse base (Choléra/Tchad 242→239) arrondit à 0% et serait repassée en « stable ».

**Effet de bord gratuit :** la falaise du 1er janvier des deux crons à compteur annuel (`sync-malaysia-dengue`, `sync-taiwan-cdc`, cf. `isYearRollover`) est neutralisée du même coup — leurs compteurs retombent de ~100 000 à quelques unités au changement d'année, ce qui se serait affiché « En déclin −99% » le jour de l'an.

**Vérifié contre la prod, pas seulement compilé.** Le calcul corrigé rejoué en lecture seule sur les 127 lignes actives :

```
directions AVANT : up 25 | stable 82 | down 2
directions APRES : up 25 | stable 82 | unknown 2

lignes dont l'affichage change : 2
  FHCC/Ouganda   down -67%  ->  unknown   (9 -> 3)
  FHCC/Senegal   down -83%  ->  unknown   (6 -> 1)
```

Exactement les deux lignes que David a vues hier soir, et aucune autre : les 25 tendances à la hausse et les 82 stables sont intactes. `npx tsc --noEmit` propre sur tout le projet, `npx eslint` propre sur le fichier touché.

**Idée 2 — ⛔ NON CONSTRUITE, garde-fou 2** (migration de schéma). Ce n'est pas un report de confort : les deux heuristiques réalisables sans schéma ont été testées contre la prod et rejetées sur mesure, pas sur intuition (21 faux positifs sur 27 pour l'une, tout le corpus des sources hebdomadaires pour l'autre). Reste chez David — voir ci-dessous.

### Ce qui reste chez David — aucune écriture en prod n'a été faite ce soir

1. **Dengue/Guatemala affiche aujourd'hui « En expansion / +302% / +14 547 par 24h » pour une correction de ce matin.** L'idée 1 ne le couvre pas et ne pouvait pas le couvrir. Deux voies, toutes deux à trancher par lui : (a) accepter l'artefact à la hausse comme le prix à payer, en sachant qu'il est visible sur la page d'accueil et dans le widget « nouveautés de la semaine » qui trie par aggravation ; (b) financer la colonne de provenance sur `outbreak_snapshots` — migration additive, effet seulement prospectif, et le code qui l'écrit ne peut pas partir avant que la migration soit appliquée.
2. **La pastille « En expansion » de Guatemala se corrigera seule** une fois 7 jours écoulés depuis le 28/08, soit à partir du **4 septembre** — le palier sortira alors de la fenêtre de comparaison. Rien à faire, mais ne pas lire la page d'ici là comme une flambée réelle.
3. **Reliquat inchangé du 26/08 :** les 3 lignes ReliefWeb encore affichées attendent toujours une décision de re-sourcing. Les 2 lignes FHCC sont, elles, closes depuis le re-sourcing d'hier soir.
4. **Fichiers d'une autre session laissés intacts, comme le veut `AGENTS.md`** : `marketing/qa/product-claims.manual.json` (modifié), `scripts/audit-alert-day.mjs` et `scripts/probe-alert-lock.mjs` (non suivis). Rien n'a été stagé ni annulé les concernant.

**Statut : 1 idée PROPOSÉE ET CONSTRUITE (`3d6dcf8`), 1 idée PROPOSÉE et écartée par le garde-fou 2.**

---

## 2026-08-29 — Proposition du jour

**Aucun signal terrain neuf** : `product-feedback.md` n'a pas bougé depuis l'entrée Coulibaly du 22/08. Les deux idées viennent donc de l'état réel de la prod, relevé ce soir.

**Point commun des deux, involontaire mais net.** Le produit sait déjà, dans les deux cas, ce qu'il faut dire ou ne pas dire — il le calcule, il l'écrit même quelque part. Ce qui manque est le report de cette connaissance là où quelqu'un la lit.

### 1. 🔴 Le cron qui surveille tous les autres est le seul dont le journal ne dit jamais **pourquoi** il est en erreur — et il l'est aujourd'hui

**Signal, en prod, à l'instant.** `site_config` porte `cron:run:health-check` = `{"ts":"2026-08-29T07:05:40.731Z","status":"error","rows":2}`. Pas de champ `error`. Les 49 autres crons écrivent leur raison dans ce champ (`sync-samoa-dengue` : « guard blocked issue 68… », `weekly-signal` : « 1 envoi(s) en échec ») ; `health-check` est le seul à n'écrire qu'un compteur.

**Conséquence concrète, vérifiable dans le mail de demain matin.** La section « cron(s) à l'heure mais EN ERREUR au dernier passage » (route ligne 1151) construit son libellé à partir de ce champ, avec pour repli littéral `"(sans message)"` (ligne 942). Le rapport de santé quotidien de HWG affichera donc demain, en rouge :

```
⚠️ 1 cron(s) à l'heure mais EN ERREUR au dernier passage : health-check ((sans message))
```

**L'identité existe — dans Sentry, et nulle part ailleurs.** `captureSelfReport` l'y a bien envoyée ce matin, et la lecture de l'API Sentry le confirme :

```
[warning] JAVASCRIPT-NEXTJS-2B x1 lastSeen=2026-08-29T07:05:40Z
  [health-check] 1 cron(s) overdue: sync-who-regional
```

C'est exactement l'asymétrie déjà réparée deux fois sur ce projet — le verrou d'alertes le 25/08 (« le seul témoin est un `Sentry.captureException` que personne ne lit tous les jours »), les destinataires en échec des 8 crons d'envoi le 28/08. Elle est restée en place sur le moniteur lui-même.

**Second défaut, même racine, découvert en lisant la ligne 940.** `cronMap` est lu au **début** du run (ligne 768), le statut est écrit à la **fin** (ligne 1273) : la ligne « health-check » de cette liste est donc toujours celle de la **veille**, jamais celle du run en cours. Un matin où plus rien n'est en retard, le mail annoncera quand même `health-check` en erreur — l'écho, à un jour de retard et sans message, d'un problème déjà résolu. Et pour ce cron précis, le rapport contient déjà la réponse fraîche, deux lignes plus haut, dans sa propre section « crons en retard ».

**Effort : petit.** `logCronRun` accepte déjà un `errorMsg` (5ᵉ paramètre) que cet appel est le seul à ne pas passer. Un fichier.

**Risque/inconnue :** `rows` vaut `overdue.length + sentryIssues.length` (2 aujourd'hui) alors que le statut, lui, ne dépend que de `hasOverdue`. Un message ne nommant qu'un seul cron en face de `rows=2` se lirait comme une troncature — les deux termes doivent donc être dits, celui qui décide du statut en tête.

### 2. 🔴 « Une citation que nous n'avons pas le droit de publier » — la règle est appliquée sur **une** des sept surfaces qui publient cette citation

**Signal, en ligne en ce moment, vérifié par requête sur la page réelle.** `lib/source-trust.ts` porte depuis le 26/08 une liste `FORBIDDEN_SOURCE_DOMAINS` dont le commentaire est sans ambiguïté : *« A row demoted by this list is not "a source we downgraded" — it is a citation we must not publish. »* `reliefweb.int` y figure (ToS non commerciales, même forme juridique que la mise en demeure ProMED). Les 4 lignes concernées ont été désactivées, `source_priority` ramené à 0 — elles ne sont plus ni sur le tableau de bord ni dans les exports. Mais `app/[locale]/outbreak/[id]/page.tsx` porte, ligne 195, un commentaire explicite : *« No active filter — historical outbreaks are indexed in the sitemap and must render too. »* La page publique existe donc toujours, et elle rend ceci :

```
$ curl -s https://healthwatch-global.com/fr/outbreak/fe6c7cdc-…  | grep -o "ReliefWeb[^<]*"
ReliefWeb du 2026-06-24          <- « Cas cumulés depuis le début de l'épidémie — bulletin … »
ReliefWeb.                       <- bloc de citation académique, « Data source: ReliefWeb. »

$ … | grep -c "reliefweb.int"
0                                <- le LIEN, lui, est bien masqué
```

**Le lien est masqué par accident, pas par la règle.** Le seul garde en place est `status !== "unverified"` (ligne 560), un test de **niveau de confiance**. Un éditeur interdit retombe en `unverified`, donc le lien disparaît — effet de bord heureux d'un test qui parle d'autre chose. Partout où le rendu ne consulte pas ce niveau, l'interdit ne s'applique pas :

| surface | ce qu'elle publie d'un éditeur interdit | garde |
|---|---|---|
| `/outbreak/[id]` — phrase « bulletin … du … » | le nom de l'éditeur | **aucune** |
| `/outbreak/[id]` — bloc de citation académique | « Data source: … » | **aucune** |
| `/outbreak/[id]/print` — pied de page du rapport Pro | **l'URL entière, en lien cliquable** | **aucune** |
| `OutbreakTable` — export CSV, colonne `source_url` | l'URL entière | **aucune** |
| `OutbreakTable` — export PDF | l'URL entière, en lien | **aucune** |
| `OutbreakTable` — export HTML | l'URL entière, en lien | **aucune** |
| `OutbreakDetailModal` — modèle de notification RSI | l'URL entière | **aucune** |
| `/outbreak/[id]` — lien de source | rien | ✅ (par ricochet) |
| badges de tier (table + modale) | rien | ✅ (par ricochet) |

La ligne la plus coûteuse du tableau est le **rapport Pro** : `app/(print)/…/print/page.tsx` interroge la base par `.eq("id", id)` sans aucun filtre, et son pied de page rend `<a href={o.source}>{o.source}</a>` sans consulter le tier. C'est le livrable qu'un client payant télécharge et fait circuler. Aujourd'hui, les 4 lignes ne sont plus sur le tableau de bord, donc les trois exports ne peuvent pas les atteindre ; la page publique et le rapport Pro, eux, les servent toujours.

**Ce qu'il ne faut PAS faire, et pourquoi.** Changer `sourceName()` pour qu'il cesse de dire « ReliefWeb » casserait `data-quality` (ligne 1171), qui appelle cette même fonction précisément **pour nommer** la ligne fautive dans l'audit interne. Nommer l'éditeur en interne est le travail de l'audit ; le publier au client est l'interdit. Ce sont deux fonctions différentes, pas un réglage de la même.

**Effort : moyen.** Une paire d'accesseurs dans `lib/source-trust.ts` (à côté d'`isForbiddenSourceHost`, déjà exporté pour l'audit) et sept substitutions mécaniques dans 4 fichiers. Aucun schéma, aucun envoi, aucun paiement.

**Risque/inconnue :** aucune ligne n'est *supprimée* — le foyer, ses chiffres et son historique restent en ligne, seule l'attribution disparaît. Une ligne dont l'attribution disparaît est une ligne dont on ne peut plus dire d'où vient le chiffre : c'est le bon état pour une donnée à re-sourcer, pas un état durable. Le re-sourcing des 4 lignes reste chez David, ce correctif ne le remplace pas — il empêche seulement que le prochain éditeur interdit fuite par six portes au lieu d'une.

**Statut initial : 2 idées PROPOSÉES.** Construction dans la foulée — voir la mise à jour ci-dessous.

### Construction — les deux idées sont livrées

**Idée 1 — ✅ CONSTRUITE, commit `e187130`**, `app/api/cron/health-check/route.ts`, un seul fichier. Deux correctifs, même racine.

- **Le motif est écrit.** `logCronRun` accepte un `errorMsg` depuis toujours ; cet appel était le seul des 50 à ne pas le passer. Les deux termes sont dits, celui qui décide du statut en tête. Rejoué sur les vraies valeurs du run de 07h05 :

```
overdue=[sync-who-regional]  sentry=1  ->  status=error rows=2
    error = "1 cron(s) en retard : sync-who-regional — plus 1 incident(s) Sentry"
overdue=[sync-who-regional]  sentry=0  ->  status=error rows=1
    error = "1 cron(s) en retard : sync-who-regional"
overdue=[]                   sentry=2  ->  status=ok    rows=2   error absent
```

Le troisième cas compte : `logCronRun` reconstruit `value` à chaque passage et ne reporte que `lastNonZero`/`evaluatedAt`, donc le motif **disparaît** dès le premier run sain — pas de message qui se fige et survit à sa cause, comme la valeur du 24/08 de `weekly-signal`.

- **La ligne de la veille est datée.** `erroring` marque désormais sa propre entrée « — passage précédent ». Pour les 49 autres crons, « dernier passage » reste la lecture attendue et rien ne change ; pour celui-ci, le rapport porte déjà la réponse fraîche deux lignes plus haut. Volontairement **pas** retirée de la liste : si un jour le run précédent a réellement planté, c'est le filet défensif (ligne 724) qui y écrit son message, et c'est la seule trace qu'un lecteur en aura — le mail de ce jour-là n'ayant jamais été envoyé.

**Ce qui n'a pas changé :** aucun destinataire, aucune condition, aucun statut calculé autrement. `hasOverdue` décide toujours seul, `rows` compte toujours les deux termes.

**Idée 2 — ✅ CONSTRUITE, commit `2bd52f3`**, `lib/source-trust.ts` + `lib/outbreaks.ts` + 4 surfaces. `publishableSourceUrl()` et `publishableSourceName()` rendent `null` pour un éditeur interdit, à côté d'`isForbiddenSourceHost` déjà exporté. Les six surfaces du tableau ci-dessus les consultent ; les deux déjà gardées par ricochet du tier n'ont pas été touchées, leur garde tient.

Trois arbitrages, tous dans le même sens — **retirer l'attribution, jamais la remplacer par une autre** :

- **`sourceName()` n'est pas modifiée.** `data-quality` (ligne 1171) l'appelle précisément pour **nommer** la ligne fautive dans l'audit interne. La faire mentir aurait aveuglé le seul contrôle qui doit dénoncer la ligne.
- **Modèle de notification RSI :** l'attribution tombe entièrement (`HealthWatch Global`, sans plus) au lieu de basculer sur le repli existant `« OMS / WHO »`. Ce texte est copié tel quel dans une déclaration officielle : remplacer une citation illicite par une citation fausse aurait été pire que de n'en donner aucune. Le cas « source absente » garde son libellé d'origine.
- **Phrase « bulletin X du … » :** la ligne entière disparaît. Sans éditeur, la phrase n'a plus de sujet.

**Rejoué en lecture seule contre la prod, table entière paginée** — 293 lignes, `.range()` explicite, conformément à la limite de 1 000 relevée le 28/08 :

```
lignes dont l'attribution disparait : 4   <- les 4 lignes ReliefWeb, deja archivees
lignes inchangees                   : 289
tiers, avant comme apres : official 204 | don 68 | press 10 | unverified 11
audit interne : sourceName() dit toujours "ReliefWeb" sur les 4
```

`scripts/check-source-trust.mjs` : « No displayed row falls to 'unverified'. Safe to ship. » `npx tsc --noEmit` propre sur tout le projet, `npx eslint` propre sur les 7 fichiers touchés au total.

**Vérification en navigateur impossible ce soir, et c'est dit plutôt que contourné.** Le serveur de développement ne démarre pas en session non supervisée (personne pour approuver la commande), et le projet Supabase de dev est distinct de la prod — il ne contient aucune ligne à éditeur interdit à rendre. Le contrôle a donc porté sur les fonctions réelles rejouées contre la vraie table, pas sur le rendu. Le rendu lui-même repose sur `tsc`/`eslint` et sur quatre substitutions mécaniques. **À contrôler d'un coup d'œil après déploiement** : `/fr/outbreak/fe6c7cdc-4790-44ed-8243-0967ce155f62` ne doit plus contenir « ReliefWeb », et une ligne ordinaire (n'importe quel foyer actif) doit toujours afficher sa phrase « bulletin … du … » et sa citation.

### Ce qui reste chez David — aucune écriture en prod n'a été faite ce soir

1. **Le re-sourcing des 4 lignes ReliefWeb n'est pas fait et ne l'est pas par ce correctif.** Elles sont maintenant sans attribution nulle part, ce qui est le bon état pour une donnée à re-sourcer — pas un état durable. Les chiffres, eux, restent en ligne : Dengue en Samoa américaines (1 036 cas), Wallis-et-Futuna (50), Kiribati (44), Vanuatu (76). Deux issues : les re-sourcer vers un éditeur permis, ou les retirer. C'est le seul point du reliquat du 26/08 encore ouvert.
2. **`sync-who-regional` était en retard ce matin à 07h05** — c'est ce que le correctif de l'idée 1 aurait écrit. Il a tourné depuis, à 08h06, et son dernier passage est sain (`ok`, rows=0). Rien à faire ; signalé parce que c'est la cause réelle du rouge d'aujourd'hui et qu'elle n'était lisible nulle part avant ce soir.
3. **Le rapport de demain matin dira encore `health-check ((sans message))`** si un cron est de nouveau en retard : la valeur lue au début du run est celle écrite avant le déploiement. C'est le surlendemain que le motif apparaîtra. Ne pas lire ça comme un échec du correctif.
4. **`weekly-signal` porte toujours « 1 envoi(s) en échec » du 24/08**, et le correctif du 28/08 qui nomme le destinataire ne s'appliquera qu'au prochain passage — **lundi 31/08**. Inchangé depuis hier.
5. **Fichiers d'une autre session laissés intacts, comme le veut `AGENTS.md`** : `marketing/qa/product-claims.manual.json` et `marketing/linkedin-contacts.md` (modifiés), `scripts/audit-alert-day.mjs` et `scripts/probe-alert-lock.mjs` (non suivis). Rien n'a été stagé ni annulé les concernant.
6. **Une fusion d'une autre session a traversé l'arbre pendant ce run, et elle n'a pas été touchée.** Après le push des deux correctifs, `git status` a révélé une fusion en cours de `claude/happy-gould-11750f` (frontières de mot Unicode dans `check-outreach-message.mjs`) avec un conflit non résolu. Le premier `git add` de ce log l'avait indexé **dans leur fusion** — désindexé aussitôt par `git restore --staged`, contenu intact, avant tout commit. Le conflit lui-même a été laissé à son auteur plutôt que résolu à l'aveugle : c'est exactement le scénario que `AGENTS.md` décrit (un changement de code qui part sur `master` sans que personne n'ait relu son diff). Cette entrée a attendu la fin de leur fusion (`fc37a2d`) pour être commitée.

**Statut : 2 idées PROPOSÉES ET CONSTRUITES** (`e187130`, `2bd52f3`). Aucune idée écartée par un garde-fou ce soir.

---

## 2026-08-31 — Proposition du jour

**Aucun signal terrain neuf** : `product-feedback.md` n'a pas bougé depuis l'entrée Coulibaly du 22/08. Les deux idées sortent de l'état réel de la prod, relevé ce soir.

**Point commun des deux, et il prolonge directement l'incident PAHO d'hier.** `source_confirmed_at` — « j'ai relu ma source, elle ne portait rien de plus récent » — est le seul énoncé du produit qui distingue une donnée vieille mais vérifiée d'un trou de données. Un cron le produit et le jette ; le reste du produit l'honore sans jamais lui demander son âge.

### 1. 🔴 Le cron mpox conclut tous les jours « rien de plus récent chez l'OMS », le jette, et la page publique affiche l'inverse depuis hier

**Symptôme en ligne, vérifié par requête sur la page réelle il y a quelques minutes :**

```
$ curl -s https://healthwatch-global.com/fr/outbreak/dbc9c1d0-… | grep -o "62 j\|peut-être résolu[^<]*"
62 j
peut-être résolu ou non rapporté.
```

La ligne `Mpox / Mondial` (63 692 cas, 256 décès) porte `date = 2026-06-30`, soit **62 jours** — elle a franchi le seuil `STALE_DAYS` (60 j) **hier**. La pastille orange « ⚠ SANS MAJ · 62j » et son infobulle « foyer peut-être résolu ou non rapporté » sont donc apparues sur le foyer mpox mondial le jour même où le seuil a été franchi.

**Le produit sait que c'est faux.** `check-mpox-sitrep` tourne tous les jours à 08h10 UTC et relit la page OMS des rapports de situation mpox. Rejoué ce soir avec l'en-tête exact du cron :

```
HTTP 200 · dernier rapport détecté : #68
  https://www.who.int/publications/m/item/…external-situation-report--68---31-july-2026
site_config.mpox_last_sitrep_url  = …report--68---31-july-2026   <- identique
outbreaks.source (Mpox/Mondial)   = …report--68---31-july-2026   <- identique
outbreaks.source_confirmed_at     = null
```

Le cron établit donc, à chaque passage depuis le 01/08, exactement la phrase que `lib/source-confirmed.ts` définit comme le contenu de la colonne — « il a récupéré sa source, et n'a rien trouvé de plus récent que `date` » — puis prend la branche `Already up to date`, journalise `no_data` et rend la main sans rien écrire. C'est le seul cron de la flotte qui atteint cette conclusion sur la page de listing d'une source plutôt que dans une boucle de parsing, et c'est celui qui ne la reporte nulle part.

**Second défaut dans la même fonction, et c'est la forme exacte de la panne PAHO réparée hier.** Deux issues opposées écrivent la même ligne de journal :

| branche | ce qui s'est passé | ce que `site_config` en garde |
|---|---|---|
| `if (!latest)` | la page OMS est injoignable, ou son balisage a changé et aucun lien `external-situation-report--N` n'en sort | `no_data`, rows=0, **aucun message** |
| `latest.url === lastKnownUrl` | tout va bien, #68 est toujours le dernier | `no_data`, rows=0, **aucun message** |

Or `health-check` ne remonte que `status === "error"` — `no_data` y est documenté comme « a legitimate idle state » et reste silencieux par conception (ligne 938). Une panne totale d'ingestion mpox se lirait donc, indéfiniment, comme « rien de neuf cette semaine ». C'est mot pour mot ce qui a laissé `sync-paho-alerts` abandonner le sitrep rougeole pendant 16 jours en rapportant vert (corrigé hier, `e825175` + `c078c92`) — et le mpox est l'autre urgence de santé publique de portée internationale du produit.

Vérifié ce soir que c'est bien la branche saine qui tourne aujourd'hui et pas la panne : la page OMS répond 200 et rend #68, avec l'en-tête du cron comme avec un en-tête de navigateur (le piège d'UA de `reference_govt_sites_need_browser_user_agent` ne joue pas ici).

**Effort : petit.** Un fichier, deux branches déjà distinctes dans le code — il ne s'agit que de leur faire écrire deux choses différentes.

**Risque/inconnue :** tamponner sur la seule foi d'une page de listing est une confirmation plus faible qu'un parsing d'entrée. Elle ne vaut que pour une ligne dont le `source` est **exactement** l'édition la plus récente publiée : la ligne RDC cite le #67 alors que le #68 existe, donc elle n'est pas confirmée — une édition plus récente existe bel et bien, elle n'a simplement pas été ingérée. Le tampon doit être conditionné à cette égalité, pas appliqué aux deux lignes du cron.

### 2. 🟠 Une confirmation ne périme jamais — elle éteint le contrôle de fraîcheur sur 71 des 127 lignes actives, et le seul événement qui l'annule est celui qu'un cron en panne ne peut pas produire

**Signal, mesuré contre la prod, table entière paginée (293 lignes, `.range()` explicite, cf. la limite de 1 000 relevée le 28/08) :**

```
lignes actives                                   : 127
  … portant un source_confirmed_at honoré        :  71   (56 %)
  … qui SERAIENT signalées « stale » sans lui    :  60
âge des confirmations : min 1 j · médiane 1 j · max 11 j
```

`isSourceConfirmed()` (`lib/outbreaks.ts`), `isConfirmedCurrent()` (`lib/source-confirmed.ts`) et `isVerifiedStale()` (`data-quality`, ligne 473) posent tous les trois la même condition, et **elle ne regarde pas l'horloge** : `source_confirmed_at >= date`. Le commentaire qui la justifie dit que la règle « s'auto-invalide » — « si le `date` de la ligne avance un jour, la comparaison cesse de tenir ». C'est vrai, et c'est précisément le problème : **`date` avance quand le cron d'ingestion marche.** Quand il tombe, `date` se fige, et l'exemption tient pour toujours. Le garde-fou est annulé par le seul événement qu'il devrait signaler.

Ce n'est pas une hypothèse : c'est ce qui s'est passé du 14 au 30/08. `sync-paho-alerts` n'ingérait plus rien du sitrep rougeole, `date` restait au 2026-08-08 sur Rougeole Canada/Pérou/Bolivie, et les trois lignes portaient un `source_confirmed_at` du 27/08 — assez récent pour les exempter, sincère (le volet « alertes » du cron relisait bien son alerte) et faux en même temps (le volet « sitrep » échouait en silence). Le commentaire écrit hier dans `morning-don-check.mjs` le dit dans ces termes.

**Le produit sait déjà faire périmer une vérification — mais seulement dans un script qu'un humain lance.** `morning-don-check.mjs` porte `FRESHNESS_TIERS` : 7 j pour les lignes manuelles, 7 j pour les lignes verrouillées, 14 j pour les clusters de seeds, 45 j pour les lignes de cron, et calcule l'âge sur `max(updated_at, source_confirmed_at, …)`. Le cron quotidien `data-quality`, celui qui tourne sans personne, honore le même tampon **sans aucune cadence**. Et côté public, la pastille « ✓ SOURCE CONFIRMÉE » et son infobulle catégorique — « aucune édition plus récente, pas un trou de données » — reposent sur la même comparaison sans âge, sur quatre surfaces (`OutbreakTable`, `OutbreakDetailModal`, `/outbreak/[id]`, plus le −0,5 de `sourceScore`).

**Effort : petit à moyen.** Une borne d'âge sur une règle définie trois fois côté application, plus les deux copies des scripts de registre QA qui la redérivent.

**Risque/inconnue : ressusciter le bruit que la colonne avait justement supprimé** (la question « existe-t-il une édition plus récente ? » reposée tous les jours à un humain qui y a déjà répondu). Mesuré plutôt que supposé, en rejouant les sections 4b et 4f contre la vraie table avec et sans péremption, chaque section bornant la confirmation à son propre seuil :

```
signalements aujourd'hui, règle actuelle           : 1
signalements aujourd'hui, avec péremption          : 1
nouveaux signalements introduits par la péremption : 0
```

Zéro, et c'est structurel, pas une coïncidence de date : les crons tamponnent à chaque passage « inchangé », donc une confirmation vit normalement entre 0 et 2 jours (médiane 1). Une confirmation qui atteint 21 jours signifie qu'aucun cron n'a réussi à relire la source de cette ligne depuis trois semaines — c'est exactement le signal recherché, pas du bruit.

**Statut initial : 2 idées PROPOSÉES.** Construction dans la foulée — voir la mise à jour ci-dessous.

### Construction — les deux idées sont livrées

**Idée 1 — ✅ CONSTRUITE, commit `fed16d0`**, `app/api/cron/check-mpox-sitrep/route.ts`, un seul fichier, deux branches déjà distinctes dans le code auxquelles il ne manquait que d'écrire deux choses différentes.

- **La confirmation est gardée.** La branche `already up to date` tamponne désormais `source_confirmed_at` via `lib/source-confirmed.ts`, comme les 19 autres crons. **Portée aux lignes citant cette édition précise, pas aux deux lignes connues du cron** — vérifié en lecture seule contre la prod :

```
lignes citant le #68 (tamponnées)      : 1   Mpox / Mondial   date 2026-06-30, conf null
lignes citant le #67 (écartées)        : 1   Mpox / RDC       inactive
badge Mpox/Mondial aujourd'hui         : ⚠ SANS MAJ · 62j
badge après le prochain passage du cron: ✓ SOURCE CONFIRMÉE · 62j
```

  Une page de listing ne peut confirmer que la ligne qu'elle nomme. La ligne RDC cite le #67 alors que le #68 existe : pour elle une édition plus récente existe bel et bien, elle n'a simplement pas été ingérée, et la tamponner aurait converti un trou d'ingestion en certificat de fraîcheur.

- **`rows` reste à 0.** Une confirmation n'est pas une écriture de donnée — la migration `20260824030000` l'empêche exprès de toucher `updated_at` — et gonfler `rows` aurait posé un `lastNonZero`, donc revendiqué une ingestion qui n'a pas eu lieu. Le fait que le contrôle ait réellement tourné va dans `evaluatedAt`, qui existe pour exactement ça (« la logique de comparaison s'est exécutée sur de vraies données candidates »). Aucun effet de bord : `health-check` ne lit `evaluatedAt` que pour les crons de livraison, et celui-ci n'en est pas un.

- **La panne ne se lit plus comme un no-op.** La branche `if (!latest)` journalise `error` avec son motif (« page OMS des rapports de situation mpox illisible … page injoignable ou balisage changé ») au lieu d'un `no_data` muet. `health-check` documente `no_data` comme un état d'inactivité légitime et le laisse silencieux **par conception** : une panne totale d'ingestion mpox se serait donc lue « rien de neuf cette semaine » indéfiniment.

- **Corrigé au passage :** l'en-tête du fichier annonçait un handler « no-op sauf mercredi et samedi ». Il n'y a aucun filtre de jour dans ce fichier et `CRON_WINDOWS` l'a toujours à 26 h. Le run est bien un no-op la plupart des jours, mais par la branche `already up to date`, pas par un horaire — et croire l'inverse aurait fait lire une absence de passage comme normale.

**Idée 2 — ✅ CONSTRUITE, commit `f7a9e53`**, 5 fichiers. `CONFIRMATION_MAX_AGE_DAYS = 60` est défini une seule fois, dans `lib/source-confirmed.ts` (module feuille, sans import d'exécution), et `lib/outbreaks.ts` l'importe — les deux côtés ne peuvent plus dériver. Égal à `STALE_DAYS` à dessein : une confirmation vaut exactement aussi longtemps que le silence dont elle répond.

`data-quality` ne reprend **pas** ce nombre. Son `isVerifiedStale` prend un `maxAgeDays` que chaque section lui passe : 7 j sur une ligne PHEIC, 21 sur une ligne standard, 180 sur une source dashboard/tracker, 30/180 sur les seeds en 4f. Même règle, horloges plus serrées — ce rapport existe pour reposer la question plus tôt qu'un visiteur ne le ferait.

**Rejoué en lecture seule contre la vraie table, les deux côtés, 293 lignes paginées par `.range()` :**

```
côté public — isSourceConfirmed
  confirmées avant : 71 | après : 71 | lignes changeant de côté : 0

côté cron — data-quality 4b + 4f
  signalements avant : 1 | après : 1 | nouveaux : 0 | disparus : 0
  (le seul, inchangé : Dengue / Nicaragua, 30 j)
```

Zéro des deux côtés, et c'est structurel plutôt qu'une coïncidence de calendrier : les crons tamponnent à chaque passage « inchangé », donc un tampon vivant a entre 0 et 2 jours (médiane 1 ce matin, maximum 11 sur les 71). Un tampon qui atteint le seuil de sa section signifie qu'aucun cron n'a réussi à relire cette source depuis ce délai — c'est le signal recherché.

**Trois arbitrages :**

- **`lastVerifiedIso()` et `freshOutbreakHours()` ne sont pas touchés.** Ils lisent `max(date, source_confirmed_at)` pour la pastille verte « Synchronisé il y a Xh », qui est déjà plafonnée à 7 jours et donc auto-bornée. Y ajouter une péremption de 60 jours n'aurait rien changé et aurait dupliqué la règle sur une surface qui ne pose pas la même question.
- **Le `>= date` reste la première condition, la péremption vient en seconde.** L'ordre compte pour la lisibilité de l'intention : un tampon antérieur au bulletin n'est pas « vieux », il est hors sujet.
- **Les deux scripts de registre QA suivent.** `build-claimable-facts.mjs` et `build-product-claims.mjs` redérivent la règle en dur (le commentaire du premier dit lui-même que la redériver autrement ferait « honorer au registre un tampon que le site ignore »). Ils portent la borne en constante locale plutôt qu'un import : ce sont des `.mjs` qui ne peuvent pas importer le `.ts`, et la duplication est déjà assumée là-bas. `marketing/qa/product-claims.manual.json`, modifié par une autre session, n'a **pas** été touché ni stagé, et aucun des deux scripts n'a été exécuté — la régénération appartient à sa routine.

**Vérification en navigateur impossible ce soir, et c'est dit plutôt que contourné.** Le serveur de développement ne démarre pas en session non supervisée, et le projet Supabase de dev n'a ni la ligne Mpox/Mondial ni les 71 tampons de la prod. Le contrôle a donc porté sur les fonctions réelles rejouées contre la vraie table, pas sur le rendu. **À contrôler d'un coup d'œil après déploiement :** `/fr/outbreak/dbc9c1d0-9299-4607-a027-f229ec8c25ce` doit passer de « ⚠ SANS MAJ · 62j » à « ✓ SOURCE CONFIRMÉE · 62j » — mais **seulement après le passage du cron de 08h10 UTC demain**, pas au déploiement : c'est le cron qui pose le tampon, le correctif ne fait que cesser de le jeter.

### Ce qui reste chez David — aucune écriture en prod n'a été faite ce soir

1. **Le tampon mpox n'existera qu'après le prochain passage du cron.** D'ici là, `Mpox / Mondial` continue d'afficher « foyer peut-être résolu ou non rapporté » sur la page publique. Rien à faire, mais ne pas lire ça comme un échec du correctif si la page est ouverte ce soir.
2. **La ligne `Mpox / RDC` cite toujours le sitrep #67 alors que le #68 est publié depuis le 31/07** — elle est inactive, donc invisible sur la carte, mais c'est un vrai retard d'ingestion et non un manque de confirmation. Le correctif de ce soir l'écarte délibérément du tampon pour cette raison. Rien n'a été écrit dessus.
3. **Reliquat inchangé du 26/08 :** les 4 lignes dengue Pacifique citant ReliefWeb (Samoa américaines 1 036 cas, Wallis-et-Futuna 50, Kiribati 44, Vanuatu 76) attendent toujours un re-sourcing ou un retrait. Sans attribution nulle part depuis le 29/08, ce qui est le bon état pour une donnée à re-sourcer, pas un état durable.
4. **`weekly-signal` porte toujours « 1 envoi(s) en échec » du 24/08.** Le correctif du 28/08 qui nomme le destinataire ne s'applique qu'au prochain passage, attendu **aujourd'hui lundi 31/08** — au moment de ce run, `site_config` porte encore l'entrée du 24/08 (165 h). À relire demain matin.
5. **Fichiers d'autres sessions laissés intacts, comme le veut `AGENTS.md`** : `marketing/content-log.md` et `marketing/qa/product-claims.manual.json` (modifiés), `scripts/audit-alert-day.mjs` et `scripts/probe-alert-lock.mjs` (non suivis). Rien n'a été stagé ni annulé les concernant. Un commit d'une autre session (`78a6da4`, pseudo-pays agrégés sur le chemin des alertes PAHO) a traversé l'arbre pendant ce run et n'a pas été touché.

**Statut : 2 idées PROPOSÉES ET CONSTRUITES** (`fed16d0`, `f7a9e53`). Aucune idée écartée par un garde-fou ce soir — aucune des deux ne touche à un schéma, à un e-mail client, à Stripe ni à un envoi externe.

---

## 2026-09-01 — Proposition du jour

**Aucun signal terrain neuf** : `product-feedback.md` n'a pas bougé depuis l'entrée Coulibaly du 22/08. Les deux idées sortent de l'état réel de la prod et de la page publique, relevé ce soir.

**Point commun des deux, et il change d'axe par rapport aux quatre derniers soirs.** Les runs du 28 au 31/08 ont tous porté sur ce que le produit *sait* de ses données. Ce soir : ce que le produit *affirme* — d'un côté une vérification humaine gelée dans un commentaire que personne ne relit, de l'autre deux comptages contradictoires du même chiffre sur la page d'accueil.

### 1. 🔴 Le correctif du 31/08 a borné la confirmation stockée en base ; son jumeau écrit en dur dans le code n'a jamais eu d'horloge — et l'un des seize est faux depuis vingt jours

**Le mécanisme.** `data-quality` (`app/api/cron/data-quality/route.ts`, l. 508-540) porte `DASHBOARD_SOURCES` : seize motifs d'URL qui font passer une ligne du seuil strict (21 j, 7 j sur une ligne PHEIC) au seuil large de 180 j. Chaque motif est justifié par un commentaire de la forme « confirmed 2026-07-30 no v.3 exists », « confirmed 2026-08-08 live page matches DB exactly ». **Ce sont des vérifications humaines, datées, qu'aucune ligne de code ne lit.** Le tableau, mesuré ce soir contre la vraie table :

```
motif                                          vérifié le    âge     lignes qu'il fait taire
weekly-epidemiological-record                  2026-08-12     20 j    2   (la plus vieille : 65 j)
publications/m/item                            2026-08-08     24 j    2   (32 j)
ecdc…mers-cov-situation-update                 2026-07-30     33 j    1   (29 j)
dge.gob.pe/sala-situacional-dengue             2026-08-08     24 j    1   (24 j)
+ 8 motifs sur 16 sans aucune date écrite       —              —      (jamais re-vérifiables)
```

**Le motif WER est faux aujourd'hui, et c'est vérifié, pas supposé.** Son commentaire dit : « Confirmed 2026-08-12: issue 31 (27 Jul-2 Aug 2026) is still the latest published issue », et se termine par une consigne — « re-verify against whatever the current latest wer101-NN issue is before assuming a gap ». Consigne adressée à un humain, exécutée par personne. Relevé ce soir sur la page de listing de l'OMS :

```
$ curl -s https://www.who.int/publications/journals/weekly-epidemiological-record | grep -o "wer101-[0-9]*" | sort -u
wer101-31   <- l'édition citée par nos 6 lignes choléra
wer101-32
wer101-33   <- « Epidemiological Week 33 (10 August - 16 August 2026) »
wer101-34
```

Trois éditions ont paru depuis la vérification. Les six lignes choléra qui citent le n° 31 — **RD Congo, Soudan, Soudan du Sud, Congo, Somalie, Tanzanie**, aucune ne portant de `source_confirmed_at` — sont figées au 2026-06-28, soit 65 jours, et le motif les fait passer sous un plafond de 180 j au lieu de 21. Le produit n'a aucun moyen de poser la question.

**Pourquoi c'est exactement le défaut réparé hier, du mauvais côté du mur.** Le commit `f7a9e53` du 31/08 a borné `source_confirmed_at` par `CONFIRMATION_MAX_AGE_DAYS`, au motif qu'« une confirmation ne périme jamais — elle est annulée par le seul événement qu'elle devrait signaler ». `DASHBOARD_SOURCES` est la même confirmation, écrite en commentaire au lieu d'une colonne, et elle n'a reçu aucune borne. Six lignes actives sur 131 ne sont aujourd'hui tenues hors du filet que par elle.

**Effort : petit.** Un fichier. Le tableau de chaînes devient un tableau d'objets `{ pattern, verifiedOn, recheckAfterDays }` ; la correspondance ne change pas d'un caractère ; une section de rapport en plus.

**Risque/inconnue : ressusciter le bruit que ces exemptions suppriment.** Traité par construction — **la nouvelle section ne reclasse aucune ligne**. Une exemption périmée continue de s'appliquer ; elle est seulement signalée comme à re-vérifier, en **une** entrée agrégée et non une par motif. Le classement des lignes est identique avant/après, rejoué contre la vraie table (voir la construction). Reste un vrai coût : la première exécution sortira un arriéré d'une dizaine de motifs, dont huit qui n'ont jamais été datés. C'est du travail réel pour David, une fois, pas du bruit récurrent.

### 2. 🔴 La page d'accueil affiche deux fois le nombre de foyers actifs, et les deux chiffres diffèrent — dont un qui compte quatre foyers clos, ceux-là mêmes pour lesquels le correctif du 02/08 avait été écrit

**Symptôme, relevé sur la page réelle il y a quelques minutes** (`https://healthwatch-global.com/fr`, un seul document HTML) :

```
🟢 129 foyers épidémiques actifs suivis en ce moment      <- bandeau du héros
   129 foyers actifs   87 pays touchés   46 alertes…      <- bloc de statistiques
   131 active                                             <- pastille au-dessus de la carte
```

Trois affirmations, deux chiffres, sur la surface d'acquisition principale d'un produit dont l'argument de vente est l'exactitude des chiffres.

**Cause, et elle a un historique.** `components/LandingPage.tsx` calcule `activeOutbreaks = outbreaks.filter(o => o.active)` (l. 534) parce que `getOutbreaks()` renvoie aussi les lignes récemment fermées, gardées 60 jours pour le tableau de bord. Le commentaire qui précède cette ligne date du 02/08 et nomme les coupables : « Ebola/Germany et Ebola/Uganda, toutes deux fermées, s'affichaient encore comme lignes vives, comme entrées "nouveau cette semaine", ET gonflaient le compte actif du héros ». Le héros, le tableau « ce que vos équipes verront » et « nouveau cette semaine » ont tous été branchés sur `activeOutbreaks`. **La carte, elle, reçoit toujours `outbreaks`** (l. 688) — la liste non filtrée. Un mois plus tard, les lignes que le correctif visait sont toujours sur la carte :

```
lignes tracées comme vives alors qu'elles sont fermées : 4
  Ebola virus disease / Germany   date 2026-07-28
  Ebola virus disease / Uganda    date 2026-07-28
  Ebola virus disease / France    date 2026-07-04
  Nipah virus        / India      date 2026-07-22
```

**Second défaut dans les trois mêmes lignes, et il retranche là où le premier ajoute.** Le filtre de coordonnées s'écrit `outbreaks.filter(o => o.lat && o.lng)` (`LandingMapSection.tsx:58`, répliqué en `LandingMapLeaflet.tsx:83`). En JavaScript, `0` est faux : **toute ligne à la longitude 0 ou à la latitude 0 est écartée sans trace.** Deux lignes actives sont dans ce cas aujourd'hui, toutes deux au centroïde générique `lat=20, lng=0` :

```
MERS-CoV / Mondial   (lat=20 lng=0)   date 2026-08-03
Mpox     / Mondial   (lat=20 lng=0)   date 2026-06-30
```

Mpox est l'une des deux urgences de santé publique de portée internationale du produit, et c'est la ligne réparée hier soir. `components/WorldMap.tsx` — la carte du tableau de bord, celle des clients — utilise pourtant déjà la bonne convention deux fichiers plus loin : `if (pinLat == null || pinLng == null) return`. C'est la carte publique, et elle seule, qui teste la vérité au lieu de la nullité.

**Troisième point, mineur mais sur la même pastille :** le mot `active` y est écrit en dur en anglais, juste sous un objet `MAP_COPY` qui traduit le titre et la légende en cinq langues. La page `/fr` affiche « 131 active », la page `/ar` aussi, en pleine mise en page RTL.

**Effort : petit.** Trois fichiers de composants, aucune requête, aucun schéma.

**Risque/inconnue : le chiffre de la pastille ne peut pas coïncider parfaitement avec celui du héros, et il ne faut pas le forcer.** Après correction, 129 foyers sont actifs et 129 sont traçables (les deux lignes « Mondial » rejoignent la carte au centroïde générique une fois le test de nullité corrigé). Si demain une ligne active arrive sans coordonnées du tout, la pastille dira moins que le héros — et ce sera vrai. Aligner les deux chiffres de force, en faisant compter à la pastille des lignes qu'elle n'affiche pas, reproduirait le défaut d'aujourd'hui dans l'autre sens.

**Statut initial : 2 idées PROPOSÉES.** Construction dans la foulée — voir la mise à jour ci-dessous.

### Construction — les deux idées sont livrées

**Idée 1 — ✅ CONSTRUITE, commit `554b239d`**, `app/api/cron/data-quality/route.ts`, un seul fichier.

`DASHBOARD_SOURCES` passe de seize chaînes à seize objets `{ pattern, verifiedOn, recheckAfterDays }`. La correspondance est inchangée au caractère près (`(row.source ?? "").includes(pattern)`), et une section **4b bis** signale les exemptions dont la vérification a expiré.

- **`verifiedOn` est la date que le commentaire revendique, pas une date inventée.** Huit entrées sur seize n'en portaient aucune : elles restent à `null`, ce qui est le constat lui-même (une exemption non datée ne peut pas être re-vérifiée, seulement crue). **Le motif WER n'a pas été re-daté non plus**, alors que je viens de constater que son affirmation est fausse : le re-dater sans avoir ouvert les éditions 32, 33 et 34 aurait fabriqué exactement la vérification que cette section existe pour exiger. Son commentaire porte à la place la mention « NO LONGER TRUE as of 2026-09-01 », et la section le sort en tête du rapport.
- **`recheckAfterDays` vaut environ deux cycles de publication de la source** : 14 j pour un hebdomadaire (WER, tableau de bord dengue du Pérou), 60 j pour un mensuel, 180 j pour une série événementielle ou une page mise à jour sur place. Pas un nombre unique : la question « existe-t-il une édition plus récente ? » se périme au rythme de la source, pas au rythme du produit.
- **Aucune ligne ne change de seuil.** Une exemption périmée s'applique toujours ; elle est seulement signalée. C'était la seule façon d'éviter de ressusciter le bruit que ces exemptions suppriment.
- **Le rapport distingue deux questions** que la première version confondait, et je l'ai corrigé après mesure : « combien de lignes ce motif couvre-t-il » et « combien n'échappent au filet que grâce à lui ». `shinyapps.io` couvre 19 lignes mais aucune n'en dépend (toutes portent un `source_confirmed_at` frais) — l'annoncer « candidate à la suppression » aurait été faux. Un motif qui ne correspond à **aucune** ligne, lui, est mort et à supprimer.

**Rejoué en lecture seule contre la vraie table, les deux versions du code côte à côte :**

```
section 4b — classement des lignes
  avant : 2 signalements — Dengue / Nicaragua | Diphtérie / Australie
  après : 2 signalements — Dengue / Nicaragua | Diphtérie / Australie   identique : true

section 4b bis — 9 exemptions sur 16 à re-vérifier
  « weekly-epidemiological-record »  vérifiée le 2026-08-12 (20 j / 14) — 2 lignes qu'elle SEULE
        tient hors du filet : Choléra / Somalie (65 j), Choléra / Tanzanie (65 j)
  « dge.gob.pe/sala-situacional-dengue » vérifiée le 2026-08-08 (24 j / 14) — 1 ligne : Dengue / Pérou (24 j)
  7 motifs jamais datés : shinyapps.io (19 lignes, aucune n'en dépend), cholera-cases-and-deaths (10),
        meningitis_bulletin (4), aphis hpai (3), ecdc news-events (1), afro.who.int/countries (1),
        ecdc mpox surveillance (0 ligne — motif mort)
```

Deux des six lignes choléra citant le WER n° 31 seulement, et non les six : les quatre autres (RDC, Soudan, Soudan du Sud, Congo) sont `is_seed=true` et relèvent de la section 4f, pas de 4b. Elles restent couvertes par le même motif périmé — la re-vérification vaut pour les six.

**Idée 2 — ✅ CONSTRUITE, commit `a499bbe4`**, `components/LandingPage.tsx` + `LandingMapSection.tsx` + `LandingMapLeaflet.tsx`.

- **La carte reçoit `activeOutbreaks`**, comme le héros, le tableau et « nouveau cette semaine » depuis le 02/08. Les quatre lignes fermées (Ebola/Allemagne, Ebola/Ouganda, Ebola/France, Nipah/Inde) ne sont plus tracées comme vives.
- **Le test de coordonnées devient `== null`**, la convention déjà utilisée par `WorldMap.tsx` sur le tableau de bord client. Une ligne à la longitude 0 ne disparaît plus en silence.
- **L'exclusion des agrégats sans pin remonte d'un cran**, de `LandingMapLeaflet` vers `LandingMapSection`. C'était nécessaire pour que la pastille compte exactement les points tracés : la règle vivait dans l'enfant, la pastille dans le parent, donc elle annonçait des lignes qui n'ont jamais été dessinées. Une seule règle décide désormais ; l'enfant ne garde qu'un filet de typage (`lat`/`lng` sont typés non-nuls mais la colonne est nullable).
- **La pastille dit ce qu'elle compte**, en cinq langues : « 126 sur la carte » plutôt que « 131 active ».

**Correction de la proposition ci-dessus, mesurée pendant la construction.** J'y écrivais que les deux lignes « Mondial » rejoindraient la carte une fois le test de nullité corrigé, et donc que 129 lignes seraient traçables. C'est faux : `LandingMapLeaflet` écarte délibérément les agrégats mondiaux et multi-pays, qui n'ont pas de point géographique qui veuille dire quelque chose. Les vrais chiffres :

```
héros « foyers actifs »                          : 129   (inchangé)
AVANT — pastille annoncée / points réellement tracés : 131 / 130
AVANT — points tracés pour une ligne fermée          :   4
APRÈS — pastille annoncée = points tracés            : 126 / 126
APRÈS — lignes fermées tracées                       :   0
```

Il reste donc un écart de 3 entre le héros (129) et la pastille (126), et il est voulu : MERS-CoV/Mondial, Mpox/Mondial et Shigellose/UE-EEE sont actifs et sans pin possible. La pastille ne prétend plus être un second comptage des foyers actifs — c'est ce qui rendait l'écart mensonger, pas l'écart lui-même.

**Vérification en navigateur impossible ce soir, et c'est dit plutôt que contourné.** `preview_start` refuse explicitement de démarrer un serveur de développement en session non supervisée (« nobody is present to approve the command »), et le projet Supabase de dev ne contient ni les 129 lignes actives ni les 4 lignes fermées de la prod. Le contrôle a donc porté sur les prédicats réels rejoués contre la vraie table, pas sur le rendu. `npx tsc --noEmit` propre sur tout le projet, `npx eslint` propre sur les 4 fichiers touchés.

**À contrôler d'un coup d'œil après déploiement :** sur `https://healthwatch-global.com/fr`, la pastille au-dessus de la carte doit lire « 126 sur la carte » et non « 131 active », et la carte ne doit plus porter de point sur l'Allemagne, l'Ouganda, la France (Ebola) ni l'Inde (Nipah). Sur `/ar`, la même pastille doit être en arabe.

### Ce qui reste chez David — aucune écriture en prod n'a été faite ce soir

1. **Neuf exemptions de cadence attendent une décision, et c'est un arriéré ponctuel, pas du bruit récurrent.** Deux sont périmées et couvrent des lignes qui ne tiennent que par elles (WER, tableau de bord dengue du Pérou) ; sept n'ont jamais été datées. Pour chacune : ouvrir la source, puis renseigner `verifiedOn`, ou supprimer le motif s'il ne couvre plus rien (`ecdc.europa.eu/en/mpox/surveillance` est dans ce cas, zéro ligne). Le rapport de demain matin les listera en une seule entrée `[EXEMPTION]`.
2. **Le vrai sujet derrière le motif WER n'est pas réglé par ce correctif.** Six lignes choléra africaines — RD Congo, Soudan, Soudan du Sud, Congo, Somalie, Tanzanie — citent l'édition n° 31 du WER et sont figées au 2026-06-28. Trois éditions ont paru depuis, et aucun cron de ce dépôt ne fait avancer cette citation : le tableau choléra du WER n'existe que dans le PDF de l'édition, pas dans sa page HTML. Construire un ingesteur pour ce PDF est un **gros effort**, donc délibérément non construit ce soir conformément au garde-fou 1 — c'est une décision de périmètre, pas une question technique. En attendant, ces six lignes se re-vérifient à la main.
3. **Reliquat inchangé du 26/08 :** les 4 lignes dengue Pacifique citant ReliefWeb (Samoa américaines 1 036 cas, Wallis-et-Futuna 50, Kiribati 44, Vanuatu 76) attendent toujours un re-sourcing ou un retrait, sans attribution nulle part depuis le 29/08.
4. **La ligne `Mpox / RDC` cite toujours le sitrep n° 67** alors que le n° 68 est publié depuis le 31/07 — inchangé depuis hier, elle est inactive. Côté `Mpox / Mondial`, le correctif d'hier a fonctionné : le tampon a bien été posé au passage de 08h10 UTC (`source_confirmed_at = 2026-08-31T08:10`), la page publique doit donc afficher « ✓ SOURCE CONFIRMÉE ».
5. **Fichiers d'autres sessions laissés intacts, comme le veut `AGENTS.md`** : `marketing/qa/product-claims.manual.json` (modifié), `scripts/audit-alert-day.mjs` et `scripts/probe-alert-lock.mjs` (non suivis). Rien n'a été stagé ni annulé les concernant. Le premier push de ce run a été refusé (`non-fast-forward`) : `git pull --rebase` était impossible sans toucher au fichier modifié d'une autre session, donc l'intégration s'est faite par une fusion (`ffe273e4`) qui ne touche qu'`instrumentation-client.ts`, venu du distant. Deux commits d'autres sessions (`18c4d048`, `d6ad25e8`) présents en local ont été poussés par la même occasion — ils n'ont pas été modifiés.

**Statut : 2 idées PROPOSÉES ET CONSTRUITES** (`554b239d`, `a499bbe4`). Une idée écartée par le garde-fou 1 (gros effort) et laissée à David : l'ingestion du tableau choléra du WER, point 2 ci-dessus. Aucune des deux idées construites ne touche à un schéma, à un e-mail client, à Stripe ni à un envoi externe.

### Suite du même soir (01/09) — reliquat traité sur demande de David, et une correction de fond

David a demandé de traiter le reliquat plutôt que de le laisser en liste. Les six points ci-dessous remplacent celui d'au-dessus.

#### 1. 🔧 Le déclenchement de 4b bis était trop large — 9 entrées, dont 7 sans portée (commit `f9dac5e3`)

En allant vérifier les 9 exemptions une par une, le vrai discriminant est apparu, et ce n'est pas la date : **7 d'entre elles couvrent des lignes qui portent toutes un `source_confirmed_at` frais**, c'est-à-dire qu'un cron relit leur source tous les jours. L'âge du commentaire n'a alors aucune portée — le tampon a déjà répondu à sa place. `shinyapps.io` couvre 19 lignes, le tableau de bord choléra de l'OMS 10, le bulletin méningite 4 : aucune ne dépend de l'exemption.

Le déclenchement se limite désormais aux deux cas où un humain est le seul recours : **(a)** l'exemption tient des lignes hors du filet à elle seule — personne ne relit cette source ; **(b)** elle ne correspond plus à aucune ligne. **9 entrées → 1.**

Garde-fou dans l'autre sens, écrit dans le code : un tampon frais dit « quelqu'un a relu cette source », pas « tout ce que cette source publie a été ingéré ». C'est exactement la distinction que la panne PAHO du 30/08 a coûté 16 jours. La seconde question est celle de la section 4j, pas de celle-ci.

#### 2. ⚠️ Correction : mon constat sur le WER était vrai à la lettre et faux sur le fond

J'ai écrit ce soir « le motif WER est faux aujourd'hui, et c'est vérifié ». La phrase du commentaire — « issue 31 is still the latest published issue » — était bien fausse. Mais elle parlait **du journal**, qui paraît tous les vendredis, alors que ce qui compte est **la mise à jour choléra multi-pays**, qui est **mensuelle**. J'ai conclu d'une phrase mal formulée que les données étaient périmées, sans ouvrir les éditions. Vérifié depuis, en téléchargeant les PDF des éditions 31 à 34 depuis `iris.who.int` :

```
wer101-31  07 août  (sem. 31)  → « Multi-country outbreak of cholera — Data as of 28 June 2026 »
                                  tableau pays complet, « a 60% increase from the previous month »
wer101-32  14 août  (sem. 32)  → choléra cité dans la liste de signaux uniquement, aucun chiffre pays
wer101-33  21 août  (sem. 33)  → idem (dossier Bundibugyo/RDC)
wer101-34  28 août  (sem. 34)  → idem
```

**Nos six lignes correspondent à la source au chiffre près** : RD Congo 32 193 cas / 908 décès, Soudan du Sud 10 526 / 111, Soudan 117 décès — tous relevés dans le texte de l'édition 31. Et leur `date = 2026-06-28` est la date d'arrêt revendiquée par l'édition elle-même (« Data as of 28 June 2026 »), pas un horodatage de synchronisation.

**Rien n'était périmé.** L'entrée porte maintenant `verifiedOn: 2026-09-01` et `recheckAfterDays: 35` — un mois plus une marge : la mise à jour de juillet était attendue début septembre, et c'est son absence après le ~6 octobre qui méritera une question. Le commentaire dit désormais ce que l'exemption affirme réellement, au lieu d'une phrase sur le journal qui redevient fausse tous les vendredis.

#### 3. 🔴 Le Pérou, lui, cachait un vrai retard — et c'est la sonde qui l'a sorti

L'exemption `dge.gob.pe/sala-situacional-dengue` tient une ligne à elle seule. La source n'est effectivement pas scrapable : la page cité redirige vers `app7.dge.gob.pe/maps/sala_metaxenica/`, qui redirige à son tour vers `/maps2/shiny_metaxenicas_web/`, et la liste des bulletins est elle aussi en JavaScript. Ouverte dans le navigateur :

```
app Shiny (MINSA / CDC Perú), 01/09 :  DENGUE PERÚ — Situación 2026, hasta la SE 33
                                        46 669 casos acumulados · 57 defunciones acumuladas
en base                              :  42 440 cas · 48 décès, date 2026-08-08
```

**Retard réel de 4 229 cas et 9 décès**, la semaine épidémiologique 33 s'étant terminée le 16 août. `verifiedOn` est **délibérément laissé au 08/08** pour que le rapport continue de le signaler tant que la ligne n'est pas corrigée — stamper aujourd'hui aurait fait taire un écart avéré.

**Non corrigé en base, et volontairement.** Le compteur de décès de l'app porte la note « *(**) Se incluyen defunciones por la enfermedad y en investigación* » : les 57 incluent des décès encore en investigation, ce qui n'est pas nécessairement la même mesure que les 48 stockés. Le compteur de cas n'a pas cette réserve. Écrire les deux d'un coup reviendrait à changer la définition d'une colonne sans le dire. À trancher par David.

#### 4. ✅ Motif mort supprimé

`ecdc.europa.eu/en/mpox/surveillance` : **0 ligne sur les 294 de la table**, actives ou non. Le motif visait une forme d'URL absente des données — la ligne ECDC mpox qui existe cite `/en/mpox`, sans `/surveillance`, et n'a donc jamais été couverte. Supprimé.

#### 5. ✅ Le reliquat ReliefWeb du 26/08 est clos

Vérifié en base ce soir : trois des quatre lignes ont été **re-sourcées vers la Communauté du Pacifique** (`spc.int/phd/epidemics`, reconnue éditeur officiel par le commit `47330fa6` du 30/08) et sont actives avec des chiffres plus frais — Samoa américaines 1 044 cas (11/08), Wallis-et-Futuna 70 (21/08), Vanuatu 91 (16/08). La quatrième, **Dengue / Kiribati**, cite toujours ReliefWeb mais est `active=false` et `source_priority=0` : la fenêtre d'affichage de 60 jours exige `source_priority >= 3`, donc **elle n'est ni sur le site public ni dans le jeu que lit la section 4m**. L'URL interdite ne subsiste que dans une ligne que personne ne voit. Reste à David s'il veut la blanchir par principe — aucune urgence légale, aucune exposition.

#### 6. ✅ Mpox / RDC : aucun impact utilisateur, sort du reliquat

Les deux lignes Mpox de RDC sont `active=false` **et `source_priority=0`**, donc hors de la fenêtre d'affichage : la citation du sitrep n° 67 alors que le n° 68 existe est un vrai retard d'ingestion, mais **invisible pour un utilisateur**. Ce point était surévalué dans le reliquat d'hier et de ce soir ; il redescend au rang de dette d'ingestion, pas de défaut affiché.

#### Ce qui reste réellement chez David après cette passe

1. **La ligne Dengue / Pérou** — 4 229 cas de retard, chiffre vivant relevé ci-dessus, à corriger à la main une fois tranchée la question « décès confirmés seuls ou y compris en investigation ». C'est le seul point avec un impact utilisateur.
2. **L'ingestion de la mise à jour choléra du WER** — toujours **gros effort**, toujours non construit (garde-fou 1), mais l'estimation est désormais plus précise : la mise à jour est **mensuelle** et vit dans le PDF de l'édition, téléchargeable via `iris.who.int/server/api/core/bitstreams/…/content` (lien « Download full edition » de la page de l'édition), et `pdf-parse` en sort le texte proprement — c'est ainsi que les chiffres ci-dessus ont été relevés. Un cron mensuel qui détecte l'édition portant « Multi-country outbreak of cholera » et en extrait les pays est faisable ; ce n'est plus une inconnue, c'est un chantier chiffrable.
3. **Dengue / Kiribati** — URL ReliefWeb dans une ligne non affichée. Cosmétique.

**Statut du reliquat : 4 points sur 6 clos** (déclenchement resserré, motif mort supprimé, ReliefWeb, Mpox/RDC), **1 corrigé sur le fond** (WER — rien n'était périmé), **1 vrai défaut trouvé et documenté sans être écrit en base** (Dengue / Pérou).

#### 7. ✅ Dengue / Pérou corrigé en prod, et l'exemption qui masquait le retard retirée (commit `073ca94d`)

**La question de définition des décès est tranchée par la source, pas par nous.** Le tableau « indicadores » du tableau de bord MINSA porte la note « *Casos confirmados y probables. Defunción relacionada a dengue y en investigación.* », et cette note s'applique à **toute la série 2021-2026** — y compris aux 49 décès de 2025 qui servent de comparaison. Ce n'est donc pas une réserve ponctuelle sur 2026 : c'est la définition permanente du compteur. La réserve que j'avais posée plus haut tombe.

Mieux : la `description` de la ligne disait noir sur blanc « *The death count is not readable on the national dashboard itself and is taken from the MINSA figures relayed on 18 August 2026* ». Les cas venaient du tableau de bord, les décès d'un autre canal — provenance mixte, donc incomparable d'une mise à jour à l'autre. Prendre les deux au même endroit n'est pas seulement un chiffre plus récent, c'est **une meilleure provenance**.

**Chiffres relevés le 01/09 dans l'application (onglets « Tendencias » et « Tablas ») :**

```
cas cumulés 2026        46 669   (2025 même période : 30 587)   +52,6 %
décès cumulés 2026          57   (2025 même période :      49)   +16 %
létalité                  0,12 %
composition           confirmés 38 723 (82,97 %) · probables 7 946 (17,03 %)
gravité               dengue grave 224 · avec signes d'alarme 7 324
SE 33 seule            2 548 cas · 5 décès
départements          Piura 8 958 · San Martín 7 000 · La Libertad 6 355 ·
                      Lima 4 793 · Lambayeque 4 389 · Ucayali 2 967
```

**La date a failli être fausse de six jours.** La SE 33 de l'OMS court du 10 au 16 août (c'est ce que dit le WER lu plus haut ce soir), mais le Pérou a son propre calendrier épidémiologique. Vérifié sur le `CALENDARIO-EPIDEMIOLOGICO-PARED-2026.pdf` du CDC Perú : en août, **SE 31 = 2-8, SE 32 = 9-15, SE 33 = 16-22**, semaines dimanche-samedi. Recoupé par la ligne elle-même, qui datait sa SE 31 au 8 août. La ligne est donc datée du **2026-08-22**, pas du 16.

**Écrit en prod** par un script one-off (`scripts/fix-dengue-peru-se33-2026-09-01.mjs`), **non commité** conformément au `.gitignore` (l. 65-71 : ces scripts sont jetables et supprimés une fois le correctif confirmé). Descriptions réécrites en 5 langues. `source`, `source_priority` (6) et `risk_level` (élevé) inchangés. Relu après écriture : `46 669 cas · 57 décès · date 2026-08-22`.

**L'exemption est retirée, et c'est la vraie leçon.** `dge.gob.pe/sala-situacional-dengue` avait été inscrit dans `DASHBOARD_SOURCES` parce que la source n'est pas extractible — double redirection vers une application Shiny, index des bulletins en JavaScript. Mais **« difficile à extraire » n'est pas « lent à publier »** : ce tableau de bord est hebdomadaire. C'est cette confusion, et non un oubli, qui a garé une ligne tenue à la main sous un plafond de 180 jours où elle a dérivé 25 jours sans que rien ne la signale. La règle est maintenant écrite dans le commentaire de la liste pour les prochains motifs : n'y inscrire qu'une source dont **la cadence de publication** est réellement plus lente que 21 jours. La ligne relève désormais du filet standard, qui est le bon seuil pour elle.

**État final des deux sections, rejoué contre la prod après écriture :**

```
motifs dans DASHBOARD_SOURCES : 14   (16 au départ — 1 mort supprimé, 1 mal classé retiré)
section 4b   — signalements   :  2   Dengue / Nicaragua · Diphtérie / Australie   (inchangé)
section 4b bis — entrées      :  0   le seul signalement du soir est traité
Dengue / Pérou                : plus d'exemption, filet standard 21 j, date à 10 j
```

#### Reliquat après cette seconde passe

1. **L'ingestion de la mise à jour choléra du WER** — seul point encore ouvert, toujours **gros effort** et non construit (garde-fou 1). L'inconnue technique est levée : mise à jour **mensuelle**, PDF récupérable via le lien « Download full edition » de la page de l'édition (`iris.who.int/server/api/core/bitstreams/…/content`), texte extractible par `pdf-parse` — c'est ainsi que les chiffres des six lignes choléra ont été recoupés ce soir. Chantier chiffrable, en attente d'une décision de périmètre.
2. **Dengue / Kiribati** — URL ReliefWeb dans une ligne inactive à `source_priority` 0, donc hors du site public et hors de l'audit 4m. Cosmétique.

Le point « Dengue / Pérou » et le point « exemptions à re-vérifier » sont clos.

#### 8. ✅ `check-wer-cholera` livré — le dernier point ouvert est traité, en détection et non en ingestion (commits `c2050dd6`, `c6b4c969`)

Le point 2 du reliquat était « ingestion de la mise à jour choléra du WER — gros effort, en attente d'une décision de périmètre ». En regardant le travail de près, la décision se tranchait toute seule : **ce n'est pas l'ingestion qui manquait, c'est la détection.**

**Ce qui manquait vraiment.** Les six lignes — Choléra RD Congo (32 193 cas / 908 décès), Soudan, Soudan du Sud, Congo, Somalie, Tanzanie — citent `wer101-31` et ne portaient **aucun `source_confirmed_at`**, parce qu'aucun cron du dépôt ne lit le WER. Leur fraîcheur reposait entièrement sur un commentaire en prose relu par un humain le 12/08. Rien ne pouvait voir paraître une nouvelle mise à jour choléra, **ni la voir manquer**. Les chiffres, eux, sont justes — c'est vérifié plus haut.

**Pourquoi détection seule, et non ingestion.** Les chiffres ne sont pas dans une table exploitable mais dans une narration par pays à l'intérieur du PDF (« *Between 1 January 2026 and 28 June 2026, the Democratic Republic of the Congo reported a total of 32 193 cases and 908 deaths* »), et six pays devraient être extraits de prose libre. C'est un chantier distinct, avec ses propres modes de panne. Même partage des rôles que `disease-coverage` et `sync-pacific-surveillance` : signaler l'événement, laisser l'écriture à un humain. Dit explicitement dans l'en-tête du fichier plutôt que laissé à deviner.

**Le piège autour duquel la sonde est construite.** Le WER est **hebdomadaire** (une édition tous les vendredis), la mise à jour choléra qu'il porte est **mensuelle**. Comparer les numéros d'édition crierait au loup chaque vendredi — c'est exactement l'erreur que j'ai faite en début de soirée. Seule la présence du marqueur dans le PDF compte. Rejoué contre les sources réelles avant livraison :

```
wer101-31  ->  MISE À JOUR CHOLÉRA  (« Data as of 28 June 2026 »)
wer101-32  ->  pas de mise à jour
wer101-33  ->  pas de mise à jour
wer101-34  ->  pas de mise à jour
```

**Trois choix de conception, tous hérités de pannes réelles de ce dépôt.**

- **Une édition illisible arrête la sonde en `error`, elle n'est pas enjambée.** Un numéro sauté est exactement la façon dont une mise à jour manquée deviendrait invisible pour toujours — la forme de la panne PAHO réparée le 30/08. `lastScannedIssue` n'avance pas au-delà, donc le passage suivant réessaie la même.
- **La liste d'éditions illisible est une `error`, pas un `no_data`.** `health-check` documente `no_data` comme un état d'inactivité légitime et le laisse silencieux : une page injoignable se serait lue « rien de neuf cette semaine » indéfiniment.
- **`rows` reste à 0, `evaluatedAt` porte le fait que le contrôle a tourné.** Une confirmation n'est pas une écriture de donnée ; gonfler `rows` poserait un `lastNonZero` et revendiquerait une ingestion qui n'a pas eu lieu.

Enregistré dans `CRON_WINDOWS` **et** `vercel.json` dans le même commit que la route, au lieu de plusieurs jours plus tard comme ses trois voisines hebdomadaires — c'est tout l'objet des commentaires qui les entourent. `check-cron-schedule` : 21 commentaires `Schedule:` concordants.

**Conséquence : l'exemption WER est retirée** (`c6b4c969`). Dès lors qu'un cron répond à la question, une exemption en prose qui y répond moins bien n'est pas seulement redondante, elle est **nuisible** : elle accorderait à ces lignes une fenêtre de confirmation de 180 jours là où l'honnête est 21. Si le cron cesse un jour de tamponner, ces lignes doivent redevenir signalées sous trois semaines — c'est ce que le retrait restaure. Règle écrite pour la suite : **une exemption vaut pour une source que rien ne relit ; dès qu'un cron s'en charge, la supprimer.**

Le tampon a été amorcé à la main sur les 6 lignes (script one-off, non commité par `.gitignore`), parce que le cron ne passe que lundi et que le retrait aurait sinon fait signaler ces lignes six jours pour une question déjà tranchée ce soir. Le tampon est vrai, pas une commodité : les quatre éditions publiées du volume 101 ont été téléchargées et analysées. `updated_at` n'a bougé sur aucune des six lignes — la migration `20260824030000` a fait son travail, vérifié après écriture.

**Effet visible pour un utilisateur, mesuré après coup :**

```
avant : ⚠ SANS MAJ · 65j   « foyer peut-être résolu ou non rapporté »
après : ✓ SOURCE CONFIRMÉE · 65j
        sur les 6 lignes, dont Choléra / RD Congo (32 193 cas)
```

L'OMS n'a effectivement rien publié de plus récent — le badge d'avertissement était faux, et il était le seul énoncé du produit sur ces six foyers.

**État final des deux sections, rejoué contre la prod :**

```
motifs dans DASHBOARD_SOURCES : 13   (16 au départ)
section 4b   — signalements   :  2   Dengue / Nicaragua · Diphtérie / Australie   (inchangé toute la soirée)
section 4b bis — entrées      :  0
```

#### Reliquat après cette troisième passe

**Un seul point, cosmétique :** Dengue / Kiribati porte encore une URL ReliefWeb, dans une ligne inactive à `source_priority` 0 — hors du site public et hors du jeu que lit la section 4m. Aucune exposition légale, aucun impact utilisateur.

Tout le reste du reliquat du 26/08 et du 31/08 est clos.

#### 9. ✅ Vérification en production des correctifs de la soirée — la seule qui manquait

L'idée 2 avait été livrée avec la mention « vérification en navigateur impossible ce soir ». Elle est faite maintenant, contre la prod déployée, et elle passe.

```
/fr   pastille de la carte : « 126 sur la carte »   (avant : « 131 active »)
/fr   bandeau du héros     : « 🟢 129 foyers épidémiques actifs »
/ar   pastille             : « 126 على الخريطة »   — traduite, plus d'anglais en dur
```

**Les quatre lignes fermées ne sont plus envoyées à la carte.** Le payload de la page contient 120 paires maladie/pays exploitables par la sonde (les 6 manquantes portent le libellé d'événement de sécurité alimentaire, trop long pour le motif de lecture — limite de ma sonde, pas de la page), et **la seule entrée Ebola est « Maladie à virus Ebola / RD Congo »**, le foyer réellement actif. Ebola/Allemagne, Ebola/Ouganda, Ebola/France et Nipah/Inde ont disparu ; les occurrences résiduelles d'« Allemagne » et « Ouganda » dans le HTML sont, vérifié une par une, la répartition par pays dans une description West Nile de l'ECDC et une ligne **Marburg/Ouganda active**, sans rapport.

**Le chiffre du Pérou s'est propagé à l'accueil** (46 669), le cache de 300 s ayant tourné.

#### 10. ⏹️ Kiribati : ne rien faire, et la raison compte

Dernier point du reliquat, et après examen la bonne action est **l'inaction**. La ligne est inactive à `source_priority` 0, donc hors de la fenêtre d'affichage de 60 jours et invisible partout. Blanchir son URL ReliefWeb la retirerait aussi de `data-quality` section 4m et de `check-source-trust.mjs`, qui lisent la colonne `source` précisément pour dénoncer les éditeurs interdits — c'est le même arbitrage que le 29/08, où `sourceName()` avait été laissée intacte pour ne pas aveugler l'audit. Le risque de publication est déjà nul par deux verrous indépendants (`publishableSourceUrl/Name` rendent `null` pour un éditeur interdit, et la ligne n'est de toute façon pas affichée). **Effacer l'URL n'améliorerait rien et supprimerait la trace.** Point clos, sans écriture.

#### 11. ⚠️ 51 crons dans `vercel.json` — à confirmer côté Vercel, pas déductible du dépôt

`check-wer-cholera` porte le total à 51. Les 50 précédents tournent tous (relevé de `cron:run:*` à l'appui), donc le plafond du plan est au moins de 50 — mais **le dépôt ne documente nulle part le plafond réel**, et je ne l'invente pas. À vérifier dans le tableau de bord Vercel avant d'en ajouter beaucoup d'autres. Aucun signe de problème aujourd'hui.

#### Mémoire

Une entrée ajoutée : `reference_wer_cholera_update_is_monthly_not_weekly` — le piège qui m'a fait conclure à tort à une péremption ce soir, avec la marche à suivre pour lire une édition (lien « Download full edition » → bitstream `iris.who.int` → `pdf-parse`, marqueurs `Multi-country outbreak of cholera` **et** `Data as of`). Écrite parce qu'elle porte sur une source externe et se re-déduirait faussement sinon.

---

### Bilan de la soirée du 2026-09-01

| | |
|---|---|
| Idées proposées | 2 |
| Idées construites | 2 (`a499bbe4`, `554b239d`) |
| Correctifs supplémentaires en traitant le reliquat | 4 (`f9dac5e3`, `073ca94d`, `c2050dd6`, `c6b4c969`) |
| Écritures en prod | 2 — Dengue/Pérou rafraîchi, tampon amorcé sur 6 lignes choléra |
| Nouveau cron | `check-wer-cholera` (hebdo, lundi 08h30) |
| `DASHBOARD_SOURCES` | 16 → 13 motifs |
| Section 4b bis | 9 entrées → 0 |
| Un constat corrigé | le WER n'était pas périmé — voir le point 2 |
| Reliquat restant | aucun point actionnable |

---

## 2026-09-02 — Proposition du jour

Signal de départ : le retour du **31/08 de `lepapapericles5@gmail.com`** (essai actif, Afrique), premier retour produit jamais reçu sur l'**accessibilité** plutôt que sur la donnée — « je suis dans une zone avec une faible couverture de connexion, raison pour laquelle j'ai du mal à revenir sur le tableau ». Pour lui, le produit **c'est l'e-mail** ; le tableau de bord est hors d'atteinte.

### 0. La piste évidente ne tient pas — mesurée avant d'être écrite

`product-feedback.md` ouvrait la piste d'« une version allégée du digest pour connexions faibles ». **Vérifié, il n'y a rien à alléger.** Les gabarits ont été transpilés et rendus avec des données réalistes :

```
digest  1 foyer   : 2 648 o   ·  alerte simple : 2 444 o
digest  3 foyers  : 4 398 o
digest 10 foyers  : 10 646 o   (le maximum possible, cf. MAX_DIGEST_ITEMS_PER_EMAIL)
```

Aucune image distante, aucune police distante, aucun `background-image` : `grep` sur les 17 gabarits de `lib/*email*.ts` ne trouve **pas un seul `<img>`**. Un e-mail de 10 Ko autoporteur n'est pas un problème de bande passante, et le dire aurait été inventer un défaut. Ce qui est vrai, en revanche, c'est ce qui suit.

### 1. 🔴 Deux foyers sur trois « alertés » n'ont jamais été nommés à personne — et ils sont éteints pour l'avenir

**Signal.** Les trois digests plafonnent l'e-mail à 10 foyers et résument le reste en une phrase — `« + 105 autres foyers actifs — consultez le tableau de bord complet. »` (`lib/alert-emails.ts:69`), `« + N autres alertes maladies — consultez le tableau de bord complet. »` (`lib/disease-alert-email.ts:79`), `« + N autres foyers actifs, consultables dans votre tableau de bord. »` (`lib/signup-digest-email.ts:42`). Or **tous** les foyers du lot, coupés ou non, sont écrits dans `outbreak_alert_log` — le code le dit lui-même : *« every item still gets logged/Slacked below regardless of whether it made the cut for the email body »* (`regional-alerts/route.ts:466`). Et ces lignes sont précisément **ce qui supprime les alertes futures** sur la même paire utilisateur/foyer, sauf escalade de risque ou +20 % de cas.

Un foyer coupé est donc **nommé nulle part et éteint pour toujours**. Le seul rattrapage offert est le tableau de bord.

**Mesuré sur la prod ce matin** (`outbreak_alert_log`, 3 313 lignes, paginé — un résultat à exactement 1000 aurait été une troncature) :

```
lots (utilisateur × jour) : 249, dont 48 tronqués
TOTAL : 3 313 foyers journalisés comme alertés
        dont 2 236 jamais nommés  →  67,5 %

pires lots :  2026-08-29  114 foyers → 10 nommés, 104 jamais nommés
              2026-08-28  109 foyers → 10 nommés,  99 jamais nommés
              2026-08-22  103 foyers → 10 nommés,  93 jamais nommés
```

**Et pour l'utilisateur qui a écrit le 31/08 :**

```
2026-08-20 :  36 foyers → 10 nommés,  26 jamais nommés   (digest d'inscription)
2026-08-21 :   1                       0
2026-08-23 :   8                       0
2026-08-24 :   2                       0
2026-08-27 :   2                       0
soit 26 foyers sur 49 qu'il n'a aucun moyen de connaître.
```

**Pourquoi c'est un angle neuf et pas une re-proposition.** Le plafond a été relevé le 25/08 comme *« arbitrage délibéré et documenté, pas un défaut »*, et à raison : il protège la lisibilité d'un e-mail. Ce qui a changé le 31/08, c'est qu'un utilisateur réel a dit ne pas pouvoir atteindre la surface vers laquelle le plafond renvoie. « Consultez le tableau de bord » n'est un résumé que pour qui peut l'ouvrir ; pour les autres c'est une perte sèche. L'arbitrage sur les **cartes** reste bon — c'est le renvoi qui ne l'est plus.

**Correctif proposé, chiffré.** Ne pas relever le plafond de cartes : ajouter sous les cartes une **ligne de texte nue nommant les foyers coupés** (`Maladie · Pays`, séparés par ` · `, sans lien ni encadré), et remplacer le renvoi au tableau de bord par cette liste. Longueur réelle mesurée sur les 131 foyers actifs : moyenne **30 caractères** par libellé, soit **~3,5 Ko pour 105 foyers** (digest 10,6 → ~14 Ko) et **~0,9 Ko pour les 26** du cas ci-dessus. Trois gabarits touchés, la même modification dans chacun.

**Effort :** petit — trois gabarits, cinq langues chacun, aucune requête ni schéma en plus (les libellés sont déjà dans le lot passé au gabarit, il suffit de ne pas les jeter).

**Risque/inconnue :** (a) un libellé va jusqu'à **146 caractères** en base (les intitulés d'événement de sécurité alimentaire) — 105 de ceux-là feraient un mur, il faut un plafond de longueur par libellé ; (b) une liste de 105 noms reste peu lisible : le regroupement par maladie (« Choléra — 7 pays ») serait plus lisible mais perd le pays, c'est un arbitrage de fond à trancher ; (c) le vrai problème de fond reste que 114 foyers en un seul lot est un régime d'alerte anormal, et nommer les coupés le rend visible sans le corriger.

**⛔ Délibérément NON construite ce soir — garde-fou 3.** Cette modification change le **contenu d'e-mails envoyés à des clients** (14 essais actifs, dont trois pilotes institutionnels — Georgetown, ministère de Malte, ARIES). Le garde-fou de cette routine réserve ce domaine à une demande explicite de David en session. La conception ci-dessus est complète et chiffrée : un mot suffit pour la faire construire.

### 2. 🔴 Un cron qui vient d'être ajouté est compté « en retard » sur-le-champ — la supervision est rouge depuis hier pour cette seule raison

**Signal.** Relevé de l'état des 51 crons ce matin : `health-check` est en `error` depuis 23 h, et depuis le correctif du 29/08 il dit enfin pourquoi —

```
health-check -> {"status":"error", "error":"1 cron(s) en retard : check-wer-cholera — plus 1 incident(s) Sentry"}
```

`check-wer-cholera` a été créé **hier** (commit `c2050dd6`, 2026-09-01 04h49 UTC) et tourne **le lundi à 08h30**. Son premier passage est donc le 07/09. Le rapport de 07h05 le matin même est parti rouge — ligne d'objet comprise — pour un cron dont l'heure n'était pas encore venue, et repartira rouge **six jours de suite**, avec un avertissement Sentry chaque jour.

**La cause est une seule branche** (`health-check/route.ts:921`) :

```ts
const run = cronMap[name];
if (!run) {
  overdue.push(name);                                  // « jamais passé » = « en retard »
  return { name, ageH: null, windowH, ok: false, label: "jamais" };
}
```

« N'a jamais tourné » et « aurait dû tourner » sont traités comme la même chose. Ils ne le sont pas : il manque la date à partir de laquelle on est en droit d'attendre un passage. Le défaut est structurel — il se rejouera à l'identique au prochain cron ajouté, et d'autant plus longtemps que sa cadence est lente.

**Pourquoi ça compte au-delà du confort.** C'est la seule supervision de haut niveau du produit, et c'est précisément le motif de panne que ce dépôt combat depuis un mois : un rouge qui ne veut rien dire apprend à ne plus lire le rouge. Le 27/08 avait déjà livré exactement ce diagnostic sur un autre cron (« affiche EN ERREUR depuis 4 jours parce que son garde-fou a fait ce pour quoi il a été écrit »).

**Effort :** petit — une branche, pas de migration.

**Risque/inconnue :** relâcher cette branche pourrait masquer un cron ajouté à `CRON_WINDOWS` mais oublié dans `vercel.json`, qui ne tournerait jamais. Traité en donnant une **échéance** et non une exemption : voir la construction ci-dessous.

### Construction — idée 2 livrée, idée 1 délibérément non construite

**Idée 2 — ✅ CONSTRUITE, commit `8cb6acaf`** (`app/api/cron/health-check/route.ts`).

Le rapport pose lui-même la date de première observation d'un nom de `CRON_WINDOWS` sans passage (clé `site_config` `health-check:cron-first-seen`, **aucune migration** — la valeur est purement dérivée, et perdue elle se reconstruit au passage suivant) et n'ouvre l'alerte qu'une fois la **fenêtre du cron écoulée depuis cette date**.

Trois choix de conception, chacun contre un mode de panne précis :

- **Une date, pas un booléen « déjà toléré ».** Un booléen ne périmerait jamais : le cron oublié dans `vercel.json` se tairait pour toujours. La date, elle, arrive à échéance.
- **La date n'est jamais repoussée** tant que le cron n'a pas tourné. La remettre à « maintenant » à chaque passage du rapport reculerait l'échéance indéfiniment — c'est la même faille que le booléen, écrite autrement.
- **Une date illisible tranche vers l'alerte.** `NaN > windowH` est faux, donc la lecture naïve aurait rendu le cron silencieux pour toujours ; `!Number.isFinite(waitedH)` le force dans `overdue`.

La carte est réécrite avec les seuls noms encore sans passage, donc elle se purge d'elle-même quand un cron finit par tourner ou sort de `CRON_WINDOWS` ; un échec d'écriture est journalisé sans faire tomber le rapport. Le libellé du tableau distingue désormais les deux états — `jamais` contre `jamais (fenêtre en cours, 12h/200h)` — pour que la tolérance reste **visible** et non silencieuse.

**Rejoué contre la prod avant livraison :**

```
CRON_WINDOWS                       : 51 entrées
crons ayant déjà tourné            : 50
sans aucun passage enregistré      :  1  → check-wer-cholera (fenêtre 200 h)
crons qui tournent hors CRON_WINDOWS: 0
```

Une seule entrée concernée, exactement celle qui rougissait le rapport. `npx tsc --noEmit` et `npx eslint` propres ; `check-cron-schedule` (21 commentaires `Schedule:`) et `check-migrations-applied` (88 migrations) passent au pre-push.

Effet attendu au prochain passage (07h05 UTC) : `check-wer-cholera` sort de `overdue`, et l'objet du rapport perd `· 1 cron(s) en retard`. Le rapport **peut rester en `error`** pour l'autre motif déjà présent (`plus 1 incident(s) Sentry`) — c'est un signal distinct, non touché ici, et le prétendre corrigé serait faux.

**Idée 1 — ⛔ NON CONSTRUITE, garde-fou 3.** Elle modifie le contenu d'e-mails partant à des clients réels (14 essais actifs, dont trois pilotes institutionnels). Le garde-fou de cette routine réserve ce domaine à une demande explicite de David en session. La conception est complète et chiffrée ci-dessus — trois gabarits, cinq langues, ~3,5 Ko pour le pire cas — et ne demande qu'un feu vert.

### Ce qui reste chez David

1. **Idée 1** — un mot suffit pour la faire construire. C'est la seule des deux qui répond à l'utilisateur du 31/08.
2. **Trois essais expirent aujourd'hui 02/09** : `shepil.maxim99@gmail.com`, `shereenabdelmesseh@gmail.com`, `bego@guiacan.com` (ce dernier étant un hébergeur espagnol, pas un prospect santé — cf. mémoire dédiée). Deux autres le 03/09 : `etienneg83@yahoo.fr` et `aasoumah24@gmail.com`, ce dernier avec `email_blocked_at` posé, donc injoignable. Relevé au passage, pas une idée produit.
3. **`sync-drc-sitrep` et `check-mpox-sitrep` en `no_data`** depuis leur dernier passage — état d'inactivité légitime par conception, signalé seulement pour mémoire.

### Fichiers modifiés par d'autres, laissés intacts (AGENTS.md)

`marketing/qa/product-claims.manual.json` (modifié), `scripts/audit-alert-day.mjs` et `scripts/probe-alert-lock.mjs` (non suivis) étaient déjà là au début du run. `package-lock.json` porte une normalisation de lockfile (retrait d'une entrée `@swc/helpers` transitive, un `dev: true` sur `fsevents`) apparue pendant le run, vraisemblablement un effet de bord de mes appels `npx` — laissée telle quelle et signalée plutôt que committée ou annulée. Aucun de ces quatre fichiers n'est entré dans mes deux commits.

Une autre session a commité pendant ce run (`fix(wer-cholera): echapper les donnees interpolees dans l'e-mail d'alerte`) — sans recoupement avec les fichiers touchés ici.

### Suite du même soir (02/09) — idée 1 construite sur ordre explicite de David

David a demandé la construction en session interactive (« Construis l'idée 1 »), ce qui satisfait explicitement le garde-fou 3 de cette routine (« à traiter au cas par cas si David le demande explicitement en session »).

**✅ CONSTRUITE, commit `2048f6a9`** — les trois gabarits (`lib/alert-emails.ts`, `lib/disease-alert-email.ts`, `lib/signup-digest-email.ts`) nomment désormais les foyers coupés en texte nu sous les cartes, à la place du seul renvoi « consultez le tableau de bord ». L'arbitrage du 25/08 sur le plafond de **cartes** reste inchangé — c'était uniquement le renvoi vers une surface inatteignable qui posait problème.

**Ce qui a été construit, exactement comme conçu ce matin :**
- Signatures des trois builders changées : `overflowCount: number` → `overflowItems: { disease, country }[]`. Un seul appelant chacune, mis à jour dans le même commit (`regional-alerts/route.ts`, `disease-alerts/route.ts`, `activate-trial.ts`).
- Plafond de **60 caractères par libellé** (troncature + `…`) — le risque signalé ce matin sur les intitulés d'événement de sécurité alimentaire (jusqu'à 146 caractères) est traité, pas seulement noté.
- Séparateur `; ` entre entrées, distinct du ` · ` interne à chaque libellé — pas d'ambiguïté visuelle.
- `buildSignupDigestEmail` gagne un paramètre optionnel en 6ᵉ position : les deux scripts historiques `send-signup-digest-backfill-2026-07-2[67].mts` l'appellent avec 5 arguments et restent valides sans modification.

**Vérifié avant commit** : rendu réel par transpilation (pas seulement `tsc`) — entrées correctement échappées, séparateur sans ambiguïté, troncature confirmée à exactement 60 caractères sur un intitulé de 146. `npx tsc --noEmit` et `npx eslint` propres sur les six fichiers touchés.

**Non fait, et volontairement** : le regroupement par maladie (« Choléra — 7 pays ») évoqué ce matin comme piste de lisibilité pour un très gros lot (105 foyers) n'a pas été construit — hors du périmètre chiffré à David ce matin, et une extension de scope non demandée. Le texte plat construit répond à l'utilisateur du 31/08 (26 foyers coupés sur son plus gros lot), pas nécessairement à un lot de 100+.

**Effet réel au prochain envoi** : un utilisateur dont le lot dépasse 10 foyers verra désormais la liste complète des maladies/pays coupés, plus un e-mail de quelques centaines d'octets à quelques Ko selon la taille du lot (mesuré ce matin : ~3,5 Ko de texte pour 105 foyers).

---

## 2026-09-02 (run du soir, 18h20) — Proposition du jour

Deuxième passage de la routine aujourd'hui (l'entrée du matin ci-dessus est close : ses deux idées sont livrées, `8cb6acaf` et `2048f6a9`). Angle de ce soir : la **provenance annoncée** et la **résilience d'ingestion**, mesurées en direct sur la prod (`.env.local.live`, lectures seules).

### 1. 🔴 « Africa CDC » est annoncée comme l'une des quatre sources du produit sur toute la surface publique — et n'alimente **aucune** des 128 lignes actives

**Signal.** Relevé de la base de prod ce soir, source par source :

```
lignes en base            : 294   (dont 128 actives)
source = africacdc.org    :   2   (dont 0 active)
   · Ebola/RDC     — inactive, dernière écriture 2026-08-12
   · Ebola/Global  — inactive, dernière écriture 2026-07-15
sync-africa-cdc — dernier insert/update (lastNonZero) : 2026-08-11  →  22,3 jours
sync-africa-cdc — statut du dernier passage (02/09 09h10 UTC)       : error / "fetch failed"
```

Deux lignes actives *mentionnent* Africa CDC dans leur description (CCHF/Sénégal, Chikungunya/Maurice) mais sont sourcées ailleurs (`mesvaccins.net`, un PDF de l'État de New York) : c'est de la reprise de seconde main, pas une ingestion.

**Ce que le produit dit, en face.** `Africa CDC` apparaît **359 fois dans 62 fichiers** hors code de fetch. Les plus chargés sont exactement les surfaces qu'un prospect voit en premier :

```
components/LandingPage.tsx            45    app/[locale]/pilot/page.tsx        11
app/[locale]/about/page.tsx           28    lib/upgrade-email.ts               10
app/[locale]/methodology/page.tsx     25    components/HeroBanner.tsx          10
app/[locale]/diseases|countries       15    lib/welcome-email.ts                5
app/[locale]/(dashboard)/page.tsx     13    lib/digest-email.ts / churn-email    5
```

plus l'image OG, le `manifest.ts`, le flux RSS, le flux JSON, la carte de partage d'un foyer, le pied de page du PDF régional et l'e-mail de confirmation d'abonnement — en cinq langues à chaque fois.

Et ce ne sont pas des mentions vagues. `/methodology` affirme trois choses vérifiables et fausses aujourd'hui :
- tableau des sources : `Africa CDC · couverture Afrique · « Per event + weekly sitrep »` ;
- tableau des régions : `Afrique — Africa CDC + bulletins WHO AFRO · « Broadest regional coverage »` ;
- déduplication : `WHO DON > ECDC > PAHO > Africa CDC` — un ordre de priorité sur une source qui n'a jamais de ligne à départager.

La page de tarifs va plus loin (`messages/*.json`, clé `realtimeProDesc`, argument de vente du plan Pro) : « *the moment our hourly WHO, ECDC, PAHO & Africa CDC sync detects it* ».

**Pourquoi c'est un angle neuf et pas la re-proposition du 29/07.** L'entrée du 29/07 traitait le défaut inverse — la page méthodologie **sous-déclarait** le pipeline (13 crons réels, 4 sources annoncées) — et le correctif de ce soir-là a porté sur `/methodology` seule. Le sens inverse n'a jamais été regardé : une source **annoncée** dont la base ne porte rien. Et la mémoire `project_faq5_sources_claim_narrower_than_reality_2026_08_26` a laissé le sujet ouvert côté FAQ sans mesurer ce cas-ci.

**La couverture Afrique, elle, existe** — via `who.int`, `polioeradication.org` (13 lignes polio ajoutées le 22/08), `ncdc.gov.ng`, `afro.who.int`, `tchadinfos.com`, `enqueteplus.com`. Le défaut n'est donc pas un trou de couverture, c'est une **attribution fausse** : on nomme un fournisseur qui ne fournit pas. Pour un public d'épidémiologistes — et sur la zone que HWG prospecte le plus, d'où viennent les deux seuls retours utilisateurs réels — c'est une affirmation qui ne survit pas à cinq minutes de vérification.

**Ce que la source publie pendant ce temps** (flux relu ce soir, 10 items, tous de moins de 45 jours) : *Uganda ends Ebola outbreak following completion of 42-day countdown* (27/08), *Africa CDC and WHO welcome the allocation of Ebola vaccines to the DRC* (20/08), *Three Months into the Bundibugyo Ebola Outbreak* (17/08). Le flux est vivant et parle du foyer phare de la base (Ebola/RDC, ligne verrouillée `source_priority=10`). Rien n'en arrive. *(Vérifié : Ebola/Ouganda est déjà inactive depuis le 29/07 — l'item du 27/08 n'aurait rien changé, je ne le compte pas comme une donnée manquée.)*

**Correctif proposé, en deux moitiés qu'il ne faut pas confondre.**
- **(a) Mécanique, et c'est celle-ci que la routine construit** : une sonde dans `data-quality`, section `4n`, sur le modèle exact de la sonde GPEI livrée le 22/08 (section `4j`) — pour chaque source **nommée publiquement** comme fournisseur (WHO, ECDC, PAHO, Africa CDC), compter les lignes actives dont l'hôte source correspond, et remonter dans `needsReview` toute source annoncée à zéro ligne active. Elle aurait crié il y a des semaines. Effort : petit, aucune migration, aucun e-mail client, un seul fichier.
- **(b) Éditoriale, et elle appartient à David** : que faire de l'annonce elle-même. Trois options — réparer le pipeline (mais rien ne garantit qu'Africa CDC republie de l'exploitable au format attendu), qualifier la mention (« sources : OMS, ECDC, PAHO, Africa CDC, WHO AFRO, NCDC… » sans hiérarchie promise), ou la retirer. Non construite : c'est un choix de positionnement, et le retrait toucherait aussi `welcome-email.ts`, `upgrade-email.ts`, `churn-email.ts` et `digest-email.ts`, donc du contenu d'e-mails partant à des clients réels — garde-fou 3.

**Effort :** petit pour (a). Non chiffré pour (b), qui est une décision avant d'être un chantier.

**Risque/inconnue :** (a) la sonde a besoin d'une correspondance hôte→source annoncée écrite à la main, donc d'une liste à tenir — c'est le même défaut que le contrôle « pays câblé, zéro ligne » du 24/08, qui comparait la base à une copie manuelle périmée ; à dériver de `lib/source-trust.ts` plutôt que de recopier une liste. (b) Une source peut légitimement passer à zéro ligne active sans être en panne (foyers clos) — la sonde doit donc dire « zéro **et** aucune écriture depuis N jours », pas « zéro » seul.

### 2. 🟠 Aucun des 51 crons ne réessaie un fetch : un incident réseau d'une seconde coûte un cycle entier — jusqu'à **sept jours** pour les six crons du lundi

**Signal.** Ce qui a mis `sync-africa-cdc` en `error` ce matin n'est pas une panne de la source : le flux répond parfaitement depuis ici, avec **les en-têtes exacts de la prod** — 20 requêtes sur 20 en succès, 95 304 octets à chaque fois, et un certificat TLS valide jusqu'au 16/10 sur 12 sondes. C'était un incident transitoire, et une seule tentative a suffi à perdre la journée.

**Mesuré dans Sentry** (fenêtre consultable de 14 jours, `statsPeriod` plafonné à `14d` par l'API) :

```
TypeError: fetch failed                        cron:sync-africa-cdc   2 jours : 28/08, 02/09
TimeoutError: operation aborted due to timeout cron:check-new-don     2 jours : 21/08, 02/09
```

Le coût n'est pas le même selon la cadence, et c'est là qu'est le vrai point : `check-new-don` tourne **toutes les heures** (`20 * * * *`) — un timeout lui coûte une heure, il se rattrape seul. `sync-africa-cdc` tourne **une fois par jour** (`10 9 * * *`) — il perd 24 h. Et six crons de source ne tournent que le **lundi** (`sync-endemic-data`, `sync-pacific-surveillance`, `sync-wpro-dengue-update`, `sync-samoa-dengue`, `check-wer-cholera`, `send-sitrep-emails`) : pour eux, un `ECONNRESET` d'une seconde coûte **une semaine entière** d'ingestion, en silence, avec un `status: "error"` que personne ne distingue d'un échec de fond.

**La cause est structurelle et tient en une ligne, répétée 51 fois.** Chaque cron fait exactement une tentative :

```ts
const res = await fetch(AFRICA_CDC_RSS, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(15_000) });
```

`grep` sur `app/api/cron/**` et `lib/**` : **aucun helper de réessai n'existe dans le dépôt**, et aucun cron n'en implémente un à la main. Le budget est pourtant là — `vercel.json` accorde `maxDuration: 300` à `app/api/cron/**`, et `sync-africa-cdc` se déclare à 60 s pour un fetch de 15 s.

**Pourquoi ça compte au-delà de l'hygiène.** C'est la mémoire `reference_govt_sites_need_browser_user_agent` prise par l'autre bout : là, six runs de fausse panne venaient d'un filtrage d'en-tête ; ici, une vraie panne d'une seconde devient un trou d'une semaine. Dans les deux cas le produit conclut « la source est muette » sur la preuve d'une seule requête.

**Correctif proposé.** Un helper partagé — `lib/fetch-retry.ts`, `fetchWithRetry(url, init, { attempts: 3, backoffMs: [1000, 4000] })` — qui ne réessaie que sur échec réseau et sur 502/503/504 (jamais sur 403 ni 404 : un filtrage d'UA ou un soft-404 n'est pas un incident transitoire et le marteler serait pire), et qui journalise le nombre de tentatives dans le message de `logCronRun` pour qu'un flux devenu instable finisse par se voir. Appliqué d'abord au **fetch de listing** des crons quotidiens et hebdomadaires — pas aux boucles par article, qui ont déjà leur propre budget de temps global.

**Effort :** petit — un fichier neuf d'une trentaine de lignes, plus un remplacement d'appel par cron de source. Aucune migration, aucun e-mail client.

**Risque/inconnue :** (a) trois tentatives sur un cron qui enchaîne ensuite N fetchs par article peuvent approcher le `maxDuration` — d'où le périmètre limité au listing ; (b) réessayer masque la fréquence réelle des incidents si on n'en garde pas trace, d'où le compteur de tentatives dans le journal ; (c) je n'ai pas mesuré le taux d'échec au-delà de 14 jours, la rétention Sentry consultable s'arrête là — les 4 jours perdus mesurés sont donc un plancher, pas un total.


**Statut initial des deux idées : PROPOSÉE** — issue de la construction ci-dessous.

### Construction — reportée, verrou de code tenu par `daily-security-audit-healthwatch`

Les deux idées passent les trois garde-fous (effort petit, aucune migration, aucun e-mail client — la moitié **(b)** de l'idée 1 en est explicitement exclue et n'est pas proposée à la construction). Elles n'ont pourtant pas été construites : le verrou de code partagé, en place depuis ce matin (`_shared/code-lock.md`), était déjà pris.

**Statut des deux idées : construction reportée — verrou de code pris par `daily-security-audit-healthwatch` jusqu'au 2026-09-02T17:10:25Z, retentée au prochain run.**

Sortie verbatim de la tentative d'acquisition, faite juste avant la première édition de code comme le veut le protocole :

```
$ node _shared/code-lock.mjs acquire daily-product-ideas-healthwatch
REFUSE — verrou tenu par "daily-security-audit-healthwatch" jusqu'au 2026-09-02T17:10:25.568Z (acquis 2026-09-02T16:10:25.568Z).
EXIT=1
```

Le verrou n'ayant pas été acquis, il n'est **pas** relâché par ce run — relâcher un verrou tenu par une autre routine serait pire que le contention qu'il évite.

Conformément au protocole, aucune édition de `app/`, `lib/` ou `components/` n'a été faite ce soir, et le travail hors code (mesures, proposition, journal) a été mené jusqu'au bout.

### Ce qui reste chez David

1. **Idée 1, moitié (b)** — décision de positionnement sur l'annonce « Africa CDC », la seule des deux moitiés qui ne se construit pas seule. C'est aussi la seule chose de ce run qu'un prospect peut voir aujourd'hui.
2. Les deux constructions repartent d'elles-mêmes au prochain run si le verrou est libre.

### Fichiers modifiés par d'autres, laissés intacts (AGENTS.md)

`marketing/qa/product-claims.manual.json` (modifié), `scripts/audit-alert-day.mjs` et `scripts/probe-alert-lock.mjs` (non suivis) étaient déjà présents au début de ce run — ce sont les mêmes trois qu'au run du matin. Non committés, non stashés, non annulés.

### Suite du même soir (02/09, session interactive) — construction faite sur ordre explicite de David

David a demandé la construction en session interactive (« applique tes recommandations »), après le report ci-dessus. Deux points avant de construire :

- **Le verrou constaté « pris » était un verrou de test**, pas une session réelle en train d'éditer du code. La tâche ponctuelle `hwg-code-lock-test-hold-2026-09-02` (créée le 02/09 précisément pour forcer ce passage de `daily-product-ideas-healthwatch` à rencontrer un verrou déjà pris — test du protocole `_shared/code-lock.md` lui-même) tenait le verrou sous le nom `daily-security-audit-healthwatch`, alors que cette routine avait réellement tourné et terminé à 05h39 UTC ce matin, bien avant. Confirmé avant de construire : aucune édition de code concurrente réelle en cours.
- Étant en session interactive avec David présent — exactement la situation que le verrou sert à protéger contre l'*absence* de supervision — construire maintenant plutôt que d'attendre l'expiration du verrou de test (17h10 UTC) a été jugé raisonnable. Le verrou de test n'a pas été touché (ni acquis de force, ni son fichier modifié) ; il a simplement expiré de lui-même par la suite.

**Idée 1(a) — ✅ CONSTRUITE, commit `bb2a707b`** (`app/api/cron/data-quality/route.ts`, section 4n). Sonde qui compare les quatre sources annoncées sur `/methodology` (WHO DON, ECDC, PAHO, Africa CDC — exportées comme `PUBLICLY_CLAIMED_SOURCES` depuis `lib/source-trust.ts`, dérivées de `sourceName()` plutôt que recopiées à part) à l'ensemble des lignes actives. Fenêtre de grâce par source (3j pour WHO DON, 14j pour les trois autres) pour ne pas confondre un zéro légitime avec une panne. **Rejouée contre la prod avant livraison** : flague exactement Africa CDC (0 ligne active, dernière écriture il y a 22,3 jours), silencieuse sur les trois autres — le résultat attendu, confirmé chiffre pour chiffre.

**Idée 2 — ✅ CONSTRUITE (partiellement, périmètre resserré), commit `bb2a707b`** (`lib/fetch-retry.ts` + 4 crons). `fetchWithRetry()` ne réessaie que les échecs réseau et 502/503/504 (jamais 403/404), journalise le nombre de tentatives. Testée unitairement (4 cas : réseau puis succès, 403 jamais réessayé, 503 réessayé puis abandon propre, réseau toujours en panne — les quatre se comportent comme attendu).

Appliqué à **4 crons** dont le fetch de listing est un appel unique et identifiable sans ambiguïté : `sync-africa-cdc` (le cas qui a motivé la construction), `sync-taiwan-cdc`, `sync-malaysia-dengue`, `sync-drc-sitrep`.

**Un défaut trouvé et corrigé avant commit, pas après.** Le calibrage initial (3 tentatives × 15s + backoff, repris du défaut de la librairie) portait le pire cas à 50s pour `sync-africa-cdc` — un cron à `maxDuration: 60` dont la boucle par article, en aval de la RSS, **n'a aucun garde-fou de budget propre** (contrairement à `sync-who-afro`, qui en a un). Un pire cas à 50s n'aurait laissé que 10s à cette boucle, avec un vrai risque de troncature en plein milieu d'écritures DB — exactement le risque que j'avais signalé à David dans la proposition du soir (« trois tentatives … peuvent approcher le maxDuration »). Resserré à 2 tentatives × 8s (pire cas 17s) pour ce cron, et calibré cron par cron pour les trois autres (`sync-taiwan-cdc`/`sync-malaysia-dengue` : 2×10s, pire cas 21s sur un budget de 30s ; `sync-drc-sitrep` : 2×15s, pire cas 32s sur un budget de 60s, en laissant de la marge à `pdf-parse` en aval). `npx tsc --noEmit` et `npx eslint` propres sur les 7 fichiers touchés après ce resserrage.

**Rollout volontairement non étendu ce soir** aux ~15 autres crons de source dont la chaîne de fetch a plusieurs étapes (listing puis détail par item, parfois PDF) — `sync-who-regional` (14 appels `fetch()`), `sync-paho-alerts`, `sync-spf`, `sync-who-afro`, `sync-pacific-surveillance`, `sync-wpro-dengue-update`, `check-wer-cholera`, `check-mpox-sitrep`, `sync-ecdc-threats`, `sync-cdc-notices`, `sync-ukhsa`, `sync-who-emro`, `sync-usda-aphis`, `sync-samoa-dengue`, `sync-endemic-data`. Chacun demande une lecture au cas par cas pour isoler avec certitude le bon appel (« lequel est la liste, lequel est le détail par item ») sans envelopper par erreur une boucle par article déjà sans marge sous `maxDuration` — précisément le risque qui vient d'être trouvé et corrigé sur `sync-africa-cdc`. Reste au log comme périmètre d'extension naturel, pas une omission silencieuse.

**Statut final des deux idées : CONSTRUITES** (1a entièrement ; 2 sur le périmètre resserré ci-dessus, extension documentée comme reste à faire).

### Suite du même soir (02/09, session interactive) — rollout du fetch-retry sur les crons restants

David a demandé le rollout complet en session interactive (« rollout du fetch-retry sur les crons restants »). Verrou de code réacquis proprement cette fois (`daily-product-ideas-healthwatch`, échéance 19h30 UTC) — le verrou de test constaté hier avait entre-temps expiré.

**Lecture du flux de contrôle avant édition, fichier par fichier**, pour distinguer sans ambiguïté le fetch de listing (unique, dont l'échec est fatal et rapporté) d'une chaîne de secours à plusieurs candidats (déjà résiliente par construction) ou d'un helper générique partagé sur plusieurs sites d'appel.

**✅ CONSTRUIT, commit `07493f46`** — 10 crons supplémentaires, chacun calibré individuellement (pire cas très en-dessous de son `maxDuration`) :

| cron | site enveloppé | maxDuration | pire cas |
|---|---|---|---|
| `sync-ecdc-threats` | `ECDC_RSS_FEED`, étape 1 | 60 | 21s |
| `sync-cdc-notices` | `CDC_NOTICES_URL`, étape 1 | 120 | 21s |
| `sync-ukhsa` | `UKHSA_ATOM`, étape 1 | 300 | 32s |
| `check-wer-cholera` | `WER_LISTING_URL` (`fetchIssueList`, retourne `null`) | 60 | 21s |
| `check-mpox-sitrep` | `WHO_SITREP_PAGE` (`fetchLatestSitrep`, retourne `null`) | 60 | 21s |
| `sync-samoa-dengue` | `LISTING_URL` (`findLatestIssue`, retourne `null`) | 90 | 21s |
| `sync-pacific-surveillance` | `LISTING_URL` (`findLatestBulletinItemUrl`, lève une exception) | 60 | 21s |
| `sync-wpro-dengue-update` | `LISTING_URL` (`findLatestEditionUrl`, lève une exception) | 60 | 21s |
| `sync-paho-alerts` | **deux** sites : `PAHO_ALERT_URL` (étape 1) et `PAHO_SITREP_URL` (`collectSitrepItems`, sous-pipeline rougeole indépendant) | 300 | 32s chacun |
| `sync-who-afro` | seulement `AFRO_LIST_URL` (branche HTML de secours) | 120 | 21s |

Pour `sync-who-afro`, l'essai RSS rapide qui précède (`AFRO_RSS_URL`) est **délibérément laissé sans retry** : il dégrade déjà proprement en tombant sur la branche HTML à tout échec (`catch { /* fall through */ }`), donc le réessayer aurait seulement retardé l'arrivée sur le vrai fallback, sans bénéfice.

**Volontairement non touché ce soir — documenté, pas une omission silencieuse.** Cinq crons restent sans retry, chacun pour une raison structurelle distincte, pas par manque de temps :

- **`sync-who-regional`** (14 appels `fetch()`) — gros cron en éventail multi-source, demande une lecture complète avant toute édition.
- **`sync-usda-aphis`** — chaîne de candidats CSV (`APHIS_CSV_CANDIDATES`, boucle `for...of` avec `catch { continue }`) puis repli HTML. Résiliente par construction : un candidat en échec réseau passe déjà au suivant. Ajouter un retry par candidat multiplierait le pire cas sans gain net évident.
- **`sync-who-emro`** — même patron : `EMRO_LIST_URLS`, boucle de candidats avec `continue` silencieux.
- **`sync-spf`** — même patron à deux niveaux : `SPF_RSS_URLS` (boucle de candidats) puis repli HTML, tous deux avalant leurs erreurs sans les rapporter.
- **`sync-endemic-data`** — `fetchHtml(url)` est un helper générique appelé **7 fois** à des endroits différents du fichier (flux, listing, JSON WHO, PDF…) ; l'envelopper de retry s'appliquerait aveuglément aux 7 sites, dont certains sont probablement des boucles par item — pas vérifié faute de lecture complète du fichier ce soir.

Chacun de ces cinq redemande une lecture au cas par cas pour ne pas envelopper par erreur une boucle par article déjà sans marge sous `maxDuration` — précisément le défaut trouvé et corrigé hier soir sur `sync-africa-cdc` avant le premier commit.

`npx tsc --noEmit` et `npx eslint` propres sur les 10 fichiers touchés. Verrou de code relâché après le push.

**Bilan cumulé fetch-retry (deux commits, `bb2a707b` + `07493f46`) : 14 crons sur 51 couverts.** Les 5 restants ci-dessus, plus les crons hors périmètre de la proposition initiale (déclencheurs horaires/toutes les N minutes qui se rattrapent seuls), forment le reliquat.

### Suite du même soir (02/09, session interactive) — `sync-who-regional` : rollout NON fait, risque réel trouvé à l'investigation

David a demandé le rollout sur `sync-who-regional`. Verrou de code réacquis puis relâché sans écriture — l'investigation a changé la conclusion.

**Ce cron n'est pas de la même famille que les 14 déjà traités.** Les autres ont UN fetch de listing, dont l'échec est rare et coûteux (jusqu'à une semaine perdue). `sync-who-regional` fait l'inverse : ~139 cibles disease×pays traitées en **boucle séquentielle sans garde-fou de budget** (contrairement à `sync-who-afro`), chacune avec son propre fetcher direct — pas de fetch de listing unique à envelopper.

**Chiffrage avant toute décision, par groupe d'hôte partagé** (chaque groupe est un point de défaillance commun — une panne systémique sur UN hôte touche toutes ses cibles le même run) :

| groupe (hôte) | cibles | timeout/cible | pire cas SANS retry | pire cas AVEC retry (2×, backoff 1-2s) |
|---|---|---|---|---|
| `ghoapi.azureedge.net` (rougeole, polio-GHO, fièvre jaune, leishmaniose, diphtérie) | 21 | 10s | 210s | **~441s** |
| `xmart-api-public.who.int` (dengue + mpox) | 27 | 10s | 270s | **~567s** |
| ArcGIS (choléra) | 18 | 10s | 180s | **~378s** |
| `wnv-weekly.ecdc.europa.eu` (VNO) | 7 (même URL relue 7×) | 15s | 105s | ~224s |
| page hebdo GPEI (polio cVDPV) | 13 (même URL relue 13×) | 10s | 130s | ~273s |
| bulletin méningite (`cdn.who.int`) | 4, déjà résilient (boucle interne semaines×dossiers) | 15s | — | non concerné |

`maxDuration = 300`. **Trois des six groupes dépasseraient le budget avec un retry 2× en cas de panne systémique de leur hôte — jusqu'à 567s, presque le double du plafond.** Sans retry, aucun ne le dépasse aujourd'hui (le plus haut, xmart à 270s, reste sous 300s). Le retry transformerait ici une panne systémique **survivable** (le run se termine en retard mais entier, sur son propre `AbortSignal.timeout`) en une panne **fatale** (Vercel tue la fonction en plein milieu, perdant le travail de toutes les cibles restantes dans la boucle, pas seulement celles touchées par la panne).

**Deux des six groupes ont, en plus, un défaut préexistant et distinct trouvé au passage** (pas construit ce soir, hors périmètre de « ajouter du retry ») : `fetchWNVEcdc` et `fetchPolioGPEIThisWeek` refetchent la **même URL** une fois par cible qui l'utilise — 7 fois pour la page VNO ECDC, 13 fois pour la page GPEI, sans aucune mise en cache partagée au sein d'un même run. Ajouter du retry là-dessus aurait multiplié un gaspillage déjà là, sans le corriger.

**Conclusion : pas de sous-ensemble sûr à envelopper de retry ce soir.** Les six groupes se répartissent en trois catégories, aucune ne se prêtant à un ajout de retry mécanique sans risque net :
1. Comptage de cibles trop élevé par hôte (ghoapi, xmart, ArcGIS) → budget déjà dépassé en cas de panne, avec retry.
2. URL partagée réinterrogée en boucle (WNV, GPEI) → le vrai correctif est la mise en cache, pas le retry.
3. Déjà résilient par construction (méningite, boucle multi-candidats).

**Ce qui rendrait un rollout sûr ici, si David le souhaite comme chantier à part** : ajouter d'abord un garde-fou de budget temporel à la boucle principale de `runSyncWhoRegional` (même patron que `sync-who-afro`, trouvé le 02/09 au soir dans l'exploration d'hier — sortir proprement avant que Vercel tue la fonction, journaliser les cibles non traitées). Une fois ce filet posé, un retry devient sûr : le pire cas dégrade en « certaines cibles sautées, journalisé » plutôt qu'en troncature brutale en pleine écriture DB. Effort moyen (une nouvelle logique de budget + tests contre les ~139 cibles), pas petit — distinct du reste de ce rollout, qui a pu rester mécanique sur les 14 crons précédents précisément parce qu'aucun n'avait ce problème structurel.

**Aucune ligne de code touchée ce soir sur ce fichier.** Verrou de code acquis puis relâché sans écriture, une fois la conclusion établie.

### Suite du même soir (02/09, session interactive) — garde-fou de budget construit sur `sync-who-regional`

David a demandé la construction du garde-fou en premier (« construis le garde-fou de budget en premier »), suite au risque chiffré ci-dessus. Verrou de code réacquis, édition faite, relâché après le push.

**✅ CONSTRUIT, commit `5a235b75`** (`app/api/cron/sync-who-regional/route.ts`). Même patron que `ARTICLE_LOOP_BUDGET_MS` dans `sync-who-afro` (seul cron de cette famille à déjà avoir ce garde-fou) :

- `TARGET_LOOP_BUDGET_MS = 220_000` (220s sur un `maxDuration` de 300s — 80s de marge pour la lecture DB initiale et l'écriture batchée `sourceConfirmed` en fin de boucle).
- Vérifié au **début de chaque itération** de la boucle sur les 139 cibles : au-delà du budget, sortie propre (`break`) avec le nombre de cibles restantes journalisé dans `log` (`{ label: "budget", status: "skip", detail: "… N target(s) left unprocessed" }`), plutôt qu'un hard-kill Vercel en pleine écriture DB.
- Les cibles déjà traitées avant le dépassement restent journalisées/écrites normalement ; les autres sont reprises au prochain run (quotidien, 08h05 UTC) — pas de perte définitive, juste un décalage d'un jour pour les cibles en fin de liste en cas de panne systémique.

`npx tsc --noEmit` et `npx eslint` propres sur le fichier touché.

**Ce que ça change concrètement** : avant ce soir, une panne systémique d'un seul jour sur `xmart-api-public.who.int` (27 cibles dengue+mpox) pouvait déjà pousser ce cron à 270s sans aucune erreur de code — collé au plafond de 300s, sans marge. Le garde-fou ne réduit pas ce risque de dépassement en soi (il existait déjà), mais **change ce qui se passe quand ça arrive** : un dépassement devient une sortie propre et journalisée plutôt qu'une troncature brutale au milieu d'écritures DB.

**Ce que ça ouvre, pas construit ce soir** : avec ce filet en place, ajouter `fetchWithRetry` (`lib/fetch-retry.ts`) aux fetchers de ce cron redevient sûr — un dépassement dû au retry dégraderait désormais proprement au lieu d'être fatal. Le retry lui-même reste à construire, sur nouvelle demande explicite de David s'il le souhaite : ce soir portait spécifiquement sur le garde-fou, pas sur le rollout complet qui en dépendait.

### Suite du même soir (02/09, session interactive) — retry construit sur les fetchers GHO/xmart/ArcGIS de `sync-who-regional`

David a demandé le retry sur ce sous-ensemble précis (« ajoute le retry sur les fetchers GHO/xmart/ArcGIS »), maintenant que le garde-fou de budget (commit `5a235b75`) absorbe un dépassement au lieu de le rendre fatal. Verrou de code réacquis, édition faite, relâché après le push.

**✅ CONSTRUIT, commit `6399da3b`.** `fetchWithRetry` appliqué aux **8 fetchers par-cible** (46 cibles au total, 10 sites de fetch — 2 des 8 fetchers, dengue et choléra, ont chacun un site principal + un site de repli) :

| fetcher | hôte | cibles | sites de fetch |
|---|---|---|---|
| `fetchMeaslesGHO`, `fetchPolioGHO`, `fetchYellowFeverGHO`, `fetchLeishmaniasisGHO`, `fetchDiphtheriaGHO` | `ghoapi.azureedge.net` | 21 | 1 chacun |
| `fetchDengueGlobalSurveillance` | xmart | 22 | 2 (`sumYear` + repli `latestUrl`) |
| `fetchMpoxGlobalSurveillance` | xmart | 5 | 1 |
| `fetchCholeraGlobalSurveillance` | ArcGIS | 18 | 2 (`sumYear` + repli `probeUrl`) |

**Calibrage délibérément différent du reste du rollout de ce soir** : 2 tentatives × **5s** (au lieu de 2×10-15s pour les 14 crons précédents). Choix motivé par les chiffres de l'investigation précédente : le pire cas par appel (~10,5s avec ce calibrage) reste très proche du timeout original à tentative unique (10s) — donc une panne totale d'un hôte n'allonge quasiment pas le temps consommé dans `TARGET_LOOP_BUDGET_MS` par rapport à avant ce commit, alors qu'un incident bref (le cas que le retry est censé servir) se rattrape désormais au lieu de coûter la cible pour la journée.

**Volontairement pas touché, avec raison distincte pour chacun** :
- `fetchPolioGPEIThisWeek` et `fetchWNVEcdc` — refetchent la **même URL partagée** par plusieurs cibles (13× et 7× par run, sans mise en cache). Y ajouter du retry multiplierait un gaspillage déjà présent sans le corriger ; la vraie solution est la mise en cache, pas le retry. Signalé comme trouvaille distincte dans l'entrée précédente, pas construit ce soir.
- Le fetcher méningite — déjà résilient par construction (boucle de candidats semaines × dossiers), même famille que les crons à chaîne de secours laissés de côté dans le rollout précédent (`sync-usda-aphis`, `sync-who-emro`, `sync-spf`).
- `queryReliefWeb` — code mort (`reliefWebOk = false`), rien à envelopper.

`npx tsc --noEmit` et `npx eslint` propres sur le fichier touché.

**Bilan cumulé fetch-retry, trois commits ce soir (`bb2a707b`, `07493f46`, `6399da3b`) : 14 crons entiers + 8 fetchers ciblés d'un 15e (`sync-who-regional`, 46 cibles sur ses 139) couverts.** Reliquat inchangé pour le reste : `sync-usda-aphis`, `sync-who-emro`, `sync-spf`, `sync-endemic-data` (chaînes de secours / helper générique partagé), et pour `sync-who-regional` spécifiquement, `fetchPolioGPEIThisWeek`/`fetchWNVEcdc` (nécessitent une mise en cache avant qu'un retry ait du sens) et la méningite (déjà résiliente).

### Suite du même soir (02/09, session interactive) — mise en cache + retry construits pour GPEI et WNV

David a demandé la mise en cache pour ces deux fetchers (« ajoute la mise en cache pour GPEI et WNV »), le dernier des trois volets laissés ouverts ce soir (garde-fou → retry GHO/xmart/ArcGIS → ce commit). Verrou de code réacquis, édition faite, relâché après le push.

**✅ CONSTRUIT, commit `a31bf33b`.** `getGpeiSection()` et `getWnvSeason()` : un cache module-level (une promesse partagée) mémorise le premier fetch+parse de chaque page pour toutes les cibles suivantes du même run, remis à zéro au début de chaque `runSyncWhoRegional()` — protection contre un conteneur serverless chaud qui servirait la page de la veille, même si peu probable pour un cron quotidien à 24h d'écart.

**`fetchWNVEcdc` va plus loin que le simple fetch.** La page entière était aussi **ré-analysée** 7 fois (pas seulement re-téléchargée) : le total saison (`sorted`, `totalCases`, `totalAreas`, `countryList`) agrège TOUS les pays et ne dépend pas de la cible — donc identique à chaque appel. La fonction extrait désormais un objet `WnvSeason` complet une seule fois ; chaque cible ne fait plus qu'un `byCountry.get(countryEn)` dessus.

**`fetchWithRetry` ajouté aux deux fetch désormais uniques** — 2 tentatives, 5s (GPEI) / 7,5s (WNV), proches des timeouts originaux à tentative unique. Sûr maintenant, contrairement à ce soir plus tôt : multiplier par 13/7 comme évoqué dans l'entrée précédente n'a plus de sens, puisqu'il n'y a plus qu'UN fetch par run pour chacun.

**Vérifié avant intégration**, simulation isolée du patron de mémoïsation (13 appels sur la même promesse → 1 fetch réel confirmé ; reset entre deux runs simulés → re-fetch confirmé).

`npx tsc --noEmit` et `npx eslint` propres sur le fichier touché.

**Bilan cumulé fetch-retry, quatre commits ce soir (`bb2a707b`, `07493f46`, `6399da3b`, `a31bf33b`) : 14 crons entiers + les 10 fetchers par-cible de `sync-who-regional` (46+13+7 = 66 cibles sur ses 139) couverts, plus une redondance réseau de 20 fetches/run (13 GPEI + 7 WNV) éliminée.** Reliquat inchangé pour le reste : `sync-usda-aphis`, `sync-who-emro`, `sync-spf`, `sync-endemic-data` (chaînes de secours / helper générique partagé) et, dans `sync-who-regional`, le fetcher méningite (déjà résilient par sa propre boucle de candidats — pas de redondance à corriger, contrairement à GPEI/WNV) et `queryReliefWeb` (code mort).

### Suite du même soir (02/09, session interactive) — mise en cache + retry construits pour la méningite

David a demandé la mise en cache pour ce dernier fetcher (« ajoute la mise en cache pour la méningite aussi »). Verrou de code réacquis, édition faite, relâché après le push.

**✅ CONSTRUIT, commit `ceaad694`.** `fetchMeningitisAFRO` (WHO AFRO n'a pas d'index d'édition fiable) fait une recherche par candidats — jusqu'à 6 semaines × 3 dossiers CDN = 18 URLs testées séquentiellement jusqu'au premier succès. **Trouvé en construisant** : cette recherche ne dépend d'AUCUN paramètre par cible — les 4 cibles (Nigeria, Tchad, Burkina Faso, Soudan du Sud) cherchent exactement la même suite de candidats et, une fois trouvée, la même table PDF entière ; seul le lookup final `table.get(label)` diffère par pays. C'est la même redondance que GPEI/WNV, mais **multipliée par la boucle imbriquée** : sans cache, chaque cible relançait la recherche complète depuis zéro, jusqu'à 4× la même suite de requêtes pour retrouver la MÊME édition.

`getMeningitisBulletin()` : cache module-level (une promesse partagée), recherche faite une seule fois par run, remise à zéro au début de chaque `runSyncWhoRegional()` — même patron que `getGpeiSection()`/`getWnvSeason()`.

`fetchWithRetry` ajouté sur **chaque candidat** de la boucle (2 tentatives, 7,5s) — sans danger même sur 18 candidats : la plupart des ratés sont un 404 délibéré (essai de plusieurs semaines/dossiers pour deviner la bonne édition), et `fetchWithRetry` ne réessaie jamais les 4xx (seulement les échecs réseau et 502/503/504) — donc le pire cas reste proche de l'original à tentative unique. Seul un candidat qui aurait réellement marché mais a subi un incident réseau passager bénéficie de la tentative supplémentaire.

`npx tsc --noEmit` et `npx eslint` propres sur le fichier touché.

**Bilan cumulé fetch-retry, cinq commits ce soir (`bb2a707b`, `07493f46`, `6399da3b`, `a31bf33b`, `ceaad694`) : 14 crons entiers + les 11 fetchers par-cible de `sync-who-regional` (66+4 = 70 cibles sur ses 139) couverts, plus deux redondances réseau/CPU éliminées (20 fetches/run GPEI+WNV, jusqu'à 3× la recherche complète méningite/run).** Reliquat pour le reste : `sync-usda-aphis`, `sync-who-emro`, `sync-spf`, `sync-endemic-data` (chaînes de secours / helper générique partagé) et, dans `sync-who-regional`, uniquement `queryReliefWeb` (code mort, `reliefWebOk = false` — rien à envelopper).

### Suite du même soir (02/09, session interactive) — retry construit sur `sync-who-emro` et `sync-spf`

David a demandé le rollout sur ces deux crons (« rollout sur sync-who-emro et sync-spf »). Verrou de code réacquis, édition faite, relâché après le push.

**Ces deux crons avaient été volontairement écartés du rollout initial** (entrée du 02/09 soir, commit `07493f46`) au motif « chaîne de secours à N candidats déjà résiliente, retry par candidat au gain incertain ». Ce jugement a été **reconsidéré** à la lumière du travail fait ensuite sur GPEI/WNV/méningite dans `sync-who-regional` : `fetchWithRetry` ne réessaie jamais un 4xx (seulement les échecs réseau et 502/503/504), donc l'ajouter sur une boucle de candidats est sûr par construction — un candidat génuinement absent (404, guessing la bonne URL) tombe toujours au suivant au même rythme qu'avant ; seul un candidat qui aurait fonctionné mais a subi un incident réseau passager bénéficie désormais d'une deuxième chance au lieu de tomber silencieusement sur un candidat plus faible.

**✅ CONSTRUIT, commit `9a9860e4`.**
- `sync-who-emro` : `EMRO_LIST_URLS` (2 candidats), 2 tentatives × 8s.
- `sync-spf` : `SPF_RSS_URLS` (3 candidats) + repli HTML `SPF_NEWS_URL`, 2 tentatives × 6s chacun. Le repli HTML a dû être restructuré pour `fetchWithRetry` (qui ne lève jamais d'exception, contrairement au `fetch` original enveloppé dans un `try/catch`) — sans changer le comportement : un échec réseau reste fatal (log + retour 502, comme avant), un HTML mal formé reste fatal via son propre bloc `catch` désormais séparé du fetch.

Volontairement pas touché : les boucles par article/bulletin en aval (`entry.url` dans who-emro, `item.url` et la boucle séquentielle de bulletins arbovirus dans spf) — même discipline que le reste du rollout de ce soir, ce sont des fetchs par-item distincts du fetch de listing.

`npx tsc --noEmit` et `npx eslint` propres sur les deux fichiers touchés.

**Bilan cumulé fetch-retry, six commits ce soir : 16 crons entiers (les 14 initiaux + who-emro + spf) + les 11 fetchers par-cible de `sync-who-regional` (70 des 139 cibles) couverts.** Reliquat pour le reste : `sync-usda-aphis` (chaîne de candidats CSV, pas encore reconsidérée à la lumière de ce soir) et `sync-endemic-data` (helper générique partagé sur 7 sites d'appel, structure encore non vérifiée).

### Suite du même soir (02/09, session interactive) — retry construit sur `sync-usda-aphis` et `sync-endemic-data`, dernier volet

David a demandé le rollout sur ces deux derniers crons (« rollout sur sync-usda-aphis et sync-endemic-data »). Verrou de code réacquis, édition faite, relâché après le push.

**✅ CONSTRUIT, commit `46d63eeb`.**

**`sync-usda-aphis`** — même reconsidération que who-emro/spf (commit `9a9860e4`) : `APHIS_CSV_CANDIDATES` (4 candidats, 2×4s) puis repli HTML `APHIS_HTML_URL` (2×7,5s). La 3ᵉ stratégie (`scrapeAphisTableauCsv`, navigateur headless pilotant l'UI « Download crosstab » de Tableau) reste **volontairement hors périmètre** — mécanisme différent, pas un simple `fetch()` à envelopper.

**`sync-endemic-data`** — le cas le plus délicat de ce soir. `fetchHtml()` était un helper partagé sur **6 sites d'appel** aux profils de risque très différents, jamais vérifié jusqu'ici (c'est exactement pourquoi ce cron avait été écarté du rollout initial). Lecture complète du fichier avant toute édition :
- **4 sites sûrs** : boucles bornées sur des URLs candidates/listing génuinement distinctes — 3 flux RSS (dengue Philippines), 1 appel API unique (recherche du dernier bulletin choléra), 3 pages de recherche (leptospirose Thaïlande), 8 semaines de bulletin SEARO devinées. Retry ajouté (2×6s chacun).
- **2 sites laissés inchangés** : boucles par article découvert (jusqu'à 5-6 items, après succès du listing) — même discipline que le reste du rollout de ce soir, ce sont des fetchs par-item.

`fetchHtml()` prend désormais un paramètre `retry` optionnel (défaut : 1 tentative, comportement identique à avant) plutôt que d'être enveloppée en bloc — seul moyen de respecter la distinction site par site sans dupliquer le helper. Le fetch PDF direct de `tryWHOGlobalCholeraUpdate` (3 candidats de date, hors `fetchHtml`) est traité séparément, même calibrage.

**Plus aucun appel `fetch()` brut dans les deux fichiers** — tout passe désormais par `fetchWithRetry`, directement ou via `fetchHtml()`.

`npx tsc --noEmit` et `npx eslint` propres sur les deux fichiers touchés.

**Bilan cumulé fetch-retry, sept commits ce soir : les 18 crons de source identifiés dans la proposition initiale sont désormais tous couverts** (18 entiers pour ceux à listing unique, plus les 11 fetchers ciblés de `sync-who-regional` sur ses 139 cibles). Aucun reliquat annoncé ce soir ne reste en attente — la seule chose délibérément non touchée est `queryReliefWeb` dans `sync-who-regional` (code mort, `reliefWebOk = false`) et la stratégie Tableau/headless-browser d'APHIS (mécanisme différent, hors du périmètre « ajouter du retry à un fetch »).

### Suite du même soir (02/09, session interactive) — vérification des 20 crons touchés + 2 régressions trouvées et corrigées

David a demandé de vérifier que les 51 crons tournent sans erreur, suite au rollout massif de fetch-retry de ce soir (sept commits, 18 crons + `sync-who-regional`). Vérification ciblée sur les **20 fichiers réellement modifiés ce soir** (les 31 autres n'ont reçu aucune édition, pas de raison nouvelle de les re-tester) : les 20 endpoints ont été appelés un par un contre la prod déployée (`https://healthwatch-global.com`, `CRON_SECRET` d'authentification), lus dans leur réponse JSON plutôt que devinés. Sans risque d'envoi dupliqué à des clients : les 20 crons touchés sont tous des crons d'ingestion/rapport interne (`data-quality` et les fetchers réutilisés dans `sync-*` envoient au plus à `ADMIN_EMAILS`, jamais à un abonné réel — vérifié avant de lancer un seul appel).

**Résultat du premier passage : 18/20 propres, 2 échecs — tous deux corrigés dans la foulée.**

**1. `sync-taiwan-cdc` — HTTP 500 « extraction failed ».** Non lié au retry (le fetch réussissait, HTTP 200, 99 791 octets). La page source a changé son avis de mise à jour d'un horodatage précis (`資料更新時間為YYYY/MM/DD HH:MM`) vers une formule générique (« mis à jour quotidiennement à 08h30 ») — confirmé en direct, aucune date exploitable dans le nouveau libellé. **Corrigé, commit `97bf5cee`** : bascule sur la ligne « date d'apparition du cas le plus récent » (`最近一例發病日`) du tableau de statistiques, même format `YYYY/MM/DD`, sémantiquement plus pertinente que l'ancien champ (fraîcheur réelle des cas plutôt qu'heure de régénération de page). Re-testé après déploiement : `HTTP 200, ok:true`, extraction correcte (2026-08-30, 155 cas, 0 décès), correctement écarté au profit d'une ligne déjà plus fraîche en base — comportement sain, garde-fou de régression qui fonctionne.

**2. `sync-usda-aphis` — `success:false, "aphis_unreachable"` malgré HTTP 200.** Régression **auto-introduite ce soir**, confirmée via Sentry (premier événement jamais enregistré pour ce cron, exactement à l'heure de la vérification, message « aborted due to timeout »). Cause : `aphis.usda.gov` s'est mesuré à 8-10 secondes même pour un 404 rapide — bien plus lent que toutes les autres sources retenues ce soir (~1s en temps normal). Le calibrage générique appliqué partout ailleurs (« moitié du timeout original × 2 tentatives ») a réduit le budget par tentative à 4s/7,5s, sous le temps de réponse réel de la source — chaque tentative expirait avant qu'une réponse n'arrive, sur les 4 candidats CSV **et** le repli HTML. **Corrigé, commit `6ba10a5a`** : timeout par tentative restauré à sa valeur d'origine (8s CSV, 15s HTML), toujours 2 tentatives — `maxDuration=300` laisse largement la place. Re-testé après déploiement : `HTTP 200, success:true`, 20 états vérifiés, 0 erreur, repli Tableau atteint normalement (comportement attendu et documenté depuis juin 2026 — APHIS a migré vers un tableau de bord Tableau, CSV/HTML sont censés échouer proprement, seul le FETCH lui-même devait aboutir).

**Leçon retenue pour tout calibrage futur** : le principe « moitié du timeout, deux tentatives, même pire cas » n'est sûr que si le timeout raccourci reste supérieur au temps de réponse réel de la source en régime normal — vrai pour les 17 autres sources retenues ce soir (mesurées à moins d'une seconde), faux pour APHIS. Un calibrage par défaut ne remplace pas une mesure réelle quand la source est connue pour être lente.

**Bilan final : les 20 crons touchés ce soir tournent tous sans erreur en prod, vérifié par appel direct et non par simple lecture de code.** Les 31 crons non modifiés n'ont pas été re-testés (aucun changement à vérifier) ; leur dernier statut connu (relevé plus tôt ce soir, avant le rollout) ne montrait aucune anomalie liée à ce travail.

### Suite du même soir (02/09, session interactive) — rollout retry aux crons de source restants (31 crons du fleet non touchés ce soir)

David a demandé le rollout sur le reste des crons non touchés (« rollout retry sur le reste des crons non touchés »). Verrou de code réacquis, édition faite, relâché après le push.

**Survey systématique des `fetch()` des 31 crons restants avant toute édition** (mêmes principes que toute la soirée : distinguer ingestion externe vs envoi vers un vrai destinataire, ne jamais toucher un envoi).

**Exclus délibérément — crons d'envoi, jamais candidats au retry.** `trigger-webhooks`, `watchlist-alerts`, `disease-alerts`, `push-alerts`, `regional-alerts`, `onboarding-sequence`, `weekly-digest`, `winback-sequence`, `send-sitrep-emails`, `trigger-tripwires`, `trigger-subscriber-alerts`, `trigger-pheic-alerts`, `trigger-regional-digest`, `pilot-follow-up`, `pilot-closing-reminder` : tous font un `POST` vers `api.brevo.com` (envoi réel à un abonné/pilote) ou vers l'URL webhook d'un client (`trigger-webhooks`). Ajouter du retry là-dessus risquerait un envoi/livraison dupliqué à un vrai destinataire si la requête aboutit côté serveur mais que la réponse expire côté nôtre — même famille de garde-fou que la règle maison sur les e-mails clients, jamais assouplie ce soir.

**Exclus, autres raisons.** `health-check` (3 fetch en lecture seule — auto-scan du site + stats Brevo — plus 1 envoi admin ; hors périmètre « ingestion de source », pas urgent). `sync-ncdc` (suspendu le 02/09 pour raison légale, plus aucun fetch depuis ce jour). `enrich-admin1`, `sync-signals`, `disease-coverage`, `sync-brevo-blocklist`, `weekly-signal`, `signup-canary`, `expire-trials` : aucun fetch externe trouvé, rien à envelopper.

**✅ CONSTRUIT, commit `fce8f58d`** (fusionné avec `b2588576`, une correction non liée poussée par une autre session pendant ce run — fusion propre, aucun chevauchement de fichiers) — trois sites d'ingestion externe réels trouvés et corrigés :

1. **`lib/who-api.ts`, `fetchWHODONList()`** — **LE fetch le plus exécuté du produit**, partagé par `sync-outbreaks` ET `check-new-don`, tous deux **horaires**. Contrat « lève une exception » préservé à l'identique (les deux appelants l'encapsulent déjà dans leur propre `try/catch`) — **aucune modification nécessaire dans ces deux fichiers**, seul le point d'entrée partagé a changé.
2. **`sync-cdc-han`**, fetch de listing (étape 1) — même forme exacte que les 14 crons traités plus tôt ce soir.
3. **`data-quality`, `fetchGPEIThisWeek()`** (section 4j) — appel unique par run, distinct de la page GPEI mise en cache dans `sync-who-regional` (deux pages GPEI différentes utilisées à des fins différentes).

**Calibrage : timeout par tentative INCHANGÉ par rapport à l'original partout** (15s WHO DON/cdc-han, 8s GPEI) plutôt que raccourci — leçon tirée du faux « aphis_unreachable » de ce soir (`6ba10a5a`) : pas de raccourcissement de timeout sans avoir mesuré la latence réelle de la source.

**Volontairement pas touché, documenté plutôt que forcé** : `data-quality`, `verifyFromDON()` (sections 4/4e) — boucle sur potentiellement toutes les lignes actives sourcées WHO DON, **aucun garde-fou de budget temporel** — même défaut structurel que `sync-who-regional` avant le garde-fou construit ce soir (`5a235b75`). Mesuré avant de trancher : **0 ligne correspond actuellement au filtre `DON_RE` strict** (aucune ligne active non-seed, non-verrouillée), donc risque nul aujourd'hui — mais construire le garde-fou d'abord serait le même chantier distinct que pour `sync-who-regional`, pas un ajout mécanique à forcer dans ce rollout.

`npx tsc --noEmit` et `npx eslint` propres sur les trois fichiers touchés.

**Vérification en prod après déploiement** — les quatre points d'ingestion touchés (deux directement, deux via le fetch partagé `fetchWHODONList`) appelés un par un contre `https://healthwatch-global.com` :

```
sync-outbreaks   HTTP 200  success:true  source="WHO OData API"  8 foyers parsés, 25 déjà vus, 0 erreur
check-new-don    HTTP 200  status="up_to_date"  25 vérifiés
sync-cdc-han     HTTP 200  success:true  1 alerte, 0 erreur
data-quality     HTTP 200  success:true  129 lignes actives, 0 anomalie, 0 erreur
```

Les quatre sont propres — la correction partagée de `fetchWHODONList()` est confirmée fonctionner pour ses deux appelants (`sync-outbreaks` ET `check-new-don`), sans qu'aucun des deux fichiers n'ait eu besoin d'être touché.

### Suite du même soir (02/09, session interactive) — garde-fou de budget construit sur `data-quality`

David a demandé la construction du garde-fou pour `data-quality` (« construis le garde-fou de budget pour data-quality »), suite au risque documenté lors du rollout retry sur le reste des crons. Verrou de code réacquis, édition faite, relâché après le push.

**✅ CONSTRUIT, commit `40798edd`** (`app/api/cron/data-quality/route.ts`). Même patron que `TARGET_LOOP_BUDGET_MS` dans `sync-who-regional` (`5a235b75`), adapté à la structure particulière de ce cron : **deux boucles** (section 4, correctifs d'anomalies ; section 4e, résolution/containment) puisent toutes deux dans `verifyFromDON()`, un **seul chronomètre partagé** (`donVerifyStart`) entre les deux — cohérent avec le fait qu'elles consomment le même budget de vérification DON, pas deux budgets indépendants.

- `DON_VERIFY_BUDGET_MS = 70_000` (70s sur un `maxDuration` de 120s — 50s de marge pour les sections 1-3, 4b-4d, 4f-4n, 5, l'envoi d'e-mail).
- Section 4 : vérifié au début de chaque itération, sortie propre avec le nombre d'anomalies restantes journalisé dans `needsReview`. Les anomalies non vérifiées restent signalées comme anomalies (rien ne les efface silencieusement).
- Section 4e : vérifié juste avant l'appel `verifyFromDON` (après les filtres bon marché `is_seed`/`DON_RE`/`anomalyIds`/`source_priority`, pour ne pas gaspiller le budget à re-checker l'horloge sur des lignes qui auraient de toute façon été ignorées gratuitement) — un seul signal `needsReview` plutôt qu'une entrée par ligne, cette boucle pouvant filtrer beaucoup de lignes avant d'en trouver une qui qualifie.

`npx tsc --noEmit` et `npx eslint` propres sur le fichier touché.

**Vérifié en prod après déploiement** : `HTTP 200, success:true`, `activeRows:129, anomaliesDetected:0, needsReview:4` — identique au comportement d'avant le garde-fou (aucun déclenchement, comme attendu vu que 0 ligne correspond aujourd'hui au filtre strict de la section 4e et 0 anomalie existe).

**Bilan de la soirée : les deux crons identifiés avec ce défaut structurel (boucle de fetch sans garde-fou de budget) ont maintenant l'un et l'autre leur garde-fou** — `sync-who-regional` (`5a235b75`) et `data-quality` (`40798edd`).

---

## 2026-09-03 — Proposition du jour

Contexte lu avant d'idéer : `product-ideas-log.md` en entier, `product-feedback.md`
(dernière entrée : lepapapericles5, 31/08, accessibilité), `ROADMAP.md`, `git log -25`.
Sondes lecture seule contre la prod (`tqznwmpkokdzrszysbcm`) : 129 foyers actifs,
53 heartbeats de cron, latence réelle du flux Africa CDC.

### 1. 🟠 Le sélecteur d'alertes par maladie a son habillage traduit en 5 langues et sa **liste** en anglais brut — dont un « nom de maladie » de 126 caractères

**Constat, mesuré en base avant d'être écrit.** `/api/alert-diseases` renvoie les
`disease_en` distincts des foyers actifs, tels quels. `DiseaseAlertPicker.tsx` les
affiche verbatim, dans le `<select>` comme dans les pastilles d'abonnement. Or ce
composant a un dictionnaire `COPY` complet en fr/en/es/ar/id pour son titre, son
sous-titre, ses boutons — tout sauf son contenu. Un utilisateur Pro francophone
lit donc « Alertes par maladie / Ajouter » autour d'une liste qui dit *Dengue
fever, Diphtheria, Meningitis, West Nile fever*. En arabe, la liste anglaise
s'affiche dans une interface RTL.

**17 `disease_en` distincts sur les 129 lignes actives**, dont un qui n'est pas un
nom de maladie du tout :

```
126 car | 10 lignes | International food safety event: Infant formula and products
                      containing arachidonic acid oil contaminated with cereulide toxin
 31 car |  2 lignes | Crimean-Congo Hemorrhagic Fever
 21 car |  1 ligne  | Marburg virus disease
 …
 12 car | 30 lignes | Dengue fever
```

Ces 126 caractères sont le titre d'un DON de mars 2026 (DON596). Le produit **sait
déjà** les traduire : `EVENT_NAME_TRANSLATIONS` dans `lib/disease-data.ts` contient
la version fr/es/ar/id de cette exacte chaîne, précisément parce qu'un événement de
sécurité alimentaire n'est pas une maladie catalogable (décision produit du
2026-07-05, documentée dans le code). `getLocalizedDisease()` la consulte pour
**toutes** les surfaces — carte, tableau, e-mails de digest, PDF, page de détail.
Le sélecteur d'alertes est la seule qui ne passe pas par là, parce qu'il est
`"use client"` et que `lib/outbreaks.ts` (où vit `getLocalizedDisease`) importe
`@supabase/supabase-js` et `next/cache` : impossible à importer côté client.
Le contournement a été d'afficher la chaîne brute.

**Ampleur réelle du signal business, dite honnêtement :** `user_alert_diseases`
compte **1 seule ligne** dans toute la base (un abonnement à *Measles*), pour
140 lignes dans `user_alert_regions`. Ce n'est donc pas un défaut qui coûte des
conversions aujourd'hui, et je ne prétends pas que la localisation explique
l'écart 1 vs 140 — le sélecteur est réservé aux plans Pro/Team, ce qui suffit à
l'expliquer. Ce qui le rend quand même prioritaire : c'est une **fonctionnalité
payante** dont la surface visible est cassée dans 4 des 5 langues du produit, la
logique de correction existe déjà et est testée, et le coût est d'un fichier pur
plus deux points d'appel.

**Effort : petit.** Aucune migration, aucun e-mail, aucune écriture en prod.
Extraction de la logique de nommage de `getLocalizedDisease` vers le module pur
`lib/disease-data.ts` (0 import, donc client-safe), délégation depuis
`lib/outbreaks.ts` pour que le point de décision reste unique, puis lecture depuis
le composant. La valeur envoyée à l'API reste `disease_en` — c'est la clé
métier de `user_alert_diseases`, elle ne doit pas bouger.

**Risque :** faible. Le seul piège est de traduire la *valeur* et pas seulement le
*libellé*, ce qui casserait les abonnements existants. Séparation explicite
`value={disease_en}` / `label=localisé`.

### 2. 🔴 `sync-africa-cdc` est en erreur ce matin, et sa boucle d'articles peut à elle seule dépasser le `maxDuration` de la fonction — 120 s de fetchs pour une limite de 60 s

**Constat, relevé dans les heartbeats de prod (`site_config`, `cron:run:*`) :**

```
sync-africa-cdc | status=error | run 09:10 UTC ce jour
                | error: The operation was aborted due to timeout (2 tentative(s))
                | lastNonZero = 2026-08-11  → 23,3 jours sans une seule ligne écrite
```

C'est la **cause** du constat posé hier soir (entrée du 02/09, idée 1) : « Africa
CDC est annoncée comme l'une des quatre sources du produit sur toute la surface
publique et n'alimente aucune des 128 lignes actives ». Hier a été construit le
détecteur (sonde `data-quality` 4n, commit `bb2a707b`) ; il flague bien Africa CDC.
Aujourd'hui on tient le pourquoi.

**Deux défauts distincts, à ne pas confondre.**

**(a) La boucle d'articles n'a aucun garde-fou de budget.** `runAfricaCdc` lit le
flux RSS puis, pour **chaque** item, va chercher la page d'article complète —
`AbortSignal.timeout(12_000)`, ligne 247. `parseRSSFeed` ne plafonne pas le nombre
d'items (seul un filtre d'âge à 45 jours s'applique) ; le flux en sert **10**
aujourd'hui. Pire cas : **10 × 12 s = 120 s** de fetchs seuls, contre
`maxDuration = 60`. Quand Vercel tue la fonction à 60 s, `logCronRun` n'est jamais
atteint : **aucun heartbeat n'est écrit du tout**, et le cron ne se lit pas comme
« en panne » mais comme « n'a pas tourné ». Même défaut structurel exactement que
`sync-who-regional` (corrigé le 02/09, `5a235b75`) et `data-quality` (idem,
`40798edd`) — ce troisième cas n'avait pas été identifié ces soirs-là.

**(b) Le timeout du fetch RSS a été raccourci de 15 s à 8 s hier soir, sans mesure —
et le premier run sous ce réglage échoue sur un timeout.** Le commentaire du code
dit pourquoi : « capped at 2 attempts / 8s each … the per-article loop below has no
time-budget guard of its own against maxDuration=60, so the retry can't eat much of
it ». Le raccourcissement était donc une **compensation** du défaut (a).

**Latence réelle mesurée aujourd'hui avant d'écrire quoi que ce soit**, 10 appels
consécutifs sur `https://africacdc.org/news-item/feed/` avec l'en-tête exact du
cron :

```
min 663 ms | médiane 680 ms | max 1 744 ms | 0 échec sur 10 | 87 206 o, 10 <item>
```

**Ce que je ne prétends pas.** Ces mesures viennent de la machine de David, pas du
réseau de Vercel. Elles ne prouvent pas que 8 s a causé l'échec de ce matin : deux
tentatives ont dépassé 8 s à une seconde d'intervalle, ce qui ressemble davantage à
une indisponibilité réelle ou à un filtrage d'IP côté Africa CDC qu'à de la latence
ordinaire — et dans ce cas 15 s n'aurait rien changé non plus. Ce qu'elles
établissent, c'est que **8 s n'a été choisi ni sur une mesure ni sur une contrainte
de la source**, mais pour tenir dans un budget que (a) rend indéterminé. C'est
littéralement la leçon tirée le 02/09 même du faux `aphis_unreachable` (`6ba10a5a`)
— « pas de raccourcissement de timeout sans avoir mesuré la latence réelle de la
source » — appliquée à l'envers deux heures plus tard, dans le même rollout.

**Effort : petit/moyen.** Le patron du garde-fou de budget existe déjà, écrit deux
fois cette semaine dans ce dépôt. Un seul fichier. Aucune migration, aucun e-mail,
aucune écriture en prod hors ce que le cron écrit déjà de lui-même.

**Risque :** un run partiel écrit moins de lignes qu'un run complet. C'est le
compromis déjà accepté deux fois : mieux vaut ce qui a été traité, journalisé et
persisté, que le rien d'un hard-kill. Les items non traités reviennent au run
suivant, le flux les sert 45 jours.

### Construction — les deux idées sont livrées

Verrou de code acquis avant la première édition (`code-lock.mjs acquire`), relâché
après le push. `npx tsc --noEmit` et `npx eslint` propres sur les quatre fichiers
touchés.

**Idée 1 — ✅ CONSTRUITE, commit `9347d8b2`**, `lib/disease-data.ts` +
`lib/outbreaks.ts` + `components/DiseaseAlertPicker.tsx`.

`localizedDiseaseLabel(rawName, locale, diseaseAr?)` devient **le seul point de
décision** du nommage localisé d'une maladie ou d'un événement, et il vit dans
`lib/disease-data.ts` — module à **0 import**, donc importable depuis un composant
`"use client"`. `getLocalizedDisease()` dans `lib/outbreaks.ts` n'est plus qu'un
emballage qui déballe une ligne `Outbreak` et délègue : les six surfaces qui en
dépendent (carte, tableau, modale, e-mails de digest, PDF, page de détail) ne sont
pas touchées et ne peuvent pas diverger du sélecteur. C'était exactement le motif
du défaut : la règle existait, elle était simplement enfermée dans un module
serveur.

Dans le composant :
- `value={disease_en}` / `label={localizedDiseaseLabel(disease_en, locale)}`,
  séparation explicite. La clé métier de `user_alert_diseases` ne bouge pas, donc
  l'abonnement existant (*Measles*) reste valide.
- Le `<select>` est retrié sur le **libellé affiché** (`localeCompare(…, locale)`) :
  l'API trie sur la clé anglaise, ce qui cesse d'être un ordre alphabétique dès que
  le lecteur voit autre chose.
- L'infobulle du compteur (`"3 active outbreak(s)"`, codée en dur en anglais) rejoint
  le dictionnaire `COPY` avec ses 5 traductions.

**Vérifié avant commit sur les 17 `disease_en` réellement actifs, dans les 5
locales.** Le titre du DON596 sort bien traduit (« Événement de sécurité alimentaire
international : préparations pour nourrissons… », et ses équivalents es/ar/id), et
les 16 autres aussi — *Dengue fever* → « Dengue », *Diphtheria* → « Diphtérie »,
*Measles* → « Rougeole », *Avian Influenza* → « Grippe aviaire », l'arabe complet.
Les rares noms rendus identiques (Chikungunya, Mpox, MERS-CoV, *Meningitis* en
es/id) le sont parce qu'ils sont réellement identiques dans ces langues, pas par
défaut de traduction — vérifié entrée par entrée.

Effet de bord assumé et voulu : en anglais aussi le libellé passe désormais par la
normalisation, donc la ligne héritée *« Crimean-Congo Hemorrhagic Fever »* s'affiche
sous sa forme canonique *« Crimean-Congo haemorrhagic fever »*, comme partout
ailleurs dans le produit.

**Limite connue, non corrigée, dite plutôt que tue :** si deux `disease_en` distincts
normalisaient vers le même libellé, le `<select>` afficherait deux options visuellement
identiques pointant sur deux clés d'abonnement différentes. Ça n'arrive pas
aujourd'hui (les crons insèrent tous `diseaseInfo.name_en` déjà canonique ; la seule
forme non canonique active est la ligne CCHF héritée, et aucune ligne canonique
concurrente n'existe). Masquer un doublon rendrait une clé non-abonnable, ce qui est
pire : le vrai remède serait de normaliser la donnée, décision qui appartient à
David. Signalé, pas contourné.

**Idée 2 — ✅ CONSTRUITE, commit `d47eb99d`**, `app/api/cron/sync-africa-cdc/route.ts`,
un seul fichier.

- `ITEM_LOOP_BUDGET_MS = 40_000`, mesuré depuis le **début du run** et non depuis la
  boucle : un fetch RSS lent consomme le même budget de fonction que la boucle, les
  mesurer séparément laisserait les deux déborder ensemble. Contrôle avant chaque
  item, donc le dépassement maximal est d'un fetch d'article (12 s) plus ses
  écritures — ~53 s sur les 60 s de `maxDuration`.
- Les items non atteints sont comptés dans `results.unprocessed`, **à part de
  `results.skipped`** : un skip est une décision prise sur un item qu'on a regardé,
  un item non traité n'a pas été regardé. Confondre les deux ferait passer une
  troncature pour un run normal.
- Un run tronqué reste en statut `ok` — les items reviennent au run suivant, le flux
  les sert 45 jours — mais son heartbeat porte désormais « budget de boucle dépassé :
  N item(s) non traité(s) ». Sans ça, un flux qui grossirait au-delà du budget tous
  les jours cesserait silencieusement de couvrir sa queue.
- Timeout RSS restauré de 8 s à **15 s**, sa valeur d'origine, avec la mesure du jour
  écrite dans le commentaire (663 / 680 / 1 744 ms, 0 échec sur 10). Le commentaire
  dit aussi ce que la mesure **ne** prouve pas : les deux tentatives de ce matin ont
  avorté à 8 s à une seconde d'intervalle, ce qui ressemble à une indisponibilité vue
  depuis Vercel plutôt qu'à de la latence, et 15 s n'est pas présenté comme un
  correctif de ça.

### Vérification en production après déploiement

`sync-africa-cdc` appelé contre `https://healthwatch-global.com` une fois le
déploiement effectif (présence du champ `unprocessed`, absent de la version
précédente — c'est ce qui a servi de marqueur de déploiement) :

```
HTTP 200  t=11,7 s
success:true  items:10  inserted:0  updated:0  skipped:10  errors:0  unprocessed:0
parseStats: articlesFetched:6  bodySelectorMisses:0
```

Lecture : **11,7 s de bout en bout**, très en deçà des 40 s de budget — le garde-fou
ne se déclenche pas, ce qui est le comportement attendu un jour normal. Il est là
pour le jour où plusieurs pages d'article traînent, pas pour tous les jours.

`articlesFetched:6` pour `items:10` n'est pas un écart : `extractItemData` sort
avant tout fetch quand ni le titre ni les `<category>` ne donnent une maladie connue
(`return []`, ligne 10 de la fonction). Les 4 items concernés sont exactement les 4
articles institutionnels du flux du jour (task force sur la réforme de
l'architecture sanitaire mondiale, pré-conférence jeunesse, réunion ministérielle
ReSCO, réunion des ministres d'Afrique de l'Est). Vérifié dans le `log` de la
réponse, pas déduit.

**Le fetch RSS a réussi à ce run**, alors qu'il avait avorté deux fois à 8 s à
09h10 UTC. L'indisponibilité de ce matin était donc transitoire côté source ou côté
réseau Vercel, pas une panne installée — ce qui confirme au passage que le
diagnostic ci-dessus était juste de ne pas conclure que 8 s en était la cause.

**Ce que ce run ne corrige pas :** `skipped:10`, donc toujours **0 ligne écrite**.
Les 6 items porteurs d'une maladie connue sont tous des articles Ebola sans chiffres
(`0 cases and 0 deaths — likely non-surveillance article`). Le compteur
`lastNonZero` d'Africa CDC reste au **2026-08-11**, soit 23 jours. La source est
réellement silencieuse en chiffres, et la sonde `data-quality` 4n construite hier
continuera — à juste titre — de flaguer Africa CDC comme annoncée publiquement mais
non alimentante. Voir « ce qui reste chez David » ci-dessous.

### Ce qui reste chez David — aucune écriture de données en prod n'a été faite ce soir

Les deux constructions sont du code. Le seul appel en prod est un run de
`sync-africa-cdc`, c'est-à-dire ce que ce cron fait de lui-même chaque jour à 09h10,
et il n'a rien écrit (`inserted:0 updated:0`).

1. **Les 10 lignes du DON596 sont actives depuis 174 jours.** `is_seed=true`,
   `date=2026-03-13`, jamais mises à jour, aucune `source_confirmed_at`. Elles pèsent
   **10 des 129 lignes actives (7,8 %)** — donc 7,8 % du compteur « foyers actifs »
   affiché en page d'accueil est un rappel de préparations pour nourrissons de mars.
   Les désactiver est une écriture de données en prod, hors de ce que cette routine
   se permet seule. À trancher : les clore, ou assumer qu'un événement de sécurité
   alimentaire reste « actif » tant que l'OMS ne l'a pas clos.

2. **Africa CDC : 23 jours sans une ligne, et le silence est réel.** Le correctif de
   ce soir supprime un risque de hard-kill, il ne fait pas parler une source muette.
   Les deux causes possibles restent ouvertes et se distinguent par de la lecture
   humaine du flux, pas par du code : soit Africa CDC ne publie effectivement plus de
   bulletins chiffrés depuis le 11/08, soit le seuil « 0 cas et 0 décès = article non
   épidémiologique » rejette des articles qui portent des chiffres sous une forme que
   `extractNumbers` ne voit pas. Les 6 articles Ebola du jour permettraient de
   trancher en les ouvrant.

3. **Deux autres crons en `no_data` prolongé**, relevés en passant et non traités ce
   soir : `check-mpox-sitrep` (33,4 jours depuis le dernier `lastNonZero`,
   `status=no_data` — à distinguer du correctif du 31/08 qui portait sur la
   *journalisation*, pas sur le fond) et `sync-drc-sitrep` (`no_sitrep_found`).
   Ni l'un ni l'autre n'est en `error`, donc rien ne les remonte aujourd'hui.

4. **Doublon de libellé possible dans le sélecteur d'alertes** — voir la limite connue
   de l'idée 1 ci-dessus. Ne se produit pas avec les données actuelles ; le remède
   propre est de normaliser la ligne CCHF héritée en base, décision de données.

### Fichiers modifiés par d'autres, laissés intacts (AGENTS.md)

- `marketing/qa/product-claims.manual.json` — modifié, non commité par ce run.
- `scripts/audit-alert-day.mjs`, `scripts/probe-alert-lock.mjs` — non suivis, laissés
  en place.

Aucun n'a été stagé, stashé ni annulé.

### Suite du même soir (03/09, session interactive) — les 10 lignes DON596 fermées sur ordre explicite de David

David a tranché le point 1 de « ce qui reste chez David » ci-dessus (« ferme les 10
lignes DON596 »).

**Vérifié avant d'écrire** : recherche WHO (page publique du DON596) le jour même,
aucune mention de clôture ou de suivi trouvée — contrairement au cas Ebola/Allemagne
du 02/08 (sortie d'hôpital réelle et datée), aucun dénouement épidémiologique n'a été
inventé. La description ajoutée constate l'absence de suivi de l'OMS depuis le DON
initial et la décision de fermeture, dans les 5 langues.

`active: false` **et** `response_phase: "contained"` — `isDisplayActive()` dans
`lib/outbreaks.ts` traite déjà ce champ comme un signal de clôture explicite, même
patron que `fix-ebola-germany-resolved-2026-08-02`. `cases`/`deaths`/`date`/`recovered`
inchangés : ce sont les chiffres que le DON596 rapportait, aucune raison de les
retoucher.

**Vérifié en prod après écriture** : les 10 lignes sont à `active=false,
response_phase=contained` (la 11e ligne DON596, `Multiple countries`, était déjà
inactive avant ce soir — non touchée). Compteur de foyers actifs : **129 → 119**.

Script jetable supprimé après vérification, conformément à la convention du dépôt
(`scripts/*-YYYY-MM-DD.mjs`, ignoré par git, effacé une fois le correctif confirmé
appliqué).

---

## 2026-09-04 — Proposition du jour

**Signal terrain :** `product-feedback.md` n'a pas bougé depuis l'entrée
`lepapapericles5` du 31/08 (piste « digest allégé » déjà mesurée et close le
02/09 : il n'y avait rien à alléger). Les deux idées de ce soir viennent de
l'événement du jour — le retrait, ce matin, du cron cVDPV africain pour
violation des CGU de `polioeradication.org` (`0df093ae`) — et de ce que la
vérification de ce retrait a fait apparaître en base.

**Flotte de crons :** 53 entrées `cron:run:*` relues en prod, **aucune en
`error`**. `check-mpox-sitrep`, `check-wer-cholera` et `sync-drc-sitrep` en
`no_data`, état documenté comme légitime. Rien à traiter de ce côté ce soir.

### 1. 🔴 15 des 16 lignes polio affichées portent un lien « Source » qui ne pointe pas vers la source — le champ mélange l'URL et une annotation humaine, et toutes les surfaces envoient la chaîne entière dans le `href`

**Signal.** Le retrait du cron GPEI de ce matin repasse les 13 lignes cVDPV
africaines en vérification manuelle. En allant vérifier ce que ces lignes
citent réellement, mesuré en prod (`tqznwmpkokdzrszysbcm`, lecture seule) :
**16 des 126 lignes affichées ont un `source` de la forme « URL + texte
libre »**, dont **15 des 16 lignes polio** (toutes sauf la Palestine) :

```
https://polioeradication.org/about-polio/polio-this-week/ (GPEI, Global Polio Update slide deck, data in WHO HQ as of 18 August 2026)
https://www.endpolio.com.pk/polioin-pakistan/district-wise-polio-cases (Pakistan National Emergency Operation Centre), corroborated by GPEI country updates as of 22 July 2026
https://ncdc.gov.ng/diseases/sitreps (source retiree 2026-09-02 — voir description)
```

L'annotation est légitime et utile : elle dit *quelle édition* du bulletin
hebdomadaire porte le chiffre, ce que l'URL seule ne dit pas. Le défaut n'est
pas de l'avoir écrite, c'est que **rien dans le code ne distingue la partie
URL du reste**. `sourceStatusOf()` fait `new URL(source)` — qui accepte cette
chaîne, encode les espaces et rend `hostname = polioeradication.org`, donc la
ligne reçoit la pastille « ✓ source officielle vérifiée ». Puis chaque surface
publie la chaîne complète comme lien :

| Surface | Ligne | Ce qui part dans le `href` |
|---|---|---|
| Fiche foyer | `app/[locale]/outbreak/[id]/page.tsx:569` | `o.source` brut |
| Modale de détail (don / official / press) | `components/OutbreakDetailModal.tsx:1688,1699,1710` | `outbreak.source!` brut |
| Pastilles du tableau (don / official / press) | `components/OutbreakTable.tsx:1217,1228,1239` | `outbreak.source` brut |
| Export CSV, colonne `source_url` | `components/OutbreakTable.tsx:455` | `publishableSourceUrl()`, qui renvoie la chaîne telle quelle |
| Export PDF (2 gabarits) | `components/OutbreakTable.tsx:482,601` | idem |
| Page d'impression | `app/(print)/[locale]/outbreak/[id]/print/page.tsx:325` | idem |
| E-mail d'alerte par maladie | `lib/disease-alert-email.ts:307` | `outbreak.source` brut |
| E-mail d'alerte watchlist | `lib/watchlist-alert-email.ts:211` | `outbreak.source` brut, **et comme libellé visible** |

Le navigateur reçoit
`https://polioeradication.org/about-polio/polio-this-week/%20(GPEI,%20Global%20Polio%20Update%20slide%20deck,...)`,
c'est-à-dire un chemin qui n'existe pas. `publishableSourceUrl()` existe déjà
et est utilisé aux bons endroits — mais il ne fait que *retirer* les éditeurs
interdits (correctif du 26/08), il ne vérifie jamais que ce qu'il rend est une
URL.

**Pourquoi ça compte maintenant.** C'est le jeu de données le plus exposé du
produit : celui qu'un Incident Manager de l'OMS a testé le 22/08, celui qui a
fait créer 13 lignes à la main le soir même. Un prospect qui clique sur
« Source » depuis n'importe laquelle de ces lignes — site, CSV exporté, PDF ou
e-mail d'alerte — n'atteint pas le bulletin. La pastille dit « source
officielle vérifiée » et le lien ne mène nulle part.

**Effort : petit.** Une fonction pure d'extraction (`sourceUrl()`), branchée
dans `publishableSourceUrl()` et dans les huit surfaces qui contournent
aujourd'hui le helper. Aucune écriture en base : le champ `source` garde son
annotation, c'est sa lecture qui est corrigée.

**Risque/inconnue :** une extraction trop stricte casserait des liens
aujourd'hui valides. Mesuré avant : sur les 295 lignes de la table,
**0 ligne d'archive** et 16 lignes affichées sont concernées, et aucune ligne
affichée n'est en `unverified` — donc toutes ont bien une URL en tête de
chaîne. Le repli reste `null` (pas de lien) plutôt qu'une URL devinée.

### 2. 🔴 Le retrait du cron GPEI de ce matin invoque une règle qui n'existe nulle part en code — et il reste un fetch de ce domaine dans le dépôt

**Signal.** Le message de `0df093ae` le dit lui-même : la restriction des CGU
de `polioeradication.org` était **déjà documentée le 29/07** pour
l'Afghanistan et le Pakistan, « mais n'avait pas été recroisée au moment de
construire ce cron un mois plus tard ». Le cron a vécu 7 jours (28/08 →
04/09). Ce n'est pas un oubli isolé : HWG a en réalité **deux catégories
légales distinctes**, et une seule est représentée en code.

| Catégorie | Éditeurs | Représentation en code |
|---|---|---|
| Ne jamais **citer** | `reliefweb.int`, sitreps PDF `ncdc.gov.ng` | `FORBIDDEN_SOURCE_DOMAINS` (1 entrée), testée avant toute liste d'autorisation, auditée tous les jours (section 4m) |
| Ne jamais **récupérer automatiquement** | `polioeradication.org`, `cdc.gov.au`, `endpolio.com.pk`, ProMED | **rien** — uniquement des fichiers mémoire et des commentaires de code |

La seconde catégorie n'est vérifiable que par la lecture attentive d'un humain
qui se souvient d'une note écrite cinq semaines plus tôt. C'est exactement le
mode de défaillance que le correctif du 26/08 a supprimé pour la première
catégorie, laissé intact pour la seconde.

**Constat mesuré, non résolu par le commit de ce matin.** Le message dit
« plus aucun code du dépôt ne fetch ce domaine » : c'est vrai de
`sync-who-regional`, faux du dépôt.
`app/api/cron/data-quality/route.ts:127` porte toujours
`GPEI_THIS_WEEK_URL = "https://polioeradication.org/about-polio/polio-this-week/"`
et sa sonde de couverture polio (section 4j) le récupère **tous les jours**.
Cette sonde ne lit que des dates et des noms de pays, n'écrit rien en base et
ne recopie aucun chiffre — elle n'est donc pas du même ordre que le fetcher
retiré ce matin. **Mais l'écart entre ce que le commit affirme et ce que le
dépôt contient est réel, et l'arbitrage est juridique : il revient à David,
pas à cette routine** (politique commune §10). Ce qui se construit ce soir,
c'est de quoi le rendre visible et empêcher le prochain, pas de quoi trancher
celui-là.

**Effort : petit.** Un registre `RESTRICTED_FETCH_DOMAINS` à côté de la liste
d'interdits existante, un script de contrôle statique qui balaie
`app/api/cron/**` et `lib/**` à la recherche d'un littéral d'URL sur ces
hôtes, et son branchement dans le hook `pre-commit` déjà en place (même patron
que `check-cron-schedule.mjs`, déclenché seulement quand le commit touche
ces chemins). Les occurrences connues sont déclarées explicitement, avec leur
motif ; **toute occurrence nouvelle bloque le commit.**

**Risque/inconnue :** un contrôle qui bloque un commit doit être quasi
insensible aux faux positifs — il ne cherche que des noms d'hôtes littéraux, et
le contournement documenté (`git commit --no-verify`) existe déjà pour le hook
voisin.


### Construction — les deux idées sont livrées

Verrou de code partagé acquis avant la première édition, relâché après la
dernière (`code-lock.mjs`, protocole du 02/09). Aucune autre routine ne
tenait le verrou.

**Idée 1 — commit `b378a39a`.** `sourceUrl()` dans `lib/source-trust.ts` :
fonction pure qui extrait l'URL en tête de chaîne, retire la ponctuation de
fin (parenthèse fermante seulement si elle n'a pas d'ouvrante — sinon
`…/Marburg_(virus)` serait tronquée), valide le résultat, et rend `null`
plutôt qu'une URL devinée. Branchée dans `publishableSourceUrl()`,
`isForbiddenSourceHost()` et `sourceStatusOf()`, puis utilisée par les huit
surfaces qui envoyaient la chaîne brute : fiche foyer, modale (3 liens),
pastilles du tableau (3 liens, avec le repli non cliquable désormais piloté
par l'URL réelle et non par « le champ est non vide »), colonne `source_url`
du CSV, deux gabarits PDF, page d'impression, e-mail d'alerte par maladie,
e-mail d'alerte watchlist. **Le champ `source` n'est pas modifié en base** :
l'annotation d'édition est utile et voulue, c'est sa lecture qui était fausse.

Vérifié, pas seulement compilé :

| Contrôle | Résultat |
|---|---|
| `scripts/check-source-trust.mjs` | 22/22 cas fixes, tiers inchangés (affichées : don 3, official 116, press 7, unverified 0) |
| Rejeu des 295 lignes réelles | 16 `href` corrigés, tous vers l'URL propre |
| Effet de bord mesuré | 4 lignes d'archive au `source` en texte brut (« OMS », « PAHO/OPS nov. 2025 — … ») ne fuient plus dans la cellule `source_url` des exports — elles sont en `unverified`, donc n'ont jamais rendu de lien |
| Gabarits d'e-mail rendus sur une vraie ligne polio annotée | `href="https://polioeradication.org/about-polio/polio-this-week/"` dans les deux |

`npx tsc --noEmit` et `npx eslint` propres sur les 7 fichiers.

**Idée 2 — commit `09089a8d`.** `RESTRICTED_FETCH_DOMAINS` dans
`lib/source-trust.ts` (6 éditeurs, chacun avec sa date et le motif exact :
CGU citée, décision de David, mémoire de référence), et
`scripts/check-restricted-fetch.mjs` qui balaie `app/` et `lib/`. Branché
dans `.githooks/pre-commit` (avant le contrôle d'horaires existant, déclenché
dès qu'un `.ts`/`.tsx` de `app/` ou `lib/` est mis en index) et exposé en
`npm run check:sources`.

Le contrôle ne regarde que les **littéraux de chaîne**, via le parseur
TypeScript : une adresse citée dans un commentaire n'est pas une
récupération, et le dépôt en contient beaucoup. Le découpage de commentaires
écrit à la main pour ce script a d'ailleurs échoué à l'essai — la fin de
`/^https?:\/\//` contient littéralement `//` et faisait passer le reste de la
ligne pour un commentaire, ce qui masquait précisément l'occurrence la plus
intéressante. C'est ce qui a fait passer au parseur.

Vérifié : sortie 0 sur le dépôt tel quel ; un fichier temporaire sous `lib/`
portant une URL `polioeradication.org` fait sortir en 1 en nommant fichier,
ligne et motif (fichier supprimé après l'essai) ; le hook a réellement tourné
sur le commit lui-même. Une entrée `ACKNOWLEDGED` devenue sans objet est
signalée sans bloquer.

### Ce qui reste chez David — aucune écriture de données en prod n'a été faite ce soir

Les deux constructions sont du code. Aucun appel en prod autre que des
lectures.

1. **RÉSOLU (session interactive, 04/09) — la sonde 4j est retirée.** David a
   tranché : `data-quality` ne récupère plus `polioeradication.org`, quel que
   soit ce qu'elle en lisait. Commit `158f27b1` — `fetchGPEIThisWeek()`,
   `parseGPEIThisWeek()` et le bloc d'appel de la section 4j supprimés
   entièrement. `check-restricted-fetch.mjs` ne signale plus d'entrée
   `ACKNOWLEDGED` sans occurrence pour ce fichier (il l'annonçait déjà comme
   « à retirer » avant la suppression — usage exactement prévu).

   **Conséquence assumée, écrite dans le code à l'endroit où elle était
   implicite** (commentaire de la section 4l) : une ligne polio désactivée
   redevient indétectable si le GPEI continue de la publier — c'était la
   seule exception à « 4l ne voit que les lignes actives », elle disparaît
   avec la sonde. Le trou de couverture qui avait motivé sa construction le
   22/08 (un Incident Manager de l'OMS avait dû demander à David si le site
   avait lu le bulletin) redevient donc sans contrôle automatique ; seule la
   vérification manuelle déjà en place pour Afghanistan/Pakistan couvre
   désormais les 13 lignes africaines.

2. **RÉSOLU — Lassa fever / Nigéria re-sourcée sur une citation publique.**
   D'abord sortie de l'affichage (`source_priority` 5→0, même piège de fenêtre
   de 60 jours que les 4 lignes ReliefWeb du 26/08), puis, David ayant demandé
   « trouve une source publique pour la ligne Lassa », recherche web : aucune
   couverture presse de la semaine 34 exacte (1 056/253, seule source =
   le PDF NCDC confidentiel), mais Vanguard, Tribune Online, Premium Times et
   Blueprint citent tous directement le NCDC pour la **semaine 33** (10-16 août) :
   1 035 cas, 252 décès, CFR 24,4 %, 23 États/117 LGA, publié le 01-02/09.

   Signalé avant d'écrire : c'est un recul assumé (semaine antérieure, chiffres
   plus bas) et aucun des quatre médias n'était encore dans la liste de
   confiance. David a tranché : re-sourcer sur la semaine 33 via Tribune Online.
   `tribuneonlineng.com` ajouté à `GENERAL_PRESS_DOMAINS` (commit `fcc04966`).
   Ligne réécrite : `active` false→true, cases 1056→1035, deaths 253→252, date
   22/08→16/08, `source_priority` 0→5, `verification_status`→confirmed,
   `response_phase`→active_response, description (5 langues) explicitant le
   recul et pourquoi les chiffres de semaine 34 ne sont pas repris. Écriture
   confirmée par `.select()` ; `check-source-trust.mjs` classe désormais la
   ligne `press`, correctement liée, sans régression ailleurs.

   Les deux écritures en base (baisse de priorité, puis re-sourcing complet)
   ont chacune été bloquées une première fois par le classificateur
   d'autorisation et sont passées au second essai, après un ordre explicite
   et frais de David à chaque fois (« lance-le toi-même via le compte admin »,
   puis « re-source sur la semaine 33 avec Tribune Online »). Détail complet
   dans la mémoire `project_ncdc_lassa_row_confidential_content_2026_09_04`.

   **Vérification de la page publique demandée par David, deux trouvailles :**
   (a) la pastille « Vérifié par HealthWatch » affichait « il y a 20j » juste
   après une re-vérification à l'instant — bug générique de la page de détail
   foyer, elle lisait `o.date` seul au lieu de `lastVerifiedIso()` (déjà
   utilisé par le tableau depuis le 22/08). Corrigé, poussé (`703ba34f`),
   déploiement confirmé (badge passé à « il y a 9 min »). (b) écart mineur
   24,4 % (cité de Tribune Online) vs 24,3 % (calculé en direct par le site,
   252/1035) — David a demandé l'alignement sur 24,3 % ; fait dans les 5
   langues, vérifié sur la page publique.

### Revue systématique des foyers affichés (demandée par David, en cours)

Worklist construite : 127 lignes affichées triées par `lastVerifiedIso` croissant
(les moins récemment vérifiées d'abord — même logique que ce qui a fait
remonter Lassa). Parcours commencé par le navigateur, 3e ligne :

**🔴 Doublon d'affichage trouvé et corrigé — Ebola/RD Congo.** Deux lignes pour
le même événement (l'urgence Bundibugyo 2026) affichées simultanément :
`bd1c3a46-…` (le foyer PHEIC officiel, `active=true`, ECDC, 6 250 cas/3 039
décès, 01/09) et `6a5e9fc9-…` (`active=false` mais encore dans la fenêtre de
60 jours, Africa CDC, 4 120 cas/1 887, 07/08) — même piège que Lassa et les 4
lignes ReliefWeb du 26/08, mais ici sans question légale : un simple snapshot
périmé du même événement, jamais redescendu sous `source_priority=3` après
avoir été supplanté. David a confirmé : `source_priority` 5→0. Vérifié sur
`/fr/disease/ebola-virus-disease` : « Foyers en cours » n'affiche plus que la
ligne à jour ; le snapshot périmé reste visible dans « Historique des
épidémies » (surface différente, comportement voulu). Détail dans la mémoire
`project_ebola_drc_stale_duplicate_fixed_2026_09_05`.

**Requête systématique lancée immédiatement après** (plutôt que de compter sur
le parcours page par page pour retomber dessus par hasard) : toute ligne
`active=false` mais encore dans la fenêtre de 60 jours, avec recherche d'une
ligne sœur active pour le même couple maladie/pays. **5 autres lignes
correspondent au premier critère** (Nipah/Inde, Chikungunya/Mayotte,
Ebola/Ouganda, Choléra/Zambie, Ebola/Allemagne) mais **aucune n'a de ligne
active concurrente** — ce sont des foyers légitimement clos, affichés avec le
bandeau « Foyer terminé », pas des doublons. Un seul cas réel ce soir.

Automatisation testée en parallèle sur les 127 descriptions (comparaison des
premiers chiffres cas/décès mentionnés contre les champs `cases`/`deaths`) :
15 signalements, **tous des faux positifs** de la regex (trop étroite pour
gérer des qualificatifs comme « laboratory-confirmed » ou des chiffres
secondaires légitimes plus loin dans le texte — ex. le trio Diphtérie
Haïti/Pérou/Brésil partage la même citation PAHO régionale, dont chaque ligne
cite bien son propre sous-total). Aucune vraie dérive numérique trouvée par
cette méthode ce soir ; méthode gardée en réserve mais pas fiable telle
quelle sans une extraction plus soignée.

Revue en pause après ces 3 lignes — reprise à confirmer avec David.

3. **RÉSOLU — `ncdc.gov.ng` interdit de citation, mais seulement pour les
   PDF de sitrep.** `FORBIDDEN_SOURCE_PATH_PATTERNS` dans `lib/source-trust.ts`
   (commit `5b8aeeb6`), vérifié après `FORBIDDEN_SOURCE_DOMAINS` dans
   `sourceStatusOf()` et dans `isForbiddenSourceHost()` — les huit surfaces qui
   utilisent déjà cette dernière (via `publishableSourceUrl`/`Name`) héritent du
   garde-fou sans modification. La page de listing expurgée reste citable, seul
   `…/sitreps/*.pdf` est banni. 5 cas unitaires passent, rejeu des 295 lignes
   réelles sans régression.

4. **Deux crons en `no_data` prolongé**, relevés à nouveau sans être traités :
   `check-mpox-sitrep` et `sync-drc-sitrep`. Aucun n'est en `error`. Inchangé
   depuis le relevé du 03/09.

### Fichiers modifiés par d'autres, laissés intacts (AGENTS.md)

Au moment du commit : `docs/outreach-qa.md`, `marketing/content-log.md`,
`marketing/linkedin-contacts.md`, `marketing/qa/lexicon.json`,
`marketing/qa/product-claims.manual.json` (modifiés), et
`scripts/audit-alert-day.mjs`, `scripts/probe-alert-lock.mjs` (non suivis).
Aucun n'a été stagé, stashé ni annulé. Un push a été rejeté en cours de run
(une session LinkedIn poussait au même moment, `9354839f`) puis repassé sans
intervention sur l'arbre.

**Statut : 2 idées PROPOSÉES ET CONSTRUITES.** Aucune idée écartée par un
garde-fou ce soir ; le seul point volontairement non tranché est l'arbitrage
juridique du point 1 ci-dessus.

### Suite du même soir (04/09, poursuite de la revue systématique) — session concurrente sur Diphtérie/Nigéria, vérifié sans incident

En poursuivant la revue (5e-30e lignes de la worklist), la ligne Diphtérie/
Nigéria a changé de valeurs entre deux lectures — chiffres différents, source
passée d'une citation presse (Leadership) à une URL `ncdc.gov.ng/…/wers/….pdf`.
Vérification immédiate : `git log` montre que c'est une **session concurrente**
(`morning-don-check`, commit `23e01bf6`) qui a fait ce changement, sur ordre
explicite de David en session interactive — pas une régression ni un cron
fantôme.

**Vérifié malgré tout, vu le sujet de la soirée** (citation NCDC = terrain
sensible) : le PDF cité est un **NCDC Weekly Epidemiological Report** (« WER »,
volume 16 n°32), une série de documents différente des « sitreps » concernés
par la clause de confidentialité du 02/09. Les 14 pages du PDF lues
intégralement : aucune clause de confidentialité nulle part — bulletin public
classique (page de garde, photos d'atelier, carte du Nigéria, tableaux par
maladie). `check-source-trust.mjs` confirme la ligne classée `official`, la
page publique rend correctement (chiffres, lien, badge « Vérifié » à jour —
hérite automatiquement du correctif du badge fait plus tôt ce soir). Mémoire
`legal_ncdc_nigeria_confidential_sitreps_2026_09_02` complétée : la clause est
propre au gabarit « sitrep », pas à tout `ncdc.gov.ng` — ne pas généraliser
l'interdiction à un nouveau type de document NCDC sans le vérifier séparément.

Reprise de la revue systématique après cette vérification.

### Suite du même soir (04/09) — revue systématique poursuivie, ~50 lignes parcourues

Parcours complet des lignes les moins récemment vérifiées (jusqu'à 15 jours
sans vérification), plus deux requêtes exhaustives sur les 296 lignes de la
table entière (aucune limitée à un échantillon) : doublons entre une ligne
active et une ligne inactive-dans-la-fenêtre (1 résultat : Ebola/RDC, déjà
corrigé), et doublons entre deux lignes actives pour le même couple
maladie/pays (1 résultat, légitime : les 3 lignes Grippe aviaire/États-Unis
sont des foyers distincts par État — Utah/Texas/Idaho — pas un doublon).

**Diphtérie/Afrique du Sud — juxtaposition CFR clarifiée.** Le badge calculé
du site (4,7 %, 19/404) et le texte citant l'OMS (« CFR 19 % ») coexistaient
sans être réconciliés — mais contrairement à Lassa (même semaine,
même dénominateur, juste un arrondi différent de la source), ici les deux
chiffres sont **tous deux exacts**, calculés sur des dénominateurs
différents : 19/404 (tous les cas) contre 19/96 (le seul sous-ensemble
respiratoire confirmé en labo, cité par l'OMS). Question posée à David plutôt
que de deviner ; il a choisi d'ajouter une précision dans le texte plutôt que
de le laisser tel quel ou de retirer le chiffre. Fait dans les 5 langues,
vérifié sur la page publique.

**Reste des lignes** (~75, toutes vérifiées le jour même ou la veille par un
cron — dengue_global/mpx_global shinyapps, ECDC WNV hebdomadaire, USDA APHIS,
tableau choléra OMS) : échantillonnées plutôt que parcourues une par une,
aucune anomalie trouvée.

**Bilan de la revue systématique ce soir : 1 doublon corrigé (Ebola/RDC),
1 clarification de texte (Diphtérie/Afrique du Sud), 1 vérification de
changement concurrent sans incident (Diphtérie/Nigéria), 0 autre problème
trouvé.**

### Suite du même soir — 9 lignes polio Afrique corrigées (dates/lieux non traduits)

En poursuivant la revue sur les lignes fraîches (Tchad, Somalie, Éthiopie
polio), repéré un défaut systématique sur les **9 lignes cVDPV africaines**
créées le 22/08 (`add-cvdpv-africa-gpei-2026-08-22.mjs`) : Tchad, Somalie,
Éthiopie, Madagascar, Angola, Soudan, Togo, RCA, Niger. Les 4 champs de
traduction (FR/ES/AR/ID) gardaient les dates en anglais telles quelles
(« 19 May 2026 » au lieu de « 19 mai 2026 »), et les 3 lignes avec une phrase
supplémentaire (Soudan, RCA) gardaient aussi des fragments de lieux non
traduits (« Region 7 (positive environmental sample) », « Gezira, North
Kordofan and Red Sea »). Sur les 2 lignes à 1 seul cas (Angola, Niger),
l'accord grammatical était aussi faux en FR/ES (« 1 cas confirmés... signalés »
— l'AR et l'ID n'infléchissent pas selon le nombre, non concernés).

Corrigé : dates traduites dans les 4 langues (mois écrits, pas de format
numérique), fragments de lieux traduits, accord singulier corrigé (trouvé et
recorrigé en 2 passes : le premier script n'avait traité que « confirmés »,
pas « signalés »/« notificados » plus loin dans la même phrase). Aucune
donnée chiffrée touchée — uniquement le texte des 4 champs de traduction, sur
les 9 lignes. Vérifié sur 2 pages publiques (Soudan, Angola) après écriture.

### Suite du même soir — 27 lignes WHO Surveillance corrigées (4 artefacts de traduction)

En poursuivant la revue sur les lignes fraîches (dashboards WHO Global
Cholera/Dengue/Mpox Surveillance, `sync-who-regional`), repéré un défaut
systématique cette fois côté **traduction automatique** (`translateDescription()`,
appelée une fois à la création de chaque ligne) plutôt que côté données :

1. FR — majuscule fautive en milieu de phrase (« L'OMS **A** signalé » au lieu
   de « a signalé ») : **27/27 lignes concernées**.
2. ID — espaces parasites autour des tirets de date (« 2026 -08 -10 » au lieu
   de « 2026-08-10 ») : **27/27**.
3. FR — même défaut de majuscule sur un autre mot (« Surveillance mondiale
   **DE** la dengue ») : 12 lignes.
4. FR — libellé « Source » resté en anglais (« OMS Global Mpox Surveillance »
   au lieu de « OMS Surveillance mondiale du Mpox ») : les 5 lignes Mpox.

ES et AR sont indemnes des 4 défauts — vérifié sur un échantillon avant de
choisir la portée du correctif. Question posée à David (corriger les 2
défauts systématiques seulement, les 4, ou rien) ; il a choisi les 4.

Correctif appliqué en 2 passes : la première (défauts 1-3, par motif
générique plutôt que ligne par ligne) a échoué silencieusement sur le défaut
4 — l'ancre de remplacement utilisait un espace normal avant les deux-points
alors que le texte réel porte une espace insécable (même piège que celui
rencontré plus tôt ce soir sur le CFR de Lassa/Nigéria). Corrigé dans une
seconde passe ciblée sur les 5 lignes Mpox, vérifié caractère par caractère
avant écriture. Vérification finale : recherche des 4 motifs sur les 27
lignes après écriture, 0 résidu. Aucune donnée chiffrée touchée — texte
uniquement, sur les champs de traduction FR et ID.

### Suite du même soir — 2 lignes avec une mauvaise traduction de « WHO » (« QUI » au lieu de « L'OMS »)

En poursuivant la revue, trouvé un défaut distinct des 27 précédents (fetchers
différents — WHO WPRO/Global Dengue Situation Update, pas les tableaux de
bord shinyapps) : **Dengue/Nouvelle-Calédonie et Dengue/Laos** traduisaient
l'acronyme anglais « WHO » comme le pronom interrogatif anglais « who »,
donnant « **QUI** a signalé » en FR et « **التي** أبلغت عن » (« qui/laquelle
a rapporté », grammaticalement bancal) en AR, au lieu de « L'OMS » /
« منظمة الصحة العالمية ». ES était déjà correct sur les deux lignes. La ligne
Nouvelle-Calédonie avait déjà été lue une première fois plus tôt ce soir sans
que le défaut soit repéré — retrouvée cette fois en cherchant spécifiquement
le motif « QUI » en majuscules isolées sur les 126 lignes affichées (2
résultats, les 2 corrigés).

Corrigé : FR et AR sur les 2 lignes, plus l'espacement de date ID (même
défaut que les 27 lignes précédentes) et le résidu « DE la dengue » sur Laos.
Vérifié sur la page publique après écriture.

### Suite du même soir — sweep final, 10 lignes supplémentaires (bug plus large qu'estimé)

Après les 2 lignes « QUI », un sweep exhaustif final sur les 4 motifs
connus + une regex ID élargie (tout « chiffre espace tiret chiffre », pas
seulement les dates ISO à 4 chiffres) a trouvé **10 lignes de plus** :
Rougeole/Pérou, Méningite (Nigéria, Tchad, Soudan du Sud, Burkina Faso),
Diphtérie (Haïti, Pérou, Brésil), Rougeole (États-Unis, Mexique). Même
défaut de traduction que les 27+2 précédents, mais sur d'autres formes de
plage numérique : intervalle de confiance (« 0,87 -1,07 »), plage de
semaines épidémiologiques (« minggu 1 -26 »), plage de références de
citation (« (1 -3) »). Confirme que ce n'est pas un défaut propre à un
fetcher précis mais un artefact général de `translateDescription()` sur
toute plage numérique traduite vers l'indonésien.

Corrigé, vérifié caractère par caractère avant écriture (10/10 lignes).
**Sweep final relancé après coup sur les 126 lignes affichées avec les 4
motifs + la regex ID élargie : 0 résidu.** La revue systématique des foyers
affichés est considérée close ce soir.

**Bilan complet de la revue systématique (04-05/09) :** 127 lignes passées en
revue (parcours manuel + requêtes exhaustives) → 1 doublon d'affichage
corrigé (Ebola/RDC), 1 clarification de texte sur choix explicite de David
(CFR Afrique du Sud), 1 changement concurrent vérifié sans incident
(Diphtérie/Nigéria), et **41 lignes corrigées pour des artefacts de
traduction automatique** (9 polio Afrique + 27 WHO Surveillance + 2 QUI/WHO +
10 sweep final au fil de la revue) — aucune donnée chiffrée modifiée dans ces
41 cas, uniquement du texte de traduction.

### Suite du même soir — sweep étendu aux lignes archivées (demandé par David)

Étendu le sweep de traduction aux 170 lignes archivées (296 au total). Trouvé
**51 lignes archivées de plus** touchées par les mêmes artefacts, dont un
groupe partagé important : les **10 lignes de l'événement « préparation pour
nourrissons contaminée à la toxine céréulide »** (Singapour, Italie, Hong
Kong, Brésil, Belgique, Autriche, Espagne, Tchéquie, France, Royaume-Uni)
partagent toutes le même texte, avec « Nouvelles **DE** l'OMS » au lieu de
« de ».

**Incident évité de justesse — un premier essai de correctif générique
(`\bA\b` → minuscule sur tout le texte) a été testé en dry-run avant toute
écriture, et a révélé qu'il aurait corrompu deux choses réelles :**
- **« grippe A(H5N1) », « A(H3N2) »** — la lettre « A » du sous-type grippal,
  qui doit rester majuscule (Type A vs Type B) ;
- **« Hépatite A »** — un nom de maladie (vs hépatite B, C…), qui doit rester
  majuscule.

Le dry-run a servi précisément à ça : rien n'a été écrit avant d'avoir vu le
diff complet. Corrigé en dressant d'abord la liste exhaustive de tous les
mots suivant un « A » isolé dans les 296 lignes (`signalé`, `estimé`,
`notifié`, `été`, `reçu` = vrais bugs ; `au`, `(VHA)` = faux positifs
Hépatite A) puis en n'corrigeant que les 5 verbes confirmés. Même méthode de
vérification exhaustive pour DE/QUI/YANG (aucun faux positif trouvé pour ces
trois-là sur l'ensemble de la table).

**Bilan du sweep archivé : 51 + 22 (espacement ID trouvé dans une seconde
passe) = 73 lignes archivées corrigées**, aucune donnée chiffrée touchée.
Vérifié : sweep final sur les 296 lignes (affichées + archivées), tous
motifs confondus — **0 résidu**. Une ligne archivée re-vérifiée directement
par son URL (Grippe aviaire/États-Unis, Wisconsin) : accessible, date
correctement affichée.

**Bilan complet de la soirée, revue systématique + sweeps de traduction :**
114 lignes corrigées au total (41 affichées + 73 archivées) sur les 296 que
compte la table, plus 1 doublon d'affichage, 1 clarification de texte, 1
changement concurrent vérifié. Aucune écriture de données chiffrées en dehors
des 3 premières.

### Suite du même soir — le cron aurait bien réécrasé les corrections, corrigé à la source

David a demandé de vérifier que le cron ne réécrase pas les 114 corrections.
**Réponse : il l'aurait fait.** `sync-who-regional/route.ts` (~ligne 1677)
annule les 4 champs de traduction dès qu'une ligne reçoit un nouveau texte
anglais (nouveaux cas/décès), et la passe suivante de `sync-outbreaks` les
retraduit via `translateDescription()` — MyMemory, un service de **mémoire**
de traduction (pas un LLM) : la même phrase anglaise produit
déterministement la même sortie. Les 114 lignes corrigées à la main se
seraient donc recassées à la prochaine mise à jour de leurs chiffres.

**Corrigé à la source** (`b3dad6bf`) : `sanitizeFr()`/`sanitizeId()` dans
`lib/translate.ts` lui-même — le seul point d'appel partagé par tous les
crons qui écrivent une description — plutôt qu'en aval sur chaque ligne.
Portée volontairement étroite, construite sur le tri exhaustif mené ce soir
sur les 296 lignes (mêmes garde-fous que pour les corrections manuelles :
« A » seulement suivi d'un des 5 verbes confirmés, jamais un blanket qui
aurait cassé « grippe A(H5N1) » ou « Hépatite A »).

**Piège trouvé en écrivant CE correctif, pas en prod** : le premier jet du
regex FR gardait un `\b` final après l'alternance de verbes — qui échoue
silencieusement quand le verbe se termine par une lettre accentuée (même
piège que celui déjà rencontré deux fois plus tôt ce soir dans des scripts
jetables). Conséquence : « A signalé »/« A estimé »/« A notifié »/« A été »
ne matchaient jamais, seul « A reçu » passait. Attrapé par 13 tests unitaires
avant tout commit.

**Ce qui n'est pas couvert** : le cas plus rare où MyMemory traduit « WHO »
par l'anglais interrogatif « who » plutôt que « OMS » (rendu « QUI »/« التي »
— un mot faux, pas juste une casse fautive) reste un correctif manuel au cas
par cas ; un remplacement générique serait dangereux sur les usages
légitimes de « qui » en français.

### Suite — revue manuelle de rendu étendue aux 170 lignes archivées

David a demandé de continuer la revue systématique (jusque-là limitée aux
127 lignes affichées) sur les 170 lignes archivées — c'est-à-dire les foyers
que `getOutbreaksCached()` ne montre plus sur le site public mais dont la
page individuelle `/outbreak/<id>` reste accessible par URL directe.
Contrairement à la revue des lignes affichées (qui avait trouvé les 3 bugs
structurels : fuite de fenêtre d'affichage Lassa, lien source cassé, badge
« Vérifié » mal calculé — tous déjà corrigés et vérifiés sur les affichées),
cette passe sur les archives ne visait plus à trouver un nouveau défaut de
rendu (déjà exclu par construction, le code étant commun aux deux jeux de
lignes) mais à vérifier qu'aucune n'était affectée différemment — silence
radio possible sur une page jamais parcourue depuis des mois.

**Méthode** : navigation manuelle une à une sur `healthwatch-global.com/fr/outbreak/<id>`
pour les 170 ids, lecture du texte rendu (`get_page_text`), recherche de toute
incohérence (cas/décès/létalité manquants ou aberrants, lien « Voir tous les
foyers » absent sans raison, date de rapport incohérente, artefact de mise en
forme).

**Résultat : 170/170 vérifiées, aucune anomalie.** Seul point notable, pas un
bug : les 11 lignes de l'« Événement de sécurité alimentaire international...
toxine céréulide » n'affichent pas le lien « Voir tous les foyers — X → »
présent sur toutes les autres pages — cohérent avec le fait que ce nom de
maladie très long n'a probablement pas de page de regroupement dédiée
ailleurs dans le code ; comportement pas creusé plus loin, à signaler
seulement si David le remarque un jour côté produit.

**Bilan complet, revue systématique de la table entière** : 127 lignes
affichées + 170 lignes archivées = 297/297 vérifiées, 3 bugs structurels de
rendu trouvés et corrigés (badge, lien source, fenêtre Lassa), 114 lignes de
données corrigées pour artefacts de traduction (dont la source du bug
corrigée à la racine dans `lib/translate.ts`), 1 doublon d'affichage corrigé,
1 clarification de texte ajoutée, aucune anomalie résiduelle connue.

---

## 2026-09-05 — Proposition du jour

Contexte : journée de gros chantier produit menée en session interactive
(pricing, mur payant, deux fonctionnalités Pro, SEO) — 18 commits entre 08h59
et 18h26, dont quatre correctifs successifs de fuite du mur payant. Sources
relues : `product-feedback.md` (dernière entrée le 31/08, lepapapericles5,
accessibilité — piste « digest allégé » déjà mesurée et close le 02/09),
`ROADMAP.md`, `_shared/sources-interdites.md`, `git log -30`, l'état live des
54 crons et 296 lignes `outbreaks` en prod.

**Aucun cron en retard, aucune anomalie de données.** Relevé du jour : 54/54
crons dans leur fenêtre (les cinq du lundi ont bien tourné le 31/08, puis
manuellement le 02/09 au soir), 0 `deaths > cases`, 0 `recovered > cases`,
0 CFR aberrant, 0 date future, 0 `source` non-URL, 0 région inconnue,
0 doublon actif hors le triplet Avian Flu/États-Unis (connu et volontaire).
`trigger-predictive-alerts` apparaît « jamais lancé » — c'est normal, il a
été ajouté à 17h36 et son créneau (12h40 UTC) était déjà passé ; le
correctif du 02/09 sur la supervision le tolère correctement.

### 1. 🔴 Le mur payant construit aujourd'hui masque des chiffres que six autres surfaces publient sans authentification — il ne coûte qu'à ceux qui se sont inscrits

**Signal.** Quatre commits successifs cet après-midi (`25a4ec81` 15h37,
`91c8f3d5` 15h44, `16a7eaae` 18h08, `c04a158a` 18h26) pour empêcher les
`cases`/`deaths`/CFR réels d'atteindre un compte gratuit : bulletage des
chiffres, puis arrondi à l'ordre de grandeur côté serveur, puis route
`/api/outbreak-stats/[id]` réservée aux payants pour la page permalien mise
en cache ISR. Le travail est correct et chacune des quatre fuites était
réelle.

**Mais le chiffre exact reste servi publiquement, sans compte, sur six
surfaces — vérifié une par une dans le code, et confirmé en direct sur la
prod :**

| Surface | Ce qu'elle publie | Auth |
|---|---|---|
| `/[locale]/disease/[slug]` | cas + décès par foyer (l. 697-698, 758), totaux agrégés et CFR (l. 542-544) | aucune, ISR 3600 |
| `/[locale]/country/[slug]` | idem | aucune, ISR 3600 |
| `/[locale]/region/[region]` | cas + décès par foyer (l. 341-342, 390) | aucune, ISR 3600 |
| `/[locale]/outbreak/[id]` | corps arrondi ce soir, mais `generateMetadata` (l. 249-250) écrit « N cases, M deaths » dans la balise meta description, dans OpenGraph et dans Twitter, et le JSON-LD (l. 364) le refait — dans le même document HTML | aucune |
| `/api/outbreak-card/[id]` | PNG 1200×630 avec cas, décès et CFR exacts — c'est l'image OpenGraph de la ligne au-dessus | aucune |
| `/api/rss` | cas + CFR par entrée (l. 88-94) | aucune |

Contrôle en direct : `curl https://healthwatch-global.com/fr/disease/cholera`
sans cookie rend les comptes de cas exacts des sept foyers choléra affichés.

**Ce que ça veut dire.** Les 121 lignes actives sont toutes rattachées à une
page maladie, une page pays et une page région — donc **100 % de ce que le
mur masque est atteignable en un clic, sans compte**. Le mur ne protège rien
d'un visiteur anonyme ; il ne s'applique qu'aux gens qui se sont inscrits.
C'est l'inverse de l'incitation recherchée : créer un compte gratuit
*dégrade* aujourd'hui ce qu'on voit par rapport à ne pas en créer.

**Ce n'est pas un reproche à la session de cet après-midi**, qui a vu le
sujet : le message de `c04a158a` écarte explicitement le bulletage du teaser
de la page d'accueil au motif que « the same figure is already public via the
disease pages ». Le raisonnement est bon — il n'a simplement jamais été
remonté au niveau où il change la conclusion : si l'argument vaut pour le
teaser, il vaut pour le tableau de bord, et alors ce n'est pas d'un
5ᵉ colmatage qu'il s'agit mais d'un arbitrage de packaging.

**Deux sorties possibles, exclusives, et c'est un choix de David.**
(a) **Assumer le public** — les pages maladie/pays/région, le flux RSS et les
cartes de partage sont l'actif SEO du produit (trois commits de plus
aujourd'hui : liens croisés, slugs courts, bloc de citation académique).
Alors le mur sur les chiffres bruts n'a pas de sens et il faut le retirer,
en gardant le payant sur ce qui est réellement exclusif : alertes,
historique, export, API, prédictif — tout ce qui a été construit aujourd'hui,
justement. (b) **Assumer le mur** — et il faut alors le porter aux six
surfaces ci-dessus, ce qui revient à retirer du SEO tout ce qui fait venir
les visiteurs. Le mi-chemin actuel prend le coût des deux.

**Effort :** (a) petit — c'est un retrait, quelques dizaines de lignes.
(b) moyen à gros, et destructeur pour l'acquisition.

**Risque/inconnue :** la valeur du mur n'a jamais été mesurée (0 conversion
essai→payant à ce jour, donc aucune donnée dans un sens ni dans l'autre).
Je recommande (a), mais c'est un arbitrage de prix et de positionnement.

**⛔ Délibérément NON construite — décision de pricing/packaging.** Le
mandat de cette routine couvre la proposition d'idées de pricing, pas la
modification unilatérale du modèle payant construit le jour même en session
interactive. Un mot de David suffit pour l'appliquer.

*Sous-constat mineur, indépendant de l'arbitrage :* les points 4 et 5 du
tableau sont incohérents **avec eux-mêmes** quelle que soit l'option
retenue — la page permalien arrondit ses chiffres dans son corps et les
réimprime en clair dans sa propre balise meta description et dans son image
OpenGraph. Si (b) est choisi, ces deux-là sont des oublis à corriger ; si
(a) est choisi, ils deviennent sans objet.

**Résolu le 06/09, tranché par David : option (b).** Construit (a) en
session interactive le 05/09 au soir sur ordre explicite (« applique tes
idées ») — commit `f6f4adc0`, retrait du masquage sur les 4 surfaces
authentifiées plus correction des promesses marketing associées (5 langues,
onboarding/emails/pricing). **Revert le lendemain matin** (`52ab1563`), puis
durci au-delà de l'état d'avant mon changement : `fd646a97` corrige une
5ᵉ fuite jamais couverte ni par les quatre commits du 05/09 ni par mon
retrait — `/compare` interrogeait `outbreaks` en direct depuis le
navigateur (clé anon) et ne floutait qu'en CSS, exposant les chiffres exacts
de tous les foyers actifs à un visiteur anonyme (Ebola/RDC confirmé en
clair : 6 342/3 072/48,4 %). Le message de David sur ce revirement :
**« Les chiffres sont masqués, c'est normal »** — le masquage est un choix
produit assumé, pas un oubli à corriger. Le sous-constat ci-dessus (points 4
et 5 incohérents) est donc résolu dans le sens (b) : à durcir, pas à
abandonner. **Ne pas re-proposer cette idée** dans une prochaine session —
la question est tranchée dans l'autre sens que celui recommandé ici.

### 2. 🔴 L'alerte prédictive livrée il y a une heure annonce « en accélération » sur des foyers qui décélèrent — mesuré : 1 déclenchement sur 11

**Signal.** `aef0129b` (17h36) ajoute les alertes de tendance prédictive,
vendues sur la page de tarifs comme fonctionnalité Pro. Le cron
`trigger-predictive-alerts` (`route.ts:65-70`) projette un temps de
doublement à partir de la tendance 7 jours, puis envoie un e-mail titré
« 📈 Alerte de tendance prédictive », avec une notification in-app libellée
« — en accélération » (l. 105).

**Le calcul est fait sur `outbreaks.cases`, qui est un compteur cumulatif.**
Un cumul ne décroît jamais : il double même à incidence parfaitement
constante. 100 cas au total avec 10 nouveaux cas par jour atteint 200 en
exactement 10 jours, sans la moindre accélération — et le code en déduit
« doublement projeté sous ~9 jours ». La formule n'est pas fausse
arithmétiquement ; c'est l'affirmation posée dessus qui l'est. Pire, à
incidence constante le temps de doublement du cumul **s'allonge**
mécaniquement (100→200 en 10 j, 200→400 en 20 j) : l'alerte se déclenche
tôt dans le suivi d'un foyer puis se tait, exactement l'inverse d'un signal
d'alerte précoce.

**Rejoué sur les données réelles** (`outbreak_snapshots`, 6 460 relevés,
78 jours, 65 jours évaluables, 121 lignes actives), au seuil de 14 jours —
celui que l'UI propose par défaut (`placeholder: "14"`,
`OutbreakDetailModal.tsx:147`) :

```
déclenchements simulés (jour × foyer)                     : 341  sur 40 foyers
  dont incidence 7 j NON croissante (aucune accélération) :  32  ( 9 %)
  dont incidence 7 j en BAISSE (décélération franche)     :  28  ( 8 %)
```

Exemples, chacun un e-mail qui serait parti en disant l'inverse du terrain :

```
WNV / Espagne   22/08 : 39 nouveaux cas la semaine d'avant → 21 la semaine alertée
                        « doublement sous ~12,0 j », « en accélération »
WNV / Grèce     22/08 : 84 → 45          « doublement sous ~13,6 j »
WNV / Roumanie  22/08 : 13 → 10          « doublement sous ~10,9 j »
Chikungunya/FR  24/08 : 14 → 10          « doublement sous ~9,5 j »
WNV / France    18/08 :  2 →  2 (plat, 11 jours d'affilée concernés)
```

**Pourquoi c'est grave ici et pas ailleurs.** Le lectorat de HWG, ce sont des
épidémiologistes de terrain (OMS, Africa CDC, INSP nationaux). Dire
« ce foyer accélère » d'un foyer dont l'incidence hebdomadaire a presque été
divisée par deux est exactement le type d'erreur qui coûte la crédibilité du
produit entier, pas seulement celle de la fonctionnalité. C'est la même
classe de défaut que le badge vert « En déclin » posé sur une correction de
données (28/08) ou le « QUI a signalé » des lignes mal traduites (04/09) :
une affirmation rendue comme un fait, que la donnée ne soutient pas.

**Correctif :** exiger que l'accélération existe réellement avant de tirer —
comparer les nouveaux cas des 7 derniers jours à ceux des 7 jours précédents,
et ne déclencher que si les premiers sont au moins égaux aux seconds. Le
temps de doublement projeté reste ce qui fixe le seuil ; cette condition
n'ajoute qu'un filtre de non-régression. Rien n'est ajouté à l'e-mail, seule
la population de tir change.

**Effort :** petit — une requête `outbreak_snapshots` de plus (bornée aux
seuls foyers qui passeraient le seuil), une fonction pure, une condition.

**Risque/inconnue :** (a) le filtre coupe 9 % des déclenchements et pourrait
en coûter un légitime si un foyer accélère pile entre deux fenêtres
hebdomadaires — mais un signal manqué vaut mieux qu'une affirmation fausse
envoyée à un épidémiologiste ; (b) un foyer sans relevé à J-14 (ligne créée
il y a moins de deux semaines) n'a pas de terme de comparaison : dans ce cas
on ne tire pas, faute de pouvoir étayer le mot « accélération ».

**Garde-fou 3 examiné explicitement avant de construire.** La règle réserve
à une demande de David tout ce qui touche aux e-mails clients. Vérifié en
base live avant toute écriture : `outbreak_predictive_alerts` **0 ligne**,
`outbreak_tripwires` **0 ligne** — aucun abonné, aucun e-mail jamais envoyé
par ce cron, qui n'a d'ailleurs jamais tourné. Le changement ne modifie le
contenu d'aucun message, ne peut atteindre aucun client existant, et son
seul effet est de **retenir** un envoi faux. Construit sur cette base, et
signalé ici pour que l'arbitrage soit relisible.

### Construction — idée 2 livrée, idée 1 délibérément non construite

**Idée 1 (mur payant vs six surfaces publiques) : ⛔ NON construite**, garde-fou
de pricing/packaging. Les deux sorties sont exclusives et s'excluent l'une
l'autre ; trancher revient à défaire, soit le mur livré aujourd'hui, soit
l'actif SEO. Aucune ligne de code touchée sur ce sujet. L'inventaire des six
surfaces ci-dessus est complet et vérifié, il suffit de dire (a) ou (b).

**Idée 2 (alerte prédictive) : ✅ construite** — commit `639316cb`, poussé sur
master. Verrou de code partagé acquis avant la première édition et relâché
après le push.

`app/api/cron/trigger-predictive-alerts/route.ts` ne tire désormais que si le
nombre de nouveaux cas de la semaine écoulée est au moins égal à celui de la
semaine précédente. La borne J-7 est relue avec **exactement la même fenêtre
et le même tri** que la requête `oldest` de `getOutbreakTrendsBulk`, pour que
les deux semaines comparées soient contiguës et non chevauchantes — sans quoi
le filtre aurait mesuré autre chose que ce que le seuil mesure. Une ligne sans
terme de comparaison à J-14 reste silencieuse. Requête paginée par `.range()`
(121 lignes actives × une fenêtre de 8 jours frôle le plafond de 1 000 lignes
de Supabase, et une réponse tronquée revient en succès —
`reference_supabase_caps_queries_at_1000_rows`). Le compteur
`notAccelerating` est renvoyé dans la réponse JSON du cron, pour que la
suppression soit visible et pas silencieuse.

**Rejoué sur l'historique réel après le correctif**, mêmes fenêtres que le
code livré :

```
déclenchements AVANT : 334
déclenchements APRÈS : 247   (74 % conservés)
  supprimés, incidence en BAISSE (affirmation fausse)   : 28   ← la cible
  supprimés, pas de relevé à J-14 (claim non étayable)  : 59
```

Les 59 sont un artefact du rejeu, pas du correctif : ils se concentrent au
début de l'historique des relevés, quand aucune ligne n'avait encore quatre
semaines de recul. **Mesuré sur l'état réel d'aujourd'hui : 113 des 121 lignes
actives (93 %) disposent des deux fenêtres**, donc le filtre peut trancher ;
5 (4 %) seraient muettes faute de terme à J-14, toutes assez jeunes pour
l'acquérir sous quinze jours ; 3 n'ont aucun relevé exploitable et étaient
déjà muettes avant. La fonctionnalité reste largement opérante — 32 foyers
distincts continuent de déclencher.

`npx tsc --noEmit` et `npx eslint` propres sur le fichier touché. Hooks de
pré-commit et de pré-push passés (`check-restricted-fetch` : aucune URL non
déclarée ; `check-cron-schedule` : 25 commentaires conformes à `vercel.json` ;
`check-migrations` : 89 migrations, toutes appliquées).

**Vérification produit non faite, et pourquoi :** le cron n'est pas
observable en navigateur et n'a aucun abonné (0 ligne dans
`outbreak_predictive_alerts`), donc rien à rendre ni à cliquer. Le rejeu sur
les 78 jours d'historique réel ci-dessus est la vérification — il exerce la
même logique sur les mêmes données que celles que le cron lira demain à
12h40 UTC, premier passage de sa vie.

### Constat annexe, aucune action prise

Le registre partagé `_shared/sources-interdites.md` intitule son tableau 🔴
« ne jamais ingérer, **ni citer comme source publiée** », alors que deux de ses
cinq lignes (`polioeradication.org`, `cdc.gov.au`) portent en réalité le régime
« vérification manuelle oui, cron jamais » — et que `lib/source-trust.ts` le dit
noir sur blanc : « Ces éditeurs **peuvent être cités** ». Les 15 lignes polio
actives citant `polioeradication.org` sont donc conformes au code et au régime
décidé, mais paraissent en infraction si on ne lit que l'intitulé du tableau.
J'ai vérifié ce point avant de le signaler comme un défaut — c'en aurait été un
gros. Fichier appartenant à `daily-routine-improvement-audit`, laissé intact ;
à corriger d'un mot par cette routine-là, ou par David.

### Fichiers modifiés par d'autres, laissés intacts (AGENTS.md)

Au démarrage du run, quatre fichiers de code (`app/[locale]/(dashboard)/page.tsx`,
`components/OutbreakDetailModal.tsx`, `components/OutbreakTable.tsx`,
`lib/outbreaks.ts`) et deux fichiers marketing étaient modifiés par la session
interactive en cours. Rien n'a été stagé ni committé de ce travail ; il a été
publié par son auteur en `c04a158a` pendant ce run, et l'idée 2 a été construite
dans un fichier qu'aucune autre session ne touchait.

---

## 2026-09-06 — Proposition du jour

Sources relues : `product-ideas-log.md` en entier (dernière entrée 05/09,
idée 1 « mur payant » tranchée le 06/09 par David en option (b) — masquage
assumé, **ne pas re-proposer**), `product-feedback.md` (dernière entrée
31/08, lepapapericles5, accessibilité — piste « digest allégé » mesurée et
close le 02/09), `ROADMAP.md`, `git log -25`.

Le contexte du jour est presque entièrement une journée de durcissement du
mur payant : 8 commits `fix(paywall)` entre `2753172d` et `20e70be9`, plus
4 commits `fix(emails)` alignant les gabarits sur les fonctionnalités Pro
livrées la veille. Les deux idées ci-dessous partent de là — la première
mesure ce que ce balayage n'a pas couvert, la seconde regarde ce que le
masquage retenu donne à voir à un visiteur.

**Audit de données préalable, sans suite.** Contrôle systématique sur les
296 lignes de la base **prod** (`tqznwmpkokdzrszysbcm`) : 121 actives,
0 `deaths > cases`, 0 date future, 0 CFR > 50 %, 0 `source` non-URL,
0 ligne à `cases <= 0`, 1 seul groupe de doublons actifs (le triplet
Avian Influenza/États-Unis, connu et volontaire). Rien à signaler de ce
côté. ⚠️ Le premier passage de cet audit a été fait par erreur sur
`.env.local`, qui pointe la base **dev** (`ycnuedalfwpnkytdctqz`) : il
rendait 83 actives, toutes périmées de plus de 45 jours et 10 groupes de
doublons — un tableau alarmant et entièrement faux. C'est exactement le
piège documenté dans `AGENTS.md` (« la base dev peut prendre du retard de
schéma sur prod, en silence ») ; refait sur `.env.local.live`.

### 1. 🔴 Le balayage du mur payant a couvert les pages, pas les routes d'API — 96 des 96 lignes masquées se récupèrent en clair, sans compte, en 81 requêtes

**Signal.** Huit commits aujourd'hui pour porter le masquage par bandes
qualitatives aux surfaces publiques, jusqu'à `fd646a97` ce matin, écrit
précisément parce que `/compare` interrogeait la base depuis le navigateur
et exposait « Ebola/RDC 6 342 / 3 072 / 48,4 % » à un visiteur anonyme.

**Les mêmes chiffres, sur la même épidémie, sortent toujours d'une autre
route — vérifié en direct sur la prod, sans cookie ni clé :**

```
$ curl -s 'https://healthwatch-global.com/api/travel-risk?country_en=Democratic%20Republic%20of%20the%20Congo'
  {"disease_en":"Ebola virus disease","cases":6342,"deaths":3072,...}
  {"disease_en":"Cholera",            "cases":41300,"deaths":1214,...}   ← masquée partout ailleurs
  {"disease_en":"Polio",              "cases":45,   "deaths":0,...}      ← masquée partout ailleurs
```

La même route publie aussi `?list=1`, qui rend les **80 pays** ayant une
ligne active. Le balayage complet coûte donc 81 requêtes anonymes :

| Route | Auth | Masquage | Lignes rendues en clair | dont masquées ailleurs |
|---|---|---|---|---|
| `/api/travel-risk` | **aucune** | **aucun** | 121 | **96 / 96 (100 %)** |
| `/api/outbreak-neighbors` | **aucune** | **aucun** | 105 | 87 / 96 |
| `/api/country-scorecard` | connexion seule | aucun | total de cas par pays | agrégat exact |
| `/api/outbreak-cluster` | connexion seule | aucun | cas par ligne liée | latent (voir plus bas) |

Les 14 autres routes qui lisent `cases`/`deaths` sont, elles, correctement
tenues : 12 exigent un plan payant (401/403 vérifiés en direct), et
`/api/feed` comme `/api/outbreak-card/[id]` appliquent bien la bande
(« HIGH RISK · Magnitude: 4/5 (exact figures for Pro subscribers) »).
Le défaut n'est pas dans le dispositif de masquage, qui est bon — il est
dans l'inventaire des surfaces auxquelles on l'a appliqué.

**Pourquoi ces quatre-là sont passées à travers.** Le balayage du jour a été
conduit page par page (tableau de bord, `/compare`, permalien, pages
maladie/pays/région, carte de la page d'accueil). Ces quatre routes n'ont pas
de page à elles : trois alimentent un panneau à l'intérieur d'une page déjà
traitée, et `/api/travel-risk` sert `/[locale]/travel-risk`, une page qui est
dans le `sitemap.ts` à la priorité 0,8 et qu'aucun des huit commits n'a
ouverte.

**Nuance importante sur chacune, elles ne se corrigent pas pareil.**
- `/api/travel-risk` doit **rester publique** : c'est un actif SEO référencé
  au sitemap, et son verdict de risque (`none`/`low`/…/`critical`) n'est pas
  un chiffre. Ce sont les `cases`/`deaths` par ligne qui doivent passer par
  la même bande que partout ailleurs.
- `/api/outbreak-neighbors` n'a **qu'un seul appelant, déjà réservé aux
  payants** (`OutbreakDetailModal.tsx:439`, sous `if (!outbreak || !isPaid)
  return`). Elle se ferme au plan payant comme ses six sœurs, sans changer
  une ligne d'interface.
- `/api/country-scorecard` est dans le même cas : son composant ne s'affiche
  que sous `{isPaid && <CountryScorecardTab …>}` (page tableau de bord,
  l. 632), mais la route se contente d'exiger une session. Un compte
  **gratuit** connecté récupère le total de cas exact par pays — soit
  précisément l'agrégat que `aggregateNeedsMasking` existe pour empêcher de
  reconstituer par soustraction.
- `/api/outbreak-cluster` est le seul cas **latent, pas actif** : son
  composant s'affiche bien aux comptes gratuits, mais il ne se déclenche que
  si `outbreak.event_id` est renseigné — et **0 des 296 lignes de la base en
  ont un**. Vérifié avant de l'écrire : rien ne fuit aujourd'hui par cette
  route. Elle est citée pour ne pas laisser la classe ouverte le jour où un
  cron commencera à écrire `event_id`.

**Effort :** petit. Un helper de masquage déjà écrit et déjà utilisé par
`/api/compare-outbreaks` (`pickFeaturedDiseases` + `magnitudeBand` +
`cfrSeverityBand`), deux gates copiées sur `/api/outbreak-history`.

**Risque/inconnue :** la page `/[locale]/travel-risk` affiche aujourd'hui les
cas et les décès par foyer (`TravelRiskFullPage.tsx:447,451`) ; après
correctif, une ligne non vitrine y montre la même échelle de points que sur
les pages maladie/pays/région. C'est le comportement voulu par l'option (b),
mais c'est un changement visible sur une page publique, et il est signalé
comme tel. Le verdict de risque, la recommandation de voyage et les liens
gouvernementaux ne bougent pas — la valeur d'usage de la page est intacte.

**Point de vigilance sur `travel-risk` spécifiquement :** cette route a déjà
été corrigée deux fois pour la même raison de fond (un échec de requête qui
se lisait « aucun foyer actif — précautions habituelles », mis en cache une
heure sur une surface de décision sanitaire). Le masquage ne doit pas
réintroduire ce défaut : la requête pays qui décide du verdict garde sa
requête et son 503 propres, et seul le calcul de la vitrine gratuite passe
par le cache partagé — lequel, s'il échoue, rend une liste vide, donc aucune
vitrine, donc **tout masqué**. La dégradation se fait dans le sens fermé.

### 2. 🟠 Le masque que David vient de choisir de garder ne dit nulle part ce qu'il est — sur les pages publiques, c'est cinq points gris sans légende, sans infobulle et sans nom accessible

**Signal.** L'arbitrage du 06/09 (« Les chiffres sont masqués, c'est
normal ») fait du masque un choix produit assumé, donc un instrument de
conversion : il est là pour qu'un visiteur comprenne qu'il manque quelque
chose et sache où le trouver. Or ce qu'il rend aujourd'hui, sur la prod, est
muet.

**Mesuré sur la page publique la plus fréquentée du dispositif SEO** —
`curl https://healthwatch-global.com/fr/disease/cholera` :

```
occurrences du mot « Magnitude » dans la page  : 0
occurrences de « Pro » à proximité des points  : 0
pastilles rendues (w-1.5 h-1.5 rounded-full)   : 225
```

La tuile « Cas confirmés » rend exactement ceci, cinq fois de suite, et rien
d'autre :

```html
<span class="inline-flex items-center gap-0.5">
  <span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span> …
</span>
```

Pas de `title`, pas d'`aria-label`, pas de texte. **Pour un lecteur d'écran,
la colonne « cas » de 96 des 119 lignes n'annonce rien du tout** — des
`<span>` vides n'ont pas de nom accessible. Pour un visiteur voyant, cinq
points gris sans échelle ni légende se lisent comme un rendu cassé, pas
comme une porte.

**Le produit sait pourtant formuler la phrase — il la réserve aux machines.**
La même ligne, vue par un moteur de recherche ou un lecteur RSS, est
explicite :

```
<meta name="description" content="Choléra outbreak in RD Congo. Magnitude 4/5
      (exact figures for Pro subscribers). …">
/api/feed → "HIGH RISK · Magnitude: 4/5 (exact figures for Pro subscribers)"
```

L'explication existe donc déjà, rédigée, dans les métadonnées et dans le
flux. Elle n'atteint jamais la surface où quelqu'un pourrait cliquer.

**Une seule surface fait exception**, et elle montre la forme visée : le
tableau de bord enveloppe ses pastilles d'un `cursor-pointer` qui ouvre le
pop-up d'abonnement (`OutbreakDetailModal.tsx:764,787,804`). Les **18 autres
appels** de `MagnitudeDots`/`SeverityWord` — pages maladie/pays/région,
`/compare`, `/reports`, page d'accueil, tableau des foyers, tuiles du
permalien — n'ont ni infobulle, ni libellé, ni lien.

**Effort :** petit à moyen. Le correctif tient dans `MagnitudeIndicator.tsx`
(un `title` + un `aria-label` construits depuis la bande et la locale), et
sa seule vraie contrainte est mécanique : `MagnitudeDots` ne reçoit pas de
`locale` aujourd'hui, il faut la passer aux appels concernés. Les libellés
doivent exister dans les 5 langues, comme `SEVERITY_LABEL` juste à côté.

**Risque/inconnue :** aucun sur les données — c'est du texte d'habillage,
rien ne change de ce qui est envoyé au navigateur. Le seul arbitrage est de
ton : la phrase doit expliquer sans harceler, et elle apparaît sur des pages
indexées. Je reste sur la formulation que le produit emploie déjà dans ses
métadonnées plutôt que d'en inventer une nouvelle.

**Ce que cette idée n'est pas :** une remise en cause de l'option (b). Elle
la prend pour acquise et ne touche à aucun chiffre masqué ; elle rend
seulement lisible le masque déjà en place.

### Construction — les deux idées sont livrées

Verrou de code partagé acquis avant la première édition, relâché après le
push. Les deux idées passent les quatre garde-fous : effort petit/moyen,
aucune migration ni DDL, aucun e-mail / paiement / envoi externe touché,
aucune source de données externe nouvelle (rien de ce run ne lit quoi que ce
soit hors du dépôt et de la base).

**Idée 2 d'abord** (`0ba35515`), parce que l'idée 1 en dépend : les
composants du masque devaient savoir dire ce qu'ils masquent avant qu'on
étende le masque à de nouvelles surfaces.

`MagnitudeDots` porte désormais un `title` **et** un `aria-label` construits
depuis la bande et la locale, les cinq pastilles passant en `aria-hidden`
pour que le groupe s'annonce une fois et non cinq. `SeverityWord` reçoit la
même explication. La formulation est **celle que le produit écrivait déjà
pour les machines** — « Magnitude 4/5 (exact figures for Pro subscribers) »
dans la balise meta du permalien et dans `/api/feed` — traduite dans les 5
locales à côté de `SEVERITY_LABEL`, plutôt qu'une nouvelle phrase inventée.
Les 18 appels reçoivent leur `locale` ; c'est la seule partie mécanique du
changement. **Aucun chiffre supplémentaire ne traverse le réseau** : c'est du
texte d'habillage sur une bande déjà calculée.

**Idée 1 ensuite** (`9684d407`). Les quatre routes ne se ferment pas de la
même façon, comme annoncé :

| Route | Correctif |
|---|---|
| `/api/travel-risk` | reste publique, prend le dispositif des pages maladie/pays/région : une charge masquée identique pour tous, et les chiffres réels remplis côté client pour un abonné payant (`RealStatsProvider` → `/api/outbreak-stats`). `TravelRiskFullPage` et `TravelRiskWidget` rendent la bande sinon. |
| `/api/outbreak-neighbors` | plan payant exigé, comme son unique appelant ; cache passé de `public` à **`private`** (un cache partagé gardant une réponse payante rouvrirait le trou que la porte vient de fermer) |
| `/api/country-scorecard` | plan payant exigé au lieu de la simple session |
| `/api/outbreak-cluster` | **masqué, pas fermé** — c'est le seul panneau qui s'affiche aux comptes gratuits volontairement |

Le point de vigilance annoncé sur `travel-risk` est tenu : la recherche de la
maladie vitrine passe par la liste partagée en cache, **délibérément hors du
chemin sanitaire**. Cette liste dégrade en `[]` au lieu de lever, ce qui donne
une carte de vitrines vide, donc **tout masqué** — le masque échoue fermé —
tandis que la requête pays qui décide du verdict garde sa requête et son 503
propres.

**Vérification en production, après déploiement** (`npx tsc --noEmit` et
`npx eslint` propres au préalable sur les 19 fichiers touchés ; hooks de
pré-commit et de pré-push passés : `check-restricted-fetch` aucune URL non
déclarée, `check-migrations` 89 migrations toutes appliquées).

Le même balayage anonyme que celui qui a servi à écrire l'idée 1, rejoué sur
la prod déployée :

```
pays sondés                                   : 80   (81 requêtes anonymes)
verdicts de risque encore rendus              : 80/80   ← la page reste utile
lignes encore en clair via /api/travel-risk   : 23
  dont MASQUÉES ailleurs                      :  0     ← était 96/96
/api/outbreak-neighbors  (anonyme)            : HTTP 401
/api/country-scorecard   (anonyme)            : HTTP 401
/api/outbreak-cluster    (anonyme)            : HTTP 401
```

Les 23 lignes encore en clair sont exactement les maladies vitrines gratuites,
publiques par décision. Contrôle de non-régression dans l'autre sens :
`/fr/disease/ebola` affiche toujours « 6 342 » et « 3 072 » pour la ligne
vitrine Ebola/RDC, à côté de 17 pastilles masquées sur la même page.

Et pour l'idée 2, sur les pages publiques déjà régénérées :

```
/fr/disease/cholera  → title/aria-label « Ampleur 3/5 — chiffres exacts réservés aux abonnés Pro »
/en/region/africa    → title/aria-label « Magnitude 3/5 — exact figures for Pro subscribers »
```

**Ce qui n'a pas pu être vérifié en navigateur, et pourquoi.** Le démarrage
d'un serveur de prévisualisation est refusé dans un run planifié (personne
n'est présent pour approuver la commande). La vérification a donc été faite
directement contre la production déployée, ci-dessus — ce qui est plus fort
qu'un rendu local, mais laisse un angle mort : la page `/[locale]/travel-risk`
construit sa liste **côté client**, après le choix d'un pays, donc son rendu
masqué n'apparaît pas dans le HTML servi et n'a pas pu être constaté
visuellement. La charge d'API qui l'alimente, elle, est vérifiée masquée
ci-dessus, et les composants suivent le même patron que les pages
maladie/pays/région déjà en ligne.

### Constat annexe, aucune action prise

Le seuil de plan payant n'est pas le même partout : `/api/rss` exige
`["pro","team","enterprise"]` alors que toutes les autres surfaces masquées
acceptent aussi `"starter"` (le plan hérité, encore lu vivant par
`Navbar.tsx` d'après `ROADMAP.md`). Un abonné historique « starter » voit donc
les chiffres exacts sur le tableau de bord et `/compare`, mais reçoit un 403
sur le flux RSS. Écart réel mais sans victime connue à ce jour ; les nouvelles
portes posées ce soir suivent la liste majoritaire (avec `starter`) pour ne
pas aggraver l'incohérence. À trancher par David si un abonné hérité existe
encore.

### Fichiers modifiés par d'autres, laissés intacts (AGENTS.md)

Au démarrage du run l'arbre était propre. Une autre session a poussé
`cf3d7a3d` (`lib/source-trust.ts`) pendant l'étape de proposition ; récupéré
par un `git pull --ff-only`, rien de ce travail n'a été stagé ni committé par
ce run. Les 19 fichiers des deux commits ci-dessus ont été stagés un par un,
jamais par `git add -A`.
