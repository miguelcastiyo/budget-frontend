import { expect, test, type Page } from "@playwright/test"

test.skip(process.env.NEXT_PUBLIC_BUDGET_V2_ENABLED !== "true", "Requires v2 availability")

async function setup(page: Page, capture: boolean) {
  let metadata: Record<string, unknown> | null = null
  let sequence = 0
  const records: Record<string, unknown>[] = []
  const bodies: string[] = []
  const batches = new Map<string, Record<string, unknown>[]>()
  let failRequests = 0
  await page.addInitScript(() => { localStorage.setItem("budget.csrf_token", "test-token"); localStorage.setItem("budget.interface-version", "v2") })
  await page.route("**/api/pending-capabilities", route => route.fulfill({ json: { capture, recovery: capture } }))
  await page.route("**/api/v1/**", async route => {
    const req = route.request()
    const pathname = new URL(req.url()).pathname
    if (pathname === "/api/v1/me") return route.fulfill({ json: { id: "test-v2", email: "test@example.test", display_name: "Tester", avatar_url: null, role: "member", onboarding_complete: true, email_verified: true, user_preferences: { appearance: { theme: "light" }, onboarding: { dismissed: true } } } })
    if (pathname === "/api/v1/me/auth-methods") return route.fulfill({ json: { methods: [] } })
    if (pathname === "/api/v1/me/setup-status") return route.fulfill({ json: { budget_profile_complete: false, onboarding_dismissed: true, setup_tasks: [] } })
    if (pathname === "/api/v1/me/privacy") return route.fulfill({ json: { financial_privacy_state: metadata ? "encrypted" : "vault_setup_required" } })
    if (pathname === "/api/v1/me/vault/quick-unlock") return route.fulfill({ json: { status: "not_enrolled" } })
    if (pathname === "/api/v1/me/vault" && req.method() === "POST") {
      const body = req.postDataJSON()
      metadata = { vault_id: "test-vault", crypto_profile_version: body.crypto_profile_version, passphrase: body.passphrase_wrap, recovery: body.recovery_wrap }
      return route.fulfill({ json: metadata })
    }
    if (pathname === "/api/v1/me/vault" && metadata) return route.fulfill({ json: metadata })
    if (pathname === "/api/v1/me/encrypted-records/sync") return route.fulfill({ json: { changes: records, next_cursor: String(sequence), has_more: false } })
    if (pathname === "/api/v1/me/encrypted-records" && req.method() === "POST") {
      const body = req.postDataJSON() as { envelope: Record<string, unknown> }
      const record = { ...body.envelope, sync_sequence: String(++sequence), deleted: false }
      records.push(record)
      return route.fulfill({ json: record })
    }
    if (pathname === "/api/v1/me/encrypted-records/batch") {
      const serialized = req.postData() ?? ""
      bodies.push(serialized)
      const body = req.postDataJSON() as { idempotency_key: string; creates: { envelope: Record<string, unknown> }[] }
      let created = batches.get(body.idempotency_key)
      if (!created) { created = body.creates.map(item => ({ ...item.envelope, sync_sequence: String(++sequence), deleted: false })); batches.set(body.idempotency_key, created); records.push(...created) }
      if (failRequests > 0) { failRequests--; return route.abort("failed") }
      return route.fulfill({ json: { records: created, idempotent: false } })
    }
    return route.fulfill({ status: 404, json: {} })
  })
  await page.goto("/settings/vault")
  await page.getByTestId("privacy-setup-start").click()
  await page.getByLabel("Vault passphrase", { exact: true }).fill("test v2 vault password 2026")
  await page.getByLabel("Confirm Vault passphrase").fill("test v2 vault password 2026")
  await page.getByRole("button", { name: "Continue", exact: true }).click()
  const recovery = await page.getByLabel("Recovery Code", { exact: true }).innerText()
  await page.getByText("I've saved my Recovery Code somewhere safe.").click()
  await page.getByLabel("Enter the last 4 characters of your Recovery Code.").fill(recovery.replace(/-/g, "").slice(-4))
  await page.getByRole("button", { name: "Continue", exact: true }).click()
  await page.goto("/settings")
  await expect(page.getByRole("switch", { name: "Use v2 interface" })).toBeVisible()
  await page.goto("/")
  await page.getByRole("button", { name: "Use Vault passphrase" }).click()
  await page.getByLabel("Vault passphrase", { exact: true }).fill("test v2 vault password 2026")
  await page.getByRole("button", { name: "Unlock Vault" }).click()
  await expect(page.getByRole("navigation", { name: "Primary desktop" })).toBeVisible()
  return { records, bodies, failNext: (count: number) => { failRequests = count } }
}

