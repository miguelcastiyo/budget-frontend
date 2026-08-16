import { FinancialDomainError } from "./errors"
import { monthKey } from "./clock"
import { parseMoneyCents } from "./money"
import { recurringRuleFromRaw, type RecurringRule } from "./recurring"
import { recurringVersionOverlaps } from "./recurring-timeline"
import type { RehydratedFinancialState } from "@/lib/privacy/encrypted-authority/rehydrate"

const fail = (field: string, message: string): never => { throw new FinancialDomainError("VALIDATION_FAILED", message, [{ field, message }]) }

export function validateRecurringRule(rule: RecurringRule, state?: RehydratedFinancialState): void {
  if (!rule.expense.trim()) fail("expense", "Expense is required")
  if (!Number.isSafeInteger(rule.amountCents) || rule.amountCents <= 0) fail("amount", "Amount must be greater than zero")
  if (!["needs", "wants", "savings"].includes(rule.category)) fail("category", "Category is invalid")
  monthKey(rule.startsMonth)
  if (rule.endsMonth !== null) {
    monthKey(rule.endsMonth)
    if (rule.endsMonth < rule.startsMonth) fail("ends_month", "End month must be on or after start month")
  }
  if (rule.billingType === "day_of_month" && (!Number.isInteger(rule.billingDay) || (rule.billingDay as number) < 1 || (rule.billingDay as number) > 31)) fail("billing_day", "Billing day must be between 1 and 31")
  if (rule.billingType !== "day_of_month" && rule.billingType !== "last_day") fail("billing_type", "Billing type is invalid")
  if (state) {
    const sameId = (left: string, right: string) => left === right || (Number.isFinite(Number(left)) && Number.isFinite(Number(right)) && Number(left) === Number(right))
    if (!rule.tagId || !state.tags.some((tag) => sameId(tag.id, rule.tagId as string) && !tag.isDeleted)) fail("tag_id", "An active tag is required")
    if (rule.cardId && !state.cards.some((card) => sameId(card.id, rule.cardId as string) && !card.isDeleted)) fail("card_id", "Card is unavailable")
    const overlaps = recurringVersionOverlaps(state.recurringRules.map((raw) => recurringRuleFromRaw(raw, rule.startsMonth)).filter((item) => item.id !== rule.id).concat(rule))
    if (overlaps.some((item) => item.seriesId === rule.seriesId)) throw new FinancialDomainError("RECURRING_VERSION_CONFLICT", "Recurring versions overlap")
  }
}

export function recurringRuleInputToData(input: Record<string, unknown>, fallbackMonth: string, current?: Record<string, unknown>): Record<string, unknown> {
  const amount = input.amount == null ? current?.amount_cents ?? current?.amount ?? "0" : input.amount
  const data = { ...(current ?? {}), ...input, amount_cents: parseMoneyCents(String(amount)), starts_month: input.starts_month ?? current?.starts_month ?? fallbackMonth, ends_month: input.ends_month ?? current?.ends_month ?? null, is_active: input.is_active ?? current?.is_active ?? true, is_deleted: false }
  const rule = recurringRuleFromRaw(data, fallbackMonth)
  validateRecurringRule(rule)
  return data
}
