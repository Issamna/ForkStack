import { expect, test } from "@playwright/test";

test.describe("meal plan", () => {
  test("shows the seeded week including an eating-out day", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/meal-plan");

    await expect(page.getByText("★ Anytime")).toBeVisible();

    // The phone layout shows one day at a time; the seeded eating-out entry is
    // on Wednesday, so it has to be selected before it can be asserted on.
    if (isMobile) {
      await page.getByRole("button", { name: /^WED/ }).click();
    }
    await expect(page.getByText("Eating out").first()).toBeVisible();

    // Rail counts come from the shopping list for the same week.
    await expect(page.getByText(/planned meals?$/).first()).toBeVisible();
  });
});

test.describe("recipe detail", () => {
  test("scales quantities without turning weights into fractions", async ({ page }) => {
    await page.goto("/recipes");
    await page.locator("button.index-row").first().waitFor();

    // Reach a detail page without depending on which recipe sorts first.
    await page.getByRole("button", { name: /^Mine \d+$/ }).click();
    await page.getByLabel("Filter recipes").fill("Creamy");
    await page.locator("button.index-row").first().click();

    const openDetail = page.getByRole("link", { name: /Open full recipe|Open recipe/ });
    await openDetail.first().click();

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "More servings" }).click();

    // Regression: scaling used to render "437 1/2 g".
    const ingredients = await page.locator("label").allInnerTexts();
    const weights = ingredients.filter((t) => /\d\s*g\b/.test(t));
    expect(weights.length).toBeGreaterThan(0);
    for (const line of weights) {
      expect(line).not.toMatch(/\d+\s+\d\/\d\s*g\b/);
    }
  });

  test("cook mode walks the steps", async ({ page }) => {
    await page.goto("/recipes");
    await page.locator("button.index-row").first().waitFor();
    await page.getByLabel("Filter recipes").fill("Creamy");
    await page.locator("button.index-row").first().click();

    await page.getByRole("link", { name: /Open full recipe|Open recipe/ }).first().click();
    await page.getByRole("link", { name: "Cook mode" }).click();

    await expect(page.getByText(/^Step 1 of \d+$/)).toBeVisible();
    await page.getByRole("button", { name: /Next step/ }).click();
    await expect(page.getByText(/^Step 2 of \d+$/)).toBeVisible();
  });
});

test.describe("creating a recipe", () => {
  test("a saved recipe appears in the library", async ({ page }) => {
    const title = `E2E Test Loaf ${Date.now()}`;

    await page.goto("/recipes/new");
    await page.getByLabel("Recipe title").fill(title);
    await page.getByLabel("Quantity for ingredient 1").fill("2");
    await page.getByLabel("Unit for ingredient 1").fill("cups");
    await page.getByLabel("Ingredient 1 name").fill("flour");
    await page.locator("textarea").first().fill("Mix it and bake it.");

    await page.getByRole("button", { name: "Save recipe" }).click();

    await expect(page).toHaveURL(/\/recipes$/);
    await page.getByLabel("Filter recipes").fill(title);
    await expect(page.locator("button.index-row").first()).toContainText("E2E Test Loaf");
  });

  test("the checklist blocks a recipe with no title", async ({ page }) => {
    await page.goto("/recipes/new");
    await page.getByRole("button", { name: "Save recipe" }).click();
    await expect(page.getByText("Please add a recipe title.")).toBeVisible();
  });
});

test.describe("account screen", () => {
  test("is reachable from the header", async ({ page }) => {
    // Regression: the route existed but nothing linked to it, so cooking
    // preferences, export, delete and the bug reporter were all unreachable.
    await page.goto("/recipes");
    await page.getByRole("link", { name: "Account and settings" }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole("button", { name: "Report a problem" })).toBeVisible();
  });

  test("the bug reporter form renders", async ({ page }) => {
    await page.goto("/account");
    await page.getByRole("button", { name: "Report a problem" }).click();
    await expect(page.getByLabel("Summary")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send report" })).toBeVisible();
  });
});
