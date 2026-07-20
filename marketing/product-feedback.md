# Feedback produit — HealthWatch Global

Feedback produit substantiel reçu via LinkedIn ou email, distinct du content-log marketing pour rester facilement exploitable côté développement. Mise à jour à chaque session dès qu'un retour de ce type arrive.

---

## 5 juillet 2026 — Zahra BOUZIDI (MD, Public Health Epidemiology, Algérie)

**Contexte :** utilisatrice engagée depuis fin juin (voir linkedin-contacts.md pour l'historique complet du compte), a testé le dashboard en profondeur.

**Retour 1 — Niveau de contagiosité dans le profil clinique**
Ajouter un indicateur du niveau de contagiosité qui caractérise chaque maladie dans le profil clinique (ex : la rougeole comme l'une des maladies les plus contagieuses connues). Actuellement absent du profil clinique par maladie.

**Retour 2 — Foyers actifs en zones de conflit**
Les zones de guerre/conflit (Palestine, Soudan, etc.) devraient faire remonter des foyers actifs de maladies attendues dans ce contexte (choléra, polio, typhoïde) compte tenu du sinistre sanitaire, mais l'absence de données remontées reflète probablement une faiblesse du système de déclaration local plutôt qu'une absence réelle de cas. Angle mort potentiel : la plateforme peut sous-représenter le risque épidémiologique dans les zones où le système de santé est effondré.

**Statut :** remerciement envoyé le 5 juillet, pas encore priorisé côté développement.

---

## 6 juillet 2026 — Simon Ruegg (systems practitioner in health, One Health, University of Zurich)

**Contexte :** nouvelle connexion LinkedIn (6 juillet), échange technique riche sur le framework de surveillance HWG. Cf. linkedin-contacts.md pour l'historique complet de la conversation.

**Retour — Indicateurs précoces au-delà des comptages de cas**
HWG utilise aujourd'hui un cadre statistique classique (valeurs extrêmes sur des comptages de cas), un signal par nature tardif. Simon propose deux angles :
1. **Liste d'indicateurs précurseurs** (moins nouveau, plus attendu) : taux de chômage, patterns de mobilité, sources de protéines/sécurité alimentaire, productivité agricole — des signaux de vulnérabilité socio-écologique en amont d'un foyer.
2. **Signal de fluctuation/variance dans les séries temporelles** (l'angle vraiment intéressant, identifié comme tel par David) : surveiller l'augmentation de la variance elle-même (ou une stabilité anormale) avant un basculement, plutôt que le niveau de la série — proche du concept de "ralentissement critique" (critical slowing down) en théorie des systèmes adaptatifs complexes. Question technique posée en retour : est-ce calculable sur nos séries de comptages de cas existantes, ou faut-il un type de données différent ?

**Suite (7 juillet 2026) :** plutôt qu'une réponse directe à la question de faisabilité, Simon a partagé une ressource — **sparcs-center.org** (SPARCS Center), qui discute le fondement statistique des transitions critiques dans les systèmes adaptatifs complexes. Piste à creuser : ce cadre "critical slowing down" appliqué à la variance des séries de surveillance. DM de suivi de David rédigé le 7 juillet (en attente validation), relançant sur la robustesse du signal de variance face au bruit de reporting terrain (séries de cas incomplètes) plutôt que sur données propres/simulées.

**Statut :** conversation en cours, pas encore priorisé côté développement. Piste méthodologique à explorer (lecture SPARCS + faisabilité sur nos comptages réels). Réponse de Simon sur la robustesse au bruit terrain à attendre.

---

## Modèle d'entrée

```
## [date] — [Nom du contact] ([rôle/institution])

**Contexte :** [qui est ce contact, pourquoi son avis compte]

**Retour :** [ce qui est demandé/signalé, aussi précis que possible]

**Statut :** [reçu / accusé de réception envoyé / en cours / implémenté / écarté + raison]
```

**Ajout (7 juillet, réponse de Simon 11:33) :** angle « résilience/fonctionnalité » vs détection d'outliers. Les signaux d'alerte précoce SPARCS regardent le *fonctionnement* d'un système socio-écologique (santé = fonction), pas les valeurs extrêmes (le foyer déclaré). Un foyer peut donc se conceptualiser comme une *rupture de fonction*, et les signaux fonctionnels pourraient alerter avant que la maladie ne « sorte du chapeau ». Implication produit : capter la vulnérabilité systémique demande des données que HWG n'ingère pas aujourd'hui (indicateurs socio-écologiques, pas seulement comptages de cas). Piste de fond, pas de court terme.

---

## 7 juillet 2026 — Motif transversal repéré sur plusieurs contacts indépendants (synthèse, pas un retour isolé)

**Contexte :** au fil de la session du 7 juillet, quatre contacts sans lien entre eux ont, chacun à sa manière, pointé le même angle mort structurel de HWG.

**Retour :**
- **Awulachew Tadesse** (terrain, Éthiopie) a signalé un foyer de rougeole des semaines avant toute confirmation/publication formelle.
- **Dr R Hyacinthe ZABRE** (Africa CDC, Bunia) a mentionné la lenteur de remontée des données terrain comme frein concret à l'intelligence épidémique.
- **Simon Ruegg** (systems practitioner, One Health) : le signal utile est la vulnérabilité du système *avant* l'anomalie statistique, pas après (voir entrée dédiée ci-dessus).
- **Dr. Rashi Bhardwaj** (Veterinary Public Health) le 7 juillet 18:16, en réponse directe sur l'engagement communautaire : « Formal networks provide the reporting system, but trust is what drives early reporting. Farmers, local veterinarians, and community workers are often the first to notice something unusual, and timely feedback encourages them to keep reporting. »

Motif commun : HWG est structurellement un agrégateur de bulletins déjà publiés (WHO DON, ECDC, PAHO, Africa CDC, WHO AFRO/EMRO) — par construction un indicateur retardé. Le signal le plus précoce vit dans des réseaux humains de confiance sur le terrain, pas dans les sources actuellement ingérées.

**Piste produit (distincte de l'angle Simon, plus théorique) :** un canal léger de « signal de terrain » permettant à un contact de confiance de signaler « il se passe quelque chose ici » avant confirmation formelle — sans données patient (déjà cadré par la politique RGPD, cf. cas Awulachew/line list), avec un accusé de réception rapide. Rashi souligne explicitement que c'est ce retour rapide qui entretient la volonté de continuer à signaler.

**Statut :** MVP construit et testé le 7 juillet 2026 (non annoncé publiquement). Canal `/field-signal` (5 langues) + route `/api/field-signal` : formulaire nom/organisation/email/localisation/message, notification David tagée `[SIGNAL 🟢]` + accusé de réception automatique immédiat au déclarant (le point central du retour de Rashi). Page volontairement non liée dans nav/footer et `noindex` — à partager en direct avec des contacts de confiance (Rashi, Awulachew...) pour tester l'usage réel avant toute promotion publique. Aucune table DB créée, aucune modération construite : tout part par email vers la boîte de David pour triage manuel. Testé en conditions réelles (soumission → deux emails Brevo reçus, FR/EN vérifiés visuellement).

## 10 juillet 2026 — Eva Kamau (Clinician & Clinical Researcher, spécialisée AMR, Kenya)

**Contexte :** contact issu d'un DM d'activation envoyé le 9 juillet (voir linkedin-contacts.md), a répondu en détaillant son profil (pratique clinique, recherche clinique, surveillance des maladies infectieuses au Kenya, réponse COVID-19) et son intérêt de long terme pour l'antibiorésistance (AMR).

**Retour — Absence de volet AMR dans la plateforme**
Eva a explicitement demandé à voir comment HWG soutient la surveillance sous un angle AMR. Vérification du code (agent Explore, 10 juillet) : **aucune fonctionnalité AMR n'existe aujourd'hui** — le schéma `DiseaseInfo` ne porte aucun champ de résistance, aucune intégration GLASS (WHO Global Antimicrobial Resistance Surveillance System), aucun tag de souche résistante exposé à l'utilisateur. Seul indice trouvé : un commentaire dans un fichier de config de seuils d'alerte mentionnant les souches de typhoïde XDR (Inde/Zimbabwe) pour justifier un seuil plus bas — un réglage interne du pipeline de comptage de cas existant, pas une donnée AMR exploitable.

**Piste d'amélioration à évaluer :**
1. **Version légère (peu coûteuse)** : exposer/tagger les mentions de résistance déjà présentes dans les SitReps/bulletins sources ingérés (ex. typhoïde XDR, tuberculose multirésistante) comme un filtre ou badge sur les foyers existants, sans nouvelle source de données.
2. **Version complète (scope plus large)** : intégrer WHO GLASS comme source additionnelle, avec ses propres séries de résistance par pathogène/région — mais c'est un type de donnée différent (antibiogrammes longitudinaux, pas des comptages de cas d'un foyer), donc un chantier distinct du modèle actuel, pas une extension triviale.
Signal de demande : au moins 2 profils épidémio/santé publique croisés en juillet (Eva Kamau + les profils "One Health/AMR" comme Abasse Zombra, Dr. Hassan SANA) montrent un intérêt pour cet angle, sans que ce soit encore un pattern fort.

**Statut :** réponse honnête envoyée à Eva le 10 juillet (pas de survente, clarifié que HWG n'a pas ce volet aujourd'hui), pas encore priorisé côté développement.

**Suite (10 juillet, 14:28) — piste plus précise qu'un simple "ajoutez l'AMR" :**
Eva a répondu positivement à la clarification (« thank you for being upfront ») et confirme rester intéressée par l'accès Pro. Elle propose un angle concret et distinct des deux pistes ci-dessus : **croiser les périodes de foyers actifs avec les pics de mésusage/surprescription d'antibiotiques**, l'idée étant que les épidémies elles-mêmes déclenchent des pics de résistance (AMR) via l'usage antibiotique inapproprié pendant la crise. Citation : « Tracking how these outbreaks trigger spikes in antimicrobial resistance over time would be a fascinating layer to look into. »

**Différence avec les pistes 1/2 précédentes :** ce n'est pas une demande de données AMR statiques (type GLASS) mais une **corrélation temporelle outbreak → usage antibiotique → résistance**, exploitable en théorie avec les données déjà présentes (dates/durées des foyers) croisées à une source antibiotique/AMR à identifier — reste un chantier de données externes non trivial (aucune source de ce type actuellement ingérée), mais l'angle en lui-même est plus original et actionnable qu'un simple ajout de badge.

**Statut :** en attente, accès Pro à activer pour Eva (mentionné par David dans son message du 10 juillet, pas encore fait). Toujours pas priorisé côté développement.

**DM envoyé à Eva (15:46, validé par David « oui »)** : réponse honnête sur la piste "outbreak → mésusage antibiotique → pic AMR", expliquant le vrai blocage (trous de couverture GLASS dans les zones où HWG a le plus de foyers actifs), sans promettre de feature. Reformulée en question ouverte sur son propre intérêt pour cet axe de recherche plutôt qu'en engagement produit de HWG.

---

## Métriques de process (alert-to-validation) comme dataset standardisé — échange INGRIDE SIEMENI (20/07/2026)

**Source :** fil DM LinkedIn de plusieurs jours avec Ingride Siemeni (Master PH Epidemiology), poursuivi le 20/07.

**Idée produit émergée (distincte du volet AMR) :** les indicateurs opérationnels de surveillance (temps alerte→validation, temps→investigation, temps→réponse) sont un angle mort quasi systématique. WHO/Africa CDC/ECDC publient les outputs épidémio (cas, décès, couverture contact tracing) mais **jamais** ces métriques de process, qui restent internes aux IMS/EOC. Ingride confirme qu'elles n'apparaissent même pas de façon standardisée dans les AAR/JEE (au mieux qualitatif).

**Piste concrète pour HWG :** un acteur externe (type HWG) pourrait **re-lire systématiquement les AAR et rapports JEE pour en extraire et standardiser la rapidité de validation**, même imparfaitement. Consensus dans l'échange : ne pas forcer une fausse précision (nombre de jours) que la source qualitative ne supporte pas, mais **coder en buckets ordinaux** (timely / moderately delayed / significantly delayed) avec critères transparents et métadonnées de contexte. Référence réelle citée comme la plus proche : le cadre **7-1-7** (Resolve to Save Lives/WHO), qui convertit un timeline en pass/miss borné par étape (détecter 7j / notifier 1j / répondre 7j).

**Intérêt pour HWG :** aujourd'hui HWG n'affiche que l'output du "queue" de validation (une flambée apparaît le jour où un bulletin la publie). Une couche "métrique de process / timeliness ordinale" serait un différenciateur fort et cohérent avec le positionnement (voir la couverture des trous de validation). Chantier data non trivial (extraction depuis AAR/JEE, sources hétérogènes), à évaluer côté faisabilité.

**Statut :** idée capturée, non priorisée. À recouper avec un éventuel intérêt récurrent (plusieurs contacts terrain — INGRIDE, Oussama, Anoop, Nassoro, ZABRE — tournent tous autour du même problème "détection vs validation vs réponse").

**Tentative d'implémentation (20/07/2026) — ABANDONNÉE en l'état, chantier repensé en incrémental :**
Reformulation validée avec David au moment de coder : plutôt que relire des AAR/JEE réels (subjectif, lent, sensible sur la performance de pays réels), dériver un **délai observable depuis les données déjà ingérées par HWG** (`date` du foyer vs `created_at` = 1ère insertion HWG), affiché en Pro (exports CSV/JSON + rapports PDF par région). Implémenté (`lib/reporting-lag.ts` + branchement dans `app/api/export` et `app/api/report/[region]`), testé contre la vraie base dev avant tout commit.

**Le test a invalidé la prémisse :** plusieurs foyers affichaient un "retard" de 200 à 831 jours (ex. Avian Influenza/USA) qui n'étaient PAS de vrais retards de pipeline mais des **backfills historiques en lot** (toutes les lignes concernées partagent le même `created_at` à la milliseconde près, provenance USDA APHIS — import ponctuel de cas anciens avec leur vraie date passée). Rien dans le schéma `outbreaks` actuel ne distingue une insertion "live" (signal frais détecté à sa date) d'une insertion "backfill" (archive historique importée d'un coup) — les deux produisent exactement le même écart `date`/`created_at`. Livrer la métrique en l'état aurait affiché des alertes "Retardé" trompeuses sur des données d'archive légitimes, dans un rapport payant.

**Décision (20/07/2026) :** ne pas abandonner l'idée, mais la construire par étapes, un peu chaque jour, plutôt que d'un coup — et ne rendre la fonctionnalité visible sur le site qu'une fois complète. Prérequis avant de retenter le calcul de délai :
1. Ajouter une vraie distinction en base entre insertion "live" (cron régulier détectant un signal frais) et "backfill" (import historique volontaire) — probablement une colonne booléenne sur `outbreaks` (ou déduite proprement, pas par heuristique fragile sur le nom de la source).
2. Peupler cette distinction correctement à travers les ~15 crons `sync-*` existants (chacun sait déjà s'il fait un backfill ponctuel ou un poll régulier — c'est le bon endroit pour le marquer, pas après-coup).
3. Une fois cette base fiable, refaire le calcul de délai (restreint aux lignes jamais mises à jour depuis l'insertion, ET non marquées backfill) et re-tester contre des données réelles avant tout affichage.

Code de la tentative (lib/reporting-lag.ts + branchements export/report) entièrement retiré du repo le 20/07 après le test (rien commité, aucun résidu). Rien à re-coder tant que l'étape 1 n'est pas faite.
