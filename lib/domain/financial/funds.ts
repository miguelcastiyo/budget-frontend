import { formatMoneyCents } from "./money"

export type FundStatus = "active" | "archived"
export type FundEntrySource = "manual" | "starting_balance" | "transaction" | "month_closeout" | "correction"
export interface Fund { id: string; name: string; fundType: string; goalAmountCents: number | null; status: FundStatus; sortOrder: number }
export interface FundLedgerEntry { id: string; fundId: string; entryType: string; direction: "in" | "out"; amountCents: number; sourceType: FundEntrySource; sourceTransactionId: string | null; sourceCloseoutId: string | null; sourceCloseoutAllocationId?: string | null; entryDate: string; isVoided: boolean; isDeleted: boolean }

export function activeLedgerEntries(entries: FundLedgerEntry[], fundId: string): FundLedgerEntry[] { return entries.filter((entry) => entry.fundId === fundId && !entry.isVoided && !entry.isDeleted) }
export function ledgerBalance(entries: FundLedgerEntry[], fundId: string): number { return activeLedgerEntries(entries, fundId).reduce((total, entry) => total + (entry.direction === "in" ? entry.amountCents : -entry.amountCents), 0) }
export function sourceBreakdown(entries: FundLedgerEntry[], fundId: string): Record<FundEntrySource, string> {
  const result: Record<FundEntrySource, number> = { month_closeout: 0, transaction: 0, manual: 0, starting_balance: 0, correction: 0 }
  for (const entry of activeLedgerEntries(entries, fundId)) result[entry.sourceType] += entry.direction === "in" ? entry.amountCents : -entry.amountCents
  return Object.fromEntries(Object.entries(result).map(([key, value]) => [key, formatMoneyCents(value)])) as Record<FundEntrySource, string>
}
export function goalState(fund: Fund, entries: FundLedgerEntry[]) { const balance = ledgerBalance(entries, fund.id); const goal = fund.goalAmountCents; return { balance, balanceText: formatMoneyCents(balance), remaining: goal === null ? null : formatMoneyCents(Math.max(0, goal - balance)), percentFunded: goal === null || goal === 0 ? null : formatMoneyCents(Math.round((balance * 10000) / goal)), isGoalMet: goal !== null && balance >= goal, status: fund.status } }
export function archiveFund(fund: Fund): Fund { return { ...fund, status: "archived" } }
export function restoreFund(fund: Fund): Fund { return { ...fund, status: "active" } }
export function canReceiveEntry(fund: Fund): boolean { return fund.status === "active" }
export function orderedFunds(funds: Fund[]): Fund[] { return [...funds].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "en-US") || a.id.localeCompare(b.id)) }
