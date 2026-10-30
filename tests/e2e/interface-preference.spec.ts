import { expect, test, type Page } from "@playwright/test"

const enabled = process.env.NEXT_PUBLIC_BUDGET_V2_ENABLED === "true"

async function mockAccount(page: Page, capture = false) {
  await page.addInitScript(() => localStorage.setItem("budget.csrf_token", "test-token"))
  await page.route("**/api/pending-capabilities", route => route.fulfill({ json: { capture, recovery: capture } }))
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname
    if (path === "/api/v1/me") return route.fulfill({ json: {
      id: "user-1", email: "test@example.com", display_name: "Test User", avatar_url: null,
      role: "member", onboarding_complete: true, email_verified: true,
      user_preferences: { appearance: { theme: "light" }, onboarding: { dismissed: true } },
    } })
    if (path === "/api/v1/me/privacy") return route.fulfill({ json: { financial_privacy_state: "encrypted" } })
    if (path === "/api/v1/me/auth-methods") return route.fulfill({ json: { methods: [] } })
    if (path === "/api/v1/me/setup-status") return route.fulfill({ json: { onboarding_dismissed: true, recommended_next_action: "none", setup_tasks: [] } })
    if (path === "/api/v1/me/vault/quick-unlock") return route.fulfill({ json: { status: "not_enrolled" } })
    return route.fulfill({ status: 404, json: {} })
  })
}

test("interface availability, persistence and navigation", async ({ page }) => {
  await mockAccount(page, true)
  await page.goto("/settings")
  const toggle = page.getByRole("switch", { name: "Use v2 interface" })
  await expect(toggle).not.toBeChecked()
  if (!enabled) {
    await expect(toggle).toBeDisabled()
    return
  }
  await expect(toggle).toBeEnabled()
  await page.locator("main").evaluate(element => { element.setAttribute("data-test-preserved", "yes") })
  await toggle.click()
  await expect(toggle).toBeChecked()
  await expect(page.locator('main[data-test-preserved="yes"]')).toHaveCount(1)
  const nav = page.getByRole("navigation", { name: "Primary desktop" })
  await expect(nav).toBeVisible()
  await expect(nav.getByRole("link", { name: "Review" })).toBeVisible()
  await expect(nav.getByRole("link", { name: "Transactions" })).toHaveAttribute("href", /\/transactions\?month=/)
  await page.reload()
  await expect(toggle).toBeChecked()
  await nav.getByRole("link", { name: "Review" }).click()
  await expect(page).toHaveURL(/\/review/)
  await page.goBack()
  await expect(page).toHaveURL(/\/settings/)
  await page.goForward()
  await expect(page).toHaveURL(/\/review/)
  await page.goBack()
  await toggle.click()
  await expect(toggle).not.toBeChecked()
  await expect(page.getByRole("navigation", { name: "Primary desktop" })).toHaveCount(0)
})

test("unavailable preference storage keeps Classic", async ({ page }) => {
  await mockAccount(page)
  await page.addInitScript(() => {
    const originalGet = Storage.prototype.getItem
    const originalSet = Storage.prototype.setItem
    Storage.prototype.getItem = function (key) { if (key === "budget.interface-version") throw new Error("blocked"); return originalGet.call(this, key) }
    Storage.prototype.setItem = function (key, value) { if (key === "budget.interface-version") throw new Error("blocked"); return originalSet.call(this, key, value) }
  })
  await page.goto("/settings")
  const toggle = page.getByRole("switch", { name: "Use v2 interface" })
  await expect(toggle).not.toBeChecked()
  if (enabled) {
    await toggle.click()
    await expect(toggle).not.toBeChecked()
  }
})

test("invalid preference falls back to Classic and Review remains capability gated", async ({ page }) => {
  await mockAccount(page)
  await page.addInitScript(() => localStorage.setItem("budget.interface-version", "invalid"))
  await page.goto("/settings")
  await expect(page.getByRole("switch", { name: "Use v2 interface" })).not.toBeChecked()
  if (enabled) {
    await page.getByRole("switch", { name: "Use v2 interface" }).click()
    await expect(page.getByRole("navigation", { name: "Primary desktop" }).getByRole("link", { name: "Review" })).toHaveCount(0)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible()
    await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Settings" })).toBeVisible()
  }
})

test("availability flag does not erase a saved v2 preference", async ({ page }) => {
  test.skip(enabled, "Checks the disabled deployment setting")
  await mockAccount(page)
  await page.addInitScript(() => localStorage.setItem("budget.interface-version", "v2"))
  await page.goto("/settings")
  const toggle = page.getByRole("switch", { name: "Use v2 interface" })
  await expect(toggle).toBeDisabled()
  await expect(toggle).not.toBeChecked()
  expect(await page.evaluate(() => localStorage.getItem("budget.interface-version"))).toBe("v2")
})
