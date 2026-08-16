import type { SourceMutationDiff } from "./transaction-fund-diff"
import type { DecryptedFinancialRecord } from "../../privacy/encrypted-authority/record-store"
import { planCsvImport, type CsvRow } from "./csv"
import { duplicateFingerprint } from "./transactions"
import { formatMoneyCents } from "./money"

export type ImportLineageRepairStatus = "not_needed" | "repairable_automatically" | "source_file_required" | "ambiguous" | "repaired"
export type ImportLineageEvidence = "stable_marker" | "legacy_run_marker" | "legacy_row_id" | "source_file" | "none"

export interface ImportLineageRepairAnalysis {
  importRunId: string
  status: ImportLineageRepairStatus
  evidenceMethod: ImportLineageEvidence
  expectedImportedRows: number
  alreadyMarkedTransactionCount: number
  exactCandidateCount: number
  missingCount: number
  ambiguousCount: number
  deletedCandidateCount: number
  rolledBack: boolean
  canCommit: boolean
  transactionRecordIds: string[]
  runRecordId: string | null
  revisionSnapshot: Record<string, number>
}

export interface ImportLineageRepairAuthority {
  store: { values(): DecryptedFinancialRecord[] }
  commitSourceDiff(diff: SourceMutationDiff, idempotencyKey?: string, options?: { expectedRevisionOverrides?: Record<string, number> }): Promise<unknown>
}

function stringValue(value: unknown): string { return value == null ? "" : String(value) }
function numberValue(value: unknown): number { const result = Number(value); return Number.isFinite(result) ? result : 0 }
function sameId(left: string, right: string): boolean {
  if (left === right) return true
  return Number.isFinite(Number(left)) && Number.isFinite(Number(right)) && Number(left) === Number(right)
}
function runMatches(record: DecryptedFinancialRecord, importRunId: string): boolean {
  return record.family === "import_run" && [record.sourceId, record.envelope.record_id, stringValue(record.data.id)].some((value) => sameId(value, importRunId))
}
function stableMarker(record: DecryptedFinancialRecord): string {
  return stringValue(record.data.import_run_id ?? record.data.importRunId)
}
function legacyMarker(record: DecryptedFinancialRecord): string {
  return stringValue(record.data.csv_import_run_id ?? record.data.import_batch_id ?? record.data.batch_id ?? record.data.batchId)
}
function exactLegacyRowMatch(record: DecryptedFinancialRecord, importRunId: string): boolean {
  return record.sourceId.startsWith(`${importRunId}:`) || stringValue(record.data.id).startsWith(`${importRunId}:`)
}
function isTransaction(record: DecryptedFinancialRecord): boolean { return record.family === "transaction" }

export function analyzeImportLineage(authority: ImportLineageRepairAuthority, importRunId: string): ImportLineageRepairAnalysis {
  const records = authority.store.values()
  const run = records.find((record) => runMatches(record, importRunId))
  const expectedImportedRows = numberValue(run?.data.imported_rows)
  const transactions = records.filter(isTransaction)
  const stable = transactions.filter((record) => stableMarker(record) === importRunId)
  const legacy = transactions.filter((record) => legacyMarker(record) === importRunId || exactLegacyRowMatch(record, importRunId))
  const conflicting = transactions.filter((record) => {
    const marker = stableMarker(record)
    return marker !== "" && marker !== importRunId && (legacyMarker(record) === importRunId || exactLegacyRowMatch(record, importRunId))
  })
  const candidates = [...new Map([...stable, ...legacy].map((record) => [record.envelope.record_id, record])).values()]
  const alreadyMarkedTransactionCount = stable.length
  const deletedCandidateCount = candidates.filter((record) => record.data.is_deleted === true || record.data.deleted_at != null).length
  const missingCount = Math.max(expectedImportedRows - candidates.length, 0)
  const ambiguousCount = conflicting.length + (candidates.length > expectedImportedRows && expectedImportedRows > 0 ? candidates.length - expectedImportedRows : 0)
  const rolledBack = stringValue(run?.data.status) === "rolled_back" || stringValue(run?.data.rolled_back_at) !== ""
  const complete = expectedImportedRows > 0 && candidates.length === expectedImportedRows && ambiguousCount === 0
  const hasStableOnly = complete && stable.length === expectedImportedRows
  const evidenceMethod: ImportLineageEvidence = hasStableOnly ? "stable_marker" : legacy.some((record) => legacyMarker(record) === importRunId) ? "legacy_run_marker" : legacy.length > 0 ? "legacy_row_id" : "none"
  const status: ImportLineageRepairStatus = hasStableOnly ? "not_needed" : ambiguousCount > 0 ? "ambiguous" : complete ? "repairable_automatically" : "source_file_required"
  const revisionSnapshot: Record<string, number> = {}
  for (const record of [...candidates, ...(run ? [run] : [])]) revisionSnapshot[record.envelope.record_id] = record.envelope.record_revision
  return { importRunId, status, evidenceMethod, expectedImportedRows, alreadyMarkedTransactionCount, exactCandidateCount: candidates.length, missingCount, ambiguousCount, deletedCandidateCount, rolledBack, canCommit: status === "repairable_automatically" && Boolean(run), transactionRecordIds: candidates.map((record) => record.envelope.record_id), runRecordId: run?.envelope.record_id ?? null, revisionSnapshot }
}

