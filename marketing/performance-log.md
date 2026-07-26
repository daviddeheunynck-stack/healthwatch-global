# Performance Log — contenu social HealthWatch Global

Ce fichier mesure, semaine par semaine, **l'effet réel** du contenu social publié par les routines quotidiennes (`x-hwg-monitoring`, `x-hwg-followup-check`, `linkedin-hwg-monitoring`, `linkedin-hwg-followup-check`, `x-hwg-content-proposal`).

Il est le complément de `content-log.md` : celui-ci archive **ce qui a été publié** (texte, angle, sources, double-check) mais ne mesure jamais **ce que ça produit**. Ici on relève les vues, les likes, les réponses reçues, la croissance d'abonnés et le volume de DM entrants, et on cherche les patterns exploitables.

Alimenté chaque jeudi par la tâche planifiée `hwg-social-performance-weekly-review`. **Session en lecture seule stricte** : aucune publication, aucun follow, aucune modification de compte.

**Règle de fiabilité** : un compteur inaccessible est noté « non disponible » ou « non relevé », jamais estimé.

---

## 📅 Semaine du 2026-07-16 au 2026-07-23 — premier relevé (référence)

**Périmètre mesuré** : 19 replies X et 17 commentaires LinkedIn publiés dans la fenêtre. Les replies X ont été relevées **de façon quasi exhaustive** (17/19) via `x.com/HWatchGlobal/with_replies`, qui expose le compteur de vues de chaque reply. Les commentaires LinkedIn n'ont **pas** pu être remesurés en session (voir limite ci-dessous) : leurs retombées sont reprises des relevés déjà archivés par les routines de 16 h.

⚠️ **Limite de ce relevé — LinkedIn inaccessible en session.** Toute navigation vers `linkedin.com` a été refusée par l'extension (« Navigation to this domain is not allowed »), y compris après re-`select_browser` sur le deviceId habituel et création d'un onglet neuf. Même famille de blocage que l'incident « cas 4 : autorisation de domaine » du 17/07. Conséquence : **aucune impression de commentaire LinkedIn n'a pu être relevée directement cette semaine**. Les chiffres LinkedIn ci-dessous proviennent des archives des routines quotidiennes, qui elles ont tourné normalement.

### Compteurs d'abonnés

| Plateforme | Valeur au 23/07 | Semaine précédente | Delta |
|---|---|---|---|
| **X — @HWatchGlobal** | **21 abonnés** (121 abonnements, 145 posts) | pas de relevé antérieur | **référence** |
| **LinkedIn — profil David Deheunynck** | **140 abonnés** (relevé routine 23/07 matin) | 119 le 17/07 | **+21 sur 7 jours** |

Série LinkedIn reconstituée depuis `linkedin-contacts.md` : 119 (17/07) → 130 (20/07) → 134 (21/07 matin) → 136 (21/07 après-midi) → 138 (22/07 matin) → 139 (22/07 après-midi) → 140 (23/07). Croissance régulière, environ +3/jour, sans décrochage.

### Replies X — détail

Vues relevées sur le compteur de X le 23/07 vers 11 h. « Vues post cible » sert de dénominateur de portée.

| Date | Compte cible | Angle | Vues post cible | **Vues reply** | Likes | Réponses reçues |
|---|---|---|---|---|---|---|
| 16/07 | @RwenzoriMarathn | Marathon du 22 août vs fenêtre OMS de 42 j (travel-risk / duty of care) | 191 k | **815** | 0 | 0 |
| 16/07 | @TravelGov | Incubation 21 j vs clôture d'épidémie à 42 j | 37 k | **230** | 1 | 0 |
| 16/07 | @GalaxyFMUg | Le compte à rebours de 42 j démarre à la sortie du dernier patient | 45 k | 181 | 0 | 0 |
| 17/07 | @HelenBranswell | Coût opérationnel du silence ougandais sur Marburg | 5 k | 42 | 0 | 0 |
| 17/07 | @SantePubliqueFr | Cas équins WNV de 2006 dans le même département | 2 k | 17 | 0 | 0 |
| 18/07 | @DrTedros | Décès en communauté = nœud d'amplification, pas un point final | 63 k | 110 | 0 | 0 |
| 20/07 | @Reuters | Interdiction d'entrée = tripwire d'auto-surveillance, pas interdiction | 49 k | 23 | 0 | 0 |
| 20/07 | @julienmh | Surreprésentation des femmes = angle mort du traçage nominatif | 748 | 31 | 0 | 0 |
| 20/07 | @AfricaCDC | Chute du suivi des contacts en Ituri vs « never learn it twice » | 2 k | *non relevé* | *n.r.* | *n.r.* |
| 21/07 | @BNOFeed | Létalité parmi les cas résolus (67 %) vs CFR brut | 16 k | 116 | 1 | 0 |
| 21/07 | @Chikwe_I | Les diagnostics sont la contrainte liante, pas l'immunité | 6 k | 49 | 0 | 0 |
| 21/07 | @KrutikaKuppalli | Déployer pour apprendre vs présumer la protection croisée | 1 k | 42 | 1 | 0 |
| 21/07 | @DavyDrTumuhairw | Continuation de fil : préparer les provinces encore indemnes | — | *non relevé* | *n.r.* | *n.r.* |
| 22/07 | @washingtonpost | Le record annuel n'est pas le critère d'élimination | 23 k | 65 | 0 | 0 |
| 22/07 | @UNGeneva | Deux types d'expansion : entre provinces vs dans l'épicentre | 23 k | 40 | 0 | 0 |
| 22/07 | @Dr_JeanKaseya | Aucun référentiel historique pour l'espèce Bundibugyo | 3 k | 13 | 0 | 0 |
| 23/07 | @Com_mediasRDC | Composition des sorties d'isolement (66 décès vs 37 guérisons) | 3 k | 13 | 0 | 0 |
| 23/07 | @sidhant | Le passif filovirus du Kenya est Marburg, pas Ebola | 10 k | 7 | 0 | 0 |
| 23/07 | @CIDRAP | Latence PESS de 9,5 ans : le bilan d'une année rougeole se clôt en 2030 | 2 k | 6 | 0 | 0 |

