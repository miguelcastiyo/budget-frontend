import { expect, test, type Page } from "@playwright/test"

const setupStatus = {
  budget_profile_complete: true,
  has_transactions: false,
  has_recurring_expenses: false,
  has_imported_data: false,
  first_transaction_added: false,
  first_recurring_expense_added: false,
  first_import_completed: false,
  onboarding_dismissed: true,
  recommended_next_action: "none",
  setup_tasks: [],
}

async function mockTransactionsApi(page: Page, transactionTotal = 0) {
  const transactionRequests: string[] = []

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname

    if (path === "/api/v1/me" && request.method() === "GET") {
      await route.fulfill({
        json: {
          id: "user-1",
          email: "test@example.com",
          display_name: "Test User",
          avatar_url: null,
          auth_provider: "password",
          role: "user",
          onboarding_complete: true,
          user_preferences: { appearance: { theme: "light" }, onboarding: { dismissed: true } },
          email_verified: true,
          created_at: "2026-01-01T00:00:00Z",
        },
      })
      return
    }

    if (path === "/api/v1/me/setup-status" && request.method() === "GET") {
      await route.fulfill({ json: setupStatus })
      return
    }

    if (path === "/api/v1/me/tags") {
      await route.fulfill({ json: { items: [] } })
      return
    }

    if (path === "/api/v1/me/tags/quick-picks") {
      await route.fulfill({ json: { items: [] } })
      return
    }

    if (path === "/api/v1/me/cards" || path === "/api/v1/me/contexts") {
      await route.fulfill({ json: { items: [] } })
      return
    }

    if (path === "/api/v1/me/transactions" && request.method() === "GET") {
      transactionRequests.push(url.search)
      await route.fulfill({
        json: {
          items: [],
          page: Number(url.searchParams.get("page") ?? "1"),
          page_size: Number(url.searchParams.get("page_size") ?? "50"),
          total_items: transactionTotal,
          total_pages: transactionTotal > 0 ? 1 : 0,
          summary: { total_spent: "0.00", count: transactionTotal, avg_transaction: "0.00", split_count: 0 },
        },
      })
      return
    }

    await route.continue()
  })

  return transactionRequests
}

test.describe("transactions", () => {
  test("shows the account-empty state without a duplicate existence request", async ({ page }) => {
    const transactionRequests = await mockTransactionsApi(page)

    await page.goto("/transactions")

    await expect(page.getByText("No transactions yet")).toBeVisible()
    expect(transactionRequests).toHaveLength(1)
  })

  test("keeps the filtered empty state when a filter is present", async ({ page }) => {
    const transactionRequests = await mockTransactionsApi(page)

    await page.goto("/transactions?category=savings")

    await expect(page.getByText("No matching transactions")).toBeVisible()
    await expect(page.getByText("No transactions yet")).not.toBeVisible()
    expect(transactionRequests).toHaveLength(1)
    expect(transactionRequests[0]).toContain("categories=savings")
  })
})
