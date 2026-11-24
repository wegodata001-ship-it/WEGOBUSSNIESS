import { expect, test } from "@playwright/test";

const SIHAM_EMPLOYEE_ID = "emp-siham-doc";
const OWNER_EMPLOYEE_ID = "emp-owner-doc";

test.describe("single employee assignee selection", () => {
  test("selecting סיהאם דבור alone sticks after menu close, title edit, save, and reopen", async ({ page }) => {
    await page.goto("/dev/assignee-harness");
    await expect(page.getByTestId("assignee-harness")).toBeVisible();

    // New-task flow starts in library/replace mode — choose free text first (same as production).
    await page.getByRole("button", { name: "+ משימה חדשה / הקלדה חופשית" }).click();

    await page.getByTestId("employee-multi-select-open").click();
    await expect(page.getByTestId("employee-multi-select-menu")).toBeVisible();
    await page.getByTestId(`employee-option-${SIHAM_EMPLOYEE_ID}`).click();

    // Chip must stay after the option click (menu may remain open for multi-add).
    await expect(page.getByTestId(`employee-chip-${SIHAM_EMPLOYEE_ID}`)).toBeVisible();
    await expect(page.getByTestId("draft-assignee-id")).toHaveText(SIHAM_EMPLOYEE_ID);
    await expect(page.getByTestId("draft-collaborators")).toHaveText("(none)");
    await expect(page.getByTestId(`employee-chip-${OWNER_EMPLOYEE_ID}`)).toHaveCount(0);

    // Close the menu by clicking the title field — selection must not vanish.
    const title = page.getByTestId("task-title-input");
    await title.click();
    await title.fill("משימה לסיהאם בלבד");
    await expect(page.getByTestId(`employee-chip-${SIHAM_EMPLOYEE_ID}`)).toBeVisible();
    await expect(page.getByTestId("draft-assignee-id")).toHaveText(SIHAM_EMPLOYEE_ID);
    await expect(page.getByTestId("draft-collaborators")).toHaveText("(none)");

    // Save and reopen — assignee must persist in draft/payload without auto-adding owner.
    await page.getByRole("button", { name: "שמירת משימה" }).click();
    await expect(page.getByTestId("saved-payload")).toBeVisible();
    const payloadText = await page.getByTestId("saved-payload").innerText();
    const payload = JSON.parse(payloadText) as {
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
});
