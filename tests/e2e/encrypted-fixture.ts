import { expect, type Locator, type Page } from "@playwright/test"

export async function enterQuickCaptureAmount(form: Locator, amount: string) {
  await form.getByLabel("Amount", { exact: true }).fill(amount)
}

export async function openInsightsFromMore(page: Page) {
  if (!(await currentInterfaceIsV2(page))) {
    await page.getByRole("link", { name: "Insights", exact: true }).filter({ visible: true }).first().click()
    await expect(page).toHaveURL(/\/insights$/)
    return
  }
  await page.getByRole("navigation", { name: "Primary desktop" }).getByRole("link", { name: "More" }).click()
  await expect(page).toHaveURL(/\/settings$/)
  await page.getByRole("link", { name: "Insights", exact: true }).first().click()
  await expect(page).toHaveURL(/\/insights$/)
}

export async function openSettings(page: Page) {
  if (await currentInterfaceIsV2(page)) await page.getByRole("navigation", { name: "Primary desktop" }).getByRole("link", { name: "More" }).click()
  else await page.getByRole("link", { name: "Settings", exact: true }).filter({ visible: true }).first().click()
  await expect(page).toHaveURL(/\/settings$/)
}

export async function openActivity(page: Page) {
  if (await currentInterfaceIsV2(page)) await page.getByRole("navigation", { name: "Primary desktop" }).getByRole("link", { name: "Activity" }).click()
  else await page.getByRole("link", { name: "Transactions", exact: true }).filter({ visible: true }).first().click()
  await expect(page).toHaveURL(/\/transactions/)
}

export async function openReview(page: Page) {
  if (await currentInterfaceIsV2(page)) await page.getByRole("navigation", { name: "Primary desktop" }).getByRole("link", { name: /Review/ }).click()
  else await page.getByRole("link", { name: /Review/ }).filter({ visible: true }).first().click()
  await expect(page).toHaveURL(/\/review$/)
}

export async function openFundsFromMore(page: Page) {
  await openSettings(page)
  await page.getByRole("link", { name: "Funds", exact: true }).click()
  await expect(page).toHaveURL(/\/insights\/funds$/)
}

async function currentInterfaceIsV2(page: Page) {
  const v2 = await page.evaluate(() => localStorage.getItem("budget.interface-version") === "v2")
  if (v2) {
    await expect(page.locator("html")).toHaveClass(/v2-theme/)
    await expect(page.getByRole("navigation", { name: "Primary desktop" })).toBeVisible()
  } else {
    await expect(page.locator("html")).not.toHaveClass(/v2-theme/)
    await expect(page.getByRole("navigation", { name: "Primary desktop" })).toHaveCount(0)
  }
  return v2
}

export async function setupEncryptedFixture(page: Page, capture: boolean) {
  let metadata: Record<string, unknown> | null = null
  let sequence = 0
  const records: Record<string, unknown>[] = []
  const bodies: string[] = []
  const batches = new Map<string, Record<string, unknown>[]>()
  let failRequests = 0
  let failBeforeCommit = 0
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
    if (pathname.startsWith("/api/v1/me/encrypted-records/") && (req.method() === "PUT" || req.method() === "DELETE")) {
      const body = req.postDataJSON() as { envelope?: Record<string, unknown>; expected_revision: number }
      const id = decodeURIComponent(pathname.split("/").at(-1)!)
      const record = req.method() === "PUT" ? { ...body.envelope, sync_sequence: String(++sequence), deleted: false } : { vault_id: "test-vault", record_id: id, envelope_version: 1, record_revision: body.expected_revision + 1, sync_sequence: String(++sequence), deleted: true }
      records.push(record)
      return route.fulfill({ json: record })
    }
    if (pathname === "/api/v1/me/encrypted-records/batch") {
      const serialized = req.postData() ?? ""
      bodies.push(serialized)
      if (failBeforeCommit > 0) { failBeforeCommit--; return route.abort("failed") }
      const body = req.postDataJSON() as { idempotency_key: string; creates: { envelope: Record<string, unknown> }[]; updates: { envelope: Record<string, unknown>; expected_revision: number }[]; tombstones: { record_id: string; expected_revision: number }[] }
      let created = batches.get(body.idempotency_key)
      if (!created) {
        const latest = (id: unknown) => records.findLast((record) => record.record_id === id)
        const conflict = body.creates.some((item) => latest(item.envelope.record_id)) || body.updates.some((item) => { const current = latest(item.envelope.record_id); return !current || current.deleted || current.record_revision !== item.expected_revision }) || (body.tombstones ?? []).some((item) => { const current = latest(item.record_id); return !current || current.deleted || current.record_revision !== item.expected_revision })
        if (conflict) return route.fulfill({ status: 409, json: { error: { code: "ENCRYPTED_RECORD_REVISION_CONFLICT", message: "Encrypted record revision conflict" } } })
        created = [...body.creates, ...body.updates].map(item => ({ ...item.envelope, sync_sequence: String(++sequence), deleted: false })); for (const item of body.tombstones ?? []) created.push({ vault_id: "test-vault", record_id: item.record_id, envelope_version: 1, record_revision: item.expected_revision + 1, sync_sequence: String(++sequence), deleted: true }); batches.set(body.idempotency_key, created); records.push(...created)
      }
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
  await expect(page.getByRole("heading", { name: "Vault status" })).toBeVisible()
  await page.goto("/settings", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("switch", { name: "Use v2 interface" })).toBeVisible({ timeout: 20000 })
  await page.goto("/")
  await page.getByRole("button", { name: "Use Vault passphrase" }).click()
  await page.getByLabel("Vault passphrase", { exact: true }).fill("test v2 vault password 2026")
  await page.getByRole("button", { name: "Unlock Vault" }).click()
  await expect(page.getByRole("navigation", { name: "Primary desktop" })).toBeVisible()
  await expect(page.getByTestId("v2-overview")).toBeVisible({ timeout: 20000 })
  return { records, bodies, failNext: (count: number) => { failRequests = count }, failBeforeNext: (count: number) => { failBeforeCommit = count } }
}
