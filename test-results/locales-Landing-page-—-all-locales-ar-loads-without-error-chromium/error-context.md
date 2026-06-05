# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: locales.spec.ts >> Landing page — all locales >> /ar loads without error
- Location: e2e\locales.spec.ts:11:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('HealthWatch')
Expected: visible
Error: strict mode violation: getByText('HealthWatch') resolved to 5 elements:
    1) <span class="font-bold text-lg text-white">HealthWatch Global</span> aka getByRole('navigation').filter({ hasText: 'HealthWatch Global' }).locator('span')
    2) <p class="text-gray-400 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">تفشٍّ واحد غير مكتشف في الوقت المناسب قد يُكلِّف …</p> aka getByText('تفشٍّ واحد غير مكتشف في الوقت المناسب قد يُكلِّف منظمتك أسابيع من إدارة الأزمات.')
    3) <p class="text-gray-400 max-w-2xl mx-auto leading-relaxed">معظم منظمات الصحة تعلم متأخرة. HealthWatch Global…</p> aka getByText('معظم منظمات الصحة تعلم متأخرة. HealthWatch Global تعكس هذا التأخير')
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
      - generic [ref=e48]:
        - generic [ref=e49]: بيانات منظمة الصحة العالمية مباشرة · 195 دولة · تحديث يومي
        - heading "استبق التفشيات. توقف عن التفاعل." [level=1] [ref=e51]:
          - text: استبق التفشيات.
          - text: توقف عن التفاعل.
        - paragraph [ref=e52]: تفشٍّ واحد غير مكتشف في الوقت المناسب قد يُكلِّف منظمتك أسابيع من إدارة الأزمات. توفر HealthWatch Global بيانات استخباراتية فورية لفرقك مباشرةً من منظمة الصحة العالمية.
        - generic [ref=e53]:
          - link "إنشاء حساب مجاني" [ref=e54] [cursor=pointer]:
            - /url: /ar/signup
            - text: إنشاء حساب مجاني
            - img [ref=e55]
          - link "عرض الأسعار" [ref=e57] [cursor=pointer]:
            - /url: /ar/pricing
        - paragraph [ref=e58]: مجاني · لا بطاقة بنكية مطلوبة
        - generic [ref=e59]:
          - generic [ref=e60]:
            - img [ref=e61]
            - paragraph [ref=e63]: "36"
            - paragraph [ref=e64]: تفشيات نشطة
          - generic [ref=e65]:
            - img [ref=e66]
            - paragraph [ref=e69]: "27"
            - paragraph [ref=e70]: دول متضررة
          - generic [ref=e71]:
            - img [ref=e72]
            - paragraph [ref=e74]: "15"
            - paragraph [ref=e75]: تنبيهات عالية الخطورة
          - generic [ref=e76]:
            - img [ref=e77]
            - paragraph [ref=e80]: تحديث يومي
      - generic [ref=e81]:
        - generic [ref=e82]:
          - heading "تُعلن منظمة الصحة العالمية عن 15 إلى 25 تفشياً جديداً كل شهر." [level=2] [ref=e83]
          - paragraph [ref=e84]: معظم منظمات الصحة تعلم متأخرة. HealthWatch Global تعكس هذا التأخير.
        - generic [ref=e85]:
          - generic [ref=e86]:
            - paragraph [ref=e87]: 15–25
            - paragraph [ref=e88]: تفشيات جديدة / شهر
          - generic [ref=e89]:
            - paragraph [ref=e90]: 72 ساعة
            - paragraph [ref=e91]: متوسط وقت الكشف
          - generic [ref=e92]:
            - paragraph [ref=e93]: × 10
            - paragraph [ref=e94]: تكلفة الاستجابة التفاعلية مقابل الاستباقية
      - generic [ref=e95]:
        - generic [ref=e96]:
          - generic [ref=e97]:
            - img [ref=e98]
            - text: مباشر
          - heading "ما ستراه فرقك في الوقت الفعلي" [level=2] [ref=e104]
          - paragraph [ref=e105]: البيانات أدناه حقيقية ومُحدَّثة مباشرةً من API أخبار تفشي أمراض منظمة الصحة العالمية.
        - generic [ref=e106]:
          - table [ref=e107]:
            - rowgroup [ref=e108]:
              - row "المرض الدولة الخطر" [ref=e109]:
                - columnheader "المرض" [ref=e110]
                - columnheader "الدولة" [ref=e111]
                - columnheader "الخطر" [ref=e112]
                - columnheader [ref=e113]
            - rowgroup [ref=e114]:
              - row "الكوليرا هايتي عالي 28 500 حالة" [ref=e115]:
                - cell "الكوليرا" [ref=e116]
                - cell "هايتي" [ref=e117]
                - cell "عالي" [ref=e118]
                - cell "28 500 حالة" [ref=e119]:
                  - generic [ref=e120]: 28 500 حالة
              - row "حمى الضنك البرازيل عالي 6 200 000 حالة" [ref=e121]:
                - cell "حمى الضنك" [ref=e122]
                - cell "البرازيل" [ref=e123]
                - cell "عالي" [ref=e124]
                - cell "6 200 000 حالة" [ref=e125]:
                  - generic [ref=e126]: 6 200 000 حالة
              - row "جدري القردة جمهورية الكونغو الديمقراطية عالي 19 845 حالة" [ref=e127]:
                - cell "جدري القردة" [ref=e128]
                - cell "جمهورية الكونغو الديمقراطية" [ref=e129]
                - cell "عالي" [ref=e130]
                - cell "19 845 حالة" [ref=e131]:
                  - generic [ref=e132]: 19 845 حالة
              - row "مرض فيروس إيبولا الكونغو الديمقراطية عالي 746 حالة" [ref=e133]:
                - cell "مرض فيروس إيبولا" [ref=e134]
                - cell "الكونغو الديمقراطية" [ref=e135]
                - cell "عالي" [ref=e136]
                - cell "746 حالة" [ref=e137]:
                  - generic [ref=e138]: 746 حالة
              - row "الكوليرا إثيوبيا عالي 8 320 حالة" [ref=e139]:
                - cell "الكوليرا" [ref=e140]
                - cell "إثيوبيا" [ref=e141]
                - cell "عالي" [ref=e142]
                - cell "8 320 حالة" [ref=e143]:
                  - generic [ref=e144]: 8 320 حالة
          - generic [ref=e145]:
            - generic [ref=e146]: "Source : WHO Disease Outbreak News"
            - link "إنشاء حساب مجاني →" [ref=e147] [cursor=pointer]:
              - /url: /ar/signup
      - generic [ref=e148]:
        - heading "كل ما يحتاجه فريقك" [level=2] [ref=e149]
        - generic [ref=e150]:
          - generic [ref=e151]:
            - img [ref=e153]
            - heading "تنبيهات الأمراض" [level=3] [ref=e156]
            - paragraph [ref=e157]: اشترك في H5N1 أو إيبولا أو جدري القرود… واستقبل بريداً إلكترونياً خلال 6 ساعات عند اكتشاف أي تفشٍّ في العالم.
          - generic [ref=e158]:
            - img [ref=e160]
            - heading "شارة PHEIC والتحقق المزدوج" [level=3] [ref=e166]
            - paragraph [ref=e167]: 🚨 شارة PHEIC على كل حالة طوارئ تُعلنها OMS. 🔁 WHO+ProMED يؤكد التفشيات متعددة المصادر.
          - generic [ref=e168]:
            - img [ref=e170]
            - heading "معدل الوفيات والإصابة" [level=3] [ref=e173]
            - paragraph [ref=e174]: CFR يُحسب تلقائياً. معدل الإصابة لكل 100,000 نسمة مع بيانات سكان الأمم المتحدة لـ 150 دولة.
          - generic [ref=e175]:
            - img [ref=e177]
            - heading "مقارنة التفشيات" [level=3] [ref=e180]
            - paragraph [ref=e181]: "إيبولا في الكونغو مقابل أوغندا: الحالات والوفيات ومعدل الوفيات والإصابة جنباً إلى جنب. شارك الرابط مع زملائك."
          - generic [ref=e182]:
            - img [ref=e184]
            - heading "قائمة المراقبة والإشعارات" [level=3] [ref=e187]
            - paragraph [ref=e188]: تتبع ⭐ حتى 20 تفشياً. إشعار تلقائي بالبريد عند تغيير الأرقام.
          - generic [ref=e189]:
            - img [ref=e191]
            - heading "تقارير PDF وويدجت" [level=3] [ref=e193]
            - paragraph [ref=e194]: تقرير PDF احترافي لكل تفشٍّ بنقرة واحدة. ويدجت قابل للتضمين في موقعك. بطاقة PNG للمشاركة.
      - generic [ref=e195]:
        - heading "جاهز للعمل في 3 دقائق" [level=2] [ref=e196]
        - generic [ref=e197]:
          - generic [ref=e198]:
            - generic [ref=e199]: "1"
            - generic [ref=e200]:
              - heading "أنشئ حسابك" [level=3] [ref=e201]
              - paragraph [ref=e202]: التسجيل في 30 ثانية. لا بطاقة بنكية. وصول فوري للوحة التحكم.
          - generic [ref=e203]:
            - generic [ref=e204]: "2"
            - generic [ref=e205]:
              - heading "حدد مناطقك" [level=3] [ref=e206]
              - paragraph [ref=e207]: اختر المناطق الجغرافية التي تراقبها واستقبل أول ملخص الأسبوع التالي.
          - generic [ref=e208]:
            - generic [ref=e209]: "3"
            - generic [ref=e210]:
              - heading "انتقل إلى Pro للتنبيهات الفورية" [level=3] [ref=e211]
              - paragraph [ref=e212]: افتح البث المباشر وتقارير PDF وتصدير CSV.
      - generic [ref=e213]:
        - paragraph [ref=e214]: مصمم لـ
        - generic [ref=e215]:
          - generic [ref=e216]:
            - img [ref=e218]
            - paragraph [ref=e220]: وزارات الصحة
          - generic [ref=e221]:
            - img [ref=e223]
            - paragraph [ref=e225]: المنظمات غير الحكومية الدولية
          - generic [ref=e226]:
            - img [ref=e228]
            - paragraph [ref=e232]: معاهد البحوث
          - generic [ref=e233]:
            - img [ref=e235]
            - paragraph [ref=e239]: المستشفيات والعيادات
      - generic [ref=e240]:
        - heading "ابدأ مجاناً. طوِّر عندما تحتاج." [level=2] [ref=e241]
        - generic [ref=e242]:
          - generic [ref=e243]:
            - generic [ref=e244]:
              - img [ref=e245]
              - generic [ref=e248]: مجاني
            - paragraph [ref=e249]: 0 €
            - paragraph [ref=e250]: خريطة عالمية · منطقة واحدة · ملخص أسبوعي
          - generic [ref=e251]:
            - generic [ref=e252]:
              - img [ref=e253]
              - generic [ref=e255]: Pro
            - paragraph [ref=e256]: 49$ / شهر
            - paragraph [ref=e257]: جميع المناطق · تنبيهات · PDF · CSV · Slack
          - generic [ref=e258]:
            - generic [ref=e259]:
              - img [ref=e260]
              - generic [ref=e262]: Enterprise
            - paragraph [ref=e263]: حسب الطلب
            - paragraph [ref=e264]: API · نشر محلي · SLA 99.9%
        - link "عرض جميع الخطط ←" [ref=e266] [cursor=pointer]:
          - /url: /ar/pricing
      - generic [ref=e267]:
        - generic [ref=e268]:
          - heading "ابقَ على اطلاع — مجاناً" [level=2] [ref=e269]
          - paragraph [ref=e270]: ملخص أسبوعي بالتفشيات النشطة، مصفى حسب المنطقة، يصل مباشرة إلى بريدك الإلكتروني.
        - generic [ref=e271]:
          - generic [ref=e272]:
            - textbox "أنت@منظمة.com" [ref=e273]
            - combobox "المنطقة" [ref=e274]:
              - option "جميع المناطق" [selected]
              - option "أفريقيا"
              - option "آسيا"
              - option "أوروبا"
              - option "الأمريكتان"
              - option "أوقيانوسيا"
            - button "اشترك" [ref=e275]:
              - img [ref=e276]
              - text: اشترك
          - paragraph [ref=e279]: مجاني · بدون بطاقة · إلغاء الاشتراك بنقرة واحدة
      - generic [ref=e281]:
        - generic [ref=e282]:
          - img [ref=e284]
          - img [ref=e289]
          - img [ref=e292]
        - heading "هل منظمتك مستعدة للتفشي القادم؟" [level=2] [ref=e296]
        - paragraph [ref=e297]: انضم إلى الفرق التي تراقب الأزمات الصحية العالمية في الوقت الفعلي.
        - generic [ref=e298]:
          - link "ابدأ مجاناً" [ref=e299] [cursor=pointer]:
            - /url: /ar/signup
            - text: ابدأ مجاناً
            - img [ref=e300]
          - paragraph [ref=e302]: بدون بطاقة بنكية · وصول فوري
  - contentinfo [ref=e303]:
    - generic [ref=e305]:
      - generic [ref=e306]:
        - img [ref=e307]
        - generic [ref=e309]: HealthWatch Global
        - generic [ref=e310]: ·
        - generic [ref=e311]: © 2026
      - navigation [ref=e312]:
        - link "حول المنصة" [ref=e313] [cursor=pointer]:
          - /url: /ar/about
        - link "سياسة الخصوصية" [ref=e314] [cursor=pointer]:
          - /url: /ar/privacy
        - link "شروط الاستخدام" [ref=e315] [cursor=pointer]:
          - /url: /ar/terms
        - link "الإشعار القانوني" [ref=e316] [cursor=pointer]:
          - /url: /ar/legal
        - link "تواصل معنا" [ref=e317] [cursor=pointer]:
          - /url: /ar/contact
        - link "contact@healthwatch-global.com" [ref=e318] [cursor=pointer]:
          - /url: mailto:contact@healthwatch-global.com
        - button "إعدادات ملفات الارتباط" [ref=e319]
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