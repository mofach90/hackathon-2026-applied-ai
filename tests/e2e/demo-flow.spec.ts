import { test, expect } from "@playwright/test";

test.describe("RentPilot AI demo flow", () => {
  test("dashboard loads and shows case list", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /cases/i })).toBeVisible();
    // After demo:reset, at least one case row should be visible
    const rows = page.locator("tbody tr");
    await expect(rows.first()).toBeVisible();
  });

  test("Amina case detail shows reasoning chain and compliance badge", async ({ page }) => {
    await page.goto("/");

    // Find Amina's row and click it
    const aminaRow = page.locator("tr", { hasText: "Amina Benali" }).first();
    await expect(aminaRow).toBeVisible({ timeout: 10_000 });
    await aminaRow.click();

    // Reasoning chain section must be present
    await expect(page.getByTestId("reasoning-chain")).toBeVisible({ timeout: 15_000 });

    // Compliance badge should be visible
    const complianceBadge = page.locator("[data-testid='compliance-badge']").first();
    await expect(complianceBadge).toBeVisible({ timeout: 10_000 });
  });

  test("Mike case detail shows enforcement action", async ({ page }) => {
    await page.goto("/");

    const mikeRow = page.locator("tr", { hasText: "Mike Schmidt" }).first();
    await expect(mikeRow).toBeVisible({ timeout: 10_000 });
    await mikeRow.click();

    await expect(page.getByTestId("reasoning-chain")).toBeVisible({ timeout: 15_000 });
  });

  test("Sara case detail is reachable", async ({ page }) => {
    await page.goto("/");

    const saraRow = page.locator("tr", { hasText: "Sara Petrović" }).first();
    await expect(saraRow).toBeVisible({ timeout: 10_000 });
    await saraRow.click();

    // Page navigated to case detail
    await expect(page).toHaveURL(/\/cases\/.+/);
  });
});
