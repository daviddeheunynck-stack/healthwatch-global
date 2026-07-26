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
