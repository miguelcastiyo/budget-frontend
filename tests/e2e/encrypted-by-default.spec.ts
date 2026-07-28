import { test, expect, type Page, type TestInfo } from "@playwright/test"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import path from "node:path"

const backendRoot = path.resolve(process.cwd(), "../budget-backend")
type SeededAccount = { email: string; password: string; session_token: string; csrf_token: string }

function seed(testInfo: TestInfo) {
  const titleKey = `${testInfo.project.name}-${testInfo.title}`
  const suffix = `${titleKey.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 26)}${createHash("sha256").update(titleKey).digest("hex").slice(0, 10)}`
  const raw = execFileSync("php", ["scripts/seed_encrypted_default_browser_account.php"], { cwd: backendRoot, env: { ...process.env, PRIVACY_PARITY_TEST: "1", DB_DSN: "mysql:host=127.0.0.1;port=3307;dbname=budget_privacy_parity_test;charset=utf8mb4", DB_USER: "parity", DB_PASS: "parity_test_only", ENCRYPTED_DEFAULT_BROWSER_SUFFIX: suffix }, encoding: "utf8" })
  return JSON.parse(raw) as SeededAccount
}

async function signIn(page: Page, account: SeededAccount) {
  await page.goto("/sign-in")
  await page.getByText("Sign in with email and password").click()
  await page.locator("#email").fill(account.email)
  await page.locator("#password").fill(account.password)
  await page.getByRole("button", { name: "Sign In", exact: true }).click()
  await page.context().addCookies([{ name: "sid", value: account.session_token, domain: "127.0.0.1", path: "/" }])
  await page.evaluate((csrf) => window.localStorage.setItem("budget.csrf_token", csrf), account.csrf_token)
}

test("new account completes Vault setup without migration", async ({ page }, testInfo) => {
  const account = seed(testInfo)
  await signIn(page, account)
  await page.goto("/")
  await expect(page.getByTestId("encrypted-vault-locked-boundary")).toContainText("Vault setup required")
  await page.getByRole("link", { name: "Set up your Vault" }).click()
  await expect(page.getByTestId("privacy-setup-flow")).toBeVisible()
  await page.getByTestId("privacy-setup-start").click()
  await page.getByLabel("Vault passphrase", { exact: true }).fill("new account vault passphrase")
  await page.getByLabel("Confirm Vault passphrase", { exact: true }).fill("new account vault passphrase")
  await page.getByRole("button", { name: "Continue", exact: true }).click()
  await expect(page.getByTestId("recovery-code-ceremony")).toBeVisible()
  const displayedCode = await page.getByLabel("Recovery Code", { exact: true }).innerText()
  await page.getByText("I've saved my Recovery Code somewhere safe.").click()
  await page.getByLabel("Enter the last 4 characters of your Recovery Code.").fill(displayedCode.replace(/-/g, "").slice(-4))
  await page.getByRole("button", { name: "Continue", exact: true }).click()
  await expect(page.getByText("You're ready")).toBeVisible()
  const privacy = await page.evaluate(async () => (await fetch("/api/v1/me/privacy")).json()) as { financial_privacy_state: string }
  expect(privacy.financial_privacy_state).toBe("encrypted")
  await page.getByRole("button", { name: "Start budgeting", exact: true }).click()
  await page.goto("/settings/vault")
  await expect(page.getByText("Unlocked")).toBeVisible()
})
