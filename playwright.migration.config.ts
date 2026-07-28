import { defineConfig, devices } from "@playwright/test"
import os from "node:os"
import path from "node:path"

const backendRoot = path.resolve(process.cwd(), "../budget-backend")
const dbEnv = "DB_DSN='mysql:host=127.0.0.1;port=3307;dbname=budget_privacy_parity_test;charset=utf8mb4' DB_USER=parity DB_PASS=parity_test_only"

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["migration-staging.spec.ts", "phase6c-transactions-funds.spec.ts", "legacy-privacy-bridge.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR ?? path.join(os.tmpdir(), "budget-playwright-migration", String(process.pid)),
  use: { baseURL: "http://127.0.0.1:3100", trace: "on-first-retry", screenshot: "only-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: [
    { command: `${dbEnv} php -S 127.0.0.1:8010 -t public`, cwd: backendRoot, url: "http://127.0.0.1:8010/api/v1/ready", reuseExistingServer: false, timeout: 120_000 },
    { command: `${dbEnv} BACKEND_ORIGIN=http://127.0.0.1:8010 NEXT_PUBLIC_ENABLE_VAULT_VALIDATION=1 NEXT_DIST_DIR=.next-migration-playwright npm run dev -- --port 3100`, cwd: process.cwd(), url: "http://127.0.0.1:3100", reuseExistingServer: false, timeout: 120_000 },
  ],
})
