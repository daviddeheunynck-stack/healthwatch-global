# Performance Log — contenu social HealthWatch Global

Ce fichier mesure, semaine par semaine, **l'effet réel** du contenu social publié par les routines quotidiennes (`linkedin-hwg-monitoring`, `linkedin-hwg-followup-check`, `x-hwg-content-proposal`). **Depuis le 2026-08-05**, `x-hwg-monitoring` et `x-hwg-followup-check` sont suspendues (priorité Codeur/nouveau chantier) : plus de mesure reply-par-reply X, seulement delta d'abonnés et DM pour X — voir `hwg-social-performance-weekly-review/SKILL.md`.

Il est le complément de `content-log.md` : celui-ci archive **ce qui a été publié** (texte, angle, sources, double-check) mais ne mesure jamais **ce que ça produit**. Ici on relève les vues, les likes, les réponses reçues, la croissance d'abonnés et le volume de DM entrants, et on cherche les patterns exploitables.

Alimenté chaque jeudi par la tâche planifiée `hwg-social-performance-weekly-review`. **Session en lecture seule stricte** : aucune publication, aucun follow, aucune modification de compte.

**Règle de fiabilité** : un compteur inaccessible est noté « non disponible » ou « non relevé », jamais estimé.

---

## 📅 Semaine du 2026-07-27 au 2026-08-03 — 3e relevé

**Relevé du 03/08 au matin.** Fenêtre : **27/07 → 02/08 inclus** (les routines du 03/08 n'ont pas encore tourné, rien n'est archivé pour ce jour). Le relevé précédent s'arrêtait au 26/07, **tout le contenu de cette fenêtre est donc neuf**.

**Périmètre mesuré** : **22 replies X sur 22** (100 %, mesure directe reply par reply via les permaliens archivés dans `content-log.md`), 2 threads de marque sur 3, et **36 commentaires LinkedIn** dont les retombées sont reprises des relevés des routines quotidiennes.

### 🖥️ État navigateur : X mesuré intégralement pour la première fois, LinkedIn refusé au niveau du domaine

Deux incidents, un résolu, un bloquant.

1. **Le deviceId habituel `23c7ecdd…` était absent des navigateurs connectés** en début de session (un seul navigateur présent, `a466bc2e…`, sur lequel la création du groupe d'onglets échouait en boucle : « No group with id: … », erreur jamais vue jusqu'ici). **Résolu par le redémarrage complet de Chrome**, après quoi `23c7ecdd…` est réapparu et a fonctionné sans un seul incident pendant tout le relevé X. À noter pour les prochaines pannes : le redémarrage, inefficace le 27/07 sur une panne CDP, est le bon remède sur cette signature-là.
2. **Le fil `x.com/HWatchGlobal/with_replies` reste inexploitable** (virtualisation : 2 à 3 posts rendus quel que soit le défilement, l'accumulateur JS ne grossit pas, un scroll long finit en timeout CDP 45 s). **Contourné en ouvrant les 22 permaliens un par un**, ce qui donne une mesure exacte et non plus un échantillon. Méthode à reprendre telle quelle les prochaines semaines.
3. ⛔ **LinkedIn de nouveau refusé** : « Navigation to this domain is not allowed » sur `/in/david-deheunynck/` comme sur `/recent-activity/comments/`, après re-sélection du navigateur. Même blocage qu'au premier relevé du 23/07 (« cas 4 : autorisation de domaine »). **Aucun chiffre LinkedIn n'a donc été relevé en direct** ; tous ceux ci-dessous viennent des archives des routines quotidiennes, qui elles ont tourné normalement.

### Compteurs d'abonnés

| Plateforme | Valeur | Semaine précédente | Delta |
|---|---|---|---|
| **X — @HWatchGlobal** | **29 abonnés** (relevé en direct le 03/08 : 176 abonnements, 187 posts) | 21 au 25/07 (et 21 au 23/07) | **+8** |
| **LinkedIn — profil David Deheunynck** | **227 abonnés** (page Abonnés, 02/08 ~16h ; 219 sur le profil à 9h le même jour) | 154 le 26/07 | **+73** |
| **LinkedIn — relations** | 127 au 28/07, non relevé depuis | 115 le 26/07 | +12 minimum |

🎉 **La stagnation X est rompue.** Le compteur était bloqué à 21 depuis deux relevés consécutifs (23/07 et 25/07), au point que le relevé précédent annonçait qu'un troisième passage à 21 en ferait un fait établi. Il est à **29**. Les abonnés identifiés dans les notifications sur la fenêtre : @moonpixie49 et @angelsunshine42 (27 et 28/07, deux comptes d'appât **refusés**), @fineguthealth (30/07, **refusé**, lien d'affiliation), Manchetes Que Importam (30/07), puis **@fortune_osilem, @snpoehlm et @FlammuleLauren le 31/07**. La croissance est donc réelle mais **la moitié environ est du bruit** (comptes d'appât et follow-back automatiques). Le seul abonné de valeur est traité plus bas.

