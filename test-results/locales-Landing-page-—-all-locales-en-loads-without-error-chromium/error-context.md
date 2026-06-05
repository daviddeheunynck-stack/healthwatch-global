# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: locales.spec.ts >> Landing page — all locales >> /en loads without error
- Location: e2e\locales.spec.ts:11:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('HealthWatch')
Expected: visible
Error: strict mode violation: getByText('HealthWatch') resolved to 5 elements:
    1) <span class="font-bold text-lg text-white">HealthWatch Global</span> aka getByRole('navigation').filter({ hasText: 'HealthWatch GlobalDashboardAlertsCompareReportsPricingContactFRENESARIDSign' }).locator('span')
    2) <p class="text-gray-400 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">An undetected outbreak can cost your organization…</p> aka getByText('An undetected outbreak can')
    3) <p class="text-gray-400 max-w-2xl mx-auto leading-relaxed">Most health organizations learn too late — after …</p> aka getByText('Most health organizations')
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
        - link "Dashboard" [ref=e9] [cursor=pointer]:
          - /url: /en
          - img [ref=e10]
          - text: Dashboard
        - link "Alerts" [ref=e12] [cursor=pointer]:
          - /url: /en/alerts
          - img [ref=e13]
          - text: Alerts
        - link "Compare" [ref=e16] [cursor=pointer]:
          - /url: /en/compare
          - img [ref=e17]
          - text: Compare
        - link "Reports" [ref=e20] [cursor=pointer]:
          - /url: /en/reports
          - img [ref=e21]
          - text: Reports
        - link "Pricing" [ref=e24] [cursor=pointer]:
          - /url: /en/pricing
          - img [ref=e25]
          - text: Pricing
        - link "Contact" [ref=e27] [cursor=pointer]:
          - /url: /en/contact
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
          - link "Sign in" [ref=e43] [cursor=pointer]:
            - /url: /en/login
          - link "Create account" [ref=e44] [cursor=pointer]:
            - /url: /en/signup
  - main [ref=e45]:
    - generic [ref=e46]:
      - generic [ref=e48]:
        - generic [ref=e49]: Live WHO data · 195 countries · Updated daily
        - heading "Anticipate outbreaks. Stop reacting." [level=1] [ref=e51]:
          - text: Anticipate outbreaks.
          - text: Stop reacting.
        - paragraph [ref=e52]: An undetected outbreak can cost your organization weeks of crisis management. HealthWatch Global delivers real-time intelligence to your teams — directly from the WHO.
        - generic [ref=e53]:
          - link "Create free account" [ref=e54] [cursor=pointer]:
            - /url: /en/signup
            - text: Create free account
            - img [ref=e55]
          - link "See pricing" [ref=e57] [cursor=pointer]:
            - /url: /en/pricing
        - paragraph [ref=e58]: Free · No credit card required
        - generic [ref=e59]:
          - generic [ref=e60]:
            - img [ref=e61]
            - paragraph [ref=e63]: "36"
            - paragraph [ref=e64]: active outbreaks
          - generic [ref=e65]:
            - img [ref=e66]
            - paragraph [ref=e69]: "27"
            - paragraph [ref=e70]: countries affected
          - generic [ref=e71]:
            - img [ref=e72]
            - paragraph [ref=e74]: "15"
            - paragraph [ref=e75]: high-risk alerts
          - generic [ref=e76]:
            - img [ref=e77]
            - paragraph [ref=e80]: Updated daily
      - generic [ref=e81]:
        - generic [ref=e82]:
          - heading "The WHO declares 15–25 new outbreaks every month." [level=2] [ref=e83]
          - paragraph [ref=e84]: Most health organizations learn too late — after local media, after field teams report first cases. HealthWatch Global reverses that delay.
        - generic [ref=e85]:
          - generic [ref=e86]:
            - paragraph [ref=e87]: 15–25
            - paragraph [ref=e88]: new WHO outbreaks / month
          - generic [ref=e89]:
            - paragraph [ref=e90]: 72h
            - paragraph [ref=e91]: average detection lag
          - generic [ref=e92]:
            - paragraph [ref=e93]: × 10
            - paragraph [ref=e94]: cost of reactive vs. anticipatory response
      - generic [ref=e95]:
        - generic [ref=e96]:
          - generic [ref=e97]:
            - img [ref=e98]
            - text: Live
          - heading "What your teams will see in real time" [level=2] [ref=e104]
          - paragraph [ref=e105]: The data below is live and sourced directly from the WHO Disease Outbreak News API.
        - generic [ref=e106]:
          - table [ref=e107]:
            - rowgroup [ref=e108]:
              - row "Disease Country Risk" [ref=e109]:
                - columnheader "Disease" [ref=e110]
                - columnheader "Country" [ref=e111]
                - columnheader "Risk" [ref=e112]
                - columnheader [ref=e113]
            - rowgroup [ref=e114]:
              - row "Cholera Haiti High 28 500 cases" [ref=e115]:
                - cell "Cholera" [ref=e116]
                - cell "Haiti" [ref=e117]
                - cell "High" [ref=e118]
                - cell "28 500 cases" [ref=e119]:
                  - generic [ref=e120]: 28 500 cases
              - row "Dengue Fever Brazil High 6 200 000 cases" [ref=e121]:
                - cell "Dengue Fever" [ref=e122]
                - cell "Brazil" [ref=e123]
                - cell "High" [ref=e124]
                - cell "6 200 000 cases" [ref=e125]:
                  - generic [ref=e126]: 6 200 000 cases
              - row "Mpox (Monkeypox) Democratic Republic of Congo High 19 845 cases" [ref=e127]:
                - cell "Mpox (Monkeypox)" [ref=e128]
                - cell "Democratic Republic of Congo" [ref=e129]
                - cell "High" [ref=e130]
                - cell "19 845 cases" [ref=e131]:
                  - generic [ref=e132]: 19 845 cases
              - row "Ebola virus disease DR Congo High 746 cases" [ref=e133]:
                - cell "Ebola virus disease" [ref=e134]
                - cell "DR Congo" [ref=e135]
                - cell "High" [ref=e136]
                - cell "746 cases" [ref=e137]:
                  - generic [ref=e138]: 746 cases
              - row "Cholera Ethiopia High 8 320 cases" [ref=e139]:
                - cell "Cholera" [ref=e140]
                - cell "Ethiopia" [ref=e141]
                - cell "High" [ref=e142]
                - cell "8 320 cases" [ref=e143]:
                  - generic [ref=e144]: 8 320 cases
          - generic [ref=e145]:
            - generic [ref=e146]: "Source : WHO Disease Outbreak News"
            - link "Create free account →" [ref=e147] [cursor=pointer]:
              - /url: /en/signup
      - generic [ref=e148]:
        - heading "Everything your team needs" [level=2] [ref=e149]
        - generic [ref=e150]:
          - generic [ref=e151]:
            - img [ref=e153]
            - heading "Disease-specific alerts" [level=3] [ref=e156]
            - paragraph [ref=e157]: Subscribe to H5N1, Ebola, Mpox… Get an email within 6 hours whenever an outbreak is detected anywhere in the world.
          - generic [ref=e158]:
            - img [ref=e160]
            - heading "PHEIC badge & corroboration" [level=3] [ref=e166]
            - paragraph [ref=e167]: 🚨 PHEIC badge on every WHO-declared public health emergency. 🔁 WHO+ProMED confirms multi-source outbreaks.
          - generic [ref=e168]:
            - img [ref=e170]
            - heading "CFR & incidence rate" [level=3] [ref=e173]
            - paragraph [ref=e174]: Case fatality rate calculated automatically. Incidence per 100,000 with UN population data for 150 countries.
          - generic [ref=e175]:
            - img [ref=e177]
            - heading "Outbreak comparison" [level=3] [ref=e180]
            - paragraph [ref=e181]: "Ebola DRC vs Uganda 2026: cases, deaths, CFR, incidence side by side. Share the URL directly with colleagues."
          - generic [ref=e182]:
            - img [ref=e184]
            - heading "Watchlist & notifications" [level=3] [ref=e187]
            - paragraph [ref=e188]: Star ⭐ up to 20 specific outbreaks. Automatic email when figures change — never miss an escalation.
          - generic [ref=e189]:
            - img [ref=e191]
            - heading "PDF reports & embeddable widget" [level=3] [ref=e193]
            - paragraph [ref=e194]: Professional PDF per outbreak in 1 click. Embeddable iframe widget for your site. PNG card for WhatsApp and Slack.
      - generic [ref=e195]:
        - heading "Up and running in 3 minutes" [level=2] [ref=e196]
        - generic [ref=e197]:
          - generic [ref=e198]:
            - generic [ref=e199]: "1"
            - generic [ref=e200]:
              - heading "Create your account" [level=3] [ref=e201]
              - paragraph [ref=e202]: Sign up in 30 seconds. No credit card required. Immediate dashboard access.
          - generic [ref=e203]:
            - generic [ref=e204]: "2"
            - generic [ref=e205]:
              - heading "Configure your regions" [level=3] [ref=e206]
              - paragraph [ref=e207]: Select the geographies you monitor and receive your first digest the following week.
          - generic [ref=e208]:
            - generic [ref=e209]: "3"
            - generic [ref=e210]:
              - heading "Go Pro for real-time alerts" [level=3] [ref=e211]
              - paragraph [ref=e212]: Unlock the live feed, PDF reports, and CSV export — and stay ahead of every crisis.
      - generic [ref=e213]:
        - paragraph [ref=e214]: Designed for
        - generic [ref=e215]:
          - generic [ref=e216]:
            - img [ref=e218]
            - paragraph [ref=e220]: Health Ministries
          - generic [ref=e221]:
            - img [ref=e223]
            - paragraph [ref=e225]: International NGOs
          - generic [ref=e226]:
            - img [ref=e228]
            - paragraph [ref=e232]: Research Institutes
          - generic [ref=e233]:
            - img [ref=e235]
            - paragraph [ref=e239]: Hospitals & Clinics
      - generic [ref=e240]:
        - heading "Start free. Scale when you need to." [level=2] [ref=e241]
        - generic [ref=e242]:
          - generic [ref=e243]:
            - generic [ref=e244]:
              - img [ref=e245]
              - generic [ref=e248]: Free
            - paragraph [ref=e249]: 0 €
            - paragraph [ref=e250]: World map · 1 region · Weekly digest
          - generic [ref=e251]:
            - generic [ref=e252]:
              - img [ref=e253]
              - generic [ref=e255]: Pro
            - paragraph [ref=e256]: $49 /month
            - paragraph [ref=e257]: All regions · Alerts · PDF · CSV · Slack
          - generic [ref=e258]:
            - generic [ref=e259]:
              - img [ref=e260]
              - generic [ref=e262]: Enterprise
            - paragraph [ref=e263]: Custom
            - paragraph [ref=e264]: API · On-premise · 99.9% SLA
        - link "See all plans →" [ref=e266] [cursor=pointer]:
          - /url: /en/pricing
      - generic [ref=e267]:
        - generic [ref=e268]:
          - heading "Stay informed — for free" [level=2] [ref=e269]
          - paragraph [ref=e270]: A weekly digest of active outbreaks, filtered by region, delivered straight to your inbox.
        - generic [ref=e271]:
          - generic [ref=e272]:
            - textbox "you@organization.com" [ref=e273]
            - combobox "Region" [ref=e274]:
              - option "All regions" [selected]
              - option "Africa"
              - option "Asia"
              - option "Europe"
              - option "Americas"
              - option "Oceania"
            - button "Subscribe" [ref=e275]:
              - img [ref=e276]
              - text: Subscribe
          - paragraph [ref=e279]: Free · No credit card · Unsubscribe in 1 click
      - generic [ref=e281]:
        - generic [ref=e282]:
          - img [ref=e284]
          - img [ref=e289]
          - img [ref=e292]
        - heading "Is your organization ready for the next outbreak?" [level=2] [ref=e296]
        - paragraph [ref=e297]: Join teams monitoring global health crises in real time.
        - generic [ref=e298]:
          - link "Get started free" [ref=e299] [cursor=pointer]:
            - /url: /en/signup
            - text: Get started free
            - img [ref=e300]
          - paragraph [ref=e302]: No credit card · Instant access
  - contentinfo [ref=e303]:
    - generic [ref=e305]:
      - generic [ref=e306]:
        - img [ref=e307]
        - generic [ref=e309]: HealthWatch Global
        - generic [ref=e310]: ·
        - generic [ref=e311]: © 2026
      - navigation [ref=e312]:
        - link "About" [ref=e313] [cursor=pointer]:
          - /url: /en/about
        - link "Privacy Policy" [ref=e314] [cursor=pointer]:
          - /url: /en/privacy
        - link "Terms of Service" [ref=e315] [cursor=pointer]:
          - /url: /en/terms
        - link "Legal notice" [ref=e316] [cursor=pointer]:
          - /url: /en/legal
        - link "Contact" [ref=e317] [cursor=pointer]:
          - /url: /en/contact
        - link "contact@healthwatch-global.com" [ref=e318] [cursor=pointer]:
          - /url: mailto:contact@healthwatch-global.com
        - button "Cookie settings" [ref=e319]
  - button "Open Next.js Dev Tools" [ref=e325] [cursor=pointer]:
    - img [ref=e326]
  - alert [ref=e329]
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