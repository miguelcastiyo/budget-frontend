import { dateOnly } from "./clock"
import { duplicateFingerprint, createTransaction } from "./transactions"
import { formatMoneyCents, parseMoneyCents } from "./money"
import type { TransactionRecord } from "./types"

export interface CsvRow { row: number; date: string; expense: string; amount: string; externalCategory?: string; tag?: string; context?: string; card?: string; isSplit?: boolean; notes?: string }
export interface CsvImportPlan { accepted: TransactionRecord[]; errors: { row: number; field: string; message: string }[]; skippedBlankAmountRows: number; duplicates: CsvRow[]; newTags: string[] }

export function normalizeCsvDate(value: string, year: number): string {
  const trimmed = value.trim(); const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : /^\d{1,2}\/\d{1,2}$/.test(trimmed) ? `${year}-${trimmed.split("/").map((part) => part.padStart(2, "0")).join("-")}` : ""
  return dateOnly(normalized)
}
export function mapCategory(value: string | undefined): "needs" | "wants" | "savings" { const normalized = value?.trim().toLowerCase(); if (normalized === "debit" || normalized === "needs") return "needs"; if (normalized === "wants") return "wants"; if (normalized === "savings") return "savings"; throw new Error("INVALID_CATEGORY") }
export function planCsvImport(rows: CsvRow[], existing: TransactionRecord[], options: { year: number; userId: string; batchId: string }): CsvImportPlan {
  const accepted: TransactionRecord[] = []; const errors: CsvImportPlan["errors"] = []; const duplicates: CsvRow[] = []; const newTags: string[] = []
  for (const row of rows) {
    if (!row.amount.trim()) continue
    let date: string; let amountCents: number; let category: "needs" | "wants" | "savings"
    try { date = normalizeCsvDate(row.date, options.year) } catch { errors.push({ row: row.row, field: "date", message: "must be a valid date" }); continue }
    try { amountCents = parseMoneyCents(row.amount) } catch { errors.push({ row: row.row, field: "amount", message: "must be a decimal number" }); continue }
    try { category = mapCategory(row.externalCategory) } catch { errors.push({ row: row.row, field: "category", message: "must be a supported category" }); continue }
    if (amountCents <= 0) { errors.push({ row: row.row, field: "amount", message: "must be greater than 0" }); continue }
    const candidate = createTransaction({ id: `${options.batchId}:${row.row}`, userId: options.userId, date, expense: row.expense, amount: formatMoneyCents(amountCents), category, isSplit: row.isSplit, notes: row.notes, source: "import", importFingerprint: null, sequence: row.row })
    const fingerprint = duplicateFingerprint({ date, amount: formatMoneyCents(amountCents), expense: row.expense, category, isSplit: candidate.isSplit, tagId: null, cardId: null })
    if (existing.concat(accepted).some((item) => item.importFingerprint === fingerprint || duplicateFingerprint({ date: item.date, amount: formatMoneyCents(item.amountCents), expense: item.expense, category: item.category, isSplit: item.isSplit, tagId: item.tagId, cardId: item.cardId }) === fingerprint)) { duplicates.push(row); continue }
    accepted.push({ ...candidate, importFingerprint: fingerprint }); if (row.tag && !newTags.includes(row.tag)) newTags.push(row.tag)
  }
  return { accepted, errors, skippedBlankAmountRows: rows.filter((row) => !row.amount.trim()).length, duplicates, newTags }
}
export function rollbackImport(records: TransactionRecord[], batchPrefix: string): TransactionRecord[] { return records.map((record) => record.id.startsWith(`${batchPrefix}:`) ? { ...record, isDeleted: true } : record) }
export function escapeCsvField(value: string | null | undefined): string { const text = value ?? ""; return /^[=+\-@]/.test(text) ? `'${text}` : /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text }
export function exportTransactions(records: TransactionRecord[], options: { tagName?: (id: string | null) => string | null; createdAt: string; updatedAt: string }): string {
  const header = "date,expense,amount,category,is_split,tag,card,created_at,updated_at,notes"
  const quote = (value: string) => `"${value.replace(/"/g, '""')}"`
  const exportExpense = (value: string) => /^[=+\-@]/.test(value) ? `'${value}` : quote(value)
  const rows = [...records].filter((record) => !record.isDeleted).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)).map((record) => [record.date, exportExpense(record.expense), formatMoneyCents(record.amountCents), record.category, String(record.isSplit), escapeCsvField(options.tagName?.(record.tagId) ?? null), escapeCsvField(null), quote(options.createdAt), quote(options.updatedAt), escapeCsvField(record.notes)].join(","))
  return `${header}\n${rows.join("\n")}\n`
}
