import { dateOnly, weekdayOfDate } from "./clock"
import { formatMoneyCents } from "./money"
import { filterTransactions } from "./transactions"
import type { TransactionRecord } from "./types"

export function insights(input: { transactions: TransactionRecord[]; from: string; to: string }) {
  dateOnly(input.from); dateOnly(input.to)
  const records = filterTransactions(input.transactions, { from: input.from, to: input.to, sort: "date_asc" })
  const totalCents = records.reduce((sum, item) => sum + item.amountCents, 0)
  const categories = ["needs", "wants", "savings"].map((category) => ({ category, total: formatMoneyCents(records.filter((item) => item.category === category).reduce((sum, item) => sum + item.amountCents, 0)) }))
  const weekday = records.reduce<Record<string, number>>((result, item) => { const key = String(weekdayOfDate(item.date)); result[key] = (result[key] ?? 0) + item.amountCents; return result }, {})
  const largest = [...records].sort((a, b) => b.amountCents - a.amountCents || b.date.localeCompare(a.date) || a.id.localeCompare(b.id)).slice(0, 5)
  const recurring = records.filter((item) => item.source === "recurring").reduce((sum, item) => sum + item.amountCents, 0)
  return { from: input.from, to: input.to, total: formatMoneyCents(totalCents), count: records.length, average: formatMoneyCents(records.length ? Math.round(totalCents / records.length) : 0), categories, weekday: Object.fromEntries(Object.entries(weekday).map(([key, value]) => [key, formatMoneyCents(value)])), largest, recurring: formatMoneyCents(recurring), variable: formatMoneyCents(totalCents - recurring), months: [...new Set(records.map((item) => item.date.slice(0, 7)))].sort() }
}
