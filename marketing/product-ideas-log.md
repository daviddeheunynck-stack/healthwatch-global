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
