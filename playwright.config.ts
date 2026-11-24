import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.ASSIGNEE_HARNESS_PORT || 3117);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "tests/ui",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `npx next dev --turbopack -p ${port}`,
    url: `${baseURL}/dev/assignee-harness`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
