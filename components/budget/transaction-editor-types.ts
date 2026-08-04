import type { Category, RecurringBillingType, Transaction } from "@/lib/api/types"

export interface AddTransactionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTransactionCreated?: () => void
  onTransactionUpdated?: (transaction: Transaction) => void
  mode?: "create" | "edit"
  transaction?: Transaction | null
}

export type RecurringEditScope = "transaction" | "future"

export const CATEGORY_CONFIG = {
  needs: { label: "Needs", selectedClassName: "bg-needs/15" },
  wants: { label: "Wants", selectedClassName: "bg-wants/15" },
  savings: { label: "Savings", selectedClassName: "bg-savings/15" },
} as const satisfies Record<Category, { label: string; selectedClassName: string }>

export function normalizeAmount(value: string): string | null {
  const parsed = Number.parseFloat(value.trim())
  return Number.isFinite(parsed) && parsed >= 0 ? parsed.toFixed(2) : null
}

export function hasRecurringSchedule(
  enabled: boolean,
  billingType: RecurringBillingType,
  billingDay: string,
): boolean {
  if (!enabled || billingType === "last_day") return true
  const day = Number.parseInt(billingDay || "0", 10)
  return Number.isInteger(day) && day >= 1 && day <= 31
}

export function submitLabel({
  isEditMode,
  isSubmitting,
  recurringEditScope,
  normalizedAmount,
  tagId,
}: {
  isEditMode: boolean
  isSubmitting: boolean
  recurringEditScope: RecurringEditScope
  normalizedAmount: string | null
  tagId: string
}): string {
  if (isSubmitting) return recurringEditScope === "future" ? "Applying..." : isEditMode ? "Saving..." : "Adding..."
  if (!isEditMode && !normalizedAmount) return "Enter amount"
  if (!isEditMode && !tagId) return "Choose tag"
  return isEditMode
    ? recurringEditScope === "future" ? "Save and apply to future" : "Save Changes"
    : "Add Transaction"
}
