# Feedback produit — HealthWatch Global

Feedback produit substantiel reçu via LinkedIn ou email, distinct du content-log marketing pour rester facilement exploitable côté développement. Mise à jour à chaque session dès qu'un retour de ce type arrive.

---

## 20 août 2026 — ETIENNE GUENOU (Laboratoire National de Santé Publique, Cameroun) — 🎯 QUALITÉ DE SOURCE, audit externe vérifié et exact

**Qui.** Superviseur des panels de contrôle de qualité externe (EQA) pour le diagnostic du choléra au **NPHL, Cameroun**. Connecté à David depuis le 12/08, fil actif de 5 messages sur la traçabilité de la qualité diagnostique. C'est **le premier retour produit venu d'un professionnel qui a réellement ouvert la plateforme et remonté à la provenance d'une ligne**, plutôt que d'en commenter l'apparence.

**Ce qu'il a écrit (20/08, verbatim partiel) :**

> *Regarding your dashboard at HealthWatch Global, you hit the nail on the head: data transparency and source selection drastically impact data quality. For instance, I noticed your platform currently pulls Cameroon data from 237actu, which is a local commercial news outlet. In public health, media reporting often introduces noise, delays, or unverified figures. To ensure maximum accuracy for Cameroon, your pipeline should plug directly into the CCOUSP (ccousp.cm) — the Center for Coordination of Public Health Emergency Operations. They are the sole official body authorized to publish validated, incontestable epidemiological data for the country. Fixing that source pipeline would immediately elevate the implicit quality signal of your Cameroon figures!*

Il a enchaîné à 14:49 avec **deux sitreps officiels camerounais en pièce jointe** : `SitRep_15_Cholera_Extrême_Nord_2026.pdf` (518 Ko) et `Sitrep-National-Mpox_11.pdf` (2 Mo). ⚠️ **Non téléchargés** par la session (téléchargement soumis à autorisation) ; ils restent disponibles dans le fil LinkedIn.

