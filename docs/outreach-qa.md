# Double-check des messages sortants — dispositif

Pourquoi ce document existe : le double-check §5 en 8 points fonctionne, mais il
est fait **par le rédacteur, sur son propre texte, dans le même contexte**. Un
rédacteur qui vient de choisir un chiffre le retrouve « juste » quand il se
relit. C'est la raison pour laquelle David redemande une relecture à la main :
ce n'est pas une checklist qui manque, c'est un regard qui n'a pas écrit le
texte.

Le dispositif remplace l'auto-relecture par trois étages qui ne partagent pas le
même angle mort.

**⚠️ Schéma mis à jour le 2026-08-26 (soir) — le modèle en boucle avec `ABANDON` décrit
plus bas dans ce document (§4, §5) est obsolète, gardé pour l'historique.** David
a demandé, en session interactive, que les trois routines LinkedIn (`monitoring`,
`followup-check`, `followup-check-2`) donnent un brouillon corrigé une seule fois
par le contrôle mécanique et le relecteur, plutôt que de laisser un script
trancher publication ou abandon par une boucle à plusieurs essais. Motif : le
26/08 matin, 3 commentaires sur 4 ont été abandonnés par le seul contrôle
mécanique sur des faux positifs (anglais courant, citation de source obligatoire),
alors que le fond de deux d'entre eux était déjà validé par le relecteur.

**Un passage du même matin avait, en plus, mis les commentaires et notes de
connexion en file de validation aux côtés des DM. David a corrigé ça le soir même**
(« *j'ai demandé un droit de regard simplement sur les DM, pour le reste, tu es
en autonomie* ») — voir `CLAUDE.md` et `_shared/hwg-social-policy.md` §5. Seul le
point du paragraphe précédent (fin de la boucle, fin du verdict qui décide seul)
survit du changement du matin ; le périmètre de la file de validation, lui,
redevient **DM uniquement**, comme depuis le 2026-07-23.

```
build-claimable-facts.mjs        les chiffres citables sont figés AVANT la rédaction
        ↓
rédacteur (agent)                écrit le brouillon, ne cite que le registre
        ↓
check-outreach-message.mjs       contrôle mécanique, UNE fois : forme, chiffres, gabarits, contexte
        ↓  (le verdict est une note jointe, pas un couperet)
relecteur (agent, contexte neuf) 12 questions, UNE fois, réponse justifiée par une citation
        ↓  (ses 12 réponses sont une note jointe, pas un couperet)
        ↓
   DM ────────────────────────────┐        commentaire / note de connexion
   ↓                              │                    ↓
file de validation                │        l'agent tranche seul à partir des
(linkedin-contacts.md),           │        deux rapports : corrige ce qui est
jamais envoyé par la routine      │        réel, publie, ou renonce si le
   ↓                              │        fond ne tient pas — publié direct
David corrige avec l'agent,       │        (content-log.md), jamais mis en file
puis décide seul d'envoyer ──────┘
```

---
## 0. Périmètre — quelles routines sont couvertes

**Ce dispositif couvre la prospection, et elle seule** : `linkedin-hwg-monitoring`
(9h), `linkedin-hwg-followup-check` (13h) et `linkedin-hwg-followup-check-2` (17h),
pour ce qu'elles adressent à un contact identifié — DM, note de connexion,
commentaire sous le post de quelqu'un.

**`linkedin-hwg-content-proposal` n'est pas dans ce périmètre, et n'y entrera pas
sans décision explicite de David.** Le rattachement fait le 2026-08-24 a été
annulé le jour même. La raison n'est pas le niveau d'exigence, c'est
l'asymétrie des conséquences : **un DM raté brûle un contact réel et
définitivement ; un post raté est sur le mur de David, dans sa voix, et se
supprime.** Mêmes contrôles, seuils différents, et surtout état terminal
différent — voir « Le contenu de marque n'a pas d'état `ABANDON` » plus bas.

