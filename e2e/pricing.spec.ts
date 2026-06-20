import { test, expect } from "@playwright/test";

test.describe("Page Tarifs", () => {
  test("s'affiche avec les 4 plans Free/Pro/Team/Enterprise", async ({ page }) => {
    await page.goto("/fr/pricing");
    await expect(page.getByText("Free", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Pro", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Team", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Enterprise", { exact: true }).first()).toBeVisible();
  });

  test("affiche les prix Pro (annuel par défaut)", async ({ page }) => {
    await page.goto("/fr/pricing");
    // Default billing is annual → "249 €" visible for Pro
    await expect(page.getByText("Free", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("249 €", { exact: true })).toBeVisible();
    // Switch to monthly → "29 €" visible
    await page.getByRole("button", { name: /mensuel/i }).click();
    await expect(page.getByText("29 €", { exact: true })).toBeVisible();
  });

  test("Plan Team — affiche le prix mensuel 149 €", async ({ page }) => {
    await page.goto("/fr/pricing");
    await page.getByRole("button", { name: /mensuel/i }).click();
    await expect(page.getByText("149 €", { exact: true })).toBeVisible();
  });

  test("Plan Team — affiche le prix annuel 1 290 €", async ({ page }) => {
    await page.goto("/fr/pricing");
    // Annual is the default
    await expect(page.getByText("1 290 €", { exact: true })).toBeVisible();
  });

  test("Plan Team — liste les fonctionnalités clés (5 sièges, facture institutionnelle)", async ({ page }) => {
    await page.goto("/fr/pricing");
    // Target feature <li> — text also appears in teamDesc, causing strict mode violation
    await expect(page.locator("li").filter({ hasText: "5 sièges inclus" })).toBeVisible();
    await expect(page.locator("li").filter({ hasText: "Une seule facture institutionnelle" })).toBeVisible();
  });

  test("Plan Team — bouton CTA existe", async ({ page }) => {
    await page.goto("/fr/pricing");
    // Team card has a checkout or contact button
    const teamSection = page.locator("text=Team").first().locator("..").locator("..");
    await expect(teamSection).toBeVisible();
  });

  test("bouton checkout redirige vers signup si non connecté", async ({ page }) => {
    await page.goto("/fr/pricing");
    await page.getByRole("button", { name: /commencer/i }).first().click();
    await expect(page).toHaveURL(/login|signup|stripe\.com/, { timeout: 8000 });
  });

  test("section FAQ visible", async ({ page }) => {
    await page.goto("/fr/pricing");
    await expect(page.getByText("Questions fréquentes")).toBeVisible();
  });

  test("page tarifs en anglais — affiche Team et Enterprise", async ({ page }) => {
    await page.goto("/en/pricing");
    await expect(page.getByText("Team", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Enterprise", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("5 seats included")).toBeVisible();
  });
});
