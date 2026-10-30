import { expect, test } from "@playwright/test"
import { setupEncryptedFixture } from "./encrypted-fixture"

test.skip(process.env.NEXT_PUBLIC_BUDGET_V2_ENABLED !== "true", "Requires v2 availability")

test("Settings destinations and an import draft remain available", async ({ page }) => {
  test.setTimeout(90000)
  await setupEncryptedFixture(page, true)
  await page.getByRole("link", { name: "Settings", exact: true }).first().click()
  for (const path of ["budget", "tags", "cards", "contexts", "recurring", "data"]) {
    await expect(page.locator(`main a[href="/settings/${path}"]`).first()).toBeAttached()
  }
  await page.locator('main a[href="/settings/data"]').click()
  await page.getByRole("button", { name: "Import CSV", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Import CSV" })
  await dialog.locator('input[type="file"]').setInputFiles({ name: "sample.csv", mimeType: "text/csv", buffer: Buffer.from("date,expense,amount,category\n2026-01-01,Coffee,5.00,needs\n") })
  await expect(dialog.getByRole("heading", { name: "Map columns" })).toBeVisible()
  await dialog.getByRole("button", { name: "Close" }).click()
  await page.getByRole("button", { name: "Resume import" }).click()
  await expect(dialog.getByRole("heading", { name: "Map columns" })).toBeVisible()
  await expect(dialog.getByText("Coffee").filter({ visible: true }).first()).toBeVisible()
  for (const width of [375, 430, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})