test("v2 Add preserves fields between modes and saves encrypted pending records", async ({ page }) => {
  test.setTimeout(90000)
  const { records } = await setup(page, true)
  await page.getByRole("button", { name: "Add", exact: true }).click()
  const quick = page.getByRole("form", { name: "Quick Capture" })
  await expect(quick).toBeVisible()
  await quick.getByLabel("Amount").fill("12.50")
  await quick.getByLabel("Description").fill("Coffee")
  await quick.getByRole("button", { name: "Full Entry" }).click()
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue("Coffee")
  await page.getByRole("button", { name: "Quick Capture", exact: true }).click()
  await expect(quick.getByLabel("Amount")).toHaveValue("12.50")
  await expect(quick.getByLabel("Description")).toHaveValue("Coffee")
  await quick.getByRole("button", { name: "Save & New" }).click()
  await expect(quick.getByRole("status")).toContainText("Saved to Review")
  await expect(quick.getByLabel("Amount")).toHaveValue("")
  expect(records.length).toBeGreaterThan(0)
  await quick.getByLabel("Description").fill("Lunch")
  page.once("dialog", dialog => dialog.dismiss())
  await quick.getByRole("button", { name: "Close" }).click()
  await expect(quick.getByLabel("Description")).toHaveValue("Lunch")
})

test("v2 Add falls back to Full Entry without capture permission", async ({ page }) => {
  test.setTimeout(90000)
  await setup(page, false)
  await page.getByRole("button", { name: "Add", exact: true }).click()
  await expect(page.getByRole("dialog")).toContainText("New Transaction")
  await expect(page.getByRole("form", { name: "Quick Capture" })).toHaveCount(0)
})


test("uncertain capture retries the original encrypted batch", async ({ page }) => {
  test.setTimeout(90000)
  const fixture = await setup(page, true)
  fixture.failNext(2)
  await page.getByRole("button", { name: "Add", exact: true }).click()
  const quick = page.getByRole("form", { name: "Quick Capture" })
  await quick.getByLabel("Amount").fill("8.25")
  await quick.getByRole("button", { name: "Save & New" }).click()
  await expect(quick.getByText(/save outcome is uncertain/i)).toBeVisible()
  await expect(quick.getByRole("button", { name: "Full Entry" })).toBeDisabled()
  await quick.getByRole("button", { name: "Save & New" }).click()
  await expect(quick.getByRole("status")).toContainText("Saved to Review")
  expect(fixture.bodies).toHaveLength(3)
  expect(new Set(fixture.bodies).size).toBe(1)
  expect(fixture.records).toHaveLength(1)
  await quick.getByLabel("Description").fill("Description only")
  await quick.getByRole("button", { name: "Save & New" }).click()
  await expect(quick.getByLabel("Description")).toHaveValue("")
  expect(fixture.records).toHaveLength(2)
})