**Vérification en base prod (`.env.local.live`, requête faite le 20/08 à 17h, pas reprise d'une note) — il a raison.**

`outbreaks` filtré sur `country ilike '%amerou%'` → **2 lignes, 1 seule active** :

| Maladie | Région | Cas | Décès | Date (as-of) | `source_priority` | Source |
|---|---|---|---|---|---|---|
| **Choléra** | Extrême-Nord | 1 000 | 28 | **2026-08-10** | **10** | `237actu.com/extreme-nord-une-epidemie-de-cholera-fait-28-morts-la-riposte-sorganise/` |
| Fièvre jaune | — | 36 | 0 | 2025-01-01 (inactive) | 5 | `who.int` GHO |

**Contrôle élargi sur l'ensemble des lignes actives** : la très grande majorité des sources sont institutionnelles (WHO DON/AFRO/WER, ECDC, PAHO, Africa CDC, sitreps nationaux). `237actu` appartient à une **petite minorité de sources médias**, avec `tchadinfos.com`, `africa24tv.com` et `leadership.ng`.

**Vérification de la source qu'il recommande, avant de l'endosser.** **CCOUSP est réel et institutionnel** : Centre de Coordination des Opérations d'Urgence de Santé Publique, créé par décret du Premier ministre camerounais du **12 mai 2020**, rattaché au ministère de la Santé publique, compétent sur choléra, rougeole, méningite et mpox. ⚠️ **`ccousp.cm` renvoie HTTP 403 aux outils automatisés** : la faisabilité d'un branchement automatique n'est donc **pas acquise**, et c'est exactement la question posée dans le brouillon de réponse plutôt que de promettre un correctif.

**Ce que ça révèle au-delà du Cameroun (3 points, par ordre de gravité) :**

1. **La rondeur de « 1 000 cas » est un indice de provenance en soi.** Aucun sitrep n'arrête un cumul sur un compte rond ; un titre de presse, si. La valeur est très probablement un arrondi journalistique, pas un décompte. Un contrôle automatique repérant les cumuls suspicieusement ronds sur les lignes issues de sources médias serait peu coûteux.
2. **La ligne est à `source_priority` 10, donc plus aucun cron ne la rafraîchit** (les crons se plafonnent à `.lte("source_priority", 5)`). Elle est figée au **10/08** depuis le 15/08. Elle fait partie des **27 lignes actives à 10** identifiées le 19/08, et elle en est aujourd'hui **le cas le mieux documenté**, parce qu'un tiers extérieur compétent l'a repéré sans qu'on lui demande. Voir `product-ideas-log.md`, entrée du 19/08, idées 1 et 2.
3. **Le niveau de source n'est pas visible côté utilisateur.** Un lecteur ne peut pas distinguer une ligne adossée à un sitrep OMS d'une ligne adossée à un article de presse : les deux s'affichent identiquement. C'est précisément l'argument que HWG développe en public depuis des semaines sur les dates d'arrêt, appliqué cette fois à HWG lui-même. **Une pastille de niveau de source, ou au minimum un tri par qualité de provenance, transformerait un défaut en argument de vente.**

**Actions à prendre (aucune faite par la session, §8 : une routine sociale signale, elle n'écrit pas) :**

- [ ] **Rafraîchir la ligne Choléra Cameroun** depuis le SitRep 15 reçu en pièce jointe (à ouvrir en session interactive) ou depuis CCOUSP. ⚠️ Comparer les **dates d'arrêt**, pas les dates de publication, et ne pas laisser régresser le cumul.
- [ ] **Évaluer si CCOUSP est interrogeable automatiquement** malgré le 403 (flux RSS, page de publications, User-Agent).
- [ ] **Rejouer le même audit sur les 3 autres lignes actives à source média** (`tchadinfos.com`, `africa24tv.com`, `leadership.ng`) : le défaut n'a aucune raison d'être limité au Cameroun.
- [ ] **Idée produit** : exposer le niveau de source dans l'interface (institutionnel / national / presse).

🔒 **Réponse rédigée et en attente de validation de David** (EN, **CTA volontairement omis** : le lien et l'essai ont déjà été envoyés dans ce même fil le 16/08, et il a de toute façon déjà utilisé la plateforme). Texte intégral et double-check dans `linkedin-contacts.md`, entrée du 20/08 (17h), section 2️⃣.

⚠️ **Aucune citation publique ni attribution nominative sans son consentement écrit explicite** (règle absolue de `CLAUDE.md`). L'histoire ferait un excellent post de marque ; elle ne peut pas être racontée avec son nom tant qu'il n'a pas dit oui.

---

## 12 août 2026 — Johan Verheyden (African Intelligence / Aries Consult) — 🐞 BUG DE CONNEXION, partenaire Pro bloqué

**Contexte :** compte Pro provisionné à la main le 11/08 (`jverheyden@ariesconsult.eu`, échange en nature, 1 an). **Aucun email Brevo n'a été envoyé volontairement**, parce que le mail de bienvenue standard de `admin/invite` est cadré « accès pilote 35 jours » et aurait contredit le message LinkedIn. David lui a donc indiqué en DM : « *tu te connectes sur healthwatch-global.com/fr/login avec cette adresse, par lien magique ou par code, il n'y a pas de mot de passe à retenir.* »

**Ce qu'il a envoyé (11/08 23:06, pièce jointe sans texte)** : une capture de la page de connexion, son adresse pré-remplie, le champ **« Mot de passe » vide** avec l'infobulle navigateur « Fill out this field », et le bouton « Se connecter ». **Il est bloqué au login.**

**Cause, vérifiée dans le code (pas supposée) :**
- `app/[locale]/login/page.tsx` propose **par défaut email + mot de passe** (`supabase.auth.signInWithPassword`, ligne 92).
- Le mode OTP existe mais **derrière un bouton de bascule** (ligne 281) et attend un **code à 6 chiffres** ; ce code est celui que Supabase renvoie **à côté du magic link** généré par l'invitation admin (commentaire lignes 67-72).
- **Aucun email n'ayant été envoyé, il n'a jamais reçu ni lien ni code.** L'instruction donnée en DM était donc fausse *dans son cas précis*.
- Le seul chemin réellement fonctionnel : `/[locale]/forgot-password` → `POST /api/auth/reset-password` (envoi Brevo, pas le mailer Supabase) → définition d'un mot de passe.

**Le problème générique, au-delà de Johan :** tout compte provisionné à la main sans email de bienvenue atterrit sur un écran qui **exige un mot de passe qui n'existe pas**, sans aucun message expliquant quoi faire. Un partenaire le signale ; un utilisateur ordinaire ferme l'onglet sans rien dire. **Le coût est invisible dans les métriques** (ça ne produit ni `login_attempt` en échec exploitable, ni signal côté produit).

**Pistes de correction, par ordre de coût :**
1. Rendre la bascule OTP visible et explicite sur l'écran de login (« Pas de mot de passe ? Recevoir un code »), plutôt qu'un lien secondaire.
2. Faire du script de provisionnement manuel un envoi d'email dédié (gabarit distinct du « pilote 35 jours »), pour que tout compte créé arrive avec un chemin d'entrée.
3. À défaut, documenter la procédure « Mot de passe oublié » dans le message d'accompagnement, ce que fait le brouillon du 12/08.

**⚡ MISE À JOUR (12/08, 10h40-12h00) — le chemin de secours (« Mot de passe oublié ») a aussi échoué, 2e bug distinct.**

Johan a réessayé le flux `/forgot-password` recommandé plus haut : « *le lien est expiré des que je clique - tu peux pas définir le mot de passe (comme moi je le fais)?* » (10:40, 8 min après l'instruction, donc pas une expiration normale du délai annoncé de 1 h).

**Diagnostic (déduit du code, pas confirmé par un log serveur — piste la plus probable, pas certaine)** : `app/api/auth/reset-password/route.ts` envoie par Brevo un lien qui est **l'URL Supabase brute et à usage unique** retournée par `admin.auth.admin.generateLink()` (`lib/reset-password-email.ts:79`, `<a href="${actionLink}">`). C'est le symptôme classique d'un scanner de sécurité d'entreprise (Outlook Safe Links, Proofpoint, etc.) qui visite automatiquement tous les liens d'un email pour les scanner **avant** que le destinataire ne clique réellement, ce qui consomme le jeton à usage unique et transforme le clic réel de l'utilisateur en « lien expiré ». Domaine de Johan : `ariesconsult.eu`, entreprise de conseil, profil compatible avec une infra email d'entreprise scannée.

**Contournement immédiat, exécuté sur instruction explicite de David** : `scripts/set-temp-password-johan-verheyden-2026-08-12.mjs` définit un mot de passe temporaire directement via `admin.auth.admin.updateUserById()`, contournant tout envoi de lien. Transmis à Johan par DM LinkedIn (voir `linkedin-contacts.md`, DM 3/6, mise à jour 12h00).

**Piste de correction supplémentaire, plus structurelle que les 3 ci-dessus** : ne jamais exposer directement l'`action_link` de Supabase dans un email transactionnel. Router le lien emailé vers une page du domaine `healthwatch-global.com` qui affiche un bouton « Confirmer » cliqué manuellement par l'utilisateur, et ne déclenche l'appel à Supabase (`generateLink`/`verifyOtp`) qu'à ce moment-là — pas au premier chargement de page. Ça neutralise le pré-scan automatique des liens, qui ne déclenche que le chargement de la page, jamais l'action de clic elle-même.

**Statut :** DM du 12/08 matin (bug initial) et sa relance (2e bug + contournement) envoyés, validés par David en session interactive. **Aucun correctif code appliqué sur le flux de reset lui-même** — seul le contournement ponctuel (mot de passe temporaire pour ce compte précis) a été exécuté.

**⚡ Piste 1 appliquée le 12/08 (19h40, session interactive, suite à l'audit routines du soir)** : ligne d'aide ajoutée sous le champ mot de passe de `/[locale]/login`, dans les 5 langues (« Compte créé sans mot de passe ? Utilisez « Mot de passe oublié » pour en définir un. »), pointant vers le flux `/forgot-password` qui fonctionne indépendamment de tout email d'invitation. Commit `b325b62`, poussé, déploiement Vercel vérifié `Ready` (alias `healthwatch-global.com` re-pointé), texte confirmé en ligne par `curl`. Ne couvre pas le cas générique complet (un utilisateur ordinaire sans capture d'écran DM comme Johan ne saura toujours pas *pourquoi* il n'a pas de mot de passe), mais donne une sortie visible à quiconque atterrit sur cet écran sans mot de passe. **Pistes 2 (email de bienvenue dédié pour le provisionnement manuel) et le point structurel (ne plus exposer l'`action_link` Supabase brut) restent ouvertes**, plus coûteuses (nouveau gabarit Brevo / nouvelle route de confirmation), à planifier séparément.

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

**✅ Étape 1 FAITE (20/07/2026, commit f13818d) — colonne `is_backfill` ajoutée et peuplée.**
Audité (via 13 agents Explore en parallèle) les 13 crons `sync-*` qui insèrent réellement dans `outbreaks` (2 autres — `sync-drc-sitrep`, `sync-endemic-data` — ne font que des `.update()` sur des lignes existantes, hors périmètre ; `sync-signals` ne touche pas `outbreaks`). Résultat :
- **12 crons confirmés LIVE** (chacun s'auto-limite déjà à une fenêtre de fraîcheur, 30-120 jours selon la source, via un filtre `MAX_AGE_DAYS` propre au flux) → `is_backfill: false` codé en dur à l'insertion.
- **sync-usda-aphis** : source = tableau croisé cumulatif par nature ("every premises ever confirmed since 2024, not a currently-active list", commenté dans le fichier) → `is_backfill: true` codé en dur.
- **sync-who-regional** : point d'insertion unique mais réellement mixte, réutilise la variable déjà en place `isAnnualRef` (vrai pour les 6 indicateurs GHO annuels — malaria/measles/polio/yellow-fever/leishmaniasis/diphtheria — dont la date est toujours `YYYY-01-01`, faux pour les flux Dengue/Mpox/Choléra/Méningite réellement courants) → `is_backfill: isAnnualRef`.

Migration `20260720120000_add_outbreaks_is_backfill.sql` : colonne `NOT NULL DEFAULT FALSE` + rétro-backfill des lignes existantes matchant les mêmes critères. Découverte en testant : les lignes GHO annuelles existantes n'avaient PAS `is_seed=true` de façon fiable (60/91 à `is_seed=false` sur dev) — `is_backfill` ne peut donc pas être déduit après coup de `is_seed`, d'où l'intérêt réel de la nouvelle colonne. Appliqué et vérifié sur dev (111 lignes `is_backfill=true` : 20 USDA + 91 GHO) et sur la vraie prod (52 lignes : 20 USDA + 32 GHO, écart normal entre environnements). Typecheck + lint propres.

**Prochaine étape (2) :** refaire le calcul de délai de reporting en excluant `is_seed=true` OU `is_backfill=true`, restreint aux lignes jamais mises à jour depuis l'insertion (`created_at ≈ updated_at`), et re-tester contre données réelles (dev puis prod) avant tout affichage — voir méthodologie complète dans la mémoire Claude `project_reporting_lag_feature_incremental_build_2026_07_20`. Rien à afficher sur le site tant que cette étape 2 n'est pas faite et re-vérifiée.

---

## 2026-07-22 — Angle mort de couverture signalé par une contact OMS Tchad : choléra/Tchad absent du site (CORRIGÉ le jour même)

**Source du feedback :** Oumaima Mahamat Djarma (infectiologue/épidémiologiste, OMS bureau Tchad, N'Djamena), en DM LinkedIn le 21/07 à 17:31, dans le fil ouvert par la routine `linkedin-hwg-monitoring` :
> « Pour les remontées des données il ya un canal de reporting standardisé j ai impeu visité le site de healthwatch global aujourd'hui peut etre je n ai pas fait attention mais je n ai pas vue l épidémie de choléra actuel au Tchad »

**Elle avait raison.** Première fois qu'un contact terrain teste réellement la couverture du produit sur son propre pays et remonte un trou. Feedback de très haute valeur : ce n'est pas une idée de fonctionnalité, c'est une vérification externe de l'exactitude des données.

**Diagnostic.** La ligne `Choléra / Tchad` (`06541c4a-6b67-4c2c-a44e-818ba7621d76`) existait mais était `active=false`, figée sur les chiffres du WHO DON579 du 29/08/2025 (776 cas / 53 décès). Elle avait été désactivée le 17/07 (cf. `project_cholera_don579_stale_rows_fixed_2026_07_17`) parce que le Tchad ne figure pas dans la Table 1 du WHO Multi-country Cholera Epidemiological Update #38 (30/06/2026, données au 31/05/2026), donc aucun chiffre récent n'était disponible côté OMS. Cause structurelle : le Tchad n'est pas dans la map `CHOLERA_ISO3` de `sync-who-regional`, donc **aucun cron ne l'alimente** ; la ligne ne pouvait pas se corriger toute seule.

**Ce que ça révèle sur le produit :** quand l'OMS cesse de lister un pays dans son bulletin multi-pays, HWG conclut « plus de données » et désactive, alors que l'épidémie est bien en cours et suivie quotidiennement au niveau national (réunions COUSP). Le produit est aveugle aux foyers suivis uniquement par les autorités nationales quand ils sortent du radar des agrégateurs régionaux. C'est exactement le décalage que les contacts terrain décrivent depuis plusieurs semaines dans les DM, mesuré ici sur un cas réel.

**Correction appliquée le 22/07** (script `scripts/fix-cholera-chad-2026-07-22.mjs`, prod `.env.local.live`) :
| champ | avant | après |
|---|---|---|
| cases | 776 | **129** |
| deaths | 53 | **4** |
| date | 2025-08-29 | **2026-07-01** |
| active | false | **true** |
| risk_level | high | medium |
| verification_status | suspected | confirmed |
| response_phase | monitoring | active_response |
| source_priority | 3 | 10 (verrou justifié : aucun cron n'alimente le Tchad) |
| is_seed | true | false |
| source | WHO DON579 (2025) | Tchadinfos 02/07/2026 (relais ministère/COUSP) |

Source primaire retenue et vérifiée mot pour mot : point épidémiologique de la réunion quotidienne de riposte du **mercredi 1er juillet 2026**, présidée par la secrétaire d'État à la Santé publique et à la Prévention (Dr Mbaïdedji Dekandji Francine), COUSP présenté par Ali Abdraman Abdoulaye : **9 nouveaux cas, cumul 129 cas, 4 décès (2 communautaires, 2 hospitaliers), létalité 3,10 %**, district sanitaire de Karal, province du Hadjer-Lamis. Épidémie confirmée en juin 2026 après détection de *Vibrio cholerae* O1 sérotype Ogawa (16 cas / 1 décès au 16/06). Aucun bilan plus récent publié à la date du 22/07 (vérifié sur l'ensemble des articles choléra 2026 du média).
https://tchadinfos.com/2026/07/02/cholera-dans-le-district-sanitaire-de-karal-129-cas-et-4-deces-les-autorites-renforcent-la-riposte/

**Vérifié bout en bout** : la page publique `/fr/disease/cholera` affiche désormais « Tchad 129 cas · 4 décès · 1 juil. 2026 (21j) RISQUE MODÉRÉ » en tête des foyers en cours. Champs `description_fr/es/ar/id` remis à `null` pour re-traduction (ils contenaient encore le texte générique du DON579, sans rapport avec la description anglaise).

**⚠️ Gap de couverture découvert au passage, NON traité (décision de scope à prendre par David) :** la **République centrafricaine n'a aucune ligne choléra en base** alors qu'une épidémie y a été officiellement déclarée fin juin 2026 dans les districts de Bimbo et Mbaïki (197 cas / 24 décès notifiés au 28/06/2026, via Tchadinfos citant les autorités centrafricaines). La RCA est pourtant DANS la map `CHOLERA_ISO3` de `sync-who-regional`, donc c'est potentiellement un bug de fetcher et pas seulement un trou de couverture. À investiguer séparément.

**Piste produit de fond :** ajouter Tchad, Congo, RDC, Soudan du Sud et Soudan (les 5 pays du lot verrouillé à prio 10) à un flux d'alimentation, ou accepter que ces lignes soient maintenues à la main et prévoir une alerte de fraîcheur dédiée. Aujourd'hui elles ne vieillissent sous l'œil de personne.

---

## 2026-07-22 — Ebola/RDC affichait 4 jours et 139 décès de retard (CORRIGÉ), effet de bord du fix « phantom Congo » du 21/07

**Déclencheur** : post LinkedIn du **Dr Jean Kaseya, DG d'Africa CDC** (21/07, Extraordinary Summit on Health) : « we have now recorded 900 deaths. Sixty-five days into this outbreak, we already have more than 2,400 confirmed cases ». Ces chiffres étaient nettement au-dessus de ce que HWG affichait, ce qui a déclenché une vérification (politique sociale HWG §8).

**Écart constaté** : ligne `Maladie à virus Ebola / RD Congo` (`bd1c3a46-…`) à **2 124 cas / 828 décès / 390 guéris, date 2026-07-15**, `updated_at` figé au 17/07 21:38. Or la page ECDC de l'épidémie (mise à jour le **21 juillet à 17:00**) donne pour la RDC au **19 juillet 2026** : **2 423 cas confirmés, 967 décès, 469 guéris, 734 hospitalisés en isolement**. Soit **299 cas et 139 décès manquants** sur le foyer phare du produit.

**Cause racine identifiée** : ce n'est ni une session concurrente ni une nouvelle régression de code. Le dernier run de `sync-ecdc-threats` date du **21/07 à 09:01:31 UTC** (vérifié dans `site_config`), soit **avant le déploiement du fix de matcher `95e2db0`** (Ready ~10h00 UTC, cf. `project_ebola_congo_roc_phantom_substring_fixed_2026_07_21`). À ce run, le matcher encore buggé a donc envoyé les chiffres ECDC du 18/07 (2 344/930) sur la **ligne fantôme Congo/RoC** au lieu de la vraie ligne RDC. La ligne fantôme a bien été re-désactivée dans la foulée, mais **personne n'a rattrapé la vraie ligne RDC, restée figée**. Le cron n'a pas tourné depuis, donc l'écart a persisté 4 jours. Le fix de code est correct : le prochain run alimentera la bonne ligne. C'est le rattrapage de l'écart accumulé qui manquait.

**Correction appliquée** (`scripts/fix-ebola-drc-2026-07-22.mjs`, prod) : `cases 2124 → 2423`, `deaths 828 → 967`, `recovered 390 → 469`, `date 2026-07-15 → 2026-07-19`, source basculée du WHO DON613 vers la page ECDC, description réécrite, traductions remises à `null`. **`source_priority` laissé à 5, PAS remonté à 10** : conforme à l'arbitrage explicite de David du 16/07 (`project_ebola_drc_priority10_frozen_no_autofeed_2026_07_16`, « ne pas re-verrouiller à 10 pour protéger : à 10 la ligne ne s'alimente plus du tout, c'est pire »). Le script embarque une garde anti-régression refusant d'écrire des chiffres inférieurs à ceux en base. Écriture confirmée par `.select()` (1 ligne affectée, donc non bloquée par la garde de priorité).

**Vérifié bout en bout** : `/fr/disease/ebola` affiche désormais « RD Congo 2 423 cas · 967 décès · 19 juil. 2026 (3j) RISQUE ÉLEVÉ ».

**⚠️ Leçon générale, à retenir pour les prochains fix de crons** : corriger le code d'un cron ne rattrape pas les données déjà mal écrites entre le bug et le déploiement. Après un fix de matcher/parseur, il faut **explicitement re-vérifier les lignes que le cron aurait dû alimenter pendant la fenêtre de bug**, et pas seulement constater que la ligne fautive a disparu. Ici la ligne fantôme avait bien été neutralisée, ce qui donnait l'impression que l'incident était clos.

**⚠️ Résidu d'affichage non corrigé** : la ligne fantôme `Congo` (2 344 cas, inactive, prio 0) continue d'apparaître dans la section « Historique des épidémies » de `/fr/disease/ebola` et dans « Pays touchés », alors qu'elle ne correspond à aucun foyer réel en République du Congo. La mémoire dit de ne pas la re-signaler comme écart tant qu'elle reste inactive, mais l'historique et la liste des pays sont une surface différente de la carte des foyers actifs. **Décision de suppression laissée à David** (précédent de suppression pure existant : le doublon « Democratic Republic of Congo » du 17/07).

---

## 29 juillet 2026 — Hao-Kai TSENG (Epidemic Intelligence Center, Taiwan CDC)

**Contexte :** welcome DM échangé le 29/07 (voir linkedin-contacts.md pour l'historique complet). Hao-Kai fait de la veille épidémique internationale au Taiwan CDC ; Taïwan n'étant pas État membre de l'OMS, son équipe ne peut pas s'appuyer sur les canaux WHO/ECDC/PAHO/Africa CDC que HWG agrège et compense par une veille manuelle sur des plateformes spécialisées.

**Retour — trois sources tierces citées comme consultées quotidiennement par une équipe de surveillance professionnelle**
> « The source of our information comes mostly from the big institution that you said, along with neighboring countries' national websites or media sources. Beacon, cidrap, outbreak news today, and many bio surveillance platform are also frequently visited on a daily basis. »

Trois candidats nommés explicitement, à évaluer comme sources additionnelles potentielles pour HWG :
1. **Beacon** — plateforme de bio-surveillance (nom générique, à identifier précisément : plusieurs outils portent ce nom, vérifier lequel avant toute intégration).
2. **CIDRAP** (Center for Infectious Disease Research and Policy, University of Minnesota) — site d'actualité épidémiologique reconnu, distinct de ProMED (aucune restriction connue à ce jour, à vérifier ToS avant tout usage automatisé, cf. `feedback_check_tos_before_scraping_bot_protected_sources`).
3. **Outbreak News Today** — site d'actualité spécialisé foyers épidémiques, distinct de ProMED également.

**Statut :** reçu, non évalué techniquement. Aucune vérification ToS/faisabilité de fetcher effectuée. Piste de sources à évaluer, pas une demande de fonctionnalité produit au sens strict — plutôt un signal sur les angles morts géographiques de HWG (pas de membre OMS = pas de couverture par les 4 bulletins actuels).

---

## 3 août 2026 — Omobolanle (Esther) Adelekun (Public Health Specialist & Epidemiologist | Disease Surveillance • Outbreak Response, OMS)

**Contexte :** commentaire HWG posté le 03/08 sur son post « Outbreak Systems Intelligence: Why Case Definitions Matter », invitation envoyée le même jour et acceptée dans l'heure. Premier message reçu à 11:33, verbatim intégral en cf. linkedin-contacts.md.

**Retour — idée d'outil versionnant les données de surveillance avec les métadonnées de définition de cas**
> « I've started wondering whether there's an opportunity to build a tool that links surveillance data with case definition versions and other metadata to make outbreak trends easier to interpret. »

**Faisabilité évaluée le jour même, sur demande de David** : vérification du code (`lib/outbreaks.ts`, aucun champ de version de définition de cas dans le schéma `Outbreak` ; crons de sync — parsing déterministe/regex, pas d'extraction sémantique LLM) et requête directe sur la prod Supabase live (`tqznwmpkokdzrszysbcm`) : 6 lignes mises à jour + 3 nouvelles lignes/24h sur 114 foyers actifs.

**Conclusion** : l'outil versionné complet qu'elle décrit **n'est pas constructible en système général** — les sources (OMS DON, ECDC, Africa CDC, sitreps nationaux) ne publient quasiment jamais cette métadonnée de façon structurée, il n'y a donc rien à lier la plupart du temps. **Piste réduite jugée réaliste** : un flag manuel booléen (« ce bulletin annonce-t-il explicitement un changement de définition de cas ? »), même patron que les colonnes `is_pheic`/`is_backfill` déjà en place, vérifié à même la relecture quotidienne déjà faite par `morning-don-check` (volume compatible, ~9 lignes touchées/jour). Limites explicites : ne recrée pas l'historique des lignes déjà en base, rate tout changement que la source ne déclare pas noir sur blanc.

**Statut :** idée présentée à Omobolanle dans la réponse envoyée le 03/08 (voir linkedin-contacts.md, DM 4), avec l'invitation à échanger davantage. **Non implémentée côté développement** — décision de priorisation laissée à David.

---

## 7 août 2026 (document lu le 08/08) — Andrea Bernasconi (Senior Medical Epidemiologist, Public Health Specialist)

**Contexte :** welcome DM échangé le 07/08 (voir linkedin-contacts.md pour l'historique complet). Répondant à la question de David sur ce que la surveillance de routine voit de la confiance communautaire, Andrea a identifié un manque et joint un document, `comm engagment indicators.docx` (17 Ko), proposant de le formaliser en article de recherche via une méthode Delphi.

**Retour — proposition de 18 indicateurs indirects de confiance communautaire, répartis en 10 domaines**
Verbatim d'introduction du document : « *This is actually an underdeveloped research area. Trust itself is difficult to measure, but surveillance-sensitive proxy indicators could provide an early signal that community engagement is weakening. Here are some ideas.* »

| Domaine | Indicateurs proposés |
|---|---|
| Recours aux soins | Délai médian symptômes → 1er contact soignant ; part des cas détectés par signalement communautaire vs auto-présentation |
| Détection des cas | % de cas déjà décédés à la notification ; % de cas sévères à la présentation |
| Contact tracing | % de contacts listés ; % suivis 21 jours ; délai confirmation → listage |
| Vaccination | Taux d'acceptation de la vaccination en anneau ; taux de refus |
| Enterrements sécurisés | % de décès avec enterrement sécurisé et digne ; nombre d'enterrements communautaires hors surveillance |
| Laboratoire | % de cas suspects acceptant le test diagnostique |
| Signalement communautaire | Nombre d'alertes / 10 000 hab. ; % d'alertes confirmées après investigation |
| Rumeurs/désinformation | Nombre de rumeurs vérifiées/semaine ; indice de désinformation sur réseaux sociaux |
| Services de santé | Fréquentation des services de santé de routine pendant les épidémies |
| Participation communautaire | Présence aux réunions d'engagement ; nombre d'agents de santé communautaires actifs |

**Faisabilité côté HWG, à évaluer** : aucun de ces 18 indicateurs n'est publié de façon structurée par les sources agrégées (WHO DON/AFRO/EMRO, ECDC, Africa CDC, PAHO, sitreps nationaux) — ce sont des données de terrain (ring vaccination, contact tracing, rumeurs) qui n'apparaissent quasiment jamais dans un bulletin public. Contrairement au retour d'Omobolanle Adelekun (03/08, ci-dessus), il ne s'agit pas d'un flag à extraire d'un texte de bulletin existant : la quasi-totalité de ces indicateurs supposerait une source de données que HWG n'a pas et que le modèle d'agrégation de bulletins publics ne peut pas obtenir. Piste de recherche/plaidoyer plus que fonctionnalité produit à court terme.

**Statut :** document téléchargé et lu le 08/08 (pièce jointe LinkedIn, bloquée par Chrome sous extension `.tmp`, renommée pour lecture). **Non évalué techniquement au-delà de ce constat de faisabilité générale.** **Décision prise par David le 08/08 (session interactive) : coécriture déclinée** (message envoyé, voir linkedin-contacts.md), **coordonnées personnelles non échangées en retour, neutralité politique sur le point USAID/CDC soulevé dans le même fil**. La piste des 18 indicateurs reste valable comme signal produit/recherche pour référence future, indépendamment de la décision sur la coécriture.

---

## 22 août 2026 — Mohamed Ousmane COULIBALY (Incident Manager, OMS — ex-Polio Incident Manager 2020-2023)

**Contexte :** DM envoyé le 20/08, réponse reçue le 22/08 à 13:30 pendant la routine `linkedin-hwg-followup-check-2`. Une pièce jointe (mise à jour polio mondiale du GPEI arrêtée au 19/08) et une seule phrase.

**Retour — verbatim intégral**
> « Avez-vous parcouru cet Update ci-attaché ??? »

**Ce n'est pas une demande de fonctionnalité, c'est un test de couverture — et le produit l'a raté.** Pièce jointe non ouverte (autorisation requise, David absent) ; la version publique de la même mise à jour a été lue à la place sur `polioeradication.org`. Constat, vérifié en base live le soir même : **3 lignes polio actives** (Afghanistan, Pakistan, Palestine), **aucune ligne africaine**, alors que la page GPEI listait cette semaine-là la RDC (5 cas de cVDPV2, 32 depuis janvier), le Nigeria, le Niger, la Centrafrique et le Soudan. La ligne Afghanistan **cite cette page exacte dans sa colonne `source`**.

**Nature du défaut :** ni un trou de sourcing, ni une donnée périmée — un trou de **couverture**. La source était lue et citée ; seuls deux pays en étaient extraits. Un utilisateur ne pouvait pas le voir : la carte affichait « trois foyers de polio dans le monde » avec l'aplomb d'un fait, alors que c'était l'état d'un filtre.

**Suites (22/08) :** 13 lignes polio africaines créées en prod sur validation explicite de David (`scripts/add-cvdpv-africa-gpei-2026-08-22.mjs`). Cause traitée le même soir par `daily-product-ideas-healthwatch` — sonde de couverture GPEI ajoutée à `data-quality` (section 4j), voir `product-ideas-log.md`, entrée du 22/08 idée 1.

**Signal transversal, au-delà de la polio :** c'est le **deuxième cas en 24 h** d'une source correctement intégrée dont une partie du contenu n'est jamais extraite (l'autre : `sync-spf` et le bulletin vectoriel hebdomadaire, voir `product-ideas-log.md` du 21/08). Aucun contrôle du produit ne regardait, jusqu'à ce soir, ce qu'une source publie et que la base ne contient pas — tous les contrôles portent sur les lignes qui existent.

