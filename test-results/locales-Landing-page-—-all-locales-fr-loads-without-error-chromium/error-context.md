# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: locales.spec.ts >> Landing page — all locales >> /fr loads without error
- Location: e2e\locales.spec.ts:11:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('HealthWatch')
Expected: visible
Error: strict mode violation: getByText('HealthWatch') resolved to 5 elements:
    1) <span class="font-bold text-lg text-white">HealthWatch Global</span> aka getByRole('navigation').filter({ hasText: 'HealthWatch GlobalTableau de' }).locator('span')
    2) <p class="text-gray-400 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">Un foyer non détecté à temps peut coûter à votre …</p> aka getByText('Un foyer non détecté à temps')
    3) <p class="text-gray-400 max-w-2xl mx-auto leading-relaxed">La plupart des organisations de santé l'apprennen…</p> aka getByText('La plupart des organisations')
    4) <span class="font-semibold text-gray-400">HealthWatch Global</span> aka getByRole('contentinfo').getByText('HealthWatch Global')
    5) <a href="mailto:contact@healthwatch-global.com" class="hover:text-gray-300 transition-colors hidden md:inline">contact@healthwatch-global.com</a> aka getByRole('link', { name: 'contact@healthwatch-global.com' })

Call log:
  - Expect "toBeVisible" with timeout 8000ms
  - waiting for getByText('HealthWatch')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - navigation [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - img [ref=e5]
        - generic [ref=e7]: HealthWatch Global
      - generic [ref=e8]:
        - link "Tableau de bord" [ref=e9] [cursor=pointer]:
          - /url: /fr
          - img [ref=e10]
          - text: Tableau de bord
        - link "Alertes" [ref=e12] [cursor=pointer]:
          - /url: /fr/alerts
          - img [ref=e13]
          - text: Alertes
        - link "Compare" [ref=e16] [cursor=pointer]:
          - /url: /fr/compare
          - img [ref=e17]
          - text: Compare
        - link "Rapports" [ref=e20] [cursor=pointer]:
          - /url: /fr/reports
          - img [ref=e21]
          - text: Rapports
        - link "Tarifs" [ref=e24] [cursor=pointer]:
          - /url: /fr/pricing
          - img [ref=e25]
          - text: Tarifs
        - link "Contact" [ref=e27] [cursor=pointer]:
          - /url: /fr/contact
          - img [ref=e28]
          - text: Contact
      - generic [ref=e31]:
        - generic [ref=e32]:
          - img [ref=e33]
          - button "FR" [ref=e36]
          - button "EN" [ref=e37]
          - button "ES" [ref=e38]
          - button "AR" [ref=e39]
          - button "ID" [ref=e40]
        - generic [ref=e42]:
          - link "Se connecter" [ref=e43] [cursor=pointer]:
            - /url: /fr/login
          - link "Créer un compte" [ref=e44] [cursor=pointer]:
            - /url: /fr/signup
  - main [ref=e45]:
    - generic [ref=e46]:
      - generic [ref=e48]:
        - generic [ref=e49]: Données OMS en direct · 195 pays · Mis à jour quotidiennement
        - heading "Anticipez les épidémies. Ne réagissez plus." [level=1] [ref=e51]:
          - text: Anticipez les épidémies.
          - text: Ne réagissez plus.
        - paragraph [ref=e52]: Un foyer non détecté à temps peut coûter à votre organisation des semaines de crise. HealthWatch Global livre à vos équipes des données en avance sur les événements — directement depuis l'OMS.
        - generic [ref=e53]:
          - link "Créer un compte gratuit" [ref=e54] [cursor=pointer]:
            - /url: /fr/signup
            - text: Créer un compte gratuit
            - img [ref=e55]
          - link "Voir les tarifs" [ref=e57] [cursor=pointer]:
            - /url: /fr/pricing
        - paragraph [ref=e58]: Gratuit · Sans carte bancaire
        - generic [ref=e59]:
          - generic [ref=e60]:
            - img [ref=e61]
            - paragraph [ref=e63]: "36"
            - paragraph [ref=e64]: foyers actifs
          - generic [ref=e65]:
            - img [ref=e66]
            - paragraph [ref=e69]: "27"
            - paragraph [ref=e70]: pays touchés
          - generic [ref=e71]:
            - img [ref=e72]
            - paragraph [ref=e74]: "15"
            - paragraph [ref=e75]: alertes haut risque
          - generic [ref=e76]:
            - img [ref=e77]
            - paragraph [ref=e80]: Mis à jour quotidiennement
      - generic [ref=e81]:
        - generic [ref=e82]:
          - heading "L'OMS déclare 15 à 25 nouveaux foyers chaque mois." [level=2] [ref=e83]
          - paragraph [ref=e84]: La plupart des organisations de santé l'apprennent trop tard — après que les médias locaux en aient parlé, après que les équipes terrain aient signalé les premiers cas. HealthWatch Global renverse ce délai.
        - generic [ref=e85]:
          - generic [ref=e86]:
            - paragraph [ref=e87]: 15–25
            - paragraph [ref=e88]: nouveaux foyers OMS / mois
          - generic [ref=e89]:
            - paragraph [ref=e90]: 72h
            - paragraph [ref=e91]: délai moyen avant détection terrain
          - generic [ref=e92]:
            - paragraph [ref=e93]: × 10
            - paragraph [ref=e94]: coût d'une crise réactive vs anticipée
      - generic [ref=e95]:
        - generic [ref=e96]:
          - generic [ref=e97]:
            - img [ref=e98]
            - text: En direct
          - heading "Ce que vos équipes verront en temps réel" [level=2] [ref=e104]
          - paragraph [ref=e105]: Les données ci-dessous sont réelles et actualisées depuis l'API WHO Disease Outbreak News.
        - generic [ref=e106]:
          - table [ref=e107]:
            - rowgroup [ref=e108]:
              - row "Maladie Pays Risque" [ref=e109]:
                - columnheader "Maladie" [ref=e110]
                - columnheader "Pays" [ref=e111]
                - columnheader "Risque" [ref=e112]
                - columnheader [ref=e113]
            - rowgroup [ref=e114]:
              - row "Choléra Haïti Élevé 28 500 cas" [ref=e115]:
                - cell "Choléra" [ref=e116]
                - cell "Haïti" [ref=e117]
                - cell "Élevé" [ref=e118]
                - cell "28 500 cas" [ref=e119]:
                  - generic [ref=e120]: 28 500 cas
              - row "Dengue Brésil Élevé 6 200 000 cas" [ref=e121]:
                - cell "Dengue" [ref=e122]
                - cell "Brésil" [ref=e123]
                - cell "Élevé" [ref=e124]
                - cell "6 200 000 cas" [ref=e125]:
                  - generic [ref=e126]: 6 200 000 cas
              - row "Mpox (variole du singe) République démocratique du Congo Élevé 19 845 cas" [ref=e127]:
                - cell "Mpox (variole du singe)" [ref=e128]
                - cell "République démocratique du Congo" [ref=e129]
                - cell "Élevé" [ref=e130]
                - cell "19 845 cas" [ref=e131]:
                  - generic [ref=e132]: 19 845 cas
              - row "Maladie à virus Ebola RD Congo Élevé 746 cas" [ref=e133]:
                - cell "Maladie à virus Ebola" [ref=e134]
                - cell "RD Congo" [ref=e135]
                - cell "Élevé" [ref=e136]
                - cell "746 cas" [ref=e137]:
                  - generic [ref=e138]: 746 cas
              - row "Choléra Éthiopie Élevé 8 320 cas" [ref=e139]:
                - cell "Choléra" [ref=e140]
                - cell "Éthiopie" [ref=e141]
                - cell "Élevé" [ref=e142]
                - cell "8 320 cas" [ref=e143]:
                  - generic [ref=e144]: 8 320 cas
          - generic [ref=e145]:
            - generic [ref=e146]: "Source : WHO Disease Outbreak News"
            - link "Créer un compte gratuit →" [ref=e147] [cursor=pointer]:
              - /url: /fr/signup
      - generic [ref=e148]:
        - heading "Tout ce dont votre équipe a besoin" [level=2] [ref=e149]
        - generic [ref=e150]:
          - generic [ref=e151]:
            - img [ref=e153]
            - heading "Alertes par maladie" [level=3] [ref=e156]
            - paragraph [ref=e157]: Abonnez-vous à H5N1, Ebola, Mpox… Recevez un email en moins de 6h dès qu'un foyer est détecté n'importe où dans le monde.
          - generic [ref=e158]:
            - img [ref=e160]
            - heading "Badge PHEIC & corroboration" [level=3] [ref=e166]
            - paragraph [ref=e167]: Le badge 🚨 PHEIC apparaît sur chaque urgence sanitaire internationale déclarée par l'OMS. 🔁 WHO+ProMED confirme les foyers multi-sources.
          - generic [ref=e168]:
            - img [ref=e170]
            - heading "Taux de létalité & incidence" [level=3] [ref=e173]
            - paragraph [ref=e174]: CFR calculé automatiquement. Incidence pour 100 000 habitants — données de population ONU intégrées pour 150 pays.
          - generic [ref=e175]:
            - img [ref=e177]
            - heading "Comparaison de foyers" [level=3] [ref=e180]
            - paragraph [ref=e181]: "Ebola RDC 2026 vs Uganda : cas, décès, CFR, incidence côte à côte. Partagez l'URL directement avec vos collègues."
          - generic [ref=e182]:
            - img [ref=e184]
            - heading "Watchlist & notifications" [level=3] [ref=e187]
            - paragraph [ref=e188]: Suivez ⭐ jusqu'à 20 foyers spécifiques. Notification automatique par email dès que les chiffres changent.
          - generic [ref=e189]:
            - img [ref=e191]
            - heading "PDF one-pager & widget" [level=3] [ref=e193]
            - paragraph [ref=e194]: Rapport PDF professionnel par foyer en 1 clic. Widget embarquable pour votre site. PNG partageable pour WhatsApp et Slack.
      - generic [ref=e195]:
        - heading "Opérationnel en 3 minutes" [level=2] [ref=e196]
        - generic [ref=e197]:
          - generic [ref=e198]:
            - generic [ref=e199]: "1"
            - generic [ref=e200]:
              - heading "Créez votre compte" [level=3] [ref=e201]
              - paragraph [ref=e202]: Inscription en 30 secondes. Aucune carte bancaire requise. Accès immédiat au tableau de bord.
          - generic [ref=e203]:
            - generic [ref=e204]: "2"
            - generic [ref=e205]:
              - heading "Configurez vos régions" [level=3] [ref=e206]
              - paragraph [ref=e207]: Sélectionnez les zones géographiques que vous surveillez et recevez votre premier digest dès la semaine suivante.
          - generic [ref=e208]:
            - generic [ref=e209]: "3"
            - generic [ref=e210]:
              - heading "Passez Pro pour les alertes temps réel" [level=3] [ref=e211]
              - paragraph [ref=e212]: Débloquez le flux en direct, les rapports PDF et l'export CSV — et restez en avance sur chaque crise.
      - generic [ref=e213]:
        - paragraph [ref=e214]: Conçu pour
        - generic [ref=e215]:
          - generic [ref=e216]:
            - img [ref=e218]
            - paragraph [ref=e220]: Ministères de la Santé
          - generic [ref=e221]:
            - img [ref=e223]
            - paragraph [ref=e225]: ONG Internationales
          - generic [ref=e226]:
            - img [ref=e228]
            - paragraph [ref=e232]: Instituts de Recherche
          - generic [ref=e233]:
            - img [ref=e235]
            - paragraph [ref=e239]: Hôpitaux & Cliniques
      - generic [ref=e240]:
        - heading "Commencez gratuitement. Évoluez quand vous en avez besoin." [level=2] [ref=e241]
        - generic [ref=e242]:
          - generic [ref=e243]:
            - generic [ref=e244]:
              - img [ref=e245]
              - generic [ref=e248]: Gratuit
            - paragraph [ref=e249]: 0 €
            - paragraph [ref=e250]: Carte mondiale · 1 région · Digest hebdo
          - generic [ref=e251]:
            - generic [ref=e252]:
              - img [ref=e253]
              - generic [ref=e255]: Pro
            - paragraph [ref=e256]: 49 € /mois
            - paragraph [ref=e257]: Toutes régions · Alertes · PDF · CSV · Slack
          - generic [ref=e258]:
            - generic [ref=e259]:
              - img [ref=e260]
              - generic [ref=e262]: Enterprise
            - paragraph [ref=e263]: Sur devis
            - paragraph [ref=e264]: API · On-premise · SLA 99,9 %
        - link "Voir tous les tarifs →" [ref=e266] [cursor=pointer]:
          - /url: /fr/pricing
      - generic [ref=e267]:
        - generic [ref=e268]:
          - heading "Restez informé — gratuitement" [level=2] [ref=e269]
          - paragraph [ref=e270]: Le digest hebdomadaire des foyers actifs, filtré par région, directement dans votre boîte mail.
        - generic [ref=e271]:
          - generic [ref=e272]:
            - textbox "votre@organisation.com" [ref=e273]
            - combobox "Région" [ref=e274]:
              - option "Toutes les régions" [selected]
              - option "Afrique"
              - option "Asie"
              - option "Europe"
              - option "Amériques"
              - option "Océanie"
            - button "S'abonner" [ref=e275]:
              - img [ref=e276]
              - text: S'abonner
          - paragraph [ref=e279]: Gratuit · Sans carte bancaire · Désabonnement en 1 clic
      - generic [ref=e281]:
        - generic [ref=e282]:
          - img [ref=e284]
          - img [ref=e289]
          - img [ref=e292]
        - heading "Votre organisation est-elle prête pour la prochaine épidémie ?" [level=2] [ref=e296]
        - paragraph [ref=e297]: Rejoignez les équipes qui suivent les crises sanitaires mondiales en temps réel.
        - generic [ref=e298]:
          - link "Démarrer gratuitement" [ref=e299] [cursor=pointer]:
            - /url: /fr/signup
            - text: Démarrer gratuitement
            - img [ref=e300]
          - paragraph [ref=e302]: Sans carte bancaire · Accès immédiat
  - contentinfo [ref=e303]:
    - generic [ref=e305]:
      - generic [ref=e306]:
        - img [ref=e307]
        - generic [ref=e309]: HealthWatch Global
        - generic [ref=e310]: ·
        - generic [ref=e311]: © 2026
      - navigation [ref=e312]:
        - link "À propos" [ref=e313] [cursor=pointer]:
          - /url: /fr/about
        - link "Politique de confidentialité" [ref=e314] [cursor=pointer]:
          - /url: /fr/privacy
        - link "CGU" [ref=e315] [cursor=pointer]:
          - /url: /fr/terms
        - link "Mentions légales" [ref=e316] [cursor=pointer]:
          - /url: /fr/legal
        - link "Contact" [ref=e317] [cursor=pointer]:
          - /url: /fr/contact
        - link "contact@healthwatch-global.com" [ref=e318] [cursor=pointer]:
          - /url: mailto:contact@healthwatch-global.com
        - button "Paramètres cookies" [ref=e319]
  - button "Open Next.js Dev Tools" [ref=e325] [cursor=pointer]:
    - img [ref=e326]
  - alert [ref=e329]
  - dialog "Cookie consent" [ref=e330]:
    - generic [ref=e331]:
      - paragraph [ref=e332]:
        - text: Nous utilisons le stockage local pour mémoriser vos préférences et mesurer l'audience de façon anonyme (Vercel Analytics — aucune donnée personnelle collectée).
        - link "Politique de confidentialité" [ref=e333] [cursor=pointer]:
          - /url: /fr/privacy
      - generic [ref=e334]:
        - button "Refuser" [ref=e335]
        - button "Accepter" [ref=e336]
```

# Test source

```ts
  1  | // Locale smoke tests — verifies each language renders without crash
  2  | // Tests run against the local dev server (default) or production via BASE_URL.
  3  | // These tests catch "Functions cannot be passed directly" Server→Client bugs.
  4  | 
  5  | import { test, expect } from "@playwright/test";
  6  | 
  7  | const LOCALES = ["fr", "en", "es", "ar", "id"] as const;
  8  | 
  9  | test.describe("Landing page — all locales", () => {
  10 |   for (const locale of LOCALES) {
  11 |     test(`/${locale} loads without error`, async ({ page }) => {
  12 |       await page.goto(`/${locale}`);
  13 |       // Must NOT show Next.js error boundary
  14 |       await expect(page.locator("h1").filter({ hasText: /404|500/i })).not.toBeVisible();
  15 |       // Must show HealthWatch branding
> 16 |       await expect(page.getByText("HealthWatch")).toBeVisible({ timeout: 8000 });
     |                                                   ^ Error: expect(locator).toBeVisible() failed
  17 |     });
  18 |   }
  19 | });
  20 | 
  21 | test.describe("Pricing page — all locales", () => {
  22 |   for (const locale of LOCALES) {
  23 |     test(`/${locale}/pricing loads`, async ({ page }) => {
  24 |       await page.goto(`/${locale}/pricing`);
  25 |       // Free plan always visible (no auth required)
  26 |       await expect(page.getByText("Free", { exact: true }).first()
  27 |         .or(page.getByText("Gratis", { exact: true }))
  28 |         .or(page.getByText("مجاني", { exact: true }))
  29 |       ).toBeVisible({ timeout: 8000 });
  30 |     });
  31 |   }
  32 | });
  33 | 
  34 | test.describe("Compare page — no crash", () => {
  35 |   for (const locale of ["fr", "en", "id"] as const) {
  36 |     test(`/${locale}/compare renders`, async ({ page }) => {
  37 |       await page.goto(`/${locale}/compare`);
  38 |       // h1 should be visible (not a crash page)
  39 |       await expect(page.locator("h1")).toBeVisible({ timeout: 8000 });
  40 |       // Must NOT be a 404/error page
  41 |       await expect(page.locator("h1").filter({ hasText: /404/i })).not.toBeVisible();
  42 |     });
  43 |   }
  44 | });
  45 | 
  46 | test.describe("Static pages — spot check", () => {
  47 |   const checks: [string, string, RegExp][] = [
  48 |     ["fr", "about", /HealthWatch/i],
  49 |     ["en", "legal", /Legal|Mentions/i],
  50 |     ["id", "pricing", /Pro/i],
  51 |     ["ar", "privacy", /سياسة/i],
  52 |   ];
  53 | 
  54 |   for (const [locale, pg, pattern] of checks) {
  55 |     test(`/${locale}/${pg} has expected content`, async ({ page }) => {
  56 |       await page.goto(`/${locale}/${pg}`);
  57 |       await expect(page.locator("body")).toContainText(pattern, { timeout: 8000 });
  58 |     });
  59 |   }
  60 | });
  61 | 
```