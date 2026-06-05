# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: locales.spec.ts >> Pricing page — all locales >> /ar/pricing loads
- Location: e2e\locales.spec.ts:23:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Free', { exact: true }).first().or(getByText('Gratis', { exact: true })).or(getByText('مجاني', { exact: true }))
Expected: visible
Error: strict mode violation: getByText('Free', { exact: true }).first().or(getByText('Gratis', { exact: true })).or(getByText('مجاني', { exact: true })) resolved to 2 elements:
    1) <span class="text-green-400 font-bold text-lg">مجاني</span> aka getByText('مجاني', { exact: true })
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
        - link "لوحة القيادة" [ref=e9] [cursor=pointer]:
          - /url: /ar
          - img [ref=e10]
          - text: لوحة القيادة
        - link "التنبيهات" [ref=e12] [cursor=pointer]:
          - /url: /ar/alerts
          - img [ref=e13]
          - text: التنبيهات
        - link "Compare" [ref=e16] [cursor=pointer]:
          - /url: /ar/compare
          - img [ref=e17]
          - text: Compare
        - link "التقارير" [ref=e20] [cursor=pointer]:
          - /url: /ar/reports
          - img [ref=e21]
          - text: التقارير
        - link "الأسعار" [ref=e24] [cursor=pointer]:
          - /url: /ar/pricing
          - img [ref=e25]
          - text: الأسعار
        - link "اتصل بنا" [ref=e27] [cursor=pointer]:
          - /url: /ar/contact
          - img [ref=e28]
          - text: اتصل بنا
      - generic [ref=e31]:
        - generic [ref=e32]:
          - img [ref=e33]
          - button "FR" [ref=e36]
          - button "EN" [ref=e37]
          - button "ES" [ref=e38]
          - button "AR" [ref=e39]
          - button "ID" [ref=e40]
        - generic [ref=e42]:
          - link "تسجيل الدخول" [ref=e43] [cursor=pointer]:
            - /url: /ar/login
          - link "إنشاء حساب" [ref=e44] [cursor=pointer]:
            - /url: /ar/signup
  - main [ref=e45]:
    - generic [ref=e46]:
      - generic [ref=e47]:
        - generic [ref=e48]:
          - img [ref=e49]
          - text: مصمم للمنظمات الصحية وفرقها حول العالم
        - heading "استبق الأزمات. لا تكتفِ بالاستجابة." [level=1] [ref=e52]
        - paragraph [ref=e53]: قد يُكلِّف تفشٍّ واحد غير مكتشف في الوقت المناسب منظمتك أشهراً من إدارة الأزمات. توفر HealthWatch Global لفرقك بيانات استخباراتية فورية مباشرةً من منظمة الصحة العالمية.
        - generic [ref=e54]:
          - paragraph [ref=e55]: مصمم لـ
          - generic [ref=e56]:
            - generic [ref=e57]: وزارات الصحة
            - generic [ref=e58]: المنظمات غير الحكومية الدولية
            - generic [ref=e59]: المنظمات الإنسانية
            - generic [ref=e60]: معاهد البحوث
            - generic [ref=e61]: القطاع الصحي الخاص
      - generic [ref=e62]:
        - generic [ref=e63]:
          - img [ref=e64]
          - generic [ref=e68]:
            - generic [ref=e69]:
              - generic [ref=e70]: مجاني
              - generic [ref=e71]: 0 €
            - paragraph [ref=e72]: اكتشف المنصة بدون التزام.
            - list [ref=e73]:
              - listitem [ref=e74]:
                - img [ref=e75]
                - text: منطقة واحدة مراقبة
              - listitem [ref=e77]:
                - img [ref=e78]
                - text: ملخص بريدي أسبوعي
              - listitem [ref=e80]:
                - img [ref=e81]
                - text: الوصول إلى لوحة التحكم العامة
              - listitem [ref=e83]:
                - img [ref=e84]
                - text: بيانات WHO + CDC
        - link "اشترك مجاناً →" [ref=e86] [cursor=pointer]:
          - /url: /ar/signup
      - generic [ref=e87]:
        - generic [ref=e88]:
          - button "شهري" [ref=e89]
          - button "سنوي ‎-20%" [ref=e90]:
            - text: سنوي
            - generic [ref=e91]: ‎-20%
        - generic [ref=e92]:
          - generic [ref=e93]:
            - generic [ref=e94]:
              - generic [ref=e95]:
                - img [ref=e96]
                - generic [ref=e98]: Free
              - generic [ref=e100]: 0 €
              - paragraph [ref=e101]: استكشف المنصة دون أي التزام.
            - list [ref=e102]:
              - listitem [ref=e103]:
                - img [ref=e104]
                - text: خريطة العالم التفاعلية
              - listitem [ref=e106]:
                - img [ref=e107]
                - text: منطقة مراقبة واحدة
              - listitem [ref=e109]:
                - img [ref=e110]
                - text: بيانات WHO المباشرة
              - listitem [ref=e112]:
                - img [ref=e113]
                - text: ملخص أسبوعي مجاني
              - listitem [ref=e115]:
                - img [ref=e116]
                - text: لوحة تحكم متعددة اللغات
            - link "ابدأ الآن ←" [ref=e118] [cursor=pointer]:
              - /url: /ar/signup
          - generic [ref=e119]:
            - generic [ref=e120]: الأكثر شعبية
            - generic [ref=e121]:
              - generic [ref=e122]:
                - img [ref=e123]
                - generic [ref=e125]: Pro
              - generic [ref=e126]:
                - generic [ref=e127]: 49$
                - generic [ref=e128]: /شهر
              - paragraph [ref=e129]: لوزارات الصحة والمنظمات غير الحكومية الدولية.
            - list [ref=e130]:
              - listitem [ref=e131]:
                - img [ref=e132]
                - text: جميع المناطق العالمية
              - listitem [ref=e134]:
                - img [ref=e135]
                - text: تنبيهات فورية
              - listitem [ref=e137]:
                - img [ref=e138]
                - text: تقارير PDF تلقائية
              - listitem [ref=e140]:
                - img [ref=e141]
                - text: تكامل Slack / Teams
              - listitem [ref=e143]:
                - img [ref=e144]
                - text: تصدير CSV غير محدود
              - listitem [ref=e146]:
                - img [ref=e147]
                - text: دعم ذو أولوية
            - generic [ref=e149]:
              - img [ref=e150]
              - generic [ref=e153]: 14 يوماً مجاناً · بدون بطاقة
            - button "ابدأ الآن ←" [ref=e155] [cursor=pointer]
            - generic [ref=e156]:
              - img [ref=e157]
              - text: بدون التزام · استرداد 14 يوماً
          - generic [ref=e162]:
            - generic [ref=e163]:
              - generic [ref=e164]:
                - img [ref=e165]
                - generic [ref=e169]: Enterprise
              - generic [ref=e171]: حسب الطلب
              - paragraph [ref=e172]: للحكومات وكبرى مجموعات الأدوية.
            - list [ref=e173]:
              - listitem [ref=e174]:
                - img [ref=e175]
                - text: كل ما في Pro
              - listitem [ref=e177]:
                - img [ref=e178]
                - text: الوصول لـ REST API + التوثيق
              - listitem [ref=e180]:
                - img [ref=e181]
                - text: نشر محلي
              - listitem [ref=e183]:
                - img [ref=e184]
                - text: ضمان SLA 99.9%
              - listitem [ref=e186]:
                - img [ref=e187]
                - text: مدير حساب مخصص
              - listitem [ref=e189]:
                - img [ref=e190]
                - text: دعم مخصص 24/7
            - link "اتصل بنا" [ref=e192] [cursor=pointer]:
              - /url: mailto:contact@healthwatch-global.com?subject=Enterprise Plan - HealthWatch Global
              - img [ref=e193]
              - text: اتصل بنا
      - generic [ref=e196]:
        - img [ref=e198]
        - generic [ref=e203]:
          - paragraph [ref=e204]: بدون التزام. استرداد خلال 14 يوماً.
          - paragraph [ref=e205]: بدون التزام. إذا لم تكن راضياً خلال 14 يوماً من دفعتك الأولى، نعيد إليك المبلغ كاملاً دون أسئلة.
      - generic [ref=e206]:
        - generic [ref=e207]:
          - img [ref=e208]
          - heading "تكلفة عدم المعرفة" [level=2] [ref=e211]
        - paragraph [ref=e212]: تُعلن منظمة الصحة العالمية عن 15 إلى 25 تفشياً جديداً للأمراض كل شهر. تفشٍّ واحد يصل إلى منطقتك قبل إحاطة فريقك قد يعني أسابيع من العمليات التفاعلية والأضرار المؤسسية. بـ 49 دولار/شهر، تكلفة خطة Pro أقل من ساعة واحدة لإدارة الأزمات.
      - generic [ref=e213]:
        - heading "مقارنة شاملة للميزات" [level=2] [ref=e214]
        - table [ref=e216]:
          - rowgroup [ref=e217]:
            - row "Free Pro Enterprise" [ref=e218]:
              - columnheader [ref=e219]
              - columnheader "Free" [ref=e220]
              - columnheader "Pro" [ref=e221]
              - columnheader "Enterprise" [ref=e222]
          - rowgroup [ref=e223]:
            - row "خريطة التفشيات المباشرة" [ref=e224]:
              - cell "خريطة التفشيات المباشرة" [ref=e225]
              - cell [ref=e226]:
                - img [ref=e227]
              - cell [ref=e229]:
                - img [ref=e230]
              - cell [ref=e232]:
                - img [ref=e233]
            - row "بيانات منظمة الصحة العالمية DON" [ref=e235]:
              - cell "بيانات منظمة الصحة العالمية DON" [ref=e236]
              - cell [ref=e237]:
                - img [ref=e238]
              - cell [ref=e240]:
                - img [ref=e241]
              - cell [ref=e243]:
                - img [ref=e244]
            - row "المناطق المراقبة 1 جميعها جميعها" [ref=e246]:
              - cell "المناطق المراقبة" [ref=e247]
              - cell "1" [ref=e248]:
                - generic [ref=e249]: "1"
              - cell "جميعها" [ref=e250]:
                - generic [ref=e251]: جميعها
              - cell "جميعها" [ref=e252]:
                - generic [ref=e253]: جميعها
            - row "أرقام دقيقة (حالات ووفيات) —" [ref=e254]:
              - cell "أرقام دقيقة (حالات ووفيات)" [ref=e255]
              - cell "—" [ref=e256]:
                - generic [ref=e257]: —
              - cell [ref=e258]:
                - img [ref=e259]
              - cell [ref=e261]:
                - img [ref=e262]
            - row "ملخص بريدي أسبوعي" [ref=e264]:
              - cell "ملخص بريدي أسبوعي" [ref=e265]
              - cell [ref=e266]:
                - img [ref=e267]
              - cell [ref=e269]:
                - img [ref=e270]
              - cell [ref=e272]:
                - img [ref=e273]
            - row "تنبيهات بريدية إقليمية — جميع المناطق جميع المناطق" [ref=e275]:
              - cell "تنبيهات بريدية إقليمية" [ref=e276]
              - cell "—" [ref=e277]:
                - generic [ref=e278]: —
              - cell "جميع المناطق" [ref=e279]:
                - generic [ref=e280]: جميع المناطق
              - cell "جميع المناطق" [ref=e281]:
                - generic [ref=e282]: جميع المناطق
            - row "تنبيهات فورية (جميع المناطق) —" [ref=e283]:
              - cell "تنبيهات فورية (جميع المناطق)" [ref=e284]
              - cell "—" [ref=e285]:
                - generic [ref=e286]: —
              - cell [ref=e287]:
                - img [ref=e288]
              - cell [ref=e290]:
                - img [ref=e291]
            - row "تقارير PDF إقليمية — جميع المناطق جميع المناطق" [ref=e293]:
              - cell "تقارير PDF إقليمية" [ref=e294]
              - cell "—" [ref=e295]:
                - generic [ref=e296]: —
              - cell "جميع المناطق" [ref=e297]:
                - generic [ref=e298]: جميع المناطق
              - cell "جميع المناطق" [ref=e299]:
                - generic [ref=e300]: جميع المناطق
            - row "تصدير البيانات CSV —" [ref=e301]:
              - cell "تصدير البيانات CSV" [ref=e302]
              - cell "—" [ref=e303]:
                - generic [ref=e304]: —
              - cell [ref=e305]:
                - img [ref=e306]
              - cell [ref=e308]:
                - img [ref=e309]
            - row "تكامل Slack / Teams —" [ref=e311]:
              - cell "تكامل Slack / Teams" [ref=e312]
              - cell "—" [ref=e313]:
                - generic [ref=e314]: —
              - cell [ref=e315]:
                - img [ref=e316]
              - cell [ref=e318]:
                - img [ref=e319]
            - row "الوصول لـ REST API — —" [ref=e321]:
              - cell "الوصول لـ REST API" [ref=e322]
              - cell "—" [ref=e323]:
                - generic [ref=e324]: —
              - cell "—" [ref=e325]:
                - generic [ref=e326]: —
              - cell [ref=e327]:
                - img [ref=e328]
            - row "نشر محلي — —" [ref=e330]:
              - cell "نشر محلي" [ref=e331]
              - cell "—" [ref=e332]:
                - generic [ref=e333]: —
              - cell "—" [ref=e334]:
                - generic [ref=e335]: —
              - cell [ref=e336]:
                - img [ref=e337]
            - row "ضمان SLA 99.9% — —" [ref=e339]:
              - cell "ضمان SLA 99.9%" [ref=e340]
              - cell "—" [ref=e341]:
                - generic [ref=e342]: —
              - cell "—" [ref=e343]:
                - generic [ref=e344]: —
              - cell [ref=e345]:
                - img [ref=e346]
            - row "مدير حساب مخصص — —" [ref=e348]:
              - cell "مدير حساب مخصص" [ref=e349]
              - cell "—" [ref=e350]:
                - generic [ref=e351]: —
              - cell "—" [ref=e352]:
                - generic [ref=e353]: —
              - cell [ref=e354]:
                - img [ref=e355]
            - row "الدعم بريد إلكتروني أولوية مخصص" [ref=e357]:
              - cell "الدعم" [ref=e358]
              - cell "بريد إلكتروني" [ref=e359]:
                - generic [ref=e360]: بريد إلكتروني
              - cell "أولوية" [ref=e361]:
                - generic [ref=e362]: أولوية
              - cell "مخصص" [ref=e363]:
                - generic [ref=e364]: مخصص
      - generic [ref=e365]:
        - paragraph [ref=e366]: مصمم لـ
        - generic [ref=e367]:
          - generic [ref=e368]:
            - img [ref=e370]
            - paragraph [ref=e372]: وزارات الصحة
          - generic [ref=e373]:
            - img [ref=e375]
            - paragraph [ref=e377]: المنظمات غير الحكومية
          - generic [ref=e378]:
            - img [ref=e380]
            - paragraph [ref=e384]: معاهد البحوث
          - generic [ref=e385]:
            - img [ref=e387]
            - paragraph [ref=e391]: المستشفيات والعيادات
        - generic [ref=e392]:
          - generic [ref=e393]:
            - img [ref=e394]
            - generic [ref=e397]: "195"
            - generic [ref=e398]: دولة مغطاة
          - generic [ref=e399]:
            - img [ref=e400]
            - generic [ref=e402]: 99.9%
            - generic [ref=e403]: وقت التشغيل
          - generic [ref=e404]:
            - img [ref=e405]
            - generic [ref=e410]: "5"
            - generic [ref=e411]: لغات
          - generic [ref=e412]:
            - img [ref=e413]
            - generic [ref=e415]: GDPR
            - generic [ref=e416]: الامتثال
      - generic [ref=e417]:
        - generic [ref=e418]:
          - img [ref=e420]
          - generic [ref=e422]:
            - paragraph [ref=e423]: سعر المنظمات غير الحكومية — حتى −30%
            - paragraph [ref=e424]: هل أنتم منظمة غير حكومية أو هيئة إنسانية أو معهد بحثي غير ربحي؟ تواصلوا معنا للحصول على سعر مخصص.
        - link "طلب سعر ←" [ref=e425] [cursor=pointer]:
          - /url: /ar/contact
      - generic [ref=e426]:
        - img [ref=e427]
        - heading "لست متأكداً من الخطة المناسبة؟" [level=2] [ref=e432]
        - paragraph [ref=e433]: احجز مكالمة مدتها 20 دقيقة. سنحلل احتياجاتك في المراقبة ونوصي بالخطة المناسبة — دون ضغوط تجارية.
        - link "اتصل بنا" [ref=e434] [cursor=pointer]:
          - /url: /ar/contact
          - img [ref=e435]
          - text: اتصل بنا
          - img [ref=e438]
      - generic [ref=e440]:
        - heading "أسئلة مكررة" [level=2] [ref=e441]
        - generic [ref=e442]:
          - paragraph [ref=e443]: هل يمكنني الإلغاء في أي وقت؟
          - paragraph [ref=e444]: نعم، بدون التزام. يمكنك إلغاء اشتراكك في أي وقت من حسابك.
        - generic [ref=e445]:
          - paragraph [ref=e446]: هل يتم تحديث البيانات في الوقت الفعلي؟
          - paragraph [ref=e447]: نعم. نقوم بتجميع بيانات منظمة الصحة العالمية و CDC و ECDC و ProMED باستمرار على مدار الساعة.
        - generic [ref=e448]:
          - paragraph [ref=e449]: هل يوجد خطة مجانية؟
          - paragraph [ref=e450]: نعم. تمنحك الخطة المجانية الوصول إلى لوحة التحكم العامة ومنطقة مراقبة واحدة والملخص الأسبوعي — دون بطاقة ائتمان أو حد زمني.
  - contentinfo [ref=e451]:
    - generic [ref=e453]:
      - generic [ref=e454]:
        - img [ref=e455]
        - generic [ref=e457]: HealthWatch Global
        - generic [ref=e458]: ·
        - generic [ref=e459]: © 2026
      - navigation [ref=e460]:
        - link "حول المنصة" [ref=e461] [cursor=pointer]:
          - /url: /ar/about
        - link "سياسة الخصوصية" [ref=e462] [cursor=pointer]:
          - /url: /ar/privacy
        - link "شروط الاستخدام" [ref=e463] [cursor=pointer]:
          - /url: /ar/terms
        - link "الإشعار القانوني" [ref=e464] [cursor=pointer]:
          - /url: /ar/legal
        - link "تواصل معنا" [ref=e465] [cursor=pointer]:
          - /url: /ar/contact
        - link "contact@healthwatch-global.com" [ref=e466] [cursor=pointer]:
          - /url: mailto:contact@healthwatch-global.com
        - button "إعدادات ملفات الارتباط" [ref=e467]
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