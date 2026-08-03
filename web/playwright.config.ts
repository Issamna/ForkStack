import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the fully mocked local stack: moto standing in
 * for DynamoDB and S3, and mock auth instead of Clerk. No AWS account, no Clerk
 * instance, no real user data -- so this is safe to run on every push.
 *
 * The mock env is passed on the command line rather than read from .env.local,
 * which is gitignored and therefore absent in CI.
 */
const MOCK_ENV = {
  VITE_AUTH_MODE: "mock",
  VITE_MOCK_USER_ID: "user_local_dev",
  VITE_API_BASE: "http://localhost:8000",
};

export default defineConfig({
  testDir: "./e2e",
  // Shared backend state (one seeded database), so tests must not race.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],

  webServer: [
    {
      // Starts moto, creates the tables and bucket, seeds, serves the API with
      // mock auth. Responds 401 unauthenticated, which counts as "up".
      command: "bash ../dev-local.sh",
      url: "http://localhost:8000/recipes",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "npm run dev",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: MOCK_ENV,
    },
  ],
});
