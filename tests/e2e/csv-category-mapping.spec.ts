import { expect, test } from "@playwright/test"
import { setupEncryptedFixture } from "./encrypted-fixture"

test.skip(process.env.NEXT_PUBLIC_BUDGET_V2_ENABLED !== "true", "Requires v2 availability")

for (const classic of [false, true]) {
  test(`mapped CSV categories match the committed export and rollback (${classic ? "Classic" : "v2"})`, async ({ page }) => {
    test.setTimeout(120000)
    await setupEncryptedFixture(page, true)
    await page.getByRole("link", { name: "Settings", exact: true }).first().click()
    if (classic) await page.getByRole("switch", { name: "Use v2 interface" }).click()
    await page.locator('main a[href="/settings/data"]').click()
    await page.getByRole("button", { name: "Import CSV", exact: true }).click()
    const dialog = page.getByRole("dialog", { name: "Import CSV" })
    await dialog.locator('input[type="file"]').setInputFiles({ name: "mapped.csv", mimeType: "text/csv", buffer: Buffer.from("date,expense,amount,category,tag\n2026-01-01,Rent,10,Home,Shared\n2026-01-02,Groceries,20,Food,Shared\n2026-01-03,Movie,30,Fun,Shared\n2026-01-04,Deposit,40,Reserve,Shared\n") })
    await expect(dialog.getByRole("heading", { name: "Map columns" })).toBeVisible()
    await dialog.getByRole("button", { name: "Continue" }).click()
    await expect(dialog.getByRole("heading", { name: "Budget group setup" })).toBeVisible()
    await dialog.getByRole("combobox").first().click()
    await page.getByRole("option", { name: "Map imported labels" }).click()
    await dialog.getByRole("combobox").nth(1).click()
    await page.getByRole("option", { name: "category", exact: true }).click()
    for (const [label, category] of [["Home", "Needs"], ["Food", "Needs"], ["Fun", "Wants"], ["Reserve", "Savings"]]) {
      const row = dialog.getByText(label, { exact: true }).locator("../..")
      await row.getByRole("button", { name: category }).click()
    }
    await dialog.getByRole("button", { name: "Continue" }).click()
    await dialog.getByRole("button", { name: "Validate" }).click()
    const preview = dialog.getByLabel("Budget group preview")
    await expect(preview).toContainText("2 transactions · $30.00")
    await expect(preview).toContainText("1 transaction · $30.00")
    await expect(preview).toContainText("1 transaction · $40.00")
    await dialog.getByRole("button", { name: "Import 4 rows" }).click()
    await expect(dialog.getByText("Import complete", { exact: false }).first()).toBeVisible()
    await dialog.getByRole("button", { name: "Done" }).click()
    const downloadPromise = page.waitForEvent("download")
    await page.getByRole("button", { name: "Export CSV", exact: true }).click()
    const download = await downloadPromise
    const stream = await download.createReadStream()
    let csv = ""
    for await (const chunk of stream) csv += chunk.toString()
    expect(csv).toContain('"Rent",10.00,needs')
    expect(csv).toContain('"Groceries",20.00,needs')
    expect(csv).toContain('"Movie",30.00,wants')
    expect(csv).toContain('"Deposit",40.00,savings')
    await page.getByRole("button", { name: "Rollback", exact: true }).click()
    const confirmation = page.getByRole("dialog", { name: "Rollback import?" })
    await confirmation.getByRole("button", { name: "Rollback import" }).click()
    await expect(confirmation).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Rollback", exact: true })).toHaveCount(0)
    const rolledBackDownload = page.waitForEvent("download")
    await page.getByRole("button", { name: "Export CSV", exact: true }).click()
    const rolledBackStream = await (await rolledBackDownload).createReadStream()
    let rolledBackCsv = ""
    for await (const chunk of rolledBackStream) rolledBackCsv += chunk.toString()
    expect(rolledBackCsv).not.toContain('"Rent"')
  })
}

test("invalid exact-column categories prevent confirmation", async ({ page }) => {
  test.setTimeout(90000)
  await setupEncryptedFixture(page, true)
  await page.getByRole("link", { name: "Settings", exact: true }).first().click()
  await page.locator('main a[href="/settings/data"]').click()
  await page.getByRole("button", { name: "Import CSV", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Import CSV" })
  await dialog.locator('input[type="file"]').setInputFiles({ name: "invalid.csv", mimeType: "text/csv", buffer: Buffer.from("date,expense,amount,category,tag\n2026-01-01,Valid,10,needs,Shared\n2026-01-02,Invalid,20,unknown,Shared\n") })
  await expect(dialog.getByRole("heading", { name: "Map columns" })).toBeVisible()
  await dialog.getByRole("button", { name: "Continue" }).click()
  await dialog.getByRole("button", { name: "Continue" }).click()
  await dialog.getByRole("button", { name: "Validate" }).click()
  await expect(dialog.getByText(/Choose a valid Needs, Wants, or Savings category/)).toBeVisible()
  await expect(dialog.getByRole("button", { name: "Import 1 rows" })).toBeDisabled()
})
