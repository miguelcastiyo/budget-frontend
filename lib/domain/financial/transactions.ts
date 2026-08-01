import { dateOnly } from "./clock"
import { FinancialDomainError } from "./errors"
import { formatMoneyCents, parseMoneyCents } from "./money"
import type { FinancialCategory, TransactionRecord } from "./types"

const categories: FinancialCategory[] = ["needs", "wants", "savings"]

export interface TransactionCommand {
  id: string; userId: string; date: string; expense: string; amount: string | number; category: string
  isSplit?: boolean; notes?: string | null; source?: TransactionRecord["source"]; recurringExpenseId?: string | null
  importFingerprint?: string | null; tagId?: string | null; contextId?: string | null; cardId?: string | null; sequence?: number
}

function validate(command: TransactionCommand): { amountCents: number; category: FinancialCategory } {
  let amountCents: number
  try { amountCents = parseMoneyCents(command.amount) } catch { throw new FinancialDomainError("VALIDATION_FAILED", "Request validation failed", [{ field: "amount", message: "must be a valid amount" }]) }
  if (amountCents <= 0) throw new FinancialDomainError("VALIDATION_FAILED", "Request validation failed", [{ field: "amount", message: "must be greater than 0" }])
  if (!categories.includes(command.category as FinancialCategory)) throw new FinancialDomainError("VALIDATION_FAILED", "Request validation failed", [{ field: "category", message: "must be one of needs,wants,savings" }])
  if (!command.expense?.trim()) throw new FinancialDomainError("VALIDATION_FAILED", "Request validation failed", [{ field: "expense", message: "is required" }])
  dateOnly(command.date)
  return { amountCents, category: command.category as FinancialCategory }
}

export function createTransaction(command: TransactionCommand): TransactionRecord {
  const { amountCents, category } = validate(command)
  return { id: command.id, userId: command.userId, date: command.date, expense: command.expense.trim(), amountCents, category, isSplit: command.isSplit === true, notes: command.notes?.trim() || null, source: command.source ?? "manual", recurringExpenseId: command.recurringExpenseId ?? null, importFingerprint: command.importFingerprint ?? null, tagId: command.tagId ?? null, contextId: command.contextId ?? null, cardId: command.cardId ?? null, isDeleted: false, createdSequence: command.sequence ?? 0 }
}

export function updateTransaction(current: TransactionRecord, command: Partial<TransactionCommand>): TransactionRecord {
  if (current.isDeleted) throw new FinancialDomainError("REFERENCE_NOT_FOUND")
  return createTransaction({ id: current.id, userId: current.userId, date: command.date ?? current.date, expense: command.expense ?? current.expense, amount: command.amount ?? formatMoneyCents(current.amountCents), category: command.category ?? current.category, isSplit: command.isSplit ?? current.isSplit, notes: command.notes === undefined ? current.notes : command.notes, source: command.source ?? current.source, recurringExpenseId: command.recurringExpenseId === undefined ? current.recurringExpenseId : command.recurringExpenseId, importFingerprint: command.importFingerprint === undefined ? current.importFingerprint : command.importFingerprint, tagId: command.tagId === undefined ? current.tagId : command.tagId, contextId: command.contextId === undefined ? current.contextId : command.contextId, cardId: command.cardId === undefined ? current.cardId : command.cardId, sequence: current.createdSequence })
}

export function deleteTransaction(current: TransactionRecord): TransactionRecord { return { ...current, isDeleted: true } }

function recurringReferenceKey(value: string): string { return value.trim().split(":").pop() ?? value.trim() }
function recurringCompleteness(record: TransactionRecord): number { return [record.tagId, record.contextId, record.cardId, record.notes].filter(Boolean).length }
export function visibleTransactions(records: TransactionRecord[]): TransactionRecord[] {
  const visible = records.filter((record) => !record.isDeleted)
  const recurring = new Map<string, TransactionRecord>()
  const result: TransactionRecord[] = []
  for (const record of visible) {
    if (record.source !== "recurring" || !record.recurringExpenseId) { result.push(record); continue }
    const key = `${recurringReferenceKey(record.recurringExpenseId)}:${record.date}`
    const prior = recurring.get(key)
    if (!prior) { recurring.set(key, record); result.push(record); continue }
    if (recurringCompleteness(record) > recurringCompleteness(prior)) {
      const index = result.indexOf(prior)
      if (index >= 0) result[index] = record
      recurring.set(key, record)
    }
  }
  return result
}