Ce que la routine de contenu emprunte quand même : les deux registres du § 1 et
du § 1 bis. Un chiffre ou une affirmation produit se vérifie de la même façon
partout. **S'en servir n'emporte pas le reste du dispositif** — ni la boucle à
quatre essais, ni le verdict en majuscules, ni la sortie en échec.

Les routines X ne sont couvertes par rien de ce document.

---
## 1. Le registre de faits

`marketing/qa/claimable-facts.json`, régénéré par `node scripts/build-claimable-facts.mjs`
**au début de chaque run, avant la rédaction**.

Règle unique, non négociable : **un chiffre qui n'est pas dans ce fichier ou dans
le fil de discussion n'entre pas dans un message.** Pas « je vérifie ma mémoire »,
pas « le chiffre me semble juste » : il vient du registre ou il ne sort pas.

Un fait périmé (plus de 10 jours sans mise à jour en base) reste citable, mais
seulement daté : « 1 406 cas au 19 août », jamais « 1 406 cas ».

## 1 bis. Le registre produit

`marketing/qa/product-claims.json`, régénéré par `npm run qa:claims`.

Le registre de faits couvre les flambées. Celui-ci couvre **le produit** : ce
qu'un post ou un message a le droit d'affirmer sur HealthWatch Global lui-même.
Il devient indispensable dès qu'un message sortant affirme quelque chose sur HWG
lui-même, où l'affirmation risquée n'est plus « 1 406 cas » mais « le plan Pro
est à 29 € » ou « les alertes push sont disponibles ».

⚠️ Cette phrase disait auparavant « dès qu'une routine publie du contenu de
marque ». Corrigé le 2026-08-25 : c'est la formulation qui a fait entrer
`linkedin-hwg-content-proposal` dans le dispositif le 24/08. Le registre produit
sert à cette routine, le reste du document non — voir le § 0.

Il n'est pas rédigé à la main. Il est **extrait de ce qui fait foi** :

| Source | Ce qu'elle autorise |
|---|---|
| `lib/pricing.ts` | tous les prix, dans les deux devises — la source unique du dépôt, par construction |
| `messages/*.json` | la copie publique du site, sur les 5 locales : ce qui est déjà affiché est citable mot pour mot, FAQ comprise |
| table `outbreaks` | la couverture réelle : nombre de foyers, de pays, de maladies, hôtes des sources |
| `product-claims.manual.json` | ce qui n'est encore nulle part : une fonctionnalité livrée du jour, une date de sortie |

Ce dernier fichier est le **seul du dispositif tenu à la main**, et c'est
volontaire : tout le reste est extrait, donc ne peut pas mentir sur le produit.
Deux règles y sont non négociables. Rien n'y entre tant que ce n'est pas vrai
**en production** — une annonce qui part avant le déploiement est un faux
témoignage sur son propre produit. Et tout ce qui est daté ou temporaire porte
un `expiresOn`, sans quoi la routine annoncerait en octobre une nouveauté
d'août ; le build signale et retire ce qui a expiré.

Concrètement, dans un brouillon : « 29 € » et « 14 jours » passent, sourcés sur
`lib/pricing.ts` et sur la FAQ du site. « 340 clients actifs » est bloqué deux
fois — chiffre non sourcé, et chiffre de traction interdit en sortant.

**Ce que le contrôle mécanique ne fait pas ici** : juger une affirmation en
langue naturelle. Il vérifie l'origine des nombres et remonte chaque phrase
mentionnant HWG au relecteur. La différence avec avant est que le relecteur a
maintenant une liste fermée à confronter, au lieu de sa mémoire.

## 2. Le contrôle mécanique

```
node scripts/check-outreach-message.mjs --draft tmp/draft-<slug>.md --context tmp/ctx-<slug>.json --json
```

Il vérifie ce qui se vérifie sans avis :

