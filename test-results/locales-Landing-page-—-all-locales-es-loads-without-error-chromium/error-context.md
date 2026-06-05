# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: locales.spec.ts >> Landing page — all locales >> /es loads without error
- Location: e2e\locales.spec.ts:11:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('HealthWatch')
Expected: visible
Error: strict mode violation: getByText('HealthWatch') resolved to 5 elements:
    1) <span class="font-bold text-lg text-white">HealthWatch Global</span> aka getByRole('navigation').filter({ hasText: 'HealthWatch GlobalPanelAlertasCompareInformesPreciosContactoFRENESARIDIniciar' }).locator('span')
    2) <p class="text-gray-400 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">Un brote no detectado puede costarle a su organiz…</p> aka getByText('Un brote no detectado puede')
    3) <p class="text-gray-400 max-w-2xl mx-auto leading-relaxed">La mayoría de las organizaciones de salud lo desc…</p> aka getByText('La mayoría de las')
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
        - link "Panel" [ref=e9] [cursor=pointer]:
          - /url: /es
          - img [ref=e10]
          - text: Panel
        - link "Alertas" [ref=e12] [cursor=pointer]:
          - /url: /es/alerts
          - img [ref=e13]
          - text: Alertas
        - link "Compare" [ref=e16] [cursor=pointer]:
          - /url: /es/compare
          - img [ref=e17]
          - text: Compare
        - link "Informes" [ref=e20] [cursor=pointer]:
          - /url: /es/reports
          - img [ref=e21]
          - text: Informes
        - link "Precios" [ref=e24] [cursor=pointer]:
          - /url: /es/pricing
          - img [ref=e25]
          - text: Precios
        - link "Contacto" [ref=e27] [cursor=pointer]:
          - /url: /es/contact
          - img [ref=e28]
          - text: Contacto
      - generic [ref=e31]:
        - generic [ref=e32]:
          - img [ref=e33]
          - button "FR" [ref=e36]
          - button "EN" [ref=e37]
          - button "ES" [ref=e38]
          - button "AR" [ref=e39]
          - button "ID" [ref=e40]
        - generic [ref=e42]:
          - link "Iniciar sesión" [ref=e43] [cursor=pointer]:
            - /url: /es/login
          - link "Crear cuenta" [ref=e44] [cursor=pointer]:
            - /url: /es/signup
  - main [ref=e45]:
    - generic [ref=e46]:
      - generic [ref=e48]:
        - generic [ref=e49]: Datos OMS en vivo · 195 países · Actualizado diariamente
        - heading "Anticipe los brotes. Deje de reaccionar." [level=1] [ref=e51]:
          - text: Anticipe los brotes.
          - text: Deje de reaccionar.
        - paragraph [ref=e52]: Un brote no detectado puede costarle a su organización semanas de gestión de crisis. HealthWatch Global entrega inteligencia en tiempo real a sus equipos — directamente desde la OMS.
        - generic [ref=e53]:
          - link "Crear cuenta gratuita" [ref=e54] [cursor=pointer]:
            - /url: /es/signup
            - text: Crear cuenta gratuita
            - img [ref=e55]
          - link "Ver precios" [ref=e57] [cursor=pointer]:
            - /url: /es/pricing
        - paragraph [ref=e58]: Gratis · Sin tarjeta de crédito
        - generic [ref=e59]:
          - generic [ref=e60]:
            - img [ref=e61]
            - paragraph [ref=e63]: "36"
            - paragraph [ref=e64]: brotes activos
          - generic [ref=e65]:
            - img [ref=e66]
            - paragraph [ref=e69]: "27"
            - paragraph [ref=e70]: países afectados
          - generic [ref=e71]:
            - img [ref=e72]
            - paragraph [ref=e74]: "15"
            - paragraph [ref=e75]: alertas de alto riesgo
          - generic [ref=e76]:
            - img [ref=e77]
            - paragraph [ref=e80]: Actualizado diariamente
      - generic [ref=e81]:
        - generic [ref=e82]:
          - heading "La OMS declara entre 15 y 25 nuevos brotes cada mes." [level=2] [ref=e83]
          - paragraph [ref=e84]: La mayoría de las organizaciones de salud lo descubren demasiado tarde. HealthWatch Global invierte ese retraso.
        - generic [ref=e85]:
          - generic [ref=e86]:
            - paragraph [ref=e87]: 15–25
            - paragraph [ref=e88]: nuevos brotes OMS / mes
          - generic [ref=e89]:
            - paragraph [ref=e90]: 72h
            - paragraph [ref=e91]: retraso promedio de detección
          - generic [ref=e92]:
            - paragraph [ref=e93]: × 10
            - paragraph [ref=e94]: coste de respuesta reactiva vs. anticipada
      - generic [ref=e95]:
        - generic [ref=e96]:
          - generic [ref=e97]:
            - img [ref=e98]
            - text: En vivo
          - heading "Lo que sus equipos verán en tiempo real" [level=2] [ref=e104]
          - paragraph [ref=e105]: Los datos a continuación son reales y provienen directamente de la API WHO Disease Outbreak News.
        - generic [ref=e106]:
          - table [ref=e107]:
            - rowgroup [ref=e108]:
              - row "Enfermedad País Riesgo" [ref=e109]:
                - columnheader "Enfermedad" [ref=e110]
                - columnheader "País" [ref=e111]
                - columnheader "Riesgo" [ref=e112]
                - columnheader [ref=e113]
            - rowgroup [ref=e114]:
              - row "Cholera Haiti Alto 28 500 casos" [ref=e115]:
                - cell "Cholera" [ref=e116]
                - cell "Haiti" [ref=e117]
                - cell "Alto" [ref=e118]
                - cell "28 500 casos" [ref=e119]:
                  - generic [ref=e120]: 28 500 casos
              - row "Dengue Fever Brazil Alto 6 200 000 casos" [ref=e121]:
                - cell "Dengue Fever" [ref=e122]
                - cell "Brazil" [ref=e123]
                - cell "Alto" [ref=e124]
                - cell "6 200 000 casos" [ref=e125]:
                  - generic [ref=e126]: 6 200 000 casos
              - row "Mpox (Monkeypox) Democratic Republic of Congo Alto 19 845 casos" [ref=e127]:
                - cell "Mpox (Monkeypox)" [ref=e128]
                - cell "Democratic Republic of Congo" [ref=e129]
                - cell "Alto" [ref=e130]
                - cell "19 845 casos" [ref=e131]:
                  - generic [ref=e132]: 19 845 casos
              - row "Ebola virus disease DR Congo Alto 746 casos" [ref=e133]:
                - cell "Ebola virus disease" [ref=e134]
                - cell "DR Congo" [ref=e135]
                - cell "Alto" [ref=e136]
                - cell "746 casos" [ref=e137]:
                  - generic [ref=e138]: 746 casos
              - row "Cholera Ethiopia Alto 8 320 casos" [ref=e139]:
                - cell "Cholera" [ref=e140]
                - cell "Ethiopia" [ref=e141]
                - cell "Alto" [ref=e142]
                - cell "8 320 casos" [ref=e143]:
                  - generic [ref=e144]: 8 320 casos
          - generic [ref=e145]:
            - generic [ref=e146]: "Source : WHO Disease Outbreak News"
            - link "Crear cuenta gratuita →" [ref=e147] [cursor=pointer]:
              - /url: /es/signup
      - generic [ref=e148]:
        - heading "Todo lo que su equipo necesita" [level=2] [ref=e149]
        - generic [ref=e150]:
          - generic [ref=e151]:
            - img [ref=e153]
            - heading "Alertas por enfermedad" [level=3] [ref=e156]
            - paragraph [ref=e157]: Suscríbase a H5N1, Ébola, Mpox… Reciba un email en menos de 6h cuando se detecte un brote en cualquier parte del mundo.
          - generic [ref=e158]:
            - img [ref=e160]
            - heading "Insignia PHEIC & corroboración" [level=3] [ref=e166]
            - paragraph [ref=e167]: 🚨 PHEIC en cada emergencia sanitaria internacional de la OMS. 🔁 WHO+ProMED confirma brotes de múltiples fuentes.
          - generic [ref=e168]:
            - img [ref=e170]
            - heading "Tasa de letalidad & incidencia" [level=3] [ref=e173]
            - paragraph [ref=e174]: CFR calculado automáticamente. Incidencia por 100.000 habitantes con datos de población de la ONU para 150 países.
          - generic [ref=e175]:
            - img [ref=e177]
            - heading "Comparación de brotes" [level=3] [ref=e180]
            - paragraph [ref=e181]: "Ébola RDC vs Uganda: casos, muertes, CFR, incidencia lado a lado. Comparta la URL directamente con colegas."
          - generic [ref=e182]:
            - img [ref=e184]
            - heading "Lista de seguimiento & notificaciones" [level=3] [ref=e187]
            - paragraph [ref=e188]: Marque ⭐ hasta 20 brotes. Notificación automática por email cuando cambian las cifras.
          - generic [ref=e189]:
            - img [ref=e191]
            - heading "Informes PDF & widget embebible" [level=3] [ref=e193]
            - paragraph [ref=e194]: Informe PDF profesional por brote con 1 clic. Widget iframe para su sitio. Tarjeta PNG para WhatsApp y Slack.
      - generic [ref=e195]:
        - heading "Operativo en 3 minutos" [level=2] [ref=e196]
        - generic [ref=e197]:
          - generic [ref=e198]:
            - generic [ref=e199]: "1"
            - generic [ref=e200]:
              - heading "Cree su cuenta" [level=3] [ref=e201]
              - paragraph [ref=e202]: Registro en 30 segundos. Sin tarjeta de crédito. Acceso inmediato al panel.
          - generic [ref=e203]:
            - generic [ref=e204]: "2"
            - generic [ref=e205]:
              - heading "Configure sus regiones" [level=3] [ref=e206]
              - paragraph [ref=e207]: Seleccione las geografías que monitorea y reciba su primer digest la semana siguiente.
          - generic [ref=e208]:
            - generic [ref=e209]: "3"
            - generic [ref=e210]:
              - heading "Pase a Pro para alertas en tiempo real" [level=3] [ref=e211]
              - paragraph [ref=e212]: Desbloquee el flujo en vivo, informes PDF y exportación CSV.
      - generic [ref=e213]:
        - paragraph [ref=e214]: Diseñado para
        - generic [ref=e215]:
          - generic [ref=e216]:
            - img [ref=e218]
            - paragraph [ref=e220]: Ministerios de Salud
          - generic [ref=e221]:
            - img [ref=e223]
            - paragraph [ref=e225]: ONG Internacionales
          - generic [ref=e226]:
            - img [ref=e228]
            - paragraph [ref=e232]: Institutos de Investigación
          - generic [ref=e233]:
            - img [ref=e235]
            - paragraph [ref=e239]: Hospitales & Clínicas
      - generic [ref=e240]:
        - heading "Empiece gratis. Escale cuando lo necesite." [level=2] [ref=e241]
        - generic [ref=e242]:
          - generic [ref=e243]:
            - generic [ref=e244]:
              - img [ref=e245]
              - generic [ref=e248]: Gratis
            - paragraph [ref=e249]: 0 €
            - paragraph [ref=e250]: Mapa mundial · 1 región · Digest semanal
          - generic [ref=e251]:
            - generic [ref=e252]:
              - img [ref=e253]
              - generic [ref=e255]: Pro
            - paragraph [ref=e256]: $49 /mes
            - paragraph [ref=e257]: Todas las regiones · Alertas · PDF · CSV · Slack
          - generic [ref=e258]:
            - generic [ref=e259]:
              - img [ref=e260]
              - generic [ref=e262]: Enterprise
            - paragraph [ref=e263]: A medida
            - paragraph [ref=e264]: API · On-premise · SLA 99,9%
        - link "Ver todos los planes →" [ref=e266] [cursor=pointer]:
          - /url: /es/pricing
      - generic [ref=e267]:
        - generic [ref=e268]:
          - heading "Manténgase informado — gratis" [level=2] [ref=e269]
          - paragraph [ref=e270]: Un resumen semanal de brotes activos, filtrado por región, directo a su bandeja de entrada.
        - generic [ref=e271]:
          - generic [ref=e272]:
            - textbox "usted@organización.com" [ref=e273]
            - combobox "Región" [ref=e274]:
              - option "Todas las regiones" [selected]
              - option "África"
              - option "Asia"
              - option "Europa"
              - option "Américas"
              - option "Oceanía"
            - button "Suscribirse" [ref=e275]:
              - img [ref=e276]
              - text: Suscribirse
          - paragraph [ref=e279]: Gratis · Sin tarjeta · Cancelar en 1 clic
      - generic [ref=e281]:
        - generic [ref=e282]:
          - img [ref=e284]
          - img [ref=e289]
          - img [ref=e292]
        - heading "¿Está su organización lista para el próximo brote?" [level=2] [ref=e296]
        - paragraph [ref=e297]: Únase a los equipos que monitorean las crisis sanitarias mundiales en tiempo real.
        - generic [ref=e298]:
          - link "Comenzar gratis" [ref=e299] [cursor=pointer]:
            - /url: /es/signup
            - text: Comenzar gratis
            - img [ref=e300]
          - paragraph [ref=e302]: Sin tarjeta de crédito · Acceso inmediato
  - contentinfo [ref=e303]:
    - generic [ref=e305]:
      - generic [ref=e306]:
        - img [ref=e307]
        - generic [ref=e309]: HealthWatch Global
        - generic [ref=e310]: ·
        - generic [ref=e311]: © 2026
      - navigation [ref=e312]:
        - link "Acerca de" [ref=e313] [cursor=pointer]:
          - /url: /es/about
        - link "Política de privacidad" [ref=e314] [cursor=pointer]:
          - /url: /es/privacy
        - link "Términos de uso" [ref=e315] [cursor=pointer]:
          - /url: /es/terms
        - link "Aviso legal" [ref=e316] [cursor=pointer]:
          - /url: /es/legal
        - link "Contacto" [ref=e317] [cursor=pointer]:
          - /url: /es/contact
        - link "contact@healthwatch-global.com" [ref=e318] [cursor=pointer]:
          - /url: mailto:contact@healthwatch-global.com
        - button "Configuración de cookies" [ref=e319]
  - button "Open Next.js Dev Tools" [ref=e325] [cursor=pointer]:
    - img [ref=e326]
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