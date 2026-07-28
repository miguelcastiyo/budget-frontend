import { test, expect, type Page, type TestInfo } from "@playwright/test"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import path from "node:path"

const backendRoot = path.resolve(process.cwd(), "../budget-backend")
type SeededAccount = { email: string; password: string; canary: string; session_token: string; csrf_token: string }

function seed(testInfo: TestInfo) {
  const titleKey = `${testInfo.project.name}-${testInfo.title}`
  const suffix = `${titleKey.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 26)}${createHash("sha256").update(titleKey).digest("hex").slice(0, 10)}`
  const raw = execFileSync("php", ["scripts/seed_phase5_browser_account.php"], { cwd: backendRoot, env: { ...process.env, PRIVACY_PARITY_TEST: "1", DB_DSN: "mysql:host=127.0.0.1;port=3307;dbname=budget_privacy_parity_test;charset=utf8mb4", DB_USER: "parity", DB_PASS: "parity_test_only", PHASE5_BROWSER_SUFFIX: suffix }, encoding: "utf8" })
  return JSON.parse(raw) as SeededAccount
}

function assertDatabase(account: SeededAccount, minimumCancelledRuns = 0) {
  execFileSync("php", ["scripts/assert_phase5_browser_account.php", account.email, String(minimumCancelledRuns)], {
    cwd: backendRoot,
    env: { ...process.env, PRIVACY_PARITY_TEST: "1", DB_DSN: "mysql:host=127.0.0.1;port=3307;dbname=budget_privacy_parity_test;charset=utf8mb4", DB_USER: "parity", DB_PASS: "parity_test_only" },
    encoding: "utf8",
  })
}

function assertCutoverDatabase(account: SeededAccount, postCleanup = false) {
  execFileSync("php", ["scripts/assert_phase6_cutover_account.php", account.email, ...(postCleanup ? ["post_cleanup"] : [])], {
    cwd: backendRoot,
    env: { ...process.env, PRIVACY_PARITY_TEST: "1", DB_DSN: "mysql:host=127.0.0.1;port=3307;dbname=budget_privacy_parity_test;charset=utf8mb4", DB_USER: "parity", DB_PASS: "parity_test_only" },
    encoding: "utf8",
  })
}

async function signIn(page: Page, account: SeededAccount) {
  await page.goto("/sign-in")
  await page.getByText("Sign in with email and password").click()
  await page.locator("#email").fill(account.email)
  await page.locator("#password").fill(account.password)
  await page.getByRole("button", { name: "Sign In", exact: true }).click()
  await page.context().addCookies([{ name: "sid", value: account.session_token, domain: "127.0.0.1", path: "/" }])
  await page.evaluate((csrf) => window.localStorage.setItem("budget.csrf_token", csrf), account.csrf_token)
  await page.goto("/dev/privacy/migration-validation")
  await expect(page.getByTestId("migration-validation")).toBeVisible()
}

async function unlock(page: Page) { await page.getByTestId("vault-unlock").click(); await expect(page.getByTestId("migration-stage")).toHaveText("vault_unlocked") }
async function start(page: Page) { await page.getByTestId("migration-start").click(); await expect(page.getByTestId("migration-stage")).toHaveText("migration_in_progress") }
async function complete(page: Page) { await page.getByTestId("migration-resume").click(); await expect(page.getByTestId("migration-stage")).toHaveText("staged_ready", { timeout: 30_000 }) }

test("Phase 5 real browser happy path and write freeze", async ({ page }, testInfo) => {
  const account = seed(testInfo)
  await signIn(page, account)
  await unlock(page)
  await start(page)
  await page.getByTestId("migration-mutation").click()
  await expect(page.getByTestId("migration-error")).toContainText("PRIVACY_STATE_CONFLICT")
  await complete(page)
  assertDatabase(account)
})

test("Phase 5 refresh relocks Vault and resumes exact staging", async ({ page }, testInfo) => {
  const account = seed(testInfo)
  await signIn(page, account)
  await unlock(page)
  await start(page)
  await page.getByTestId("partial-limit").fill("1")
  await page.getByTestId("migration-partial").click()
  await expect(page.getByTestId("migration-stage")).toContainText("partial:")
  await page.reload()
  await expect(page.getByTestId("migration-id")).not.toHaveText("")
  await page.getByTestId("migration-resume").click()
  await expect(page.getByTestId("migration-error")).toContainText("VAULT_LOCKED")
  await unlock(page)
  await complete(page)
  assertDatabase(account)
})

test("Phase 5 cancellation restores writes and fresh retry stages cleanly", async ({ page }, testInfo) => {
  const account = seed(testInfo)
  await signIn(page, account)
  await unlock(page)
  await start(page)
  await page.getByTestId("migration-partial").click()
  await expect(page.getByTestId("migration-stage")).toHaveText(/partial:1\//, { timeout: 30_000 })
  await page.getByTestId("migration-cancel").click()
  await expect(page.getByTestId("migration-stage")).toHaveText("cancelled")
  await page.getByTestId("migration-mutation").click()
  await expect(page.getByTestId("migration-stage")).toHaveText("mutation_succeeded")
  await start(page)
  await unlock(page)
  await complete(page)
  assertDatabase(account, 1)
})

test("Phase 6 cutover promotes encrypted authority and cleanup preserves it", async ({ page }, testInfo) => {
  const account = seed(testInfo)
  await signIn(page, account)
  await unlock(page)
  await start(page)
  await complete(page)
  await page.getByTestId("migration-cutover").click()
  await expect(page.getByTestId("migration-stage")).toHaveText("encrypted_authority")
  assertCutoverDatabase(account)
  await page.reload()
  await expect(page.getByTestId("migration-id")).not.toHaveText("")
  await unlock(page)
  await page.getByTestId("encrypted-sync").click()
  await expect(page.getByTestId("migration-stage")).toHaveText(/encrypted_sync:[1-9][0-9]*/)
  await page.getByTestId("migration-cutover").click()
  await expect(page.getByTestId("migration-stage")).toHaveText("encrypted_authority")
  assertCutoverDatabase(account)
  execFileSync("php", ["scripts/run_privacy_cleanup.php"], { cwd: backendRoot, env: { ...process.env, PRIVACY_PARITY_TEST: "1", DB_DSN: "mysql:host=127.0.0.1;port=3307;dbname=budget_privacy_parity_test;charset=utf8mb4", DB_USER: "parity", DB_PASS: "parity_test_only" }, encoding: "utf8" })
  assertCutoverDatabase(account, true)

})
