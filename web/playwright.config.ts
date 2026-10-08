import { defineConfig, devices } from "@playwright/test";

// Run through scripts/e2e.sh, which starts Supabase and exports the env vars
// both servers need (SUPABASE_URL, APP_ADMIN_EMAILS, NEXT_PUBLIC_*, ...).
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // The specs share one live game in one database, so run them in order.
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "./mvnw -B -q spring-boot:run -Dspring-boot.run.profiles=local",
      cwd: "../api",
      url: "http://localhost:8080/actuator/health",
      timeout: 300_000,
      reuseExistingServer: !isCI,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "pnpm build && pnpm start",
      url: "http://localhost:3000/login",
      timeout: 300_000,
      reuseExistingServer: !isCI,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
