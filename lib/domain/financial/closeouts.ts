import { formatMoneyCents } from "./money"
import { ledgerBalance, type FundLedgerEntry } from "./funds"

export interface CloseoutAllocation { id: string; closeoutId: string; fundId: string; amountCents: number; superseded: boolean }
export interface CloseoutState { id: string; month: string; status: "closed" | "reopened"; allocations: CloseoutAllocation[]; entries: FundLedgerEntry[] }
export function allocateAmounts(totalCents: number, amounts: number[]): number[] { const sum = amounts.reduce((total, amount) => total + amount, 0); if (sum !== totalCents) throw new Error("ALLOCATION_TOTAL_MISMATCH"); return [...amounts] }
export function replaceAllocations(state: CloseoutState, amounts: { fundId: string; amountCents: number }[]): CloseoutState {
  const retired = state.allocations.map((allocation) => ({ ...allocation, superseded: true }))
  const retiredEntries = state.entries.map((entry) => ({ ...entry, isVoided: true }))
  const nextAllocations = amounts.map((item, index) => ({ id: `${state.id}:allocation:${state.allocations.length + index + 1}`, closeoutId: state.id, fundId: item.fundId, amountCents: item.amountCents, superseded: false }))
  const nextEntries = nextAllocations.map((allocation, index) => ({ id: `${state.id}:entry:${state.entries.length + index + 1}`, fundId: allocation.fundId, entryType: "contribution", direction: "in" as const, amountCents: allocation.amountCents, sourceType: "month_closeout" as const, sourceTransactionId: null, sourceCloseoutId: state.id, sourceCloseoutAllocationId: allocation.id, entryDate: `${state.month}-01`, isVoided: false, isDeleted: false }))
  return { ...state, status: "closed", allocations: [...retired, ...nextAllocations], entries: [...retiredEntries, ...nextEntries] }
}
export function reopenCloseout(state: CloseoutState): CloseoutState { return { ...state, status: "reopened", entries: state.entries.map((entry) => entry.isVoided ? entry : { ...entry, isVoided: true }) } }
export function closeoutFundBalances(state: CloseoutState): Record<string, string> { return Object.fromEntries([...new Set(state.entries.map((entry) => entry.fundId))].map((fundId) => [fundId, formatMoneyCents(ledgerBalance(state.entries, fundId))])) }