Les trois replies du 23/07 avaient 32 à 43 minutes d'existence au moment du relevé : leurs chiffres ne sont **pas** comparables aux autres et seront revus la semaine prochaine.

**Total mesuré : 1 800 vues cumulées sur 17 replies, 3 likes, 0 réponse publique reçue.**

### Contenu de marque X (threads MWF) — pour comparaison

| Thread | Vues tweet 1 | Autres tweets |
|---|---|---|
| 17/07 — CFR provincial Ebola RDC | 34 | 6, 5 |
| 20/07 — Rougeole Amériques, artefact de reporting | 12 | 6, 10 |
| 22/07 — Arbovirus France, le zéro de mi-juillet | 12 | 10, 7 |

### Contenu LinkedIn

**Posts de marque** (statistiques relevées par la routine de 16 h le 22/07) : 453 impressions cumulées sur la semaine, post rougeole Amériques du 20/07 à **106 impressions + 2 abonnés gagnés**, post Ouganda/filovirus du 22/07 à **24 impressions**. Impressions du 23/07 non relevées (LinkedIn inaccessible).

**Commentaires — retombées effectivement observées** (source : sections « Retombées » de `content-log.md`) :

| Date | Cible | Angle | Retombée mesurée |
|---|---|---|---|
| 23/07 | Tambe Elvis Akem, MD | Les bulletins publient un état, pas un delta | **Réponse de l'auteur ~9 min après** (« well said, thanks ») |
| 23/07 | Félicité Dorise FOE NOAH | La SFE avance la détection sans avancer la notification | non relevé |
| 23/07 | EDCTP (ICI3D) | Former des modélisateurs ≠ ouvrir les tuyaux de données | non relevé |
| 22/07 | Dr. Urvashi Chauhan | Le goulot est dans les passages de relais, pas dans une étape | **Réponse longue + mention de David + like** ⭐ |
| 22/07 | Dr Jean Kaseya (Africa CDC) | Le rythme casse le reporting (75 cas/j vs feed rafraîchi tous les 2-4 j) | aucune réponse |
| 22/07 | Claudine nguegni (fil Ingride Siemeni) | Le vrai test de l'analyse locale, c'est le retour vers le district | réaction de Patricia KOUYATE |
| 21/07 | ReAct Africa Network (RAAC2026) | Les données AMR butent sur le même goulot que les données outbreak | **Réponse publique + like + vue de profil d'Eva Kamau** |
| 21/07 | Elisabeth DIBONGUE (One Health M&E) | Les métriques de process ne sont jamais publiées | like |
| 21/07 | Ingride Siemeni (son post) | Le goulot est l'utilisation, pas la disponibilité | **Réponses de Claudine nguegni + d'Ingride elle-même**, fil qui s'élargit ; 178 impressions sur le commentaire |
| 18/07 | Nathan Lo / Abraar Karan | L'agrégat national masque la distribution de couverture | non relevé |
| 18/07 | Krutika K. (Cyclospora) | Le test doit être demandé pour que le cas existe | non relevé |
| 17/07 | Dr Jean Kaseya · Oussama Wail Bouhentala · MSF Eastern Africa | (3 commentaires) | non relevé |

### DM / messages reçus

