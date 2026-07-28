import { expect, test, type Page, type TestInfo } from "@playwright/test"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import path from "node:path"

const backendRoot = path.resolve(process.cwd(), "../budget-backend")
const dbEnv = {
  ...process.env,
  PRIVACY_PARITY_TEST: "1",
  DB_DSN: "mysql:host=127.0.0.1;port=3307;dbname=budget_privacy_parity_test;charset=utf8mb4",
  DB_USER: "parity",
  DB_PASS: "parity_test_only",
}
const passphrase = "phase5-browser-passphrase"

type SeededAccount = { email: string; password: string; session_token: string; csrf_token: string }

function seed(testInfo: TestInfo): SeededAccount {
  const titleKey = `${testInfo.project.name}-${testInfo.title}`
  const suffix = `${titleKey.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 26)}${createHash("sha256").update(titleKey).digest("hex").slice(0, 10)}`
  return JSON.parse(execFileSync("php", ["scripts/seed_phase5_browser_account.php"], {
    cwd: backendRoot,
    env: { ...dbEnv, PHASE5_BROWSER_SUFFIX: `6c${suffix}` },
    encoding: "utf8",
  })) as SeededAccount
}

async function signIn(page: Page, account: SeededAccount) {
  await page.goto("/sign-in")
  await page.getByText("Sign in with email and password").click()
  await page.locator("#email").fill(account.email)
  await page.locator("#password").fill(account.password)
  await page.getByRole("button", { name: "Sign In", exact: true }).click()
  await page.context().addCookies([{ name: "sid", value: account.session_token, domain: "127.0.0.1", path: "/" }])
  await page.evaluate((csrf) => window.localStorage.setItem("budget.csrf_token", csrf), account.csrf_token)
  await page.waitForTimeout(100)
}

async function openValidation(page: Page, account: SeededAccount) {
  await page.context().addCookies([{ name: "sid", value: account.session_token, domain: "127.0.0.1", path: "/" }])
  await page.evaluate((csrf) => window.localStorage.setItem("budget.csrf_token", csrf), account.csrf_token)
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.goto("/dev/privacy/migration-validation", { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => undefined)
    if (await page.getByTestId("migration-validation").isVisible({ timeout: 4_000 }).catch(() => false)) return
    await page.waitForTimeout(750)
  }
  await expect(page.getByTestId("migration-validation")).toBeVisible({ timeout: 8_000 })
}

async function finishCutover(page: Page, account: SeededAccount) {
  await openValidation(page, account)
  await page.getByTestId("vault-unlock").click()
  await expect(page.getByTestId("migration-stage")).toHaveText("vault_unlocked", { timeout: 15_000 })
  await page.getByTestId("migration-start").click()
  await expect(page.getByTestId("migration-stage")).toHaveText("migration_in_progress")
  await page.getByTestId("migration-resume").click()
  await expect(page.getByTestId("migration-stage")).toHaveText("staged_ready", { timeout: 30_000 })
  await page.getByTestId("migration-cutover").click()
  await expect(page.getByTestId("migration-stage")).toHaveText("encrypted_authority")
  await page.reload()
  await expect(page.getByTestId("authority-unlock")).toBeEnabled()
  await expect(page.getByTestId("authority-mode")).toHaveText("authority:encrypted:locked")
  await page.getByTestId("authority-unlock").click()
  await expect(page.getByTestId("authority-mode")).toHaveText("authority:encrypted:unlocked")
  await expect(page.getByTestId("migration-stage")).toHaveText("authority_unlocked")
  await page.getByTestId("validation-transactions").click()
  await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible()
}

async function relockAndResync(page: Page, account: SeededAccount) {
  await openValidation(page, account)
  await expect(page.getByTestId("authority-mode")).toHaveText("authority:encrypted:locked")
  await page.getByTestId("authority-unlock").click()
  await expect(page.getByTestId("authority-mode")).toHaveText("authority:encrypted:unlocked")
  await page.getByTestId("validation-transactions").click()
}

async function openFundsWithUnlockedAuthority(page: Page, account: SeededAccount) {
  await openValidation(page, account)
  await expect(page.getByTestId("authority-mode")).toHaveText("authority:encrypted:locked")
  await page.getByTestId("authority-unlock").click()
  await expect(page.getByTestId("authority-mode")).toHaveText("authority:encrypted:unlocked")
  await page.getByTestId("validation-funds").click()
}

async function createTransaction(page: Page, expense: string, amount: string) {
  await page.getByRole("button", { name: "Add Transaction", exact: true }).last().click()
  await expect(page.getByRole("heading", { name: "New Transaction" })).toBeVisible()
  await page.locator("#transaction-amount").fill(amount)
  await page.locator("#expense").fill(expense)
  await page.getByRole("radiogroup", { name: "Choose a tag" }).getByRole("radio").first().click()
  await page.getByRole("button", { name: "Add Transaction", exact: true }).click()
  await expect(page.getByText(expense, { exact: true })).toBeVisible()
}

