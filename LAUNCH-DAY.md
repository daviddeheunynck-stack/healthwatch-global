# Checklist Lancement — 25 juin 2026

Ouvre ce fichier le matin du 25. Exécute dans l'ordre.

---

## 09h00 — PH est live

### 1. Récupérer l'URL PH
La page Product Hunt est accessible. Copie l'URL (ex: `https://www.producthunt.com/posts/healthwatch-global`).

### 2. Mettre à jour le code (avec Claude)
Deux fichiers à modifier :
- `components/PHLaunchBar.tsx` ligne 8 — remplacer l'URL placeholder par l'URL réelle
- `lib/ph-launch-email.ts` ligne 2 — idem
→ Push sur master

### 3. Dry run email blast
Aller sur `/fr/admin` → bouton broadcast → ajouter `?dry=1` à l'URL pour preview.
Vérifier que la liste exclut bien les comptes test.

---

## 09h30 — Activation simultanée

### 4. Email blast
`/fr/admin` → bouton broadcast (sans `?dry=1` cette fois). Envoi à ~6 vrais utilisateurs.

### 5. Thread X — @HWatchGlobal
Poster le thread suivant (3 tweets) :

**Tweet 1**
> We spent 2 years watching epidemiologists check 4 sources manually every morning.
>
> WHO DON. ECDC. PAHO. Africa CDC. One by one.
>
> Not because they wanted to. Because there was no other way.

**Tweet 2**
> Today we fix that.
>
> HealthWatch Global is live: one dashboard, all four feeds, automated IHR tier classification — updated 4x/day.
>
> Built for the people who can't afford to miss an early signal.

**Tweet 3**
> Launching on Product Hunt today 👇
>
> [URL PH]
>
> Free 30-day Pro access for field epidemiologists and IHR focal points. No card required.

### 6. Maker comment PH
Poster immédiatement comme premier commentaire sur la page PH :

> Hi Product Hunt 👋
>
> I'm David — a product engineer, not an epidemiologist.
>
> A few years ago I started tracking outbreak news closely and realized the people who need this most — field epidemiologists, IHR focal points, NGO responders — were manually checking WHO DON, ECDC, PAHO, and Africa CDC *one by one*, every morning. No aggregation. No risk scoring. No single view.
>
> HealthWatch Global fixes that: one dashboard, all major surveillance feeds, automated IHR classification, real-time trend indicators, and country-level filtering. Built for global health professionals who can't afford to miss an early signal.
>
> Launched today as a solo founder. If you work in public health or infectious disease research — feedback is extremely valuable at this stage. Pro access is free for 30 days, no card required.
>
> Ask me anything — data sources, methodology, why I built this outside academia.

### 7. Messages activation réseau personnel
Envoyer ce message à 20-30 contacts LinkedIn (ex-collègues tech, amis) :

> Hey [prénom], je lance HealthWatch Global aujourd'hui sur Product Hunt — un dashboard de surveillance épidémio mondiale que j'ai construit en solo cette année.
>
> Si tu as 30 secondes : [URL PH]
>
> Ça m'aide beaucoup, merci 🙏

### 8. Emails institutionnels (8 emails)
Envoyer les emails préparés dans `marketing/outreach-contacts.md` :
- Molla Godif — Africa CDC (LinkedIn InMail)
- Fadia Bejja — Ministère Santé Maroc (LinkedIn InMail)
- Kevin Martel Vásquez — MINSA Pérou (LinkedIn InMail)
- Sam Abbott — LSHTM — Sam.Abbott@lshtm.ac.uk
- Dr Mamadou Aliou Barry — IPD Dakar — aliou.barry@pasteur.sn
- Prof. Lê Văn Tấn — OUCRU — tanlv@oucru.org
- Robert L. — WHO AFRO (LinkedIn)
- Lilian Mayieka — KEMRI (vérifier email sur kemri.go.ke/km-rd-staff-profiles)

---

## 10h00 — Post LinkedIn
Créer le post LinkedIn avec Claude (session ouverte).

## 10h00 — Post Reddit
Poster sur r/SideProject et r/publichealth (texte dans `marketing/content-log.md`).

---

## Toute la journée
- Répondre aux commentaires PH dans les 30 minutes
- Surveiller les sign-ups dans `/fr/admin`
- Si < 30 votes à 12h → relancer sur Twitter

---

## Contacts à activer pour Zahra BOUZIDI
Quand elle répond → activer Pro 30 jours : `plan = "pro"` dans la DB via le panel admin.

---

## Notes importantes
- Ne pas committer `.env*` ni clés API
- Dry run email blast AVANT l'envoi réel
- ProMED : source interdite (C&D reçu 2026-06-06)