Série LinkedIn de la semaine : 154 (26/07 soir) → **178 (28/07 matin)** → 201 (31/07 matin) → 208 (31/07 après-midi) → 214 (01/08 16h) → 219 (02/08 9h) → **227 (02/08 16h)**. **+73 sur la fenêtre contre +14 la semaine précédente**, soit une multiplication par cinq du rythme (~10/jour contre ~2/jour). Le facteur explicatif le plus probable est le passage à un volume de DM sortants beaucoup plus élevé (10 à 12 DM validés par David et envoyés par jour à partir du 31/07, contre 4 auparavant) plus l'assouplissement des quotas de connexions et de suivis.

### Replies X — les 22 de la fenêtre, mesurées une par une le 03/08

« Cible » = vues du post visé au moment de la publication (source : `content-log.md`). « Conv. » = vues de la reply rapportées aux vues de la cible.

| Date | Compte cible | Angle | Cible | **Vues reply** | Likes | Réponses | Conv. |
|---|---|---|---|---|---|---|---|
| 27/07 | @DrIanWeissman | Registre des issues : 451 cas sur 3 200 sans issue rapportée, donc 43,9 % est un plancher | *n.r.* | **2** | 0 | 0 | — |
| 27/07 | @business (Bloomberg) | Comparabilité du classement « 2e plus grande » | 39 000 | 27 | 0 | 0 | **0,07 %** |
| 27/07 | @radiookapi | 5 ambulances pour Aru : la logistique n'a pas de ligne dans les compteurs | 3 918 | 38 | 0 | 0 | 0,97 % |
| 28/07 | @WHO | Hépatites : 1,3 M de décès, diagnostic comme contrainte | 21 600 | **63** | 0 | 0 | 0,29 % |
| 28/07 | @DrTomFrieden | Papier vs numérique au Bangladesh | 3 307 | 14 | 0 | 0 | 0,42 % |
| 28/07 | @AJEnglish | Grève de paie à Bunia = rupture de production de la donnée | 38 500 | 39 | 0 | 0 | 0,10 % |
| 29/07 | @Chikwe_I | WHO Hub / financement UE du renseignement épidémique | 445 (à 13 min) | 18 | **1** ⭐ | 0 | — |
| 29/07 | @gavi | Volontaires porte-à-porte : les zones inaccessibles ne remontent aucun chiffre | 571 | 7 | 0 | 0 | 1,2 % |
| 29/07 | @nbstv | Levée des restrictions de voyage après la déclaration Ebola-free | 4 183 | 26 | 0 | 0 | 0,62 % |
| 30/07 | @BNOFeed | Écart entre le timestamp de l'infographie et le sitrep du jour | *n.r.* | **107** | 1 | 0 | — |
| 30/07 | @Dr_JeanKaseya | « No magical solution », conférence de presse fin d'épidémie Ouganda | 334 | 13 | 0 | 0 | 3,9 % |
| 30/07 | @WHOAFRO | Absence d'intervalles publiés (prélèvement→résultat, symptômes→isolement) | 1 082 | 11 | 0 | 0 | 1,0 % |
| 31/07 | @CIDRAP | Le compteur de zones de santé redescend sans explication | 746 | 5 | 0 | 0 | 0,67 % |
| 31/07 | @Epicentre_MSF | Ervebo contre Bundibugyo : le registre de contacts est le plan de sondage | 53 | 4 | 0 | 0 | 7,5 % |
| 31/07 | @snpoehlm | Les compteurs publiés ne décrivent que la fenêtre observée | 108 | **41** | **2** | 0 | **38 %** ⭐ |
| 01/08 | @UNFPA | Santé maternelle en Ituri | 1 000 | 20 | 0 | 0 | 2,0 % |
| 01/08 | @UNGeneva | La faim mine la riposte | 9 597 | 22 | 0 | 0 | 0,23 % |
| 01/08 | @AfricaCDC | Tribune Devex, « reach the front line quickly » | 2 825 | 8 | 0 | 0 | 0,28 % |
| 02/08 | @MSF | Le versant « cas suspect » n'entre dans aucune série publiée | 1 457 | 15 | 0 | 0 | 1,0 % |
| 02/08 | @HelenBranswell | « La plus grande » et « la plus meurtrière » sont deux classements différents | 15 200 | **9** | 0 | 0 | **0,06 %** |
| 02/08 | @WFPChief | Le passage à l'échelle bute sur un dénominateur qui n'existe pas | 45 500 | 23 | 1 | 0 | **0,05 %** |
| 02/08 | @VinGuptaMD | Rentrée scolaire / rougeole : la réponse est régionale autant qu'individuelle | 2 029 | **54** | 1 | 0 | 2,7 % |

