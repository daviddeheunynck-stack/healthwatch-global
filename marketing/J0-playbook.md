# Playbook J-0 — 25 juin 2026

**Lancement PH :** 00h01 PST = 09h01 CEST  
**Ordre des actions :** séquentiel — ne pas sauter d'étape

---

## ⚠️ DÉCISION À PRENDRE AVANT DEMAIN MATIN

### Maker comment PH — quelle version ?

**Version A** (ph-launch-content.md — courte, "validée") :
> Most public health teams monitor outbreaks the same way: WHO DON bookmarked in one tab, ECDC in another, PAHO somewhere in their inbox. The signal arrives. The window to act is already closing.
>
> I built HealthWatch Global to fix that.
>
> It brings WHO, ECDC, PAHO and Africa CDC into one unified, real-time view — with automated IHR risk scoring (Articles 6, 9, 12) so your team knows what to prioritize from the moment the alert lands.
>
> 195 countries · 5 languages · 4 official sources · Free tier available today.
>
> Happy to answer questions from anyone working in outbreak response, NGOs, or health ministries — this is day one, and your feedback shapes what comes next.

**Version B** (content-log.md lignes 369-380 — plus longue, mention Pasteur Maroc + framing anti-GPHIN) :
> I built this after watching an Ebola alert in Central Africa sit simultaneously in three separate RSS feeds — while the field coordination team had none of them in their workflow.
>
> Most public health teams don't have access to GPHIN, the WHO-affiliated surveillance network (~$50K+/year). They're left cross-referencing WHO DON, ECDC, PAHO and Africa CDC manually in four browser tabs.
>
> HealthWatch Global unifies all four in real time — automated IHR risk scoring based on published RSI criteria (Art. 6, 9, 12), 5 languages including Arabic and Indonesian, regional filters, and a 30-day institutional pilot for teams that need DPA + SLA before committing.
>
> One early signal I'm proud of: a researcher at Institut Pasteur Morocco signed up without any outreach from us. That's exactly the profile we built this for.
>
> What it doesn't do: replace official WHO determinations. The scoring helps your team triage, not declare a PHEIC.
>
> Free account, no credit card. Ask me anything about data sources, IHR methodology, or running a pilot 👇

**Recommandation :** Version B — plus de texture, la mention Pasteur est du social proof concret, le framing GPHIN cadre le marché immédiatement. Version A si tu veux jouer safe.

---

## CETTE NUIT / CE MATIN TÔT

- [ ] **Poster le post LinkedIn Ebola Bundibugyo** (écrit dans content-log.md ligne 153) — si pas encore fait aujourd'hui 24 juin

---

## BLOC 1 — 08h30–09h00 (avant le lancement)

### 1.1 — Métriques PH
- Aller sur Product Hunt > votre tableau de bord
- Relever : nombre de votes, heure du premier vote (pour savoir si ça tourne)

### 1.2 — Métriques signups (Supabase)
```sql
SELECT COUNT(*) FROM profiles WHERE created_at >= '2026-06-25T00:00:00Z';
```
Ou : Supabase Dashboard > Table Editor > profiles > filter `created_at >= aujourd'hui`

### 1.3 — Recherche LinkedIn — 7 contacts manquants (~30 min)

| Email | Recherche LinkedIn |
|---|---|
| Email 4 — Africa CDC | "Africa CDC" + "surveillance" + "Technical Officer" → priorité : Health Security Dept |
| Email 5 — Maroc DELM | "Ministère Santé Maroc" + "épidémiologie" + "RSI" ou "point focal" |
| Email 6 — Sénégal DSIS | "DSIS Sénégal" ou "Division Surveillance" + "Ministère Santé Sénégal" |
| Email 9 — LSHTM | "LSHTM" + "outbreak response" ou "field epidemiology" → "Oliver Brady" déjà identifié (oliver-brady-634692a4) |
| Email 10 — Pasteur CI/SN | "Institut Pasteur" + "Côte d'Ivoire" ou "Sénégal" + épidémiologiste |
| Email 12 — OUCRU | "OUCRU" + "epidemiology" ou "infectious disease" (Oxford Clinical Research Unit Vietnam) |
| Email 7 — Kemenkes | LinkedIn DM → chercher "Achmad Farchanny" directement |

**Note LSHTM :** Oliver Brady (oliver-brady-634692a4) est déjà dans linkedin-contacts.md. Son email format : `o.brady@lshtm.ac.uk`

---

## BLOC 2 — 09h01 CEST — Code (2 min)

**Trouver le slug du post** : aller sur le post PH live → copier l'URL exacte (format : `https://www.producthunt.com/posts/healthwatch-global` ou variante)

**Modifier 2 fichiers :**

`components/PHLaunchBar.tsx` ligne 7 :
```ts
// Remplacer :
const PH_URL = "https://www.producthunt.com/products/healthwatch-global";
// Par :
const PH_URL = "https://www.producthunt.com/posts/[slug-exact]";
```

`lib/ph-launch-email.ts` ligne 1 :
```ts
// Remplacer :
const PH_URL = "https://www.producthunt.com/products/healthwatch-global";
// Par :
const PH_URL = "https://www.producthunt.com/posts/[slug-exact]";
```

**Commit & push :**
```bash
git add components/PHLaunchBar.tsx lib/ph-launch-email.ts
git commit -m "feat: update PH URL to live post"
git push origin master
```
Vercel déploie en ~2 min — la barre rouge s'affiche sur le site avec le bon lien.

