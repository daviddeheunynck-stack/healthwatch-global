// Locale smoke tests — verifies each language renders without crash
// Tests run against the local dev server (default) or production via BASE_URL.
// These tests catch "Functions cannot be passed directly" Server→Client bugs.

import { test, expect } from "@playwright/test";

const LOCALES = ["fr", "en", "es", "ar", "id"] as const;

test.describe("Landing page — all locales", () => {
  for (const locale of LOCALES) {
    test(`/${locale} loads without error`, async ({ page }) => {
      await page.goto(`/${locale}`);
      // Must NOT show Next.js error boundary
      await expect(page.locator("h1").filter({ hasText: /404|500/i })).not.toBeVisible();
      // Must show HealthWatch branding
      await expect(page.getByText("HealthWatch").first()).toBeVisible({ timeout: 8000 });
    });
  }
});

test.describe("Pricing page — all locales", () => {
  for (const locale of LOCALES) {
    test(`/${locale}/pricing loads`, async ({ page }) => {
      await page.goto(`/${locale}/pricing`);
      // Free plan always visible (no auth required)
      await expect(page.getByText("Free", { exact: true })
        .or(page.getByText("Gratis", { exact: true }))
        .or(page.getByText("مجاني", { exact: true }))
        .first()
      ).toBeVisible({ timeout: 8000 });
    });
  }
});

test.describe("Compare page — no crash", () => {
  for (const locale of ["fr", "en", "id"] as const) {
    test(`/${locale}/compare renders`, async ({ page }) => {
      await page.goto(`/${locale}/compare`);
      // h1 should be visible (not a crash page)
      await expect(page.locator("h1")).toBeVisible({ timeout: 8000 });
      // Must NOT be a 404/error page
      await expect(page.locator("h1").filter({ hasText: /404/i })).not.toBeVisible();
    });
  }
});

test.describe("Static pages — spot check", () => {
  const checks: [string, string, RegExp][] = [
    ["fr", "about", /HealthWatch/i],
    ["en", "legal", /Legal|Mentions/i],
    ["id", "pricing", /Pro/i],
    ["ar", "privacy", /سياسة/i],
  ];

  for (const [locale, pg, pattern] of checks) {
    test(`/${locale}/${pg} has expected content`, async ({ page }) => {
      await page.goto(`/${locale}/${pg}`);
      await expect(page.locator("body")).toContainText(pattern, { timeout: 8000 });
    });
  }
});
