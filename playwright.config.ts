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
  },
  webServer: {
    command: `npx next dev --turbopack -p ${port}`,
    url: `${baseURL}/dev/mobile-harness`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "iphone-se",
      use: {
        browserName: "chromium",
        viewport: { width: 375, height: 667 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
    {
      name: "iphone-14",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
      },
    },
    {
      name: "android-360",
      use: {
        browserName: "chromium",
        viewport: { width: 360, height: 740 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2.75,
      },
    },
    {
      name: "android-390",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2.625,
      },
    },
    {
      name: "ipad",
      use: {
        browserName: "chromium",
        viewport: { width: 768, height: 1024 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
});