**Total : 566 vues cumulées sur 22 replies, 6 likes, 0 réponse publique reçue.** Moyenne **25,7 vues par reply**.

⚠️ **Comparaison avec le premier relevé : 1 800 vues sur 17 replies, soit 106 de moyenne. La portée par reply a été divisée par quatre**, sur un volume de publication supérieur. C'est le chiffre le plus préoccupant de ce relevé.

### Contenu de marque X (threads)

| Thread | Vues tweet 1 | Likes | Réponses |
|---|---|---|---|
| 29/07 — Polio Afghanistan, la carte des prélèvements est plus large que celle des cas | **17** | 0 | 1 |
| 31/07 09h17 — Arbovirus France, le Tarn porte deux virus | **14** | 1 | 1 |
| 31/07 17h03 — BNO News vs sitrep RDC (hors cadence, sur demande de David) | ⛔ **supprimé** | — | — |

Le thread du 31/07 17h03 a été **supprimé le 01/08 sur instruction explicite de David** après détection d'une erreur factuelle (l'écart de compteurs qualifié d'inexpliqué était en réalité un écart de périmètre géographique, BNO totalisant RDC + Ouganda + France). Les trois URL renvoient « Cette page n'existe pas », vérifié en direct ce matin. **Ce n'est pas un trou de mesure**, c'est un retrait volontaire.

Les threads restent le format le moins performant du dispositif : 14 et 17 vues, contre 41 et 54 pour les deux meilleures replies. Constat identique au premier relevé.

### Retombées X effectivement observées

