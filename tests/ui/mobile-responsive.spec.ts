import { expect, test } from "@playwright/test";

async function assertNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
    };
  });
  expect(overflow.scrollWidth, `horizontal overflow ${overflow.scrollWidth} > ${overflow.clientWidth}`).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

test.describe("mobile responsive harness", () => {
  test("modal sticky footer, tabs scroll, date picker, no page overflow", async ({ page }, testInfo) => {
    await page.goto("/dev/mobile-harness");
    await expect(page.getByTestId("mobile-harness")).toBeVisible();
    await assertNoHorizontalOverflow(page);

    const tabs = page.getByTestId("project-tabs");
    await expect(tabs).toBeVisible();
    await tabs.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    await page.getByRole("button", { name: "כספים" }).click();
    await expect(page.getByTestId("active-tab")).toHaveText("כספים");

    await page.getByTestId("open-modal").click();
    await expect(page.getByTestId("app-modal")).toBeVisible();
    await expect(page.getByTestId("app-modal-footer")).toBeVisible();

    const footerBox = await page.getByTestId("app-modal-footer").boundingBox();
    const viewport = page.viewportSize();
    expect(footerBox).toBeTruthy();
    expect(viewport).toBeTruthy();
    if (footerBox && viewport) {
      expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(viewport.height + 2);
    }

    const isMobileProject = /iphone|android|ipad/i.test(testInfo.project.name);
    if (isMobileProject || (viewport?.width ?? 1200) < 768) {
      await expect(page.getByTestId("native-date-input")).toBeVisible();
      await page.getByTestId("native-date-input").fill("2026-12-01");
      await expect(page.getByTestId("selected-date")).toHaveText("2026-12-01");
    } else {
      await expect(page.getByTestId("custom-date-trigger")).toBeVisible();
    }

    await page.getByTestId("task-title-input").fill("בדיקת מובייל");
    await page.getByRole("button", { name: "שמירת משימה" }).click();
    await expect(page.getByTestId("save-ok")).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });
});

test.describe("assignee selection on mobile viewports", () => {
  test("Siham alone sticks in task form", async ({ page }) => {
    const SIHAM = "emp-siham-doc";
    await page.goto("/dev/assignee-harness");
    await expect(page.getByTestId("assignee-harness")).toBeVisible();
    await page.getByRole("button", { name: "+ משימה חדשה / הקלדה חופשית" }).click();
    await page.getByTestId("employee-multi-select-open").click();
    await page.getByTestId(`employee-option-${SIHAM}`).click();
    await expect(page.getByTestId(`employee-chip-${SIHAM}`)).toBeVisible();
    await page.getByTestId("task-title-input").fill("משימה לנייד");
    await expect(page.getByTestId("draft-assignee-id")).toHaveText(SIHAM);
    await expect(page.getByTestId("app-modal-footer")).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });
});
