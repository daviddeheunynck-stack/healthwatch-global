# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: locales.spec.ts >> Pricing page — all locales >> /id/pricing loads
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
        - link "Dasbor" [ref=e9] [cursor=pointer]:
          - /url: /id
          - img [ref=e10]
          - text: Dasbor
        - link "Peringatan" [ref=e12] [cursor=pointer]:
          - /url: /id/alerts
          - img [ref=e13]
          - text: Peringatan
        - link "Compare" [ref=e16] [cursor=pointer]:
          - /url: /id/compare
          - img [ref=e17]
          - text: Compare
        - link "Laporan" [ref=e20] [cursor=pointer]:
          - /url: /id/reports
          - img [ref=e21]
          - text: Laporan
        - link "Harga" [ref=e24] [cursor=pointer]:
          - /url: /id/pricing
          - img [ref=e25]
          - text: Harga
        - link "Kontak" [ref=e27] [cursor=pointer]:
          - /url: /id/contact
          - img [ref=e28]
          - text: Kontak
      - generic [ref=e31]:
        - generic [ref=e32]:
          - img [ref=e33]
          - button "FR" [ref=e36]
          - button "EN" [ref=e37]
          - button "ES" [ref=e38]
          - button "AR" [ref=e39]
          - button "ID" [ref=e40]
        - generic [ref=e42]:
          - link "Masuk" [ref=e43] [cursor=pointer]:
            - /url: /id/login
          - link "Buat akun" [ref=e44] [cursor=pointer]:
            - /url: /id/signup
  - main [ref=e45]:
    - generic [ref=e46]:
      - generic [ref=e47]:
        - generic [ref=e48]:
          - img [ref=e49]
          - text: Dirancang untuk organisasi kesehatan dan tim mereka di seluruh dunia
        - heading "Antisipasi. Jangan hanya bereaksi." [level=1] [ref=e52]
        - paragraph [ref=e53]: Satu wabah yang tidak terdeteksi tepat waktu bisa menelan biaya berbulan-bulan manajemen krisis. HealthWatch Global memberikan intelijen real-time kepada tim Anda, langsung dari WHO.
        - generic [ref=e54]:
          - paragraph [ref=e55]: Dirancang untuk
          - generic [ref=e56]:
            - generic [ref=e57]: Kementerian Kesehatan
            - generic [ref=e58]: LSM Internasional
            - generic [ref=e59]: Organisasi Kemanusiaan
            - generic [ref=e60]: Lembaga Penelitian
            - generic [ref=e61]: Sektor Kesehatan Swasta
      - generic [ref=e62]:
        - generic [ref=e63]:
          - img [ref=e64]
          - generic [ref=e68]:
            - generic [ref=e69]:
              - generic [ref=e70]: Gratis
              - generic [ref=e71]: 0 €
            - paragraph [ref=e72]: Jelajahi platform tanpa komitmen.
            - list [ref=e73]:
              - listitem [ref=e74]:
                - img [ref=e75]
                - text: 1 wilayah dipantau
              - listitem [ref=e77]:
                - img [ref=e78]
                - text: Digest email mingguan
              - listitem [ref=e80]:
                - img [ref=e81]
                - text: Akses dasbor publik
              - listitem [ref=e83]:
                - img [ref=e84]
                - text: Data WHO + CDC
        - link "Berlangganan gratis →" [ref=e86] [cursor=pointer]:
          - /url: /id/signup
      - generic [ref=e87]:
        - generic [ref=e88]:
          - button "Bulanan" [ref=e89]
          - button "Tahunan -20%" [ref=e90]:
            - text: Tahunan
            - generic [ref=e91]: "-20%"
        - generic [ref=e92]:
          - generic [ref=e93]:
            - generic [ref=e94]:
              - generic [ref=e95]:
                - img [ref=e96]
                - generic [ref=e98]: Free
              - generic [ref=e100]: 0 €
              - paragraph [ref=e101]: Jelajahi platform tanpa komitmen.
            - list [ref=e102]:
              - listitem [ref=e103]:
                - img [ref=e104]
                - text: Peta dunia interaktif
              - listitem [ref=e106]:
                - img [ref=e107]
                - text: 1 wilayah dipantau
              - listitem [ref=e109]:
                - img [ref=e110]
                - text: Data WHO langsung
              - listitem [ref=e112]:
                - img [ref=e113]
                - text: Digest mingguan gratis
              - listitem [ref=e115]:
                - img [ref=e116]
                - text: Dasbor multibahasa
            - link "Mulai →" [ref=e118] [cursor=pointer]:
              - /url: /id/signup
          - generic [ref=e119]:
            - generic [ref=e120]: Paling populer
            - generic [ref=e121]:
              - generic [ref=e122]:
                - img [ref=e123]
                - generic [ref=e125]: Pro
              - generic [ref=e126]:
                - generic [ref=e127]: $49
                - generic [ref=e128]: /bulan
              - paragraph [ref=e129]: Untuk kementerian kesehatan dan LSM internasional.
            - list [ref=e130]:
              - listitem [ref=e131]:
                - img [ref=e132]
                - text: Semua wilayah global
              - listitem [ref=e134]:
                - img [ref=e135]
                - text: Peringatan real-time
              - listitem [ref=e137]:
                - img [ref=e138]
                - text: Laporan PDF otomatis
              - listitem [ref=e140]:
                - img [ref=e141]
                - text: Integrasi Slack / Teams
              - listitem [ref=e143]:
                - img [ref=e144]
                - text: Ekspor CSV tak terbatas
              - listitem [ref=e146]:
                - img [ref=e147]
                - text: Dukungan prioritas
            - generic [ref=e149]:
              - img [ref=e150]
              - generic [ref=e153]: 14 hari gratis · tanpa kartu
            - button "Mulai →" [ref=e155] [cursor=pointer]
            - generic [ref=e156]:
              - img [ref=e157]
              - text: Tanpa komitmen · Pengembalian 14 hari
          - generic [ref=e162]:
            - generic [ref=e163]:
              - generic [ref=e164]:
                - img [ref=e165]
                - generic [ref=e169]: Enterprise
              - generic [ref=e171]: Kustom
              - paragraph [ref=e172]: Untuk pemerintah dan kelompok farmasi besar.
            - list [ref=e173]:
              - listitem [ref=e174]:
                - img [ref=e175]
                - text: Semua fitur Pro
              - listitem [ref=e177]:
                - img [ref=e178]
                - text: Akses REST API + dokumentasi
              - listitem [ref=e180]:
                - img [ref=e181]
                - text: Penerapan on-premise
              - listitem [ref=e183]:
                - img [ref=e184]
                - text: Jaminan SLA 99,9%
              - listitem [ref=e186]:
                - img [ref=e187]
                - text: Manajer akun khusus
              - listitem [ref=e189]:
                - img [ref=e190]
                - text: Dukungan 24/7 khusus
            - link "Hubungi kami" [ref=e192] [cursor=pointer]:
              - /url: mailto:contact@healthwatch-global.com?subject=Enterprise Plan - HealthWatch Global
              - img [ref=e193]
              - text: Hubungi kami
      - generic [ref=e196]:
        - img [ref=e198]
        - generic [ref=e203]:
          - paragraph [ref=e204]: Tanpa komitmen. Pengembalian dana 14 hari.
          - paragraph [ref=e205]: Tanpa komitmen. Jika tidak puas dalam 14 hari setelah pembayaran pertama, kami kembalikan uang Anda tanpa pertanyaan.
      - generic [ref=e206]:
        - generic [ref=e207]:
          - img [ref=e208]
          - heading "Biaya ketidaktahuan" [level=2] [ref=e211]
        - paragraph [ref=e212]: WHO mendeklarasikan 15–25 wabah penyakit baru setiap bulan. Satu wabah yang mencapai wilayah Anda sebelum tim Anda mendapat informasi bisa berarti berminggu-minggu operasi reaktif dan kerusakan reputasi. Dengan $49/bulan, Pro lebih murah dari satu jam manajemen krisis.
      - generic [ref=e213]:
        - heading "Perbandingan fitur lengkap" [level=2] [ref=e214]
        - table [ref=e216]:
          - rowgroup [ref=e217]:
            - row "Free Pro Enterprise" [ref=e218]:
              - columnheader [ref=e219]
              - columnheader "Free" [ref=e220]
              - columnheader "Pro" [ref=e221]
              - columnheader "Enterprise" [ref=e222]
          - rowgroup [ref=e223]:
            - row "Peta wabah langsung" [ref=e224]:
              - cell "Peta wabah langsung" [ref=e225]
              - cell [ref=e226]:
                - img [ref=e227]
              - cell [ref=e229]:
                - img [ref=e230]
              - cell [ref=e232]:
                - img [ref=e233]
            - row "Data WHO DON" [ref=e235]:
              - cell "Data WHO DON" [ref=e236]
              - cell [ref=e237]:
                - img [ref=e238]
              - cell [ref=e240]:
                - img [ref=e241]
              - cell [ref=e243]:
                - img [ref=e244]
            - row "Wilayah yang dipantau 1 Semua Semua" [ref=e246]:
              - cell "Wilayah yang dipantau" [ref=e247]
              - cell "1" [ref=e248]:
                - generic [ref=e249]: "1"
              - cell "Semua" [ref=e250]:
                - generic [ref=e251]: Semua
              - cell "Semua" [ref=e252]:
                - generic [ref=e253]: Semua
            - row "Angka tepat (kasus & kematian) —" [ref=e254]:
              - cell "Angka tepat (kasus & kematian)" [ref=e255]
              - cell "—" [ref=e256]:
                - generic [ref=e257]: —
              - cell [ref=e258]:
                - img [ref=e259]
              - cell [ref=e261]:
                - img [ref=e262]
            - row "Digest email mingguan" [ref=e264]:
              - cell "Digest email mingguan" [ref=e265]
              - cell [ref=e266]:
                - img [ref=e267]
              - cell [ref=e269]:
                - img [ref=e270]
              - cell [ref=e272]:
                - img [ref=e273]
            - row "Peringatan email regional — Semua wilayah Semua wilayah" [ref=e275]:
              - cell "Peringatan email regional" [ref=e276]
              - cell "—" [ref=e277]:
                - generic [ref=e278]: —
              - cell "Semua wilayah" [ref=e279]:
                - generic [ref=e280]: Semua wilayah
              - cell "Semua wilayah" [ref=e281]:
                - generic [ref=e282]: Semua wilayah
            - row "Peringatan real-time (semua wilayah) —" [ref=e283]:
              - cell "Peringatan real-time (semua wilayah)" [ref=e284]
              - cell "—" [ref=e285]:
                - generic [ref=e286]: —
              - cell [ref=e287]:
                - img [ref=e288]
              - cell [ref=e290]:
                - img [ref=e291]
            - row "Laporan PDF regional — Semua wilayah Semua wilayah" [ref=e293]:
              - cell "Laporan PDF regional" [ref=e294]
              - cell "—" [ref=e295]:
                - generic [ref=e296]: —
              - cell "Semua wilayah" [ref=e297]:
                - generic [ref=e298]: Semua wilayah
              - cell "Semua wilayah" [ref=e299]:
                - generic [ref=e300]: Semua wilayah
            - row "Ekspor data CSV —" [ref=e301]:
              - cell "Ekspor data CSV" [ref=e302]
              - cell "—" [ref=e303]:
                - generic [ref=e304]: —
              - cell [ref=e305]:
                - img [ref=e306]
              - cell [ref=e308]:
                - img [ref=e309]
            - row "Integrasi Slack / Teams —" [ref=e311]:
              - cell "Integrasi Slack / Teams" [ref=e312]
              - cell "—" [ref=e313]:
                - generic [ref=e314]: —
              - cell [ref=e315]:
                - img [ref=e316]
              - cell [ref=e318]:
                - img [ref=e319]
            - row "Akses REST API — —" [ref=e321]:
              - cell "Akses REST API" [ref=e322]
              - cell "—" [ref=e323]:
                - generic [ref=e324]: —
              - cell "—" [ref=e325]:
                - generic [ref=e326]: —
              - cell [ref=e327]:
                - img [ref=e328]
            - row "Penerapan on-premise — —" [ref=e330]:
              - cell "Penerapan on-premise" [ref=e331]
              - cell "—" [ref=e332]:
                - generic [ref=e333]: —
              - cell "—" [ref=e334]:
                - generic [ref=e335]: —
              - cell [ref=e336]:
                - img [ref=e337]
            - row "SLA 99,9% — —" [ref=e339]:
              - cell "SLA 99,9%" [ref=e340]
              - cell "—" [ref=e341]:
                - generic [ref=e342]: —
              - cell "—" [ref=e343]:
                - generic [ref=e344]: —
              - cell [ref=e345]:
                - img [ref=e346]
            - row "Manajer akun khusus — —" [ref=e348]:
              - cell "Manajer akun khusus" [ref=e349]
              - cell "—" [ref=e350]:
                - generic [ref=e351]: —
              - cell "—" [ref=e352]:
                - generic [ref=e353]: —
              - cell [ref=e354]:
                - img [ref=e355]
            - row "Dukungan Email Prioritas Khusus" [ref=e357]:
              - cell "Dukungan" [ref=e358]
              - cell "Email" [ref=e359]:
                - generic [ref=e360]: Email
              - cell "Prioritas" [ref=e361]:
                - generic [ref=e362]: Prioritas
              - cell "Khusus" [ref=e363]:
                - generic [ref=e364]: Khusus
      - generic [ref=e365]:
        - paragraph [ref=e366]: Dirancang untuk
        - generic [ref=e367]:
          - generic [ref=e368]:
            - img [ref=e370]
            - paragraph [ref=e372]: Kementerian Kesehatan
          - generic [ref=e373]:
            - img [ref=e375]
            - paragraph [ref=e377]: LSM Internasional
          - generic [ref=e378]:
            - img [ref=e380]
            - paragraph [ref=e384]: Lembaga Penelitian
          - generic [ref=e385]:
            - img [ref=e387]
            - paragraph [ref=e391]: Rumah Sakit & Klinik
        - generic [ref=e392]:
          - generic [ref=e393]:
            - img [ref=e394]
            - generic [ref=e397]: "195"
            - generic [ref=e398]: negara tercakup
          - generic [ref=e399]:
            - img [ref=e400]
            - generic [ref=e402]: 99.9%
            - generic [ref=e403]: uptime
          - generic [ref=e404]:
            - img [ref=e405]
            - generic [ref=e410]: "5"
            - generic [ref=e411]: bahasa
          - generic [ref=e412]:
            - img [ref=e413]
            - generic [ref=e415]: GDPR
            - generic [ref=e416]: kepatuhan
      - generic [ref=e417]:
        - generic [ref=e418]:
          - img [ref=e420]
          - generic [ref=e422]:
            - paragraph [ref=e423]: Harga LSM — hingga −30%
            - paragraph [ref=e424]: Apakah Anda LSM, organisasi kemanusiaan, atau lembaga riset nirlaba? Hubungi kami untuk tarif khusus.
        - link "Minta tarif →" [ref=e425] [cursor=pointer]:
          - /url: /id/contact
      - generic [ref=e426]:
        - img [ref=e427]
        - heading "Tidak yakin paket mana yang cocok?" [level=2] [ref=e432]
        - paragraph [ref=e433]: Jadwalkan panggilan 20 menit. Kami akan memetakan kebutuhan pemantauan Anda dan merekomendasikan paket yang tepat — tanpa tekanan penjualan.
        - link "Hubungi kami" [ref=e434] [cursor=pointer]:
          - /url: /id/contact
          - img [ref=e435]
          - text: Hubungi kami
          - img [ref=e438]
      - generic [ref=e440]:
        - heading "Pertanyaan yang sering diajukan" [level=2] [ref=e441]
        - generic [ref=e442]:
          - paragraph [ref=e443]: Bisakah saya membatalkan kapan saja?
          - paragraph [ref=e444]: Ya, tanpa komitmen. Anda dapat membatalkan langganan kapan saja dari akun Anda.
        - generic [ref=e445]:
          - paragraph [ref=e446]: Apakah data diperbarui secara real-time?
          - paragraph [ref=e447]: Ya. Kami terus mengumpulkan data dari WHO, CDC, ECDC dan ProMED, 24/7.
        - generic [ref=e448]:
          - paragraph [ref=e449]: Apakah ada paket gratis?
          - paragraph [ref=e450]: Ya. Paket Gratis memberikan akses ke dasbor publik, satu wilayah yang dipantau, dan ringkasan mingguan — tanpa kartu kredit, tanpa batas waktu.
  - contentinfo [ref=e451]:
    - generic [ref=e453]:
      - generic [ref=e454]:
        - img [ref=e455]
        - generic [ref=e457]: HealthWatch Global
        - generic [ref=e458]: ·
        - generic [ref=e459]: © 2026
      - navigation [ref=e460]:
        - link "Tentang" [ref=e461] [cursor=pointer]:
          - /url: /id/about
        - link "Kebijakan Privasi" [ref=e462] [cursor=pointer]:
          - /url: /id/privacy
        - link "Syarat Penggunaan" [ref=e463] [cursor=pointer]:
          - /url: /id/terms
        - link "Pemberitahuan hukum" [ref=e464] [cursor=pointer]:
          - /url: /id/legal
        - link "Kontak" [ref=e465] [cursor=pointer]:
          - /url: /id/contact
        - link "contact@healthwatch-global.com" [ref=e466] [cursor=pointer]:
          - /url: mailto:contact@healthwatch-global.com
        - button "Pengaturan cookie" [ref=e467]
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