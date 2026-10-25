import { defineConfig, devices } from "@playwright/test";

// Public smoke layer: boots the app with dummy Supabase values, no live database.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  // The signed-in smoke binds the Supabase stand-in to the dummy URL's port, so it
  // runs after the specs that expect no database there.
  projects: [
    {
      name: "chromium",
      testIgnore: /signed-in-smoke/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "signed-in",
      testMatch: /signed-in-smoke/,
      dependencies: ["chromium"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // CI tests the production build, where the nonce CSP is active.
    command: process.env.CI ? "pnpm build && pnpm start" : "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