| Date | Signal | Sur quoi |
|---|---|---|
| 31/07 | ⭐ **Chikwe Ihekweazu (@Chikwe_I, Assistant DG de l'OMS, Health Emergency Intelligence) a aimé** la reply HWG | reply du **29/07** dans son propre fil. **Le signal de traction le plus fort jamais enregistré sur X** : un compte de référence institutionnelle valide un angle HWG. |
| 31/07 | **@snpoehlm (Stefan Pöhlmann, Head of Infection Biology Unit, Deutsches Primatenzentrum, compte vérifié, 2,1 k abonnés) s'est abonné à HWG** | dans la foulée de la reply HWG du 31/07 dans son fil (41 vues, 2 likes, la meilleure reply de la semaine) |
| 31/07 | **@nlaa a aimé** une reply HWG | reply @BNOFeed du 30/07 |
| 02/08 | @KidPtch a aimé une reply HWG (compte sans bio, 4 posts, suggestions crypto : **signal sans valeur**) | reply du **26/07** chez @UniofOxford, soit **7 jours après publication** |

**Aucune réponse publique reçue sur aucune des 22 replies de la fenêtre.** Trois semaines consécutives à zéro.

### Commentaires LinkedIn — 36 publiés dans la fenêtre

Volume par jour : 5 (27/07), 3 (28/07, dont 1 en session interactive le soir, la session de 16h n'ayant pas tourné), 5 (29/07), 5 (30/07), 5 (31/07), 6 (01/08), 7 (02/08).

Impressions relevées par les routines (LinkedIn n'expose ce compteur que sur les **5 commentaires les plus récents**, constat structurel établi le 01/08 : c'est à relever le jour même ou jamais) :

| Date | Cible | Impressions | Retombée |
|---|---|---|---|
| 29/07 | **Ministry Of Foreign Affairs-Uganda** (fin de l'épidémie Ebola, post à 1 185 réactions) | 777 à J+0 → 8 838 à J+1 → **15 941 à J+2** | ⭐ **20 réactions + réponse publique de Tr Basemera Stella Maris : « this is the most clarifying comment »**. **De loin le meilleur résultat social de HWG à ce jour, toutes plateformes confondues.** |
| 29/07 | Prof. Mohamed Janabi (WHO Regional Director for Africa), post d'1 jour | **4** | aucune |
| 30/07 | Samuel Ayooluwa Oyetunde (CholeraGuard) | **69** | 2 puis **4 réactions**, 1 réponse de l'auteur |
| 30/07 | (commentaire « That number is doing more work than it looks… ») | **380** | non relevée |
| 01/08 | les 5 commentaires du matin, mesurés à 16h30 | **9 à 11 chacun** | mais **2 réponses de fond sur 5** |
| 02/08 | 7 commentaires | non relevées | voir ci-dessous |

**Réponses et réactions obtenues sur les commentaires de la fenêtre :**

- ⭐ **Cyrille SANDEU** (commentaire du 01/08 sur la traduction des messages MPOX) : **réponse longue, commentaire marqué « instructif »**, et il reprend explicitement l'angle HWG en le prolongeant (« un glossaire multilingue ne devrait pas être conçu uniquement comme un outil de sensibilisation, mais également comme un outil de normalisation »).
- ⭐ **Elhakim Ibrahim, PhD** (ONE, commentaire du 01/08 sur Ebola et exécution budgétaire) : **réponse + « J'adore » + question directe posée à David** (« Are there reforms you think can no longer wait ? »).
- ⭐ **Sohail Agha** (commentaire du 02/08) : **like + mention de David dans un commentaire sur son propre post** (« Thank you for applying this logic to a higher level. Makes a lot of sense. »).
- **Tr Basemera Stella Maris** (commentaire Ouganda du 29/07) : réponse publique élogieuse.
- **Samuel Ayooluwa Oyetunde** (30/07) : réponse de l'auteur, 4 réactions.
- **Marium Azim** (commentaire du 31/07 sur le dialogue OMS société civile) : **s'est abonnée à David dans la foulée**, deuxième cas mesuré d'un commentaire qui produit un abonnement le jour même.
- **David Amado Vidal** : mécanisme identique observé la semaine précédente (commentaire ECDC).

**Posts de marque LinkedIn** : aucune statistique relevée sur la fenêtre.

### DM / messages reçus

| Plateforme | Reçus sur la fenêtre |
|---|---|
| **X** | **0.** Boîte vérifiée en entier (Chat + Demandes Priorité + Autres/masqué) à **chacune des sessions** des 27, 29, 30, 31/07, 01 et 02/08 ; non vérifiée le 28/07 après-midi (session non exécutée, angle mort de ~6 h). **Dix-huit jours consécutifs sans un seul message entrant sur X.** La seule conversation existante est le **DM de bienvenue envoyé par HWG à @snpoehlm le 31/07, toujours sans réponse au 02/08 16h**. |
| **LinkedIn** | **Au moins 33 messages entrants**, comptés sur les seules sessions qui les chiffrent explicitement : 0 (29/07 16h), 4 (30/07 9h), 4 (30/07 16h), 5 (31/07 9h), 3 (31/07 16h), **9 (01/08 9h)**, 4 (01/08 16h), 4 (02/08 16h). Les sessions des 27, 28/07 et du 02/08 matin ne chiffrent pas leurs entrants, **le total réel est donc supérieur**. Sortants sur la même fenêtre : **~35 DM validés par David en session interactive et envoyés** (4 le 27/07, 12 le 31/07, 10 le 01/08 matin, 4+5 le 02/08). |

---

### 🔎 Synthèse — patterns observés

**1. Le pattern n°2 du premier relevé s'est inversé, et c'est le fait le plus important de la semaine.** Le premier relevé concluait que « la portée d'une reply est déterminée par le post cible, pas par l'angle », avec un taux de conversion stable de 0,2 à 0,7 %. Cette semaine, **les quatre plus grosses cibles de la fenêtre donnent les quatre pires conversions** : @WFPChief 45,5 k → 0,05 %, @HelenBranswell 15,2 k → 0,06 %, @business 39 k → 0,07 %, @AJEnglish 38,5 k → 0,10 %. À l'inverse, **les petites cibles donnent les meilleures** : @Epicentre_MSF 53 vues → 7,5 %, @snpoehlm 108 vues → **38 %**, @Dr_JeanKaseya 334 vues → 3,9 %. La règle opérationnelle qui en découle est l'exacte opposée de celle de la semaine dernière : **sur les gros comptes, la reply HWG est désormais noyée ou déclassée ; sur les petits fils, elle est réellement lue.**

**2. Corollaire préoccupant : la portée totale s'effondre alors que le volume augmente.** 566 vues sur 22 replies contre 1 800 sur 17 la semaine du 16-23/07. Une division par quatre de la moyenne par reply, sans changement de méthode, de qualité de double-check ni de sélection de cibles. Deux replies à 2 et 4 vues (@DrIanWeissman, @Epicentre_MSF) sont proches de l'invisibilité totale. **Hypothèse à tester** : un déclassement des réponses d'un compte à faible autorité par l'algorithme de X, ce qui rendrait structurellement stérile la stratégie « répondre aux gros comptes ». Test proposé pour la semaine prochaine : viser délibérément une moitié de cibles à moins de 1 000 vues et comparer.

**3. Le seul mécanisme d'acquisition d'abonné observé de bout en bout sur X est le même que sur LinkedIn : le petit fil individuel.** @snpoehlm, virologue vérifié, a été engagé sur un post à 108 vues, la reply a fait 41 vues et 2 likes (meilleure performance relative de la semaine), et **il s'est abonné le jour même**. C'est exactement le motif « David Amado Vidal » et « Marium Azim » côté LinkedIn : *une réaction sur un petit fil recrute, une impression sur une grande page ne recrute pas*. Trois relevés, trois confirmations, sur deux plateformes. **C'est le pattern le mieux établi du dispositif.**

**4. Sur LinkedIn les deux leviers sont désormais clairement dissociés, et il ne faut pas choisir.** Le commentaire Ouganda du 29/07 a fait **15 941 impressions et 20 réactions**, trois ordres de grandeur au-dessus des 9 à 11 impressions des commentaires du 01/08 sur des profils individuels. Mais **ce sont les petits fils qui produisent les conversations** : 2 réponses de fond sur 5 le 01/08, dont une question directe posée à David (Elhakim Ibrahim) et une reprise argumentée de l'angle HWG (Cyrille SANDEU), alors que le post Ouganda à 15 941 impressions n'a produit qu'une seule réponse. **Portée publique et conversation engagée sont deux objectifs distincts servis par deux leviers distincts.**

**5. L'accumulation LinkedIn court sur 48 h, celle de X est morte en 24 h.** Le commentaire Ouganda est passé de 777 à 8 838 puis 15 941 impressions entre J+0 et J+2, un facteur supérieur à 20. Toute mesure LinkedIn faite le jour même est un plancher. Sur X en revanche, les 22 replies mesurées ici à J+1 à J+7 sont **toutes** dans le même ordre de grandeur que les mesures faites à quelques heures par les routines (@VinGuptaMD relevée à 42 vues à 6 h le 02/08, mesurée à 54 le 03/08). L'hypothèse de « queue longue » du deuxième relevé, fondée sur deux likes tardifs, **ne se confirme pas sur les vues** : les deux likes tardifs (J+5 et J+7) sont réels mais ne s'accompagnent d'aucune reprise de portée.

**6. LinkedIn accélère fortement, et le facteur n'est pas le contenu.** +73 abonnés contre +14 la semaine précédente, au moment précis où le volume de DM sortants passe de 4 à 10-12 par jour. La croissance suit le volume d'approche directe, pas le volume ou la qualité de commentaires, qui sont restés stables. **Le levier de croissance LinkedIn identifié est le DM validé par David, pas le commentaire.**

**7. Deux interlocuteurs institutionnels de premier plan sont entrés en contact cette semaine, et aucun n'a été relancé.** Chikwe Ihekweazu (Assistant DG de l'OMS) a aimé une reply HWG le 31/07 ; Stefan Pöhlmann s'est abonné le même jour et **n'a pas répondu au DM de bienvenue depuis trois jours**. Ce sont les deux signaux de traction les plus qualifiés jamais enregistrés sur X, sur un compte qui plafonne à 29 abonnés.

### 📌 À revoir la semaine prochaine
- **Tester l'hypothèse de déclassement** (pattern n°2) : comparer explicitement la conversion des replies visant des cibles à moins de 1 000 vues et celles visant des cibles à plus de 10 000. Deux relevés contradictoires sur ce point, il faut trancher.
- **Le compteur X, à 29** : confirmer si la sortie de stagnation tient, et **quelle part est du bruit** (trois des abonnés de la fenêtre sont des comptes d'appât refusés).
- **@snpoehlm** : le DM de bienvenue reste sans réponse depuis le 31/07. À vérifier une dernière fois, sans relance.
- **Impressions LinkedIn** : la donnée n'existe que sur les 5 derniers commentaires. **Aucune mesure n'est possible en relevé hebdomadaire**, il faut que les routines quotidiennes la relèvent le jour même sinon elle est définitivement perdue. Seuls 6 points de mesure existent sur 36 commentaires cette semaine.
- **Accès LinkedIn** : deux relevés sur trois se sont faits sans aucun accès direct au domaine. Tant que le blocage persiste, la moitié LinkedIn de ce relevé restera une compilation d'archives et non une mesure.

---

## 📅 Semaine du 2026-07-20 au 2026-07-27 — 2e relevé

**Relevé du 27/07 à 08h05.** Fenêtre glissante 7 jours = 20/07 → 26/07 (les routines du 27/07 n'avaient pas encore tourné au moment du relevé, rien n'est archivé pour ce jour). Le relevé précédent couvrait 16/07 → 23/07 : **le contenu neuf de cette semaine est donc celui des 24, 25 et 26/07**, le reste ayant déjà été mesuré.

### ⛔ Limite majeure — aucune métrique X n'a pu être relevée cette semaine

**Le navigateur est resté totalement inutilisable pendant toute la session.** `navigate` en timeout 300 s à **quatre reprises** (onglet existant, onglet neuf, après re-`select_browser`, après redémarrage complet de Chrome), alors que les appels niveau extension (`select_browser`, `tabs_context_mcp`, `tabs_create_mcp`) répondaient instantanément — signature du « cas 3 » (couche CDP/page morte) déjà documentée. Conséquence directe : **aucune vue, aucun like, aucun compteur d'abonnés X n'a pu être relevé en direct**. Tous les chiffres X ci-dessous proviennent des relevés déjà archivés par les routines quotidiennes, et sont datés en conséquence.

**⚠️ Trois faits nouveaux, plus graves que la panne elle-même :**

1. **Le blocage frappe désormais le MATIN** (08h05), alors que le motif documenté depuis le 24/07 le cantonnait strictement au créneau de 16h, les sessions du matin passant toujours.
2. **Les deux remèdes connus ont échoué, l'un après l'autre.** Nettoyage des orphelins `chrome-devtools-mcp` (51 process `node.exe` tués + l'instance Chrome parasite du 26/07 20h08 tombée avec) : sans effet. Redémarrage complet de Chrome ensuite : sans effet non plus. Le diagnostic du 26/07 (« cause = accumulation des process en fuite ») **ne tient donc pas** : la fuite a bien été purgée, et la couche CDP est restée morte.
3. **La tâche Windows de nettoyage posée le 26/07 ne nettoie rien.** Elle tourne bien toutes les 30 min et renvoie un code 0, mais son journal montre qu'elle classe **100 % des process en « rattachés à une session vivante »** et n'en tue aucun : 52 process à 02h01, 57 à 02h31, 62, 67, 72, 82, **87 à 07h31**, croissance monotone toute la nuit, zéro orphelin détecté. Le garde-fou n°3 du script (`Test-HasLiveClaudeAncestor`) remonte la chaîne des parents jusqu'à trouver un `claude.exe` vivant : comme l'application reste ouverte en permanence, **tout process en fuite passe pour légitime**. Le correctif du 26/07 est inopérant depuis sa pose.

### Compteurs d'abonnés

| Plateforme | Valeur | Semaine précédente | Delta |
|---|---|---|---|
| **X — @HWatchGlobal** | **21 abonnés** (relevé du **25/07**, 131 abonnements, 152 posts) — *valeur au 27/07 non disponible* | 21 au 23/07 | **0 en 8 jours** |
| **LinkedIn — profil David Deheunynck** | **154 abonnés** (relevé routine 26/07 ~20h) | 139-140 le 23/07 | **+14 à +15** |
| **LinkedIn — relations** | **115** (26/07 ~20h) | 113 le 26/07 matin | +2 sur la journée |

Série LinkedIn de la semaine : 139 (23/07) → 147 (25/07 matin) → 150 (25/07 après-midi) → 152 (26/07 matin) → **154 (26/07 soir)**. Croissance qui se poursuit mais **ralentit** : +14 cette semaine contre +21 la précédente, soit ~2/jour contre ~3/jour.

⚠️ **Le compteur X est à 21 pour la deuxième semaine consécutive.** Sur la fenêtre, HWG a pourtant publié 7 replies, 1 thread de marque et exécuté 10 suivis. **Zéro abonné gagné**, et aucune notification d'abonnement trouvée dans les notifications depuis le 21/07 (vérifié aux sessions des 25 et 26/07).

### Replies X — publiées dans la fenêtre

**Vues non disponibles pour toute cette section** (navigateur mort). Les vues du post cible sont celles relevées par la routine au moment de la publication.

| Date | Compte cible | Angle | Vues post cible | Vues reply | Retombée observée |
|---|---|---|---|---|---|
| 24/07 | @SantePubliqueFr | Réservoir importé → allumage autochtone + calendrier de saison (dengue) | 2 840 | *non disponible* | aucune |
| 25/07 | @HelenBranswell | Non-comparabilité du classement historique : North Kivu (23 mois, vaccin + monoclonaux) vs RDC 2026 (2 mois, Bundibugyo sans contre-mesure) | ~10 h de post | *non disponible* | aucune |
| 25/07 | @MobilePunch | Lassa Nigeria : le compteur hebdo est le bruit, le CFR (23,8 % vs 18,7 %) est le signal | — | *non disponible* | aucune |
| 25/07 | @CBSNews | Rougeole US : amnésie immunitaire, la charge déborde la flambée sur 2-3 ans | — | *non disponible* | aucune |
| 26/07 | @UniofOxford | Le goulot n'est pas l'approvisionnement (620 000 doses stockées) mais le chemin de preuve (Phase 1, 50 volontaires) | 17 400 | *non disponible* | aucune |
| 26/07 | @SkyNews | La grève de paie est une rupture de production de la donnée, pas seulement de soins | 42 900 (en 1 h) | *non disponible* | aucune |
| 26/07 | @actualitecd | L'évaluation individuelle A/B/C déplace la contrainte du poste-frontière vers le suivi des contacts | 4 936 | *non disponible* | aucune |

**Contenu de marque X** : 1 thread MWF publié dans la fenêtre (24/07, accord Africa CDC × OIM, 3 tweets). **Vues non disponibles.**

### Retombées X effectivement observées cette semaine

Les seules interactions entrantes de la semaine, toutes deux repérées en notifications :

| Date | Signal | Sur quoi |
|---|---|---|
| 26/07 | **@hjamesdc (Heather Jameson) a aimé** une reply HWG | reply du **21/07** à @KrutikaKuppalli — soit **5 jours après publication** |
| 25/07 | **@DavyDrTumuhairw a aimé** une reply HWG | reply antérieure, compte déjà connu et écarté (affiliation invérifiable) |

**Aucune réponse publique reçue sur aucune des 7 replies de la fenêtre. Aucun nouvel abonné. Aucun DM.**

### Commentaires LinkedIn — publiés dans la fenêtre

**24/07 : 0 commentaire** (navigateur cas 2, saisie bloquée — quota 0/5 perdu, seul jour de la semaine sans publication).

| Date | Cible | Angle | Retombée mesurée |
|---|---|---|---|
| 25/07 | **ECDC** (West Nile Europe) | Les 9 zones nouvellement touchées bougent avant le total de cas ; poids sur le seuil de détection | ⭐ **1 réaction (David Amado Vidal) + 23 impressions** sur le commentaire — et **il est devenu abonné dans la foulée** |
| 25/07 | INRB (modélisation spatio-temporelle) | Le seuil de décision est la vraie contrainte, pas la production du signal | aucune |
| 25/07 | Eric D'Ortenzio (IRD, atelier PRISME) | L'Amazonie est continue, les canaux qui la décrivent ne le sont pas | aucune |
| 25/07 | Ngala Thierry Talla (qualité données M&E) | La fraîcheur est la dimension absente des grilles qualité | aucune |
| 25/07 | Hans Kluge (OMS Europe, feux de forêt) | Asymétrie d'alerte : exposition en temps réel, charge sanitaire des semaines plus tard sans définition de cas | aucune |
| 26/07 | WHO AFRO (IPC camp de Kigonze) | Le camp est une unité épidémiologique que la couche de reporting n'a pas | *non relevé* |
| 26/07 | UNICEF RCA (points d'entrée) | Un zéro n'est lisible que si l'effort de surveillance est publié à côté | *non relevé* |
| 26/07 | ANRS MIE (arbovirus France/Guyane) | Deux régimes de surveillance rangés sous le même pays | *non relevé* |
| 26/07 | Julien Harneis (Mongwalu) | Un changement de management terrain ne laisse aucune trace dans les données mais casse la cadence de publication | *non relevé* |
| 26/07 | Triphene Koleka (Health Data Science) | La réconciliation multi-sources, pas l'analyse, est le vrai gros du travail | ⭐ **Like de l'autrice elle-même** |

Les 4 commentaires « non relevé » du 26/07 le sont parce que la session de 16h est morte au navigateur ; la reprise de 19h38 n'a eu le temps de constater que la retombée Triphene Koleka.

**Posts de marque LinkedIn** (statistiques relevées en notification le 25/07) : post mpox/RDC **40 impressions**, post Ouganda **95 impressions**. Vues de profil 130, impressions cumulées de posts 478 → 480 pendant la session. Chiffres du 26/07 non relevés.

### DM / messages reçus

| Plateforme | Reçus sur la fenêtre |
|---|---|
| **X** | **0** — boîte vérifiée vide (Tous + Priorité + **Masqué**) à chaque session des 24, 25 et 26/07. **Onze jours consécutifs sans un seul message entrant sur X.** |
| **LinkedIn** | **~17 messages entrants sur les seuls 24-26/07**, venant de **10 correspondants distincts** : Kevin Wamae (KEMRI-Wellcome, 3 messages sur 3 jours), kyembe Salachi (3, dont une bascule courtoisie → réponse de fond sur l'AMR), Ingride Siemeni (3), Issa Barry (2, dont une réponse longue), Serge Lisongo Gbalamo (DPS Haut-Lomami, explication technique DHIS2), Félicité Dorise FOE NOAH (SIMR/IDSR et Surveillance Fondée sur les Événements), Anoop Velayudhan (ICMR Inde), Talla N. Ndahwouh, Ngala Thierry Talla, Virgil Lokossou (👍 seul) |

---

### 🔎 Synthèse — patterns observés

**1. L'écart X / LinkedIn ne se réduit pas, il se creuse.** Deuxième semaine consécutive : X à **0 abonné gagné, 0 DM, 0 réponse publique, 2 likes** ; LinkedIn à **+14 abonnés, +2 relations, ~17 messages entrants de 10 correspondants distincts sur trois jours**, dont plusieurs réponses techniques substantielles (DHIS2 agrégé vs saisie individuelle, SIMR/IDSR vs SFE, financement récurrent vs ponctuel). Le constat de la semaine dernière n'était pas un accident d'échantillon : **X délivre de la portée, LinkedIn délivre de la conversation, et seul LinkedIn produit des interlocuteurs.**

**2. Fait neuf : les replies X ont une queue longue, pas un pic.** Les deux seules interactions X de la semaine sont des likes sur des replies vieilles de **4 et 5 jours**, découvertes par recherche ou par fil, pas par la timeline. Une reply X ne « marche » donc pas le jour où elle est postée, ce qui invalide au passage la façon dont ces routines mesurent leur propre effet le soir même. À vérifier la semaine prochaine si le navigateur revient.

**3. Sur LinkedIn, commenter chez un individu bat commenter chez une organisation.** Seul point de comparaison chiffré disponible : **23 impressions** sur le commentaire chez l'ECDC (page à forte audience) contre **178 impressions** la semaine dernière sur le commentaire dans le fil d'Ingride Siemeni (profil individuel, 199 abonnés). Un facteur ~8 en faveur du profil individuel. Cohérent avec les retombées : les deux seules réactions de la semaine viennent d'un individu (Triphene Koleka, autrice du post) et d'un lecteur individuel (David Amado Vidal), pas des pages ECDC / WHO AFRO / UNICEF / ANRS.

**4. Un commentaire qui obtient une réaction recrute un abonné.** David Amado Vidal a réagi au commentaire ECDC **puis est apparu dans les nouveaux abonnés le jour même**. C'est le seul mécanisme d'acquisition d'abonné observé de bout en bout jusqu'ici, sur les deux relevés.

**5. Le facteur limitant du dispositif n'est plus le contenu, c'est l'infrastructure.** Sur la fenêtre : 1 journée complète de commentaires LinkedIn perdue (24/07, 0/5), 2 replies X non comblées le 24/07, et **5 sessions de 16h mortes sur les 7 derniers jours**. Cette session de mesure elle-même n'a rien pu mesurer. Le dispositif produit maintenant plus de perte par panne navigateur que par mauvais choix de cible.

### 📌 À revoir la semaine prochaine
- **Toute la colonne « vues reply » des 24-26/07**, jamais relevée — et les 3 replies du 23/07 déjà signalées comme mesurées trop tôt, toujours non revues.
- **Compteur d'abonnés X** : troisième relevé consécutif à 21 ferait de la stagnation un fait établi, pas une coïncidence.
- **Impressions par commentaire LinkedIn**, à relever systématiquement : c'est la seule métrique qui permette de trancher « profil individuel vs page d'organisation », et il n'y a que deux points de mesure pour l'instant.
- **Vérifier si le like tardif est un motif** (une reply gagne-t-elle des interactions à J+4/J+5 ?) ou un hasard sur deux observations.
- **Panne navigateur** : le correctif du 26/07 étant inopérant et le redémarrage de Chrome inefficace, aucun remède connu ne fonctionne aujourd'hui. Sans navigateur, ce relevé perd sa moitié X.

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
