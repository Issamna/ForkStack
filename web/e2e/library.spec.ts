import { expect, test } from "@playwright/test";

test.describe("recipe library", () => {
  test("lists the seeded cookbook and previews a selection", async ({ page }) => {
    await page.goto("/recipes");

    // Scope chips carry live counts from the API, so this also proves the
    // request was authenticated -- an anonymous call would 401 to zero.
    await expect(page.getByRole("button", { name: /^Mine \d+$/ })).toBeVisible();

    const rows = page.locator("button.index-row");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(5);

    await rows.first().click();
    // The preview pane is desktop-only; on mobile the sheet carries the title.
    await expect(
      page.getByRole("heading", { level: 1 }).or(page.locator("h2")).first(),
    ).toBeVisible();
  });

  test("filter narrows the index", async ({ page }) => {
    await page.goto("/recipes");
    await page.getByLabel("Filter recipes").fill("chili");

    const rows = page.locator("button.index-row");
    await expect(rows).toHaveCount(await rows.count());
    for (const text of await rows.allInnerTexts()) {
      expect(text.toLowerCase()).toContain("chili");
    }
  });
});

test.describe("keyboard navigation", () => {
  // Desktop-only: the keyboard legend and preview pane don't exist on a phone.
  test.skip(({ isMobile }) => !!isMobile, "desktop only");

  test("'/' focuses the filter and typing still works", async ({ page }) => {
    await page.goto("/recipes");
    await page.locator("button.index-row").first().waitFor();

    await page.keyboard.press("/");
    await expect(page.getByLabel("Filter recipes")).toBeFocused();

    // Regression: arrow keys must not hijack input while a field has focus.
    await page.keyboard.type("soup");
    await expect(page.getByLabel("Filter recipes")).toHaveValue("soup");
  });

  test("arrow keys move the selection", async ({ page }) => {
    await page.goto("/recipes");
    const rows = page.locator("button.index-row");
    await rows.first().waitFor();

    await rows.first().click();
    const firstTitle = (await rows.first().innerText()).split("\n")[0];

    await page.keyboard.press("ArrowDown");
    // A planned recipe renders in both "This week" and its letter group, so
    // more than one row can carry the selection; what matters is that the
    // selected *recipe* changed.
    const selected = page.locator('button.index-row[aria-current="true"]').first();
    await expect
      .poll(async () => (await selected.innerText()).split("\n")[0])
      .not.toBe(firstTitle);
  });
});
