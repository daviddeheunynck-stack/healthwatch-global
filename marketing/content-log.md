# Content Log â€” HealthWatch Global

Archive de tout le contenu crÃ©Ã©. Mise Ã  jour Ã  chaque session.

---

## X / Twitter

### Thread MWF — 15 juillet 2026 (mercredi) — Ebola RDC, dérive du CFR brut — **PUBLIÉ ✅**

**Publié le 15/07 à 11h53** sur demande explicite de David (« publie le thread toi même sur X »), avec confirmation préalable après rappel de la règle habituelle (contenu de marque = publication manuelle par David, voir [[feedback_no_self_publishing]]). Exception ponctuelle, pas un changement de règle durable.

**Fil racine :** https://x.com/HWatchGlobal/status/2077330781203022047 (4 tweets liés, chacun en réponse au précédent, vérifié visuellement dans l'ordre après publication).

**Incident technique en cours de publication (rattrapé, rien publié en trop) :** lors du 1er essai (onglet 1272301415), le viewport CDP s'est effondré à 583×41 pixels après un clic sur le bouton « + » (ajout de tweet au fil) — diagnostiqué via `read_page` (le 3e champ de texte était resté vide malgré la frappe) plutôt que via screenshot (qui timeoutait). `resize_window` n'a pas corrigé le viewport ; conformément au protocole de récupération (nouvel onglet plutôt que s'acharner), un onglet neuf a été ouvert et le fil retapé intégralement depuis zéro. Aucune publication partielle n'a eu lieu sur l'onglet cassé (bouton « Tout poster » jamais cliqué dessus). Sur le nouvel onglet, un premier clic sur le champ de saisie a ouvert le modal de composition en le laissant vide (texte tapé juste après perdu dans la transition) ; détecté avant frappe suivante par `read_page`/screenshot, corrigé en cliquant à nouveau puis en attendant la stabilisation avant de taper. Chaque champ a ensuite été vérifié individuellement (texte exact + compteur de caractères) avant de passer au suivant.

**Vérification finale post-publication :** les 4 tweets confirmés dans l'ordre sur https://x.com/HWatchGlobal (tweet 1 à 11h53, les 3 suivants à 1 min d'intervalle), texte identique au brouillon vérifié, carte de lien `healthwatch-global.com` affichée correctement sur le tweet 4 (titre et description du site chargés, donc lien fonctionnel).

---

> **🔄 MIS À JOUR le 15/07 à 10h50 (session x-hwg-monitoring, à la demande de David) : chiffres rebasés sur le sitrep officiel du 13/07 (2 011 / 754 / CFR 37,5 %).** La version précédente s'appuyait sur l'ECDC au 12/07 (1 963 / 719 / CFR 36,6 %), périmée de deux jours au moment de publier. **L'angle est inchangé et sort renforcé** : la série de dérive du CFR se prolonge (30,9 % → 37,5 %) au lieu de se casser. Ancienne version conservée en fin de section pour trace.

**Étape 0 :** le brouillon Ebola 3 pays du 13/07 (encore non publié, plus bas dans ce log) est **OBSOLÈTE** : il annonce RDC 1 460/452 et un CFR de 31 %, chiffres périmés (réalité au 13/07 : 2 011/754, CFR 37,5 %). Publier tel quel sortirait un chiffre faux. Remplacé par le thread ci-dessous, qui recycle l'angle CFR en le retournant : ce n'est plus l'écart RDC/Ouganda, c'est la dérive du CFR de la RDC dans le temps.

**Sujet choisi :** le CFR brut de la flambée RDC est passé de 30,9 % à 37,5 % en 12 jours. Angle décideurs : ce n'est pas le virus qui change, c'est un ratio à numérateur retardé, et il monte encore. Implication capacité de prise en charge. Angle jamais couvert (les posts Ebola précédents portaient sur le gap vaccinal Ervebo, 24/06, et sur la répartition géographique, brouillon 13/07 obsolète).

**Sources primaires (vérifiées mot pour mot en session, 15/07) :**
- **Point de situation officiel RDC du 13 juillet 2026** (INSP/Ministère de la Santé), publié par le compte officiel vérifié @Com_mediasRDC et lu mot pour mot : « À ce jour, 2 011 cas confirmés ont été enregistrés, dont 753 patients en isolement ou hospitalisation, 366 personnes guéries et 754 décès. Le taux de létalité est de 37,5 %, tandis que le suivi des contacts atteint 67,4 %. » **CFR 37,5 % asserté par le sitrep lui-même, non recalculé par nous.** Recoupé indépendamment par AP et CGTN. https://x.com/Com_mediasRDC/status/2077173470299869581 — c'est désormais la source de la ligne DB prod active (`date: 2026-07-13`, mise à jour en session, voir plus bas).
- **WHO DON612** (publié 03/07) : « 1460 confirmed cases including 452 deaths (crude case fatality ratio [CFR] 30.9%) », données au 1er juillet. CFR 30,9 % asserté par l'OMS elle-même, non recalculé par nous.
- **WHO DON612** pour les références historiques : « CFRs in the past two BVD outbreaks, reported in Uganda and in the Democratic Republic of the Congo in 2007 and 2012 were 30% and 50%, respectively. »
- **ECDC** (page « Ebola outbreak DRC and Uganda », maj 14/07 13:55) : encore à « 1 963 confirmed cases, including 719 related deaths (from data up until 12 July) ». **Retardataire sur le sitrep national**, d'où le rebasage. Écart structurel sitrep national vs cycle ECDC/WHO DON, déjà documenté, pas un bug.
- Arithmétique revérifiée en session : 452/1460 = 30,96 % ; 754/2011 = 37,49 % (conforme au 37,5 % annoncé) ; deltas **+551 cas / +302 décès sur 12 jours** (1er → 13 juillet) ; 302/551 = 54,81 %.

**Note :** le chiffre 1 963/719, rejeté le 14/07 faute de source primaire puis publié par l'ECDC le 15/07, est **déjà dépassé** à son tour. Illustration nette du rythme : sur cette flambée, tout chiffre non revérifié le jour même de la publication est un risque.

**X (EN) — thread 4 tweets** (passé de 3 à 4 le 15/07 à la demande de David, voir tweet 4 et son double-check)

1/
> DR Congo's Ebola outbreak (Bundibugyo) is at 2,011 confirmed cases and 754 deaths as of 13 July, a crude CFR of 37.5% (DRC situation report). On 1 July, WHO's DON612 reported 1,460 cases and 452 deaths: CFR 30.9%. Over six points higher in 12 days, same strain, same outbreak.

2/
> That climb isn't the virus changing. Crude CFR in a live outbreak is a lagging ratio: today's deaths were counted as cases weeks ago. Across those 12 days, cases rose by 551 and deaths by 302. Deaths added equalled 55% of cases added, well above the cumulative 37.5%.

3/
> For planning, today's CFR isn't the number that matters; where it settles is. WHO's reference points for Bundibugyo: 30% (Uganda, 2007), 50% (DRC, 2012). At 37.5% mid-outbreak and still rising, sizing capacity to the 31% figure understates the load.

4/
> One caveat on the denominator. Contact follow-up was 67.4% on 13 July, and in Bunia, the epicentre, WHO puts roughly 80% of confirmed cases outside contact lists. The numerator lags and the denominator is incomplete, so 37.5% rests on partial detection. healthwatch-global.com

**Double-check (refait intégralement après rebasage, puis après ajout du tweet 4, puis re-vérifié avec les règles de comptage réelles de X) :** longueurs brutes 276 / 267 / 249 / 276 caractères, toutes sous 280. **Correction du comptage tweet 4 :** X ne compte pas la longueur littérale d'une URL mais la remplace par un lien t.co à longueur fixe de 23 caractères — `healthwatch-global.com` fait 22 caractères réels mais compte pour 23 sur X, donc le tweet 4 est en réalité à **277 caractères sur X**, pas 276. Toujours sous la limite de 280, mais avec seulement **3 caractères de marge** : ne rien y ajouter, même un seul mot, sans revalider. Les tweets 1-3 n'ont pas de lien, leur compte brut = leur compte X. Vérifié aussi : aucun caractère non-ASCII (apostrophes/guillemets courbes, tirets, emoji) dans les 4 tweets, donc pas de comptage à poids double ailleurs que sur l'URL. Chaque chiffre confronté à sa source primaire ci-dessus, aucun repris d'un post tiers ni d'une mémoire ancienne. Pas de tiret cadratin, 0 hashtag, **lien unique déplacé du tweet 3 vers le tweet 4** (convention : lien en fin de thread), pas de CTA appuyé. Pas de ProMED. Pas de faux témoignage. Pas de contradiction interne (le 30,9 % du tweet 1 et le « 31% figure » du tweet 3 désignent le même chiffre, arrondi assumé).

**Double-check spécifique du tweet 4 (suivi des contacts) :**
- **Faits.** 67,4 % au 13/07 = sitrep officiel lu en session. Le « roughly 80% of confirmed cases outside contact lists » est **attribué à l'OMS et localisé à Bunia**, conformément à la correction du 12/07 qui interdit de le présenter comme un chiffre national (source : Chikwe Ihekweazu à Reuters, revérifié le 12/07 sur CIDRAP/Newsweek ; l'OMS a redit le point le 15/07 via CGTN, sans localisation explicite — j'ai gardé la version localisée, plus prudente).
- **Articulation avec le thread, pas répétition.** Le tweet 2 traite du **numérateur** (décès retardés), le tweet 4 traite du **dénominateur** (cas non détectés) : les deux moitiés de la même métrique, ce qui referme le thread sur son propre sujet plutôt que d'ouvrir un sujet neuf en dernière position.
- **Direction du biais volontairement NON affirmée.** J'ai écarté la formulation « 37.5% is a ceiling » : une sous-détection des cas légers pousse le CFR à la hausse, mais une sous-détection des décès communautaires (enterrements à domicile, réels en RDC) le pousse à la baisse. Le biais joue dans les deux sens ; seule l'incertitude est certaine. D'où « rests on partial detection », qui constate sans trancher.
- **Doublon avec la reply @AP de ce matin : évité par construction.** La reply @AP porte sur la **trajectoire** du traçage (81,6 % → 78,1 % → 67,4 %, ~14 points en 9 jours) et sur l'élargissement géographique. Le tweet 4 ne reprend **ni la trajectoire, ni les 5 provinces, ni les 47 jours du Sud-Kivu** : il ne garde que le **niveau** (67,4 %) comme prémisse d'un point différent (la fiabilité du dénominateur du CFR). Coupe faite au double-check, qui réglait aussi le dépassement de longueur.
- **Jargon écarté.** Variante « A CFR is only as good as case ascertainment » rejetée malgré sa concision : « case ascertainment » parle aux épidémiologistes, pas aux décideurs (ministry focal points, ops teams) que vise le positionnement HWG.

**Faux précis évité au double-check :** la formule « 6.6 points higher » a été écartée. 37,5 − 30,9 = 6,6 sur les valeurs affichées, mais l'écart réel est 37,49 − 30,96 = **6,53** ; annoncer 6,6 aurait été un précis non fondé, et 6,5 aurait contredit la soustraction que le lecteur fait de tête. « **Over six points** » est vrai des deux façons (6,53 > 6 et 6,6 > 6) et ne se contredit pas à l'écran. Même logique qu'au tweet 3, où le « 31% figure » assume son arrondi.

**Autres formulations volontairement prudentes :** « Deaths added equalled 55% of cases added » est purement descriptif (ratio d'incréments 302/551 = 54,81 %, arrondi à l'entier), jamais présenté comme un CFR de cohorte ; « still rising » reste arithmétiquement fondé (un incrément à 54,8 % au-dessus de la moyenne 37,5 % tire mécaniquement le cumul vers le haut). « jump » remplacé par « climb » : sur 12 jours et deux bornes, c'est une dérive continue, pas un saut ponctuel. **Écarté par prudence (vérifié à nouveau sur la nouvelle borne) :** l'explication classique « le CFR brut monte quand la croissance des cas ralentit » ne s'applique toujours PAS ici — la croissance a même légèrement accéléré (40 cas/j du 19/06 au 1/07 selon DON612, **45,9 cas/j du 1/07 au 13/07**).

**Angle traçage : INTÉGRÉ en tweet 4** (David a tranché le 15/07 en faveur de l'ajout, malgré le recoupement signalé avec la reply @AP ; audiences distinctes, fil AP vs compte HWG). Version resserrée pour ne garder que le niveau 67,4 % au service du point « dénominateur », voir le double-check spécifique ci-dessus. **Restent non utilisés et disponibles pour un futur contenu :** la trajectoire complète du traçage (81,6 % le 4/07 → 78,1 % le 11/07 → 67,4 % le 13/07), l'extension à une **5e province** (Haut-Uélé, aux côtés d'Ituri, Nord-Kivu, Sud-Kivu, Tshopo), et les **47 jours sans cas au Sud-Kivu** (contraste avec l'Ituri).

<details>
<summary>Version précédente du thread (ECDC au 12/07, 1 963/719, CFR 36,6 %) — périmée, conservée pour trace</summary>

1/ DR Congo's Ebola outbreak (Bundibugyo) is at 1,963 confirmed cases and 719 deaths as of 12 July, a crude CFR of 36.6% (ECDC). On 1 July, WHO's DON612 reported 1,460 cases and 452 deaths: CFR 30.9%. Six points higher in 11 days, same strain, same outbreak.

2/ That jump isn't the virus changing. Crude CFR in a live outbreak is a lagging ratio: today's deaths were counted as cases weeks ago. Across those 11 days, cases rose by 503 and deaths by 267. Deaths added equalled 53% of cases added, well above the cumulative 36.6%.

3/ For planning, today's CFR isn't the number that matters; where it settles is. WHO's reference points for Bundibugyo: 30% (Uganda, 2007), 50% (DRC, 2012). At 36.6% mid-outbreak and still rising, sizing capacity to the 31% figure understates the load. healthwatch-global.com

Longueurs mesurées à l'époque : 255 / 266 / 272 caractères.
</details>

**⚠️ Anomalie de données repérée en passant (hors périmètre de cette session, non utilisée dans le thread) :** la ligne DB Ouganda/Ebola affichait 21 cas / 3 décès (`source`: DON612, `date`: 2026-07-03) alors que le DON612 réel dit 20 cas / 2 décès. **Corrigée depuis** (ligne prod vérifiée en session le 15/07 : 20 cas / 2 décès / 16 guéris, `date: 2026-07-13`, source ECDC). Le thread n'utilise aucun chiffre Ouganda.

---

### 🟢 Donnée fraîche repérée le 16/07 — Ebola France : patient guéri, angle jamais utilisé

Pour `x-hwg-content-proposal` (à évaluer à l'Étape 1, pas présentée comme un brouillon prêt) : le seul cas Ebola importé en Europe sur cette flambée (souche Bundibugyo, médecin revenant de RDC, France) est officiellement **guéri et sorti de l'hôpital Bichat (Paris) depuis le 4 juillet 2026** — annoncé par la ministre de la Santé, confirmé par France Info/CNEWS/Euronews (2 PCR négatifs, symptômes restés légers tout du long). Jamais couvert dans le contenu de marque : les mentions passées de la France (brouillon LinkedIn du 13/07, désormais marqué obsolète plus bas) la présentaient comme un cas encore en suivi. Ligne DB prod `020b129c-d283-4a2c-a95b-3827322a77c1` mise à jour en conséquence le 16/07 (`recovered=1`, `response_phase=contained`, source France Info).

**Angle potentiel, non rédigé :** issue positive d'un cas importé européen — illustre que surveillance + isolement précoce fonctionnent, contraste utile avec le fardeau RDC (2 011 cas/754 décès) déjà couvert deux fois cette semaine. À vérifier/creuser si retenu (durée exacte d'hospitalisation, éléments cliniques additionnels) avant rédaction — rien de prêt à publier ici, juste le signal.

---

### Veille x-hwg-monitoring — 2026-07-15 (autonomie normale reprise, mode essai 14/07 expiré)

**Reply n°1 POSTÉE ✅ — @ALIMA_ORG (essai clinique EBO-PEP)**

Cible : https://x.com/ALIMA_ORG/status/2076994998852075859 (14/07 13h39, 69 vues, réponses ouvertes, cadence libre — compte suivi le 14/07 mais jamais engagé en reply). Reprend l'angle EBO-PEP marqué « à reprendre en priorité » dans x-watchlist.md. @AfricaCDC (12/07) et @Dr_JeanKaseya (11/07) étant tous deux bloqués par la règle 1 reply/compte/semaine, ALIMA (partenaire du consortium) était la bonne porte d'entrée sur ce sujet.

Post cible : « 🇨🇩 A new step in #Ebola research. The EBO-PEP consortium has launched a clinical trial in DRC to evaluate a post-exposure prophylaxis (PEP) strategy for people at high risk of infection. »

> The five-day enrolment window is the operational constraint worth flagging here. Eligibility requires a high-risk contact identified within five days of exposure, so the trial's reach is bounded by contact tracing throughput rather than by drug supply. In Bunia, one of the two recruitment sites, Chikwe Ihekweazu told Reuters this month that roughly 80% of confirmed cases were arising outside known contact lists. For Bundibugyo, where no licensed vaccine or monoclonal exists, a working post-exposure option would close a real gap, but tracing capacity is what determines how much of that gap it can actually reach.

**Double-check effectué avant publication.** Source primaire lue en session (communiqué ALIMA lui-même, pas le post X) : https://alima.ngo/en/press-releases/bundibugyo-ebola-virus-outbreak-launch-ebopep/ — obeldesivir (Gilead, oral) ; espèce Bundibugyo ; éligibilité = contact direct d'un cas confirmé **dans les 5 jours**, adultes/enfants > 12 ans, asymptomatiques ; ~1 000 participants ; suivi quotidien 21 j, évaluation finale 42 j ; recrutement dans des centres PEP adjacents aux CTE de **Bunia et Rwampara** (Ituri), démarrage 14/07 ; RDC + Ouganda, extension prévue Guinée/Liberia/Sierra Leone ; financements Global Health EDCTP3 3,4 M€, Africa CDC 1 M$, RDC + Afrique du Sud 5 M$ ; partenaires INRB, ANRS MIE, ALIMA, MSF, Africa CDC + 10 autres. Le 80 % est attribué explicitement (Chikwe Ihekweazu à Reuters) et **localisé à Bunia**, conformément à la correction du 12/07 qui interdit de le présenter comme un chiffre national. Absence de vaccin/monoclonal homologué pour Bundibugyo = fait déjà établi (6 juil). **Surclaim évité :** la formulation « first post-exposure option » a été écartée à la rédaction (le communiqué ne revendique pas d'antériorité) au profit de « a working post-exposure option would close a real gap ». Pas de CTA/lien/hashtag, pas de tirets cadratins, ton analytique décideur. Publication confirmée visuellement (toast « Votre post a été publié », compteur de réponses du post cible 0→1).

**⚠️ Incident évité au double-check de mise en forme** : un premier clic sur le champ de réponse a été détourné par une réorganisation de la page vers `x.com/compose/post`, soit un composeur de **post original** (hors périmètre de cette routine). Le screenshot de vérification a montré le composeur **vide** (bouton « Poster » grisé) : le texte saisi n'a jamais atterri, rien n'a été publié. Composeur fermé sans dialogue de brouillon, retour au post par URL directe, puis reply repostée proprement (mention « En réponse à @ALIMA_ORG » vérifiée avant frappe). Confirme la valeur de la règle « vérifier la mise en forme réellement rendue avant d'envoyer » : ici elle a empêché un post de marque involontaire, pas seulement une coquille.

**Reply n°2 POSTÉE ✅ — @AP (Associated Press) : 2 011 cas, et surtout la chute du suivi des contacts**

Cible : https://x.com/AP/status/2077304155232669839 (15/07 10h07, 16,3k vues, réponses ouvertes, cadence libre — @AP jamais engagé ; @Reuters purgé du ledger ce matin mais non réutilisé). Post : « The confirmed cases of Ebola in Congo have reached 2,011, including 754 deaths, in what authorities say is the fastest-growing outbreak on record. Contact tracing remains a challenge, with coverage of those exposed still at 67%. »

> The 67% is the figure worth tracking as a trend rather than a level. The same official sitreps put contact follow-up at 81.6% on 4 July and 78.1% on 11 July, so coverage has fallen roughly 14 points in nine days while the response now spans five provinces: Haut-Uele, Ituri, Nord-Kivu, Sud-Kivu and Tshopo. Sud-Kivu has gone 47 days without a confirmed case, so the pressure is concentrated in Ituri, still the epicentre. Tracing coverage falling while the geography widens is what turns a fast-growing outbreak into a poorly measured one.

**Double-check effectué avant publication.** Angle choisi pour ne PAS redire le post (qui donne déjà 2 011/754/67 %) : la **trajectoire** du suivi des contacts, que le post traite comme un simple niveau. 81,6 % (sitrep du 4/07) et 78,1 % (sitrep du 11/07) proviennent de nos propres archives, tous deux vérifiés à l'époque contre les sitreps officiels ; 67,4 % (sitrep du 13/07) lu en direct en session sur le compte officiel vérifié @Com_mediasRDC. Arithmétique revérifiée : 81,6 − 67,4 = 14,2 points, du 4 au 13 juillet = 9 jours. Cinq provinces, « Ituri épicentre » et « Sud-Kivu 47 jours sans cas » repris mot pour mot du sitrep du 13/07. Pas de CTA/lien/hashtag, pas de tirets cadratins, ton analytique décideur. Publication confirmée visuellement (toast « Votre post a été publié », compteur de réponses 14→15). **Nuance assumée :** le 81,6 % portait sur 3 provinces et le 67,4 % sur 5, ce qui n'est pas strictement comparable à périmètre constant — c'est précisément le point de la reply (l'élargissement géographique dilue le traçage), et la formulation « while the response now spans five provinces » l'explicite au lieu de le masquer. **Environnement du fil :** plusieurs réponses ouvertement racistes de comptes tiers sous ce post AP ; sans incidence sur la pertinence de répondre à l'agence, notre contribution restant strictement factuelle.

**🔴 Donnée épidémiologique nouvelle — DB PROD MISE À JOUR (ligne RDC/Ebola)**

Repérée via le post @AP ci-dessus, **jamais retenue sur la foi du post** : recoupée jusqu'à la source primaire. Source primaire retenue = **Point de situation officiel du 13 juillet 2026** (INSP/Ministère de la Santé), publié par le compte officiel vérifié **@Com_mediasRDC** et lu mot pour mot en session : « À ce jour, 2 011 cas confirmés ont été enregistrés, dont 753 patients en isolement ou hospitalisation, 366 personnes guéries et 754 décès. Le taux de létalité est de 37,5 %, tandis que le suivi des contacts atteint 67,4 %. » Recoupé indépendamment par AP et CGTN. https://x.com/Com_mediasRDC/status/2077173470299869581

- **Vérification de fraîcheur avant écriture** : l'ECDC (source de la ligne existante) était encore à 1 963/719 au 12/07 (page maj 14/07 13:55) — il n'a pas encore intégré le sitrep du 13/07. Conformément à la règle « privilégier le plus récent des deux pour un fait de moins de 48h », le sitrep national prime. Écart structurel sitrep national vs cycle ECDC/WHO DON, déjà documenté, pas un bug.
- **Ligne prod `bd1c3a46-a921-49b7-b79e-10ad715c4c38`** (écriture dans `.env.local.live` = vraie prod, vérifié) :

| Champ | Avant | Après |
|---|---|---|
| cases | 1 963 | **2 011** |
| deaths | 719 | **754** |
| recovered | null | **366** |
| date | 2026-07-12 | **2026-07-13** |
| source | ECDC | Point de situation officiel RDC 13/07 (@Com_mediasRDC) |

`source_priority` laissé à **10** (verrou déjà en place, non modifié), `active` à true. **Cohérence interne vérifiée après écriture** : CFR recalculé 754/2011 = 37,49 %, conforme au 37,5 % annoncé par le sitrep.
- **Fait nouveau au passage** : l'épidémie touche désormais **cinq** provinces (ajout du **Haut-Uélé**), alors que nos archives s'arrêtaient à quatre (Tshopo déclarée le 12/07). Non modélisé en DB (la ligne est au niveau pays, `admin1` = null), signalé ici comme évolution de périmètre.

**✅ [RÉSOLU en session] Le thread MWF du 15/07 était périmé, il a été rebasé sur demande de David** (hors périmètre habituel de cette routine, géré par `x-hwg-content-proposal`, mais corrigé ici pour éviter une publication fausse) : il était bâti sur **1 963 cas / 719 décès / CFR 36,6 %** (ECDC, données au 12/07) alors que le sitrep officiel du 13/07 donne **2 011 / 754 / CFR 37,5 %**. Thread mis à jour en tête de ce fichier (nouvelles bornes, arithmétique et longueurs remesurées, ancienne version conservée en trace). L'angle CFR est inchangé et sort renforcé. **Toujours non publié : en attente de publication par David**, conformément à la règle sur le contenu de marque.

**Traction repérée** : **Julien Harneis** (@julienmh, UN Senior Ebola Coordinator, vérifié, déjà suivi) **a aimé notre reply du 13/07** sur Tshopo (déclaration de la province comme officiellement affectée le 12/07). Deuxième signal positif d'un coordinateur ONU de premier plan sur nos replies.