| Famille | Ce qui bloque |
|---|---|
| Forme | tiret cadratin, caractère non ASCII hors accents FR, dépassement de longueur du canal |
| Véracité | chiffre absent du registre et du fil, chiffre périmé avancé sans sa date, flambée close présentée comme en cours, chiffre de traction |
| Contexte | langue du brouillon ≠ langue du fil, tutoiement/vouvoiement incohérent, CTA avant échange de fond, lien non demandé, plafond de relance atteint, délai minimum non respecté |
| Vocabulaire | termes interdits, confusions épidémiologiques (létalité/mortalité, flambée/pandémie, veille/surveillance active, agréger/détecter) |
| Anti-gabarit | séquence de 5 mots déjà présente dans l'historique, séquence de 4 mots partagée avec un autre brouillon **du même run** |

Ce dernier point corrige le trou identifié le 23/08 : le contrôle comparait aux
archives, jamais aux brouillons frères. Adetifa et Elnahif partageaient 9
séquences de 5 mots et rien ne l'avait vu.

Le contexte (`ctx-<slug>.json`) est écrit par le rédacteur :

```json
{
  "channel": "linkedin-dm",
  "recipient": { "name": "Prénom NOM", "slug": "prenom-nom-1234" },
  "threadFile": "tmp/thread-prenom-nom.txt",
  "peers": ["tmp/draft-autre.md"],
  "substantiveExchange": true,
  "linkRequested": false,
  "outboundUnanswered": 1,
  "lastOutboundDate": "2026-08-21",
  "attempt": 1
}
```

`threadFile` est le fil **collé verbatim**, pas résumé. Sans lui, la langue, le
registre et l'origine des chiffres ne sont pas contrôlables et le rapport le dit.

## 3. Le relecteur

Un agent distinct, lancé avec un **contexte neuf**. Il reçoit quatre choses et
rien d'autre :

1. le brouillon,
2. le fil verbatim et l'intitulé de profil du destinataire,
3. l'extrait du registre de faits correspondant aux chiffres du brouillon, et —
   dès que le brouillon parle de HWG — les claims produit et la copie publique du
   site qui s'y rapportent,
4. le rapport JSON du contrôle mécanique.

Il ne reçoit **pas** le raisonnement du rédacteur, ni ses justifications, ni ses
essais précédents. C'est tout l'intérêt : ce qui a convaincu le rédacteur ne doit
pas pouvoir le convaincre une seconde fois.

### Prompt du relecteur

