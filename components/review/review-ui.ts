import { ApiError } from "@/lib/api/core"

export const field = "w-full rounded-xl border border-border bg-background px-3 py-3 text-base"
export const button = "rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
export const secondary = "rounded-xl border border-border px-4 py-3 text-sm font-medium disabled:opacity-50"
export function message(error: unknown): string {
  const text = error instanceof ApiError ? `${error.status} ${error.error.code} ${error.message}` : error instanceof Error ? error.message : ""
  if (text.includes("PENDING_MONTH_CLOSED")) return "This month is closed. Reopen it before finalizing."
  if (text.includes("CONFLICT") || text.includes("409")) return "This item changed on another device. Sync and review it again."
  if (text.includes("VALIDATION") || text.includes("validation")) return "Check the amount, description, category, and active tag."
  return "Could not save. Check your connection or unlock your Vault, then try again."
}