test("Full Entry retains inline creations and recurring schedule through mode switches", async ({ page }) => {
  test.setTimeout(90000)
  const { records } = await setup(page, true)
  await page.getByRole("button", { name: "Add", exact: true }).click()
  const quick = page.getByRole("form", { name: "Quick Capture" })
  await quick.getByLabel("Amount").fill("14.00")
  await quick.getByLabel("Description").fill("Dinner")
  await quick.getByRole("button", { name: "Full Entry" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: "New tag" }).click()
  await dialog.getByPlaceholder("Tag name").fill("Meals")
  await dialog.getByRole("button", { name: "Add tag", exact: true }).click()
  await expect(dialog.getByRole("radio", { name: "Meals" })).toBeVisible()
  await dialog.getByRole("button", { name: /More details/ }).click()
  await dialog.getByRole("button", { name: "New card" }).click()
  await dialog.getByPlaceholder("Card name").fill("Daily Card")
  await dialog.getByRole("button", { name: "Add card", exact: true }).click()
  await expect(dialog.getByRole("radio", { name: "Daily Card" })).toBeVisible()
  await dialog.getByRole("button", { name: "Choose a context for this transaction" }).click()
  const contextDialog = page.getByRole("dialog", { name: "Context", exact: true })
  await contextDialog.getByRole("button", { name: "Create context" }).click()
  await page.getByPlaceholder("Context name").fill("Travel")
  await page.getByRole("button", { name: "Create context", exact: true }).click()
  await expect(dialog.getByText("Travel", { exact: true })).toBeVisible()
  const recurring = dialog.getByText("Automatically add this every month").locator("../..").getByRole("switch")
  await recurring.click()
  await dialog.getByLabel("Day of month").fill("17")
  await dialog.getByRole("button", { name: "Quick Capture", exact: true }).click()
  await quick.getByRole("button", { name: "Full Entry" }).click()
  await expect(dialog.getByLabel("Day of month")).toHaveValue("17")
  await expect(dialog.getByText("Travel", { exact: true })).toBeVisible()
  await expect(dialog.getByRole("radio", { name: "Meals" })).toBeVisible()
  await dialog.getByRole("button", { name: "Add Transaction", exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(records.length).toBeGreaterThanOrEqual(5)
})

test("an interrupted uncertain capture is checked after Vault unlock", async ({ page }) => {
  test.setTimeout(90000)
  const fixture = await setup(page, true)
  fixture.failNext(2)
  await page.getByRole("button", { name: "Add", exact: true }).click()
  const quick = page.getByRole("form", { name: "Quick Capture" })
  await quick.getByLabel("Description").fill("Uncertain")
  await quick.getByRole("button", { name: "Save & New" }).click()
  await expect(quick.getByText(/save outcome is uncertain/i)).toBeVisible()
  await page.reload()
  await page.getByRole("button", { name: "Use Vault passphrase" }).click()
  await page.getByLabel("Vault passphrase", { exact: true }).fill("test v2 vault password 2026")
  await page.getByRole("button", { name: "Unlock Vault" }).click()
  await page.getByRole("button", { name: "Add", exact: true }).click()
  const notice = page.getByRole("alert").filter({ hasText: "uncertain outcome" })
  await expect(notice).toBeVisible()
  await notice.getByRole("button", { name: "Sync Review" }).click()
  await expect(page.getByRole("alert").filter({ hasText: "found in Review" })).toBeVisible()
  expect(fixture.records).toHaveLength(1)
})

test("v2 Add remains usable on a small dark mobile viewport", async ({ page }) => {
  test.setTimeout(90000)
  await setup(page, true)
  await page.setViewportSize({ width: 375, height: 667 })
  await page.evaluate(() => document.documentElement.classList.add("dark"))
  await page.getByRole("navigation", { name: "Primary", exact: true }).getByRole("button", { name: "Log transaction" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveCSS("background-color", "rgb(22, 23, 26)")
  const quick = page.getByRole("form", { name: "Quick Capture" })
  await quick.getByLabel("Description").fill("Mobile draft")
  await quick.getByRole("button", { name: "Full Entry" }).click()
  await expect(dialog.getByLabel("Description", { exact: true })).toHaveValue("Mobile draft")
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
