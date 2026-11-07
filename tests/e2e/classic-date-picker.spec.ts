import { expect, test } from "@playwright/test"
import { format } from "date-fns"
import { setupEncryptedFixture } from "./encrypted-fixture"

test.skip(process.env.NEXT_PUBLIC_BUDGET_V2_ENABLED !== "true", "Requires interface switching")

test("Classic mobile calendar closes after selecting a date without changing the draft", async ({ page }) => {
  test.setTimeout(90000)
  await setupEncryptedFixture(page, false)
  await page.getByRole("link", { name: "More", exact: true }).first().click()
  await page.getByRole("switch", { name: "Use v2 interface" }).click()
  await page.setViewportSize({ width: 375, height: 667 })
  await page.getByRole("navigation", { name: "Primary", exact: true }).getByRole("button", { name: "Log transaction" }).click()

  const editor = page.getByRole("dialog", { name: "New Transaction" })
  await editor.getByLabel("Amount", { exact: true }).fill("18.25")
  await editor.getByLabel("Description", { exact: true }).fill("Groceries")
  const dateButton = editor.getByText("Date", { exact: true }).locator("..").getByRole("button").last()
  const expectedDate = format(new Date(new Date().getFullYear(), new Date().getMonth(), 15), "MMM d, yyyy")

  await dateButton.click()
  const calendar = page.locator('[data-slot="popover-content"]')
  await expect(calendar).toBeVisible()
  await calendar.locator(".rdp-day_button").filter({ hasText: /^15$/ }).first().click()
  await expect(calendar).toHaveCount(0)
  await expect(dateButton).toContainText(expectedDate)
  await expect(editor.getByLabel("Amount", { exact: true })).toHaveValue("18.25")
  await expect(editor.getByLabel("Description", { exact: true })).toHaveValue("Groceries")

  await dateButton.click()
  await expect(calendar).toBeVisible()
  await calendar.locator(".rdp-day_button").filter({ hasText: /^15$/ }).first().click()
  await expect(calendar).toHaveCount(0)
  await expect(dateButton).toContainText(expectedDate)

  await dateButton.click()
  await expect(calendar).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(calendar).toHaveCount(0)
  await expect(dateButton).toContainText(expectedDate)
})
