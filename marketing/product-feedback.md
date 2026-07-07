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
2. **Signal de fluctuation/variance dans les séries temporelles** (l'angle vraiment intéressant, identifié comme tel par David) : surveiller l'augmentation de la variance elle-même (ou une stabilité anormale) avant un basculement, plutôt que le niveau de la série — proche du concept de "ralentissement critique" (critical slowing down) en théorie des systèmes adaptatifs complexes. Question technique posée en retour : est-ce calculable sur nos séries de comptages de cas existantes, ou faut-il un type de données différent ? Réponse en attente.

**Statut :** conversation en cours, pas encore priorisé côté développement. Piste méthodologique à explorer si la réponse technique de Simon confirme la faisabilité sur nos données actuelles.

---

## Modèle d'entrée

```
## [date] — [Nom du contact] ([rôle/institution])

**Contexte :** [qui est ce contact, pourquoi son avis compte]

**Retour :** [ce qui est demandé/signalé, aussi précis que possible]

**Statut :** [reçu / accusé de réception envoyé / en cours / implémenté / écarté + raison]
```
