import { expect, test } from "@playwright/test";

const SIHAM_EMPLOYEE_ID = "emp-siham-doc";
const OWNER_EMPLOYEE_ID = "emp-owner-doc";

async function startFreeTextTask(page: import("@playwright/test").Page) {
  await page.goto("/dev/assignee-harness");
  await expect(page.getByTestId("assignee-harness")).toBeVisible();
  await page.getByRole("button", { name: "+ משימה חדשה / הקלדה חופשית" }).click();
}

test.describe("optional employee assignee selection", () => {
  test("selecting סיהאם דבור alone sticks after menu close, title edit, save, and reopen", async ({ page }) => {
    await startFreeTextTask(page);

    await page.getByTestId("employee-multi-select-open").click();
    await expect(page.getByTestId("employee-multi-select-menu")).toBeVisible();
    await page.getByTestId(`employee-option-${SIHAM_EMPLOYEE_ID}`).click();

    await expect(page.getByTestId(`employee-chip-${SIHAM_EMPLOYEE_ID}`)).toBeVisible();
    await expect(page.getByTestId("draft-assignee-id")).toHaveText(SIHAM_EMPLOYEE_ID);
    await expect(page.getByTestId("draft-collaborators")).toHaveText("(none)");
    await expect(page.getByTestId(`employee-chip-${OWNER_EMPLOYEE_ID}`)).toHaveCount(0);

    const title = page.getByTestId("task-title-input");
    await title.click();
    await title.fill("משימה לסיהאם בלבד");
    await expect(page.getByTestId(`employee-chip-${SIHAM_EMPLOYEE_ID}`)).toBeVisible();
    await expect(page.getByTestId("draft-assignee-id")).toHaveText(SIHAM_EMPLOYEE_ID);
    await expect(page.getByTestId("draft-collaborators")).toHaveText("(none)");
    await expect(page.getByText(/מומלץ לבחור לפחות עובד/)).toHaveCount(0);

    await page.getByRole("button", { name: "שמירת משימה" }).click();
    await expect(page.getByTestId("saved-payload")).toBeVisible();
    const payload = JSON.parse(await page.getByTestId("saved-payload").innerText()) as {
      assigneeId: string | null;
      collaboratorIds: string[];
      participantIds: string[];
    };
    expect(payload.assigneeId).toBe(SIHAM_EMPLOYEE_ID);
    expect(payload.collaboratorIds).toEqual([]);
    expect(payload.participantIds).toEqual([SIHAM_EMPLOYEE_ID]);
    expect(payload.participantIds).not.toContain(OWNER_EMPLOYEE_ID);

    await page.getByTestId("reopen-task-form").click();
    await expect(page.getByTestId(`employee-chip-${SIHAM_EMPLOYEE_ID}`)).toBeVisible();
    await expect(page.getByTestId(`employee-chip-${OWNER_EMPLOYEE_ID}`)).toHaveCount(0);
    await expect(page.getByTestId("draft-assignee-id")).toHaveText(SIHAM_EMPLOYEE_ID);
  });

  test("name-only task saves with empty assignee and participants", async ({ page }) => {
    await startFreeTextTask(page);

    await expect(page.getByTestId("draft-assignee-id")).toHaveText("(empty)");
    await expect(page.getByText(/מומלץ לבחור לפחות עובד/)).toHaveCount(0);

    await page.getByTestId("task-title-input").fill("משימה בלי שיבוץ");
    await page.getByRole("button", { name: "שמירת משימה" }).click();

    const payload = JSON.parse(await page.getByTestId("saved-payload").innerText()) as {
      title: string;
      assigneeId: string | null;
      collaboratorIds: string[];
      participantIds: string[];
    };
    expect(payload.title).toBe("משימה בלי שיבוץ");
    expect(payload.assigneeId).toBeNull();
    expect(payload.collaboratorIds).toEqual([]);
    expect(payload.participantIds).toEqual([]);

    await page.getByTestId("reopen-task-form").click();
    await expect(page.getByTestId("draft-assignee-id")).toHaveText("(empty)");
    await expect(page.getByTestId("employee-multi-select")).toBeVisible();
    await expect(page.locator("[data-testid^='employee-chip-']")).toHaveCount(0);
  });

  test("multi employee selection survives date/title edits and reopen", async ({ page }) => {
    await startFreeTextTask(page);

    await page.getByTestId("employee-multi-select-open").click();
    await page.getByTestId(`employee-option-${SIHAM_EMPLOYEE_ID}`).click();
    await page.getByTestId(`employee-option-${OWNER_EMPLOYEE_ID}`).click();
    await expect(page.getByTestId(`employee-chip-${SIHAM_EMPLOYEE_ID}`)).toBeVisible();
    await expect(page.getByTestId(`employee-chip-${OWNER_EMPLOYEE_ID}`)).toBeVisible();

    const title = page.getByTestId("task-title-input");
    await title.click();
    await title.fill("משימה לצוות");
    await expect(page.getByTestId(`employee-chip-${SIHAM_EMPLOYEE_ID}`)).toBeVisible();
    await expect(page.getByTestId(`employee-chip-${OWNER_EMPLOYEE_ID}`)).toBeVisible();
    await expect(page.getByTestId("draft-assignee-id")).toHaveText(SIHAM_EMPLOYEE_ID);
    await expect(page.getByTestId("draft-collaborators")).toHaveText(OWNER_EMPLOYEE_ID);

    await page.getByRole("button", { name: "שמירת משימה" }).click();
    const payload = JSON.parse(await page.getByTestId("saved-payload").innerText()) as {
      assigneeId: string | null;
      collaboratorIds: string[];
      participantIds: string[];
    };
    expect(payload.assigneeId).toBe(SIHAM_EMPLOYEE_ID);
    expect(payload.collaboratorIds).toEqual([OWNER_EMPLOYEE_ID]);
    expect(payload.participantIds).toEqual([SIHAM_EMPLOYEE_ID, OWNER_EMPLOYEE_ID]);

    await page.getByTestId("reopen-task-form").click();
    await expect(page.getByTestId(`employee-chip-${SIHAM_EMPLOYEE_ID}`)).toBeVisible();
    await expect(page.getByTestId(`employee-chip-${OWNER_EMPLOYEE_ID}`)).toBeVisible();
  });
});
