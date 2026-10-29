import { monthKey } from "@/lib/domain/financial/clock"
import type { PendingTransaction } from "@/lib/domain/financial/pending-transactions"
import type { RehydratedFinancialState } from "./rehydrate"

export interface PendingMonthSummary { month: string; count: number; knownAmountCents: number; unknownAmountCount: number }
export interface PendingCloseoutConflict { month: string; pendingCount: number }

/** Legacy closeouts may omit status; an extant closeout is closed unless reopened. */
export function isClosedCloseout(record: Record<string, unknown>): boolean {
  const truthy = (value: unknown) => value === true || value === 1 || value === "1"
  return !truthy(record.is_deleted) && record.deleted_at == null && !truthy(record.is_reopened) && record.status !== "reopened"
}

export function pendingMonthSummary(pending: PendingTransaction[], month: string): PendingMonthSummary {
  monthKey(month)
  const result: PendingMonthSummary = { month, count: 0, knownAmountCents: 0, unknownAmountCount: 0 }
  for (const item of pending) {
    if (item.date.slice(0, 7) !== month) continue
    result.count++
    if (item.amountCents === null) result.unknownAmountCount++
    else {
      result.knownAmountCents += item.amountCents
      if (!Number.isSafeInteger(result.knownAmountCents)) throw new Error("PENDING_TOTAL_OUT_OF_RANGE")
    }
  }
  return result
}

export function pendingCloseoutConflicts(state: RehydratedFinancialState): PendingCloseoutConflict[] {
  const counts = new Map<string, number>()
  for (const item of state.pendingTransactions) { const month = item.date.slice(0, 7); counts.set(month, (counts.get(month) ?? 0) + 1) }
  const closedMonths = new Set(state.closeouts.filter(isClosedCloseout).map((item) => String(item.month ?? "").slice(0, 7)))
  return [...counts].filter(([month]) => closedMonths.has(month)).sort(([a], [b]) => a.localeCompare(b)).map(([month, pendingCount]) => ({ month, pendingCount }))
}