> Tu relis un message qui va partir à une personne réelle, au nom de David
> Deheunynck, fondateur de HealthWatch Global. Tu n'as pas écrit ce message et tu
> n'as pas à le défendre. **Ton travail est d'essayer de le faire échouer.**
>
> Réponds aux 12 questions ci-dessous. Pour chacune : `PASS`, `FAIL` ou `UNSURE`,
> suivi d'une **citation littérale** de la source qui justifie ta réponse (le
> brouillon, le fil, le registre de faits). Une réponse sans citation vaut `FAIL`.
> **`UNSURE` compte comme `FAIL`** : si tu ne peux pas prouver que c'est bon, ce
> n'est pas bon.
>
> 1. **Chiffres** — chaque nombre du message figure-t-il dans le registre de faits
>    ou dans le fil ? Cite la ligne exacte pour chacun.
> 2. **Fraîcheur** — un chiffre daté de plus de dix jours est-il présenté avec sa
>    date ?
> 3. **Statut** — une flambée déclarée close est-elle présentée comme close ?
> 4. **Affirmations sur HWG** — chaque phrase mentionnant HealthWatch Global
>    est-elle couverte par le registre produit (`product-claims.json` : copie
>    publique du site, prix, couverture, claims manuelles) ou par les claims
>    autorisées de `lexicon.json` ? Cite la ligne qui la couvre. Une affirmation
>    produit qu'aucune des deux ne couvre vaut `FAIL`, même si elle te paraît
>    vraie : le produit a pu changer sans toi. Aucune traction, aucun témoignage,
>    aucun partenariat non signé.
> 5. **Attribution** — le message met-il dans la bouche de l'interlocuteur quelque
>    chose qu'il n'a pas dit ? Cite son message d'origine.
> 6. **Parcours** — ce que le message affirme du parcours du destinataire est-il
>    lisible tel quel sur son profil, ou est-ce déduit ?
> 7. **Fil** — le message répond-il à ce qui a été dit en dernier, ou repart-il
>    d'un point déjà traité ?
> 8. **Langue et registre** — même langue et même registre (tu/vous) que le fil ?
> 9. **Terrain politique** — le message valide, conteste ou commente-t-il un
>    grief interne, une querelle institutionnelle ou une position politique ?
>    Le silence doit être total, dans les deux sens.
> 10. **CTA** — s'il y a un appel à l'action ou un lien : au moins un aller-retour
>     de fond a-t-il eu lieu, et le CTA part-il d'un point déjà présent dans
>     l'échange ? Sinon `FAIL`.
> 11. **Gabarit** — le message pourrait-il être envoyé à quelqu'un d'autre en
>     changeant seulement le prénom ? Si oui, `FAIL`.
> 12. **Apport** — le message apporte-t-il quelque chose que le destinataire n'a
>     pas déjà dit (un angle, une question qu'il est le seul à pouvoir trancher),
>     ou n'est-ce qu'un accusé de réception habillé ?
>
> Termine par une seule ligne :
> `VERDICT: ENVOYER` (12 `PASS`) ou
> `VERDICT: REECRIRE` suivi des numéros en échec et, pour chacun, la correction
> minimale à apporter — pas une réécriture complète, le point précis à changer.
>
> Tu ne réécris pas le message toi-même. Tu ne proposes pas de formulation.

### Pourquoi ces règles de format

- **Citation obligatoire** : empêche le relecteur de valider de mémoire, comme le
  rédacteur le faisait.
- **`UNSURE` = `FAIL`** : le doute penche du côté de ne pas envoyer, jamais
  l'inverse. C'est le réglage qui rend l'automatisation acceptable.
- **Le relecteur ne réécrit pas** : s'il rédige, il devient auteur et perd son
  indépendance sur le tour suivant.

## 4. La boucle — MODÈLE OBSOLÈTE DEPUIS LE 2026-08-26, GARDÉ POUR L'HISTORIQUE

**Ce qui suit décrit un mécanisme qui n'existe plus.** Depuis le 2026-08-26, il
n'y a plus de boucle à plusieurs essais ni de réécriture automatique : un
brouillon est rédigé une fois, passé une fois au contrôle mécanique et une fois
au relecteur, et part **systématiquement** en file de validation avec les deux
rapports joints, quel que soit leur verdict — voir le schéma en tête de document
et `_shared/hwg-social-policy.md` §5. Ironiquement, c'est très exactement le
principe déjà décrit plus bas pour le contenu de marque (« Le contenu de marque
n'a pas d'état `ABANDON` ») : il s'applique maintenant à tous les canaux, pas
seulement au post de marque. Le texte ci-dessous reste comme trace de ce qui a
été essayé entre le 24/08 et le 26/08, et pourquoi ça n'a pas tenu.

**Le but de la boucle était de converger sur un texte défendable, pas de décider
qui l'envoie.** C'est la confusion commise le 2026-08-24 : ce document affirmait
que David avait décidé de laisser partir les DM sans lui. **Il ne l'a jamais
décidé, et il l'a démenti explicitement le jour même.** La règle de mise en file
d'attente des DM, décidée le 2026-07-23 et étendue le 2026-08-19, n'a jamais été
levée.

La boucle a donc **deux issues** — le texte converge, ou il est abandonné — et
ce qu'autorise la convergence **dépend du canal** :

- **commentaire, note de connexion** : un `VERDICT: ENVOYER` autorise la publication ;
- **DM** : un `VERDICT: ENVOYER` autorise **la mise en file d'attente de validation**
  dans `marketing/linkedin-contacts.md`, et rien de plus. L'envoi appartient à David.

| Essai | Ce qui se passe |
|---|---|
| 1 | Rédaction, puis contrôle mécanique, puis relecteur. |
| 2 | Correction **des points cités, rien d'autre**. `previousFindingIds` = les `findingIds` du rapport précédent. |
| 3 | Idem. Mais si un motif de blocage **revient** d'un essai à l'autre, le script bascule directement en réécriture (`REWRITE_FROM_SCRATCH`) sans user cet essai. |
| 4 | **Dépend de ce qui a été rejeté** — voir « Réécrire ou corriger » ci-dessous. |
| — | Échec au 4e → **`ABANDON`** (code de sortie 2). |

### Réécrire ou corriger, à l'essai 4

Précision ajoutée le 2026-08-24, après un cas réel où la règle littérale aurait
dégradé le message (fil Patrick AYONGA). **Le critère est l'angle, pas le
compteur d'essais.**

- **L'angle est rejeté** — le relecteur échoue sur la question 11 (gabarit) ou 12
  (apport), ou le contrôle mécanique bloque une troisième fois sur le même motif :
  **réécriture depuis zéro**, par un rédacteur qui reçoit le fil, le profil et le
  registre **mais pas le brouillon échoué**. Un texte qu'on rapièce trois fois
  garde le défaut de son angle d'origine, et le rédacteur qui l'a écrit ne peut
  pas s'en extraire.
- **L'angle est validé et le rejet porte sur des points précis** — 11 et 12 en
  `PASS`, et le relecteur nomme les clauses à changer, typiquement en écrivant
  « sans toucher au reste » : **correction ciblée**. Repartir de zéro jetterait un
  angle déjà validé pour un mode verbal ou une attribution, et ferait très
  probablement retomber les points qui passaient.

En cas de doute, regarder ce que le relecteur demande. S'il désigne des clauses,
il demande une correction. S'il conteste ce que le message *fait*, il demande un
autre message. **Consigner le choix dans le journal du run** : c'est le seul
moyen de vérifier plus tard qu'il n'a pas servi à s'épargner une réécriture.

**Abandonner n'est pas mettre en file, et les deux coexistent.** Un brouillon
abandonné a **échoué** la boucle : rien n'est publié ni mis en file sur ce fil
pendant ce run, le motif est consigné, et la session passe à l'opportunité
suivante. Un brouillon de DM mis en file a **réussi** la boucle : il est complet,
double-checké, et il attend seulement la validation de David. Ne pas confondre
les deux dans le journal ni dans le bilan, ce sont des états opposés.

Une opportunité abandonnée n'est pas perdue : le fil sera repris au run suivant,
avec un contexte neuf, ce qui est souvent exactement ce qui manquait.
### Le contenu de marque n'a pas d'état `ABANDON`

Vaut pour `linkedin-hwg-content-proposal`, hors périmètre du § 0, et rappelé ici
parce que c'est ici qu'une session ira chercher la règle.

**Un post de marque ne s'abandonne pas au 4e essai : il se propose avec ses
réserves.** Si le texte ne convainc pas, il remonte quand même à David,
accompagné de ce que le relecteur lui reproche et du motif de blocage. David
tranche en dix secondes ; le dispositif, lui, n'a pas qualité à jeter un créneau.
La seule raison de ne rien proposer reste celle du SKILL.md — aucun angle frais
et solide ce jour-là — et elle se décide **avant** la rédaction, pas après quatre
réécritures.

Motif, constaté le 2026-08-24 : le run MWF du matin a tourné sous ce document,
contrôle mécanique `PASS` à l'essai 4, relecteur `REECRIRE`, sortie `ABANDON`.
**Rien n'est remonté à David — ni le brouillon, ni l'angle, ni le désaccord entre
les deux étages.** Un créneau perdu et aucune décision possible pour la seule
personne qui avait le droit de trancher. C'est l'inverse de ce que le dispositif
est censé produire.

Corollaire pour le journal du run : un post proposé avec réserves n'est **pas** un
échec et ne se consigne pas comme tel. Il se consigne comme proposé, avec ses
réserves.
**Pourquoi une limite plutôt qu'une boucle infinie.** Un message réécrit
indéfiniment pour satisfaire des contrôles finit par passer **par usure** — le
rédacteur retire les chiffres au lieu de les sourcer, ampute les phrases au lieu
de les reformuler — et part quand même. Quatre essais dont un repart de zéro
couvrent le cas réel (un défaut de formulation) sans récompenser l'attrition.

### Publication : file d'attente pour les DM, autonomie pour commentaires et notes de connexion

**Décidé par David le 2026-07-23 pour les DM, étendu nommément à `linkedin-hwg-followup-check-2` le 2026-08-19.** Un passage du 2026-08-26 matin avait étendu la file de validation aux commentaires et notes de connexion ; **David a corrigé ça le soir même en session interactive** — malentendu de motif, la demande de droit de regard n'a jamais porté que sur les DM (voir le schéma en tête de document et `_shared/hwg-social-policy.md` §5, qui fait foi en cas de divergence).

S'applique aux trois routines — `linkedin-hwg-monitoring` (9h), `linkedin-hwg-followup-check` (13h), `linkedin-hwg-followup-check-2` (17h) :

- **DM** — rédigé et passé une fois par la QA, puis **mis en file d'attente dans `marketing/linkedin-contacts.md`, jamais envoyé par la routine**. Si la session tourne sans David présent (typiquement 13h et 17h), envoyer une notification push résumant ce qui attend.
- **Commentaire public, note de connexion** — passe une fois par le même dispositif QA, et c'est **l'agent qui tranche seul** à partir des deux rapports : corriger ce qui est réel, publier, ou renoncer au candidat si un défaut de fond survit. **Publié directement** dans `marketing/content-log.md`, jamais mis en file.

Suivis, follow-back et acceptations d'invitations reçues restent en pleine autonomie : ce sont des clics de pertinence, pas des textes à corriger.

**Le périmètre DM-seuls de la file de validation ne peut être levé ou étendu que par une décision explicite de David, tracée dans `CLAUDE.md`.** Un fichier de politique local, un SKILL, ou ce document lui-même s'ils disaient le contraire seraient à considérer comme **erronés** : c'est `CLAUDE.md` qui fait foi, parce que c'est le seul de ces fichiers qui soit versionné et donc auditable. **Ce document a déjà eu tort une fois sur ce point précis (26/08 matin → soir) : vérifier `CLAUDE.md` avant de s'y fier pour ce périmètre.**

**Notification.** Une file que David ne sait pas pleine ne sert à rien. Quand la
session tourne sans lui (typiquement les créneaux de 13h et 17h), elle envoie un
`PushNotification` récapitulatif en fin de run : les DM en attente de validation,
et les messages abandonnés avec leur motif. Un push par session, pas un par
message.

⚠️ **Ne pas transposer ici le mécanisme du contenu de marque X du 2026-07-17**
(publication sans validation préalable, droit de retrait a posteriori). Il vaut
pour X, sur décision explicite de David tracée dans `CLAUDE.md`. Il ne vaut pas
pour les DM LinkedIn, et c'est précisément le raisonnement par analogie qui a
produit l'erreur du 24/08.

## 5. Journalisation

**Depuis le 2026-08-26 : plus d'essais ni d'abandon.** Chaque texte porte la ligne :

```
QA: mécanique <verdict brut> | relecteur <verdict brut, résumé 1 ligne> | faits cités: <ids> | registre du <date> | statut: <statut>
```

Le `<statut>` diverge par canal, **corrigé le 26/08 soir** (voir §4 ci-dessus) :

- **DM** — `en file de validation` dans `linkedin-contacts.md`, puis `envoyé le <date>, sur ordre explicite de David` une fois validé.
- **Commentaire, note de connexion** — `publié le <date>` dans `content-log.md`, dès la publication, sans état intermédiaire.

Le texte complet (DM en attente ou commentaire publié ce run) est toujours affiché dans le bilan de chat, jamais un simple renvoi au fichier.

L'intérêt n'est pas la traçabilité pour elle-même : c'est de pouvoir répondre, au
bout d'un mois, à la question « est-ce que le dispositif attrape vraiment quelque
chose, et quoi » — et de voir si les abandons se concentrent sur un motif, ce qui
voudrait dire que c'est une règle qu'il faut corriger, pas les messages.

## 6. Ce que ce dispositif ne couvre pas

- **Le rendu réel dans l'éditeur LinkedIn** (piège de l'iframe, balises `<p>`,
  bulle flottante) : contrôle navigateur, il reste où il est, dans les SKILL.md.
