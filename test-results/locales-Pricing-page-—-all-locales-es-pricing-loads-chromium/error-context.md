# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: locales.spec.ts >> Pricing page — all locales >> /es/pricing loads
- Location: e2e\locales.spec.ts:23:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Free', { exact: true }).first().or(getByText('Gratis', { exact: true })).or(getByText('مجاني', { exact: true }))
Expected: visible
Error: strict mode violation: getByText('Free', { exact: true }).first().or(getByText('Gratis', { exact: true })).or(getByText('مجاني', { exact: true })) resolved to 2 elements:
    1) <span class="text-green-400 font-bold text-lg">Gratis</span> aka getByText('Gratis', { exact: true })
    2) <span class="text-green-400 font-semibold text-sm uppercase tracking-wide">Free</span> aka locator('span').filter({ hasText: 'Free' })

Call log:
  - Expect "toBeVisible" with timeout 8000ms
  - waiting for getByText('Free', { exact: true }).first().or(getByText('Gratis', { exact: true })).or(getByText('مجاني', { exact: true }))

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
      - generic [ref=e47]:
        - generic [ref=e48]:
          - img [ref=e49]
          - text: Diseñado para organizaciones de salud y sus equipos en todo el mundo
        - heading "Anticipe. No solo reaccione." [level=1] [ref=e52]
        - paragraph [ref=e53]: Un brote no detectado a tiempo puede costarle a su organización meses de gestión de crisis. HealthWatch Global ofrece a sus equipos inteligencia en tiempo real, directamente de la OMS.
        - generic [ref=e54]:
          - paragraph [ref=e55]: Diseñado para
          - generic [ref=e56]:
            - generic [ref=e57]: Ministerios de Salud
            - generic [ref=e58]: ONG internacionales
            - generic [ref=e59]: Organizaciones humanitarias
            - generic [ref=e60]: Institutos de investigación
            - generic [ref=e61]: Sector sanitario privado
      - generic [ref=e62]:
        - generic [ref=e63]:
          - img [ref=e64]
          - generic [ref=e68]:
            - generic [ref=e69]:
              - generic [ref=e70]: Gratis
              - generic [ref=e71]: 0 €
            - paragraph [ref=e72]: Descubra la plataforma sin compromiso.
            - list [ref=e73]:
              - listitem [ref=e74]:
                - img [ref=e75]
                - text: 1 región monitoreada
              - listitem [ref=e77]:
                - img [ref=e78]
                - text: Digest semanal por email
              - listitem [ref=e80]:
                - img [ref=e81]
                - text: Acceso al panel público
              - listitem [ref=e83]:
                - img [ref=e84]
                - text: Datos OMS + CDC
        - link "Suscribirse gratis →" [ref=e86] [cursor=pointer]:
          - /url: /es/signup
      - generic [ref=e87]:
        - generic [ref=e88]:
          - button "Mensual" [ref=e89]
          - button "Anual -20%" [ref=e90]:
            - text: Anual
            - generic [ref=e91]: "-20%"
        - generic [ref=e92]:
          - generic [ref=e93]:
            - generic [ref=e94]:
              - generic [ref=e95]:
                - img [ref=e96]
                - generic [ref=e98]: Free
              - generic [ref=e100]: 0 €
              - paragraph [ref=e101]: Explore la plataforma sin compromiso.
            - list [ref=e102]:
              - listitem [ref=e103]:
                - img [ref=e104]
                - text: Mapa mundial interactivo
              - listitem [ref=e106]:
                - img [ref=e107]
                - text: 1 región monitoreada
              - listitem [ref=e109]:
                - img [ref=e110]
                - text: Datos OMS en vivo
              - listitem [ref=e112]:
                - img [ref=e113]
                - text: Digest semanal gratuito
              - listitem [ref=e115]:
                - img [ref=e116]
                - text: Panel multilingüe
            - link "Empezar →" [ref=e118] [cursor=pointer]:
              - /url: /es/signup
          - generic [ref=e119]:
            - generic [ref=e120]: Más popular
            - generic [ref=e121]:
              - generic [ref=e122]:
                - img [ref=e123]
                - generic [ref=e125]: Pro
              - generic [ref=e126]:
                - generic [ref=e127]: $49
                - generic [ref=e128]: /mes
              - paragraph [ref=e129]: Para ministerios de salud y ONG internacionales.
            - list [ref=e130]:
              - listitem [ref=e131]:
                - img [ref=e132]
                - text: Todas las regiones
              - listitem [ref=e134]:
                - img [ref=e135]
                - text: Alertas en tiempo real
              - listitem [ref=e137]:
                - img [ref=e138]
                - text: Informes PDF automáticos
              - listitem [ref=e140]:
                - img [ref=e141]
                - text: Integración Slack / Teams
              - listitem [ref=e143]:
                - img [ref=e144]
                - text: Exportación CSV ilimitada
              - listitem [ref=e146]:
                - img [ref=e147]
                - text: Soporte prioritario
            - generic [ref=e149]:
              - img [ref=e150]
              - generic [ref=e153]: 14 días gratis · sin tarjeta
            - button "Empezar →" [ref=e155] [cursor=pointer]
            - generic [ref=e156]:
              - img [ref=e157]
              - text: Sin compromiso · Reembolso 14 días
          - generic [ref=e162]:
            - generic [ref=e163]:
              - generic [ref=e164]:
                - img [ref=e165]
                - generic [ref=e169]: Enterprise
              - generic [ref=e171]: A medida
              - paragraph [ref=e172]: Para gobiernos y grandes grupos farmacéuticos.
            - list [ref=e173]:
              - listitem [ref=e174]:
                - img [ref=e175]
                - text: Todo lo de Pro
              - listitem [ref=e177]:
                - img [ref=e178]
                - text: Acceso API REST + docs
              - listitem [ref=e180]:
                - img [ref=e181]
                - text: Implementación on-premise
              - listitem [ref=e183]:
                - img [ref=e184]
                - text: SLA 99,9% garantizado
              - listitem [ref=e186]:
                - img [ref=e187]
                - text: Gestor de cuenta dedicado
              - listitem [ref=e189]:
                - img [ref=e190]
                - text: Soporte 24/7 dedicado
            - link "Contáctenos" [ref=e192] [cursor=pointer]:
              - /url: mailto:contact@healthwatch-global.com?subject=Enterprise Plan - HealthWatch Global
              - img [ref=e193]
              - text: Contáctenos
      - generic [ref=e196]:
        - img [ref=e198]
        - generic [ref=e203]:
          - paragraph [ref=e204]: Sin compromiso. Reembolso en 14 días.
          - paragraph [ref=e205]: Sin compromiso. Si no está satisfecho en los 14 días posteriores a su primer pago, le reembolsamos sin preguntas.
      - generic [ref=e206]:
        - generic [ref=e207]:
          - img [ref=e208]
          - heading "El coste de no saber" [level=2] [ref=e211]
        - paragraph [ref=e212]: La OMS declara entre 15 y 25 nuevos brotes de enfermedades cada mes. Un solo brote que llegue a su región antes de que sus equipos estén informados puede significar semanas de operaciones reactivas y exposición reputacional. A $49/mes, el plan Pro cuesta menos de una hora de gestión de crisis.
      - generic [ref=e213]:
        - heading "Comparación completa de funciones" [level=2] [ref=e214]
        - table [ref=e216]:
          - rowgroup [ref=e217]:
            - row "Free Pro Enterprise" [ref=e218]:
              - columnheader [ref=e219]
              - columnheader "Free" [ref=e220]
              - columnheader "Pro" [ref=e221]
              - columnheader "Enterprise" [ref=e222]
          - rowgroup [ref=e223]:
            - row "Mapa de brotes en vivo" [ref=e224]:
              - cell "Mapa de brotes en vivo" [ref=e225]
              - cell [ref=e226]:
                - img [ref=e227]
              - cell [ref=e229]:
                - img [ref=e230]
              - cell [ref=e232]:
                - img [ref=e233]
            - row "Datos OMS DON" [ref=e235]:
              - cell "Datos OMS DON" [ref=e236]
              - cell [ref=e237]:
                - img [ref=e238]
              - cell [ref=e240]:
                - img [ref=e241]
              - cell [ref=e243]:
                - img [ref=e244]
            - row "Regiones supervisadas 1 Todas Todas" [ref=e246]:
              - cell "Regiones supervisadas" [ref=e247]
              - cell "1" [ref=e248]:
                - generic [ref=e249]: "1"
              - cell "Todas" [ref=e250]:
                - generic [ref=e251]: Todas
              - cell "Todas" [ref=e252]:
                - generic [ref=e253]: Todas
            - row "Cifras exactas (casos y fallec.) —" [ref=e254]:
              - cell "Cifras exactas (casos y fallec.)" [ref=e255]
              - cell "—" [ref=e256]:
                - generic [ref=e257]: —
              - cell [ref=e258]:
                - img [ref=e259]
              - cell [ref=e261]:
                - img [ref=e262]
            - row "Digest semanal por email" [ref=e264]:
              - cell "Digest semanal por email" [ref=e265]
              - cell [ref=e266]:
                - img [ref=e267]
              - cell [ref=e269]:
                - img [ref=e270]
              - cell [ref=e272]:
                - img [ref=e273]
            - row "Alertas email regionales — Todas las regiones Todas las regiones" [ref=e275]:
              - cell "Alertas email regionales" [ref=e276]
              - cell "—" [ref=e277]:
                - generic [ref=e278]: —
              - cell "Todas las regiones" [ref=e279]:
                - generic [ref=e280]: Todas las regiones
              - cell "Todas las regiones" [ref=e281]:
                - generic [ref=e282]: Todas las regiones
            - row "Alertas en tiempo real (todas las regiones) —" [ref=e283]:
              - cell "Alertas en tiempo real (todas las regiones)" [ref=e284]
              - cell "—" [ref=e285]:
                - generic [ref=e286]: —
              - cell [ref=e287]:
                - img [ref=e288]
              - cell [ref=e290]:
                - img [ref=e291]
            - row "Informes PDF regionales — Todas las regiones Todas las regiones" [ref=e293]:
              - cell "Informes PDF regionales" [ref=e294]
              - cell "—" [ref=e295]:
                - generic [ref=e296]: —
              - cell "Todas las regiones" [ref=e297]:
                - generic [ref=e298]: Todas las regiones
              - cell "Todas las regiones" [ref=e299]:
                - generic [ref=e300]: Todas las regiones
            - row "Exportación de datos CSV —" [ref=e301]:
              - cell "Exportación de datos CSV" [ref=e302]
              - cell "—" [ref=e303]:
                - generic [ref=e304]: —
              - cell [ref=e305]:
                - img [ref=e306]
              - cell [ref=e308]:
                - img [ref=e309]
            - row "Integración Slack / Teams —" [ref=e311]:
              - cell "Integración Slack / Teams" [ref=e312]
              - cell "—" [ref=e313]:
                - generic [ref=e314]: —
              - cell [ref=e315]:
                - img [ref=e316]
              - cell [ref=e318]:
                - img [ref=e319]
            - row "Acceso API REST — —" [ref=e321]:
              - cell "Acceso API REST" [ref=e322]
              - cell "—" [ref=e323]:
                - generic [ref=e324]: —
              - cell "—" [ref=e325]:
                - generic [ref=e326]: —
              - cell [ref=e327]:
                - img [ref=e328]
            - row "Implementación on-premise — —" [ref=e330]:
              - cell "Implementación on-premise" [ref=e331]
              - cell "—" [ref=e332]:
                - generic [ref=e333]: —
              - cell "—" [ref=e334]:
                - generic [ref=e335]: —
              - cell [ref=e336]:
                - img [ref=e337]
            - row "SLA del 99,9% — —" [ref=e339]:
              - cell "SLA del 99,9%" [ref=e340]
              - cell "—" [ref=e341]:
                - generic [ref=e342]: —
              - cell "—" [ref=e343]:
                - generic [ref=e344]: —
              - cell [ref=e345]:
                - img [ref=e346]
            - row "Gestor de cuenta dedicado — —" [ref=e348]:
              - cell "Gestor de cuenta dedicado" [ref=e349]
              - cell "—" [ref=e350]:
                - generic [ref=e351]: —
              - cell "—" [ref=e352]:
                - generic [ref=e353]: —
              - cell [ref=e354]:
                - img [ref=e355]
            - row "Soporte Email Prioritario Dedicado" [ref=e357]:
              - cell "Soporte" [ref=e358]
              - cell "Email" [ref=e359]:
                - generic [ref=e360]: Email
              - cell "Prioritario" [ref=e361]:
                - generic [ref=e362]: Prioritario
              - cell "Dedicado" [ref=e363]:
                - generic [ref=e364]: Dedicado
      - generic [ref=e365]:
        - paragraph [ref=e366]: Diseñado para
        - generic [ref=e367]:
          - generic [ref=e368]:
            - img [ref=e370]
            - paragraph [ref=e372]: Ministerios de Salud
          - generic [ref=e373]:
            - img [ref=e375]
            - paragraph [ref=e377]: ONG Internacionales
          - generic [ref=e378]:
            - img [ref=e380]
            - paragraph [ref=e384]: Institutos de Investigación
          - generic [ref=e385]:
            - img [ref=e387]
            - paragraph [ref=e391]: Hospitales & Clínicas
        - generic [ref=e392]:
          - generic [ref=e393]:
            - img [ref=e394]
            - generic [ref=e397]: "195"
            - generic [ref=e398]: países cubiertos
          - generic [ref=e399]:
            - img [ref=e400]
            - generic [ref=e402]: 99.9%
            - generic [ref=e403]: disponibilidad
          - generic [ref=e404]:
            - img [ref=e405]
            - generic [ref=e410]: "5"
            - generic [ref=e411]: idiomas
          - generic [ref=e412]:
            - img [ref=e413]
            - generic [ref=e415]: GDPR
            - generic [ref=e416]: cumplimiento
      - generic [ref=e417]:
        - generic [ref=e418]:
          - img [ref=e420]
          - generic [ref=e422]:
            - paragraph [ref=e423]: Precio ONG — hasta −30%
            - paragraph [ref=e424]: ¿Es una ONG, organización humanitaria o instituto de investigación sin ánimo de lucro? Contáctenos para una tarifa adaptada.
        - link "Solicitar tarifa →" [ref=e425] [cursor=pointer]:
          - /url: /es/contact
      - generic [ref=e426]:
        - img [ref=e427]
        - heading "¿No sabe qué plan elegir?" [level=2] [ref=e432]
        - paragraph [ref=e433]: Reserve una llamada de 20 minutos. Analizaremos sus necesidades de vigilancia y le recomendaremos el plan adecuado, sin presión comercial.
        - link "Contáctenos" [ref=e434] [cursor=pointer]:
          - /url: /es/contact
          - img [ref=e435]
          - text: Contáctenos
          - img [ref=e438]
      - generic [ref=e440]:
        - heading "Preguntas frecuentes" [level=2] [ref=e441]
        - generic [ref=e442]:
          - paragraph [ref=e443]: ¿Puedo cancelar en cualquier momento?
          - paragraph [ref=e444]: Sí, sin compromiso. Puede cancelar su suscripción en cualquier momento desde su cuenta.
        - generic [ref=e445]:
          - paragraph [ref=e446]: ¿Los datos se actualizan en tiempo real?
          - paragraph [ref=e447]: Sí. Agregamos continuamente los flujos de OMS, CDC, ECDC y ProMED las 24 horas.
        - generic [ref=e448]:
          - paragraph [ref=e449]: ¿Hay un plan gratuito?
          - paragraph [ref=e450]: Sí. El plan Gratuito da acceso al panel público, una región supervisada y el resumen semanal, sin tarjeta de crédito ni límite de tiempo.
  - contentinfo [ref=e451]:
    - generic [ref=e453]:
      - generic [ref=e454]:
        - img [ref=e455]
        - generic [ref=e457]: HealthWatch Global
        - generic [ref=e458]: ·
        - generic [ref=e459]: © 2026
      - navigation [ref=e460]:
        - link "Acerca de" [ref=e461] [cursor=pointer]:
          - /url: /es/about
        - link "Política de privacidad" [ref=e462] [cursor=pointer]:
          - /url: /es/privacy
        - link "Términos de uso" [ref=e463] [cursor=pointer]:
          - /url: /es/terms
        - link "Aviso legal" [ref=e464] [cursor=pointer]:
          - /url: /es/legal
        - link "Contacto" [ref=e465] [cursor=pointer]:
          - /url: /es/contact
        - link "contact@healthwatch-global.com" [ref=e466] [cursor=pointer]:
          - /url: mailto:contact@healthwatch-global.com
        - button "Configuración de cookies" [ref=e467]
  - button "Open Next.js Dev Tools" [ref=e473] [cursor=pointer]:
    - img [ref=e474]
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
  16 |       await expect(page.getByText("HealthWatch")).toBeVisible({ timeout: 8000 });
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
> 29 |       ).toBeVisible({ timeout: 8000 });
     |         ^ Error: expect(locator).toBeVisible() failed
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