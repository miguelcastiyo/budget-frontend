import type { EncryptedRecordEnvelope } from "./types"
import type {
  EncryptedRecordFamily,
  RecordData,
  TypedEncryptedRecord,
  TypedEncryptedRecordPayload,
} from "./record-types"

const FAMILY_ALIASES: Record<string, EncryptedRecordFamily> = {
  tags: "taxonomy_tag",
  cards: "taxonomy_card",
  contexts: "taxonomy_context",
  funds: "fund",
  fund_entries: "fund_ledger_entry",
  fund_entry: "fund_ledger_entry",
  monthly_savings_allocations: "savings_plan_allocation",
  monthly_savings_allocation: "savings_plan_allocation",
  recurring_expenses: "recurring_series",
  recurring_expense_occurrences: "recurring_occurrence",
  budget_settings: "budget_version",
  budget_settings_versions: "budget_version",
  transactions: "transaction",
  monthly_closeouts: "month_closeout",
  monthly_closeout_allocations: "closeout_allocation",
  csv_import_runs: "import_run",
}

const FAMILIES = new Set<EncryptedRecordFamily>([
  "transaction", "taxonomy_tag", "taxonomy_card", "taxonomy_context", "budget_version",
  "recurring_series", "recurring_occurrence", "fund", "fund_ledger_entry", "savings_plan",
  "savings_plan_allocation", "month_closeout", "closeout_allocation", "import_run",
])

export function canonicalRecordFamily(value: unknown): EncryptedRecordFamily {
  const family = typeof value === "string" ? value : ""
  const canonical = FAMILY_ALIASES[family] ?? family
  if (!FAMILIES.has(canonical as EncryptedRecordFamily)) {
    throw new Error(`ENCRYPTED_RECORD_PAYLOAD_INVALID:unsupported_family:${family}`)
  }
  return canonical as EncryptedRecordFamily
}

function canonicalSchemaVersion(family: EncryptedRecordFamily, value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error("ENCRYPTED_RECORD_PAYLOAD_INVALID:schema_version")
  const version = value.trim()
  if (!version.endsWith("_v1") && version !== "v1") throw new Error(`ENCRYPTED_RECORD_SCHEMA_UNSUPPORTED:${version}`)
  return version === "v1" ? `${family}_v1` : version
}

function canonicalData(value: unknown): RecordData {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("ENCRYPTED_RECORD_PAYLOAD_INVALID:data")
  const input = value as RecordData
  const output: RecordData = { ...input }
  const aliases: Record<string, string> = {
    sourceId: "source_id", userId: "user_id", amountCents: "amount_cents", isSplit: "is_split",
    recurringExpenseId: "recurring_expense_id", importFingerprint: "import_fingerprint", tagId: "tag_id",
    contextId: "context_id", cardId: "card_id", isDeleted: "is_deleted", startsMonth: "starts_month",
    endsMonth: "ends_month", billingType: "billing_type", billingDay: "billing_day", fundId: "fund_id",
    entryType: "entry_type", sourceType: "source_type", sourceTransactionId: "source_transaction_id",
    sourceCloseoutId: "source_closeout_id", occurrenceMonth: "occurrence_month", dueDate: "due_date",
    transactionId: "transaction_id", planId: "plan_id", effectiveMonth: "effective_month",
  }
  for (const [legacy, current] of Object.entries(aliases)) {
    if (output[current] === undefined && output[legacy] !== undefined) output[current] = output[legacy]
  }
  return output
}

export function parseEncryptedRecordPayload(value: unknown): TypedEncryptedRecordPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("ENCRYPTED_RECORD_PAYLOAD_INVALID")
  const payload = value as RecordData
  const family = canonicalRecordFamily(payload.record_family)
  const sourceId = typeof payload.source_id === "string" && payload.source_id.trim() !== "" ? payload.source_id : ""
  if (!sourceId) throw new Error("ENCRYPTED_RECORD_PAYLOAD_INVALID:source_id")
  return {
    record_family: family,
    record_schema_version: canonicalSchemaVersion(family, payload.record_schema_version),
    source_id: sourceId,
    data: canonicalData(payload.data),
  }
}

export function typedRecordFromPayload(envelope: EncryptedRecordEnvelope, value: unknown): TypedEncryptedRecord {
  const payload = parseEncryptedRecordPayload(value)
  return {
    envelope,
    family: payload.record_family,
    schemaVersion: payload.record_schema_version,
    sourceId: payload.source_id,
    data: payload.data,
  }
}

export function serializeEncryptedRecord(record: Pick<TypedEncryptedRecord, "family" | "schemaVersion" | "sourceId" | "data">): TypedEncryptedRecordPayload {
  const family = canonicalRecordFamily(record.family)
  return {
    record_family: family,
    record_schema_version: canonicalSchemaVersion(family, record.schemaVersion),
    source_id: record.sourceId,
    data: canonicalData(record.data),
  }
}

export function sameEncryptedReference(left: unknown, right: unknown): boolean {
  if (left == null || right == null) return false
  const first = String(left)
  const second = String(right)
  return first === second || first.split(":").pop() === second.split(":").pop() || (Number.isFinite(Number(first)) && Number(first) === Number(second))
}