export function previewImportLineageRepair(authority: ImportLineageRepairAuthority, importRunId: string): ImportLineageRepairAnalysis {
  return analyzeImportLineage(authority, importRunId)
}

export function previewImportLineageRepairFromCsv(
  authority: ImportLineageRepairAuthority,
  importRunId: string,
  rows: CsvRow[],
  options: { year: number; tags?: Array<{ id: string; name: string }>; cards?: Array<{ id: string; name: string }>; contexts?: Array<{ id: string; name: string }>; tagValueMap?: Record<string, { mode?: "existing" | "new"; tag_id?: string; name?: string }> }
): ImportLineageRepairAnalysis {
  const base = analyzeImportLineage(authority, importRunId)
  if (base.status === "not_needed" || base.status === "repairable_automatically") return base
  const plan = planCsvImport(rows, [], { year: options.year, userId: "authority-user", batchId: importRunId, tags: options.tags, cards: options.cards, contexts: options.contexts, tagValueMap: options.tagValueMap })
  const transactions = authority.store.values().filter(isTransaction)
  const selected = new Map<string, DecryptedFinancialRecord>()
  let ambiguousCount = 0
  for (const candidate of plan.accepted) {
    const fingerprint = candidate.importFingerprint ?? duplicateFingerprint({ date: candidate.date, amount: formatMoneyCents(candidate.amountCents), expense: candidate.expense, category: candidate.category, isSplit: candidate.isSplit, tagId: candidate.tagId, cardId: candidate.cardId })
    const matches = transactions.filter((record) => {
      if (stableMarker(record) !== "" && stableMarker(record) !== importRunId) return false
      const exactRow = record.sourceId === candidate.id || stringValue(record.data.id) === candidate.id
      const recordFingerprint = stringValue(record.data.import_fingerprint ?? record.data.importFingerprint)
      const valueFingerprint = duplicateFingerprint({ date: stringValue(record.data.date ?? record.data.transaction_date), amount: formatMoneyCents(Number(record.data.amount_cents ?? record.data.amount ?? 0)), expense: stringValue(record.data.expense), category: stringValue(record.data.category) as "needs" | "wants" | "savings", isSplit: record.data.is_split === true, tagId: stringValue(record.data.tag_id) || null, cardId: stringValue(record.data.card_id) || null })
      return exactRow || recordFingerprint === fingerprint || valueFingerprint === fingerprint
    })
    if (matches.length !== 1) { ambiguousCount += matches.length > 1 ? 1 : 0; continue }
    selected.set(matches[0].envelope.record_id, matches[0])
  }
  const expected = base.expectedImportedRows
  const missingCount = Math.max(expected - selected.size, 0)
  const complete = expected > 0 && selected.size === expected && plan.accepted.length === expected && ambiguousCount === 0 && plan.errors.length === 0
  const revisionSnapshot: Record<string, number> = {}
  for (const record of selected.values()) revisionSnapshot[record.envelope.record_id] = record.envelope.record_revision
  const run = authority.store.values().find((record) => runMatches(record, importRunId))
  if (run) revisionSnapshot[run.envelope.record_id] = run.envelope.record_revision
  return { ...base, status: complete ? "repairable_automatically" : ambiguousCount > 0 ? "ambiguous" : "source_file_required", evidenceMethod: "source_file", exactCandidateCount: selected.size, missingCount, ambiguousCount, canCommit: complete && Boolean(run), transactionRecordIds: [...selected.keys()], runRecordId: run?.envelope.record_id ?? null, revisionSnapshot }
}

export async function applyImportLineageRepair(authority: ImportLineageRepairAuthority, preview: ImportLineageRepairAnalysis): Promise<{ status: "repaired" | "not_needed"; repairedTransactionCount: number }> {
  if (preview.status === "not_needed") return { status: "not_needed", repairedTransactionCount: 0 }
  if (!preview.canCommit || !preview.runRecordId) throw new Error("IMPORT_LINEAGE_REPAIR_NOT_SAFE")
  const current = analyzeImportLineage(authority, preview.importRunId)
  if (JSON.stringify(current.revisionSnapshot) !== JSON.stringify(preview.revisionSnapshot)) throw new Error("IMPORT_LINEAGE_REPAIR_STALE_PREVIEW")
  const updates: SourceMutationDiff["updates"] = authority.store.values().filter((record) => preview.transactionRecordIds.includes(record.envelope.record_id)).map((record) => ({ id: record.envelope.record_id, family: "transaction", data: { ...record.data, import_run_id: preview.importRunId } }))
  const run = authority.store.values().find((record) => record.envelope.record_id === preview.runRecordId)
  if (!run) throw new Error("IMPORT_LINEAGE_REPAIR_RUN_NOT_FOUND")
  updates.push({ id: run.envelope.record_id, family: "import_run", data: { ...run.data, lineage_repaired: true, lineage_repair_evidence: preview.evidenceMethod } })
  await authority.commitSourceDiff({ creates: [], updates, tombstones: [] }, `import-lineage-repair:${preview.importRunId}`, { expectedRevisionOverrides: preview.revisionSnapshot })
  return { status: "repaired", repairedTransactionCount: preview.transactionRecordIds.length }
}
