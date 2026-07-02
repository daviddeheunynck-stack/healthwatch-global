# Emails institutionnels — Vague 3 — 7–11 juillet 2026

**À envoyer entre le 7 et 11 juillet** — 12–16 jours après le lancement PH.  
**Hook :** métriques J+12 depuis Supabase + dashboard PH (pas "just launched" — trop loin ; écrire "two weeks in" ou "depuis le lancement").  
**Recherche LinkedIn :** 30 min le matin du 7 juillet — même protocole que Vague 1 et 2.

---

## Contacts — état

| # | Institution | Contact | Email | Statut |
|---|---|---|---|---|
| 1 | Oxfam International | Health Manager / Emergency Health Advisor | `first.last@oxfam.org` ou `first.last@oxfaminternational.org` | 🔍 LinkedIn |
| 2 | CARE International | Senior Health Advisor / Health Specialist | `first.last@care-international.org` | 🔍 LinkedIn |
| 3 | Samaritan's Purse | Senior Field Epidemiologist / Medical Director | `first.last@samaritanspurse.org` | 🔍 LinkedIn |
| 4 | World Vision International | Health Specialist / Senior Health Officer | `first.last@worldvision.org` | 🔍 LinkedIn |

**Recherches LinkedIn :**
- Oxfam : "Oxfam" + "health" + "emergency" ou "humanitarian" → Health Manager, Emergency Health Coordinator
- CARE : "CARE International" + "health" + "advisor" ou "epidemiology" → Senior Health Advisor, Health Specialist
- Samaritan's Purse : "Samaritan's Purse" + "epidemiologist" ou "medical" ou "field" → Field Epidemiologist, Medical Director
- World Vision : "World Vision" + "health" + "specialist" ou "outbreak" → Health Specialist, Senior Health Advisor

---

## Email 1 — Oxfam International

**À :** [first.last@oxfam.org — nom trouvé sur LinkedIn]  
**Objet :** HealthWatch Global — WHO DON + ECDC + PAHO + Africa CDC consolidated for humanitarian health teams

---

Hi [First name],

Two weeks since we launched HealthWatch Global — [X] signups, including teams from WHO, public health ministries, and field NGOs. A real-time dashboard aggregating WHO DON, ECDC, PAHO, and Africa CDC with automated IHR risk scoring (IMMEDIATE / RAPID / SURVEILLANCE) across 5 languages.

For Oxfam's emergency health teams operating in Yemen, DRC, Sudan, and other high-burden contexts, HealthWatch gives your epidemiologists a consolidated view of active outbreak signals — one source replacing four browser tabs, updated 4x/day, with email alerts by country and disease.

We're offering a 30-day institutional pilot: 5 seats, full onboarding — €250/month if your team wants to continue. No procurement required to start.

Direct link to current Cholera surveillance in your active zones:
healthwatch-global.com/en/disease/cholera

Best,
David Deheunynck
HealthWatch Global — healthwatch-global.com

---

## Email 2 — CARE International

**À :** [first.last@care-international.org — nom trouvé sur LinkedIn]  
**Objet :** HealthWatch Global — WHO + ECDC + PAHO + Africa CDC in one dashboard for field health teams

---

Hi [First name],

Two weeks since we launched HealthWatch Global — [X] signups from WHO teams, public health ministries, and humanitarian organizations. A real-time dashboard consolidating WHO DON, ECDC, PAHO, and Africa CDC with automated IHR risk classification across 5 languages.

For CARE's health teams in Sudan, Ethiopia, Bangladesh, and other crisis contexts, HealthWatch consolidates the surveillance work your epidemiologists do across four separate portals — one classified view, alerts by country and disease, updated every 4 hours.

We're offering a 30-day institutional pilot: 5 seats, full onboarding — €250/month if your team wants to continue. No procurement required to start.

Direct link to current Cholera and Mpox surveillance:
healthwatch-global.com/en/disease/cholera

Best,
David Deheunynck
HealthWatch Global — healthwatch-global.com

---

