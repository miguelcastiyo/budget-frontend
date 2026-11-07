import { expect, test } from "@playwright/test"
import { setupEncryptedFixture } from "./encrypted-fixture"

test.skip(process.env.NEXT_PUBLIC_BUDGET_V2_ENABLED !== "true", "Requires interface switching")

test("Classic keeps a transaction draft when an inline card is created", async ({ page }) => {
  test.setTimeout(90000)
  await setupEncryptedFixture(page, false)
  await page.getByRole("link", { name: "More", exact: true }).first().click()
  await page.getByRole("switch", { name: "Use v2 interface" }).click()
  await page.setViewportSize({ width: 375, height: 667 })
  await page.getByRole("navigation", { name: "Primary", exact: true }).getByRole("button", { name: "Log transaction" }).click()

  const editor = page.getByRole("dialog", { name: "New Transaction" })
  await editor.getByLabel("Amount", { exact: true }).fill("42.75")
  await editor.getByLabel("Description", { exact: true }).fill("Train pass")
  await editor.getByRole("radiogroup", { name: "Category" }).getByRole("radio", { name: "Wants" }).click()
  await editor.getByRole("button", { name: "Yesterday" }).click()
  await editor.getByRole("button", { name: /More details/ }).click()
  await editor.getByLabel("Note", { exact: true }).fill("Weekend trip")
  await editor.getByRole("button", { name: "New card" }).click()
  await editor.getByPlaceholder("Card name").fill("Travel card")
  await editor.getByRole("button", { name: "Add card" }).click()

  await expect(editor.getByRole("radiogroup", { name: "Choose a card" }).getByRole("radio", { name: "Travel card" })).toHaveAttribute("aria-checked", "true")
  await expect(editor.getByLabel("Amount", { exact: true })).toHaveValue("42.75")
  await expect(editor.getByLabel("Description", { exact: true })).toHaveValue("Train pass")
  await expect(editor.getByRole("radiogroup", { name: "Category" }).getByRole("radio", { name: "Wants" })).toHaveAttribute("aria-checked", "true")
  await expect(editor.getByLabel("Note", { exact: true })).toHaveValue("Weekend trip")
  await expect(editor.getByRole("button", { name: /More details/ })).toHaveAttribute("aria-expanded", "true")

  await editor.getByRole("button", { name: "New tag" }).click()
  await editor.getByPlaceholder("Tag name").fill("Travel")
  await editor.getByRole("button", { name: "Add tag" }).click()
  await expect(editor.getByLabel("Amount", { exact: true })).toHaveValue("42.75")
  await expect(editor.getByRole("radiogroup", { name: "Choose a card" }).getByRole("radio", { name: "Travel card" })).toHaveAttribute("aria-checked", "true")
  await editor.getByRole("button", { name: "Add Transaction", exact: true }).click()
  await expect(editor).toHaveCount(0)
})
