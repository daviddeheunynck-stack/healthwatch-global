# Bloc à coller dans les SKILL.md des routines d'outreach

À insérer dans `linkedin-hwg-monitoring`, `linkedin-hwg-followup-check`,
`linkedin-hwg-followup-check-2`, et adaptable à
`daily-institutional-prospecting-healthwatch` (canal `email`).

**Il remplace la ligne « auto double-check chaque message avant de livrer ».**
Cette ligne demandait au rédacteur de se relire lui-même, ce qui est précisément
ce qui ne marche pas. Le §5 en 8 points reste valable comme grille de rédaction,
il n'est plus le contrôle final.

---

## Double-check des messages sortants (dispositif dépôt)

Référence complète : `docs/outreach-qa.md` dans `healthwatch-global`.

### Au début du run, avant toute rédaction

```
node scripts/build-claimable-facts.mjs
```

Le fichier produit, `marketing/qa/claimable-facts.json`, est **la seule source de
chiffres autorisée**. Un nombre qui n'y figure pas et qui ne vient pas du fil de
discussion n'entre pas dans un message, quelle que soit la confiance que j'ai
dans ma mémoire. Si le script échoue, aucun message chiffré ne part de ce run.

### Pour chaque brouillon

1. Écrire le brouillon dans `tmp/draft-<slug>.md`.
2. Coller le fil **verbatim** dans `tmp/thread-<slug>.txt` (pas un résumé).
3. Écrire `tmp/ctx-<slug>.json` :

```json
{
  "channel": "linkedin-dm",
  "recipient": { "name": "Prénom NOM", "slug": "prenom-nom-1234" },
  "threadFile": "tmp/thread-<slug>.txt",
  "peers": ["tmp/draft-<autre>.md"],
  "substantiveExchange": true,
  "linkRequested": false,
  "outboundUnanswered": 0,
  "lastOutboundDate": "2026-08-21",
  "attempt": 1
}
```

`peers` liste **tous les autres brouillons du même run**. C'est ce qui empêche de
servir le même moule à deux destinataires le même jour, comme le 23/08 avec
Adetifa et Elnahif.

4. Lancer le contrôle mécanique :

```
node scripts/check-outreach-message.mjs --draft tmp/draft-<slug>.md --context tmp/ctx-<slug>.json --json
```

`FAIL` → corriger **uniquement les points cités**, incrémenter `attempt`,
relancer. Ne pas discuter le verdict, ne pas contourner le script.

5. `PASS` ou `WARN` → lancer le relecteur, **dans un sous-agent au contexte
   neuf**, avec le prompt de `docs/outreach-qa.md` §3. Lui transmettre seulement :
   le brouillon, le fil verbatim, l'intitulé de profil, l'extrait du registre
   correspondant aux chiffres cités, le rapport JSON. **Ne pas lui transmettre
   mon raisonnement, mes justifications ni mes essais précédents.**

6. `VERDICT: REECRIRE` → corriger les points cités, `attempt` +1, reprendre au 4.

7. **Essais 2 et 3 : corrections ciblées. Essai 4 : le critère est l'angle, pas
   le compteur.** Angle **rejeté** (relecteur en échec sur la question 11 gabarit
   ou 12 apport, ou même motif mécanique bloquant une 3e fois) → **réécriture
   depuis zéro** par un rédacteur au contexte neuf, qui reçoit le fil, le profil
   et le registre **mais pas le brouillon échoué**. Angle **validé** (11 et 12 en
   `PASS`) et clauses précises nommées par le relecteur → **correction ciblée**.
   Consigner le choix dans le journal du run. Échec au 4e essai → **`ABANDON`** :
   rien n'est publié ni mis en file sur ce fil ce run, le motif est consigné.

8. `VERDICT: ENVOYER` → **le sens dépend du canal.**
   - **Commentaire, note de connexion** : publication selon les règles navigateur
     habituelles (rendu réel relu, cible revérifiée dans le même appel JS que le
     clic).
   - **DM** : ⚠️ **ce verdict n'autorise pas l'envoi.** Il autorise la **mise en
     file d'attente de validation** dans `marketing/linkedin-contacts.md`, avec
     destinataire, texte intégral et les deux rapports. C'est David qui envoie.
     Notification push si la session tourne sans lui. Règle du 2026-07-23,
     étendue le 2026-08-19, **toujours en vigueur** — seul `CLAUDE.md` peut la
     lever.

   Puis journaliser dans `linkedin-contacts.md` :

```
QA: mécanique PASS (essai 2) | relecteur ENVOYER | faits cités: <outbreakIds> | registre du <date>
```

### Ce que le dispositif ne remplace pas

Le contrôle navigateur reste intégralement en place : piège de l'iframe, passage
par `/messaging/` plutôt que par le bouton « Message » du profil, bulles
flottantes à ne pas réutiliser, vérification du destinataire dans le même appel
JS que le clic. Le dispositif contrôle le **texte**, pas l'**envoi** — ni au sens technique, ni au sens de la décision : un verdict `ENVOYER` est un avis sur un texte, jamais une autorisation.

### Périmètre de commit

Ces routines possèdent `marketing/linkedin-contacts.md` et
`marketing/linkedin-candidates-tracker.md`. `marketing/qa/claimable-facts.json`
est régénéré à chaque run : **ne pas le committer** (l'ajouter à `.gitignore` s'il
ne l'est pas encore). `marketing/qa/lexicon.json` est versionné et n'appartient à
aucune routine : une routine qui veut y ajouter un terme le signale dans son
compte rendu, elle ne le modifie pas d'elle-même.
