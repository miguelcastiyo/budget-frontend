import { getLocalDateKey } from "../../date-filters"
import { dateOnly } from "./clock"
import { FinancialDomainError } from "./errors"
import { formatMoneyCents, parseMoneyCents } from "./money"
import type { FinancialCategory } from "./types"

export interface PendingTransaction {
  id: string
  capturedAt: string
  date: string
  amountCents: number | null
  description: string | null
  category: FinancialCategory | null
  tagId: string | null
  cardId: string | null
  contextId: string | null
  isSplit: boolean | null
  notes: string | null
}

export interface PendingTransactionInput {
  date?: string
  amount?: string | number | null
  description?: string | null
  category?: FinancialCategory | null
  tagId?: string | null
  cardId?: string | null
  contextId?: string | null
  isSplit?: boolean | null
  notes?: string | null
}

function invalid(field: string, message: string): never {
  throw new FinancialDomainError("VALIDATION_FAILED", "Request validation failed", [{ field, message }])
}
function optionalText(value: string | null | undefined): string | null { return value?.trim() || null }

export function createPendingTransaction(id: string, input: PendingTransactionInput, now = new Date()): PendingTransaction {
  if (!id || Number.isNaN(now.getTime())) invalid("id", "valid identity and capture time are required")
  const date = input.date ?? getLocalDateKey(now)
  try { dateOnly(date) } catch { invalid("date", "must be a valid date") }
  let amountCents: number | null = null
  if (input.amount != null && !(typeof input.amount === "string" && input.amount.trim() === "")) {
    try { amountCents = parseMoneyCents(input.amount) } catch { invalid("amount", "must be a valid amount") }
    if (amountCents <= 0) invalid("amount", "must be greater than 0")
  }
  const description = optionalText(input.description)
  if (amountCents === null && description === null) invalid("amount", "amount or description is required")
  if (input.category != null && !["needs", "wants", "savings"].includes(input.category)) invalid("category", "must be a valid category")
  if (input.isSplit != null && typeof input.isSplit !== "boolean") invalid("isSplit", "must be a boolean")
  return { id, capturedAt: now.toISOString(), date, amountCents, description, category: input.category ?? null, tagId: optionalText(input.tagId), cardId: optionalText(input.cardId), contextId: optionalText(input.contextId), isSplit: input.isSplit ?? null, notes: optionalText(input.notes) }
}

export function updatePendingTransaction(current: PendingTransaction, input: PendingTransactionInput): PendingTransaction {
  const next = createPendingTransaction(current.id, {
    date: input.date ?? current.date,
    amount: input.amount === undefined ? (current.amountCents === null ? null : formatMoneyCents(current.amountCents)) : input.amount,
    description: input.description === undefined ? current.description : input.description,
    category: input.category === undefined ? current.category : input.category,
    tagId: input.tagId === undefined ? current.tagId : input.tagId,
    cardId: input.cardId === undefined ? current.cardId : input.cardId,
    contextId: input.contextId === undefined ? current.contextId : input.contextId,
    isSplit: input.isSplit === undefined ? current.isSplit : input.isSplit,
    notes: input.notes === undefined ? current.notes : input.notes,
  }, new Date(current.capturedAt))
  return { ...next, capturedAt: current.capturedAt }
}