export interface TransactionFilter { from?: string; to?: string; search?: string; category?: FinancialCategory; categories?: FinancialCategory[]; tagId?: string; tagIds?: string[]; contextId?: string; contextIds?: string[]; cardId?: string; cardIds?: string[]; isSplit?: boolean; page?: number; pageSize?: number; sort?: "date_asc" | "date_desc" }

function sameReference(left: string | null, right: string): boolean {
  if (left == null) return false
  if (left === right) return true
  const leftTail = left.split(":").pop()
  const rightTail = right.split(":").pop()
  return leftTail === rightTail || (Number.isFinite(Number(left)) && Number.isFinite(Number(right)) && Number(left) === Number(right))
}

export function filterTransactions(records: TransactionRecord[], filter: TransactionFilter): TransactionRecord[] {
  const search = filter.search?.trim().toLowerCase()
  const direction = filter.sort === "date_asc" ? 1 : -1
  const categories = filter.categories ?? (filter.category ? [filter.category] : undefined)
  return visibleTransactions(records).filter((record) => (!filter.from || record.date >= filter.from) && (!filter.to || record.date <= filter.to) && (!search || record.expense.toLowerCase().includes(search) || record.notes?.toLowerCase().includes(search)) && (!categories || categories.includes(record.category)) && (!filter.tagId || sameReference(record.tagId, filter.tagId)) && (!filter.tagIds || filter.tagIds.length === 0 || filter.tagIds.some((id) => sameReference(record.tagId, id))) && (!filter.contextId || sameReference(record.contextId, filter.contextId)) && (!filter.contextIds || filter.contextIds.length === 0 || filter.contextIds.some((id) => sameReference(record.contextId, id))) && (!filter.cardId || sameReference(record.cardId, filter.cardId)) && (!filter.cardIds || filter.cardIds.length === 0 || filter.cardIds.some((id) => sameReference(record.cardId, id))) && (filter.isSplit === undefined || record.isSplit === filter.isSplit)).sort((a, b) => direction * a.date.localeCompare(b.date) || direction * (a.createdSequence - b.createdSequence) || a.id.localeCompare(b.id))
}

export function paginateTransactions(records: TransactionRecord[], filter: TransactionFilter): { items: TransactionRecord[]; page: number; pageSize: number; totalItems: number } {
  const page = Math.max(1, filter.page ?? 1); const pageSize = Math.max(1, filter.pageSize ?? 25); const filtered = filterTransactions(records, filter)
  return { items: filtered.slice((page - 1) * pageSize, page * pageSize), page, pageSize, totalItems: filtered.length }
}

export function transactionSummary(records: TransactionRecord[], filter: TransactionFilter) {
  const filtered = filterTransactions(records, filter); const total = filtered.reduce((sum, record) => sum + record.amountCents, 0)
  return { totalSpent: formatMoneyCents(total), count: filtered.length, avgTransaction: formatMoneyCents(filtered.length ? Math.round(total / filtered.length) : 0), splitCount: filtered.filter((record) => record.isSplit).length }
}

export function rankExpenseSuggestions(records: TransactionRecord[], query: string): string[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("en-US")
  const aggregates = new Map<string, { label: string; frequency: number; newest: string; rank: number }>()
  for (const record of visibleTransactions(records)) {
    const label = record.expense.trim(); const normalized = label.toLocaleLowerCase("en-US")
    const rank = normalized === normalizedQuery ? 0 : normalized.startsWith(normalizedQuery) ? 1 : normalized.includes(normalizedQuery) ? 2 : 99
    if (rank === 99) continue
    const current = aggregates.get(normalized)
    if (!current) aggregates.set(normalized, { label, frequency: 1, newest: record.date, rank })
    else { current.frequency += 1; current.newest = current.newest < record.date ? record.date : current.newest; current.rank = Math.min(current.rank, rank) }
  }
  return [...aggregates.values()].sort((a, b) => a.rank - b.rank || b.frequency - a.frequency || b.newest.localeCompare(a.newest) || a.label.localeCompare(b.label, "en-US")).map((item) => item.label)
}

export function duplicateFingerprint(input: { date: string; amount: string | number; expense: string; category: string; isSplit: boolean; tagId: string | null; cardId: string | null }): string {
  const normalizedExpense = input.expense.trim().replace(/\s+/g, " ").toLowerCase()
  return [input.date, formatMoneyCents(parseMoneyCents(input.amount)), normalizedExpense, input.category, input.isSplit ? "1" : "0", input.tagId ?? "", input.cardId ?? ""].join("|")
}
