import { expect, test } from "@playwright/test"

test("required update is announced on foreground without discarding a draft", async ({ page }) => {
  let minimum = 1
  await page.route("**/api/client-readiness", (route) => route.fulfill({ json: { minVersion: minimum }, headers: { "Cache-Control": "no-store" } }))
  await page.goto("/sign-in")
  await page.getByText("Sign in with email and password").click()
  await page.locator("#email").fill("draft@example.test")
  minimum = 2
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))
  await expect(page.getByText(/An update is required/)).toBeVisible()
  await expect(page.locator("#email")).toHaveValue("draft@example.test")
  await page.unroute("**/api/client-readiness")
  await page.route("**/api/client-readiness", (route) => route.abort())
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))
  await expect(page.getByText(/An update is required/)).toBeVisible()
  await expect(page.locator("#email")).toHaveValue("draft@example.test")
})
