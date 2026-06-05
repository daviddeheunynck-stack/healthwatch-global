# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: locales.spec.ts >> Landing page — all locales >> /id loads without error
- Location: e2e\locales.spec.ts:11:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('HealthWatch')
Expected: visible
Error: strict mode violation: getByText('HealthWatch') resolved to 5 elements:
    1) <span class="font-bold text-lg text-white">HealthWatch Global</span> aka getByRole('navigation').filter({ hasText: 'HealthWatch GlobalDasborPeringatanCompareLaporanHargaKontakFRENESARIDMasukBuat' }).locator('span')
    2) <p class="text-gray-400 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">Wabah yang tidak terdeteksi tepat waktu dapat men…</p> aka getByText('Wabah yang tidak terdeteksi')
    3) <p class="text-gray-400 max-w-2xl mx-auto leading-relaxed">Sebagian besar organisasi kesehatan mengetahuinya…</p> aka getByText('Sebagian besar organisasi')
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
      - generic [ref=e48]:
        - generic [ref=e49]: Data WHO langsung · 195 negara · Diperbarui setiap hari
        - heading "Antisipasi wabah. Berhenti bereaksi." [level=1] [ref=e51]:
          - text: Antisipasi wabah.
          - text: Berhenti bereaksi.
        - paragraph [ref=e52]: Wabah yang tidak terdeteksi tepat waktu dapat menelan biaya berminggu-minggu krisis bagi organisasi Anda. HealthWatch Global memberikan intelijen real-time kepada tim Anda — langsung dari WHO.
        - generic [ref=e53]:
          - link "Buat akun gratis" [ref=e54] [cursor=pointer]:
            - /url: /id/signup
            - text: Buat akun gratis
            - img [ref=e55]
          - link "Lihat harga" [ref=e57] [cursor=pointer]:
            - /url: /id/pricing
        - paragraph [ref=e58]: Gratis · Tanpa kartu kredit
        - generic [ref=e59]:
          - generic [ref=e60]:
            - img [ref=e61]
            - paragraph [ref=e63]: "36"
            - paragraph [ref=e64]: wabah aktif
          - generic [ref=e65]:
            - img [ref=e66]
            - paragraph [ref=e69]: "27"
            - paragraph [ref=e70]: negara terdampak
          - generic [ref=e71]:
            - img [ref=e72]
            - paragraph [ref=e74]: "15"
            - paragraph [ref=e75]: peringatan risiko tinggi
          - generic [ref=e76]:
            - img [ref=e77]
            - paragraph [ref=e80]: Diperbarui setiap hari
      - generic [ref=e81]:
        - generic [ref=e82]:
          - heading "WHO mendeklarasikan 15–25 wabah baru setiap bulan." [level=2] [ref=e83]
          - paragraph [ref=e84]: Sebagian besar organisasi kesehatan mengetahuinya terlambat. HealthWatch Global membalik keterlambatan itu.
        - generic [ref=e85]:
          - generic [ref=e86]:
            - paragraph [ref=e87]: 15–25
            - paragraph [ref=e88]: wabah WHO baru / bulan
          - generic [ref=e89]:
            - paragraph [ref=e90]: 72 jam
            - paragraph [ref=e91]: rata-rata jeda deteksi
          - generic [ref=e92]:
            - paragraph [ref=e93]: × 10
            - paragraph [ref=e94]: biaya respons reaktif vs. antisipatif
      - generic [ref=e95]:
        - generic [ref=e96]:
          - generic [ref=e97]:
            - img [ref=e98]
            - text: Langsung
          - heading "Yang akan dilihat tim Anda secara real-time" [level=2] [ref=e104]
          - paragraph [ref=e105]: Data di bawah ini nyata dan bersumber langsung dari API WHO Disease Outbreak News.
        - generic [ref=e106]:
          - table [ref=e107]:
            - rowgroup [ref=e108]:
              - row "Penyakit Negara Risiko" [ref=e109]:
                - columnheader "Penyakit" [ref=e110]
                - columnheader "Negara" [ref=e111]
                - columnheader "Risiko" [ref=e112]
                - columnheader [ref=e113]
            - rowgroup [ref=e114]:
              - row "Cholera Haiti Tinggi 28 500 kasus" [ref=e115]:
                - cell "Cholera" [ref=e116]
                - cell "Haiti" [ref=e117]
                - cell "Tinggi" [ref=e118]
                - cell "28 500 kasus" [ref=e119]:
                  - generic [ref=e120]: 28 500 kasus
              - row "Dengue Fever Brazil Tinggi 6 200 000 kasus" [ref=e121]:
                - cell "Dengue Fever" [ref=e122]
                - cell "Brazil" [ref=e123]
                - cell "Tinggi" [ref=e124]
                - cell "6 200 000 kasus" [ref=e125]:
                  - generic [ref=e126]: 6 200 000 kasus
              - row "Mpox (Monkeypox) Democratic Republic of Congo Tinggi 19 845 kasus" [ref=e127]:
                - cell "Mpox (Monkeypox)" [ref=e128]
                - cell "Democratic Republic of Congo" [ref=e129]
                - cell "Tinggi" [ref=e130]
                - cell "19 845 kasus" [ref=e131]:
                  - generic [ref=e132]: 19 845 kasus
              - row "Ebola virus disease DR Congo Tinggi 746 kasus" [ref=e133]:
                - cell "Ebola virus disease" [ref=e134]
                - cell "DR Congo" [ref=e135]
                - cell "Tinggi" [ref=e136]
                - cell "746 kasus" [ref=e137]:
                  - generic [ref=e138]: 746 kasus
              - row "Cholera Ethiopia Tinggi 8 320 kasus" [ref=e139]:
                - cell "Cholera" [ref=e140]
                - cell "Ethiopia" [ref=e141]
                - cell "Tinggi" [ref=e142]
                - cell "8 320 kasus" [ref=e143]:
                  - generic [ref=e144]: 8 320 kasus
          - generic [ref=e145]:
            - generic [ref=e146]: "Source : WHO Disease Outbreak News"
            - link "Buat akun gratis →" [ref=e147] [cursor=pointer]:
              - /url: /id/signup
      - generic [ref=e148]:
        - heading "Semua yang dibutuhkan tim Anda" [level=2] [ref=e149]
        - generic [ref=e150]:
          - generic [ref=e151]:
            - img [ref=e153]
            - heading "Peringatan per penyakit" [level=3] [ref=e156]
            - paragraph [ref=e157]: Berlangganan H5N1, Ebola, Mpox… Terima email dalam 6 jam ketika wabah terdeteksi di mana saja di dunia.
          - generic [ref=e158]:
            - img [ref=e160]
            - heading "Lencana PHEIC & korroborasi" [level=3] [ref=e166]
            - paragraph [ref=e167]: 🚨 PHEIC pada setiap darurat kesehatan WHO. 🔁 WHO+ProMED mengonfirmasi wabah multi-sumber.
          - generic [ref=e168]:
            - img [ref=e170]
            - heading "CFR & tingkat insidensi" [level=3] [ref=e173]
            - paragraph [ref=e174]: CFR dihitung otomatis. Insidensi per 100.000 penduduk dengan data populasi PBB untuk 150 negara.
          - generic [ref=e175]:
            - img [ref=e177]
            - heading "Perbandingan wabah" [level=3] [ref=e180]
            - paragraph [ref=e181]: "Ebola RDC vs Uganda: kasus, kematian, CFR, insidensi berdampingan. Bagikan URL langsung ke kolega."
          - generic [ref=e182]:
            - img [ref=e184]
            - heading "Daftar pantau & notifikasi" [level=3] [ref=e187]
            - paragraph [ref=e188]: Tandai ⭐ hingga 20 wabah. Email otomatis ketika angka berubah — tidak ada eskalasi yang terlewat.
          - generic [ref=e189]:
            - img [ref=e191]
            - heading "Laporan PDF & widget embeddable" [level=3] [ref=e193]
            - paragraph [ref=e194]: PDF profesional per wabah dengan 1 klik. Widget iframe untuk situs Anda. Kartu PNG untuk WhatsApp dan Slack.
      - generic [ref=e195]:
        - heading "Siap dalam 3 menit" [level=2] [ref=e196]
        - generic [ref=e197]:
          - generic [ref=e198]:
            - generic [ref=e199]: "1"
            - generic [ref=e200]:
              - heading "Buat akun Anda" [level=3] [ref=e201]
              - paragraph [ref=e202]: Daftar dalam 30 detik. Tanpa kartu kredit. Akses dasbor langsung.
          - generic [ref=e203]:
            - generic [ref=e204]: "2"
            - generic [ref=e205]:
              - heading "Konfigurasi wilayah Anda" [level=3] [ref=e206]
              - paragraph [ref=e207]: Pilih geografi yang Anda pantau dan terima digest pertama minggu berikutnya.
          - generic [ref=e208]:
            - generic [ref=e209]: "3"
            - generic [ref=e210]:
              - heading "Upgrade ke Pro untuk peringatan real-time" [level=3] [ref=e211]
              - paragraph [ref=e212]: Buka umpan langsung, laporan PDF, dan ekspor CSV.
      - generic [ref=e213]:
        - paragraph [ref=e214]: Dirancang untuk
        - generic [ref=e215]:
          - generic [ref=e216]:
            - img [ref=e218]
            - paragraph [ref=e220]: Kementerian Kesehatan
          - generic [ref=e221]:
            - img [ref=e223]
            - paragraph [ref=e225]: LSM Internasional
          - generic [ref=e226]:
            - img [ref=e228]
            - paragraph [ref=e232]: Lembaga Penelitian
          - generic [ref=e233]:
            - img [ref=e235]
            - paragraph [ref=e239]: Rumah Sakit & Klinik
      - generic [ref=e240]:
        - heading "Mulai gratis. Kembangkan saat dibutuhkan." [level=2] [ref=e241]
        - generic [ref=e242]:
          - generic [ref=e243]:
            - generic [ref=e244]:
              - img [ref=e245]
              - generic [ref=e248]: Gratis
            - paragraph [ref=e249]: 0 €
            - paragraph [ref=e250]: Peta dunia · 1 wilayah · Digest mingguan
          - generic [ref=e251]:
            - generic [ref=e252]:
              - img [ref=e253]
              - generic [ref=e255]: Pro
            - paragraph [ref=e256]: $49 /bulan
            - paragraph [ref=e257]: Semua wilayah · Peringatan · PDF · CSV · Slack
          - generic [ref=e258]:
            - generic [ref=e259]:
              - img [ref=e260]
              - generic [ref=e262]: Enterprise
            - paragraph [ref=e263]: Kustom
            - paragraph [ref=e264]: API · On-premise · SLA 99,9%
        - link "Lihat semua paket →" [ref=e266] [cursor=pointer]:
          - /url: /id/pricing
      - generic [ref=e267]:
        - generic [ref=e268]:
          - heading "Tetap terinformasi — gratis" [level=2] [ref=e269]
          - paragraph [ref=e270]: Ringkasan mingguan wabah aktif, difilter berdasarkan wilayah, langsung ke kotak masuk Anda.
        - generic [ref=e271]:
          - generic [ref=e272]:
            - textbox "anda@organisasi.com" [ref=e273]
            - combobox "Wilayah" [ref=e274]:
              - option "Semua wilayah" [selected]
              - option "Afrika"
              - option "Asia"
              - option "Eropa"
              - option "Amerika"
              - option "Oseania"
            - button "Berlangganan" [ref=e275]:
              - img [ref=e276]
              - text: Berlangganan
          - paragraph [ref=e279]: Gratis · Tanpa kartu · Berhenti berlangganan dalam 1 klik
      - generic [ref=e281]:
        - generic [ref=e282]:
          - img [ref=e284]
          - img [ref=e289]
          - img [ref=e292]
        - heading "Apakah organisasi Anda siap untuk wabah berikutnya?" [level=2] [ref=e296]
        - paragraph [ref=e297]: Bergabunglah dengan tim yang memantau krisis kesehatan global secara real-time.
        - generic [ref=e298]:
          - link "Mulai gratis" [ref=e299] [cursor=pointer]:
            - /url: /id/signup
            - text: Mulai gratis
            - img [ref=e300]
          - paragraph [ref=e302]: Tanpa kartu kredit · Akses langsung
  - contentinfo [ref=e303]:
    - generic [ref=e305]:
      - generic [ref=e306]:
        - img [ref=e307]
        - generic [ref=e309]: HealthWatch Global
        - generic [ref=e310]: ·
        - generic [ref=e311]: © 2026
      - navigation [ref=e312]:
        - link "Tentang" [ref=e313] [cursor=pointer]:
          - /url: /id/about
        - link "Kebijakan Privasi" [ref=e314] [cursor=pointer]:
          - /url: /id/privacy
        - link "Syarat Penggunaan" [ref=e315] [cursor=pointer]:
          - /url: /id/terms
        - link "Pemberitahuan hukum" [ref=e316] [cursor=pointer]:
          - /url: /id/legal
        - link "Kontak" [ref=e317] [cursor=pointer]:
          - /url: /id/contact
        - link "contact@healthwatch-global.com" [ref=e318] [cursor=pointer]:
          - /url: mailto:contact@healthwatch-global.com
        - button "Pengaturan cookie" [ref=e319]
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