**Messages privés (DM) — DÉBLOCAGE CONFIRMÉ, boîte vide** : x.com/messages ne demande **plus** le code de déchiffrement qui bloquait la routine depuis le 14/07. Accès rétabli sans intervention de ma part (David a probablement saisi le code, ou X a levé l'exigence). Vérification complète effectuée : **boîte de réception vide**, **aucune demande de message** ni en onglet « Priorité » ni en onglet « Masqué ». **0 message reçu, 0 réponse envoyée, rien à signaler à David.** Aucune demande de contact hors X à remonter.

**Comptes suivis — 5/5, plafond du jour atteint** : @MSFsci, @DNDi, @radiookapi, @RSTMH, @KEMRI_Wellcome. Légitimité vérifiée une par une (bio, activité, site, ancrage réseau) et bouton « Abonné » confirmé par zoom après chaque clic. Détail complet dans x-watchlist.md. Chaîne de repérage : suggestions @ALIMA_ORG → @MSFsci → @DNDi ; suggestions @Com_mediasRDC → @radiookapi ; suggestions @MSFsci → @RSTMH → @TropMedOxford → @KEMRI_Wellcome. **Incident de clic évité** : un clic sur le bouton Suivre de @RSTMH a été détourné vers le profil @TropMedOxford (rescale de page) ; vérification visuelle immédiate = bouton toujours sur « Suivre », donc **aucun follow fantôme**, ni sur RSTMH ni sur TropMedOxford. RSTMH suivi proprement à la reprise. Candidats écartés : @Presidence_RDC et @DeniseNyakeru (politiques), @SiteAnrsCmr/@equipebiblio (ANRS MIE n'a pas de compte principal exploitable), INSP RDC (aucun compte X trouvable malgré recherche, alors que c'est la source des sitreps).

**Bilan quotas (tous passages confondus, 15/07)** : **2/3 replies** postées (@ALIMA_ORG, @AP), **5/5 follows** exécutés, **0 DM** reçu. La 3e reply n'a pas été trouvée après épuisement des méthodes de recherche (détail et liste des écartés dans x-watchlist.md, section « Posts notables ») — quota clos volontairement à 2/3 plutôt que de forcer une reply médiocre. Aucun cas « autonomie et garde-fous » déclenché nécessitant l'arbitrage de David, hormis les posts politiquement chargés écartés d'office et le point thread MWF ci-dessus.

**Incident navigateur (résolu en session, 5e récidive)** : blocage initial (3 × timeout 300s sur `navigate` vers x.com, y compris onglet neuf). **Diagnostic nouveau et utile pour David** : l'extension n'était pas morte — `select_browser`, `tabs_context`, et `navigate` vers un domaine hors allowlist répondaient tous **instantanément**. Seul le chargement de x.com bloquait, et il a fini par passer sur une 4e tentative. Autres symptômes d'instabilité observés : tab IDs divergents entre `computer` et `tabs_context` (deux sources de vérité contradictoires), groupe d'onglets disparu puis réapparu après re-sélection, et `get_page_text`/`read_page` systématiquement en échec sur x.com (« waited 45000ms for document_idle » — X ne devient jamais idle à cause de son polling). **Contournement qui a fonctionné toute la session : screenshot + zoom au lieu des outils d'extraction de texte.**

---

### Veille x-hwg-monitoring — 2026-07-14 (session 1, JOUR D'ESSAI SUPERVISÉ)

> Mode essai 14/07 : préparé + double-checké en attente de validation. **Mise à jour en session : David a validé les 5 follows (Polymarket laissé de côté).** Les 5 comptes ont été suivis et confirmés visuellement (bouton "Abonné") : @AmerMedicalAssn, @NIH, @MRC_Outbreak, @UNICEFDRC, @ProfJanabi. Détail dans x-watchlist.md. La reply Polymarket reste non postée (mise de côté par David). Note technique : le bouton "Suivre" a nécessité un second clic sur plusieurs comptes (le premier clic ne changeait pas l'état visuel malgré confirmation apparente) — toujours revérifier l'état réel du bouton après clic, pas seulement l'absence d'erreur.

**Incident navigateur (résolu en session)** : blocage total au début de la session (timeout 300s, extension déconnectée) — récidive du même schéma que 11/13 juillet. Notification push envoyée. David a redémarré Chrome et demandé de relancer ; reprise réussie après re-sélection + nouvel onglet (même protocole de récupération que le 13/07). Une instabilité de rendu ponctuelle (viewport 0x0) a nécessité un 2e nouvel onglet, résolue.

**Messages privés (DM) — BLOQUÉS, hors périmètre autonome** : x.com/messages demande désormais un code de déchiffrement (chiffrement de bout en bout X) inconnu. Je n'ai pas tenté « Code oublié » (flow de récupération de compte = action de sécurité, hors de mon périmètre). **À faire par David : saisir le code ou le récupérer lui-même** pour débloquer l'accès aux DM des prochaines sessions.

**Données épidémiologiques — vérifiées, aucune MAJ nécessaire** : deux comptes vérifiés (@iihtishamm, @Osint613) citaient un chiffre RDC/Ebola de 1 963 cas / 719 décès. Recherche croisée : WHO DON/ECDC (publié 13/07, données au 11/07) donne 1 926 cas/702 décès (source déjà en DB, ligne active, `date: 2026-07-11`) ; Radio Okapi (14/07, article Tshisekedi/Dr Ahuka) arrondit à ~1 900/700. Aucune source primaire ne confirme exactement 1 963/719 → chiffre non retenu, ligne DB existante confirmée à jour et correctement sourcée (MoH RDC/INSP SitRep 058 + ECDC). Script de vérification jetable supprimé après usage.

**Reply — 1 candidat préparé, à trancher par David (sensibilité politique)** :
Cible : **@Polymarket** (compte prédiction/marché, vérifié, 14/07 12:06, 87 likes/22,3k vues, réponses ouvertes) — « JUST IN: U.S. to block Americans in Congo from boarding commercial flights home amid the Ebola outbreak. »
Fait vérifié (Reuters, multi-sourcé : Irish Examiner, FMT, The Herald, TradingView) : ordre Title 49 « do-not-board », signé 13/07 par le Secrétaire HHS (Kennedy), exige 21 jours dans un pays tiers avant tout vol vers les USA pour les citoyens américains actuellement en RDC. Chiffres du cas RDC cités par Reuters (1 926/702) cohérents avec la DB.
> Worth flagging the mechanism behind this: under Title 49, US citizens currently in DRC are placed on a do-not-board list until they have spent at least 21 days in a third country before flying home. That threshold matches Ebola's incubation window, the same 21-day clearance period already used for exposure monitoring of humanitarian staff in this outbreak, rather than a blanket ban on travel to or from DRC.
Double-check : factuel (21 jours = fenêtre d'incubation déjà établie dans la reply Popescu du 11/07 ; mécanisme Title 49/do-not-board confirmé Reuters) ; pas de CTA/lien/hashtag ; pas de tirets cadratins ; aucune mention de l'administration ou du signataire, cadrage strictement mécanisme épidémiologique. **⚠️ Flag guardrail « sujet politiquement chargé »** : le sujet sous-jacent (ordre de voyage pris par l'administration Trump, signé par le Secrétaire HHS Kennedy, figure controversée) reste adjacent à un terrain politique clivant même si la reply évite toute prise de position. Je le soumets à ton arbitrage plutôt que de le traiter comme un candidat de routine.
Autre post écarté : @julienmh (Kisangani/Tshopo, 2h) — même événement déjà engagé le 13/07 (cadence 1/compte/semaine bloquée, <7 jours).

**Comptes à suivre — 5 candidats prêts (plafond du jour), légitimité vérifiée** :
| Compte | Contexte | Repéré via |
|---|---|---|
| **@AmerMedicalAssn** (AMA, vérifié) | American Medical Association, ama-assn.org, 694,5k abonnés, suivi par Tom Frieden et Richard Hirschson (déjà suivis) | Suggestion notifications |
| **@NIH** (vérifié) | National Institutes of Health, nih.gov, 1,7M abonnés, suivi par Dr Jean Kaseya et Viral Facts Africa (déjà suivis) | Chaîne de suggestions (via AMA) |
| **@MRC_Outbreak** (MRC Centre for Global Infectious Disease Analysis) | WHO Collaborating Centre, Imperial College London, modélisation épidémique, 231,3k abonnés, suivi par Léandre Murhula et Dr Jean Kaseya (déjà suivis). Cœur de cible exact. | Chaîne de suggestions (via NIH) |
| **@UNICEFDRC** (UNICEF en RDC, vérifié) | Bureau pays officiel, pertinence directe RDC/Ebola | Suggestions recherche |
| **@ProfJanabi** (Prof. Mohamed Janabi, vérifié) | **Directeur régional de l'OMS AFRO**, Brazzaville, 20,5k abonnés, suivi par Dr Jean Kaseya et Dr Shible Sahbani (déjà suivis). Décideur senior de tout premier plan. | Suggestions recherche |

**Candidat écarté — @HHSGov** : officiel (U.S. Department of Health & Human Services, hhs.gov, 1,6M abonnés) mais bio actuelle mentionne « MAHA » et @SecKennedy — contexte politiquement sensible (politique vaccinale controversée de l'administration actuelle). Mis de côté par prudence plutôt qu'inclus en candidat de routine ; à trancher par David si intéressé.

**Bilan quotas (tous passages confondus, 14/07)** : 0/3 replies postées (1 brouillon en attente d'arbitrage), 0/5 follows exécutés (5 candidats prêts). DM : bloqués (code de déchiffrement manquant). Aucun cas de « autonomie et garde-fous » déclenché autre que le flag politique ci-dessus.

---

### Paire MWF — 13 juillet 2026 — 2e run du jour, PRÊT — à publier par David (⚠️ voir note de doublon ci-dessous)

**⚠️ Note :** cette session `hwg-mwf-content-post` s'est déclenchée alors que la paire MWF du 13/07 (méningite, ceinture africaine) était déjà PRÊTE et même déjà PUBLIÉE côté LinkedIn (voir section LinkedIn plus bas, override David). Ce brouillon Ebola est donc un contenu supplémentaire, pas le remplacement du post méningite. À David de décider s'il veut publier les deux le même jour, garder celui-ci pour une prochaine session MWF, ou l'ignorer.

**Sujet choisi :** flambée Ebola (souche Bundibugyo) répartie sur trois pays aux profils radicalement différents. Angle : même souche virale (bulletin OMS DON612), mais RD Congo concentre l'essentiel du fardeau (cas + décès) et un écart de létalité marqué avec l'Ouganda, plus un cas importé en France dans la même fenêtre. Sujet distinct du post Ebola Bundibugyo déjà publié le 24 juin (qui portait sur le gap vaccinal Ervebo/Zaïre vs Bundibugyo, chiffres au 21 juin) — ici l'angle est la répartition géographique du fardeau et le risque international, avec des chiffres à jour au 13/07.

**Source des données (étape 0, session 13/07) :** lignes DB `outbreaks`, toutes `is_seed:false`. RD Congo : 1 460 cas / 452 décès, date 2026-07-03, source DON612, `updated_at` 2026-07-08T06:41Z. Ouganda : 20 cas / 2 décès, date 2026-07-03, source DON612, `updated_at` 2026-07-13T07:04Z (frais du jour). France : 1 cas / 0 décès, date 2026-06-25, source santepubliquefrance.fr, `updated_at` 2026-07-08T06:41Z. CFR calculés : RDC 452/1460 = 30,96 % (~31 %), Ouganda 2/20 = 10 %. Part RDC dans le total (1481 cas / 454 décès) : 98,6 % des cas, 99,6 % des décès.

**X (EN) — thread 4 tweets**

1/
> Same Ebola outbreak (Bundibugyo strain, WHO DON612), three countries, three very different pictures. DR Congo: 1,460 cases, 452 deaths (31% CFR). Uganda: 20 cases, 2 deaths (10% CFR). France: 1 imported case, 0 deaths.

2/
> DRC carries over 98% of confirmed cases and 99% of deaths in this outbreak. That's where the real response burden sits, regardless of where headlines land.

3/
> The CFR gap, 31% vs 10%, for the same strain isn't about virus behavior. Same pathogen, different outcome. It tracks access to care and time to treatment, not virulence. The fatality gap is a health-system signal.

4/
> One imported case reached France in the same window (25 June, Santé publique France). Case counts stay wildly asymmetric. Travel risk and early detection don't. healthwatch-global.com

**Double-check X :** chiffres confrontés ligne-à-ligne à l'étape 0 (RDC 1 460/452→31 %, Ouganda 20/2→10 %, France 1/0, part RDC 98,6 %/99,6 % arrondies à 98/99 %) ; 4 tweets sous 280 caractères visibles ; anglais dense, 0 hashtag ; positionnement décideurs ; pas de ProMED ; pas de faux témoignage ; pas de doublon avec le post Ebola du 24 juin (angle vaccin) ni avec le post méningite du 13/07 matin (autre maladie).

---

### Paire MWF — 13 juillet 2026 (lundi) — PRÊT — à publier par David

**Sujet choisi :** ceinture africaine de la méningite, saison sèche 2026. Angle : pendant qu'Ebola occupe les titres, une épidémie plus large, évitable par vaccin et traitable, traverse le Sahel chaque saison sèche. Sujet frais (jamais couvert dans ce log), diversifie hors Ebola/rougeole/dengue qui dominaient la dernière semaine. Reprend le fil conducteur « l'épidémie qui fait les titres est rarement la seule qui compte » (déjà utilisé le 8 juillet, cohérent avec le positionnement décideurs).

**Source des données (étape 0, session 13/07) :** lignes DB `outbreaks` Méningite, source = bulletin OMS méningite semaine 25 2026 (PDF cdn.who.int, date 2026-06-21), `is_seed:false`, `updated_at` 2026-07-13T06:45Z (frais du jour). Burkina Faso 1 449 cas/61 décès, Nigéria 1 396/84, Tchad 968/68, Soudan du Sud 92/7. Total 3 905 cas / 220 décès, CFR agrégé 5,6 %. CFR par pays : BF 4,2 %, Nigéria 6,0 %, Tchad 7,0 %, Soudan du Sud 7,6 %. Contexte MenAfriVac/sérogroupes vérifié via recherche web (élimination quasi-totale du sérogroupe A après 2010, épidémies actuelles portées par C/W/X) — gardé en contexte historique, non attribué aux chiffres 2026 précis (le bulletin OMS ne fournit pas le sérogroupe par ligne DB).

**X (EN) — thread 3 tweets**

1/
> While Ebola takes the headlines, a larger outbreak runs quietly through the Sahel each dry season: Africa's meningitis belt. Latest WHO bulletin (week 25): ~3,900 cases, 220 deaths across Burkina Faso, Nigeria, Chad and South Sudan. Vaccine-preventable. Treatable.

2/
> The signal isn't the case count. It's the CFR spread: 4.2% in Burkina Faso to 7.6% in South Sudan. Meningococcal meningitis can kill in 24-48h untreated. At that speed, a rising CFR measures time-to-care, not pathogen virulence. The fatality gap is a health-system map.

3/
> Context most reporting skips: MenAfriVac nearly eliminated serogroup A after 2010. Today's outbreaks run on C, W and X, where coverage is still partial. The threat didn't leave, it changed shape. The loudest outbreak is rarely the only one that matters. healthwatch-global.com

**Double-check X :** chaque chiffre confronté à l'étape 0 (BF 1 449/61→4,2 %, Soudan du Sud 92/7→7,6 %, total ~3 900/220) ; 3 tweets sous 280 caractères visibles (mesurés : ~262 / ~266 / ~273) ; anglais dense, 0 hashtag ; positionnement décideurs ; pas de ProMED ; pas de faux témoignage ; sérogroupe A/C/W/X en contexte historique, aucune attribution 2026 non fondée.

---

### Replies engagement — 13 juillet 2026 (session monitoring, 2e passage après déblocage navigateur)

**1. @WHOSudan** (bureau pays OMS Soudan, vérifié, en file d'attente depuis le 12/07) — post 11/07 23h30 sur les campagnes de vaccination OCV choléra au Kordofan. **POSTÉ ✅** (toast « Votre post a été publié » confirmé, compteur réponses 0→1, https://x.com/whosudan/status/2076056455187243127).
> Worth flagging the vaccine layer behind the OCV line: even with global stockpiles now recovering after years of shortage, single-dose remains the standard protocol for outbreak-response campaigns like this one, and single-dose protection runs roughly six months versus about three years for the two-dose regimen. That is one structural reason a displacement-driven outbreak like Sudan's needs repeated campaign rounds rather than one round resolving it, on top of the prepositioned kits and trained rapid response teams covering the gap between rounds.
Double-check (fait le 12/07, reconfirmé le 13/07) : bascule ICG dose unique oct. 2022, reconstitution stock mondial fév. 2026 vérifiées via 2 sources indépendantes (Voice of Africa, Science/AAAS) ; pas de CTA/lien/hashtag ; pas de tiret cadratin. Cadence libre.

**2. @Chikwe_I** (Dr Chikwe Ihekweazu, Directeur OMS Urgences Sanitaires, déjà suivi, jamais engagé avant) — post 12/07 18h27 : « Back in Geneva this week, but my heart is still with our teams in Ituri and North Kivu... pushing to bring this #Ebola outbreak under control ». **POSTÉ ✅** (toast confirmé, compteur réponses 1→2, https://x.com/Chikwe_I/status/2076342784026427582).
> Worth flagging the two-speed picture behind that outbreak right now: Sud-Kivu just passed 42 days without a new case, the kind of milestone that precedes a provincial end-of-outbreak declaration, while Ituri remains both the case-load epicenter and where the recent health-worker toll landed hardest (112 infected, 35 deaths from the Bundibugyo strain). Sud-Kivu looks close to a working proof of what contact tracing and community engagement can achieve here; the open question is what it would take for Ituri to converge onto that same curve.
Double-check : faits vérifiés (sitrep 11/07 pour Sud-Kivu 42 jours, AfricaCDC 12/07 pour le bilan soignants 112/35). Une phrase retouchée avant publication : « the harder question for your teams is why Ituri hasn't converged » sonnait comme une remise en cause directe de l'équipe d'un décideur OMS senior — reformulée en « the open question is what it would take for Ituri to converge », ton analytique-prospectif au lieu d'accusateur. Pas de CTA/lien/hashtag ; pas de tiret cadratin. Cadence libre.

**3. @julienmh (Kisangani/Tshopo) — angle clarifié puis blocage technique, NON POSTÉE.**
Recherche complémentaire demandée par David (« Cherche un DON plus récent pour Kisangani ») : DON613/614 n'existent pas encore sur who.int (DON612 du 3 juillet reste le plus récent officiel). Mais le sitrep national RDC a tranché entre-temps — **Radio Okapi (13/07 07h14)** rapporte que le Ministre de la Santé RDC (Dr Samuel Roger Kamba) a **officiellement déclaré Tshopo province touchée le 12 juillet** : 4 cas confirmés importés d'Ituri (2 décès) répartis sur 3 zones de santé (Makiso-Kisangani, Mangobo, Lubunga), 40 cas suspects, 129 contacts identifiés. Citation directe : « Les quatre cas que nous avons sont des cas importés, tous venant de l'Ituri... nous considérons que Kisangani est touchée. » Recoupé avec mediacongo.net (9/07) pour la chronologie (2 cas le 9/07 → 4 cas + déclaration officielle le 12/07). L'ambiguïté du 13/07 matin est donc résolue : plus de cas « sans lien épidémiologique » mentionné par le Ministre, les 4 cas sont tous liés à l'Ituri.
Reply révisée et double-checkée, validée par David (« publie le ») :
> Worth adding the confirmed picture behind that: DRC's health minister officially declared Tshopo an affected province on 12 July, after four imported cases from Ituri (two deaths) were confirmed across three health zones in Kisangani, alongside 40 suspected cases and 129 identified contacts. That makes it the fourth province in this outbreak, exactly the kind of jump that justifies precaution spreading ahead of the case count rather than after it.
**Publication impossible sur ce post précis** : affichait « Seuls certains comptes peuvent répondre » (réponses restreintes par Julien Harneis), même restriction que documentée pour @kasujja le 6 juillet. Aucune reply postée sur ce post. Angle Kisangani/Tshopo réutilisé avec succès sur un autre post du même auteur (voir ci-dessous).

**3bis. @julienmh (autre post, réponses ouvertes) — POSTÉE ✅.** Post du 12/07 20h32 (« Arrived in Kisangani with @MinSanteRDC @UN @AfricaCDC @IMC_Worldwide and @IFRC... A critical meeting was listening to local NGOs SOFEPADI ADSPA PPSSP Caritas and more ») — David a demandé une recherche de dernière reply pertinente ; ce post frais (repéré via notifications) permettait de réutiliser l'angle Kisangani/Tshopo vérifié sans redondance avec la reply bloquée. **POSTÉ ✅** (toast confirmé, https://x.com/julienmh/status/2076374063111393601).
> That timing lines up with Sunday's declaration: DRC's health minister announced Tshopo as an officially affected province on 12 July, citing four imported cases from Ituri (two deaths) across three health zones in Kisangani, plus 40 suspected cases and 129 identified contacts. Looping in SOFEPADI, ADSPA, PPSSP and Caritas on day one matters here specifically because Kisangani is a transport hub, community-level trust networks are what catch the contacts that formal surveillance misses in a city that size.
Double-check : mêmes chiffres déjà vérifiés (Radio Okapi 13/07 + mediacongo.net) réutilisés en contexte plutôt qu'en affirmation nouvelle ; angle distinct de la version bloquée (porte sur l'intérêt de l'engagement ONG locales jour 1, pas sur l'annonce elle-même) ; « Kisangani = carrefour de transport » confirmé par mediacongo.net. Pas de CTA/lien/hashtag, pas de tiret cadratin. Julien Harneis n'avait reçu aucune reply postée cette semaine (tentative précédente non aboutie) — cadence libre.

Total replies postées le 13 juillet (cumulatif toutes sessions) : **3/3 — quota du jour atteint.**

---

**Compte :** @HWatchGlobal (HealthWatchGlobal â€” vÃ©rifiÃ© âœ“)
**Style Ã©tabli :** threads analytiques EN, positionnement stratÃ©gique (dÃ©cideurs > techniciens)

### Posts existants â€” 19 juin 2026

**Thread 1 :**
> Most epidemic surveillance tools fail not because the data is wrong.
> They fail because they're built as dashboards â€” and no ministry focal point opens a dashboard as part of their morning routine.
> They open briefings. They escalate through existing channels. The tool isn't in [their workflow].

**Thread 2 :**
> Map it to Prevent / Detect / Respond.
> Most surveillance platforms live in Detect. The signals are there.
> The gap is always Respond. Decision-makers don't ask "what's the signal." They ask:
> â€” Is this real?
> â€” How serious?
> â€” What do we do?
> Ministries have data. What they lack is [actionable framing].

### Thread Powassan (30 juin 2026) â€” PUBLIÃ‰ âœ…

> Powassan virus.
> No treatment. No vaccine.
> Tick-to-human transmission: as little as 15 minutes.
> CFR: 16%. Half of survivors face permanent neurological damage.
> 2023 recorded the highest U.S. case count since ArboNet began...

**Traction 1er juillet :** @POWVonSOL (compte dÃ©diÃ© Powassan, vÃ©rifiÃ©) : repost + like + "News absolutely exploding". Fix It Now Wisconsin : repost du reply Marburg/VHF. Fafafa : like reply Marburg.

**Reply postÃ© Ã  @POWVonSOL (1er juillet) :**
> The 2023 ArboNet numbers were the first signal that something was shifting. Most cases still reach clinical attention at neurological presentation, not at the febrile stage â€” which makes the true incidence almost certainly higher than what's reported.

---

**Traction 3 juillet (decouverte le 4 juillet) :** @AbraarKaran (medecin infectiologue et chercheur Stanford, verifie) a aime la reply HWG du 3 juillet sur la fragmentation des donnees terrain, postee en reponse a son commentaire sur l'article NEJM "Ebola at 50 - Lessons for Outbreak Response and Preparedness" (post original: 1k vues, 8 likes, 6 reposts). Reply HWG : https://x.com/HWatchGlobal/status/2072963675082649716
> Data governance is often where this breaks down in practice. Field data generated during an outbreak can sit fragmented across ministry systems, partner databases and lab networks for weeks. When local institutions don't own that data from day one, the analytical loop is broken. The lesson from 50 years of Ebola is that surveillance architecture has to be built with the same equity logic as the science.

Pas de nouvelle reply ici : quota du jour deja a 3/3, et regle 1 reply/compte/semaine deja utilisee sur @AbraarKaran le 3 juillet.

---

### Thread — 8 juillet 2026 — POSTÉ (demandé et validé explicitement par David, override ponctuel de la règle CLAUDE.md réservant la publication à David)

Comparaison Ebola RDC (haute létalité, faible volume) vs Dengue Brésil (faible létalité, très haut volume) — angle double axe de risque pour décideurs. Chiffres fournis par David, cohérents avec les vérifications de session (Ebola 1 460/452 = WHO DON612 exact) et la mémoire projet (Dengue Brésil 407 750 cas résolu le 8 juillet).

**Tweet 1/3** : https://x.com/HWatchGlobal (thread, voir profil)
> 1/ Two outbreaks are live right now. They could not look more different, and that gap is the surveillance problem in one frame.
> Ebola Bundibugyo, DR Congo: 1,460 cases, 452 deaths. ~31% CFR. No licensed vaccine or treatment. One imported case in France.

**Tweet 2/3**
> 2/ Dengue, Brazil: 407,750 cases, 241 deaths this year. CFR 0.06%.
> Nearly 280x the case count of the Ebola outbreak. Real hospital strain. A fraction of the attention.

**Tweet 3/3**
> 3/ High fatality and high volume are different risk axes. A decision-maker has to hold both at once, without the loud signal erasing the quiet one.
> The outbreak in the headlines is rarely the only one that matters.
> Live figures: WHO DON612 + Brazil MoH, via healthwatch-global.com

---

### Thread contenu propre — 9 juillet 2026 — POSTÉ

Thread 3 tweets rédigé par David, vérifié (CDC 2 170 cas au 2 juillet, 0 décès en 2026, analyse CIDRAP sur la perte probable du statut d'élimination cet automne) puis publié. Tweets 2 et 3 raccourcis pour tenir sous 280 caractères visibles dans le fil (le brouillon initial dépassait la limite, surtout le tweet 3 porteur du lien).

**1/** The US has logged 2,170 confirmed measles cases in 2026, with no deaths reported this year (CDC, through July 2). Zero fatalities is the reassuring number. The case count is the one that matters.

**2/** For a disease the US declared eliminated in 2000, 2,170 cases is a warning. Analysts now say the country is likely to lose elimination status this fall. Measles has an R0 of 12-18, the highest of any common pathogen. It needs ~95% immunity to stop spreading.

**3/** That makes it a sentinel: when coverage slips, measles returns first, before pertussis, before diphtheria. The same immunity gap is fueling outbreaks in Europe, Africa and Asia too. Never just a measles problem. Live WHO/ECDC/PAHO/CDC figures: healthwatch-global.com

Vérification factuelle : [Medical Daily](https://www.medicaldaily.com/measles-cases-2170-2026-cdc-update-record-track-paho-475930) (2 170 cas CDC au 2 juillet), [CIDRAP](https://www.cidrap.umn.edu/measles/us-highly-likely-lose-measles-elimination-status-fall-analysis-warns) (perte probable du statut d'élimination cet automne, décision PAHO en novembre), recherche complémentaire confirmant 0 décès en 2026 (les 3 décès de l'épidémie 2025-2026 sont tous survenus en 2025).

---

### Replies engagement — 12 juillet 2026 (2e passage / run planifié) — POSTÉE

Second passage de monitoring dans la journée, après la session du matin (3 replies + 2 follows). **Correction de règle du 12 juillet (feedback de David) : le quota de cadence est cumulatif PAR JOUR, pas par session** — SKILL.md corrigé en conséquence. Cette reply Africa CDC a porté le total du jour à 4/3, ce qui dépasse le plafond journalier une fois la règle corrigée (l'erreur a été faite avant la correction, alors que je croyais le compteur remis à zéro pour ce 2e passage). Signal de traction : @RanuDhillon (vérifié, déjà suivi) a aimé la reply du matin. Contenu frais repéré : Africa CDC publie le bilan des soignants infectés par Ebola/Bundibugyo. **1 reply postée** (validée par David en conversation, avant la correction de règle), **3 comptes suivis** (@whosudan, @DrShible, @DesolaOgunleye, validés par David et exécutés après la correction de cadence — voir détail ci-dessous). @POWVonSOL avait été proposé en apparence puis rejeté après vérification (memecoin, voir x-watchlist.md). **Quota du jour désormais à 4/3 replies (dépassé) et 5/5 comptes suivis (plein) : aucune reply ni follow supplémentaire ne doit être postée le 12 juillet ; le brouillon @WHOSudan repéré ensuite passe en file d'attente pour le 13 juillet (voir x-watchlist.md, opportunité valable 48h).**

**@AfricaCDC (agence continentale, vérifiée, déjà suivie)** — post sur le bilan des soignants infectés (112) et décédés (35) depuis le début de l'épidémie Ebola RDC, suite à l'infection d'un travailleur humanitaire américain à Bunia. Post : https://x.com/AfricaCDC/status/2076209655173231019 — POSTÉ (validé par David, toast confirmé « Votre post a été publié »). Brouillon double-checké avant envoi : une phrase initiale comparant le CFR soignants (35/112 ≈ 31%) au CFR global (~35%) a été retirée, 31% étant inférieur à 35% ce qui est la direction attendue (les soignants accèdent aux soins plus tôt), donc présenter cela comme un signal distinctif était un surclaim.
> The health worker toll is a structural signal here, not only a human one. In Zaire ebolavirus outbreaks, frontline responders can be vaccinated with Ervebo as an added layer of protection; for Bundibugyo there is no licensed vaccine or monoclonal, so PPE, IPC and safe working conditions are the entire protective envelope rather than a supplement to vaccination. That absence of an immunological backstop is exactly why the "protected themselves" point carries more operational weight for this species than it would in a Zaire outbreak.

**Comptes suivis ce passage (validés par David)** : @whosudan (WHO Sudan, bureau pays officiel), @DrShible (Représentant OMS au Soudan, décideur senior), @DesolaOgunleye (Adesola Yinka-Ogunleye, épidémiologiste, Chatham House Fellow). Les 3 follows confirmés visuellement (bouton "Abonné" après clic). Détail dans x-watchlist.md.

---

### Replies engagement — 12 juillet 2026 — POSTÉES

Monitoring X quotidien, extension Chrome de nouveau fonctionnelle après le blocage total du 11 juillet (un timeout renderer isolé résolu par re-sélection du navigateur en cours de session). Actualité du jour : rencontre @DrTedros/@Dr_JeanKaseya sur la réponse Ebola RDC, medevac d'un travailleur humanitaire US vers l'Europe (Samaritan's Purse), et confirmation via Reuters/Chikwe Ihekweazu que l'épidémie pourrait être 2 à 4 fois plus large que les chiffres officiels (80% des cas confirmés à Bunia hors listes de contacts connus). **3 replies postées** (quota 3/3, validées explicitement par David), **2 comptes suivis** (@RanuDhillon et @dr_kkjetelina, validés par David et exécutés en cours de session, voir détail ci-dessous ; statut « Abonné » re-confirmé en direct le 12 juillet lors du 2e passage). Les 3 brouillons ont fait l'objet d'un second passage de double-check à la demande de David : 2 corrections appliquées avant publication (voir détail ci-dessous).

**@DrTedros (DG OMS, vérifié, déjà suivi)** — post sur sa rencontre avec @Dr_JeanKaseya concernant la réponse Ebola RDC, « community mistrust continue to hamper the response… @MinSanteRDC leadership remains critical ». Post : https://x.com/DrTedros/status/2076075183551520932 — POSTÉ (validé par David, toast confirmé, compteur réponses 0→1). Re-vérifié sans modification au second passage : aucune intention prêtée à Tedros/Kaseya, inférence épidémiologique construite sur les faits qu'il énonce lui-même (leçon retenue du re-double-check du 11 juillet).
> The mistrust factor is especially load-bearing for a Bundibugyo outbreak. With no licensed vaccine or monoclonal for this species, Ervebo, Inmazeb and Ebanga are all Zaire ebolavirus-specific, there is no ring-vaccination fallback when community cooperation breaks down. Every remaining pillar, case-finding, contact tracing, safe burials, early isolation, runs on voluntary trust. That is what makes @MinSanteRDC's community engagement less a support activity and more the primary control tool here.

**@RanuDhillon (médecin, vérifié, Harvard/Brigham, ex-conseiller riposte Ebola Guinée)** — quote-tweet d'un post Reuters sur la nécessité de tests rapides face aux cas non tracés. Post : https://x.com/RanuDhillon/status/2076008949438980310 — POSTÉ (validé par David, toast confirmé). Correction appliquée avant envoi : le chiffre « 80% des cas » attribué à Chikwe Ihekweazu (vérifié via Arab News/CIDRAP/Newsweek) est spécifique à Bunia, épicentre de l'épidémie, pas à l'ensemble de la RDC — la version initiale ne précisait pas la zone, ce qui aurait laissé penser à un chiffre national.
> This is the key inflection point: once roughly 80% of confirmed cases in Bunia, the outbreak's epicenter, are arising outside known contact lists, per Chikwe Ihekweazu, contact tracing has structurally stopped being the primary case-finding engine there, and the response has to pivot to syndromic screening at facility level. Decentralized rapid testing is what makes that pivot operationally possible. It matters even more for Bundibugyo, where there is no vaccine to protect the contacts you do identify, so speed of detection becomes the main lever left.

**@business (Bloomberg, vérifié)** — post sur le travailleur humanitaire américain testé positif à Ebola en RDC, transféré vers l'Europe pour traitement (Samaritan's Purse). Post : https://x.com/business/status/2076050197927362914 — POSTÉ (validé par David, toast confirmé). Correction appliquée avant envoi : « a BSL-4 isolation unit » changé en « a specialized biocontainment unit », car la classification biosécurité exacte de l'établissement européen de destination n'est pas confirmée par la source (surclaim évité).
> Worth noting what evacuation "for treatment" means for a Bundibugyo case: there is no licensed therapeutic for this species, so it buys high-level supportive care in a specialized biocontainment unit rather than a targeted antiviral or monoclonal (obeldesivir, MB-134 and remdesivir are all still in trials for it). The transfer is also its own exposure event, each clinical and aeromedical team member enters a 21-day monitoring window.

**Comptes suivis cette session (validés par David)** : @RanuDhillon (médecin Harvard/Brigham, ex-conseiller riposte Ebola Guinée, 9 020 abonnés) et @dr_kkjetelina (Katelyn Jetelina, épidémiologiste, éditrice « Your Local Epidemiologist », 56,1k abonnés, non vérifiée). Suivis confirmés visuellement (bouton "Abonné"). Détail dans x-watchlist.md.

---

### Replies engagement — 11 juillet 2026 — POSTÉES

Monitoring X quotidien, session reprise après blocage navigateur en tout début de session (voir x-watchlist.md, incident non résolu par re-sélection cette fois, résolu au redémarrage sur demande de David). Actualité du jour : nouveau sitrep RDC (1 830 cas/648 morts, CFR ~35% recoupé contre @FluTrackers, Sud-Kivu 42 jours sans cas), cas Ebola confirmé chez un citoyen américain en RDC (vérifié via CNN/NBC/Reuters), annonce mission conjointe OMS/Africa CDC à Bunia. **3 replies postées** (quota 3/3, validées explicitement par David), **2 comptes suivis** (validés explicitement par David). Les 3 brouillons ont fait l'objet d'un second passage de double-check à la demande de David : 2 corrections appliquées avant publication (voir détail ci-dessous).

**@Dr_JeanKaseya (DG Africa CDC, déjà suivi)** — post annonçant une mission conjointe avec @DrTedros à Bunia (RDC, épicentre Ituri) les 18-19 juillet. Post : https://x.com/Dr_JeanKaseya/status/2075862991875031537 — POSTÉ (validé par David). Version initiale retirée avant envoi : une clause spéculant sur ce qu'une visite conjointe au niveau DG "signale habituellement" a été supprimée car elle prêtait une intention non confirmée au DG lui-même, en réponse directe à son propre post.
> Bunia makes sense as the target: Ituri has held the largest share of this outbreak's health zones since it began, and it's also where the health-worker walkouts reported in the hardest-hit towns this past week have hit hardest. Worth flagging the contrast though: Sud-Kivu just passed 42 days without a new case, a real step toward ending transmission there, while Ituri is where the escalation is still needed.

**@SaskiaPopescu (Dr Saskia Popescu, épidémiologiste infectieuse/biosécurité, vérifiée, non encore suivie avant ce jour)** — post « US citizen in Congo tests positive for Ebola virus, US CDC says » (lien Reuters), information vérifiée indépendamment via CNN/NBC/ABC17/KVIA/KION avant tout usage. Post : https://x.com/SaskiaPopescu/status/2075797117122314402 — POSTÉ (validé par David). Re-vérifié sans modification au second passage : aucune inférence non confirmée, chaque affirmation ancrée sur un fait déjà établi (souche Bundibugyo, absence vaccin/monoclonal, fenêtre 21 jours).
> Worth flagging the biosecurity read here: this is the Bundibugyo species, so there's no licensed vaccine or monoclonal available for exposed personnel, Ervebo and Inmazeb/Ebanga are both Zaire ebolavirus-specific. For any organization with international staff in Ituri or Nord-Kivu, that shifts the entire risk-management burden onto exposure screening and the 21-day monitoring window before a repatriation call, rather than post-exposure prophylaxis.

**@MinSanteRDC (Ministère de la Santé RDC, officiel, non encore suivi avant ce jour)** — post annonçant la mise en service d'un Centre de Traitement Ebola au sein du site de déplacés de Kigonze. Post : https://x.com/MinSanteRDC/status/2075826521340522581 — POSTÉ (validé par David). Réponse en français (compte francophone officiel). Correction appliquée avant envoi : « l'isolement précoce reste le seul levier » changé en « le levier principal », car l'affirmation initiale contredisait les essais cliniques PARTNERS (Remdesivir/MB134/Obeldesivir) repérés dans la même session sur le post Africa CDC.
> Un site de déplacés est l'un des pires contextes possibles pour Ebola : forte densité, points d'eau et de sanitaires partagés, mouvements de population qui compliquent le traçage des contacts. Sans vaccin ni monoclonal homologué pour l'espèce Bundibugyo, l'isolement précoce reste le levier principal, d'où la pertinence d'installer le CTE directement à Kigonze plutôt que de transférer les patients. Le vrai test sera de maintenir le taux de suivi des contacts (78,1 % au niveau national) à ce niveau précis dans le site, pas seulement dans les statistiques globales.

**Comptes suivis cette session (validés par David)** : @MinSanteRDC (Ministère Santé RDC, source primaire distincte de @Com_mediasRDC, 11,2k abonnés) et @SaskiaPopescu (épidémiologiste biosécurité, CEO Global Health Security Network, 62,3k abonnés). Détail dans x-watchlist.md.

---

### Replies engagement — 9 juillet 2026 — POSTÉES

Monitoring X quotidien. Notifications (Helen Branswell bloquée par cadence, traction confirmée sur 2 replies de la veille), timeline, recherche mots-clés structurée. 2 replies postées (quota 2/3), aucune file d'attente restante. Chiffres BNOFeed reconfrontés en direct avant publication (voir x-watchlist.md).

**@MarionKoopmans (Viroscience Dept Erasmus MC, WHO collaborating centre EID, non vérifiée sur X mais affiliation institutionnelle confirmée)** — post du 9 juil 8:17 AM : « Ebola outbreak DRC. Numbers still climbing, clinics at saturation point, walk out strikes by health care workers, and two cases in a large city, one without an epi link » (lien Bloomberg). Post : https://x.com/MarionKoopmans/status/2075102062828831188 — POSTÉ (validé par David).
> The untraced urban case is the real signal here: it means detection is now lagging transmission, not mapping it. With health-worker walkouts cutting contact-tracing throughput at the same time, that gap, not the raw case count, is what to watch this week.

**@BarryHunt008 (advocacy qualité de l'air/COVID, vérifié, 23,2k abonnés)** — quote-tweet du bilan @BNOFeed du 8 juil affichant « 66% Outcome CFR » = 582/(582+298), une erreur de métrique (létalité des cas résolus, pas le CFR). Post : https://x.com/BarryHunt008/status/2074873268163457107 — POSTÉ (validé par David).
> That 66% is resolved-case fatality (deaths / deaths+recoveries), not the CFR. Same numbers, crude CFR is 582/1,729 = 33.7%. The resolved ratio runs hot because deaths resolve faster than recoveries, and 849 cases are still open; the real figure settles between the two.

Vérification factuelle effectuée avant publication : bilan BNOFeed du 7/8 juil relu en direct (1 729 cas / 298 guéris / 582 morts), maths reconfrontées (582/1729=33,7% ; 849 actifs ; 582/880=66,1%).

**Suivi du fil @BarryHunt008 (même jour, continuation d'échange, hors quota cold-outreach)** : il a répondu à notre correction (« Yes, that's why I labeled it "Outcome" CFR. CFR on its own is meaningless in the early stages of a fast growing epidemic - seriously flawed concept »). Post : https://x.com/BarryHunt008/status/2075204522897560042 — POSTÉ (validé par David, règle de cadence clarifiée : ne s'applique qu'aux nouvelles approches, pas à la continuation d'un fil déjà engagé).
> Fair, but "meaningless" overstates it: crude CFR is right-censored early on, a known-direction underestimate. Your ratio overshoots the other way by excluding 849 open cases. Watching it climb, ~31% to 33.7% now, is the more useful signal.

---

### Replies engagement — 10 juillet 2026 — POSTÉES

Monitoring X quotidien. Incident technique initial (extension Chrome injoignable, timeouts sur navigate/screenshot y compris sur un onglet neuf) résolu après re-sélection du navigateur en début de session suivante. Réconciliation cadence : les 2 replies en file du 9 juillet (@MarionKoopmans, @BarryHunt008) étaient déjà postées, pas de file en attente. Un candidat reply (@Osint613, chiffre "4 patients sur 5 sans source tracée") a été écarté après vérification factuelle : chiffre introuvable dans WHO DON612/UN News/ECDC, compte relais géopolitique généraliste non spécialisé santé, angle redondant avec le post d'origine — voir [[feedback_verify_against_primary_source]]. **2 replies postées** (validées explicitement par David), quota 2/3.

**@MinofHealthUG (Ministry of Health Uganda, vérifié, déjà suivi)** — post du 10 juil (formation Government Communication Officers avec UNICEF sur les urgences de santé publique). Brouillon initial réécrit pour retirer la dépendance au chiffre Osint613 non vérifié, appuyé uniquement sur des faits confirmés (extension RDC à de nouvelles provinces, WHO DON612).
> Rehearsing the message before a case arrives is the part that pays off most in cross-border events. Uganda's importation risk tracks the outbreak's expansion into new provinces of DRC, not the screening posture at any single crossing point. The communication line that holds under pressure is the one agreed and drilled before the first imported case, not drafted after it.

**@FluTrackers (vérifié, déjà suivi)** — post du 10 juil (~8h) : « Turkey - In Tokat, Dursun Almamış, a father of two who was being treated for suspected Crimean-Congo Hemorrhagic Fever (CCHF), has died. » CFR Turquie CCHF vérifié via recherche web avant publication (4,8% moyenne 2017-2024, jusqu'à 7% années de pic ; zones endémiques cohérentes avec Tokat).
> Tokat sits in Turkey's north-central Anatolia CCHF belt, and mid-summer is peak tick-activity season, when the bulk of the country's annual cases and deaths cluster. Outcome turns heavily on time to care: Turkey's case fatality runs near 5 percent with early supportive management but climbs sharply when presentation is delayed. A suspected case in the endemic zone during this window argues for fast confirmation, not watchful waiting.

---

### Replies engagement — 8 juillet 2026 — POSTÉES

Monitoring X quotidien. Session avec incident technique initial similaire au 7 juillet (extension Chrome injoignable ~30 min, résolu via écran de confirmation switch_browser après plusieurs timeouts). @WHOAFRO avait un nouveau post (sitrep Bundibugyo) mais déjà engagé le 7 juillet, pas de nouvelle reply cette semaine sur ce compte. Découverte notable : un post Reuters citant 1 708 cas Ebola RDC a été confronté en direct au dernier WHO DON612 (1 460 RDC + 20 Ouganda, données au 1er juillet) et à nos propres notes (sitrep national RDC du 4 juillet à 1 561) — confirme que la DB HWG reflète fidèlement le dernier cycle WHO DON officiel, l'écart vient du décalage structurel sitrep national vs bulletin international, pas d'un bug de sync. **2 replies postées** (validées par David), quota 2/3. 5 comptes candidats proposés, 5 validés et suivis.

**@Reuters** — post du 8 juil : « Congo says number of confirmed Ebola cases rises to 1,708 » (32,3k vues). Post : https://x.com/Reuters/status/2074727762649096212 — POSTÉ (validé par David).
> Worth flagging for cross-checking: DRC's Ministry of Communication already reported 1,561 confirmed cases as of July 4, about 100 above the latest WHO Disease Outbreak News figure (1,460, data through July 1). National sitreps are running several days ahead of the international bulletin cycle right now, so 1,708 is plausible but best treated as provisional until the next WHO DON confirms it.

**@HelenBranswell** (journaliste STAT, déjà dans la liste "à suivre" mais pas encore suivie ce jour) — post du 7 juil sur les 298 morts pédiatriques grippe US 2024-25 (29,2k vues, délai de reporting CDC). Post : https://x.com/HelenBranswell/status/2074260941416390938 — POSTÉ (validé par David).
> Worth flagging the scale here: 298 already puts 2024-25 well above the previous record of 199, tied in 2019-20 and 2023-24, since CDC began national pediatric flu mortality surveillance in 2004. Given the lag pattern you're describing, this total will likely keep rising. Some deaths from this season may still be reported months from now.

Vérifications factuelles effectuées avant publication : WHO DON612 (fetch direct who.int) pour le chiffre RDC/Ouganda ; CDC FluView + MMWR/CIDRAP (recherche web) pour le record historique 199 (2019-20 et 2023-24).

---

### Replies engagement — 7 juillet 2026 — POSTÉES

Monitoring X quotidien. Session avec incident technique initial (extension Chrome injoignable, 3 timeouts de navigation résolus après reconnexion). Sujet dominant toujours Ebola RDC/Ouganda : nouvel angle repéré (déploiement de soignants ougandais vers la RDC, et non plus seulement réception d'aide), compte officiel gouvernemental non encore engagé. Choléra Soudan : aucune donnée nouvelle, mêmes chiffres du 6 juillet recyclés par des comptes relais. Recherche élargie mpox a mené (via un post de nomination Africa CDC) à repérer 2 comptes à très forte valeur jamais suivis : @Dr_JeanKaseya (DG Africa CDC) et @AfricaCDC elle-même. Au total 5 comptes candidats proposés sur la session, 4 validés et suivis (@MinofHealthUG, @SDN154, @Dr_JeanKaseya, @AfricaCDC), 1 laissé de côté par sélectivité (@NabusobaE, voir x-watchlist.md). Reply DrTedros écartée par choix qualité (angle trop général). **2 replies postées** (validées par David), quota 2/3.

**@GCICMediaReview (Government Citizens Interaction Centre, officiel @GovUganda, gcic.go.ug, 2 705 abonnés)** — post du 7 juil : « Uganda has deployed its first team of health workers to the Democratic Republic of Congo (DRC) to support efforts to contain the country's latest Ebola outbreak. » Post : https://x.com/GCICMediaReview/status/2074390947773743125 — POSTÉ (validé par David).
> Worth noting the other half of this deployment: WHO guidance calls for a 21-day symptom monitoring window after return, not just PPE while deployed. That return monitoring is often the weaker link in cross-border response chains, not frontline contact itself.

**@WHOAFRO (déjà suivi)** — post épinglé du 7 juil : « Good nutrition is vital to #Ebola recovery. @WHO and @WFP are working closely to strengthen the Ebola response... » Post : https://x.com/WHOAFRO/status/2074401031111242166 — POSTÉ (validé par David).
> Worth flagging why this detail matters operationally: in the same Ituri/North Kivu zones driving this outbreak's ~32% CFR, food insecurity was already acute before Ebola hit, so sourcing therapeutic nutrition for ETU patients competes with a supply chain already stretched by conflict and displacement. Nutritional status is one of the few CFR levers clinicians can influence once a patient is already infected.

---

### Replies engagement — 6 juillet 2026 — POSTÉES

Monitoring X quotidien. Sujet dominant toujours Ebola Bundibugyo RDC/Ouganda + choléra Soudan émergent. Fait structurant confirmé cette session (Bloomberg) : souche = **Bundibugyo (BDBV), pas Zaïre** — d'où absence de vaccin/monoclonal homologué et essai PARTNERS au CTE CME de Rwampara. Chiffres DRC (1 561 confirmés / 506 morts / CFR 32,4 % / suivi contacts 81,6 %) triangulés sur 3 sources concordantes (sitrep officiel @Com_mediasRDC = source primaire, roll-up BNO citant MoH, Bloomberg) ; cross-check dashboard live impossible (extension Chrome bloque healthwatch-global.com). Traction forte : @DianaAtwine (SP Santé Ouganda) a reposté + aimé la reply labos mobiles du 5 juil. **2 replies postées** (validées « tout » par David), quota 2/3 ; la 3e (angle corridor transfrontalier vers @kasujja) n'a pas pu être postée car il restreint les réponses sur ses posts.

**@Com_mediasRDC (Ministère de la Communication et Médias/RDC, officiel, vérifié, 327k abonnés)** — sitrep « POINT DE SITUATION EBOLA – 4 JUILLET 2026 » : 1 561 cas (+33), 506 décès (+14), 253 guéris, 628 en isolement, CFR 32,4 %, 81,6 % contacts suivis (Ituri/Nord-Kivu/Sud-Kivu). Post : https://x.com/Com_mediasRDC/status/2073989154883428859 — POSTÉ (validé par David). Reply en français (compte francophone officiel). Compte déjà suivi.
> Le suivi des contacts à 81,6 % sur trois provinces est l'indicateur décisif. Espèce Bundibugyo, sans vaccin ni monoclonal homologué contrairement à Zaïre : la maîtrise tient à l'isolement et au traçage, pas à la vaccination. Tenir 80 % à ce stade limite la transmission.

**@DropSiteNews (Drop Site, média d'investigation, vérifié)** — choléra Soudan : 30 morts, 800+ infectés au Kordofan Ouest depuis le 20 juin (Dar Hamar ER), spread confirmé par le ministère soudanais, co-circulation rougeole (SDN154). Post : https://x.com/DropSiteNews/status/2073950944643928382 — POSTÉ (validé par David). Diversifie hors Ebola (HWG couvre le choléra).
> The case-fatality ratio is the tell. Cholera is highly treatable; WHO's benchmark for a managed response is under 1%. Near 4% here (30 deaths in 800+ cases) points to rehydration not reaching patients, not a virulent strain. Co-circulating measles compounds child mortality.

**Non postée — @kasujja (Alan Kasujja, Executive Director Uganda Media Centre, vérifié)** — post « There are ONLY 2 cases of Ebola in Uganda… We had 20. We now have 2! ». Reply corridor transfrontalier rédigée et validée par David, mais **impossible à poster** : Kasujja restreint les réponses sur ses deux posts Ebola (« Seuls certains comptes peuvent répondre »). Compte tout de même suivi (veille). Angle à rediriger vers @WHOAFRO ou un roll-up multi-pays prochainement. Brouillon conservé :
> Driving Uganda from 20 to 2 active is a real contact-tracing win. The real pressure is external: the epicenter is across the border in DRC's Ituri, now at 1,561 confirmed and 506 deaths. Uganda's residual risk is a cross-border corridor, not a domestic caseload.

**Comptes suivis cette session (validés par David)** : @JaneRuth_Aceng (Dr Jane Ruth Aceng Ocero, décideur santé Ouganda, 558k abonnés, site health.go.ug), @kasujja (Uganda Media Centre, updates Ebola officiels). Détail dans x-watchlist.md.

---

### Replies engagement — 5 juillet 2026 — POSTÉES

Monitoring X quotidien. Sujet dominant toujours Ebola RDC/Ouganda (17e épidémie ; ~1 528 cas / 492 morts au 5 juil selon relais officiel à cross-check ; essai de traitement PARTNERS désormais lancé en RDC). Notifications = traction sur les replies du 4 juillet (likes de Ton Soons, Abraar Karan, Johanna Read +4). Aucune nouvelle mention directe. Recherche mpox/choléra/Marburg = bruit (usages idiomatiques, hors-sujet), pas de reply hors-Ebola. 2 replies postées (validées par David), quota 2/3.

**@DianaAtwine (Dr. Diana Atwine, Secrétaire Permanente Ministère Santé Ouganda, vérifié)** — déploiement de 2 labos mobiles + medics en RDC (initiative transfrontalière RDC/Ouganda pour réduire le déplacement des patients Ebola vers l'Ouganda). Post : https://x.com/DianaAtwine/status/2073677182338052318 — POSTÉ (validée par David). Compte aussi suivi cette session.
> The two mobile labs may be the higher-leverage piece here. Care-seeking movement usually reflects where confirmation and treatment are actually reachable, so bringing labs into the affected DRC health zones compresses the onset-to-confirmation interval on the Congolese side. That shrinks the pre-isolation transmission window and, over time, the reason to cross at all. The movement falls fastest when a patient can be diagnosed and treated before the decision to travel is even made.

**@USEmbassyUganda (U.S. Embassy Kampala, vérifié)** — relaie une citation de Joel Opio (CDC) au Biorisk Webinar @cphluganda : protéger les travailleurs de labo et sécuriser les labos comme rempart anti-épidémie. Post : https://x.com/USEmbassyUganda/status/2073663165796139035 — POSTÉ (validée par David).
> Worth adding why this is more than a safety point: health-worker and lab infections are among the earliest measurable signs an outbreak is outpacing its response. In the 2014-16 West Africa epidemic, more than 800 health workers were infected, and those clusters both amplified transmission and marked where case-finding had broken down. Securing the lab also protects diagnostic continuity, since a single compromised facility can stop confirmation and let the outbreak go dark in that zone.

**Comptes suivis cette session (validés par David)** : @inrb_kinshasa (labo national de référence RDC, DG Muyembe-Tamfum), @DianaAtwine (SP Santé Ouganda), @guinee_oms (OMS Guinée, vérifiée cette session), @ShamiRt2Health (Shamiso Zinzombe PhD, droit à la santé — follow-back). Détail dans x-watchlist.md.

---

### Replies engagement - 4 juillet 2026 - POSTEES

Monitoring X quotidien. Sujet dominant: epidemie Ebola Bundibugyo RDC/Ouganda (17e epidemie). @CIDRAP $3.6B deja traite le 1er juillet (non redraft). Aucune autre mention directe a traiter (1 seule: Ton Soons). 3e reply elargie a mpox (Sud-Kivu) pour diversifier au-dela d'Ebola. Quota 3/3 utilise, session terminee.

**@tah_soons (Ton Soons, verifie)** - a repondu a notre point T2/CFR dans le thread sitrep RDC ("Good catch... I've added a PARTNERS enrolment marker"). Contact epidemio haute valeur (tracker perso DRC/Uganda). Reply propose un discriminant NOUVEAU (composition des cas), pas T2/CFR deja dit. Thread: https://x.com/tah_soons/status/2072995406619807747 - POSTE (validee par David)
> A signal that helps separate the two without waiting for the trend to resolve: the share of new cases arising from listed contacts versus community deaths. If detection among registered contacts rises while community deaths fall, case-finding is lifting the denominator; if that composition stays flat while CFR drops, the treatment signal holds. At 82.7% contact-tracing coverage, that split should already be legible per health zone.

**@LeandreMurhula (epidemiologiste terrain, Bukavu Sud-Kivu RDC, non verifie mais profil credible)** - partage preprint medRxiv "Emergence and co-circulation of Monkeypox virus Clade Ia and Clade Ib in South Kivu, DRC, Jan-May 2026". Post: https://x.com/LeandreMurhula/status/2073355629045899406 - POSTE (validee par David)
> Co-circulation of Clade Ia and Clade Ib in the same health zone is the harder problem than either clade alone. The two call for different response strategies: contact tracing through sexual networks for Ib, household and animal-contact investigation for Ia. Standard mpox PCR confirms the genus, not which clade is driving the local case curve, and that distinction typically needs reference-lab sequencing rather than being resolved at the point of care.

**@Tuko_co_ke (TUKO.co.ke, media Kenya, verifie)** - screening intensifie a la frontiere Malaba/Busia (Kenya-Ouganda) suite a Ebola RDC; 1 500 a 2 000 voyageurs/jour, PPE/thermal guns de KEMRI. Post: https://x.com/Tuko_co_ke/status/2073326967860998278 - POSTE (validee par David)
> Intensified screening at Malaba is the right instinct for a crossing moving 1,500 to 2,000 people a day. The limit worth naming: thermal scanning catches febrile travellers, but Ebola's incubation runs up to 21 days, so an infected person can clear the checkpoint while still asymptomatic. The region saw it in 2019, when the DRC outbreak reached Uganda despite screening in place. The durable backstop is traveller registration and cross-border contact follow-up, not the thermal gun alone.

---

### Replies engagement â€” 1er juillet 2026

**@OMSRDCONGO** (visite Sota Ituri, confiance communautaire Ebola, Dr. @anne_anciiaWHO) â€” POSTÃ‰ âœ…
> La confiance communautaire n'est pas un facteur soft. Dans l'Ã©pisode 2018-2020 en Ituri et Nord-Kivu, les zones de santÃ© avec le taux de refus le plus Ã©levÃ© avaient systÃ©matiquement un CFR plus Ã©levÃ© : les familles prÃ©sentaient les malades tardivement, ou pas du tout. Restaurer la confiance Ã  Sota, c'est directement comprimer le CFR dans cette zone de santÃ©.

**@WHO_Tanzania** (BVD preparedness Songwe 76 Ã  86%, screening Tunduma 3 497 voyageurs DRC) â€” POSTÃ‰ âœ…
> Tunduma screening is the right instinct for overland movement. The harder entry point is Lake Tanganyika: ferries from Kalemie and Uvira (South Kivu, active outbreak zone) to Kigoma run regular commercial routes and are significantly harder to screen than a single land border post. The 76 to 86% preparedness gain in Songwe is meaningful. The lake corridor is where the gap likely sits.

**@DrIanWeissman** (Ebola spreads to 4th province DRC, 15M people northeast) â€” POSTÃ‰ âœ…
> The fourth province matters less as a count than as a question of health zone capacity. Ituri and North Kivu have functional ETCs and INRB access. A newly affected province in northeast DRC almost certainly does not. Contact tracing at 82.7% nationally masks what that rate looks like where response infrastructure is being built from scratch.

**@CIDRAP** (Ebola outbreak $3.6 billion economic cost, UN warns) â€” POSTÃ‰ âœ…
> The $3.6 billion figure is the behavioral avoidance effect as much as the direct health cost. The 2014 West Africa epidemic showed that economic damage in non-affected neighboring countries exceeded direct losses in Guinea, Sierra Leone and Liberia. Aviation, trade corridors and cross-border investment contract before the outbreak reaches those countries. The containment investment required to prevent that is orders of magnitude smaller.

**@richardhirschs1 (Dr Richard Hirschson)** (Marburg potential case Western Uganda + infographic CFR) â€” POSTÃ‰ âœ…
> "Deadliest virus" needs an episode footnote. Marburg CFR ranges from 24% (1967 index outbreak, Germany/Yugoslavia) to 90% (Angola 2005). The bar in this graphic reflects Angola. A potential case in Western Uganda, with the Ebola Bundibugyo response already stretching regional VHF capacity, is the real concern regardless of where on that range it lands.

**@Com_medias (MinistÃ¨re Communication DRC)** (Point de situation Ebola 29 juin â€” 1 333 cas, CFR 29,7%, gratuitÃ© soins Ituri) â€” POSTÃ‰ âœ…
> Free care in Ituri's four priority zones is the most significant decision in this report. Financial barriers to care-seeking push patients to present at late disease stage, which directly inflates CFR. If the 82.7% contact tracing rate holds, the combination should start showing in the case fatality trajectory within 2 to 3 weeks.

**@WHOAFRO** (tweet "The latest #Ebola situation report...") â€” POSTÃ‰ âœ…
> Week 6 data: 1,048 confirmed cases. CFR 25.5% in DRC vs. 14.3% in Uganda. Same strain. The gap is surveillance depth, not pathogen lethality. North Kivu at 54.9% CFR is the sharpest signal in the report.

---

### Replies engagement â€” 26 juin 2026

**@CIDRAP** (tweet "Africa CDC triples amount needed to fight Ebola") â€” âœ… PRÃŠT Ã€ POSTER
> @CIDRAP Current Ebola picture: 916 cases Â· 234 deaths Â· 25.5% CFR Â· 2 active outbreaks Â· 2 countries (June 26). Real-time IHR-classified tracking: healthwatch-global.com/en/disease/ebola-virus-disease

**@HelenBranswell** (tweet "clinical trial Bundibugyo DRC") â€” âœ… PRÃŠT Ã€ POSTER
> @HelenBranswell The scale context: 916 confirmed cases, 234 deaths, 25.5% CFR â€” 2 active outbreaks across 2 countries as of today. No licensed treatment for Bundibugyo makes the trial timeline critical. Tracking in real time: healthwatch-global.com/en/disease/ebola-virus-disease

**@ReutersWorld** (tweet "Congo confirmed Ebola cases rises to 1,155") â€” â³ ATTENDRE dashboard update
Dashboard affiche 916, Reuters cite 1,155 (chiffres gouvernement DRC, DON OMS pas encore publiÃ©). Attendre que sync-outbreaks intÃ¨gre le nouveau DON, puis rÃ©pondre avec chiffres cohÃ©rents.

---

## Indie Hackers

### Post LinkedIn (25 juin 2026) â€” PUBLIÃ‰ âœ… 25 juin 2026

**Engagement J+1 (26 juin) :**
- Like organique : **Nicole Wehbe, MPH** â€” Program & Operations Specialist, Global Health, Generator Health / BU School of Public Health, Atlanta. Profil cible exact (NGO health coordinator). DM envoyÃ© 26 juin.

**DM Nicole Wehbe â€” envoyÃ© 26 juin 2026 (EN) :**
> Hi Nicole, thanks for the like on the launch post â€” glad it resonated.
>
> Your Global Health / Capacity Building background is exactly the profile we had in mind when building HealthWatch Global. Happy to have you in the network.

**Version EN (publiÃ©e) :**

HealthWatch Global officially launched today.

Six months ago, I was watching field epidemiologists manually check 4 sources every morning: WHO DON. ECDC. PAHO. Africa CDC. One by one. Copy-pasting into spreadsheets. No aggregation, no risk scoring, no single view.

That's a tooling problem. I built the tool.

What HealthWatch Global does:
â†’ One dashboard for WHO, ECDC, PAHO and Africa CDC â€” updated 4x/day
â†’ Automated IHR tier classification (Immediate / Rapid / Surveillance)
â†’ Email alerts by disease, country, or risk level
â†’ 5 languages: EN, FR, ES, AR, ID
â†’ PDF reports, RSS feeds, embeddable widget

Built for: IHR national focal points, health ministry surveillance teams, NGO health coordinators, corporate risk managers.

Solo founder. First paying customer last week. A handful of trial users from WHO AFRO, Institut Pasteur, and KEMRI.

If you work in global health, outbreak response, or international crisis management â€” your feedback would mean a lot. The market is small (maybe 5,000 people in the world need this exact tool). But those 5,000 people make decisions that affect millions.

ðŸ‘‰ healthwatch-global.com â€” 30-day Pro access, no card required.

---

## LinkedIn

### Post — 15 juillet 2026 (mercredi) — rougeole Guatemala / artefact de surveillance — PUBLIÉ ✅ (par David, confirmé « c'est posté »)

**⚠️ Remplace le post Rougeole/Mexique Coupe du Monde, déclaré OBSOLÈTE ce jour** (voir section « TEST lien en corps de post » plus bas, statut mis à jour). Motif : le hook (« Mexico is hosting World Cup matches this month ») est mort. Le dernier match joué en territoire mexicain était le **5 juillet** (Estadio Azteca, 8e de finale) ; depuis les quarts de finale, tout le tournoi se joue aux États-Unis, et il se termine le 19 juillet. Un lecteur du 15/07 lirait le présent continu comme un événement en cours : factuellement faux. Les données du post restaient bonnes, c'est le cadrage qui a péri en attendant deux reports.

**Sujet choisi :** rougeole au Guatemala, angle « la courbe qui mesure le système de surveillance plutôt que l'épidémie ». Sujet frais (jamais couvert), distinct de Rougeole/US du 10/07 (angle statut d'élimination), de Rougeole/Mexique (angle mobilité/Coupe du Monde) et de la méningite du 13/07 (autre maladie, angle écart de létalité). Le fil conducteur « la loudest outbreak n'est pas la seule qui compte » est réutilisé mais sous un cadrage neuf : ici le sujet n'est pas l'écart de létalité, c'est la comparabilité des indicateurs entre pays.

**Source des données (étape 1, vérifiée mot pour mot contre le PDF primaire ce 15/07) :** PAHO Situation Report No.6, `measles-sitrep6-2july-2026.pdf`, période SE1–SE25 2026 (arrêt au 27 juin). Sitrep #7 vérifié comme **non publié à ce jour** (cadence bimensuelle #5 18/06, #6 02/07), le #6 reste donc la source primaire la plus récente. PDF téléchargé et parsé via `pdf-parse` (WebFetch échoue à le rendre).
- Table 3 : Mexique 11 820 cas / 16 décès (↓ declining) ; **Guatemala 7 067 cas confirmés labo / 22 décès**, + « 16,350 cases with clinical criteria and epidemiological linkage », transmission « across all 22 departments » ; États-Unis 2 134 / 0 ; Pérou 737 / 0.
- Régional : 22 974 cas / **39 décès** / 17 pays (+181 % vs 2025). Guatemala = 22 des 39 décès, soit le bilan le plus lourd de la région, devant le Mexique (16).
- Table 4 (Rt, as of EW25) : Mexique 0,66 [0,61–0,72] ↓ declining ; États-Unis 0,62 [0,51–0,76] ~ stabilizing ; **Pérou 1,35 [1,23–1,47] ↑ increasing** (seul foyer modélisé au-dessus de 1, concentré à Puno) ; **Guatemala et Canada : « Modeling not performed »**.
- Footnote 4 : protocole V3 du MSPAS guatémaltèque, 16 mars 2026, plus de prélèvement labo pour les cas cliniques/liés épidémiologiquement → « recent weekly trends may be affected by changes in surveillance and testing practices ».
- Pilier vaccination : Mexique « more than 34 million doses have been administered ».

**✅ PRÉREQUIS LEVÉ — lignes Guatemala et Pérou insérées en prod le 15/07 sur feu vert explicite de David (« Ajoute les lignes Pérou et Guatemala »).** Le post cite ces deux pays, or ni l'un ni l'autre n'existait en base : la couverture rougeole/Amériques active se limitait à Mexique + États-Unis, donc le CTA « données complètes sur healthwatch-global.com » aurait envoyé le lecteur vers une page sans Guatemala. C'est réparé, le CTA tient.
- **Guatemala** (`id 51c29586`) : 7 067 cas / 22 décès, `risk_level: high`, date 2026-06-27, source sitrep #6, `is_seed: false`.
- **Pérou** (`id 32d62690`) : 737 cas / 0 décès, `risk_level: medium`, date 2026-06-27, source sitrep #6, `is_seed: false`.
- `risk_level` **non choisi à la main** : valeurs alignées sur ce que `assessRisk()` (`lib/outbreak-parser.ts:437`) retournerait, pour qu'un futur passage de cron ne les inverse pas. Guatemala → `high` par la règle `deaths >= 20` ; Pérou (737 cas, 0 décès) → `medium` par défaut, cohérent avec le Mexique (16 décès < 20, CFR faible).
- **Traductions** : générées via l'API MyMemory avec la logique exacte de `lib/translate.ts`. **Piège rencontré : MyMemory plafonne à 500 caractères et renvoie `null` silencieusement au-delà** (erreur 403 dans un corps HTTP 200) — les deux descriptions ont été calibrées à 482 et 465 caractères, avec assertion bloquante dans le script. Les 4 langues (fr/es/ar/id) sont bien remplies, relues une à une. **Correction post-insertion :** MyMemory traduisait « through epidemiological week 25 » par « **au cours de** la semaine 25 », ce qui faisait passer des chiffres cumulés depuis janvier pour des chiffres hebdomadaires — corrigé en « cumulés jusqu'à la semaine 25 » sur les deux lignes FR (l'espagnol, lui, avait juste : « hasta la semana »).
- **⚠️ `created_at` volontairement daté au 2026-07-02 (date de publication du sitrep #6), pas à aujourd'hui.** Motif : `regional-alerts` (`app/api/cron/regional-alerts/route.ts`, quotidien 06h30 UTC) sélectionne **uniquement** sur `created_at >= now-25h` + `active`, sans aucun garde-fou de déduplication, et envoie un email intitulé « **Nouveau foyer** » / « New outbreak ». Insérer ces lignes avec un `created_at` du jour aurait envoyé demain matin aux abonnés Amériques une alerte factuellement fausse : ces épidémies courent depuis des mois, ce sont des lignes de rattrapage, pas des événements nouveaux. `push_notified_at` daté pareil pour neutraliser `push-alerts` (qui, lui, a bien un garde-fou de fenêtre 25h documenté pour exactement ce cas). Le code traite déjà `created_at` comme la date d'apparition du foyer, ce datage est donc cohérent avec sa propre sémantique. **Si David veut au contraire alerter délibérément les abonnés sur le Guatemala, c'est une décision séparée : il suffit de repasser `created_at` à maintenant.**

**LinkedIn (EN)** — langue tranchée par David le 15/07 (« Pour en FR ET pas en EN le post ? »). Le log montrait un usage **mixte** FR/EN sans norme établie ; le FR de la v1 était un défaut hérité des deux derniers posts, pas un choix raisonné. EN retenu : audience santé publique internationale, compte X en EN par principe, sujet latino-américain, source anglophone, et le post Mexique remplacé était lui-même en EN.
> The deadliest measles outbreak in the Americas is not the one making headlines.
>
> Mexico gets the attention: 11,820 confirmed cases in 2026, a massive vaccination response with more than 34 million doses administered, and a clearly declining trend (estimated Rt of 0.66).
>
> Guatemala reports fewer confirmed cases, 7,067. But 22 deaths, against Mexico's 16. On its own it carries 22 of the 39 measles deaths recorded across the entire region this year.
>
> And one number changes how you read it: 16,350 additional cases meeting clinical criteria or with an epidemiological link have been registered in the country, on top of the confirmed ones. Transmission spans all 22 departments.
>
> Where does the gap come from? Since 16 March, Protocol V3 from Guatemala's health ministry no longer calls for laboratory sampling of cases that are clinically compatible or linked to a known case. The published figures therefore count only laboratory-confirmed cases. PAHO says it plainly: recent trends in Guatemala must be interpreted with caution.
>
> That is also why PAHO publishes no Rt for Guatemala, while it models one for Mexico, the United States and Peru. Those probable cases do not compare like for like with neighbours' confirmed counts, but they say something Guatemala's official curve does not.
>
> The useful point for a surveillance team: when a country changes its case definition mid-outbreak, its curve stops measuring the epidemic and starts measuring its surveillance system. Two countries are only comparable on an indicator they build the same way.
>
> A decline can be a real decline. It can also be a change of protocol.
>
> Source: PAHO, Situation Report No. 6, Measles in the Americas Region, 2 July 2026, data through 27 June.
>
> Full data, updated continuously: healthwatch-global.com

**Version FR (écartée, conservée pour archive)** — même contenu, si jamais un post FR est souhaité plus tard : hook « Le foyer de rougeole le plus meurtrier des Amériques n'est pas celui dont on parle. », clôture « Une baisse peut être une vraie baisse. Elle peut aussi être un changement de protocole. » 1 968 caractères.

**Double-check :** chaque chiffre confronté ligne à ligne au PDF primaire OPS #6 (pas à la DB HWG, pas à un post tiers, pas à une mémoire) ; **version EN publiable : 1 785 caractères** (limite LinkedIn 3 000) ; 10 paragraphes séparés par des sauts de ligne, aucun bloc dense ; **zéro tiret cadratin vérifié par regex** ; pas de ProMED ; pas de faux témoignage ; lien en corps de post, pas de CTA agressif. **Pièges d'exactitude explicitement évités :** (1) ne dit PAS que le Guatemala est le « plus grand » foyer, seulement le plus **meurtrier** (22 > 16 décès, seul claim soutenu par la Table 3) — additionner 7 067 + 16 350 pour dépasser le Mexique serait malhonnête, le 11 820 mexicain étant lui aussi confirmé-labo uniquement ; (2) la non-comparabilité des cas probables est dite explicitement dans le post ; (3) le Rt Pérou est attribué à la modélisation OPS arrêtée à la SE25, jamais asserté comme vrai « aujourd'hui » (données vieilles de ~3 semaines).

---

### 🟢 Donnée fraîche repérée le 16/07 — Ebola France : patient guéri, angle jamais utilisé

Pour `linkedin-hwg-content-proposal` (à évaluer à l'Étape 1, pas présentée comme un brouillon prêt) : le seul cas Ebola importé en Europe sur cette flambée (souche Bundibugyo, médecin revenant de RDC, France) est officiellement **guéri et sorti de l'hôpital Bichat (Paris) depuis le 4 juillet 2026** — annoncé par la ministre de la Santé, confirmé par France Info/CNEWS/Euronews (2 PCR négatifs, symptômes restés légers tout du long). Jamais couvert dans le contenu de marque : le brouillon LinkedIn juste ci-dessous (13/07, désormais obsolète) la présentait comme un cas encore en suivi. Ligne DB prod `020b129c-d283-4a2c-a95b-3827322a77c1` mise à jour en conséquence le 16/07 (`recovered=1`, `response_phase=contained`, `updated_at` du jour — devrait remonter en tête de la requête Supabase de l'Étape 1). Source France Info : https://www.franceinfo.fr/sante/maladie/ebola/le-premier-cas-d-ebola-en-france-est-gueri-et-sorti-de-l-hopital-annonce-la-ministre-de-la-sante_8093969.html

**Angle potentiel, non rédigé :** issue positive d'un cas importé européen — illustre que surveillance + isolement précoce fonctionnent, contraste utile avec le fardeau RDC (2 011 cas/754 décès) déjà couvert deux fois cette semaine côté X (pas encore côté LinkedIn). Sujet spécifiquement francophone (Santé publique France, foyer en France) — envisager une rédaction en FR par exception, comme prévu dans la règle de langue par défaut. À vérifier/creuser si retenu (durée exacte d'hospitalisation, éléments cliniques additionnels) avant rédaction — rien de prêt à publier ici, juste le signal. (Même signal transmis à `x-hwg-content-proposal`, voir tout en haut de ce fichier, section X/Twitter.)

---

### Post — 13 juillet 2026 — Ebola RDC/Ouganda/France — 2e run du jour — **OBSOLÈTE, vérifié le 16/07, NE PAS PUBLIER TEL QUEL**

**⚠️ Note d'origine :** paire du post X Ebola ci-dessus (même session). Le post méningite du 13/07 était déjà PRÊT et PUBLIÉ avant le déclenchement de cette session — celui-ci est un brouillon supplémentaire, pas un remplacement. À David de décider du calendrier.

**⚠️ Obsolète constaté le 16/07 (en vérifiant le contenu marketing préparé) :** ce brouillon n'a jamais été mis à jour ni flaggé, contrairement à son équivalent X (voir l'« Étape 0 » tout en haut de ce fichier, qui déclare le brouillon X du 13/07 obsolète pour les mêmes raisons). Les 3 chiffres sont aujourd'hui faux ou trompeurs :
- **RD Congo 1 460/452 → en réalité 2 011/754** (sitrep national du 13/07, en base depuis le 15/07). L'écart de létalité mis en avant dans le post (31 % vs 10 %) est lui-même dépassé : le CFR RDC réel est maintenant ~37,5 % et a fait l'objet d'un thread X dédié, déjà publié (« dérive du CFR brut », voir tout en haut de ce fichier) — republier l'ancien 31 % irait à l'encontre de ce thread déjà en ligne.
- **Ouganda 20/2** — ce chiffre-là est correct (vérifié le 15/07 contre DON612 + ECDC), mais la ligne DB elle-même avait entre-temps affiché 21/3 par erreur pendant ~24h (corrigé) — coïncidence de calendrier à noter si ce post est un jour réutilisé.
- **France 1/0, cadré comme suivi en cours ("la surveillance ne s'arrête pas aux frontières")** — le patient est en réalité **guéri et sorti de l'hôpital depuis le 4 juillet** (ministre de la Santé, 3 sources concordantes). Le chiffre brut (1 cas, 0 décès) reste exact mais le cadrage narratif ("cas importé... suivi") est maintenant inexact.

Si un post LinkedIn sur ce sujet est encore souhaité, il faudrait soit le rebâtir avec les chiffres du 16/07, soit adapter pour LinkedIn le thread X « dérive du CFR » déjà publié — pas publier ce brouillon en l'état.

Données étape 0 d'origine (périmées) : RD Congo 1 460/452, Ouganda 20/2, France 1/0, sources DON612 et Santé publique France, toutes `is_seed:false`.

**LinkedIn (FR)**
> Une même épidémie d'Ebola, souche Bundibugyo (bulletin OMS DON612), touche trois pays avec des profils radicalement différents.
>
> RD Congo : 1 460 cas, 452 décès (létalité 31 %)
> Ouganda : 20 cas, 2 décès (létalité 10 %)
> France : 1 cas importé, 0 décès (Santé publique France, 25 juin)
>
> Trois points ressortent de ces chiffres, mis à jour dans notre base entre le 8 et le 13 juillet.
>
> La RD Congo concentre à elle seule plus de 98 % des cas confirmés et plus de 99 % des décès de cette flambée. C'est là que se joue l'essentiel de la réponse sanitaire, même si l'attention se porte souvent ailleurs.
>
> L'écart de létalité entre RD Congo et Ouganda, 31 % contre 10 % pour la même souche virale, ne s'explique pas par une différence de virulence. Il reflète plutôt l'accès aux soins et le délai de prise en charge. Un taux de létalité qui varie autant d'un pays à l'autre est un indicateur de système de santé, pas de pathogène.
>
> Enfin, un cas importé en France dans la même fenêtre de temps rappelle que la surveillance ne s'arrête pas aux frontières de la zone d'épidémie active. Le suivi des voyageurs et la détection précoce restent le maillon qui relie une flambée régionale à un risque international, même quand les volumes de cas restent très asymétriques.
>
> HealthWatch Global agrège en continu ces données, OMS, ECDC, PAHO, Africa CDC, OMS AFRO/EMRO, pour donner aux équipes de veille sanitaire une vue consolidée, sans attendre le prochain bulletin.
>
> Données complètes, mises à jour en continu : healthwatch-global.com

**Double-check LinkedIn :** chiffres confrontés ligne-à-ligne à l'étape 0 (RDC 1 460/452→31 %, Ouganda 20/2→10 %, France 1/0 ; part RDC 1460/1481=98,6 % des cas et 452/454=99,6 % des décès, arrondis à 98 %/99 %) ; aucun tiret cadratin, points et virgules uniquement ; ton analytique non alarmiste ; pas de ProMED ; pas de faux témoignage ; distinct du post Ebola du 24 juin (angle vaccin Ervebo, chiffres au 21 juin) ; longueur adaptée LinkedIn ; lien en fin de corps.

---

### Post — 13 juillet 2026 (lundi) — méningite ceinture africaine — PUBLIÉ ✅ (override ponctuel, publié par l'agent sur demande explicite de David : « Publie toi le post Linked »)

Paire du post X du 13/07 ci-dessus (même sujet, adapté au format LinkedIn : plus long, FR, ton professionnel, ponctuation sans tiret cadratin). Données étape 0 identiques (bulletin OMS méningite semaine 25, `is_seed:false`, frais du 13/07).

**✅ Séquençage tranché par David le 13/07 (Option B) :** méningite publié aujourd'hui (lundi 13/07). Le post rougeole/Mexique déjà validé (voir section plus bas) glisse à mercredi 15/07.

**LinkedIn (FR)**
> Pendant que l'attention se concentre sur Ebola, une épidémie plus large et presque invisible traverse le Sahel.
>
> La ceinture africaine de la méningite. Chaque saison sèche, de décembre à juin, la méningite bactérienne remonte à travers une bande de pays allant du Sénégal à l'Éthiopie. Les vents secs et chargés de poussière de l'Harmattan fragilisent les muqueuses respiratoires et favorisent la transmission de Neisseria meningitidis.
>
> Le dernier bulletin OMS (semaine 25) donne l'ampleur actuelle sur quatre pays suivis par HealthWatch Global :
>
> Burkina Faso : 1 449 cas, 61 décès
> Nigéria : 1 396 cas, 84 décès
> Tchad : 968 cas, 68 décès
> Soudan du Sud : 92 cas, 7 décès
>
> Soit environ 3 900 cas et 220 décès, pour une maladie évitable par vaccin et traitable par antibiotiques.
>
> Le signal le plus utile pour un décideur n'est pas le nombre de cas. C'est l'écart de létalité entre pays, de 4,2 % au Burkina Faso à 7,6 % au Soudan du Sud. La méningite à méningocoque peut tuer en 24 à 48 heures sans traitement. À ce stade, la létalité ne mesure pas la virulence de la bactérie, elle mesure le délai d'accès aux soins. Un CFR qui monte, c'est une chaîne de prise en charge qui s'allonge, pas un pathogène plus dangereux.
>
> Un point de contexte souvent oublié : le vaccin MenAfriVac a quasiment éliminé le sérogroupe A de la ceinture après 2010. Les épidémies actuelles sont portées par d'autres sérogroupes, C, W et X, contre lesquels la couverture vaccinale reste partielle. La menace n'a pas disparu, elle a changé de forme.
>
> L'épidémie qui fait les titres est rarement la seule qui compte.
>
> Données complètes, mises à jour en continu : healthwatch-global.com

**Double-check LinkedIn :** chiffres confrontés ligne-à-ligne à l'étape 0 (BF 1 449/61, Nigéria 1 396/84, Tchad 968/68, Soudan du Sud 92/7 ; total ~3 900/220 ; CFR BF 61/1449=4,2 %, Soudan du Sud 7/92=7,6 %) ; aucun tiret cadratin, points et virgules uniquement ; ton analytique non alarmiste ; sérogroupe A/C/W/X en contexte historique vérifié (web), non attribué aux chiffres 2026 ; pas de ProMED ; pas de faux témoignage ; longueur adaptée LinkedIn ; lien en fin de corps.

---

**Compte :** David Deheunynck
**Relations :** 28
**Posts planifiÃ©s :** 4 (calendrier dans `linkedin-calendar.md`)

### Post 2 â€” Ebola Bundibugyo (24 juin 2026) â€” PUBLIÃ‰ âœ… 24 juin ~17h CEST â€” chiffres dashboard HWG (1,792 cas / 464 morts / 26% CFR, updated June 21)

**Ton :** Ã©ducatif, aucune mention explicite de HealthWatch (laisse la curiositÃ© sur le profil)

**Version EN (publiÃ©e profil David) â€” chiffres vÃ©rifiÃ©s WHO DON608 :**

---

The only approved Ebola vaccine doesn't cover the current DRC outbreak.

Ervebo (rVSV-ZEBOV) was developed during the 2018â€“2020 crisis in DRC. It works against ZaÃ¯re strain â€” not what's circulating now.

The active outbreak: Ebola Bundibugyo. 915 confirmed cases. 234 deaths. Case fatality rate: 26% â€” up from 17.7% when WHO declared the PHEIC six weeks ago.

Bundibugyo was first identified in Uganda in 2007. No approved vaccine exists for it. Response relies entirely on isolation, contact tracing, and ring vaccination trials with candidates that haven't completed Phase III.

Three things that rarely appear in outbreak reporting but define the response:
â†’ Strain (determines vaccine options and historical CFR reference ranges)
â†’ CFR trajectory (a rising rate signals undercounting of deaths, delayed case detection, or both)
â†’ Which health zones are affected (controls whether existing ring-vaccination logistics apply)

The PHEIC gives WHO authority to issue temporary recommendations. What it doesn't give: a vaccine that covers this strain.

**1er commentaire :**
Data updated every 6 hours on HealthWatch Global â€” including strain, CFR and affected health zones:
healthwatch-global.com/en/disease/ebola

---

**Version FR (post alternatif) :**

Trois espÃ¨ces d'Ebola. Trois protocoles de rÃ©ponse diffÃ©rents.

La plupart des alertes disent simplement Â« Ebola dÃ©tectÃ© Â».

Mais pour un point focal national dans un pays voisin, l'espÃ¨ce change tout.

**Ebola Zaire (EBOV)**
TLC : 25â€“90 %. Vaccins approuvÃ©s (ERVEBO, Ad26.ZEBOV/MVA-BN-Filo).
2014 Afrique de l'Ouest : 28 616 cas.
RÃ©ponse RSI : vaccination en anneau, coordination transfrontaliÃ¨re immÃ©diate.

**Ebola Sudan (SUDV)**
TLC : 41â€“65 %. Aucun vaccin approuvÃ© (candidats en essai).
2022 Uganda : 142 cas confirmÃ©s avant confinement.
RÃ©ponse RSI : surveillance renforcÃ©e â€” pas d'option de vaccination.

**Ebola Bundibugyo (BDBV)**
TLC : 25â€“47 % dans les foyers documentÃ©s (Uganda 2007 : 25 %, RDC 2012 : 47 %).
GÃ©ographiquement concentrÃ© dans les deux Ã©pisodes connus.
RÃ©ponse RSI : similaire Ã  SUDV â€” confinement en prioritÃ©, pas de vaccin.

Ce que Â« dÃ©tection Ebola Â» signifie pour votre Ã©quipe de rÃ©ponse dÃ©pend entiÃ¨rement de laquelle des trois espÃ¨ces il s'agit.

La plupart des outils de surveillance les regroupent. Le DON OMS, lui, ne le fait pas. C'est l'Ã©cart qui compte.

Que vous pilotiez une Ã©quipe de surveillance ministÃ©rielle, coordonniez pour une ONG internationale, ou gÃ©riez une fonction de risk management corporate â€” les premiÃ¨res 24 heures d'un Ã©vÃ©nement Ebola sont celles qui dÃ©finissent votre rÃ©ponse. Et l'espÃ¨ce virale est le premier point d'interprÃ©tation.

---

### Post 3 â€” Reporting delays (26 juin 2026) â€” PUBLIÃ‰ âœ… 26 juin 2026

**Ton :** Ã©ducatif, donnÃ©es chiffrÃ©es rÃ©elles, aucune mention de HealthWatch
**Corrections appliquÃ©es :** Ebola 2014 "16 jours" â†’ "plus de 3 mois" (vÃ©rifiÃ© WHO DON 23 mars 2014) ; URGSS â†’ USPPI/PHEIC ; CTA commentaire ajoutÃ© ; traduit EN

---

Between the first case in the field and a WHO Disease Outbreak News: sometimes 5 days. Sometimes 3 months. Here's why both are structurally normal.

The answer varies by disease, country, and local laboratory capacity. But patterns from the last decade paint a clear picture.

**Ebola:** Median DON publication delay after laboratory confirmation: 5 to 8 days for DRC episodes since 2018 (strengthened INRB capacity). 2014 West Africa epidemic: more than 3 months between the first documented case (December 2013, Meliandou, Forest Region of Guinea) and the first WHO DON (March 23, 2014).

**Mpox (2022):** Detection in May â†’ PHEIC declaration in July. More than 60 days between the signal and formal recognition. This lag structured the first weeks of response in countries without active surveillance.

**Lassa fever:** Often reported in quarterly aggregates by the Nigeria CDC. Individual cases only reach the DON when alert thresholds are crossed. Possible lag: 4 to 6 weeks.

**Cholera:** DONs are regularly published 3 to 4 weeks behind field data â€” due to verification steps between the Ministry of Health and the regional WHO office.

This delay is not a malfunction. It's a structural artifact: laboratory confirmation, notification to the National IHR Focal Point, escalation to the regional office, validation, publication. Each step is necessary. Each step takes time.

For teams operating upstream of these delays, the question is no longer "when will WHO publish?"

It's: "what source are we monitoring in the meantime?"

*What reporting delay has surprised you the most in your practice?*

#Epidemiology #GlobalHealth #DiseaseSurveillance

---

### Post 4 â€” CFR : une variable, pas un chiffre (1er juillet 2026) â€” PUBLIÃ‰ âœ… 1er juillet 2026

**Ton :** analytique, donnÃ©es OMS/ECDC/INRB, aucune mention de HealthWatch

---

Le CFR d'un foyer n'est pas un chiffre. C'est une variable.

Selon la source, la dÃ©finition de cas retenue et la phase de l'Ã©pidÃ©mie, le mÃªme foyer peut afficher des taux de lÃ©talitÃ© trÃ¨s diffÃ©rents.

**Marburg Uganda 2023 :**
CFR OMS officiel : 86,7 % (13/15 cas confirmÃ©s)
CFR ECDC : 72 % (inclut cas probables)
CFR historique global Marburg : 24 Ã  88 % selon les Ã©pisodes

**Ebola RDC 2022-2024 :**
CFR cas confirmÃ©s (Ã©pisode Ã‰quateur) : 57 %
CFR avec probables et suspects : 42 %
Les deux chiffres sont corrects. Ils ne mesurent pas la mÃªme chose.

**Mpox clade I RDC (2024) :**
CFR global tous Ã¢ges : 3,6 % (donnÃ©es MinistÃ¨re de la SantÃ© RDC)
CFR < 1 an : 8 Ã  10 % (donnÃ©es INRB)
CFR adultes > 15 ans : < 1 %
Le chiffre global masque la distribution par Ã¢ge â€” critique pour prioriser la vaccination.

Ce que cette variabilitÃ© implique pour la rÃ©ponse :

Un CFR de 5 % sur un foyer Ebola dans un pays avec accÃ¨s limitÃ© aux soins intensifs impose une prÃ©paration trÃ¨s diffÃ©rente d'un CFR de 5 % sur un foyer H5N1 dans un contexte de surveillance active.

La lÃ©talitÃ© brute est un signal.
Le contexte est le protocole.

---

## Product Hunt

**Date de lancement :** 25 juin 2026 â€” 09h01 CEST
**Maker comment :** voir `ph-launch-content.md`
**Assets complets :** voir `producthunt.md`

**Reddit :** abandonnÃ© (dÃ©cision 23 juin 2026)

---

## Emails institutionnels

**Vague 1 (25 juin) :** 12 emails complets avec contacts + placeholders â€” voir `institutional-emails-25juin.md`
**Vague 2 (30 juin) :** 9 emails prÃªts âœ“ â€” voir `institutional-emails-30juin.md` (MSF/Epicentre, IRC, PIH, ACF, IMC + JHU, Harvard, INSP, IRD)
**Vague 3 (7â€“11 juillet) :** 4 emails prÃªts âœ“ â€” voir `institutional-emails-july-wave3.md` (Oxfam, CARE, Samaritan's Purse, World Vision)
**Relance J+10 (5 juillet) :** batch 1 â€” templates dans `project_institutional_outreach.md` ligne 189
**Relance J+10 (10 juillet) :** batch 2 â€” templates dans `institutional-emails-30juin.md` derniÃ¨re section
**Relance J+10 (17â€“21 juillet) :** batch 3 â€” templates dans `institutional-emails-july-wave3.md` derniÃ¨re section
**Playbook J-0 :** `marketing/J0-playbook.md` â€” plan de match complet pour le 25 juin (ordre des actions, code Ã  changer, maker comment, broadcast email)

---

## Messages rÃ©seau personnel â€” Activation PH

Court DM LinkedIn Ã  envoyer Ã  ~20-40 contacts le 25 juin matin :

> Hey [prÃ©nom], je lance HealthWatch Global aujourd'hui sur Product Hunt â€” un dashboard de surveillance Ã©pidÃ©mio mondiale que j'ai construit en solo cette annÃ©e.
>
> Si tu as 30 secondes : [URL PH]
>
> Ã‡a m'aide beaucoup, merci ðŸ™

---

## DMs LinkedIn â€” 26 juin 2026 (Ã  envoyer aprÃ¨s post EN 9h)

Hook commun : cas Ebola France confirmÃ© le 25/06, tracÃ© sur HWG avant WHO DON.
Ordre d'envoi : BAVON â†’ Premice â†’ Paul Kibati â†’ Celestine â†’ Feydeau â†’ Arran.

---

**BAVON TANGUNZA NGUNGA (WHO) â€” FranÃ§ais**

> Bonjour BAVON,
>
> La France a confirmÃ© hier son premier cas d'Ebola Bundibugyo â€” on le suit sur HealthWatch Global avec la classification RSI Article 6, donnÃ©es SPF croisÃ©es avec le DON OMS.
>
> On a officiellement lancÃ© hier. J'aimerais avoir ton regard sur la classification des signaux â€” quelqu'un qui travaille Ã  l'OMS peut dire si les niveaux IMMÃ‰DIAT/RAPIDE/SURVEILLANCE correspondent Ã  ce que vous observez sur le terrain.
>
> Je t'ouvre un accÃ¨s si tu veux.
>
> David

---

**Premice Kayembe â€” FranÃ§ais**

> Bonjour Premice,
>
> La France a confirmÃ© hier son premier cas d'Ebola â€” on suit le foyer sur HealthWatch Global, RDC Ã  1 772 cas confirmÃ©s, Ouganda Ã  20, classification RSI en temps rÃ©el.
>
> On a officiellement lancÃ© hier. Si tu travailles sur des donnÃ©es Ebola ou la rÃ©ponse en Afrique centrale, je t'ouvre un accÃ¨s complet directement.
>
> David

---

**Dr Paul Kibati â€” English**

> Hi Paul,
>
> France confirmed its first Ebola case yesterday â€” we have it live on HealthWatch Global alongside the DRC outbreak (1,772 cases) and Uganda cluster (20), IHR Article 6/9/12 classification updated hourly.
>
> We officially launched yesterday. If your work touches outbreak surveillance or emergency response, happy to open full access so you can explore it directly.
>
> David

---

**Celestine Emeka Ekwuluo â€” English**

> Hi Celestine,
>
> France confirmed its first Ebola case yesterday â€” still the lead event in global health today. HealthWatch Global has it live with IHR Article 6 classification, alongside the DRC and Uganda clusters.
>
> We officially launched yesterday. Happy to give you direct access if a consolidated real-time view would be useful for your work.
>
> David

---

**Feydeau BOTON â€” FranÃ§ais**

> Bonjour Feydeau,
>
> La France a confirmÃ© hier son premier cas d'Ebola â€” je suis sÃ»r que tu avais les yeux dessus. On le suit sur HealthWatch Global, classification RSI Article 6, donnÃ©es SPF + DON OMS croisÃ©es en temps rÃ©el.
>
> On a officiellement lancÃ© hier. AccÃ¨s Pro direct si tu veux tester.
> healthwatch-global.com
>
> David

---

**Arran Hamlet (PATH / CDC EIS Alumni) â€” English**

> Hi Arran,
>
> France confirmed its first Ebola case yesterday â€” it was live on HealthWatch Global within hours of the SPF announcement, IHR Article 6 classified. Good timing for a launch day.
>
> Given your EPR work at PATH, the signal aggregation (WHO DON + ECDC + Africa CDC, updated hourly) should be directly useful in the field. Happy to open full access.
> healthwatch-global.com
>
> David

---

## Conversations LinkedIn en cours

| Contact | Statut | Dernier message | Prochaine action |
|---|---|---|---|
| Silvestre Suh (CHAI Sierra Leone) | Message envoyÃ© 22 juin (Lassa hook) | Lui | Attendre rÃ©ponse |
| Zahra BOUZIDI (Ã©pidÃ©miologiste AlgÃ©rie) | A rÃ©pondu ðŸ‘ðŸ‘ðŸ˜Š + "je vous rÃ©pondrai" | Elle | Activer Pro 30j quand elle rÃ©pond |
| Jalal Nourlil (Institut Pasteur Maroc) | 5 emails envoyÃ©s â†’ **RÃ‰PONDU 24/06 16h12** : "virologue pas Ã©pidÃ©miologiste, mais peut examiner mÃ©thodologie" | Lui | RÃ©pondre avec angle viral (Ebola/Mpox/Marburg) â€” rÃ©ponse archivÃ©e ci-dessous |

---

### RÃ©ponse Ã  Jalal Nourlil â€” 24 juin 2026 (Ã  envoyer)

**Sa rÃ©ponse (16h12) :** "Je vous remercie pour votre confiance, mais je suis davantage virologue qu'Ã©pidÃ©miologiste. Cependant, je peux encore examiner la mÃ©thodologie si mon expÃ©rience correspond Ã  vos attentes."

**RÃ©ponse David :**

> Bonjour Jalal,
>
> Merci pour la prÃ©cision â€” et un profil virologique est exactement ce dont on a besoin pour Ã©valuer la mÃ©thodologie.
>
> La plateforme surveille en prioritÃ© des foyers d'Ã©pidÃ©mies virales : Ebola Bundibugyo (PHEIC en cours en RDC), Mpox, Marburg, H5N1, Lassa. C'est le cÅ“ur du suivi DON OMS et ECDC que nous agrÃ©geons. La classification RSI IMMÃ‰DIAT/RAPIDE/SURVEILLANCE est tirÃ©e des articles 6, 9 et 12 â€” ce que j'aimerais que vous examiniez, c'est prÃ©cisÃ©ment si le mapping entre les donnÃ©es de terrain et ces niveaux vous semble cohÃ©rent sur les foyers viraux actifs.
>
> Votre compte est dÃ©jÃ  actif. La vue Ebola Bundibugyo est ici :
> healthwatch-global.com/fr/disease/ebola-virus-disease
>
> Si quelque chose vous semble mal classÃ© ou manquant, votre retour serait trÃ¨s utile.
>
> Bien Ã  vous,
> David

---

## Commentaires LinkedIn opportunistes

### ANRS Maladies infectieuses Ã©mergentes â€” JNI2026 (26 juin 2026)

**Contexte :** Post ANRS rÃ©capitulant les 27es JournÃ©es Nationales d'Infectiologie â€” session "Mpox, Ebola, Marburg : quand la science affronte les Ã©pidÃ©mies". Tags : Fontanet, Lacombe, Yazdanpanah, Jaspard, Mutagisha, Trouillet-Assant, Bancel, Sauvage.

**Commentaire postÃ© le 26 juin 2026 :**
> Mpox, Ebola, Marburg dans la mÃªme session â€” les trois pathogÃ¨nes qui ont dominÃ© l'agenda Ã©pidÃ©mio depuis 2024, avec Ebola DRC et Mpox toujours actifs aujourd'hui.
>
> Si des participants aux JNI veulent explorer les signaux en temps rÃ©el (DON OMS, ECDC, Africa CDC), HealthWatch Global agrÃ¨ge tout en un seul endroit â€” accÃ¨s libre.

**Connexions envoyÃ©es le 26 juin :** Yazdan Yazdanpanah, Arnaud Fontanet, Karine Lacombe, Nyombayire Mutagisha, Marie Jaspard.

---

### Health Policy Watch â€” Ghana malaria 86% decline (29 juin 2026)

**Commentaire postÃ© le 29 juin 2026 :**
> The 86% figure is the headline. The harder question is what sustains it. Sri Lanka reached near-elimination in 1963 (17 recorded cases), then saw cases rise to over a million within five years after control programmes were scaled back. The financing continuity point at the end of this post is exactly right.

**Note :** pas de mention HWG. Personal brand David, angle surveillance/continuitÃ© financement. Sri Lanka 1963 = fait Ã©pidÃ©mio standard, nombre exact variÃ© selon sources (1M-2,5M) â€” formulÃ© "over a million" pour rester prÃ©cis.

---

### Vital Strategies â€” post #Data4Health IndonÃ©sie (22 juin 2026)

**Contexte :** Vital Strategies recrute un consultant international pour le MinistÃ¨re de la SantÃ© indonÃ©sien sur un systÃ¨me national de registre. Tag #Data4Health.

**Commentaire postÃ© le 22 juin 2026 :**
> Building a national registry for Indonesia's MoH is one of the harder data problems in the region â€” upstream disease reporting varies dramatically by province. We built HealthWatch Global's Indonesia coverage around that fragmentation. If it's useful background for your consultant's scope, happy to share what we mapped.

**Suivi :** attendre rÃ©ponse. Si quelqu'un rÃ©pond, prÃ©parer un angle concret sur les lacunes de reporting provinciaux en IndonÃ©sie.

---

### Africa CDC â€” Ebola DRC (1er juillet 2026)

**Contexte :** Africa CDC post sur l'Ã©volution de la rÃ©ponse Ebola est DRC â€” 1 000+ cas confirmÃ©s, 250+ morts, foyers Ituri/North Kivu/South Kivu. Focus Dr. Yap Boum sur surveillance dÃ©centralisÃ©e.

**Commentaire rÃ©digÃ© le 1er juillet 2026 :**
> The geographic spread across Ituri, North Kivu, and South Kivu is the key variable here. Each province has a different health infrastructure density, which directly affects what "decentralized surveillance" can realistically achieve. CFR in areas with limited laboratory turnaround typically runs higher than in zones with INRB access. Deaths get counted before cases are confirmed. Dr. Yap Boum's point on detection speed is exactly right: the interval between symptom onset and confirmed case is where the response window either opens or closes.

---

### WHO AFRO â€” Sitrep Ebola Bundibugyo semaine 6 (1er juillet 2026)

**Contexte :** WHO AFRO â€” Rapport de situation 06 au 21 juin 2026. DRC : 1 048 cas confirmÃ©s, 267 morts, CFR 25,5%. Uganda : 20 cas, CFR 14,3%. North Kivu CFR 54,9%.

**Commentaire rÃ©digÃ© le 1er juillet 2026 :**
> The CFR gap between DRC (25.5%) and Uganda (14.3%) in the same outbreak is the clearest signal in this report. Both countries are dealing with the same Bundibugyo strain. The difference is surveillance depth and time to detection. North Kivu's 54.9% CFR confirms the pattern: cases being counted after death, not before. Bundibugyo lethality is not the primary driver here.

---

## Product Hunt â€” Launch June 25th, 2026

### Tagline PH (EN â€” Ã  coller dans Edit > Tagline)

> Real-time WHO outbreak monitoring for teams without GPHIN access

*(63 caractÃ¨res â€” problem-first, nomme l'audience, nomme l'ennemi implicite)*

---

### Description PH â€” opening paragraph (EN â€” Ã  coller dans Edit > Description)

> Most public health teams monitor outbreaks the same way: WHO DON bookmarked in one tab, ECDC in another, PAHO somewhere in their inbox. The signal arrives. The window to act is already closing.
>
> HealthWatch Global brings WHO, ECDC, PAHO and Africa CDC into one classified, real-time view â€” with automated IHR risk scoring (Art. 6, 9, 12) so your team knows what to prioritize. 195 countries, 5 languages, 4 official sources. Free tier available today.

---

### Maker Comment PH (EN â€” Ã  poster Ã  09h01 CEST = 00h01 PDT)

> I built this after watching an Ebola alert in Central Africa sit simultaneously in three separate RSS feeds â€” while the field coordination team had none of them in their workflow. The signal was live. The window was open. The tools were just wrong.
>
> Most public health teams don't have access to GPHIN, the WHO-affiliated surveillance network used by governments and large agencies (~$50K+/year). They're left cross-referencing WHO DON, ECDC, PAHO and Africa CDC manually in four browser tabs, hoping they catch the signal before it spreads.
>
> HealthWatch Global unifies all four in real time â€” automated IHR risk scoring based on published RSI criteria (Art. 6, 9, 12), 5 languages including Arabic and Indonesian (the markets where GPHIN isn't a realistic option), regional filters, and a 30-day institutional pilot for teams that need DPA + SLA before committing.
>
> One early signal I'm proud of: a researcher at Institut Pasteur Morocco signed up without any outreach from us. That's exactly the profile we built this for â€” qualified, resource-constrained, working in a context where official surveillance data matters but GPHIN access doesn't exist.
>
> What it doesn't do: replace official WHO determinations. The scoring helps your team triage, not declare a PHEIC.
>
> Free account, no credit card. Ask me anything about data sources, IHR methodology, or running a pilot ðŸ‘‡

---

### RÃ©ponses aux commentaires PH â€” templates (EN)

**"How is this different from WHO's own tools?"**
> WHO's tools are designed for national authorities and require formal credentials. HealthWatch Global is built for the field teams that report to those authorities â€” coordinators, IHR focal points, NGO health teams â€” who need actionable signals without navigating WHO's access system. We're downstream of WHO, not a replacement.

**"Where does the data come from / how current is it?"**
> Exclusively official sources: WHO Disease Outbreak News, ECDC Rapid Risk Assessments, PAHO Epidemiological Alerts, and Africa CDC outbreak updates. Synced automatically â€” last sync timestamp is visible on the dashboard. No crowdsourced content, no news aggregation.

**"Is the IHR scoring validated by health authorities?"**
> The data comes directly from health authorities. The IHR scoring is automated based on the published criteria in RSI Articles 6, 9, and 12 â€” we're explicit that it doesn't replace official WHO determinations. It helps teams triage incoming signals, not declare a PHEIC.

**"What about crowdsourced platforms? They have more signals."**
> More signals means more noise. For field teams making operational decisions, a false positive can be as costly as a missed signal. We made the deliberate choice to stay on official sources only â€” fewer alerts, higher signal quality.

**"GPHIN might open access eventually â€” aren't you building for the gap?"**
> Maybe. But field coordinators in Morocco, Indonesia, and West Africa need this today, not when GPHIN decides to expand. The 5-language interface with Arabic and Indonesian support isn't on GPHIN's roadmap. We're not betting against GPHIN â€” we're building for the markets they've never prioritized.

**"What's the business model?"**
> Free tier for individual monitoring. Pro for advanced filters + email digest. Team plan (â‚¬250/month, 5 seats) for organizations that need multi-seat access + DPA + SLA. The goal is adoption at field level, then pulled up to an org subscription when the team lead sees the value.

---

### RÃ©ponses aux commentaires PH â€” Axe 4 : objections fondamentales (EN)

**"WHO already has this â€” who.int/emergencies/disease-outbreak-news"**
> Great question â€” yes, those exist. The WHO DON page requires you to manually scan a list with no filter by region, risk level, or disease. ECDC has their own format. PAHO has a third. Africa CDC a fourth.
>
> For a field coordinator managing surveillance across 12 countries, that's 4 browser tabs open every morning, no unified risk scoring, and no way to share a filtered view with your team.
>
> HealthWatch Global is for the person who already knows those sources exist and is currently doing the aggregation manually.

**"I could build this in a weekend with n8n + Airtable"**
> You could. And you'd spend the next 6 months dealing with WHO DON's inconsistent RSS formatting, PAHO's PDF-only sitreps that need parsing, Africa CDC's page structure that changes every few months, and the edge cases where the same outbreak appears in 3 sources under 3 different country names.
>
> The moat isn't the dashboard. It's the normalization layer, the deduplication logic, and the fact that the IHR focal point at a national health ministry doesn't have a weekend to build this.
>
> But honestly â€” if you build it, let me know. I'll be curious what you find.

**"How is this different from ProMED?"**
> ProMED is an incredible resource â€” 30 years of institutional credibility. Different model though: it's community-contributed, discussion-based, designed for researchers who want to follow threads and debates.
>
> HealthWatch Global is exclusively official sources (WHO, ECDC, PAHO, Africa CDC) â€” no contributor content, no discussion threads. The goal isn't breadth of signal, it's signal quality for operational teams who need to justify their response decisions to a ministry or a donor. "WHO DON confirmed" carries different weight than "ProMED subscriber reported."
>
> Both have their place. They solve different problems for different users.

*(Note lÃ©gale : ProMED peut Ãªtre mentionnÃ© en comparaison compÃ©titive â€” le C&D interdit l'utilisation de leurs donnÃ©es/RSS, pas la rÃ©fÃ©rence au nom dans une conversation publique.)*

---

---

## Template â€” RÃ©ponse fact-check public (Axe 9)

*Ã€ utiliser si un Ã©pidÃ©miologiste ou journaliste poste une comparaison publique WHO vs HealthWatch avec Ã©cart de chiffres.*

```
@[USERNAME] Thanks for doing this â€” exactly the scrutiny this kind of tool needs.

Methodology note to make the comparison fair:

[DISEASE + COUNTRY]: WHO sitrep = [WHO_NUMBER] (lab-confirmed only).
HealthWatch = [HW_NUMBER] â€” confirmed + probable cases aggregated from
[WHO / Africa CDC / ECDC / PAHO]. The [DELTA]-case delta is the probable
case count from [SOURCE]'s [DATE] report.

We don't replace WHO sitrep. We display confirmed+probable (IHR Art. 9)
for early-warning visibility, before lab confirmation arrives.
Case definition is visible in each outbreak modal (â“˜ Cases column header).

Happy to share source docs for this specific outbreak â€” DM.
```

**RÃ¨gle d'or** : rÃ©pondre en < 30 min. PassÃ© 2h, le thread a sa propre vie.
**Ton** : factuel, pas dÃ©fensif. Remercier pour le fact-check.
**Jamais** : "nos chiffres sont justes" â€” toujours expliquer la dÃ©finition de cas.

---

## Template â€” DÃ©clin investisseur (Axe 11)

*Ã€ utiliser pour tout message d'investisseur post-PH. RÃ©ponse en < 3 min.*

```
Bonjour [PrÃ©nom], merci â€” ravi que le lancement ait attirÃ© votre attention.

Pour Ãªtre direct : HealthWatch Global est bootstrapped by design et je n'ouvre
pas de tour en ce moment. Ce n'est pas une question de timing â€” c'est un choix
structurel.

Ce qui m'intÃ©resse en revanche : si vous avez des contacts dans des Ã©quipes de
surveillance Ã©pidÃ©mique (ONG santÃ©, agences rÃ©gionales, instituts nationaux),
une introduction est infiniment plus utile pour moi qu'un term sheet.

Si Ã§a colle avec ce que vous faites â€” avec plaisir de garder le contact dans ce
cadre.

â€” David
```

**RÃ¨gle** : fermer sans "pas pour l'instant". Transformer en introducteur potentiel.

---

---

## Templates â€” RÃ©ponses concurrents PH (Axe 13)

*Ã€ copier-coller directement depuis ce fichier dans les commentaires PH.*

### "How is this different from HealthMap?"
```
HealthMap is great for early signal detection from news and social media â€”
it's built for researchers who want to catch whispers before official reports.

We solve a different problem: the public health team that already has the
official WHO/ECDC/PAHO alerts in 4 separate tabs and needs them unified,
risk-scored, and ready to brief their director in 2 minutes.

Different workflow, different user.
```

### "BlueDot / Metabiota already does this"
```
BlueDot is built for governments and airlines willing to pay $50K+/year
for predictive AI. Genuinely impressive â€” and genuinely inaccessible to
90% of surveillance teams.

We're for the Institut Pasteur regional office, the NGO epidemiologist,
the ministry focal point who has a real-time monitoring need and a
â‚¬250/month budget. That market doesn't have a tool right now.
```

### "WHO already has Disease Outbreak News / ECDC has their Atlas"
```
WHO DON and ECDC Atlas are excellent â€” we aggregate directly from them.

The gap: WHO DON is a publication, not a dashboard. You can't filter by
region, sort by risk, set alerts, or see all 4 sources side by side.
Our users open 4 tabs every morning and manually cross-reference.
We close those 4 tabs. No GPHIN required.
```

**RÃ¨gle** : ne jamais critiquer le concurrent directement â€” positionner par le workflow, pas par les features.

---

## DMs LinkedIn â€” Nouvelles connexions â€” 25 juin 2026

### Helene Barroy â€” WHO Sr Public Finance Expert (demande de connexion entrante â€” suite commentaire post Ebola financing)

**DM initial â€” 25 juin 2026**
> Bonjour Helene,
>
> Merci pour la connexion â€” content que le commentaire ait Ã©tÃ© utile.
>
> Votre guide sur le financement soulÃ¨ve quelque chose qui me prÃ©occupe : la plupart des mÃ©canismes de financement d'urgence s'activent sur publication du DON OMS, mais au moment oÃ¹ la notice est formellement publiÃ©e, la courbe Ã©pidÃ©mique est dÃ©jÃ  5 Ã  10 jours en avance sur le dÃ©clencheur.
>
> Je dÃ©veloppe HealthWatch Global â€” surveillance en temps rÃ©el agrÃ©geant WHO DON, ECDC, PAHO et Africa CDC avec classification RSI automatique (IMMÃ‰DIAT / RAPIDE / SURVEILLANCE). L'idÃ©e Ã©tant qu'un signal classifiÃ© plus tÃ´t pourrait dÃ©clencher le financement plus tÃ´t.
>
> Est-ce que les signaux prÃ©-DON ont une place pratique dans les mÃ©canismes de financement des crises sanitaires â€” ou la publication formelle OMS reste toujours le dÃ©clencheur obligatoire par design ?
>
> David

**RÃ©ponse Helene â€” 25 juin 2026, 10:54**
> Absolument. Je suis bien d'accord avec vous. Seriez vous disponible que que nous Ã©changions, disons la semaine prochaine? barroyh@who.int

**RÃ©ponse David â€” confirmation appel**
> Bonjour Helene,
>
> Avec plaisir â€” je suis disponible toute la semaine prochaine. Mardi 30 juin ou mercredi 1er juillet, matin ou dÃ©but d'aprÃ¨s-midi, si Ã§a vous convient.
>
> Sinon je vous envoie un mot Ã  barroyh@who.int pour coordonner directement.
>
> Ã€ trÃ¨s vite,
> David

**Statut :** email envoyÃ© 29 juin 2026 â€” Ã©change Ã©crit, pas d'appel. Attente rÃ©ponse.

**Email envoyÃ© le 29 juin 2026 Ã  barroyh@who.int**

**Objet :** Suite Ã  notre Ã©change LinkedIn â€” timing signal / dÃ©clencheur financement

> Bonjour HÃ©lÃ¨ne,
>
> Merci pour votre rÃ©ponse sur LinkedIn. Pour ne pas prendre plus de votre temps qu'il ne faut, je me permets de vous soumettre deux questions directement â€” si elles appellent un Ã©change plus long, je reviens vers vous.
>
> **1.** Dans les mÃ©canismes de financement d'urgence que vous connaissez (CERF, fonds de contingence rÃ©gionaux, mÃ©canismes bilatÃ©raux), le dÃ©clencheur formel est-il systÃ©matiquement la publication du DON OMS â€” ou existe-t-il des dispositifs qui s'activent sur un signal prÃ©-DON (notification Article 6, alerte rÃ©gionale) ?
>
> **2.** HealthWatch Global classifie les signaux Ã©pidÃ©miques en temps rÃ©el, avant la publication formelle du DON. Est-ce qu'un tel outil trouverait une place pratique dans ces mÃ©canismes â€” ou le financement reste-t-il structurellement liÃ© Ã  la publication OMS par construction ?
>
> Pas besoin d'une rÃ©ponse longue â€” mÃªme deux ou trois lignes par question seraient prÃ©cieuses.
>
> Bien Ã  vous,
> David Deheunynck
> HealthWatch Global â€” healthwatch-global.com

---

### Eva Kamau â€” Clinician & Clinical Researcher, AMR (Kiambu District Hospital, Kenya â€” #OpenToWork â€” suit HWG)

**DM envoyÃ© 29 juin 2026 :**
> Hi Eva, your profile caught my eye. We aggregate outbreak signals from WHO, ECDC, PAHO and Africa CDC in real time. Happy to open Pro access to explore. Useful for your work in Kenya?
>
> David

**Note :** angle AMR Ã©cartÃ© (HWG ne fait pas de surveillance AMR dÃ©diÃ©e â€” MDR-Shigella tracÃ© incidemment via ECDC uniquement). Hook utilisÃ© : Kenya + Africa CDC.

**Statut :** DM envoyÃ© 29 juin. Attente rÃ©ponse.

---

### Mahgoub Hamid â€” WHO EMRO, Cairo, Egypt (connexion spontanÃ©e â€” relation commune Dr RenÃ©)

> Hi Mahgoub,
>
> Thanks for connecting â€” good to have a WHO EMRO contact in the network.
>
> I'm building HealthWatch Global â€” real-time outbreak surveillance aggregating WHO DON, ECDC, PAHO, and Africa CDC, with automated IHR classification (IMMEDIATE / RAPID / SURVEILLANCE). We just added a dedicated EMRO pipeline: MERS-CoV, cholera in Yemen and Syria, and regional alerts come in ahead of global DON publication.
>
> Curious how your team currently consumes outbreak signals â€” and whether the IHR scoring layer would fit your workflow. Happy to give you access to explore.
>
> David

---

## Templates â€” Presse / Journaliste (Axe 14)

### 3 phrases clÃ©s Ã  placer dans toute interview
```
1. "We unify WHO, ECDC, PAHO and Africa CDC in one dashboard â€”
   surveillance teams open 4 tabs every morning. We close them."

2. "We don't produce data. We alert on official sources, in real time."

3. "The underserved market is the hundreds of thousands of surveillance
   teams that don't have GPHIN access and work anyway."
```

### "Vos donnÃ©es sont 'real-time' mais WHO publie parfois avec 2 semaines de dÃ©lai ?"
```
'Real-time' applies to the sync, not the source publication. When WHO
publishes a report, we integrate it within the hour. What we eliminate
is the latency between publication and the moment the surveillance team
sees it â€” because nobody monitors 4 RSS feeds continuously.

We don't produce data. We unify and alert on official data.
```

### "Vous Ãªtes seul, pas Ã©pidÃ©miologiste â€” qui valide la mÃ©thodologie ?"
```
Fair question. The IHR risk-scoring methodology comes directly from
Articles 6, 9 and 12 of the International Health Regulations â€”
no proprietary interpretation. Data comes from WHO, ECDC, PAHO
and Africa CDC. I invent neither the data nor the risk criteria.
```

### "Il y a eu une plainte de ProMED contre vous ?"
```
We received a communication from ProMED in June, responded immediately
and complied. We use no ProMED data. I'd rather not comment further
on private correspondence.
```

**RÃ¨gle presse** : rÃ©pondre par Ã©crit quand possible. Confirmer que les citations sont vÃ©rifiÃ©es avant publication. Ne jamais improviser sur ProMED.

---

### Screenshots PH â€” recommandations

1. **Screenshot 1** â€” Dashboard avec filtre Africa actif + alerte Ebola visible (badge HIGH) â€” montre le produit en action, pas l'interface vide
2. **Screenshot 2** â€” Badge de risque avec tooltip IHR affichÃ© (hover) â€” prouve le scoring automatique
3. **Screenshot 3** â€” Email digest reÃ§u ou modal dÃ©tail foyer â€” montre la profondeur

*(Ã€ capturer sur le dashboard live avant 23h ce soir)*

---

## LinkedIn â€” Posts de prospection

### Post 5 â€” 29 juin 2026 (Ebola DRC / Bundibugyo)

> Your team monitors WHO, ECDC, CDC, and PAHO separately to track active outbreaks. That's 4+ sources, daily, across dozens of simultaneous events.
>
> There's a better way.
>
> This week alone: Ebola DRC surpassed 1,274 confirmed cases. NEJM confirmed the epidemic has "exceeded previous outbreaks in trajectory and scale." Nipah in Kerala. Hantavirus cluster contained across three continents.
>
> Every active outbreak. Official sources. One platform.
>
> If your work depends on knowing what's happening before it becomes headline news, this is built for you.
>
> ðŸ‘‰ healthwatch-global.com
>
> #GlobalHealth #PublicHealth #OutbreakSurveillance #Epidemiology

**Statut :** PUBLIÃ‰ âœ… 29 juin 2026. Note : trop long. Prochains posts : 5-6 lignes max, un seul angle.

---

## X / RÃ©ponses â€” 30 juin 2026

**RÃ©ponse Ã  @HelenBranswell â€” Marburg Uganda (tweet 7k impressions) :**
> Level 4 before official confirmation â€” the decision window precedes the DON. Marburg historical CFR: 24â€“88% by episode and healthcare context. A cluster while Ebola DRC is at PHEIC significantly raises the regional VHF response burden. Tracking official signals as they publish: healthwatch-global.com/en/disease/marburg-virus-disease

**Note :** Uganda n'a pas encore confirmÃ© officiellement. 2 cas selon STAT News. Ne pas citer de chiffres Uganda 2023 sans vÃ©rification (Tanzania 2023 = 9 cas / 6 dÃ©cÃ¨s, pas Uganda).

**RÃ©ponse Ã  @KrutikaKuppalli â€” Lancet Ebola DRC / US policy (3k impressions) :**
> Two simultaneous VHF events â€” Ebola DRC (PHEIC) and now a suspected Marburg cluster in Uganda â€” while US global health infrastructure is contracting. The monitoring gap is operational before it becomes political. Real-time tracking: healthwatch-global.com/en/disease/ebola-virus-disease

---

## X / RÃ©ponses â€” 29 juin 2026

**RÃ©ponse Ã  @Yash25571056 (Hiroshi Yasuda) â€” CDC Ebola escalation :**
> "Cross-border spread to Uganda is what changes the calculus here. Tracking the trajectory. healthwatch-global.com"

**RÃ©ponse Ã  @NEJM â€” Bundibugyo 2026 review :**
> "1,274 confirmed cases as of June 27 â€” unprecedented for Bundibugyo in any prior outbreak. Real-time tracking: healthwatch-global.com"

---

## Emails / DMs institutionnels â€” Vague 2 â€” 30 juin 2026

**Canal :** LinkedIn DM (2e) ou InMail (3e) â€” email non utilisÃ© sauf ACF (Olivier) qui a une adresse confirmÃ©e.
**Relance J+10 :** 10 juillet 2026.

| # | Contact | Institution | Canal | Statut |
|---|---|---|---|---|
| 1 | Tony Zitti | IRD | LinkedIn DM | âœ… EnvoyÃ© 30 juin |
| 2 | Olivier Cheminat | ACF | LinkedIn DM | âœ… EnvoyÃ© 30 juin |
| 3 | Justin-Bienvenu EYONG | MSF / Epicentre | LinkedIn DM | âœ… EnvoyÃ© 30 juin |
| 4 | Anastasiia Borodina | IMC Ukraine | LinkedIn DM | âœ… EnvoyÃ© 30 juin |
| 5 | Agnes Soucat | AFD / JHU | LinkedIn DM | âœ… EnvoyÃ© 30 juin (email non confirmÃ©) |
| 6 | Tumusime MUSAFIRI | PIH Rwanda | LinkedIn InMail | âœ… EnvoyÃ© 30 juin (email tumusime.musafiri@pih.org bounced) |
| 7 | JuvÃ©nal NDAYIKEZA | IRC Burundi | LinkedIn DM | âœ… EnvoyÃ© 30 juin (pas d'email confirmÃ©) |
| 8 | Liliana Trujillo | INSP Mexique | LinkedIn InMail | âœ… EnvoyÃ© 30 juin |

---

### DM Tony Zitti (IRD) â€” 30 juin 2026

**Objet InMail (si applicable) :** HealthWatch Global vient de lancer â€” donnÃ©es OMS + ECDC + PAHO agrÃ©gÃ©es en temps rÃ©el

Bonjour Tony,

HealthWatch Global vient de lancer. Dashboard qui agrÃ¨ge WHO DON, ECDC, PAHO et Africa CDC en temps rÃ©el, classification RSI IMMÃ‰DIAT/RAPIDE/SURVEILLANCE, 5 langues.

Vu ton travail Ã  l'IRD en santÃ© publique et ton rÃ´le de knowledge broker, HealthWatch donne aux chercheurs une source officielle consolidÃ©e pour les donnÃ©es de foyers actifs. Dengue, Paludisme, Mpox, Cholera en Afrique subsaharienne, avec export CSV, sans la recherche manuelle sur 4 portails distincts.

Je peux t'ouvrir un accÃ¨s Pro pour explorer, sans engagement, sans appel.

healthwatch-global.com/fr

Bien Ã  toi,
David Deheunynck
HealthWatch Global

---

### DM Olivier Cheminat (ACF) â€” 30 juin 2026

Bonjour Olivier,

HealthWatch Global vient de lancer. Dashboard qui agrÃ¨ge WHO DON, ECDC, PAHO et Africa CDC en temps rÃ©el, classification RSI IMMÃ‰DIAT/RAPIDE/SURVEILLANCE, 5 langues dont le franÃ§ais et l'arabe.

Vu ton profil DHIS2 et systÃ¨mes d'information santÃ© chez ACF, HealthWatch consolide en un seul outil la veille que vos Ã©quipes terrain font manuellement sur 4 sources. DonnÃ©es structurÃ©es par pays, maladie et niveau de risque, export CSV, alertes email.

Pilote institutionnel 30 jours : 5 siÃ¨ges, onboarding inclus, 250â‚¬/mois si votre Ã©quipe continue. Pas de procurement nÃ©cessaire pour dÃ©marrer.

healthwatch-global.com/fr/disease/cholera

Bien Ã  vous,
David Deheunynck
HealthWatch Global

---

### DM Justin-Bienvenu EYONG (MSF / Epicentre) â€” 30 juin 2026

Hi Justin-Bienvenu,

HealthWatch Global just launched. Real-time dashboard aggregating WHO DON, ECDC, PAHO, and Africa CDC with IHR IMMEDIATE/RAPID/SURVEILLANCE classification across 5 languages.

For Epicentre teams coordinating field response, HealthWatch consolidates the four sources your epidemiologists cross-reference manually. One classified view of active signals, updated every 4 hours, with email alerts by country and disease.

30-day institutional pilot: 5 seats, full onboarding, 250â‚¬/month if your team wants to continue. No procurement required to start.

healthwatch-global.com/en/disease/mpox

Best,
David Deheunynck
HealthWatch Global

---

### DM Anastasiia Borodina (IMC Ukraine) â€” 30 juin 2026

Hi Anastasiia,

HealthWatch Global just launched. Real-time dashboard aggregating WHO DON, ECDC, PAHO, and Africa CDC with IHR IMMEDIATE/RAPID/SURVEILLANCE classification across 5 languages.

For IMC teams in complex emergencies like Ukraine, HealthWatch gives public health specialists one consolidated view of active disease signals. Updated 4x/day from official sources, with email alerts by country and disease, no cross-referencing required.

30-day institutional pilot: 5 seats, full onboarding, 250â‚¬/month if your team wants to continue. No procurement required to start.

healthwatch-global.com/en

Best,
David Deheunynck
HealthWatch Global

---

### DM Agnes Soucat (AFD / JHU) â€” 30 juin 2026

Bonjour Agnes,

HealthWatch Global vient de lancer. Dashboard qui agrÃ¨ge WHO DON, ECDC, PAHO et Africa CDC en temps rÃ©el, classification RSI IMMÃ‰DIAT/RAPIDE/SURVEILLANCE, 5 langues.

Pour les Ã©quipes AFD travaillant sur les programmes santÃ© en Afrique et Asie du Sud-Est, HealthWatch donne une vue structurÃ©e du risque Ã©pidÃ©mique dans vos pays d'intervention. Ebola DRC, CholÃ©ra, Mpox Clade I, Dengue, sans la recherche manuelle sur 4 portails distincts.

Pilote institutionnel 30 jours : 5 siÃ¨ges, onboarding inclus, 250â‚¬/mois si votre Ã©quipe continue.

healthwatch-global.com/fr

Bien Ã  vous,
David Deheunynck
HealthWatch Global

---

### InMail Tumusime MUSAFIRI (PIH Rwanda) â€” 30 juin 2026

**Note :** email tumusime.musafiri@pih.org bounced "adresse introuvable". PassÃ© en LinkedIn InMail.

Hi Tumusime,

HealthWatch Global just launched. Real-time dashboard aggregating WHO DON, ECDC, PAHO, and Africa CDC with automated IHR risk scoring across 5 languages.

For PIH teams in Rwanda, HealthWatch gives epidemiologists one consolidated view of active signals. Marburg, Ebola DRC, Mpox Clade I, updated every 4 hours with email alerts by country and disease, without the cross-referencing overhead across 4 official portals.

30-day institutional pilot: 5 seats, full onboarding, 250â‚¬/month if your team wants to continue. No procurement required to start.

healthwatch-global.com/en/disease/cholera

Best,
David Deheunynck
HealthWatch Global

---

### DM JuvÃ©nal NDAYIKEZA (IRC Burundi) â€” 30 juin 2026

**Note :** IRC email format standard, mais adresse non confirmÃ©e. PassÃ© en LinkedIn DM (2e connexion).
**Langue :** anglais (Burundi bilingue, profil LinkedIn en anglais).

Hi JuvÃ©nal,

HealthWatch Global just launched. Real-time dashboard aggregating WHO DON, ECDC, PAHO, and Africa CDC with IHR risk classification across 5 languages.

For IRC's emergency health teams operating in contexts like Burundi and the Great Lakes region, HealthWatch gives epidemiologists one consolidated view of active outbreak signals. Mpox DRC, Cholera, Ebola, no cross-referencing across WHO, ECDC, and PAHO required. Alerts by country, disease, and risk level.

30-day institutional pilot: 5 seats, full onboarding, 250â‚¬/month if your team wants to continue. No procurement required to start.

healthwatch-global.com/en/region/africa

Best,
David Deheunynck
HealthWatch Global

---

### InMail Liliana Trujillo (INSP Mexique) â€” 30 juin 2026

**Objet :** HealthWatch Global. Vigilancia epidÃ©mica consolidada para equipos INSP

Hola Liliana,

HealthWatch Global acaba de lanzar. Dashboard en tiempo real que agrega WHO DON, ECDC, PAHO y Africa CDC con clasificaciÃ³n RSI automÃ¡tica en 5 idiomas, incluido el espaÃ±ol. Para los equipos del INSP, consolida en una sola herramienta la vigilancia que se hace manualmente en 4 fuentes, con alertas por paÃ­s y enfermedad, exportaciÃ³n CSV.

Piloto institucional 30 dÃ­as: 5 accesos, onboarding incluido, 250â‚¬/mes si el equipo continÃºa. Sin proceso de compra para empezar.

healthwatch-global.com/es/disease/dengue-fever

Saludos,
David Deheunynck
HealthWatch Global

---

## Post 6 â€” Thread Powassan (30 juin 2026) â€” PUBLIÃ‰ âœ… 30 juin 2026

**Ton :** analytique, donnÃ©es MMWR CDC 2025, surveillance blind spot + climate driver
**Source donnÃ©es :** MMWR vol.74 nÂ°21 â€” 49 cas 2023 (record ArboNET), 8 dÃ©cÃ¨s, CFR 16%, 96% neuroinvasifs

**Tweet 1**
Powassan virus.
No treatment. No vaccine.
Tick-to-human transmission: as little as 15 minutes.

CFR: 16%. Half of survivors face permanent neurological damage.

2023 recorded the highest U.S. case count since ArboNET began tracking in 2004.

Here's why the number is almost certainly an undercount. ðŸ§µ

**Tweet 2**
49 confirmed cases. 8 deaths.

96% presented with neuroinvasive disease â€” encephalitis, meningitis. 90% were hospitalized.

Median patient age: 68. Cases from 11 states, concentrated in New England and the Great Lakes.

Source: CDC / MMWR 2025.

**Tweet 3**
Why the 49 are likely the floor, not the ceiling:

â†’ No treatment = low incentive to test confirmatorily
â†’ Powassan isn't in standard commercial arboviral panels â€” must be ordered separately
â†’ Mild cases resolve undiagnosed
â†’ Disease awareness remains low outside endemic zones

**Tweet 4**
The driver: deer tick habitat expanding north as temperatures rise.

Exposure windows are widening every year.

@HealthWatchGlobal tracks Powassan alongside Ebola, H5N1, Mpox and 100+ active outbreaks globally.

healthwatch-global.com

#Epidemiology #GlobalHealth

---

## Replies X â€” 30 juin 2026

### Reply @DrIanWeissman â€” Powassan virus (30 juin 2026)

**Contexte :** tweet viralisÃ© de @DrIanWeissman (mÃ©decin vÃ©rifiÃ©) sur la hausse du Powassan virus aux US â€” transmission en 15 min, pas de traitement ni vaccin.
**Angle adoptÃ© :** underreporting structurel + expansion climatique (angles absents du tweet original).
**DB update :** entrÃ©e Powassan crÃ©Ã©e (49 cas 2023, 8 dÃ©cÃ¨s, CFR 16%, MMWR CDC 2025 â€” record depuis 2004).

> Classic surveillance gap: no treatment reduces the diagnostic incentive, so confirmed cases are the tip of the iceberg. As the deer tick's range expands north with warming temps, risk zones are growing faster than surveillance coverage. Tracking at @HealthWatchGlobal.

**Statut :** ENVOYÃ‰ âœ… 30 juin 2026.

**Engagement reÃ§u :** @Yash25571056 (Hiroshi Yasuda, Scientist & Professor Hiroshima University, 40,4k abonnÃ©s, rÃ©seau Eric Feigl-Ding) a likÃ© ce reply 21h aprÃ¨s publication. David le suit dÃ©jÃ . Pas de DM â€” attendre engagement organique sur prochain tweet Ebola/outbreak.

---

### Reply @CovidDataReport â€” H5 Western Australia (30 juin 2026)

**Contexte :** 4e dÃ©tection H5 chez des oiseaux marins migrateurs, cÃ´te Sud d'Australie-Occidentale.
**Angle :** route migratoire East Asianâ€“Australasian Flyway comme vecteur intercontinental.

> Four detections in migratory seabirds â€” not incidental noise. Seabirds are the primary vector for intercontinental H5 spread, and the East Asianâ€“Australasian Flyway directly links WA to regions where H5N1 remains active in poultry. Worth monitoring for potential spillover. @HealthWatchGlobal tracks avian flu signals globally.

**Statut :** ENVOYÃ‰ âœ… 30 juin 2026.

---

### Reply @OMS_Afrique â€” MVB/Ebola RDC (30 juin 2026)

**Contexte :** tweet Ã©ducatif @OMS_Afrique sur la maladie Ã  virus Bundibugyo (MVB) â€” campagne #ViralFacts.
**Angle :** lien avec le foyer actif en RDC, donnÃ©es sitrep vÃ©rifiÃ©es.

> Rappel utile pour contextualiser le foyer actif en RDC : 1 307 cas confirmÃ©s, CFR 28,8% au 28 juin (sitrep MinistÃ¨re de la santÃ© RDC). @HealthWatchGlobal consolide sitreps OMS Afrique + donnÃ©es nationales avec classification RSI automatique.

**Statut :** ENVOYÃ‰ âœ… 30 juin 2026.

---

## Replies X â€” 1er juillet 2026

### Reply @POWVonSOL â€” Powassan / ArboNet (1er juillet 2026)

**Contexte :** @POWVonSOL (meme coin Solana thÃ¨me Powassan) a rÃ©pondu au thread HWG du 30 juin. 29 impressions. @POWVonSOL vous suit.
**Angle :** underreporting structurel (prÃ©sentation neurologique tardive).

> The 2023 ArboNet numbers were the first signal that something was shifting. Most cases still reach clinical attention at neurological presentation, not at the febrile stage â€” which makes the true incidence almost certainly higher than what's reported.

**Statut :** ENVOYÃ‰ âœ… 1er juillet 2026.

---

## Replies X â€” 2 juillet 2026

### Reply @BNOFeed â€” Daily Ebola update (2 juillet 2026)

**Contexte :** BNO News daily Ebola sitrep. 10k impressions, 64 RT, 128 likes. DonnÃ©es au 1er juillet : DRC 1 406 cas (+73) / 438 dÃ©cÃ¨s (+39), Uganda 20 / France 1. 47 jours depuis premier cas. Sources : MoH DRC, MoH Uganda, MoH France, WHO.
**Angle :** CFR calculÃ© + absence de plateau Ã  J47.

> 438 deaths / 1,406 confirmed = 31.2% CFR. The +73 cases and +39 deaths in a single day suggest no plateau in sight at day 47. We track this outbreak in real time on HealthWatch Global via WHO and ECDC feeds.

**Statut :** ENVOYÃ‰ âœ… 2 juillet 2026.

---

### Reply @CIDRAP â€” Ebola deaths 400+ / Marburg Uganda child (2 juillet 2026)

**Contexte :** @CIDRAP tweet 7h. Ebola deaths top 400 en Afrique + Uganda rapporte dÃ©cÃ¨s d'un enfant de Marburg. Double VHF burden sur Uganda.
**Angle :** Uganda gÃ¨re simultanÃ©ment Ebola (spillover DRC, 20 cas) et Marburg (enfant dÃ©cÃ©dÃ©). Charge opÃ©rationnelle sans prÃ©cÃ©dent.

> Two simultaneous VHF responses in Uganda: Ebola crossborder spillover from DRC (20 confirmed) and now a Marburg fatality in a child. That's an unprecedented dual hemorrhagic fever burden on a single national response system. We track both in real time on HealthWatch Global.

**Statut :** ENVOYÃ‰ âœ… 2 juillet 2026.

---

### Reply @AJEnglish â€” Ebola Bunia / prÃ©sentation tardive (2 juillet 2026)

**Contexte :** @AJEnglish 38 min. Citation terrain Bunia : symptÃ´mes n'apparaissent qu'au stade final. Reportage @cate_soi depuis Ituri.
**Angle :** prÃ©sentation tardive Bundibugyo = driver du CFR 31,2% + explication du cas France (asymptomatique au dÃ©part).

> Bundibugyo's late-stage symptom onset is what drives the 31.2% CFR â€” and explains how the France imported case cleared every travel screening. Cases aren't caught at the febrile stage. They're confirmed when it's almost too late. We track confirmed cases in real time on HealthWatch Global.

**Statut :** ENVOYÃ‰ âœ… 2 juillet 2026.

---

### Reply @UN â€” Ebola development crisis / UNDP (2 juillet 2026)

**Contexte :** @UN (United Nations officiel) tweet sur l'impact Ã©conomique Ebola DRC. UNDP : quasi 1 million de personnes poussÃ©es dans la pauvretÃ©, coÃ»t en milliards pour les Ã©conomies africaines. Tweet postÃ© 30 min avant reply.
**Angle :** lien entre trajectoire Ã©pidÃ©miologique et projection Ã©conomique UNDP. Pas de plateau Ã  J47 = le chiffre UNDP dÃ©pend de la durÃ©e de la courbe.

> The economic cost scales directly with how long the epi curve runs. At day 47, DRC is at 1,406 confirmed cases across 4 provinces with no plateau signal. The epidemiological trajectory is the variable that determines whether the UNDP projection holds. We track the outbreak in real time on HealthWatch Global.

**Statut :** ENVOYÃ‰ âœ… 2 juillet 2026.

---

### Reply @Com_medias â€” Sitrep Ebola 30 juin (2 juillet 2026)

**Contexte :** MinistÃ¨re Communication DRC (@Com_medias), 5h. Sitrep officiel 30 juin : 1 406 cas / 438 dÃ©cÃ¨s / 31,2% CFR / 609 en isolement / 192 guÃ©ris. Nouvelle zone de santÃ© Lolwa (Ituri) identifiÃ©e.
**Angle :** extension gÃ©ographique en cours (Lolwa = nouveau foyer), pas de signal de confinement. RÃ©ponse en franÃ§ais.

> 1 406 cas, 31,2% de lÃ©talitÃ©, une nouvelle zone de santÃ© identifiÃ©e Ã  Lolwa. La cartographie continue de s'Ã©tendre. Ce n'est pas un signal de confinement. HealthWatch Global consolide les donnÃ©es officielles DRC, OMS et ECDC en temps rÃ©el.

**Statut :** ENVOYÃ‰ âœ… 2 juillet 2026.

---

## LinkedIn — DM Qadeer Ahsan (2 juillet 2026)

**Contexte :** Qadeer = physician + MPH, Senior PH Specialist UNOPS (retainer TB). A fourni des insights très utiles sur les workflows de surveillance ministériels (Detect/Respond, signal ? focal point ? escalation). Cherche activement un emploi (TA contracts / advisory / full-time).

**Son message (2 juillet 08:56) :**
> Hi..Hope you are doing good. How is your initiative progressing. Please try to find an opportunity for me. Desperately looking for work. You have a strong network. Will be grateful. Thanks.

**Réponse envoyée :**
> Hi Qadeer, good to hear from you.
>
> The platform is progressing. Product live, first users on, and the conversation we had in June is still shaping the direction. The decision-support layer is next.
>
> On opportunities: I haven't had anything specific cross my path yet that fits your profile well enough to forward. My network skews toward founders and health data people, less toward the hiring side of WHO or Fleming Fund-type programs.
>
> One thing that might move the needle: if you don't have recent recommendations on your LinkedIn from the Fleming Fund or WHO work, that would be worth prioritising. Senior TA profiles often clear the shortlist filter on that alone.
>
> Is there a specific region or organisation type you're most focused on right now. AMR, IHR, or broader health security?



---

## LinkedIn — Commentaire post Mohammad Ilias Hossain (2 juillet 2026)

**Post :** Ebola Bundibugyo DRC/Uganda/France, 1,354 cas, 401 deces, PHEIC — Mohammad Ilias Hossain (Physician, Epidemiology)

**Commentaire posté :**
> The Ituri detail is what makes the trajectory particularly alarming. By July 1, the outbreak had reached 24 health zones in Ituri alone, with Nord-Kivu and Sud-Kivu also affected, and no plateau visible at day 47 of the response.
>
> The Kampala cluster adds a different risk dynamic: urban density accelerates exposure chains, but also improves detection. The question is whether response capacity can scale with the transmission speed.
>
> We're tracking this in real time at HealthWatch Global. Current figures as of July 1: 1,406 confirmed cases, 438 deaths, CFR 31.2%.

**Contexte DB :** DRC entry reactivee manuellement (bug stale deactivation, fix commite ce matin). Strain Bundibugyo confirme par CDC Travel Notice Level 3 et description ECDC dans notre DB.


---

## LinkedIn — Commentaire post International SOS (2 juillet 2026)

**Post :** Webinar Ebola DRC + cas France, 29 juin 2026. International SOS (Dr Katherine O'Reilly + Dr Chris van Straten). Qadeer Ahsan visible parmi les likes/commentaires.

**Commentaire posté :**
> Timely briefing on a situation that keeps moving. For reference, as of July 1 the outbreak had reached 1,406 confirmed cases and 438 deaths (CFR 31.2%), across 35+ health zones in Ituri, Nord-Kivu and Sud-Kivu, with no plateau at day 47 of the response.
>
> The France imported case with no secondary transmission is reassuring, but the DRC corridor is far from contained.
>
> HealthWatch Global tracks this daily, aggregating WHO and ECDC signals for operational monitoring.

**Contexte :** International SOS = cible institutionnelle (travel risk, multinationales). Audience = exactement les orgs que HealthWatch vise. Pas d'URL pour eviter penalite algo LinkedIn.


---

## LinkedIn — Commentaire post IPPS (2 juillet 2026)

**Post :** International Pandemic Preparedness Secretariat + CEPI, FIND, DNDi, Unitaid. Ebola BDBV comme cas pour renforcer la preparedness, UN HLM Political Declaration, #100DaysMission. Qadeer Ahsan visible parmi les likes.

**Commentaire posté :**
> The R&D gap is real, but the surveillance gap is equally critical and less discussed. BDBV spread across Ituri, Nord-Kivu and Sud-Kivu, crossed into Uganda, and reached Europe precisely because early detection infrastructure in eastern DRC could not match the outbreak pace.
>
> The 100 Days Mission requires knowing where the pathogen is in real time before any response machinery can engage. Current figures: 1,406 confirmed cases, 438 deaths, 35+ health zones affected as of July 1.
>
> HealthWatch Global tracks this daily, aggregating WHO, ECDC and Africa CDC signals for real-time situational awareness.

**Contexte :** IPPS = organisation majeure preparedness pandemique. Audience = decideurs sante globale, institutions multilaterales. Angle choisi : surveillance comme complement au R&D (leur angle), pas competition.


---

## LinkedIn — DM Abraham USHACHO (2 juillet 2026)

**Profil :** Abraham USHACHO, Data Manager, Taskforce for Global Health. Connexion via Arran Hamlet.

**DM envoye :**
> Hi Abraham, glad to connect via Arran. I'm building HealthWatch Global, a real-time epidemic surveillance platform aggregating WHO and ECDC signals. Curious what data infrastructure your team at Taskforce for Global Health relies on for outbreak monitoring. Always interested in how data teams in the field approach this.


---

## X — Reply Abraar Karan @AbraarKaran (2 juillet 2026)

**Post original :** Marburg virus, Uganda, Kyegegwa district, enfant 1.5 ans deces. Africa CDC. Reuters. Abraar commente sur la question spillover vs transmission secondaire.

**Reply poste :**
> Confirmed in our feeds as of today: 1 case / 1 death, Kyegegwa district. On the spillover question: a 1.5-year-old has no plausible direct bat exposure pathway, which makes secondary transmission from an index case with bat contact far more likely. Finding that index case is the critical next step. Tracking this on HealthWatch Global.

**Contexte :** Abraar Karan = epidemiologiste majeur sur X (verifie, tres suivi global health). DB HealthWatch avait l'entree Marburg Uganda datee du 2 juillet (1 cas / 1 deces, actif).


---

## X — Reply Krutika Kuppalli @KrutikaKuppalli (2 juillet 2026)

**Post original :** Attaque et incendie du Centre de traitement Ebola de Bafwabango (Ituri, DRC), 30 juin 2026. 2 morts dont un policier. Tensions liees a un enterrement securise. Krutika commente sur community engagement et protection des soignants.

**Reply poste :**
> The Bafwabango attack has a direct surveillance consequence: when communities burn treatment centers, cases go underground, and the numbers we track become a floor rather than a ceiling. Ituri is already the epicenter of this outbreak across 24 health zones. Losing community trust there compounds every other response gap. Tracking via HealthWatch Global.

**Contexte :** Krutika Kuppalli = MD FIDSA, ex-WHO COVID-19 team, voix majeure global health sur X. Angle choisi : consequence surveillance de la resistance communautaire (floor vs ceiling).


---

## Email — Jalal Nourlil, Institut Pasteur Maroc (2 juillet 2026)

**À :** jalal.nourlil@pasteur.ma  
**Objet :** Petit suivi — HealthWatch Global  
**Statut :** À envoyer (David). Corrected 2 juillet 2026 — removed call proposal (violates rule), reframed to virological angle, switched to French.

**Contexte :** Jalal s'est inscrit spontanément le 12 juin 2026. A répondu le 24 juin : "virologue pas épidémiologiste, mais peut examiner méthodologie." Réponse de David du 24 juin envoyée (lien Ebola DRC + IHR mapping). Ce suivi : 20 jours après, VHF actifs en ce moment = angle parfait pour lui. Pas de proposition d'appel.

**Email (à envoyer) :**

> Bonjour Jalal,
>
> Merci pour votre réponse du 24 juin. Votre angle virologique est exactement ce qui manque souvent dans les retours qu'on reçoit.
>
> Depuis notre échange, la situation a évolué : Marburg vient d'être confirmé en Ouganda (1 cas, district de Kyegegwa, 2 juillet). Le pays gère simultanément Ebola Bundibugyo (20 cas actifs) et Marburg — deux filovirus distincts, deux chaînes de transmission séparées. C'est le genre de situation où la lecture des données brutes peut être trompeuse si on ne sépare pas clairement les deux événements.
>
> La fiche Marburg Ouganda est ici : healthwatch-global.com/fr/disease/marburg-virus-disease
>
> Ce que j'aimerais savoir : est-ce que le mapping RSI qu'on applique aux événements viraux vous semble cohérent avec ce que vous observez dans la littérature ? Si quelque chose vous paraît mal classifié ou manquant, votre retour compte.
>
> Si vous avez un collègue de l'équipe virologie qui suit ces foyers, je peux activer 2 sièges supplémentaires sur votre compte sans frais.
>
> Bien à vous,  
> David Deheunynck  
> HealthWatch Global — healthwatch-global.com

---

## X — Reply Ministere de la Sante RDC @MinSanteRDC (2 juillet 2026)

**Post original :** Point de situation Ebola 30 juin 2026. 1 406 cas (+73/24h), 438 deces, CFR 31.2%, 609 isolation, 192 gueris, 82.5% suivi contacts. Ituri 24 zones, Nord-Kivu 13 zones, nouvelle zone Lolwa.

**Reply poste :**
> These figures match exactly what we track on HealthWatch Global. The 82.5% contact tracing rate across 3 provinces is significant, but with +73 cases in 24h and 24 active health zones in Ituri, the untraced 17.5% represents a meaningful residual risk. The identification of Lolwa as a new zone confirms geographic expansion is still ongoing.

**Contexte :** Compte officiel MoH DRC. Donnees correspondent exactement a notre DB. Angle : confirmation alignement sources + lecture analytique (17.5% non traces, expansion Lolwa).

---

## X — Thread Uganda dual VHF (3 juillet 2026)

**Statut :** ENVOYÉ 3 juillet 2026.

**Angle :** Simultanéité de deux VHF actifs en Uganda — analyse surveillance.

**Données sources (Supabase, vérifiées le 2 juillet) :**
- Marburg virus disease, Uganda : 1 cas / 1 décès (2 juillet 2026) — district de Kyegegwa, enfant 1.5 ans — ACTIF
- Ebola virus disease, Uganda : 20 cas / 2 décès (1 juillet 2026) — ACTIF

**Thread (EN) :**

Tweet 1 :
> As of today, Uganda has two simultaneous hemorrhagic fever outbreaks active in its territory.
>
> Marburg: 1 case / 1 death. Confirmed today, Kyegegwa district.
> EVD: 20 cases / 2 deaths. Active since late June.
>
> That's rare. Here's what it means for surveillance response.

Tweet 2 :
> Both Marburg and Ebola are high-CFR filoviruses — but they are distinct pathogens with distinct reservoirs, distinct transmission chains, and distinct outbreak dynamics.
>
> The first responder challenge: you cannot assume that clinical presentation in one district is the same pathogen as the other.

Tweet 3 :
> In practice, running two simultaneous VHF responses means:
>
> — Two separate contact tracing networks (transmission chains don't mix)
> — Two separate lab confirmation pipelines (Marburg and EVD require different PCR panels)
> — Competing demand for the same PPE, isolation beds, and trained responders

Tweet 4 :
> The WHO IHR risk framing matters here. Both events are HIGH risk at national level by standard VHF criteria.
>
> The EVD event in Uganda is a separate spillover from the DRC epidemic (now at 1,406 cases). Cross-border transmission is the working hypothesis — not confirmed secondary spread.

Tweet 5 :
> For surveillance teams: the "fog of two simultaneous events" is real.
>
> When contact tracers and field epidemiologists are stretched across two response structures simultaneously, signal quality degrades — exactly when you need it most.
>
> Tracking both via HealthWatch Global.

**Note :** Thread analytique, pas alarmiste. Angle professionnel pour épidémiologistes et équipes réponse. Peut être posté en thread ou condensé en 1-2 tweets si le moment le justifie.

---

## LinkedIn — Post Uganda dual VHF (3 juillet 2026)

**Statut :** ENVOYÉ 3 juillet 2026.

**Angle :** Analyse de coordination pour équipes terrain NGO et coordinateurs santé humanitaires — l'audience exacte ciblée par la vague 3.

**Post :**

Uganda is currently managing two simultaneous hemorrhagic fever outbreaks.

Marburg virus disease: 1 case, 1 death. Confirmed today in Kyegegwa district — a 1.5-year-old child. Active.

Ebola virus disease: 20 cases, 2 deaths. Active since late June.

This coexistence is rare. And it creates a specific operational challenge that doesn't get discussed enough: the "two-outbreak fog."

**What the fog looks like in practice:**

Both Marburg and Ebola are filoviruses. They look clinically similar — fever, hemorrhagic symptoms, high CFR. But they're distinct pathogens with distinct reservoir hosts, distinct transmission chains, and distinct response protocols.

This means you cannot share contact tracing networks. A contact traced for one outbreak is not traced for the other. Two separate networks, competing for the same field epidemiologists, the same contact tracers, the same lab infrastructure.

It also means two separate PCR confirmation pipelines. Ebola and Marburg require different assays. When you're dealing with a suspected VHF case in a resource-constrained setting, every hour of diagnostic uncertainty matters.

**The spillover context:**

The EVD event in Uganda isn't isolated. The DRC epidemic is now at 1,406 cases across three provinces — Ituri alone has 24 active health zones. Cross-border spillover into Uganda is the working hypothesis for the EVD cases there, not a self-sustaining transmission chain.

Marburg, on the other hand, is a separate spillover event. Fruit bats. Kyegegwa district. A child.

Two separate introductions. Two separate responses. Same country. Same week.

**Why this matters for your coordination:**

For humanitarian health teams operating in Uganda — and there are many: MSF, IRC, Samaritan's Purse, among others — this dual outbreak creates competing demand for every resource: PPE, isolation beds, trained responders, community trust.

Community trust especially. When response teams are spread across two events, community engagement quality drops. And with VHFs, community trust isn't a nice-to-have — it's what determines whether cases present to treatment centers or stay hidden.

---

Tracking both events in real time on HealthWatch Global, aggregating WHO, ECDC, and Africa CDC signals.

**Contexte :** Post LinkedIn long, format analytique. Audience cible : coordinateurs santé humanitaires, épidémiologistes, équipes terrain ONG. Longueur intentionnellement plus longue pour LinkedIn (2 min de lecture). Le mention "Samaritan's Purse" est le type d'orga auquel on enverra la vague 3 — signal d'autorité indirect.

---

## LinkedIn — DM Awulachew Tadesse (4 juillet 2026)

**Profil :** Awulachew Tadesse, BSc MPH, field epidemiologist (Africa Health Collaborative, AAU project, Éthiopie). Conversation active depuis le 3 juillet : a signalé un foyer de rougeole chez des personnes déplacées internes dans sa zone, se présentant comme épidémiologiste de terrain avec certificat 7-1-7 Alliance.

**Contexte :** Le 4 juillet, il propose spontanément de partager le nombre de cas et la localisation exacte du foyer, le décrivant comme "formally reported and confirmed". Réponse envoyée pour accepter et qualifier la source avant tout ajout DB potentiel.

**DM envoyé :**
> Hi Awulachew,
>
> Yes, I'd be very interested, please share the case count and the exact location when you can. If there's a specific source behind the formal confirmation (MoH bulletin, cluster lead, WHO office, etc.), that would help us assess it properly.
>
> Thanks again for flagging this, field-level signals like this are exactly what we try to catch faster.
>
> David

**Double-check effectué :** pas de tiret cadratin, ton factuel sans pitch commercial, CTA léger (demande de données + source de vérification), longueur adaptée au DM.

---

## LinkedIn — DM Olivier Mukuku (4 juillet 2026)

**Profil :** Olivier Mukuku, M.D., MPH, MSc Epi, PhD, Institut Supérieur des Techniques Médicales de Lubumbashi / ANRS, RDC. Connexion acceptée 3 juillet, DM initial de David sur son étude choléra Goma.

**Contexte :** Le 4 juillet à 17:38, Olivier remercie pour l'intérêt porté à l'étude et mentionne qu'ils travaillent maintenant sur une étude antibiogrammes dans le même milieu. Pas de demande explicite de sa part, réponse pensée pour entretenir le contact sans pression.

**DM envoyé :**
> Bonjour Olivier,
>
> Avec plaisir. L'angle antibiogrammes est complémentaire de votre travail sur le choléra, je suis curieux de voir où ça mène. N'hésitez pas à partager quand ce sera publié.
>
> Bonne continuation,
> David

**Double-check effectué :** pas de tiret cadratin, pas de "temps réel" (conforme à la note de style déjà établie sur ce contact), pas de CTA, maintien de contact chaleureux.

---

## LinkedIn — DM Qadeer Ahsan (4 juillet 2026)

**Profil :** Qadeer Ahsan, Global Public Health Sector Specialist (UNOPS), Project Lead Fleming Fund Pakistan (£16M AMR), Strategic Advisor WHO, NIHR Global Health Research Committee. Conversation riche depuis le 18 juin sur le produit (framework Prevent/Detect/Respond, concept "one window", log d'escalade). Cherche activement du travail (TA contracts / advisory / full-time).

**Contexte :** Le 2 juillet, il a demandé à David de l'aider à trouver une opportunité. David est resté honnête sur les limites de son réseau, sans rien promettre, et a demandé où se situe son terrain le plus fort pour pouvoir l'orienter plus tard. Le 4 juillet, il répond : AMR au Pakistan + santé globale en Indonésie. Réponse pensée pour rester honnête (aucune opportunité concrète inventée) tout en donnant une reconnaissance tangible immédiate.

**DM envoyé :**
> Hi Qadeer,
>
> Good to know, that's useful for when the right opportunity comes up. Nothing concrete on the collaboration side yet, I won't manufacture something that isn't there, but I don't want your input to go unrecognized either.
>
> Two things now: I'd like to give you a Pro account, on the house, for shaping the decision-support direction (the Prevent/Detect/Respond framing and the escalation log idea were genuinely useful). And separately, would you be open to that insight being credited to you in a LinkedIn post? Only with your name attached if you're comfortable, no pressure either way.
>
> David

**Double-check effectué :** cohérent avec la position déjà tenue dans le fil (honnête, non-engageant sur une opportunité inexistante), pas de tiret cadratin, pas de témoignage fabriqué (consentement explicite demandé avant toute citation), reconnaissance concrète sans survendre. Une citation publique sur un sujet AMR sert aussi sa recherche d'emploi, alignement d'intérêts.

---

## LinkedIn — Post crédit Qadeer Ahsan (rédigé 5 juillet, PRÊT À POSTER lundi 6 juillet 2026)

**Contexte :** Feu vert de Qadeer reçu le 4 juillet ("Thanks. Sounds good. Please post."). Livraison directe de ce qui a été promis dans le DM du 4 juillet, pas de DM intermédiaire. Post en anglais (toute la conversation avec Qadeer s'est faite en anglais).

**Version EN (à poster) :**

> Most epidemic surveillance platforms are built for Detect. The signals are there, published by WHO, ECDC, PAHO and Africa CDC, often within hours.
>
> The harder problem, the one that actually decides outcomes, is Respond.
>
> I got a much sharper picture of that gap from a conversation with @Qadeer Ahsan: physician, MPH, 10+ years in international public health technical assistance. Project Lead for the Fleming Fund in Pakistan (£16M AMR programme), Strategic Advisor to WHO on TB, HIV and hepatitis, and a member of the NIHR Global Health Research Committee.
>
> He walked me through what actually happens inside a ministry once a signal lands:
>
> Signal → validation → focal point → escalation → action.
>
> Most tools stop at the signal. What he described as missing is a "one window" view: a single place to see a threat, plus a log of who escalated it, to whom, and when. Not another dashboard. An accountability trail.
>
> That's the decision-support layer we're building into HealthWatch Global next.
>
> Grateful for a conversation that pushed the roadmap somewhere more useful than one more feed of alerts.
>
> #GlobalHealth #DiseaseSurveillance #PublicHealth

**Note opérationnelle :** le @ marque l'endroit exact où sélectionner Qadeer dans le menu de mention LinkedIn en tapant son nom au moment de poster (sinon texte brut, pas une vraie mention/notification). Attention si LinkedIn propose plusieurs profils "Qadeer Ahsan" : bien choisir celui avec la photo/titre UNOPS (Global Public Health Sector Specialist), pas un homonyme.

**Double-check effectué :** zéro tiret cadratin, zéro proposition d'appel, longueur cohérente avec les autres posts LinkedIn, aucune citation fabriquée (seul "one window" cité entre guillemets, terme réellement utilisé par lui). Faits vérifiés contre le DM original du 4 juillet (Fleming Fund £16M, WHO TB/VIH/hépatites, NIHR, workflow signal→validation→focal point→escalation→action). Statut de recherche d'emploi de Qadeer volontairement omis du post (info privée confiée à David, pas destinée à être rendue publique) ; ses vraies références suffisent à servir sa visibilité.

**Double-check spécifique avec tag intégré (5 juillet) :** un seul tag dans tout le post (pas de sur-tagging), placé à une frontière naturelle de phrase ("with @Qadeer Ahsan:" suivi des deux-points qui introduisent ses références) donc pas d'effet "name-drop" isolé, le tag est immédiatement suivi de substance (workflow concret, pas juste un remerciement). Aucun autre nom/organisation (WHO, NIHR, Fleming Fund) taggé, uniquement Qadeer, conforme à ce qui a été validé avec lui. Le seul risque réel est opérationnel (homonyme sur LinkedIn), pas textuel : rien à changer dans le corps du post.

---

## LinkedIn — DM Zahra Bouzidi, réinitialisation accès (4 juillet 2026)

**Profil :** Zahra Bouzidi, épidémiologiste Algérie. Feedback produit précieux (filtres transmission + endémicité voyageurs) début session. Saga d'accès compte ouverte depuis le 25 juin.

**Contexte :** Après plusieurs jours de soucis de réception d'email (confirmation, puis probablement les liens de reset), une recréation de compte le 29 juin, et un nouveau blocage signalé le 3 juillet, vérification côté Supabase le 4 juillet : le compte iinnerre@gmail.com n'a jamais enregistré une seule connexion réussie depuis sa création. Diagnostic : problème de délivrabilité email récurrent plutôt qu'un mot de passe mal recopié. Mot de passe réinitialisé directement via l'API admin Supabase (contourne l'email) et transmis en DM.

**DM envoyé :**
> Bonjour Zahra,
>
> J'ai remis un mot de passe directement sur votre compte, sans passer par email cette fois vu les soucis de réception que vous avez eus. Voici les identifiants :
>
> Email : iinnerre@gmail.com
> Mot de passe : AkDBpGPrYZXQwv
>
> Connexion sur healthwatch-global.com/fr/login. Une fois connectée, vous pouvez le changer dans les paramètres si vous préférez.
>
> Dites-moi si ça bloque encore.
>
> David

**Double-check effectué :** salutation corrigée pour l'heure réelle d'envoi (Bonjour, pas Bonsoir), identifiants isolés sur leurs propres lignes pour copier-coller facile, pas de renvoi vers une étape déjà tentée sans succès (mot de passe oublié).

**Suivi :** si le blocage persiste malgré le reset direct, creuser la délivrabilité email (Supabase SMTP / Brevo) plutôt que de réessayer un simple reset, ce pourrait être un problème plus large affectant d'autres utilisateurs.

**Investigation root cause (4 juillet 2026, après-midi) :** confirmé via l'API admin Supabase que le compte iinnerre@gmail.com n'a `last_sign_in_at` à aucun moment depuis sa création (29 juin) jusqu'au reset manuel (4 juillet). `mailer_autoconfirm: true` est actif sur le projet (confirmé via `/auth/v1/settings`), donc la confirmation d'inscription n'a jamais bloqué l'accès — le vrai goulot d'étranglement est le mail de **reset de mot de passe**, entièrement dépendant du mailer Auth de Supabase (`resetPasswordForEmail`, appelé directement dans `forgot-password/page.tsx`), sans aucun fallback. Impossible de confirmer à 100% "SMTP par défaut vs custom" sans accès au Dashboard Supabase (aucun token Management API dans le repo) — à vérifier manuellement dans Project Settings > Auth > SMTP Settings. Deux autres comptes (elyan.delaunay@proton.me, ouedraogodaouda2408@gmail.com) montrent le même pattern "confirmé mais jamais connecté", signal faible (pas de champ `recovery_sent_at` exposé par l'API pour trancher) mais cohérent avec un problème plus large que le seul cas de Zahra.

**Fix livré :** le pattern `generateLink()` + envoi Brevo existait déjà pour les invitations pilotes admin (`app/api/admin/invite/route.ts`) — jamais appliqué au flow self-serve grand public. Répliqué pour le reset de mot de passe : nouvelle route [app/api/auth/reset-password/route.ts](../app/api/auth/reset-password/route.ts) (génère le lien de recovery via l'API admin Supabase, envoie l'email via Brevo au lieu du mailer Supabase, rate-limité 5/h/IP, erreurs capturées dans Sentry au lieu de disparaître silencieusement) + template [lib/reset-password-email.ts](../lib/reset-password-email.ts) (5 langues, même style que l'email de bienvenue) + [forgot-password/page.tsx](../app/[locale]/forgot-password/page.tsx) mis à jour pour appeler la nouvelle route au lieu de `supabase.auth.resetPasswordForEmail()` directement. Comportement anti-enumeration préservé (toujours "email envoyé" côté UI). Testé en local : `generateLink` réussit sur un compte réel, l'appel Brevo est accepté (HTTP 201, messageId confirmé) avec la clé de `.env.local.live`. Non testé : n'a pas pu confirmer que la clé Brevo est bien configurée sur Vercel production (à vérifier), et `.env.local` local n'a PAS `BREVO_API_KEY`/`RESEND_API_KEY` (présents dans `.env.local.live`/`.env.test.local`/`.env.example` seulement) — sans impact a priori sur la prod qui a ses propres env vars Vercel, mais à surveiller si un test local de cron/email semble "silencieusement" no-op.

**Reste à faire (David, côté Dashboard) :** vérifier Project Settings > Auth > SMTP Settings sur Supabase — si c'est le SMTP par défaut, envisager de basculer aussi la config globale vers un SMTP custom (nécessite les identifiants SMTP relay Brevo, différents de la clé API REST déjà utilisée) pour couvrir les autres emails Auth restants (changement d'email par ex.), en plus du fix ciblé déjà livré sur le reset de mot de passe.

---

## Réponses prêtes — objections sensibles (à utiliser seulement si la question arrive, jamais proactif)

### Pérennité solo founder / continuité de service

**Contexte :** un prospect (surtout institutionnel/ONG) peut s'inquiéter de dépendre d'un outil porté par un fondateur solo. Ne jamais aborder le sujet spontanément — juste avoir la réponse prête si la question arrive directement (DM, email, call).

**FR :**
> Oui, HealthWatch est piloté par une seule personne aujourd'hui — je ne vais pas prétendre le contraire. Ce que ça change concrètement pour vous : vos données restent portables à tout moment. Export CSV/JSON complet inclus dans tous les plans payants, sans préavis ni justification à donner. Si vous annulez, vous gardez tous les rapports et exports déjà téléchargés — aucun lock-in propriétaire, aucun format fermé. Le pipeline lui-même s'appuie uniquement sur des sources publiques et officielles (OMS, ECDC, PAHO, Africa CDC), donc même en cas d'indisponibilité temporaire de ma part, les données sous-jacentes restent accessibles directement chez les agences sources. C'est le choix que j'ai fait plutôt que de vous enfermer dans un format propriétaire.

**EN :**
> Yes, HealthWatch is a solo-run product today — I won't pretend otherwise. What that actually means for you: your data stays portable at all times. Full CSV/JSON export is included on every paid plan, no notice or justification needed. If you cancel, you keep every report and export you've already downloaded — no proprietary lock-in, no closed format. The pipeline itself only pulls from public, official sources (WHO, ECDC, PAHO, Africa CDC), so even if I were temporarily unavailable, the underlying data stays directly accessible from the source agencies. That's the tradeoff I chose over locking you into a proprietary format.

**Double-check effectué :** ton honnête sans minimiser (pas de "ne vous inquiétez pas"), aucune promesse intenable (pas de SLA de continuité fictif), s'appuie sur des faits vérifiés dans le code (export CSV/JSON réel, sources 100% publiques), pas de tirets cadratins, pas de chiffre d'équipe exagéré.

---

## Nouveaux inscrits — suivi

| Date | Email | Plan | Trial end | Locale | Note |
|---|---|---|---|---|---|
| 2026-07-02 14:37 | saeed.mohamood@gmail.com | Pro trial | 2026-07-16 | EN | Gmail, affiliation inconnue. Onboarding auto déclenché. Recherche LinkedIn si affinité institutionnelle. |


---

## Monitoring LinkedIn — 4 juillet 2026 (session planifiée)

Brouillons rédigés en attente de validation de David. Rien publié.

### Commentaires (file d'attente, max 3/session)

**1. Jalal NOURLIL MD. (1er, early adopter Institut Pasteur Maroc) — post arbovirus/dengue (7h)**
Post : appel à l'action WHO Global Arbovirus Initiative, 70% de la population mondiale à risque (dengue, chikungunya, Zika, fièvre jaune), surveillance génomique et partage de données au cœur.
> The 70% figure really captures how fast vector range has outpaced our surveillance maps. What strikes me in the arbovirus data is the lag between a local signal and its regional visibility. Genomic surveillance tells us what is circulating, but cross-border data sharing in near real time is what turns detection into preparedness. Reference labs and regional networks are exactly where that timeliness is won or lost.

**2. World Health Organization African Region — briefing Ebola RDC/Ouganda (20h)**
> The DRC and Uganda picture is really one epidemiological space, not two. With Ituri driving so many active health zones, the Uganda cases read as cross-border spillover rather than a separate transmission chain. That makes contact tracing continuity across the border the decisive variable. Briefings like this matter because shared situational awareness is what keeps the two responses from drifting apart.

**3. Global Health EDCTP3 — appel des PDP pour investissement soutenu (18h)**
> The Europe-Africa model works because it builds capacity that outlasts any single outbreak. What often gets underfunded in that equation is the surveillance layer that connects research to response. Clinical innovation matters little if the signal from the field arrives late or fragmented. Sustained investment in preparedness has to include the unglamorous data infrastructure, not just the trials it feeds.

### Notes de connexion (file d'attente, max 3/session)

**A. Marie Roseline Darnycka BELIZAIRE (2e) — épidémiologiste terrain, IMST continental Bundibugyo**
> Bonjour Marie Roseline, votre message sur l'IMST continental pour la riposte Bundibugyo m'a marqué, notamment transformer la coordination en impact de terrain. Je travaille sur la surveillance épidémiologique en temps réel et votre perspective terrain m'intéresse. Au plaisir d'échanger.

**B. Olivier Mukuku — chercheur Ebola RDC (a consulté le profil de David)**
> Bonjour Olivier, votre Perspective dans The Lancet sur la confiance communautaire et les enterrements dignes en contexte Ebola en RDC m'a marqué. Un angle trop souvent absent des données de riposte. Je travaille sur la surveillance en temps réel. Au plaisir d'échanger.


### Statut publication — 4 juillet 2026

- Commentaire 1 (Jalal NOURLIL MD., post arbovirus) : **posté** ✓
- Commentaire 2 (WHO African Region, briefing Ebola RDC/Ouganda) : **posté** ✓
- Commentaire 3 (Global Health EDCTP3, appel investissement) : **posté** ✓
- Connexion A (Marie Roseline Darnycka BELIZAIRE) : **invitation envoyée avec note**, statut "En attente" ✓
- Connexion B (Olivier Mukuku) : **non envoyée** — déjà 1er degré (connexion existante), pas de bouton "Se connecter" disponible sur son profil. Note laissée en l'état, à réutiliser si pertinent pour un DM (non validé dans cette session).

Bilan session : 3/3 commentaires postés, 1/2 connexions envoyées (quota respecté, aucun dépassement). 0 DM envoyé.

### Correction — DM Olivier Mukuku non envoyé

Avant l'envoi du DM approuvé par David, vérification de la messagerie complète : une conversation active existait déjà avec Olivier sur un tout autre sujet (son étude choléra à Goma, puis antibiogrammes), avec un dernier message de David envoyé 09:55 le jour même, sans réponse d'Olivier. Le DM Ebola/enterrements dignes rédigé plus haut n'a **pas été envoyé** pour éviter de dupliquer le contact et paraître décousu. Recommandation : attendre la réponse d'Olivier sur le fil existant avant toute relance. Quota DM final de la session : 0/2 utilisé.

### Connexions supplémentaires — 4 juillet 2026 (suite de session)

- Connexion C (Dr. Marc Yambayamba, épidémiologiste One Health, University of Zurich) : **invitation envoyée avec note** ✓
  > Hello Marc, your PLOS piece on socio-ecological systems mapping in DRC captures something rarely said clearly: epidemic risk builds up long before the first case, and surveillance integration matters as much as emergency response. Would love to connect.
- Connexion D (Simon Ruegg, systems practitioner in health, One Health) : **invitation envoyée SANS note** — erreur d'exécution, clic sur le bouton "Se connecter" compact d'une carte de suggestion (sidebar) qui envoie directement sans passer par la fenêtre d'ajout de note, contrairement au bouton sur la page de profil complète. Non retiré pour éviter le délai de recontact LinkedIn après retrait.

Bilan connexions session (cumulé) : 3/3 envoyées (quota plein) — Marie Roseline (avec note), Marc Yambayamba (avec note), Simon Ruegg (sans note, erreur d'exécution notée).

**6 juillet : Simon Ruegg a accepté l'invitation.** DM de bienvenue envoyé (validé par David) : hook sur son partage récent (1 sem) d'un article sur les signaux d'alerte précoce et méthodes de complexité pour la surveillance intégrée ("Signals from the future: An interdisciplinary engagement to early warning signals", Futures). Message : "Hi Simon, thanks for accepting. Your share on early warning signals and complexity methods for integrated surveillance really resonated. Trying to spot signal in fragmented outbreak reporting is exactly the gap HealthWatch Global is built to close. Would love to hear how you see systems thinking applied to real-time surveillance." Profil : systems practitioner in health, One Health, University of Zurich, mutuelle Dr. Marc Yambayamba (déjà contact HWG actif). Réponse riche reçue 12:40 : distingue deux niveaux (quelles données on observe vs. quelles métriques on utilise pour les résumer) et deux cadres (statistique linéaire classique — valeurs extrêmes — vs. cadre de complexité non-linéaire — fractalité des séries temporelles). Réponse envoyée 13:02 : "That distinction is sharp, thank you. The framework we lean on today is closer to your first camp, extreme values in a fairly linear read of case counts. The fractality angle is the harder, more honest question: most outbreak curves aren't smooth, and treating them as if they were is probably where a lot of early signal gets lost." Honnête sur les limites actuelles du framework HWG plutôt que de survendre. 14:10 : a répondu en développant : les autorités agissent trop tard par rapport aux signaux précoces ; à l'interface One Health des maladies émergentes, "une fois que la maladie est sortie du chapeau, c'est trop tard" ; plaide pour des approches systémiques détectant les signes de vulnérabilité des systèmes socio-écologiques. David a noté que cette conversation pourrait donner une idée d'amélioration produit. Réponse envoyée 15:03 (après le délai demandé par David jusqu'à 15h) : "That's the crux of it. Detecting vulnerability before the outbreak, rather than counting cases after, is a different kind of signal entirely, and probably requires different data sources than what most surveillance systems ingest today. What would an early indicator of social-ecological vulnerability actually look like in practice? Land use change, human-wildlife contact frequency, something else?" 15:41 : a répondu avec une piste produit substantielle — liste d'indicateurs précurseurs (chômage, mobilité, sécurité alimentaire, productivité agricole) et surtout un signal de fluctuation/variance dans les séries temporelles avant un basculement (proche du "ralentissement critique" en systèmes adaptatifs complexes). David a jugé la deuxième partie bien plus intéressante que la liste d'indicateurs (plus évidente). Réponse envoyée 16:26 (délai calé sur le temps de réponse de Simon, ~38 min sur l'échange précédent, David a demandé d'attendre 35 min) : recentrée sur le signal de fluctuation uniquement, avec une question technique sur la faisabilité (calculable sur nos séries de comptages de cas existantes, ou données différentes nécessaires). Retour substantiel archivé dans [product-feedback.md](product-feedback.md). En attente de sa réponse technique.

---

## Monitoring LinkedIn — 5 juillet 2026 (session planifiée)

Brouillons rédigés en attente de validation de David. Rien publié, aucune connexion envoyée, aucun DM envoyé, aucun profil suivi.

### Contexte fil d'actualité
Fil pauvre en contenu épidémio frais (< 48h) aujourd'hui. La plupart des posts pertinents (Maria Van Kerkhove 1 sem, Tedros 3j, IPPS Day 45 Bundibugyo 3j, EDCTP 3j) sont hors fenêtre 48h. Seul Africa CDC est actif dans la fenêtre, avec 2 posts.

### Commentaire (file d'attente, max 3/session — 1 seul candidat retenu)

**1. Africa CDC — interview Dr Jean Kaseya sur France 24, épidémie Ebola Bundibugyo RDC (16h)**
Post : Kaseya qualifie l'épidémie de « sérieuse » et non « alarmante », la place parmi les plus sérieuses en Afrique depuis 2 décennies (cas et décès), appelle à une riposte rapide, coordonnée et pleinement financée.
> The framing matters: calling it serious rather than alarming, and anchoring that in cases and deaths rather than perception, keeps a response proportionate. The harder part is getting the financing to follow the same curve as the epidemiology. Outbreaks rarely stall for lack of detection. They stall when resources arrive a phase behind the data.

Note : Africa CDC a un second post dans la fenêtre (Madagascar mpox, formation RRT/agents communautaires, 20h). Règle 1 commentaire/profil/semaine → un seul post retenu, l'interview Kaseya étant plus substantielle et analytique. Aucun commentaire posté sur Africa CDC cette semaine (session 4 juillet : Jalal Nourlil, WHO AFRO, EDCTP3).

### Découverte active de profils

**À connecter (partagent le quota de 3 notes/session) :**

**A. Henri Alamazani (2e) — MD, MPH, Field Epidemiologist & Technical Officer (Outbreak Response), WHO/GPEI, Kinshasa RDC. Polio/Immunization/VPD surveillance. Mutuels : Marie Roseline, Marc Yambayamba +3.**
> Hi Henri, your WHO/GPEI outbreak response and VPD surveillance work in DRC is exactly the field reality we track at HealthWatch Global. We have several connections in common, including Marie Roseline and Marc Yambayamba. Would love to connect.

**B. Dyson Mwandama (2e) — Field Epidemiologist, Task Force for Global Health, projet SONAR (Strengthening Outbreak Notification and Response), Malawi. Mutuel : Marie Roseline.**
> Hi Dyson, the SONAR project's focus on outbreak notification and response is closely aligned with what we build at HealthWatch Global, continuous epidemic surveillance across WHO and Africa CDC signals. Marie Roseline is a connection we share. Would love to connect.

**C. Kassim Kamara, M.Phil. (2e) — Applied Epidemiology (Advanced FETP), Field Epidemiologist, 9+ ans surveillance/outbreak response, Freetown Sierra Leone. Mutuel : Awulachew Tadesse.**
> Hi Kassim, your FETP background and 9+ years in disease surveillance and outbreak response caught my attention. At HealthWatch Global we track outbreak signals across Africa continuously. Awulachew Tadesse is a connection we share. Would love to connect.

**À suivre seulement (pas de note) :**
- **Jonathan Konko Makengo** — Épidémiologiste, surveillance intégrée & One Health, Bruxelles (réseau RDC/francophone). Mutuels : Marie Roseline, Dav Mulamba. Périphérique (Belgique) ; garder pour une connexion FR plus tard avec un hook réel.
- **Cynthia Musumba** — County Disease Surveillance Coordinator, Field Epidemiologist, One Health, IDSR/EBS, Kenya. Mutuel : Dr Paul Kibati. Fortement pertinente mais quota connexion plein (3) ; suivre pour l'instant.
- **Melaku Abebe** — Field Epidemiologist, Data Analyst, M&E & Surveillance, Addis-Abeba. Mutuel : Awulachew Tadesse.
- **Evans Ogondi** — Public/Environmental Health Officer, Jomo Kenyatta University (Kenya). Nouvel abonné de HWG (follow-back).

### DM de suivi (file d'attente, max 2/session — 2 retenus)

**DM 1 — Awulachew Tadesse (BSc, MPH) — foyer rougeole IDP Debre Berhan, Amhara, Éthiopie**
Développement du jour : Awulachew a communiqué « A total of 123 confirmed and epidemiologically linked measles cases at Debre Berhan, Amhara, Ethiopia IDP site », puis a proposé de partager la **line list**. Décision : décliner la line list (données personnelles de personnes déplacées, PII patient-level, cadre données/RGPD) et réorienter vers une source citable officielle ou un résumé agrégé sans identifiants. Cohérent avec [[feedback_verify_against_primary_source]] et le cadre légal RGPD.
> Thanks Awulachew, I really appreciate you offering. One thing though: please hold off on the line list. It carries personal data on displaced individuals, and I am not set up to receive or store patient-level identifiers, especially for a vulnerable IDP population.
>
> What would genuinely help is the official reference behind the 123 cases: an MoH or regional health bureau bulletin, a sitrep, or even an aggregated summary (cases by date and woreda, no names). That is what lets us log it against a citable source.
>
> Thanks again for flagging this. The field signal is valuable, we just need to handle the data cleanly. David

**DM 2 — Zahra BOUZIDI (MD, Public Health Epidemiology) — feedback produit**
Développement du jour : Zahra a laissé un feedback produit substantiel (4 juillet soir) : (1) ajouter le niveau de contagiosité dans le profil clinique (rougeole = la plus contagieuse) ; (2) foyers actifs en zones de conflit (Palestine, Soudan) — choléra, polio, typhoïde devraient remonter, l'écart venant du système de déclaration ; (3) a partagé une publication qui pourrait intéresser David.
> Bonjour Zahra,
>
> Merci beaucoup pour ce retour, il est vraiment précieux. L'idée d'afficher le niveau de contagiosité dans le profil clinique est excellente. Le cas de la rougeole parle de lui-même, je vais regarder comment l'intégrer proprement.
>
> Votre point sur les zones de conflit est juste aussi. Le Soudan, la Palestine et d'autres devraient faire remonter des foyers actifs de choléra, polio ou typhoïde, et l'écart vient souvent du système de déclaration plutôt que d'une absence réelle de cas. C'est exactement le type d'angle mort que je veux mieux traiter.
>
> La publication que vous avez croisée m'intéresse. N'hésitez pas à m'en donner le titre ou l'auteur quand vous voulez.
>
> Merci encore, David

### Veille passive (observation, hors quota)

**Nouvelle connexion acceptée :**
- **Dav Mulamba** (Field Epidemiologist EIR/RRT, DRC) — apparaît comme « votre nouvelle relation » dans les notifications, publie sur les données EDS-RDC 2023-2024 (zero-dose). Déjà suivi dans linkedin-contacts.md, conversation active.

**Nouveaux abonnés :**
- **Evans Ogondi** — Public/Environmental Health Officer, Jomo Kenyatta University, Kenya (repris ci-dessus en follow-back).
- **Mukanda Patrick** — Critical Care Aeromedical Evacuation Nurse. Périphérique (soins d'urgence, pas surveillance) ; noté, pas d'action.

**Vues de profil :** Dr. Marc Yambayamba (déjà connecté) + 1 autre.

**Engagement reçu :** Kerry Robinson a aimé le commentaire de David sur un post hantavirus (surveillance MV Hondius, détection rapide + contact tracing + clôture). Post David « A CFR is not a number. It's a variable... » : 369 impressions, 2 vues profil, 2 abonnés générés.

**Item à actionner (hors monitoring) :** Qadeer Ahsan a donné son feu vert (« Thanks. Sounds good. Please post. ») pour que David publie un post LinkedIn créditant son apport (framework Prevent/Detect/Respond + idée du log d'escalade), avec tag de son profil. **Prévu pour lundi 6 juillet** — ce post est directement la livraison promise, pas de DM intermédiaire nécessaire à Qadeer.

**Posts marquants hors fenêtre/quota (à retenir) :**
- International Pandemic Preparedness Secretariat — « Day 45 » du 100 Days Mission Ebola Bundibugyo (3j) : EOI diagnostics (83 soumissions), EUL en cours, essais Oxford/WHO PARTNERS (MBP134 + remdesivir) et EBO-PEP BUNDI imminents, gap post-trial access. Source institutionnelle riche à surveiller.
- Africa CDC — Madagascar mpox : formation RRT/agents communautaires (20h). Non commenté (règle 1/profil/semaine, interview Kaseya retenue).

### Statut publication — 5 juillet 2026
- Commentaire Africa CDC (Kaseya/Ebola) : **posté** ✓
- Connexions A/B/C (Henri Alamazani, Dyson Mwandama, Kassim Kamara) : **invitations envoyées avec note** ✓ (quota 3/3)
- Profils à suivre (Jonathan Konko Makengo, Cynthia Musumba, Melaku Abebe, Evans Ogondi) : **suivis** ✓
- DM 1 (Awulachew) : **envoyé** ✓ (version révisée orientant vers sources EPHI/PHEOC/WHO AFRO/IDSR, à la demande de David plutôt que le refus générique initial)
- DM 2 (Zahra) : **envoyé** ✓

Bilan session : 1/1 commentaire posté, 3/3 connexions envoyées, 4 follows, 2/2 DM envoyés. Validation groupée de David ("On fait tout"), tout exécuté dans les quotas.

---

## Posts MWF — 6 juillet 2026 (session planifiée, EN ATTENTE DE VALIDATION)

Sujet : convergence filovirus Afrique centrale/de l'Est. Données HWG vérifiées (is_seed:false), interrogées à l'étape 0 le 2026-07-06, updated_at 2026-07-05.
Chiffres cités : Ebola Bundibugyo RDC 1 460 cas / 452 décès (DON612, date 03/07) ; Ebola Ouganda 20 / 2 (DON612, date 01/07) ; Marburg Ouganda 1 / 1 (CIDRAP, date 02/07). Chikungunya écarté (toutes lignes is_seed:true). Ligne Ebola/France importée écartée (risque ton/exactitude).
Statut : brouillons présentés à David, RIEN publié à ce stade.

### Brouillon LinkedIn (EN)
> Three filovirus events are running at the same time in Central and East Africa right now.
>
> As of this week, the picture our platform is tracking:
>
> - Ebola (Bundibugyo virus) in the Democratic Republic of the Congo: 1,460 cases and 452 deaths (WHO DON, 3 July).
> - Ebola virus disease in Uganda: 20 cases and 2 deaths (WHO DON, 1 July).
> - A new Marburg virus death in Uganda: 1 case, 1 death (2 July).
>
> Two Ebola outbreaks and a Marburg death, in neighboring countries, inside the same fortnight.
>
> The operational problem is not any single one of these. It is the overlap. Ebola and Marburg share a filovirus profile but differ in reservoir, case definition and response protocol. They surface through different channels, WHO Disease Outbreak News, Africa CDC, national bureaus, on different timelines. Read one source at a time and each looks contained. Read them together and you see a region absorbing three concurrent hemorrhagic fever responses at once.
>
> That aggregate load is what determines whether staff, labs and vaccine stocks are stretched, and it is exactly what fragmented reporting hides.
>
> This is the gap HealthWatch Global is built to close: one continuously updated view across WHO, Africa CDC and national sources, so the concurrent picture is visible the day it forms, not weeks later in a retrospective.
>
> healthwatch-global.com

### Brouillon X (thread EN, 3 tweets)
> 1/ Two Ebola outbreaks and a new Marburg death, in neighboring countries, in the same two weeks.
> Concurrent filovirus activity is the hard case for epidemic surveillance. 🧵
>
> 2/ The real-time picture, 1-3 July:
> • Ebola (Bundibugyo), DR Congo: 1,460 cases / 452 deaths
> • Ebola, Uganda: 20 / 2
> • Marburg, Uganda: 1 death
> Read one source at a time and each looks contained. Sources: WHO DON, national bureaus.
>
> 3/ Ebola and Marburg differ in reservoir, case definition and protocol, and surface through different channels on different clocks.
> What fragmented reporting hides is the aggregate load on labs, staff and vaccine stock.
> That's the gap HealthWatch Global is built to close.

### MàJ 6 juillet — créneau LinkedIn réattribué au post Qadeer

David a confirmé que le LinkedIn du 6/07 est le post créditant Qadeer Ahsan (Detect vs Respond / one-window escalation log), feu vert « Please post » du 5/07. Le brouillon filovilrus LinkedIn ci-dessus est DÉCALÉ (candidat pour mercredi 8/07 sur les deux plateformes).

Companion X aligné sur le thème du post Qadeer (SANS citation/tag Qadeer, consentement limité au post LinkedIn) :
> 1/ Most epidemic surveillance tools are built for Detect. The signals are already there, WHO, ECDC, PAHO, Africa CDC, often within hours. The problem that actually decides outcomes is Respond.
> 2/ Inside a ministry, a signal moves through a chain: signal → validation → focal point → escalation → action. Most tools stop at the first arrow. Everything that determines whether anyone acts happens after it.
> 3/ What's missing isn't another dashboard. It's a one-window view: the threat, plus a log of who escalated it, to whom, and when. An accountability trail, not one more feed of alerts. That's the decision-support layer we're building into HealthWatch Global next.

Statut : en attente validation David (choix X aligné vs filovirus ; tag Qadeer sur X ; go publication). Rien publié.

### Statut publication — 6 juillet 2026

- X (thread 3 tweets, Detect vs Respond / one-window escalation log) : **posté** ✓ — vérifié en direct sur @HWatchGlobal, thread affiché correctement (3 tweets liés).
- LinkedIn (post Qadeer Ahsan, Detect vs Respond) : statut à confirmer par David (hors périmètre de cette session, David gère la publication LinkedIn lui-même ou à faire séparément).

Bilan session : 1/1 publication X confirmée. Filovirus (Ebola x2 RDC/Ouganda + Marburg Ouganda) reporté au 8 juillet.

### Correction post LinkedIn Qadeer — 6 juillet 2026

David a demandé plus de rigueur car le post crédite/tague Qadeer Ahsan nommément. Phrase corrigée : "often within hours" → "often within hours or days" (le délai de publication varie fortement selon la source OMS/ECDC/PAHO/Africa CDC et l'événement ; "within hours" seul était un raccourci rhétorique non rigoureusement vérifiable). Reste du post inchangé, déjà validé au double-check du 6/07.

### Statut publication — 6 juillet 2026 (clôture)

- LinkedIn (post Qadeer Ahsan, Detect vs Respond, version corrigée "often within hours or days") : **publié par David manuellement** ✓ (blocage technique de l'extension Chrome sur linkedin.com constaté dans cette session : navigation refusée sur les deux navigateurs connectés alors que x.com fonctionnait sans problème sur le même profil ; à investiguer côté configuration de l'extension avant la prochaine session).
- Lien healthwatch-global.com : à ajouter en premier commentaire par David.

Bilan final session MWF 6 juillet : X publié ✓ (session), LinkedIn publié ✓ (manuellement par David suite au blocage extension). Filovirus (Ebola RDC/Ouganda + Marburg Ouganda) reporté au 8 juillet.

---

## Veille LinkedIn — monitoring 6 juillet 2026 (session planifiée)

Posts marquants repérés au fil/notifications (pour référence, certains hors fenêtre 48h) :
- **Emile Faya BONGONO** (Épidémiologiste Senior AFENET, CERFIG Guinée) — 21h — étude publiée sur la dynamique du H5N1 hautement pathogène en Afrique : 8 000+ foyers aviaires, 369 infections humaines sur 20 ans ; H5N1 = principale menace grippale à l'interface homme-animal ; retards persistants de notification compromettant la riposte ; appel au renforcement de la surveillance intégrée One Health. **→ commentaire HWG proposé + connexion proposée.**
- **Africa CDC** — 18h — workshop Abuja pour standardiser les indicateurs de surveillance basée sur indicateurs (IBS) avec les maladies prioritaires et le système IDSR, pour améliorer détection précoce et rapidité de riposte. **→ commentaire HWG proposé (cœur du sujet HWG : comparabilité des données de surveillance).**
- **Africa CDC** — 36 min — webinaire World Zoonoses Day (6/07) avec FAO & WHO, One Health / zoonoses. Événement, hors quota commentaire (1 comment/profil/semaine, priorité au post IBS/IDSR).
- **Africa CDC** — 2h — Joint Planning Workshop Malabo, sécurité sanitaire Afrique centrale (surveillance, labos, One Health, partage de données).
- **International Pandemic Preparedness Secretariat** — 4j (hors 48h) — Day 45 du clock Ebola Bundibugyo / 100 Days Mission : point diagnostics (EOI, WHO EUL, 2 tests en revue), thérapeutiques (essai PARTNERS Oxford/WHO MBP134+remdesivir, EBO-PEP BUNDI obeldesivir), vaccins (CEPI/BARDA, UNICEF/Gavi). Institution à suivre.
- **Pathogen Genomics Laboratory (INRB, RDC)** — 3j (hors 48h) — visite des présidents Tshisekedi (RDC) et Ramaphosa (Afrique du Sud) au labo qui a séquencé le Bundibugyo ebolavirus de l'épidémie en cours. Institution à suivre.
- **WHO** — newsletter Health For All (12 min) : « Clinical trials for BVD begins » (Bundibugyo Virus Disease).
- **Global Health EDCTP3** — 5j (hors 48h) — arpraziquantel, 1er traitement pédiatrique schistosomiase (enfants 3 mois-6 ans).
- **Annals of Epidemiology** — 6j (hors 48h) — publication sur systems thinking en science de l'implémentation.

Aucun feedback produit substantiel reçu cette session (rien à ajouter à product-feedback.md).

---

## Emails de relance produit — audit onboarding — 7 juillet 2026

> **STATUT : les 3 emails ci-dessous ont été envoyés par David le 2026-07-08.** Suivi des réponses dans la mémoire early-adopters. Cadrés comme sonde de feedback + réactivation faible coût, pas win-back fiable.

Contexte : l'audit du 6-7 juillet a trouvé que 0/11 vrais utilisateurs n'avaient jamais configuré d'alerte régionale (tables vides en prod), expliquant le pattern "lit les emails pendant des semaines, ne revient jamais". Fix livré (commit `f1cce66`, enrollment par défaut à l'activation du trial) + backfill manuel sur les comptes réels encore en trial actif (jalal.nourlil, anakeseemmanuel8, iinnerre, saeed.mohamood — mayeul.peltier exclu, trial expiré le 6/07). Détail dans project_activation_funnel_audit et project_onboarding_alert_backfill (mémoire). Ces 3 emails sont **rédigés, prêts à envoyer par David lui-même** (pas de call proposé, pas de faux témoignage, angle honnête sur le bug trouvé).

### saeed.mohamood@gmail.com — EN — trial actif jusqu'au 16 juillet, maintenant enrôlé

**Subject:** A real gap in your trial, just fixed

> Hi Saeed,
>
> A quick, honest note about your HealthWatch Global trial.
>
> While reviewing our alert system, we found that regional alerts had never actually been turned on for your account, even though that's meant to be part of the trial. That's fixed now. Your account is set up across all five regions, so you'll get an email as soon as a new medium or high risk outbreak is published.
>
> Worth checking back next time one comes through.
>
> If anything about the dashboard felt confusing or just not useful so far, I'd genuinely like to hear it. No pressure either way.
>
> healthwatch-global.com
>
> David

### anakeseemmanuel8@gmail.com — FR — trial actif jusqu'au 19 juillet, maintenant enrôlé

**Objet :** Un vrai bug sur votre essai, corrigé

> Bonjour,
>
> Un mot rapide et honnête sur votre essai HealthWatch Global.
>
> En vérifiant notre système d'alertes, on s'est rendu compte que les alertes régionales n'avaient en fait jamais été activées sur votre compte, alors que ça fait partie de ce que l'essai est censé inclure. C'est corrigé maintenant. Votre compte est configuré sur les 5 régions, vous recevrez donc un email dès qu'un nouveau foyer à risque moyen ou élevé sera publié.
>
> Ça vaut le coup d'y jeter un œil la prochaine fois qu'une alerte arrive.
>
> Si quelque chose vous a semblé confus ou peu utile jusqu'ici, ça m'intéresse vraiment de le savoir. Sans aucune pression.
>
> healthwatch-global.com
>
> David

**Pas de prénom utilisé** : contrairement à mayeul.peltier (prénom.nom), l'adresse "anakeseemmanuel8" ne permet pas d'isoler un prénom avec confiance suffisante — pas trouvé non plus dans linkedin-contacts.md. Salutation générique délibérée plutôt qu'un prénom deviné et potentiellement faux.

### mayeul.peltier@gmail.com — FR — trial expiré le 6 juillet (hier), non enrôlé, angle feedback

**Objet :** Votre essai est terminé, une question rapide

> Bonjour Mayeul,
>
> Votre essai Pro sur HealthWatch Global s'est terminé hier.
>
> En creusant notre système d'alertes cette semaine, on a trouvé un vrai problème : les alertes régionales n'avaient en fait jamais été activées pour personne à l'inscription, vous y compris. Ce n'était donc pas un manque d'intérêt de votre part, la fonctionnalité n'a simplement jamais tourné. C'est corrigé maintenant pour les nouveaux inscrits.
>
> Ça m'intéresse d'avoir votre avis honnête. Qu'est-ce qui aurait rendu le tableau de bord plus utile pendant ces deux semaines ? Ou plus simplement, qu'est-ce qui vous a manqué pour revenir ?
>
> Si ça vous dit de rouvrir l'accès pour retester avec les alertes actives cette fois, dites-le-moi.
>
> David

**Différence délibérée avec les deux autres** : pas enrôlé dans les alertes (trial terminé, ça n'aurait servi à rien), donc pas de promesse d'alertes actives — uniquement une demande de retour honnête, avec une porte ouverte non engageante en fin de message plutôt qu'un CTA produit.

**Double-check (les 3 messages) :** ton honnête/transparent sur le bug trouvé, aucun call proposé, aucun témoignage fabriqué, longueur courte (80-100 mots), pas de tiret cadratin, paragraphes aérés.


---

## Session monitoring LinkedIn — 7 juillet 2026 (brouillons, EN ATTENTE DE VALIDATION DAVID)

> Run planifié autonome, David non présent. **Aucun contenu ci-dessous n'a été posté/envoyé.** Quotas visés : 2 commentaires (dont 1 optionnel), 3 notes de connexion, 1 DM. File d'attente et pertinence détaillées dans linkedin-contacts.md (bloc 7 juillet).

### Commentaire 1 — Mohammad Ilias Hossain (post Marburg/Ebola Ouganda, 2j)

> The concurrent Marburg and Ebola picture is what makes this so operationally hard. Two filoviruses that look alike clinically but demand separate contact-tracing networks and separate confirmation assays, all drawing on the same field teams and labs. The scarce resource isn't awareness of the threat, it's the surveillance capacity to run two responses at once without either losing focus. Cross-border data sharing with the DRC is what turns that from two strained efforts into one coherent regional picture.

### Commentaire 2 (OPTIONNEL) — Hans Kluge (article "Extreme heat: More deadly weeks may still lie ahead for the European Region", 38 min)

> Heat is one of the hardest hazards to see in the data, because the deaths rarely get coded as heat. They surface as cardiovascular or renal events scattered across all-cause mortality. The signal is real but diffuse, which is exactly why proactive regional warning matters more than after-the-fact counts. Reading vulnerability ahead of the peak, rather than tallying excess deaths after it, is the harder discipline.

**Caveat David :** Hans Kluge est un profil prioritaire (commentaire seulement, jamais de connexion), donc engager est on-strategy. Mais le sujet chaleur extrême est en marge du cœur HWG (surveillance de foyers épidémiques). Le commentaire ne prétend rien sur HWG (pas d'overclaim), il reste un engagement analytique de santé publique. À trancher : poster ou garder le 2e commentaire du quota en réserve.

### Note de connexion 1 — Ali Justin KONZI-GBERET (FR, carry-over 6 juillet)

> Bonjour Ali, nous sommes tous les deux à Lille et vos sujets, One Health et diplomatie sanitaire, recoupent directement ce que je suis au quotidien avec HealthWatch Global. Votre regard sur la gouvernance sanitaire m'intéresserait beaucoup. Au plaisir d'échanger.

### Note de connexion 2 — Anoop Velayudhan (EN, nouvel abonné)

> Hi Anoop, thanks for following HealthWatch Global. Your outbreak investigation and surveillance work at ICMR is the field lens I care about most, especially where early detection quietly breaks down before anyone declares an outbreak. Would value your take. Would love to connect

### Note de connexion 3 — Dr. Rashi Bhardwaj (EN, nouvel abonné)

> Hi Rashi, thanks for following HealthWatch Global. The One Health and zoonoses lens you work on is where most outbreaks actually begin, at the animal-human interface, long before they reach any dashboard. Would value your view on spotting spillover earlier. Would love to connect

### DM de suivi — Simon Ruegg (EN, réponse à sa ressource SPARCS partagée 09:51)

> Thanks Simon, I'll dig into the SPARCS material properly.
>
> The critical-transitions framing is the part that keeps pulling at me: reading the variance of a series rather than just its level. It reframes what counts as "early" in surveillance.
>
> The honest first test for us is whether that signal survives the messy, incomplete case series we actually get from the field. Have you seen it hold up under real-world reporting noise, or does it need cleaner data to be reliable?

**Double-check (tous les brouillons) :** angle surveillance épidémiologique/santé publique, aucun pitch commercial ni CTA produit, aucun lien, aucun faux témoignage, pas de tiret cadratin, notes de connexion < 300 caractères avec closer conforme à la langue (FR "Au plaisir d'échanger." / EN "Would love to connect"), commentaires 3-5 lignes une idée forte, DM aéré et sans CTA.

---

## Post MWF LinkedIn + X — 8 juillet 2026 (PUBLIÉ ✅)

> Run planifié, David présent en session. Brouillons validés après recheck DB ("ok les deux, après recheck"). Sujet : contraste des profils de risque entre les deux épidémies HWG non-seed les plus fraîches (Ebola Bundibugyo RDC vs Dengue Brésil), toutes deux updated_at 2026-07-08. Angle choisi pour diversifier hors du sujet Ebola sur-couvert depuis 3 semaines, tout en restant ancré sur la donnée HWG fraîche. Chiffres vérifiés à l'étape 0 puis recheckés avant publication, identiques.
>
> **LinkedIn : POSTÉ ✅** — publié par l'agent via le profil personnel de David (`linkedin.com/in/healthwatchglobal`, pas de page entreprise séparée — vérifié cette session), confirmation "Le post a bien été publié" affichée.
> **X : POSTÉ ✅** — publié par David lui-même (navigation vers x.com bloquée pour l'agent par l'extension Chrome, domaine non autorisé pour l'automatisation ; David a posté le thread manuellement).

Données citées (non-seed, vérifiées) : Ebola Bundibugyo RDC 1 460 cas / 452 décès (CFR 31 %, OMS DON612) + 1 cas importé France (Santé publique France) ; Dengue Brésil 407 750 cas / 241 décès (CFR 0,06 %, Ministère Santé Brésil gov.br). Ratio cas ≈ 280×.

### LinkedIn (FR)

> Deux épidémies sont actives en ce moment. Elles ne se ressemblent en rien, et c'est précisément le défi que pose la surveillance.
>
> D'un côté, Ebola Bundibugyo en République démocratique du Congo. Au 3 juillet, 1 460 cas confirmés et 452 décès, soit une létalité proche de 31 %. Une souche sans vaccin ni traitement homologué, et un premier cas importé jusqu'en France. C'est l'épidémie qui occupe les titres, à juste titre.
>
> De l'autre, la dengue au Brésil. Au 7 juillet, 407 750 cas et 241 décès sur l'année en cours. Une létalité de 0,06 %, mais un volume de cas près de 280 fois supérieur, une pression hospitalière bien réelle, et beaucoup moins de couverture médiatique.
>
> Ces deux événements ne se mesurent pas sur la même échelle. Létalité élevée d'un côté, volume élevé de l'autre : ce sont deux axes de risque distincts. Un décideur en santé publique doit pouvoir tenir les deux en même temps, sans que le signal fort n'efface le signal diffus.
>
> C'est la fonction d'une plateforme de surveillance en temps réel : garder tout le tableau visible. L'épidémie qui fait les titres n'est presque jamais la seule qui compte.
>
> Chiffres extraits du tableau de bord HealthWatch Global, sources OMS DON612 et Ministère de la Santé du Brésil, à jour au 8 juillet.
>
> healthwatch-global.com

### X (EN, thread 3 tweets)

> 1/ Two outbreaks are live right now. They could not look more different, and that gap is the surveillance problem in one frame.
>
> Ebola Bundibugyo, DR Congo: 1,460 cases, 452 deaths. ~31% CFR. No licensed vaccine or treatment. One imported case in France.

> 2/ Dengue, Brazil: 407,750 cases, 241 deaths this year. CFR 0.06%.
>
> Nearly 280x the case count of the Ebola outbreak. Real hospital strain. A fraction of the attention.

> 3/ High fatality and high volume are different risk axes. A decision-maker has to hold both at once, without the loud signal erasing the quiet one.
>
> The outbreak in the headlines is rarely the only one that matters.
>
> Live figures: WHO DON612 + Brazil MoH, via healthwatch-global.com

**Double-check :** chiffres alignés au mot près sur l'étape 0 (1 460/452, 407 750/241, cas importé France=1, ratio ≈280×, CFR 31 %/0,06 %) ; aucune ligne is_seed citée ; aucun faux témoignage ; pas de ProMED ; LinkedIn plus long/pro FR sans tiret cadratin, X court/dense/stratégique EN sans hashtag ; ton non-alarmiste et ne minimise pas Ebola (axes de risque distincts, pas de hiérarchie) ; lien healthwatch-global.com pertinent sur les deux.

---

## Monitoring LinkedIn — 8 juillet 2026 (BROUILLONS, EN ATTENTE DE VALIDATION DAVID)

> Run planifié autonome, David absent. Rien exécuté. File complète et veille dans linkedin-contacts.md (bloc 8 juillet). Tous les messages ci-dessous double-checkés (ton, exactitude, pas de CTA/lien dans les commentaires, ponctuation sans tiret cadratin, longueur, closer selon la langue).

### Commentaire 1 (PRIMAIRE) — World Health Organization African Region (SitRep Ebola/Bundibugyo, 14h)

> Bundibugyo virus outbreaks are far rarer than Zaire ebolavirus, which makes each situation report disproportionately valuable. With a smaller historical baseline, every confirmed case and contact recalibrates the case definition and CFR expectations in real time. The cross-border dimension with Uganda is where standardized, frequent reporting earns its keep, letting surveillance teams separate a real signal from noise before it travels.

**Double-check :** 4 lignes, une idée forte (rareté = valeur informationnelle de chaque SitRep), analytique, pas de CTA ni lien, pas de tiret cadratin, exact (Bundibugyo plus rare que Zaire ; dimension transfrontalière RDC-Ouganda réelle), pas de ProMED.

### Commentaire 2 (OPTIONNEL) — e-Bug France / CHU de Nice (Journée intl des zoonoses, One Health, 1j)

> The One Health framing lands beyond the classroom. Most high-consequence outbreaks we track, from the current Bundibugyo Ebola to Marburg and mpox, emerge at the animal-human interface, so zoonotic literacy is really upstream surveillance. Teaching young people to read spillover risk early is how a population learns to notice the signals before they become epidemics.

**Double-check :** 3-4 lignes, une idée (littératie zoonotique = surveillance en amont), pas de CTA ni lien, pas de tiret cadratin, exact (Bundibugyo/Marburg/mpox zoonotiques, suivis par HWG), pas de ProMED.

### Note de connexion 1 — DR-IFTIKHAR AHMAD (EN, 284 car.)

> Hi Iftikhar, thanks for reacting to my post on surveillance built for detection over action. Your work as National One Health Coordinator on AMR with the Fleming Fund sits right at that signal-to-action gap, and it's the field perspective I most want in my network. Would love to connect

**Double-check :** < 300 car., hook spécifique et vrai (il a réagi au post de David + rôle One Health/AMR), corps EN + closer « Would love to connect », pas de tiret cadratin, pas de CTA commercial.

### ~~Note de connexion 2 — Marie Jaspard~~ ❌ RETIRÉE

> **Erreur corrigée** : Marie Jaspard est **déjà relation 1er degré depuis le 6 juillet** (DM de suivi déjà envoyé). Proposée par erreur (bouton « Suivi » en page Abonnés mal lu). Aucune note à envoyer.

### Note de connexion 2 — Dr. Pragya Yadav (EN, ~291 car.)

> Hi Pragya, your work on high-consequence pathogens and biocontainment is exactly what the current Bundibugyo Ebola outbreak calls for. I track filovirus and VHF signals across WHO, ECDC and Africa CDC at Health Watch Global, and value staying close to that frontline view. Would love to connect

**Double-check :** < 300 car., hook topique et vrai (biosécurité/filovirus pertinent pour le foyer actif), corps EN + closer « Would love to connect », pas de tiret cadratin, pas de CTA. Degré confirmé 2e (relations communes Anoop + Rashi).

### Note de connexion 3 — Dr. Fleurette Domai Mbuyakala (EN, ~268 car.)

> Hi Fleurette, your expertise in disease surveillance and outbreak response from Kinshasa is exactly the frontline lens I build for at Health Watch Global, which tracks the DRC and its current Bundibugyo Ebola response across WHO, Africa CDC and ECDC. Would love to connect

**Double-check :** < 300 car., hook spécifique et honnête (surveillance/riposte RDC ; ne prétend PAS qu'elle travaille sur Ebola, dit que HWG suit la RDC et sa riposte Bundibugyo), corps EN + closer « Would love to connect », pas de tiret cadratin, pas de CTA. Degré confirmé 2e (« Se connecter » dispo), relations communes Zabre + Henri Alamazani. Trouvée par recherche active 8 juillet.

### DM optionnel — Kassim Kamara (EN, facultatif, réponse à sa clôture du 5 juillet)

> Thanks Kassim, the feeling is mutual. I'll keep an eye on your work, and I'm glad we're connected. Wishing you well until our paths cross again.

**Double-check :** court, chaleureux, pas de CTA/relance commerciale, pas de tiret cadratin. **Facultatif** : sa dernière ligne (« Let's keep in touch and see what the future holds. ») est déjà une clôture, aucune réponse n'est requise.

### Commentaires 2 et 3 ajoutés en session (validés + postés par David) — remplacent l'e-Bug abandonné

**Commentaire 2 — WHO Kenya (préparation Ebola, définitions de cas / SOP mis à jour, 1j) — POSTÉ :**

> Updating case definitions and SOPs before a single case appears is the least visible and most decisive part of surveillance. A harmonized definition means the first suspected case is classified the same way in Nairobi as across the border, and that consistency is what turns scattered reports into a usable regional signal. With Bundibugyo active next door in Uganda, this readiness window is exactly where the investment pays off.

**Double-check :** 3 lignes, une idée (définitions harmonisées *avant* le foyer = travail invisible mais décisif de la surveillance transfrontalière), pas de CTA ni lien, pas de tiret cadratin, exact (Bundibugyo actif en Ouganda voisin du Kenya), pas de ProMED. Profil distinct de WHO African Region (règle 1/profil/semaine respectée).

**Commentaire 3 — WHO EMRO (repartagé par ECDC), LLMs appliqués à la surveillance en production, webinaire 15 juillet, 1j — POSTÉ :**

> The move from sandbox to production is exactly where this gets interesting. In real surveillance the hard part is rarely the model, it is the messy input: unstructured bulletins, five languages, duplicate signals and the need to stay auditable when a machine flags a case. LLMs earn their place when they compress that noise without becoming a black box between the data and the epidemiologist.

**Double-check :** 3-4 lignes, une idée (surveillance en production = pipeline désordonné, auditabilité > modèle), pas de CTA ni lien, pas de tiret cadratin, angle builder authentique pour David (non épidémiologiste), pas de ProMED. Choisi par David vs l'alternative ECDC/Vibrio.

**Alternative non retenue (ECDC — data-viz risque Vibrio / canicules, 1h)**, gardée pour référence :
> This is what climate driven surveillance should look like. Vibrio is one of the clearest cases where an environmental variable, sea surface temperature, acts as a leading indicator weeks before the first wound or seafood infection is reported. Mapping the risk rather than only counting cases lets public health move from reacting to anticipating, which is the harder and more valuable half of surveillance.

### Note procédure navigateur (fiabilité renderer, 8 juillet)
Renderer Chrome instable en session (timeouts `Page.captureScreenshot`, clics-coordonnées ne focalisant pas les champs, fil infini qui gèle). Protocole fiable adopté et à réappliquer : **piloter par `ref` (find), lecture DOM (`get_page_text`/`read_page`) par défaut, screenshot seulement pour preuve finale, aller sur les pages entité/permalien plutôt que scroller le fil infini, recharger dès un gel.** Levier côté machine (David) : laisser la fenêtre Chrome pilotée au premier plan (les onglets en arrière-plan sont throttlés par Chrome). Cause secondaire écartée : 2 instances Chrome connectées, mais je n'en pilote qu'une (deviceId cible 23c7ecdd), non pertinent.

---

### Veille LinkedIn — posts notables repérés 9 juillet 2026
- **Leighton C.** (Ingénierie Biomédicale, Georgia Tech, 1j) — a construit un dashboard interactif de la propagation spatio-temporelle du foyer Ebola Bundibugyo (rapports RDC + presse locale ; map + treemap par région). Demande explicitement des retours sur la gestion des divergences de données et les stats à mettre en avant pour les officiels. **Cible commentaire #1 du jour** (directement dans le cœur métier HWG).
- **Africa CDC** (15h) — Ebola Outbreak Update au 04/07 (Bundibugyo, RDC + Ouganda). Cible commentaire optionnelle (redondance possible avec le commentaire WHO African Region d'hier sur le même sujet Ebola/Bundibugyo).
- **Mohammad Ilias Hossain** (2h, notif) — étude Malaria Atlas Project : chocs climatiques (inondations/cyclones) → +123M cas malaria et +500k décès en Afrique d'ici 2050, dont ~80% dus à la perturbation des systèmes de contrôle (moustiquaires, diagnostic, infrastructures) et non à l'extension de l'habitat vectoriel. **Cible commentaire #2 du jour.**
- **Marie Roseline Darnycka BELIZAIRE** (1er, 21h) — invitation webinaire WHO AFRO « Strengthening PH Emergency Management for Ebola and VHF in Africa » du 8 juillet (passé). Hors fenêtre d'action.
- **FLAVIVACCINE** (22h, aimé par IRD) — projet EU vaccins flavivirus à transmission vectorielle, angle interface piqûre/peau. À surveiller.
- **MSF Belgique** (1j, repartagé par **Maria Van Kerkhove**) — survivantes Ebola (Furaha 3 ans, Florence 42 ans) quittant le CTE d'Ituri (RDC). Fort en engagement (443 réactions). Human interest, pas de commentaire (repartage).

---

## Posts MWF — 10 juillet 2026 (vendredi)

**Statut : LinkedIn PUBLIÉ ✅ (profil David Deheunynck) — https://www.linkedin.com/feed/update/urn:li:activity:7481255363850358784/ — vérifié live le 10/07, texte confirmé identique mot pour mot au brouillon validé, pas de doublon. 1er commentaire (lien healthwatch-global.com) ajouté et vérifié le 10/07. X : bloqué, voir note ci-dessous.** Validé explicitement par David (« ok publie »). Publication LinkedIn finalisée par David lui-même (le renderer Chrome a gelé côté agent sur le clic Publier, cf. note procédure ci-dessous).

**Blocage X (@HWatchGlobal) :** x.com non autorisé dans l'extension Chrome de cette session (navigate refusé sur x.com/compose et x.com/home). Thread 3 tweets prêt (texte final ci-dessous), en attente que David autorise x.com ou publie lui-même.

**Run planifié automatique.** Sujet choisi : **rougeole aux États-Unis**, angle « la rougeole comme sentinelle des lacunes d'immunisation ». Choisi pour se démarquer de la semaine ultra-dominée par Ebola Bundibugyo (8+ posts/replies du 4 au 9 juillet) et Dengue Brésil (thread du 8 juillet).

**Source des données (étape 0, DB prod interrogée en direct ce 10/07) :** ligne `outbreaks` Rougeole / États-Unis — **2 170 cas**, date 2026-07-02, source CDC (cdc.gov/measles), `is_seed:false`, `active:true`. Faits épidémio complémentaires standards : R0 rougeole 12-18 (le plus élevé des pathogènes humains courants), seuil d'immunité collective ~95 %, élimination déclarée aux USA en 2000.

**⚠️ Correction data-intégrité effectuée pendant le double-check (10/07) :** la ligne DB affichait `deaths:3`, ce qui était FAUX — vérifié 2 fois contre la source primaire (CDC via AAP News / CIDRAP), **le total 2026 est de 0 décès** ; les 3 décès appartiennent à l'année 2025. Ligne prod corrigée (`deaths` 3 → 0). Aucun cron récurrent n'écrit cette ligne (mise à jour one-off du 05/07, même timestamp que Marburg), donc pas de re-clobber attendu. Le brouillon initial citait « 3 deaths » — supprimé.

**Hook renforcé pendant le double-check :** CIDRAP (« analysis warns ») rapporte que les USA sont susceptibles de **perdre leur statut d'élimination de la rougeole cet automne**. Intégré aux deux posts (attribué à une analyse, non asserté comme fait). Pas de claim de « record » : 2026 ≈ 91 % du total 2025 (donc 2025 était plus élevé), formulation gardée sans superlatif.

### LinkedIn (EN) — brouillon corrigé
> Measles is the disease that comes back first.
>
> The United States has recorded 2,170 confirmed measles cases so far in 2026 (CDC, data through July 2), with no deaths reported this year. Zero fatalities is good news, but the case count is the signal here, not the death count. For a disease the country declared eliminated in 2000, 2,170 cases is a warning, and analysts now say the US is at real risk of losing that elimination status this fall.
>
> This is not only a US story. Measles is resurging across Europe, parts of Africa and Asia at the same time, driven by the same cause: routine immunization coverage that slipped during and after the pandemic.
>
> Here is why measles is the disease that exposes those gaps first.
>
> It has a basic reproduction number (R0) of 12 to 18, the highest of any common human pathogen. That extreme transmissibility means it needs roughly 95% population immunity to stop sustained spread. Most other vaccine-preventable diseases need less.
>
> That threshold is what makes measles a sentinel. When immunization coverage slips even a few points below 95%, measles is the first disease to return, before pertussis, before diphtheria, before the others. A measles cluster is rarely just a measles problem. It is a visible marker of an immunity gap that other pathogens will eventually exploit too.
>
> For public health teams, the operational reading is not "how many deaths." It is:
> - Where are the clusters, and what is the local vaccination coverage there;
> - Is transmission still linked to known importation, or has it become community sustained;
> - Which age groups are affected, since that points to which cohort missed routine immunization.
>
> Watching that pattern in one country tells you little. Watching it across every surveillance feed at once is where the trend becomes legible. Zero deaths is the reassuring number. The immunity gap behind the case count is the one that matters.

**1er commentaire (optionnel) :**
> HealthWatch Global tracks measles alongside WHO DON, ECDC, PAHO and Africa CDC signals, updated continuously: healthwatch-global.com

### X (EN) — brouillon corrigé (thread 3 tweets)
**1/**
> The US has logged 2,170 confirmed measles cases in 2026, with no deaths reported this year (CDC, through July 2).
> Zero fatalities is the reassuring number. The case count is the one that matters.

**2/**
> For a disease the US declared eliminated in 2000, 2,170 cases is a warning. Analysts now say the country is likely to lose that elimination status this fall.
> Measles has an R0 of 12 to 18, the highest of any common human pathogen. It needs ~95% immunity to stop spreading.

**3/**
> That makes it a sentinel: when coverage slips, measles returns first, before pertussis, before diphtheria.
> The US is not alone. The same immunity gap is driving measles across Europe, Africa and Asia right now. A cluster is never just a measles problem.
> Live figures across WHO, ECDC, PAHO and CDC: healthwatch-global.com

**Auto double-check (v2, post-vérification source primaire) :** cases = correspondance exacte DB + CDC live (2 170, data through July 2) ; deaths = 0 confirmé 2× contre CDC/AAP/CIDRAP (erreur DB `deaths:3` corrigée) ; R0 12-18 et seuil 95 % = faits standards ; élimination USA 2000 = fait établi ; risque de perte du statut = attribué à une analyse (CIDRAP), non asserté ; aucun claim de record ; aucune ligne is_seed citée ; pas de ProMED ; pas de tiret cadratin dans le LinkedIn ; X dense/EN/sans hashtag. **NON PUBLIÉ** — attend validation explicite de David.

---

## Veille — posts notables repérés (10 juillet 2026, session monitoring LinkedIn)

- **Africa CDC** (compte officiel, 22h) — « Weekly Press Briefing, 9 July 2026 : Ebola Outbreak Status, DRC and Uganda Response ». Register: tiny.cc/o496101. Briefing hebdo sur les urgences sanitaires du continent (Ebola RDC/Ouganda). → **retenu comme opportunité de commentaire** (voir linkedin-contacts.md, file commentaire).
- **WHO EMRO + ECDC** (post co-brandé, 2j) — Webinaire « Applying Large Language Models (LLMs) to surveillance production work — Data science beyond theory and sandboxes », 15 juillet 2026, 11:00-12:00 (Cairo). Intervenant : **Enrique Delgado Rodríguez**, MSc RN, data scientist ECDC. David y a déjà commenté (commentaire liké par Mona Elbarbary, WHO EMRO). Directement au cœur du sujet HWG (sandbox → production en surveillance).
- **Tedros Adhanom Ghebreyesus** (23h) — post #Cancer (« A cancer diagnosis needs more than medicine »). Profil prioritaire mais **hors domaine surveillance épidémio** de HWG ; pas d'angle analytique honnête → non retenu pour commentaire.
- **Global Health EDCTP3** (16h) — post à angle football/Coupe du monde (« Spain is through to the World Cup quarter-finals... In 2027 #Spain wi... »). Profil prioritaire mais post à faible substance analytique → non retenu.
- **Health Policy Watch** (18h) — « Global health funding cuts are having devastating consequences for women and girls » (World Health Assembly). Institution à surveiller (proposée en suivi). Angle politique/financement, pas données de foyers → pas de commentaire.
- **Ifeanyi Nsofor / Africa Behavioral Science Network** (1 sem) — rapport Ebola BOSS (Behavioral Outbreak Sentinel Surveillance) Kinshasa/Goma. Pertinent mais **hors fenêtre 48h**.
- **MSF Canada** (1j) — campagne « Nourrir l'espoir » (témoignages). Institution pertinente, post émotionnel sans donnée épidémio → non retenu.
- **National Institute of One Health Nagpur** (republié par Anoop Velayudhan, notifications) — « Collaborative Readiness in Action : Pashujanya Yudh Abhyas » (exercice One Health Inde). Institution One Health à garder en visu.

---

## ✅ EXÉCUTÉ le 10 juillet 2026 (validé par David « allons-y »)

- **Commentaire 1 — Africa CDC (post « Weekly Press Briefing, 9 July : Ebola Outbreak Status, DRC and Uganda Response »)** : posté avec succès (compteur 1→2 commentaires, confirmé "maintenant" sous le nom de David). Texte : « Coordinating a single briefing across DRC and Uganda for two active outbreaks is the right operational call. When neighboring countries are each managing their own event, siloed messaging is usually what widens the cross-border gap, not the epidemiology itself. » Version corrigée post-double-check (ancrée uniquement sur le format briefing conjoint, sans chiffres importés d'un autre post). **Note technique** : plusieurs tentatives ont échoué avant succès à cause d'un reflow de page qui décalait les coordonnées entre clic et frappe (clics accidentels sur le profil d'un commentateur, "Yared Seyoum", sans conséquence). Résolu en utilisant `find` pour cibler le bouton "Commenter" puis le champ de saisie par référence (ref) au lieu de coordonnées à l'écran.

- **Commentaire 2/3 — Institut National de Santé Publique RDC (post « La continuité des opérations est assurée en Ituri », 1j)** : posté avec succès (confirmé « David Deheunynck • Vous, maintenant » sous le post). Texte : « Les rumeurs d'arrêt des opérations peuvent circuler plus vite que leur démenti, et dans une riposte Ebola active, cette incertitude pèse sur la confiance des communautés autant que l'épidémiologie elle-même. Nommer l'Incident Manager et expliquer ce qui a été résolu, plutôt qu'un démenti générique, c'est ce qui rend ce type de correction crédible sur le terrain. » Double-check fait avant publication (ancré sur le contenu réel du post, français cohérent, une idée forte, pas de CTA/lien). Note : le tri par défaut « Pertinence » de la page entreprise ne correspond pas à l'ordre chronologique du fil principal ; passer par « Classer par : Récent » pour retrouver un post précis vu dans le fil.
- **Vu mais expiré (hors fenêtre 48h)** : Larry Kerr (Global Health/National Security Executive), post substantiel sur Bundibugyo (>500 morts, essai clinique WHO PARTNERS, partage génomique ouvert Ouganda) — 3 jours, non exploitable pour un commentaire.

- **Commentaire 3/3 — Health Policy Watch (post « As negotiations on the Pandemic Agreement resume... African countries pushing on access to medicines/vaccines/diagnostics », 20h)** : posté avec succès (confirmé « David Deheunynck • Vous, maintenant »). Texte : « The PABS negotiations matter beyond the diplomacy: whether pathogen-sharing defaults to open or restricted terms determines whether faster, decentralized outbreak response becomes the norm or stays the exception. Uganda recently released its BDBV genomes from the current outbreak as open data, a practice these talks could either generalize or leave as a rare outlier. » Fait Ouganda (partage ouvert génomes BDBV) importé consciemment d'un autre post vu la même session (Larry Kerr, expiré) mais présenté comme apport de contexte personnel, pas comme contenu du post commenté — vérifié pour éviter la confusion source détectée plus tôt dans la session (cas Africa CDC).
- **Candidats explorés et écartés avant de trouver celui-ci** : Nancy Lee Sogbossi Zinsou (récit terrain Mongbwalu/Ituri, très riche, 3j — expiré), Jake Dunning/University of Oxford (essai PARTNER, 5j/1sem — expiré), page WHO AFRO introuvable (URL invalide, recherche LinkedIn infructueuse).

**Quota final session du 10 juillet : 3/3 commentaires, 3/3 connexions, 4 suivis + 3 invitations entrantes acceptées (Mona, Godwill, Nyakeh), 1 DM de suivi.**

---

## Veille LinkedIn — 2026-07-11 (run planifié, David absent : posts repérés, aucun commentaire exécuté)

### Posts pertinents dans la fenêtre 48h (candidats commentaire, à valider par David)
- **Africa CDC** (profil prioritaire, 17h) — « En appui au Gouvernement congolais, Africa CDC renforce la riposte contre Ebola en RDC » : déploiement d'équipes multidisciplinaires dans les zones de santé prioritaires (83 % des cas), approche de décentralisation, évaluations rapides, relais communautaires. urn 7481369154579501056. → **BLOQUÉ par la cadence** : David a déjà commenté un post Africa CDC le 2026-07-10 (« Weekly Press Briefing, 9 July »). Règle 1 commentaire/profil/semaine → non retenu cette semaine. Contenu conservé pour la veille (riposte Ebola RDC active).
- **Epicentre – MSF Epidemiology** (1j) — étape booster du vaccin paludisme R21/Matrix-M au Tchad (étude CoSAV-R21), comparaison stratégie PEV routine vs couplée CPS, ~80 % de couverture du booster dans le bras synchronisé CPS. → candidat commentaire.
- **Elise Vaysse** (Épidémiologiste, 1j) — bulletins régionaux d'indicateurs territorialisés de santé périnatale (Santé publique France). Angle surveillance/données territorialisées. → candidat commentaire secondaire (adjacent, pas cœur outbreak).
- **Gates Foundation** (22h) — infographie « 1 quadrillion de moustiques », angle paludisme/VBD. Commentaire de Nirbhay Kumar (Professor Global Health) sceptique sur le chiffre. → candidat commentaire faible (post grand public/gimmick).

### Posts marquants hors fenêtre 48h ou hors quota (retenus pour contexte, non commentables)
- **Larry Kerr** (4j, expiré) — Bundibugyo >500 morts confirmés, essai clinique WHO PARTNERS ouvert en RDC, séquençage ouvert de 17 génomes BDBV 2026 par les labos ougandais (INSDC), question de fond PABS/PHEIC (génomes ouverts vs Restricted-Use). Excellent contenu, sert de hook pour la connexion proposée.
- **ANRS MIE / Le Point** (5j, expiré) — Ebola Bundibugyo RDC : 438 décès / 1 406 cas, CFR 31,2 % (chiffres INSP), risque d'exportation Ouganda/Soudan du Sud, faible en Europe (Yazdan Yazdanpanah).
- **Maria Van Kerkhove (repartage de Donald Brooks, 19h, notif)** — preprint medRxiv sur la couverture vaccinale COVID mondiale 2021-2024 (données + code ouverts). Institution/personne prioritaire à surveiller.
- **Africa CDC / Ministère de la Santé RDC** — actifs sur la riposte Ebola, à continuer de surveiller pour un futur DON613+.

### Commentaire 1/2 — Elise VAYSSE (post santé périnatale territorialisée, 1j) — 2026-07-11
Posté avec succès (confirmé "David Deheunynck • Vous, maintenant"). Texte :
> Territorialiser les indicateurs jusqu'au département, c'est passer d'un constat national à un outil réellement actionnable : les disparités périnatales ne se corrigent pas au niveau où on les moyenne, mais au niveau où on peut agir. La vraie valeur de ce type de bulletin se mesurera à la vitesse à laquelle un écart repéré localement se traduit en action de prévention, pas seulement à la finesse de la maille.

### Commentaire 2/2 — Epicentre – MSF Epidemiology (post booster R21 Tchad, 1j) — 2026-07-11
Post retrouvé via recherche LinkedIn (avait disparu du fil après refresh). Posté avec succès (confirmé "David Deheunynck • Vous, maintenant"). Texte :
> Le résultat le plus parlant ici n'est pas le vaccin lui-même mais la logistique de délivrance : environ 80 % de couverture du booster dans le bras couplé à la CPS, c'est la démonstration que l'adhésion se joue autant sur le canal d'administration que sur le produit. Comparer PEV de routine et couplage CPS, c'est exactement le type de donnée opérationnelle qui manque souvent pour décider d'un déploiement à l'échelle.

**Quota commentaires session : 2/3 utilisés (Elise Vaysse, Epicentre). Gates Foundation écarté (non recommandé au double-check).**

---

## Veille LinkedIn — 2026-07-12 (run planifié, David absent : posts repérés, aucun commentaire exécuté)

### Posts pertinents dans la fenêtre 48h
- **INGRIDE SIEMENI** (2e, Master Student in Public Health / Epidemiology) — 17h — post "Surveillance épidémiologique en Afrique : sommes-nous prêts face aux crises sanitaires de demain ?". Cite fragmentation des systèmes d'information, qualité des données, One Health, alerte précoce, et pose une question ouverte sur les priorités. **Directement au cœur du sujet HWG → cible commentaire #1 (safe, profil jamais commenté).**
- **Africa CDC** (profil prioritaire, 1j) — "En appui au Gouvernement congolais… déploiement d'équipes multidisciplinaires, zones prioritaires (83 % des cas), décentralisation" (urn 7481369154579501056). **BLOQUÉ par cadence** : David a commenté un post Africa CDC le 2026-07-10 → règle 1 comment/profil/semaine, non retenu jusqu'au ~17/07. (Déjà identifié et bloqué le 11/07.)
- **Mohammad Ilias Hossain** (déjà suivi) — 13h (notif) — "Australia Reports 326 Diphtheria Cases, 68 Hospitalizations, 1 Death…". Donnée exactement dans le périmètre HWG (Diphtérie/Australie déjà en DB). **BLOQUÉ par cadence** : commentaire posté sur son post malaria/climat le 2026-07-09 → 1 comment/profil/semaine, bloqué jusqu'au ~16/07.

### Posts marquants hors fenêtre 48h ou hors quota (retenus pour contexte, non commentables)
- **Nancy Lee Sogbossi Zinsou** (5j) — terrain Mongbwalu/Ituri, 17e riposte Ebola, alertes communautaires lentes comme vrai facteur limitant. Hors 48h pour commentaire → basculé en cible CONNEXION (voir linkedin-contacts.md).
- **World Health Summit** (3j) — pandemic preparedness, cite Ebola/hantavirus/Nipah + surveillance/data sharing. → cible SUIVRE.
- **Tedros Adhanom Ghebreyesus** (1 sem) — essai clinique PARTNERS (traitements Bundibugyo), enrôlement patients RDC. Hors fenêtre.
- **World Health Organization** (9h, tendances) — édition newsletter : enrôlement patients essai PARTNERS. Roundup, angle de commentaire faible, non retenu.
- **Ifeanyi Nsofor** (10-14h) — cadre de science comportementale / demande vaccinale HPV Nigeria. Réflexif mais périphérique au cœur surveillance HWG. Non commenté.
- **Silvia Bertagnolio** (WHO, 12h) — offre de consultance AMR Burden Estimation. AMR = adjacent (HWG ne fait pas de surveillance AMR dédiée). Non commenté.

### Commentaire 1 — INGRIDE SIEMENI (post surveillance épidémiologique en Afrique, 17h) — brouillon, EN ATTENTE DE VALIDATION DAVID
Texte proposé (FR, langue du post) :
> La fragmentation des systèmes d'information que vous citez est souvent le vrai goulot d'étranglement, plus que la détection elle-même. Un même signal remonte via l'IDSR national, Africa CDC et l'OMS à des rythmes différents, et le temps perdu se situe rarement dans la collecte, plutôt dans la réconciliation de ces sources. Investir dans l'interopérabilité et des définitions de cas comparables entre pays donne souvent plus de rapidité que d'ajouter un outil de collecte de plus.

**Double-check :** 3 phrases, une idée forte (interopérabilité/réconciliation > ajouter un outil de détection), pas de CTA ni lien, ne mentionne pas HWG (pas d'overclaim), pas de tiret cadratin, français cohérent avec le post, pas de ProMED, faits génériques exacts (IDSR/Africa CDC/OMS). Safe côté cadence (profil jamais commenté).

**Note cadence session :** les 2 meilleures cibles Ebola/Afrique du fil (Africa CDC, Mohammad Ilias Hossain) sont bloquées par la règle 1/profil/semaine. INGRIDE reste la seule cible commentaire core, in-window et non bloquée. Fil très dominé par Ebola RDC/Bundibugyo ce jour.

### ✅ Commentaire 1 — INGRIDE SIEMENI — POSTÉ le 2026-07-12 (validé par David « Je valide »)
Publié avec succès sur le post « Surveillance épidémiologique en Afrique » (17h au moment du repérage, via la page d'activité du profil, permalien du fil non utilisé). Confirmé en direct : le commentaire apparaît en tête de liste, horodaté "1 s" au moment de la vérification, immédiatement après le bloc profil de David (healthwatch-global.com), texte identique mot pour mot à la version validée :

> La fragmentation que vous citez est souvent le vrai facteur limitant, plus que la détection : un même signal remonte via l'IDSR national, Africa CDC et l'OMS à des rythmes différents, et le temps se perd surtout dans la réconciliation, pas dans la collecte. Harmoniser les définitions de cas entre pays accélère souvent plus la réponse qu'un outil de collecte de plus.

**Double-check final (2e passe, avant publication) :** longueur resserrée de 3 phrases/~495 caractères à 2 phrases/~370 caractères pour s'aligner sur le gabarit des commentaires postés précédemment (Africa CDC ~265 car., Health Policy Watch ~370 car.) — l'original dépassait largement "3-5 lignes". Reste : pas de tiret cadratin, pas de CTA/lien, pas de ProMED, ne mentionne pas HWG (aucun risque d'overclaim), français cohérent avec le post, IDSR/Africa CDC/OMS = fait structurel générique et défendable (pas de chiffre inventé), cadence safe (profil jamais commenté).

**Note technique renderer :** plusieurs `screenshot`/`zoom` ont timeout (CDP gelé) pendant la saisie ; vérification faite avec succès via `javascript_tool` (lecture directe de `innerText` du `contenteditable`) plutôt que capture d'écran, conforme au protocole déjà documenté (piloter par ref/DOM, screenshot en dernier recours).

**Bilan quota session 2026-07-12 : 1/3 commentaires postés.** Reste en attente : 3 connexions (Nancy Z., Gaetan A., Mbadjivi K.), 0/2 DM.

### ✅ Commentaire 2 — Johan Verheyden — POSTÉ le 2026-07-12 (validé par David « Je valide les deux »)
Publié avec succès sur le post « Ebola is not spreading in an institutional vacuum » (19h au moment du repérage, rapport African Intelligence sur la riposte Ebola RDC). Confirmé en direct via permalien du post (urn:li:activity:7481654163375058944), horodaté "maintenant", immédiatement après le bloc profil de David :

> The framing of escapes as signal rather than non-compliance is the sharper point here. Most outbreak dashboards only track cases and deaths, so a spike in facility escapes rarely shows up as data, even though it is often the earliest sign that trust has broken down in a health zone. That is where a lot of preventable escalation probably gets missed.

Profil vérifié avant publication : Johan Verheyden, fondateur d'Aries Consult, publie régulièrement "African Intelligence" (newsletter d'analyse risque Afrique, couverture Ebola RDC/Bundibugyo substantielle et récurrente) — profil légitime, jamais commenté avant, cadence safe.

### ✅ Commentaire 3 — World Health Organization African Region — POSTÉ le 2026-07-12
Publié avec succès sur le post « In Beni, DRC, the #Ebola response continues to strengthen » (1j, visite de Dr Chikwe Ihekweazu + Julien Harneis). Confirmé en direct, horodaté "maintenant" :

> Expanded treatment capacity is the easier thing to report. Community engagement quality is the harder one to capture, but it is usually what determines whether new facilities get used or avoided. A visit like this matters most for what it signals locally: that the response stays accountable to communities, not just to case counts.

**Double-check (2 passes) :** version initiale « the easier number to report » corrigée en « the easier thing to report » (capacité de traitement n'est pas littéralement un nombre, léger décalage catégoriel). Ton vérifié non-accusatoire envers les personnes nommées (registre structurel mesurable/non-mesurable, cohérent avec le commentaire Africa CDC déjà validé le 10/07). Cadence vérifiée : dernier commentaire WHO African Region le 04/07 (8 jours, fenêtre 1/semaine rouverte).

**Note technique :** page entreprise triée par défaut sur "Pertinence" ne correspond pas à l'ordre chronologique du fil ; passage par "Classer par : Récent" nécessaire pour retrouver le post exact (protocole déjà documenté le 10/07).

**Bilan quota session 2026-07-12 final : 3/3 commentaires postés (INGRIDE SIEMENI, Johan Verheyden, WHO African Region), 3/3 connexions envoyées, 0/2 DM.** Quota commentaires plein pour cette session.

### À surveiller pour les prochaines sessions (signalé par David, 2026-07-12)
- **Maria Van Kerkhove** — a priori un preprint sur la couverture COVID (source/contenu exact non retrouvé en session, à vérifier au prochain passage : profil actif dans le réseau HWG, déjà croisée plusieurs fois en repartage MSF/Ebola). Vérifier son fil en priorité à la prochaine session.
- **Africa CDC / Ministère de la Santé RDC** — surveiller l'apparition d'un futur DON613+ (recoupe la lacune déjà notée le 07-07 : aucun cron HWG ne surveille automatiquement les nouveaux WHO DON, voir mémoire projet côté produit). Côté LinkedIn : surveiller aussi leurs comptes pour un premier relais social d'un nouveau DON avant confirmation officielle.

### Précision veille — Maria Van Kerkhove (vérifié en session, 2026-07-12)
Repartage (pas post original) d'un post de **Donald Brooks** (Consultant epidemiologist, Epidemic and Pandemic Management, WHO) : preprint medRxiv "Global COVID-19 vaccination uptake across the emergency and early post-emergency periods, 2021-2024" — couverture vaccinale COVID mondiale 2021-2024, écarts importants entre pays à revenu faible (27% primo-série complète) et élevé (72%), booster très inégal (33% population totale). Post original vieux de **5 jours au moment de la vérification (12/07) → déjà hors fenêtre 48h**, et quota commentaires déjà plein cette session (3/3). Non actionnable aujourd'hui. À re-vérifier si Maria Van Kerkhove ou Donald Brooks publient un contenu frais dessus, sinon laisser tomber cet angle précis.

---

## Veille LinkedIn — 2026-07-12 (2e run planifié, David absent — AUCUNE action, quotas déjà pleins)

**Rappel quotas du jour :** le run antérieur du 12/07 a tout consommé — 3/3 commentaires (INGRIDE SIEMENI, Johan Verheyden, WHO African Region), 3/3 connexions (Nancy Z., Gaetan A., Mbadjivi K.), 1 DM (Gaetan), 4 suivis. Ce 2e run n'exécute rien ; il archive de la veille fraîche.

### Posts repérés (hors action possible aujourd'hui)
- **WHO Hub for Pandemic and Epidemic Intelligence (EIOS)** (1j, EN) — « Outbreaks do not respect borders, and neither should the information used to respond to them. » EIOS a renforcé la collaboration pendant les foyers **Ebola + hantavirus** ; communauté 4000+ membres, monitoring boards partagés. **Modèle exactement aligné avec HWG (renseignement épidémique open-source).** Excellente cible commentaire MAIS quota comm. plein aujourd'hui + post proche d'expirer (fenêtre 48h). À exploiter seulement si EIOS republie du frais. **Brouillon EN conservé pour réutilisation :**
  > The point about information not respecting borders resonates. From tracking the same Ebola and hantavirus signals, the hardest part is rarely finding the first report; it is reconciling the same event described differently across sources and languages before it can be acted on. Shared monitoring boards and a common community are exactly what turn scattered open-source signals into something decision-ready.
- **Larry Kerr** (5j, hors fenêtre) — post Bundibugyo >500 morts, essai clinique WHO PARTNERS, 17 génomes BDBV publiés en open data (Ouganda). Re-vu, toujours hors 48h. David le suit déjà. Non actionnable.
- **Africa CDC** (1j) — riposte Ebola RDC décentralisée (83 % des cas, relais communautaires). Toujours bloqué cadence (commenté le 10/07, règle 1/profil/semaine). Veille.
- **Mohammad Ilias Hossain** (15h, notif) — « Australia Reports 326 Diphtheria Cases… » : donnée exactement dans le périmètre HWG (déjà en DB). Bloqué cadence (commenté 09/07). Veille.

### Veille passive
- **Page abonnés re-vérifiée (97 abonnés)** : aucun nouvel abonné HWG-pertinent au-delà de ceux déjà loggés (Gaetan Adouaka, Mona Elbarbary/WHO EMRO, Catherine Bennett, Hassan Sana, Abasse Zombra, Godwill Ndehedehe, Nyakeh Ngobeh). **Elvis TEMFACK (Head R&D, Africa CDC)** présent parmi les abonnés → proposé en suivi-retour (voir linkedin-contacts.md).
- **Messagerie** : fil actif HWG avec **Gaetan Adouaka** (DM du 12/07 08:44 envoyé, pas encore de réponse) et **Komlanvi DZENYO (MPH)** (« Merci David. Je serai très ravi pour la collaboration », 11/07). Rien à exécuter ce run. (Messages « site vitrine » = freelance, ignorés par séparation stricte.)
- **Découverte active** : 8 candidats connexion field-epi archivés dans linkedin-contacts.md pour la prochaine session (Martin Yakum/Epicentre, Hannington Katumba/One Health, etc.).

---

## Post — 12 juillet 2026 — TEST lien en corps de post (BROUILLON, EN ATTENTE DE VALIDATION DAVID)

**Contexte :** suite au diagnostic du funnel signups organiques ce même jour (voir mémoire `project_organic_signup_funnel_diagnosis_2026_07_12` — 74 relations, 1 215 impressions/7j, 1 seul clic lien sur la semaine), David a demandé de tester le lien directement dans le corps du post plutôt qu'en 1er commentaire (pratique standard jusqu'ici pour ne pas être pénalisé par l'algo LinkedIn). Écart volontaire et assumé par rapport à la convention habituelle, pour ce post uniquement — à comparer aux impressions/clics des posts précédents une fois publié.

**Sujet choisi :** rougeole au Mexique, angle Coupe du Monde FIFA 2026 (en cours, hôte Mexique/USA/Canada, finale le 19 juillet). Sujet frais (aucun post précédent ne l'a couvert), distinct de Rougeole/US déjà traité le 10 juillet, et directement pertinent pour les segments "corporate risk & global mobility" / "travel medicine" déjà ciblés sur la page d'accueil HWG.

**Source des données (étape 0) :** ligne DB `outbreaks` Rougeole/Mexique trouvée avec des chiffres périmés (10 920 cas / 13 décès, alerte PAHO du 29 mai) alors que PAHO a publié 2 situation reports plus récents depuis (No.5 le 18/06, No.6 le 2/07). Vérifié directement contre le PDF du **Situation Report #6 (2 juillet 2026, données jusqu'à SE25/27 juin)** : Mexique 11 820 cas / 16 décès 2026, tendance déclinante (Rt=0,66) ; États-Unis 2 134 cas / 0 décès, déclinant ; Pérou 737 cas, Rt=1,35 (**seul pays encore en accélération**), concentré à Puno ; +34 millions de doses administrées au Mexique ; vaccination maintenue dans les 3 villes hôtes mexicaines (Mexico, Monterrey, Guadalajara). **Ligne DB corrigée en conséquence** (cases 10 920→11 820, deaths 13→16, date→2026-06-27, source→Sitrep #6) pour rester cohérente avec le post. Note : les champs description_fr/es/ar/id de cette ligne restent basés sur l'ancienne alerte du 29 mai (texte prose non retraduit) — flaggé séparément pour une passe dédiée, hors périmètre de cette session.

### LinkedIn (EN)
> Mexico is hosting World Cup matches this month while running the largest measles outbreak in the Americas.
>
> 11,820 confirmed cases in 2026, 16 deaths, per PAHO's latest regional situation report (data through June 27). The trend is declining, and authorities have administered more than 34 million vaccine doses so far, with outreach continuing in the tournament's three Mexican host cities: Mexico City, Monterrey, Guadalajara. Still, the total is more than 5x the United States (2,134 cases, also declining).
>
> One country in the region is moving the other way. Peru's effective reproduction number is estimated at 1.35, the only sustained outbreak in the region still accelerating, concentrated in Puno.
>
> For teams managing corporate travel or public health risk around a month-long event drawing millions of international visitors, this is the kind of signal that belongs next to the flight itinerary, not three clicks into a PDF.
>
> Full country-by-country data, updated continuously: healthwatch-global.com

**Double-check :** chiffres vérifiés contre le PDF primaire PAHO Sitrep #6 (pas juste la page de résumé, ni la DB HWG avant correction) ; ratio "more than 5x" recalculé (11 820/2 134=5,54) ; "seul pays en accélération" vérifié contre le Tableau 4 (Mexique/US/Canada déclinants ou stables, Guatemala/Bolivie non modélisés mais aucune trace d'accélération dans leurs notes) ; pas de tiret cadratin ; ton non-alarmiste (le Mexique est présenté comme ayant une réponse vaccinale massive, pas comme un pays en crise) ; pas de ProMED ; pas de faux témoignage ; lien en corps de post (le test), pas de lien dupliqué en 1er commentaire pour garder le signal propre.

**✅ VALIDÉ par David (« Ok publie ») le 2026-07-12.** Conformément à [[feedback_no_self_publishing]], le texte a été saisi tel quel dans la fenêtre de composition LinkedIn (`linkedin.com/feed/`, bouton "Commencer un post") — vérifié à l'écran, identique mot pour mot au brouillon validé, paragraphes intacts.

**Reporté une 2e fois au mercredi 15 juillet**, sur décision de David le 13/07 (Option B de séquençage, voir section méningite ceinture africaine plus haut dans ce log) : le lundi 13/07 est occupé par le post méningite, sujet plus frais. Fenêtre de composition fermée sans publier (brouillon LinkedIn non conservé côté plateforme — peu importe, le texte validé ci-dessus fait foi ; à ressaisir depuis ce log le 15/07). Contenu inchangé sinon, toujours en attente du clic "Publier" par David.

**⚠️ RAPPEL 2026-07-13 (jour J du report) : ce post Rougeole/Mexique Coupe du Monde est TOUJOURS en attente du clic "Publier" par David.** Retrouvé dans ce log en session du 13/07, non republié ici pour éviter la duplication — voir texte validé juste au-dessus.

**❌ OBSOLÈTE — classé sans publication le 2026-07-15 (session `linkedin-hwg-content-proposal`, étape 0).** Le hook a péri pendant les deux reports successifs. Vérification faite ce jour : le dernier match disputé dans une enceinte mexicaine était le **5 juillet** (Estadio Azteca, 8e de finale) ; les 13 matchs attribués au Mexique (10 de poules + 3 à élimination directe) sont tous joués, et depuis les quarts de finale le tournoi se déroule intégralement aux États-Unis jusqu'à la finale du 19 juillet. La phrase d'ouverture « Mexico is hosting World Cup matches this month » et le présent continu « outreach continuing in the tournament's three Mexican host cities » se lisent, un 15 juillet, comme un événement en cours : ce n'est plus vrai. Les données PAHO du post restaient exactes (revérifiées ce jour contre le sitrep #6, toujours la source primaire la plus récente, pas de #7), mais un post de marque dont la première ligne est fausse ne se rattrape pas par la qualité de ses chiffres. **Ne pas ressortir ce brouillon dans une session future.** Remplacé par le post Rougeole/Guatemala du 15/07 (voir en tête de section LinkedIn), qui recycle le même jeu de données vérifié sous un angle non périssable.

**Leçon de séquençage :** un post à hook événementiel (tournoi, sommet, date de conférence) ne supporte pas d'être reporté. Quand un tel post glisse, il faut soit le publier tout de suite, soit le refondre, jamais le mettre en file d'attente. Les posts à hook structurel (écart de létalité, artefact de surveillance) se reportent sans coût.

---

## Veille LinkedIn — 2026-07-13 (run planifié, David absent puis présent après relance navigateur)

### Posts repérés dans le fil (fenêtre 48h, candidats commentaire — voir linkedin-contacts.md pour le détail des connexions/DM)
- **WHO Hub for Pandemic and Epidemic Intelligence** (EIOS) — même post que celui déjà repéré le 12/07 ("Outbreaks do not respect borders..." Ebola+hantavirus, 4000+ membres EIOS), affiché "2 j" aujourd'hui vs "1 j" hier → **probablement à la limite ou juste au-delà de la fenêtre 48h**, à trancher par David. Brouillon déjà préparé et double-checké le 12/07 (voir ligne ~2508 plus haut), réutilisable tel quel si David valide.
- **Oussama Wael Bouhentala** (Medical Doctor, Epidemiologist, 2e degré) — 1j, analyse détaillée Ebola Bundibugyo RDC/Ouganda (>1 800 cas, >600 morts, transmission communautaire non détectée soulignée comme signal le plus préoccupant). Frais, jamais logué avant. Bon candidat commentaire.
- **World Health Organization African Region** — 2j, bulletin eSURV/ISS (systèmes de surveillance électronique & supervision formative). Frais, jamais logué avant.
- **Daily Maverick** (média) — 20h, article sur le leadership africain dans la riposte Ebola RDC. Frais. Priorité plus basse (média généraliste, pas un compte expert/institutionnel).

### Notifications — posts/threads à surveiller (hors action aujourd'hui)
- **floribert Ngueping** — créateur de contenu actif, série pédagogique "Statistiques de base en épidémiologie" (Leçon 8 aujourd'hui sur l'échantillonnage non probabiliste). Compte à surveiller pour du contenu pédagogique epi, pas directement actionnable.
- **Institut National de Santé Publique RDC** — post Ébola Ituri (230 acteurs communautaires mobilisés), 4j → hors fenêtre 48h.
- **Africa CDC** — a publié sur l'Ebola RDC il y a 1j, thread actif.
- **Florian Girond / IRD Nouvelle-Calédonie** — post dengue/leptospirosis (surveillance, alerte précoce) où David a déjà commenté, 378 réactions/31 commentaires, gros engagement, Jean-Pierre Prou a aimé le commentaire de David 19h.
- **GET Consortium** — a aimé le commentaire de David sur "First Imported Ebola Case Confirmed in France" (CFR ~30% vague RDC actuelle), thread actif.
- Notification paiement Premium refusé (1j) — hors périmètre marketing HWG, personnel/facturation, signalé à David séparément.

### ✅ 3/3 commentaires postés — validés par David (« poste les 3 »), 2026-07-13

**1. Oussama Wael Bouhentala** (post Ebola Bundibugyo, 1j, 70→71 réactions) — confirmé posté (« David Deheunynck • Vous, maintenant ») :
> The point about undetected community transmission is the one worth sitting with. Case counts with no identified epidemiological link are usually undercounted by a wider margin than official figures suggest, since contact tracing capacity tends to degrade exactly when it's needed most, in insecure or high-mobility settings like Ituri. Shifting the operational question from "how many cases" to "how many transmission chains we can't see" changes what a useful dashboard should even show.

**2. World Health Organization African Region** (bulletin eSURV, 2j, 31 réactions/2 commentaires) — post retrouvé via page entreprise + tri "Récent" (nécessaire, cf. note technique du 10/07). Confirmé posté :
> Supportive supervision is the piece of eSURV that tends to get less attention than the data layer itself, but it's often the harder problem. A country can deploy electronic reporting tools and still lose data quality if the feedback loop to district-level teams is weak. Pairing the technical rollout with sustained supervision capacity seems to be exactly what separates surveillance systems that hold up during a surge from ones that don't.

**3. WHO Hub for Pandemic and Epidemic Intelligence** (EIOS, post "Outbreaks do not respect borders...", 41 réactions/1 commentaire) — ⚠️ toujours affiché "2j" au moment de la publication (probablement 36-48h, à la limite de la fenêtre), David a validé malgré l'avertissement explicite. Confirmé posté :
> The point about information not respecting borders resonates. From tracking the same Ebola and hantavirus signals, the hardest part is rarely finding the first report. It's usually reconciling the same event described differently across sources and languages before it can be acted on. Shared monitoring boards and a common community are exactly what turn scattered open-source signals into something decision-ready.

**Double-check pré-publication effectué** (relecture demandée par David) : correction d'un point-virgule en deux phrases (règle "points et virgules", pas de tiret cadratin) sur le commentaire 1. RAS sur les commentaires 2 et 3. Aucun lien, aucun CTA, aucune mention ProMED, aucune donnée inventée.

**Quota commentaires session 2026-07-13 : 3/3 utilisé.** Candidat restant non retenu : Daily Maverick (article, priorité plus basse, non posté).

### Bilan session (en attente de validation David — connexions/DM/suivis)
Connexions, DM et suivis toujours en attente de validation. Voir linkedin-contacts.md pour le détail des candidats découverte active et les brouillons.

---

## Veille LinkedIn — 2026-07-13 (session followup-check 16h, run planifié autonome)

Complément après-midi (mode normal autonome ; le mode essai supervisé ne concerne que le 14/07). Détail complet des actions dans linkedin-contacts.md (section « followup-check 16h — 2026-07-13 »). Résumé veille contenu ci-dessous.

### Retombées des actions/commentaires du matin (traction)
- **Commentaire du matin sur WHO Hub for Pandemic and Epidemic Intelligence (EIOS)** (« The point about information not respecting borders resonates… ») : **WHO Hub a aimé le commentaire de David** (notif 1h) — l'institution modèle la plus proche de HWG (renseignement épidémique open-source) valide le commentaire. Le commentaire cumule désormais **42 réactions / 2 commentaires** (vs 41 réactions au moment de la publication ce matin). Signal institutionnel fort.
- **Post « Most epidemic surveillance platforms are built for Detect… »** (David, ~4h) : **585 impressions, 3 vues de profil, +5 abonnés, 2 réactions, 3 commentaires.** Bon engagement organique (les 3 commentaires seraient à surveiller pour d'éventuelles réponses).
- **Commentaire de David sur le post de Johan Verheyden** (« framing of escapes as signal rather than non-compliance ») : **497 impressions, 3 réactions.**

### Angle repéré pour un futur post (veille, PAS rédigé ici — hors périmètre)
- **Sohail Agha** (suivi) — nouvelle étude **PLOS ONE** : « priming » des soignants pendant une interruption de service de vaccination. Cas : grève de 4 mois ayant interrompu la vaccination HPV à Abuja (2025), réouverture de seulement 5 jours pendant la semaine Santé Mère-Nouveau-né-Enfant ; une campagne digitale (Facebook/Instagram, cadre Fogg Behavior Model) informant les soignants du créneau de réouverture → **3,4x d'odds de vaccination** chez ceux se souvenant de la campagne (triangulé par sondage exit + données administratives ward-level). **Angle réutilisable pour HWG : requalifier le re-engagement post-disruption comme un problème de « priming/timing du signal », pas seulement de confiance ou d'accès** — cohérent avec le positionnement Detect→Respond et « le signal doit arriver au bon moment ». À proposer à la routine de contenu de marque, pas publié ici.

### Données épidémiologiques
- **Aucune donnée chiffrée nouvelle** repérée cette session nécessitant une vérification contre source primaire ou une MAJ de la table `outbreaks` (post Sohail = campagne HPV historique 2025 ; commentaires/notifs réseau sans chiffres de foyers nouveaux).

---

## Veille LinkedIn — 2026-07-14 (session monitoring 9h, JOUR D'ESSAI SUPERVISÉ)

> Mode essai 14/07 : aucune action publiée automatiquement. Commentaires/DM/connexions/suivis rédigés + double-checkés, en attente de validation David (détail complet dans linkedin-contacts.md, section 14/07). PushNotification envoyée. Ci-dessous : veille contenu + brouillons de commentaires.

### Brouillons de commentaires (fenêtre 48h, en attente validation — max 3/jour)
1. **Africa CDC** (post 1j : 112 soignants infectés dont 35 décès, agent humanitaire US infecté à Bunia, IMST/PPE). Angle : l'infection des soignants comme signal épidémiologique de tête (la transmission dépasse la capacité d'isolement, indicateur précoce de chaînes communautaires manquées). Dernier commentaire Africa CDC = 6/07 (>1 semaine, règle 1/profil/semaine respectée). EN :
   > The health worker infection count is one of the most telling signals in this outbreak, and one of the easiest to underweight. A rising share of cases among frontline staff usually means transmission is outpacing isolation capacity, not just that exposure is high. Protecting responders is the humane priority, but the trend line also doubles as an early warning that community chains are being missed. Worth watching zone by zone, not just as a national total.
2. **Prof. Mohamed Janabi** (WHO Regional Director for Africa, republié par WHO African Region, 16h : montée en charge IPC, renforcement des structures, compétences IPC des soignants de première ligne, "leaving behind stronger systems"). Angle : IPC et surveillance = même colonne vertébrale, l'investissement IPC = capacité de surveillance durable. EN :
   > The point about leaving behind more resilient systems is the one that compounds. IPC and surveillance draw on the same frontline capacity: the staff trained to prevent transmission are often the same ones detecting and reporting it. When that layer is strengthened during a response, the gain outlasts the outbreak, faster case detection and cleaner data long after the emergency footing ends. The hard part is funding it as infrastructure, not just as emergency surge.
3. **Présidence RDC** (compte officiel, 8h : 4e Task Force Ebola, Dr Steve Ahuka nommé manager terrain, 1 900/700, extension vers de nouvelles provinces). Angle : l'extension géographique vers des provinces épargnées est le signal clé, plus que le cumul ; surveiller en avance de phase. FR :
   > Le point le plus important de ce bilan n'est pas le cumul de cas, mais la tendance à l'extension vers des provinces jusque-là épargnées. C'est le signal qui change la nature de la riposte : il ne s'agit plus seulement de contenir un foyer connu, mais d'étendre la surveillance en avance de phase, là où aucun cas n'est encore remonté. La nomination d'un manager terrain unique va dans ce sens, à condition que la remontée des données suive le même rythme que la propagation.

**Alternate (si David préfère substituer) :** Firmin Kra (socio-anthropologue, post 2j bord fenêtre : surveillance sanitaire comme fait social, paludisme CI, partenariat RKI, 39 entretiens). Angle possible : la qualité/production de la donnée comme vraie contrainte, pas seulement l'outil de détection. Proposé plutôt en "suivre" (voir linkedin-contacts.md).

Double-check des 3 commentaires : 3-5 lignes, une idée forte, analytique, pas de CTA/lien, pas de tiret cadratin, pas de ProMED, factuellement ancré sur chaque post source, aucune donnée inventée. Africa CDC vérifié contre règle 1/profil/semaine.

### Veille passive contenu
- **Épidémie Ebola Bundibugyo RDC = sujet dominant du fil** (RIGHT Foundation, Présidence RDC, Agence santé publique Canada, INSP RDC, Prof. Janabi/WHO African Region, University of Oxford essai vaccin BD-Ebov, Africa CDC, Tedros). Chiffres en hausse rapide → a déclenché une MAJ base (voir linkedin-contacts.md).
- **Commentaire Ebola de David** (post "Data cut-off 11 July", 152 réactions/9 commentaires) performe : Oussama Wael Bouhentala l'a mentionné + aimé.
- **Angle contenu potentiel (hors périmètre, à proposer routine de marque)** : "l'infection des soignants comme indicateur avancé" et "IPC = infrastructure de surveillance durable, pas surge d'urgence" — deux angles récurrents sur ce foyer, cohérents avec le positionnement Detect/Respond.

---

## Session monitoring LinkedIn — 2026-07-14 (exécution après validation David, essai supervisé)

### ✅ Commentaire 1/3 posté — Africa CDC
Post (2j, "112 health workers infected, 35 deaths, Bunia humanitarian worker") — commentaire publié et confirmé (apparaît "David Deheunynck • Vous • maintenant") :
> The health worker infection count is one of the most telling signals in this outbreak, and one of the easiest to underweight. A rising share of cases among frontline staff usually means transmission is outpacing isolation capacity, not just that exposure is high. Protecting responders is the humane priority, but the trend line also doubles as an early warning that community chains are being missed. Worth watching zone by zone, not just as a national total.

Règle 1 commentaire/profil/semaine respectée (dernier commentaire Africa CDC : 6/07).

### ✅ Commentaire 2/3 posté — Prof. Mohamed Janabi (WHO Regional Director for Africa)
Post (18h, IPC/renforcement des systèmes de santé) — commentaire publié et confirmé (compteur 5→6, "David Deheunynck • Vous • maintenant") :
> The point about leaving behind more resilient systems is the one that compounds. IPC and surveillance draw on the same frontline capacity: the staff trained to prevent transmission are often the same ones detecting and reporting it. When that layer is strengthened during a response, the gain outlasts the outbreak, faster case detection and cleaner data long after the emergency footing ends. The hard part is funding it as infrastructure, not just as emergency surge.

### ✅ Commentaire 3/3 posté — Présidence RDC
Post (10h, 4e Task Force Ebola, Dr Steve Ahuka manager terrain, 1 900/700, extension nouvelles provinces) — commentaire publié et confirmé (compteur 4→5, "David Deheunynck • Vous • maintenant") :
> Le point le plus important de ce bilan n'est pas le cumul de cas, mais la tendance à l'extension vers des provinces jusque-là épargnées. C'est le signal qui change la nature de la riposte : il ne s'agit plus seulement de contenir un foyer connu, mais d'étendre la surveillance en avance de phase, là où aucun cas n'est encore remonté. La nomination d'un manager terrain unique va dans ce sens, à condition que la remontée des données suive le même rythme que la propagation.

**Quota commentaires du jour : 3/3 utilisés (Africa CDC, Prof. Janabi, Présidence RDC).**

---

## Session monitoring LinkedIn — 2026-07-15 (autonomie normale reprise, mode essai 14/07 expiré)

### ✅ Commentaire 1/3 — Tedros Adhanom Ghebreyesus (15/07)

Post ciblé : Tedros, 15h avant session. Lancement d'EBO-PEP, premier essai clinique de prophylaxie post-exposition (obeldesivir) contre Ebola Bundibugyo. Partenaires cités : INRB Kinshasa, ANRS, ALIMA.

Commentaire posté, confirmé publié sous le nom de David (vérifié via `find` sur le DOM, pas seulement screenshot) :
> PEP matters most precisely where Bundibugyo sits today: no licensed vaccine, no proven specific treatment. Contacts currently have nothing between exposure and disease. If obeldesivir holds up post-exposure, contact tracing stops being pure observation and becomes an intervention window. That changes what a contact list is worth operationally, not just epidemiologically.

Double-check : analytique, une idée forte, pas de CTA ni de lien, pas de tiret cadratin, ~5 lignes. Fait vérifié (absence de vaccin homologué / traitement spécifique prouvé pour le Bundibugyo) corroboré par le post d'Oussama Bouhentala du fil et cohérent avec le post de Tedros lui-même ("major step forward in Ebola BVD prevention"). Règle respectée : Tedros = commentaire seulement, jamais de demande de connexion.

**Note technique (à reproduire) :** le widget de messagerie flottant s'est ouvert par-dessus le bouton "Commenter" et a intercepté le premier clic. Le commentaire n'était PAS parti malgré le clic. Fermer l'overlay puis re-cliquer a résolu. Confirme la règle : toujours vérifier le résultat réel via le DOM, un clic n'est pas une publication.

### ✅ Commentaire 2/3 — Laura Leyser, Secrétaire générale MSF International (15/07)

Post ciblé : Laura Leyser, 1j. Visite du centre de formation Ebola de MSF au Kenya. Chiffres cités dans son post : 1 400+ collègues MSF dédiés exclusivement à la réponse Ebola en RDC, 7 Ebola Treatment Centers, 15+ unités d'isolement, rotation d'une heure maximum dans les EPI.

Commentaire posté, confirmé publié (vérifié via DOM) :
> The one hour at a time detail is really the staffing constraint in disguise. An ETC's ceiling is not beds, it is how many trained people can rotate through PPE in a day. 7 treatment centres and 15 isolation units only hold if 1,400 people keep cycling. Which is why a training centre in Kenya, outside the outbreak zone, reads as core infrastructure rather than overhead.

Double-check : tous les chiffres repris directement de son post, aucune extrapolation. Pas de CTA ni de lien, pas de tiret cadratin, 4 lignes.

### ✅ Commentaire 3/3 — World Health Organization African Region (15/07)

Post ciblé : WHO AFRO, 15h. Simple partage de lien ("Stay informed on the latest developments in the ongoing #Ebola outbreak caused by Bundibugyo virus" + lien bit.ly). Post pauvre en soi, mais institution prioritaire et sujet cœur : le lien a donc été suivi et lu pour produire un commentaire de fond plutôt qu'un commentaire creux.

Commentaire posté, confirmé publié (vérifié via DOM) :
> The provincial split is the part worth sitting with. On the 12 July figures, Ituri carries the bulk of the caseload at roughly 34% CFR, while North Kivu sits near 57%, and Haut-Uele and Tshopo report 7 deaths in 7 cases and 3 in 4. Small denominators, so those rates are unstable. But the gradient is what late detection outside the main response footprint looks like: the further from where the teams already are, the more often a case is found dead rather than found early.

Double-check : chaque chiffre vérifié contre la source primaire ECDC (données au 12/07, citant le ministère de la Santé RDC) — Ituri 1 772 cas/608 décès = 34,3 % ; Nord-Kivu 177/100 = 56,5 % ; Haut-Uele 7/7 ; Tshopo 4/3. Attribution datée explicite ("On the 12 July figures") **délibérée** : le sitrep WHO AFRO publiquement indexé (n°08) s'arrête aux données du 05/07, donc annoncer ces chiffres comme étant "leur" bulletin aurait été inexact. Réserve honnête sur les petits effectifs incluse. Pas de CTA ni de lien, pas de tiret cadratin.

**Candidat écarté :** post de **Syra Madad** (Chief Biopreparedness Officer, NYC Health + Hospitals), 4h, "Mapping Readiness: Why Special Pathogens Biopreparedness Needs Situational Awareness" — sujet idéalement aligné avec HWG, mais **commentaires désactivés sur le post**. Uniquement réaction/republication possibles. À garder en tête : c'est un profil à fort alignement, à suivre pour de futures opportunités.

### Veille linkedin-hwg-followup-check — 2026-07-15 (16h)

Infos repérées pour de futurs posts de contenu original. **Aucun post rédigé ni publié ici** (hors périmètre, rôle de la routine de contenu).

**1. 🔥 Angle le plus fort du jour — « la source primaire publie tous les jours, les agrégateurs ont deux jours de retard »**
Obtenu via un contact de terrain (Tambe Elvis Akem) : le COUSP/INSP RDC publie un sitrep **quotidien** sur `insp.cd`, granularité zone de santé. Au 15/07, l'ECDC en est encore aux données du **12/07** (1 963/719) quand le sitrep N°060 donne le **13/07** (2 011/754). Angle : ce que « temps réel » veut vraiment dire en surveillance épidémiologique, et le fait que la donnée existe publiquement mais que personne ne la remonte. **HWG est désormais aligné sur la source primaire** (correction en base faite ce jour, voir linkedin-contacts.md). Fort, vérifiable, et c'est un différenciateur produit réel plutôt qu'une opinion.

**2. Le compteur bouge sans qu'aucun cas nouveau ne survienne (réconciliation)**
Le SitRep N°060 reclasse 6 cas de Nia-Nia (Ituri) vers Wamba (Haut-Uélé) : les cumuls provinciaux changent **sans une seule nouvelle infection**. Angle : pourquoi une courbe épidémique n'est pas une série stable, et ce que ça implique pour quiconque modélise ou titre sur « +X cas ». Confirmé en direct par Tambe (« Yes, no new case, that's how i put it on my dashboard ») et par Johan Verheyden, qui travaille justement sur un papier de datation du début de la flambée.

**3. Le même protocole, deux résultats : 62 % vs 92 %**
Suivi des contacts au 13/07 : **62,0 % en Ituri, 92,0 % au Nord-Kivu, 55,5 % au Haut-Uélé, 67,4 % au national**. Même pays, même épidémie, même protocole. Angle : ce qu'un chiffre de couverture ne dit pas, et pourquoi un écart provincial se lit à tort comme de la sous-performance. **Attention :** les explications de terrain recueillies en DM (insécurité, mouvements de grève) sont **non vérifiées contre une source primaire** et proviennent de conversations privées — ne pas les publier en l'état, il faudrait une source citable.

**4. Létalité par province, très contrastée**
34,9 % en Ituri, **58,2 % au Nord-Kivu, 92,9 % au Haut-Uélé** (province d'extension récente, 6 des 7 premiers cas décédés dans la communauté). Angle : une létalité de 92,9 % ne mesure pas la virulence, elle mesure le fait qu'on ne détecte que les morts. Complète l'angle CFR déjà exploité dans le thread X du jour, sous un angle géographique neuf.

**5. Posts de tiers à surveiller (aucune action prise, quota du matin déjà consommé)**
- **Marie Roseline Darnycka BELIZAIRE** : « Today marks two months since the Ebola outbreak in the DRC was officially declared » — angle anniversaire des 2 mois, cadence naturelle pour un contenu de bilan.
- **Tambe Elvis Akem** : post sur les **estimations WHO-UNICEF 2025 (WUENIC)**, recul du nombre d'enfants zéro-dose. Sujet vaccination, adjacent à la couverture HWG.
- **Syra Madad** (Chief Biopreparedness Officer, NYC Health + Hospitals) : « Mapping Readiness: Why Special Pathogens Biopreparedness Needs Situational Awareness » — déjà noté ce matin, commentaires désactivés, alignement thématique très fort.
- **Qadeer Ahsan / Christian Ezeh** : fermeture du **Fleming Fund** et financement de la surveillance AMR — reporté du matin, toujours non traité.

**6. Signal de traction**
Post rougeole/Guatemala : 55 impressions, **+2 abonnés générés**, réactions de Kumud Deepali Rudraraju + 1. Post « Deux épidémies sont actives en ce moment » : 99 impressions. Deux des trois commentaires postés ce matin ont été likés (Waylon Elliot + 2 autres sur le commentaire « transmission communautaire non détectée » sous le post d'Oussama Bouhentala, qui totalise 201 réactions et 14 commentaires ; Waylon Elliot également sur le commentaire « one hour at a time / plafond réel d'un CTE »). Aucune réponse écrite sous les commentaires.

---

## 🔎 Veille LinkedIn — 16/07/2026 (linkedin-hwg-monitoring, session en lecture seule)

**Contexte : 0 commentaire posté** (fenêtre Chrome repliée, écriture impossible toute la session — détail technique complet dans `linkedin-contacts.md`, section 16/07). Les posts ci-dessous sont donc de la **veille**, pas de l'engagement exécuté.

### Posts repérés (candidats commentaire reportés)

- **Institut National de Recherche Biomédicale (INRB)** — 15/07 ~21h, **205 réactions / 26 commentaires**. Nomination du **Pr Steve Ahuka-Mundeke** comme **Manager Terrain de la riposte à la 17e épidémie Ebola (Bundibugyo) en RDC**, par le Président de la République. Chef du Département de Virologie de l'INRB, Incident Manager de la 10e épidémie Ebola et de la riposte COVID-19, 300+ publications. Commenté par ANRS Maladies infectieuses émergentes. **Angle éditorial à exploiter (post ou commentaire) :** ce que change un Incident Manager terrain sur la chaîne donnée → décision, à relier à l'écart déjà documenté entre le sitrep quotidien COUSP/INSP et l'ECDC à J+1/J+2. ⏰ Fenêtre 48h expirant ~16/07 21h.

- **RIGHT Foundation (Research Investment for Global Health Technology)** — post 6j (hors fenêtre 48h). « Bundibugyo Ebola: A New Challenge Facing the RIGHT Foundation ». Cite 1 729 cas / 582 décès (early July), PHEIC déclaré mai 2026, et surtout : **l'OMS a accordé une Emergency Use Listing (EUL) à un diagnostic moléculaire Bundibugyo**, mais l'accès aux diagnostics utilisables en contexte de riposte reste limité. **Angle intéressant et peu couvert : l'écart entre l'existence d'un outil diagnostique homologué et sa disponibilité réelle sur le terrain.** Chiffres cités plus anciens que la base HWG (2 011/754 au 13/07), ne pas les reprendre.

- **Tambe Elvis Akem, MD** — estimations **WHO-UNICEF 2025 (WUENIC)**, recul du nombre d'enfants zéro-dose. Recoupe directement le post rougeole de David (seuil des 95%, rougeole comme sentinelle des gaps d'immunité). Candidat commentaire prioritaire, sous réserve de la règle 1 commentaire/profil/semaine.

- **Marie Roseline Darnycka BELIZAIRE** — 15/07, « Today marks two months since the Ebola outbreak in the DRC was officially declared », centré sur l'hygiène des mains. Sans données chiffrées.

- **Dav Mulamba** — évaluation Semaine 1 de la formation en Cartographie Numérique appliquée à la Santé Publique (dispositif MEAL). Périphérique.

- **Ifeanyi Nsofor** — post santé publique grand public (étude café/foie, ~355 000 adultes suivis 13 ans). **Hors périmètre HWG** (nutrition/maladie chronique, pas surveillance épidémique) — noté pour mémoire, pas un candidat.

### Performance des posts de marque (statistiques relevées)

| Post | Statut au 16/07 |
|---|---|
| « Measles is the disease that comes back first » (13h) | 63 impressions, 3 réactions (Finn Stukerjurgen + 2), 1 vue de profil, **+2 abonnés générés**. Le « 1 commentaire » est l'auto-commentaire de David (lien), pas un tiers. |
| « The deadliest measles outbreak in the Americas » (Mexique 11 820 cas, Rt 0,66 / Guatemala, 23h) | En cours de diffusion |
| « Deux épidémies sont actives en ce moment » | 99 impressions |
| Compteurs profil | 109 vues de profil, 568 impressions de posts |

**Lecture :** les deux posts rougeole génèrent de l'abonné (+2 sur un seul post à 63 impressions, taux de conversion notable pour un volume faible), mais toujours **aucun commentaire de tiers**. Les réactions viennent, la discussion écrite non. À surveiller : la traction du 15/07 venait des **commentaires de David sous les posts d'autrui**, pas de ses propres posts.

### ✅ DÉBLOCAGE 16/07 en fin de session — les actions ont pu être exécutées

David a redémarré Chrome (sans effet : la fenêtre est revenue repliée à l'identique, Chrome restaure la géométrie de la dernière fenêtre fermée). **La solution réelle a été trouvée en session : `window.resizeTo(1400,900)` en JS pur**, qui débloque là où l'outil `resize_window` est un faux positif. `outerWidth 0 → 1280`, `visibilityState hidden → visible`, saisie et clics de nouveau fonctionnels. Voir [[feedback_chrome_window_collapse_blocks_typing]] (mémoire mise à jour avec le correctif).

### ✅ Commentaire posté 1/3 — Institut National de Recherche Biomédicale (INRB), 16/07

**Post ciblé :** nomination du Pr Steve Ahuka-Mundeke comme Manager Terrain de la riposte à la 17e épidémie Ebola (Bundibugyo) en RDC (206 réactions / 26 commentaires au moment du post). Publié la veille ~21h, donc dans la fenêtre 48h.

**Commentaire publié (confirmé visuellement : apparaît sous "David Deheunynck • Vous — maintenant", au-dessus du commentaire de l'ANRS) :**
> Nomination qui dépasse le symbole : confier la coordination terrain à un virologue qui a déjà été Incident Manager lors de la 10e épidémie, c'est raccourcir la distance entre le laboratoire et la décision opérationnelle.
>
> C'est souvent là que le temps se perd, rarement dans la collecte. Le sitrep quotidien du COUSP paraît pendant que les bulletins internationaux restent un à deux jours en arrière : la donnée existe donc déjà quand la décision, elle, attend encore.
>
> Félicitations au Professeur Ahuka-Mundeke.

**Double-check :** FR (post en FR), 3 paragraphes aérés, 518 caractères, pas de tiret cadratin, **pas de CTA ni de lien**, rendu visuel vérifié par screenshot avant publication.
**Faits vérifiés avant envoi :** « virologue » et « Incident Manager lors de la 10e épidémie » sont explicites dans le post source. L'écart « sitrep quotidien COUSP vs bulletins internationaux à J+1/J+2 » est vérifié et documenté (sitrep N°060 du 13/07 vs ECDC encore au 12/07, cf. [[project_insp_cd_drc_sitrep_primary_source_2026_07_15]]).
**⚠️ Piège évité :** un premier brouillon mentionnait l'EUL accordée à un diagnostic moléculaire Bundibugyo. Retiré : ce fait ne venait que du post de RIGHT Foundation, **jamais revérifié contre une source primaire OMS** ([[feedback_verify_against_primary_source]]).
**Note légale :** commenter un post LinkedIn de l'INRB ne recoupe pas [[legal_insp_cd_and_inrb_mirror_restrictions]], qui ne porte que sur le scrape/miroir du code.

**⚠️ Incident mineur :** un premier clic sur le bouton Commenter a dérapé (la barre de recherche gardait le focus après le test de saisie) et a navigué vers une suggestion d'historique de recherche **freelance** de David ("recherche cofondateur technique"). Aucune action posée, immédiatement revenu au fil. À retenir : **vider ET défocaliser la barre de recherche après un test de saisie** avant de cliquer ailleurs.

### ⚠️ Re-blocage navigateur en fin de session 16/07 — minimisation OS

Après avoir posté le commentaire INRB et envoyé 2 réponses (Ingride, Maham) grâce au correctif `window.resizeTo()`, la fenêtre s'est **re-repliée puis minimisée au niveau OS** au fil des navigations. À ce stade `resizeTo` ne récupère plus la main (Chrome ne dé-minimise pas en JS). **Restées non exécutées pour cette seule raison :** message de bienvenue à SEKOU SANO (hook déjà préparé, voir linkedin-contacts.md), invitations reçues à traiter (Firmin Kra à accepter, Djamous à arbitrer), connexions (Dirk Engels) et suivis. Nécessite que David restaure physiquement la fenêtre. Voir [[feedback_chrome_window_collapse_blocks_typing]] (distinction repli récupérable vs minimisation OS).
