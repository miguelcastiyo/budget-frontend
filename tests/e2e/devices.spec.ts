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

async function mockDeviceApi(page: Page) {
  let removalAttempts = 0
  let reauthenticationAttempts = 0

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname

    if (path === "/api/v1/me" && request.method() === "GET") {
      await route.fulfill({
        json: {
          id: "user-1",
          email: "test@example.com",
          display_name: "Test User",
          avatar_url: null,
          role: "member",
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

    if (path === "/api/v1/me/privacy" && request.method() === "GET") {
      await route.fulfill({ json: { financial_privacy_state: "encrypted" } })
      return
    }

    if (path === "/api/v1/me/vault/quick-unlock" && request.method() === "GET") {
      await route.fulfill({ json: { status: "not_enrolled", quick_unlock_id: null, profile_version: 1 } })
      return
    }

    if (path === "/api/v1/me/devices" && request.method() === "GET") {
      await route.fulfill({
        json: {
          items: [{
            id: "dev-old",
            device_id: "dev-old",
            client_type: "web",
            label: "Old iPhone",
            created_at: "2026-01-01T00:00:00Z",
            last_seen_at: "2026-01-01T00:00:00Z",
            expires_at: "2026-01-08T00:00:00Z",
            revoked_at: null,
            is_current: false,
            status: "active",
            quick_unlock: { status: "not_enabled" },
          }],
        },
      })
      return
    }

    if (path === "/api/v1/me/devices/dev-old" && request.method() === "DELETE") {
      removalAttempts += 1
      if (removalAttempts === 1) {
        await route.fulfill({ status: 403, json: { error: { code: "RECENT_AUTH_REQUIRED", message: "Recent interactive authentication is required", details: [] } } })
      } else {
        await route.fulfill({ json: { status: "removed", device_id: "dev-old", current_device: false } })
      }
      return
    }

    if (path === "/api/v1/auth/sessions/reauth" && request.method() === "POST") {
      reauthenticationAttempts += 1
      await route.fulfill({
        json: {
          user: {
            id: "user-1",
            email: "test@example.com",
            display_name: "Test User",
            avatar_url: null,
            role: "member",
            onboarding_complete: true,
            user_preferences: { appearance: { theme: "light" }, onboarding: { dismissed: true } },
          },
          session: { session_id: "session-2", expires_at: "2026-01-08T00:00:00Z", csrf_token: "csrf-2" },
        },
      })
      return
    }

    await route.continue()
  })

  return {
    get removalAttempts() { return removalAttempts },
    get reauthenticationAttempts() { return reauthenticationAttempts },
  }
}

test("device removal reauthenticates without signing out", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("budget.csrf_token", "csrf-1"))
  const calls = await mockDeviceApi(page)

  await page.goto("/settings/vault/devices")
  await expect(page.getByText("Old iPhone")).toBeVisible()
  await page.getByRole("button", { name: "Remove" }).click()
  await page.getByRole("button", { name: "Remove device" }).click()

  await expect(page.getByText("Confirm before removing")).toBeVisible()
  await page.getByLabel("Account password").fill("correct-password")
  await page.getByRole("button", { name: "Continue" }).click()

  await expect(page.getByText("No active devices found.")).toBeVisible()
  expect(calls.removalAttempts).toBe(2)
  expect(calls.reauthenticationAttempts).toBe(1)
})
