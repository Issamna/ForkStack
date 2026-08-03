import { expect, test } from "@playwright/test";

/**
 * Regression cover for the reported bug: checkboxes that couldn't be ticked.
 * Two distinct faults were behind it -- a tap target the size of the raw
 * checkbox, and toggles matched by object identity against an array the server
 * replaces on every save. Both are exercised here.
 */
test.describe("shopping list", () => {
  test("generates a list from the planned week", async ({ page }) => {
    await page.goto("/shopping-list");

    await expect(page.getByRole("heading", { name: "Shopping list" })).toBeVisible();
    const rows = page.locator('input[type="checkbox"]');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(5);

    // Aisle eyebrows prove the server-side categorisation came through.
    await expect(page.locator(".eyebrow-terracotta").first()).toBeVisible();
  });

  test("ticking a row persists across a reload", async ({ page }) => {
    await page.goto("/shopping-list");
    const labels = page
      .locator("label")
      .filter({ has: page.locator('input[type="checkbox"]') });
    await labels.first().waitFor();

    // Target a row that isn't already ticked: the list is shared state, so
    // counting checked rows would depend on whatever earlier specs left behind.
    let targetText: string | null = null;
    for (let i = 0; i < (await labels.count()); i++) {
      const row = labels.nth(i);
      if (!(await row.locator("input").isChecked())) {
        targetText = (await row.innerText()).split("\n")[0].trim();
        await row.locator("input").check();
        break;
      }
    }
    expect(targetText, "expected at least one unticked row").not.toBeNull();

    // Reload re-runs generate(); checked state must survive regeneration.
    await page.reload();
    const reloaded = page
      .locator("label")
      .filter({ hasText: targetText! })
      .first();
    await expect(reloaded.locator("input")).toBeChecked();
  });

  test("the whole row is the tap target, not just the box", async ({ page }) => {
    await page.goto("/shopping-list");
    const firstLabel = page.locator("label").filter({ has: page.locator("input") }).first();
    await firstLabel.waitFor();

    const box = firstLabel.locator('input[type="checkbox"]');
    const wasChecked = await box.isChecked();

    // Click the text, well away from the checkbox itself.
    await firstLabel.locator("span").first().click();
    await expect(box).toBeChecked({ checked: !wasChecked });
  });

  test("tap targets are big enough to hit on a phone", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile only");
    await page.goto("/shopping-list");

    const label = page.locator("label").filter({ has: page.locator("input") }).first();
    await label.waitFor();
    const size = await label.boundingBox();
    expect(size!.height).toBeGreaterThanOrEqual(44);
  });

  test("hide checked filters ticked rows away", async ({ page }) => {
    await page.goto("/shopping-list");
    const boxes = page.locator('input[type="checkbox"]');
    await boxes.first().waitFor();
    await boxes.first().check();

    const total = await boxes.count();
    await page.getByRole("button", { name: "Hide checked" }).click();
    await expect.poll(async () => boxes.count()).toBeLessThan(total);
  });
});