## Email 3 — Samaritan's Purse

**À :** [first.last@samaritanspurse.org — nom trouvé sur LinkedIn]  
**Objet :** HealthWatch Global — IHR-classified outbreak monitoring for field medical teams

---

Hi [First name],

Two weeks since we launched HealthWatch Global — [X] signups, including epidemiologists and humanitarian health teams. A real-time dashboard consolidating WHO DON, ECDC, PAHO, and Africa CDC with automated IHR risk scoring (IMMEDIATE / RAPID / SURVEILLANCE based on Articles 6, 9 and 12) in 5 languages.

For Samaritan's Purse field medical teams in DRC, CAR, Ukraine, and other active deployments, HealthWatch gives your medical coordinators one consolidated alert feed — strain, CFR trajectory, affected health zones — without the cross-referencing overhead across four official portals.

We're offering a 30-day institutional pilot: 5 seats, full onboarding — €250/month if your team wants to continue. No procurement required to start.

Direct link to current Ebola Bundibugyo PHEIC and Mpox signals in DRC:
healthwatch-global.com/en/disease/ebola-virus-disease

Best,
David Deheunynck
HealthWatch Global — healthwatch-global.com

---

## Email 4 — World Vision International

**À :** [first.last@worldvision.org — nom trouvé sur LinkedIn]  
**Objet :** HealthWatch Global — consolidated WHO + ECDC + PAHO outbreak alerts for health teams in the field

---

Hi [First name],

Two weeks since we launched HealthWatch Global — [X] signups from public health teams across WHO, ministries of health, and international NGOs. A real-time dashboard aggregating WHO DON, ECDC, PAHO, and Africa CDC with automated IHR risk classification in 5 languages.

For World Vision's health specialists operating across Sub-Saharan Africa, Southeast Asia, and Latin America, HealthWatch gives your team one consolidated source for active outbreak signals — country-level alerts, IHR tier classification, updated every 4 hours, replacing four manual checks daily.

We're offering a 30-day institutional pilot: 5 seats, full onboarding — €250/month if your team wants to continue. No procurement required to start.

Direct link to current Dengue and Cholera surveillance in your active regions:
healthwatch-global.com/en/disease/dengue-fever

Best,
David Deheunynck
HealthWatch Global — healthwatch-global.com

---

## Récapitulatif placeholders

| Placeholder | Source | Quand disponible |
|---|---|---|
| `[X] signups` | Supabase dashboard | 7 juillet matin |
| `[First name]` (×4) | LinkedIn — 30 min de recherche | 7 juillet matin |

**Compte signups au 2 juillet 2026 : 17 utilisateurs (7 Pro, 10 Free).**
À vérifier le 7 juillet matin via Supabase. Utiliser le chiffre exact de ce jour-là.

**Note données Choléra :** Au 2 juillet, toutes les entrées choléra sont `active=false` (dernière : Haïti, 24 mai, 28 500 cas). La page `/en/disease/cholera` montre des données historiques mais aucun foyer "actif". Le libellé "current Cholera surveillance" reste valide (surveillance = capacité, pas forcément foyer actif), mais vérifier avec WHO/PAHO avant d'envoyer si une reprise récente existe. Alternative : pointer vers `/en/disease/mpox-monkeypox` (DRC, 37 503 cas — actif) ou `/en/outbreak/[id-ebola-drc]` pour Oxfam/CARE opérant en zones touchées.

Note : à J+12-16, ne pas écrire "just launched" — utiliser "two weeks in" ou "since our launch on June 25."

---

## Relance J+10 — 17–21 juillet 2026

Une seule ligne de relance, jamais deux :

- **EN :** "Hi [First name], just following up on my note from last week — happy to activate your pilot access if it would be useful for your team."

---

## Ordre d'envoi suggéré

1. Oxfam (7 juillet) — plus grand reach, prioriser
2. CARE (8 juillet)
3. World Vision (9 juillet)
4. Samaritan's Purse (11 juillet) — profil un peu différent (évangélique), envoyer en dernier