- **La vérification du destinataire au moment du clic** : idem, elle doit rester
  dans le même appel JS que le clic sur Envoyer.
- **Le jugement d'opportunité** : faut-il écrire à cette personne, maintenant.
  Le dispositif contrôle le message, pas la décision de l'engager.
- **La décision d'envoyer.** C'est le point que ce document a eu faux le 24/08, et
  c'est le plus important de la liste. Le dispositif juge un **texte**. Il ne
  transfère aucun pouvoir de décision, et il ne peut pas lever une règle décidée
  par David : seul `CLAUDE.md` en fait foi.

## 7. Ce qui reste fragile, à surveiller les premières semaines

Le dispositif n'avait **aucun run réel** derrière lui au moment de sa mise en
service. Il en a un depuis le 2026-08-24 (créneaux 9h et 13h). Trois risques
concrets, dont les deux premiers se lisent dans le relevé QA de fin de session :

- **Le contrôle mécanique ne juge pas la pertinence.** Un message creux mais
  irréprochable passe. C'est le relecteur, question 12, qui doit l'arrêter — et
  c'est le seul étage dont la fiabilité n'est pas mesurable autrement qu'en
  relisant a posteriori ce qui est parti.
- **Les abandons répétés sur le même motif** ne veulent pas dire que le rédacteur
  est mauvais : le plus souvent, c'est une règle du lexique trop large. Un motif
  qui revient plus de deux fois dans la semaine se corrige dans
  `marketing/qa/lexicon.json`, pas dans les messages.

  **Faux positifs documentés (liste tenue à jour, ajoutée le 2026-08-26)** —
  objectif : rendre le tri de l’agent mécanique au lieu de le refaire de tête à
  chaque brouillon, et donner un chiffre pour juger si le taux monte ou descend.
  - 24/08 : brouillon archivé en attente entrant en collision avec sa propre
    copie (78 séquences sur le fil Gröndahl) ; marqueur `lien` traitant le mot
    français « lien » comme un CTA ; seuil de 5 mots interdisant des
    collocations anglaises ordinaires (« if you want to see »).
  - 25/08 : l’année « 2014 », citée mot pour mot dans le post du destinataire,
    comptée à tort comme un chiffre épidémiologique par `facts.stale` (DM Mosoka
    Fallah, envoyé tel quel sur décision de David malgré l’`ABANDON` mécanique).
  - 26/08 matin : tournures d’anglais courant bloquées par l’anti-gabarit —
    « tends to be read as », « the other side of it » — jusqu’à la seule phrase
    autorisée pour décrire HWG (3 commentaires sur 4 abandonnés, cause du
    changement de modèle du 26/08, voir schéma en tête de document).
  - 26/08 13h : le nombre 56 (moyenne quotidienne calculée, 5 290 / 95 jours)
    rapproché à tort d’une ligne Diphtérie/Mauritanie du registre (`deaths`,
    40 j) par `facts.stale`, qui compare des valeurs identiques sans regarder le
    contexte de la phrase. La correction en toutes lettres (« une cinquantaine »)
    a fait passer le contrôle et introduit une erreur d’arrondi de 11 % que le
    relecteur a dû rattraper.
- **Le dispositif inspire une confiance qu'il ne mérite pas encore.** Trois étages,
  un verdict en majuscules et un score sur 12 donnent à une session l'impression
  d'avoir une autorité qu'elle n'a pas. C'est ce qui s'est produit le 24/08 : le
  dispositif a été lu comme s'il remplaçait la validation de David. **Un verdict
  `ENVOYER` est un avis sur un texte, pas une autorisation.**

Une relecture par David d'un échantillon de ce qui est mis en file, au bout d'une
semaine, vaut mieux que n'importe quel garde-fou ajouté d'avance.