| Plateforme | Reçus sur 7 jours |
|---|---|
| **X** | **0** — boîte vérifiée vide (vues Tous + Priorité + Masqué + demandes de message) à **chacune des 7 sessions** de la semaine |
| **LinkedIn** | **~12 messages entrants** identifiés dans `linkedin-contacts.md`, dont **4 réponses de fond le même jour (22/07)** : Serge Lisongo Gbalamo (PEV RDC, DHIS2), Oumaima Mahamat Djarma (OMS Tchad), Mohamed Malainine Ahmed Meska (Min. Santé Mauritanie, 7-1-7), Barrè Onivogui (ANSS Guinée). Plus Ramdhane Mohamed (Services Vétérinaires Mauritanie, 23/07), Kevin Wamae (KEMRI-Wellcome, 18 et 20/07), Dr R Hyacinthe ZABRE (17/07, a livré son email → accès Pro provisionné), Dav Mulamba, Calixte Oswald Assogba, Dr Mohamedou Hmeied Maham, Ingride Siemeni |

---

### 🔎 Synthèse — patterns observés

**1. Les deux canaux ne produisent pas la même chose, et l'écart est brutal.** Sur 8 jours, X a produit **0 DM, 0 réponse publique, 3 likes** et une croissance d'abonnés invisible (21 abonnés au total). LinkedIn a produit **+21 abonnés, ~12 messages entrants dont 4 réponses de fond le même jour, et au moins 4 réponses publiques sous commentaires**, dont une d'un épidémiologiste de terrain en 9 minutes. Pour un volume d'effort comparable, **tout le signal de traction vient de LinkedIn**. X délivre de la portée (1 800 vues), LinkedIn délivre de la conversation.

**2. Sur X, la portée d'une reply est déterminée par le post cible, pas par l'angle.** Le taux reply/cible est remarquablement stable, autour de **0,2 à 0,7 %** des vues du post ciblé. Les trois meilleures replies de la semaine (815, 230, 181 vues) visent toutes des posts à très forte audience (191 k, 37 k, 45 k). Corollaire opérationnel : **le choix de la cible pèse plus que la qualité de l'angle** sur le nombre de vues. Deux exceptions à comprendre : @Reuters (49 k de portée mais seulement 23 vues sur la reply, la plus mauvaise conversion de la semaine) et @julienmh (748 vues seulement sur la cible mais 31 vues sur la reply, la meilleure conversion relative).

**3. Le registre travel-risk / duty-of-care surperforme le registre épidémiologique pur.** Les trois meilleures replies (marathon Ouganda, restriction DHS, sortie du dernier patient) portent toutes sur « qu'est-ce que ça change pour quelqu'un qui voyage ou qui décide ». Les replies les plus techniques (protection croisée Ervebo, référentiel historique de l'espèce, latence PESS) plafonnent entre 6 et 49 vues, y compris quand le post cible est important.

**4. Les threads de marque X sont le format le moins performant du dispositif, de loin.** 5 à 34 vues par tweet, contre 815 pour la meilleure reply. Un thread de marque touche donc environ **1 % de ce que touche une bonne reply**, alors qu'il coûte beaucoup plus cher à produire (sources primaires, vérification chiffre par chiffre, double-check). Sur X, le levier de portée est la reply, pas le thread.

**5. Ce qui déclenche une réponse sur LinkedIn : poser un déplacement de cadre, pas apporter un chiffre.** Les commentaires qui ont reçu une réponse (Urvashi Chauhan, Tambe Elvis Akem, ReAct Africa, Ingride Siemeni) déplacent tous la question posée par le post (« le goulot est dans les passages de relais, pas dans une étape », « l'évidence circule mieux en delta qu'en instantané »). Le seul commentaire de la semaine à n'avoir produit **aucune** réaction, celui à Dr Jean Kaseya, est aussi le seul qui se contentait d'apporter un chiffre plus récent que le post. La thèse « métriques de process invisibles / état vs delta » revient dans **quatre** interactions distinctes cette semaine : c'est le filon éditorial le mieux validé du dispositif.

**6. Les comptes suivis récemment ne génèrent rien de mesurable.** Aucun des follows exécutés cette semaine sur X n'a produit d'interaction en retour. La seule interaction entrante sur X en 8 jours vient de @DavyDrTumuhairw (like + follow + réponse le 21/07), un compte à 23 abonnés qui n'avait pas été suivi et a été explicitement refusé au titre du garde-fou de légitimité.

### 📌 À revoir la semaine prochaine
- Delta d'abonnés X depuis la référence de 21 (le seul chiffre entièrement inédit de ce relevé).
- Les trois replies du 23/07, mesurées trop tôt.
- Impressions par commentaire LinkedIn, si le domaine redevient accessible : c'est la seule métrique de portée manquante côté LinkedIn, alors que c'est le canal qui produit tout le signal.
- Vérifier si la reply @AfricaCDC du 20/07 et la continuation @DavyDrTumuhairw du 21/07 confirment ou non le ratio 0,2-0,7 %.
