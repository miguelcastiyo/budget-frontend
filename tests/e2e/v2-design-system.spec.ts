import { expect, test } from "@playwright/test"
import { setupEncryptedFixture } from "./encrypted-fixture"

test.skip(process.env.NEXT_PUBLIC_BUDGET_V2_ENABLED !== "true", "Requires v2 availability")

test("v2 shell, palette and portal surfaces form one system and clear cleanly for Classic", async ({ page }) => {
  await setupEncryptedFixture(page, false)
  await page.setViewportSize({ width: 390, height: 844 })

  const html = page.locator("html")
  await expect(html).toHaveClass(/v2-theme/)
  const lightTokens = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement)
    return {
      canvas: root.getPropertyValue("--v2-canvas").trim(),
      ink: root.getPropertyValue("--v2-ink").trim(),
      border: root.getPropertyValue("--v2-border").trim(),
      background: getComputedStyle(document.body).backgroundColor,
    }
  })
  expect(lightTokens.canvas).toBe("#fbfbfa")
  expect(lightTokens.ink).toBe("#292a2e")
  expect(lightTokens.border).toBe("#e5e5e3")

  const dock = page.getByRole("navigation", { name: "Primary", exact: true })
  const dockBox = await dock.boundingBox()
  expect(dockBox).not.toBeNull()
  expect(dockBox!.x).toBeGreaterThan(0)
  expect(dockBox!.width).toBeLessThan(390)
  expect(dockBox!.y + dockBox!.height).toBeLessThanOrEqual(844)
  await expect(dock.getByRole("button", { name: "Log transaction" })).toBeVisible()
  expect(await page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--v2-viewport-height")))).toBeCloseTo(844, 0)

  for (const viewport of [{ width: 375, height: 667 }, { width: 300, height: 596 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport)
    await expect.poll(() => page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--v2-viewport-height")))).toBeCloseTo(viewport.height, 0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const compactDock = await dock.boundingBox()
    expect(compactDock).not.toBeNull()
    expect(compactDock!.width).toBeLessThanOrEqual(viewport.width)
  }

  await page.setViewportSize({ width: 300, height: 596 })
  await page.getByRole("button", { name: "Log transaction" }).click()
  const editor = page.getByRole("dialog")
  await expect(editor).toBeVisible()
  await expect(editor).toHaveCSS("background-color", "rgb(255, 255, 255)")
  const smallDialog = await editor.boundingBox()
  expect(smallDialog).not.toBeNull()
  expect(smallDialog!.height).toBeLessThanOrEqual(596)
  await page.evaluate(() => document.documentElement.classList.add("dark"))
  await expect(html).toHaveCSS("--v2-canvas", "#16171a")
  await expect(editor).toHaveCSS("background-color", "rgb(32, 33, 37)")
  await page.keyboard.press("Escape")
  await page.evaluate(() => document.documentElement.classList.remove("dark"))

  await page.goto("/settings")
  await page.getByRole("switch", { name: "Use v2 interface" }).click()
  await expect(html).not.toHaveClass(/v2-theme/)
  expect(await html.evaluate(el => getComputedStyle(el).getPropertyValue("--v2-canvas").trim())).toBe("")
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(246, 242, 234)")
  await page.getByRole("switch", { name: "Use v2 interface" }).click()
  await expect(html).toHaveClass(/v2-theme/)
})
