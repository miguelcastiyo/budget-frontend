import type { DataRunItem, Tag } from "@/lib/api/types"
import { exportTransactions, planCsvImport, type CsvImportPlan, type CsvRow } from "@/lib/domain/financial/csv"
import { analyzeImportLineage, applyImportLineageRepair } from "@/lib/domain/financial/import-lineage-repair"
import type { SourceMutationDiff } from "@/lib/domain/financial/transaction-fund-diff"
import { createEncryptedRecordId } from "../encrypted-records/crypto"
import type { EncryptedFinancialAuthority } from "./authority"

export interface EncryptedCsvImportOptions {
  year: number
  tagValueMap: Record<string, { mode?: "existing" | "new"; tag_id?: string; name?: string }>
}

export function getEncryptedImportTags(authority: EncryptedFinancialAuthority): Tag[] {
  return authority.getState().tags.map((item) => ({ id: item.id, name: item.name, icon_key: item.iconKey }))
}

export function planEncryptedCsvImport(authority: EncryptedFinancialAuthority, rows: CsvRow[], options: EncryptedCsvImportOptions): CsvImportPlan {
  const state = authority.getState()
  return planCsvImport(rows, state.transactions, {
    year: options.year,
    userId: "authority-user",
    batchId: `csv_${createEncryptedRecordId()}`,
    tags: state.tags.filter((item) => !item.isDeleted).map((item) => ({ id: item.id, name: item.name })),
    cards: state.cards.filter((item) => !item.isDeleted).map((item) => ({ id: item.id, name: item.name })),
    contexts: state.contexts.filter((item) => !item.isDeleted).map((item) => ({ id: item.id, name: item.name })),
    tagValueMap: options.tagValueMap,
  })
}

export async function commitEncryptedCsvImport(authority: EncryptedFinancialAuthority, plan: CsvImportPlan, sourceFilename: string): Promise<{ batchId: string }> {
  const batchId = plan.accepted[0]?.id.split(":").slice(0, -1).join(":") ?? `csv_${createEncryptedRecordId()}`
  const taxonomyCreates: SourceMutationDiff["creates"] = plan.taxonomyCreates.map((item) => ({
    id: item.id,
    family: item.family,
    data: {
      id: item.id,
      name: item.name,
      ...(item.family === "taxonomy_tag" ? { icon_key: null } : item.family === "taxonomy_card" ? { is_favorite: false } : { icon_key: null }),
      is_deleted: false,
    },
  }))
  const creates: SourceMutationDiff["creates"] = [
    ...taxonomyCreates,
    ...plan.accepted.map((record) => ({
      id: record.id,
      family: "transaction",
      data: {
        ...record,
        amount_cents: record.amountCents,
        is_split: record.isSplit,
        tag_id: record.tagId,
        context_id: record.contextId,
        card_id: record.cardId,
        recurring_expense_id: null,
        import_fingerprint: record.importFingerprint,
        import_run_id: batchId,
        is_deleted: false,
      },
    })),
    {
      id: batchId,
      family: "import_run",
      data: {
        id: batchId,
        source_filename: sourceFilename,
        status: plan.errors.length ? "partial" : "completed",
        total_rows: plan.accepted.length + plan.errors.length + plan.duplicates.length,
        valid_rows: plan.accepted.length,
        imported_rows: plan.accepted.length,
        duplicate_rows: plan.duplicates.length,
        invalid_rows: plan.errors.length,
        error_summary: plan.errors.length ? "CSV validation errors" : null,
      },
    },
  ]
  await authority.commitSourceDiff({ creates, updates: [], tombstones: [] }, batchId)
  return { batchId }
}

export async function rollbackEncryptedCsvImport(authority: EncryptedFinancialAuthority, importRunId: string): Promise<void> {
  const records = authority.store.values()
  const imported = records.filter((record) => record.family === "transaction" && (
    String(record.data.import_run_id ?? record.data.csv_import_run_id ?? "") === importRunId ||
    record.sourceId === importRunId ||
    record.sourceId.startsWith(`${importRunId}:`)
  ))
  const run = records.find((record) => record.family === "import_run" && (
    String(record.data.id ?? "") === importRunId || record.sourceId === importRunId || record.envelope.record_id === importRunId
  ))
  await authority.commitSourceDiff({
    creates: [],
    updates: run ? [{ id: run.envelope.record_id, family: "import_run", data: { ...run.data, status: "rolled_back" } }] : [],
    tombstones: imported.map((record) => ({ id: record.envelope.record_id, family: "transaction", data: record.data })),
  })
}

export async function repairEncryptedCsvImportLineage(authority: EncryptedFinancialAuthority, importRunId: string): Promise<void> {
  const preview = analyzeImportLineage(authority, importRunId)
  if (preview.status !== "repairable_automatically") throw new Error("IMPORT_LINEAGE_REPAIR_NOT_SAFE")
  await applyImportLineageRepair(authority, preview)
}

export function getEncryptedDataRuns(authority: EncryptedFinancialAuthority, limit: number): DataRunItem[] {
  return authority.getState().importRuns.slice(0, limit).map((item) => {
    const id = String(item.id ?? "")
    const analysis = analyzeImportLineage(authority, id)
    const rolledBack = String(item.status ?? "") === "rolled_back"
    return {
      id,
      type: "import",
      status: String(item.status ?? "completed"),
      source_filename: String(item.source_filename ?? ""),
      created_at: String(item.created_at ?? ""),
      total_rows: Number(item.total_rows ?? 0),
      valid_rows: Number(item.valid_rows ?? 0),
      imported_rows: Number(item.imported_rows ?? 0),
      duplicate_rows: Number(item.duplicate_rows ?? 0),
      invalid_rows: Number(item.invalid_rows ?? 0),
      error_summary: item.error_summary == null ? null : String(item.error_summary),
      rollback_available: !rolledBack && (analysis.status === "not_needed" || analysis.status === "repaired"),
      rolled_back_at: rolledBack ? String(item.rolled_back_at ?? item.updated_at ?? "") : null,
      rolled_back_rows: Number(item.rolled_back_rows ?? 0),
      rollback_unavailable_reason: analysis.status === "source_file_required" || analysis.status === "ambiguous" ? "pre_rollback_feature" : null,
      lineage_repair_status: analysis.status,
      lineage_repair_evidence: analysis.evidenceMethod,
    } as DataRunItem
  })
}

export function exportEncryptedTransactionsCsv(authority: EncryptedFinancialAuthority, filters: { date_from?: string; date_to?: string }): string {
  const state = authority.getState()
  const records = state.transactions.filter((record) => (!filters.date_from || record.date >= filters.date_from) && (!filters.date_to || record.date <= filters.date_to))
  return exportTransactions(records, {
    createdAt: "",
    updatedAt: "",
    tagName: (id) => state.tags.find((tag) => tag.id === id)?.name ?? null,
    cardName: (id) => state.cards.find((card) => card.id === id)?.name ?? null,
    contextName: (id) => state.contexts.find((context) => context.id === id)?.name ?? null,
  })
}
