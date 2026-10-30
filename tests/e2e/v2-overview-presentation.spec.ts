import { expect, test } from "@playwright/test"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"

test("v2 Overview presents production-shaped data at mobile and desktop widths", async ({ page }) => {
  const html = execFileSync(process.execPath, ["scripts/test-v2-overview.cjs", "--html"], { encoding: "utf8" })
  const css = readFileSync(path.join(process.cwd(), "components/budget/v2-overview.module.css"), "utf8").replace(":global(.dark)", ".dark")
  await page.setContent(`<style>*,*::before,*::after{box-sizing:border-box}body{margin:0}main{padding:0 1.25rem}@media(min-width:1024px){main{padding:0 2rem}}${css}</style><main>${html}</main>`)
  await expect(page.getByLabel("Month summary")).toContainText("$350.00")
  await expect(page.getByLabel("Month summary")).toContainText("$650.00 of $1,000.00")
  await expect(page.getByLabel("Month actions")).toContainText("2 to sort")
  await expect(page.getByLabel("Recent transactions")).toContainText("Market")
  await expect(page.getByRole("progressbar", { name: "Savings spent" })).toHaveAttribute("aria-valuenow", "100")
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.locator(".grid").evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length)).toBe(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await expect(page.locator(".root")).toHaveScreenshot("overview-mobile.png", { animations: "disabled" })
  await page.setViewportSize({ width: 1280, height: 800 })
  expect(await page.locator(".grid").evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length)).toBe(2)
  await expect(page.locator(".root")).toHaveScreenshot("overview-desktop.png", { animations: "disabled" })
  await page.locator("html").evaluate(el => el.classList.add("dark"))
  await expect(page.locator(".root")).toHaveCSS("background-color", "rgb(22, 23, 26)")
})
