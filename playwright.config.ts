import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 2,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    launchOptions: { executablePath },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: [
    {command:"node scripts/test-store.mjs",url:"http://127.0.0.1:3155/health",reuseExistingServer:false,timeout:60000},
    {command:"npm run start",url:"http://127.0.0.1:3000",reuseExistingServer:false,timeout:60000,env:{BOPok_SUPABASE_URL:"http://127.0.0.1:3155",BOPok_SUPABASE_KEY:"isolated-test-key",BOPok_SESSION_SECRET:"isolated-test-session-secret-at-least-32-characters",BOPok_APP_URL:"http://127.0.0.1:3000",BOPok_AI_KEY:"",BOPok_AI_MODEL:""}},
  ],
});