test.describe("Phase 6C encrypted Transactions and Funds browser proof", () => {
  test("transaction create, update, delete survive reload, relock, and encrypted resync", async ({ page }, testInfo) => {
    const account = seed(testInfo)
    const legacyRequests: string[] = []
    page.on("request", (request) => {
      const pathname = new URL(request.url()).pathname
      if (/\/me\/(transactions|funds)(?:\/|$)/.test(pathname)) legacyRequests.push(`${request.method()} ${pathname}`)
    })
    await signIn(page, account)
    await finishCutover(page, account)

    await createTransaction(page, "6C browser transaction", "7.25")
    await relockAndResync(page, account)
    await expect(page.getByText("6C browser transaction", { exact: true })).toBeVisible()

    await page.getByText("6C browser transaction", { exact: true }).click()
    await page.getByRole("button", { name: "Edit" }).click()
    await expect(page.getByRole("heading", { name: "Edit Transaction" })).toBeVisible()
    await page.locator("#transaction-amount").fill("8.50")
    await page.locator("#expense").fill("6C browser transaction updated")
    await page.getByRole("button", { name: "Save Changes", exact: true }).click()
    await expect(page.getByText("6C browser transaction updated", { exact: true })).toBeVisible()
    await relockAndResync(page, account)
    await expect(page.getByText("6C browser transaction updated", { exact: true })).toBeVisible()
    await expect(page.getByText("6C browser transaction", { exact: true })).not.toBeVisible()

    await page.getByText("6C browser transaction updated", { exact: true }).click()
    await page.getByRole("button", { name: "Delete" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click()
    await expect(page.getByText("6C browser transaction updated", { exact: true })).not.toBeVisible()
    await relockAndResync(page, account)
    await expect(page.getByText("6C browser transaction updated", { exact: true })).not.toBeVisible()
    expect(legacyRequests).toEqual([])
  })

  test("manual Fund contribution survives reload, relock, resync, and derives balance/activity", async ({ page }, testInfo) => {
    const account = seed(testInfo)
    const legacyRequests: string[] = []
    page.on("request", (request) => {
      const pathname = new URL(request.url()).pathname
      if (/\/me\/(transactions|funds)(?:\/|$)/.test(pathname)) legacyRequests.push(`${request.method()} ${pathname}`)
    })
    await signIn(page, account)
    await finishCutover(page, account)
    await openFundsWithUnlockedAuthority(page, account)
    await expect(page.getByText("Active Synthetic Fund", { exact: true })).toBeVisible()
    await page.getByText("Active Synthetic Fund", { exact: true }).click()
    await expect(page.getByRole("heading", { name: "Active Synthetic Fund" })).toBeVisible()
    await page.getByRole("button", { name: "Add money", exact: true }).click()
    await page.locator("#fund-entry-amount").fill("11.00")
    await page.locator("#fund-entry-note").fill("6C browser contribution")
    await page.getByRole("button", { name: "Save entry", exact: true }).click()
    await expect(page.getByText("6C browser contribution", { exact: true })).toBeVisible()
    await expect(page.getByText("$106.00", { exact: true })).toBeVisible()
    await relockAndResync(page, account)
    await openFundsWithUnlockedAuthority(page, account)
    await page.getByText("Active Synthetic Fund", { exact: true }).click()
    await expect(page.getByText("6C browser contribution", { exact: true })).toBeVisible()
    await expect(page.getByText("$106.00", { exact: true })).toBeVisible()
    expect(legacyRequests).toEqual([])
  })

  test("atomic conflict rollback and idempotent retry use the encrypted batch path", async ({ page }, testInfo) => {
    const account = seed(testInfo)
    await signIn(page, account)
    await finishCutover(page, account)
    await openValidation(page, account)
    await page.getByTestId("authority-unlock").click()
    await expect(page.getByTestId("authority-mode")).toHaveText("authority:encrypted:unlocked")
    await page.getByTestId("authority-conflict").click()
    await expect(page.getByTestId("migration-stage")).toHaveText("conflict_rollback_passed")
    await page.reload()
    await expect(page.getByTestId("authority-mode")).toHaveText("authority:encrypted:locked")
    await page.getByTestId("authority-unlock").click()
    await expect(page.getByTestId("authority-mode")).toHaveText("authority:encrypted:unlocked")
    await page.getByTestId("authority-idempotency").click()
    await expect(page.getByTestId("migration-stage")).toHaveText("idempotency_passed")
  })

  test("manual Fund entry edit and delete survive encrypted resync", async ({ page }, testInfo) => {
    const account = seed(testInfo)
    await signIn(page, account)
    await finishCutover(page, account)
    await openFundsWithUnlockedAuthority(page, account)
    await page.getByText("Active Synthetic Fund", { exact: true }).click()
    const firstEntryActions = page.getByRole("button", { name: /Entry actions/i }).first()
    await expect(firstEntryActions).toBeVisible()
    await firstEntryActions.click()
    await page.getByRole("menuitem", { name: "Edit entry" }).click()
    await page.locator("#fund-entry-amount").fill("55.00")
    await page.getByRole("button", { name: "Save changes", exact: true }).click()
    await expect(page.getByText("+$55.00", { exact: true })).toBeVisible()
    await relockAndResync(page, account)
    await openFundsWithUnlockedAuthority(page, account)
    await page.getByText("Active Synthetic Fund", { exact: true }).click()
    await expect(page.getByText("+$55.00", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: /Entry actions/i }).first().click()
    await page.getByRole("menuitem", { name: "Delete entry" }).click()
    await page.getByRole("button", { name: "Delete entry", exact: true }).click()
    await expect(page.getByText("+$55.00", { exact: true })).not.toBeVisible()
    await relockAndResync(page, account)
    await openFundsWithUnlockedAuthority(page, account)
    await page.getByText("Active Synthetic Fund", { exact: true }).click()
    await expect(page.getByText("+$55.00", { exact: true })).not.toBeVisible()
  })
})