---

## BLOC 3 — 09h01 — Maker comment PH

Aller sur le post PH > "Leave a comment" > coller la version choisie (A ou B ci-dessus).

---

## BLOC 4 — 09h05 — Broadcast email (utilisateurs existants)

Déclencher la route `/api/admin/broadcast-launch` :

**Option 1 — Via l'interface admin** (si bouton dans `/fr/admin`) : cliquer "Envoyer email de lancement"

**Option 2 — Via terminal/Postman** :
```bash
curl -X POST https://healthwatch-global.com/api/admin/broadcast-launch \
  -H "Content-Type: application/json" \
  -H "Cookie: [coller cookie de session admin]"
```

L'email utilise la PH_URL de `lib/ph-launch-email.ts` — d'où l'importance de le modifier AVANT (Bloc 2).

---

## BLOC 5 — 09h15 — DMs LinkedIn

**DM Arran Hamlet** (linkedin-contacts.md ligne 61) :
> Arran, merci d'avoir accepté la connexion.
>
> On lance officiellement HealthWatch Global sur Product Hunt ce matin — si tu as 2 minutes pour y jeter un œil, ça m'aide et ça pourrait être utile pour ton travail EPR terrain : [URL PH]
>
> Si tu veux tester le dashboard sur les données DRC/Uganda, je t'ouvre un accès Pro direct.

**DM Feydeau BOTON** :
> [URL PH] — HealthWatch Global est live sur Product Hunt ce matin. Si tu as 30 secondes 🙏

**DM réseau personnel (~20-40 contacts)** (template content-log.md ligne 318) :
> Hey [prénom], je lance HealthWatch Global aujourd'hui sur Product Hunt — un dashboard de surveillance épidémio mondiale que j'ai construit en solo cette année.
>
> Si tu as 30 secondes : [URL PH]
>
> Ça m'aide beaucoup, merci 🙏

Contacts réseau pour DM : voir linkedin-contacts.md — liste des 35 profils section "Réseau personnel"

---

## BLOC 6 — 09h30 — Thread X @HWatchGlobal

(content-log.md lignes 74-95 — 3 tweets)

Tweet 1 :
> We spent 2 years watching epidemiologists check 4 sources manually every morning.
>
> WHO DON. ECDC. PAHO. Africa CDC. One by one.
>
> Not because they wanted to. Because there was no other way.

Tweet 2 :
> Today we fix that.
>
> HealthWatch Global is live: one dashboard, all four feeds, automated IHR tier classification — updated 4x/day.
>
> Built for the people who can't afford to miss an early signal.

Tweet 3 :
> Launching on Product Hunt today 👇
>
> [URL PH]
>
> Free 30-day Pro access for field epidemiologists and IHR focal points. No card required.

---

## BLOC 7 — 10h00 — Post LinkedIn

(content-log.md lignes 211-231 — post lancement PH)

Insérer l'URL PH à la ligne 228 : `Si vous avez une minute aujourd'hui : [URL PH — à insérer]`

---

## BLOC 8 — 10h30 — Emails institutionnels (12)

**Pré-envoi :**
1. Remplir `[X votes]` et `[Y signups]` dans chaque email
2. Remplir les 7 `[First name]` / `[Prénom]` trouvés sur LinkedIn (Bloc 1.3)
3. Règle : si votes < 50, supprimer la ligne métriques de l'objet

**Ordre d'envoi :**
1. WHO AFRO → `gueyea@who.int` (Abdou Salam)
2. WHO EMRO → `brennanr@who.int` (Rick)
3. PAHO → `ugartec@paho.org` (Ciro) — EN ESPAGNOL
4. Africa CDC → [email LinkedIn]
5. Maroc DELM → [email LinkedIn] — NE PAS lier à Jalal
6. Sénégal DSIS → [email LinkedIn]
7. Kemenkes → LinkedIn DM (Achmad Farchanny) ou formulaire
8. GOARN → `goarn@who.int`
9. LSHTM → `o.brady@lshtm.ac.uk` (Oliver)
10. Pasteur CI/SN → [email LinkedIn]
11. KEMRI → `director@kemri.go.ke`
12. OUCRU → [email LinkedIn]

**Templates complets :** voir `institutional-emails-25juin.md`

---

## BLOC 9 — Journée — Monitoring & réponses PH

Répondre aux commentaires PH dans les 20 min : templates dans content-log.md lignes 383-428

Questions courantes préparées :
- "How is this different from WHO's own tools?" ✓
- "Where does the data come from?" ✓
- "Is the IHR scoring validated?" ✓
- "What about ProMED?" ✓ *(Note : comparer en compétitif OK, ne pas utiliser leurs données)*
- "I could build this in a weekend with n8n" ✓
- "What's the business model?" ✓

---

## Indie Hackers

Insérer l'URL PH dans le post IH (content-log.md ligne 129) et publier si pas encore fait.

---

## BLOC 10 — Fin de journée

- [ ] Compter votes PH + signups
- [ ] Mettre à jour content-log.md avec les résultats
- [ ] Préparer relance J+10 (5 juillet) — template dans project_institutional_outreach.md ligne 189

---

## Vague 2 emails — 30 juin 2026

À préparer cette semaine (voir cold-outreach.md) :
- Segment B Top 5 : MSF/Epicentre, IRC, PIH, ACF, IMC
- Segment A bottom 4 : JHU, Harvard, INSP, IRD
- 9 emails total
