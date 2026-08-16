export interface CompatibilityAuditReport {
  records_scanned: number
  family_aliases: Record<string, number>
  field_aliases: Record<string, number>
  namespaced_references: number
  numeric_references: number
  legacy_schema_versions: Record<string, number>
  legacy_record_ids: number
}

const FAMILY_ALIASES = new Set([
  "tags", "cards", "contexts", "funds", "fund_entries", "fund_entry",
  "monthly_savings_allocations", "monthly_savings_allocation", "recurring_expenses",
  "recurring_expense_occurrences", "budget_settings", "budget_settings_versions",
  "transactions", "monthly_closeouts", "monthly_closeout_allocations", "csv_import_runs",
])

const FIELD_ALIASES = new Set([
  "sourceId", "userId", "amountCents", "isSplit", "recurringExpenseId", "importFingerprint",
  "tagId", "contextId", "cardId", "isDeleted", "startsMonth", "endsMonth", "billingType",
  "billingDay", "fundId", "entryType", "sourceType", "sourceTransactionId", "sourceCloseoutId",
  "occurrenceMonth", "dueDate", "transactionId", "planId", "effectiveMonth", "transaction_date",
  "amount", "primary_monthly_income", "primary_hourly_rate", "side_monthly_income", "side_hourly_rate",
  "primary_weekly_hours", "side_weekly_hours", "needs_percent", "wants_percent", "savings_percent",
  "needs_amount", "wants_amount", "savings_amount",
])

const REFERENCE_FIELDS = new Set([
  "source_id", "id", "tag_id", "tagId", "context_id", "contextId", "card_id", "cardId",
  "recurring_expense_id", "recurringExpenseId", "transaction_id", "transactionId", "fund_id", "fundId",
])

export function emptyCompatibilityAuditReport(): CompatibilityAuditReport {
  return { records_scanned: 0, family_aliases: {}, field_aliases: {}, namespaced_references: 0, numeric_references: 0, legacy_schema_versions: {}, legacy_record_ids: 0 }
}

export function auditEncryptedRecordPayloads(payloads: Iterable<unknown>): CompatibilityAuditReport {
  const report = emptyCompatibilityAuditReport()
  for (const value of payloads) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue
    const payload = value as Record<string, unknown>
    report.records_scanned += 1
    const family = typeof payload.record_family === "string" ? payload.record_family : ""
    if (FAMILY_ALIASES.has(family)) report.family_aliases[family] = (report.family_aliases[family] ?? 0) + 1
    const schema = typeof payload.record_schema_version === "string" ? payload.record_schema_version : ""
    if (schema && schema !== "v1" && !schema.endsWith("_v1")) report.legacy_schema_versions[schema] = (report.legacy_schema_versions[schema] ?? 0) + 1
    const sourceId = typeof payload.source_id === "string" ? payload.source_id : ""
    if (/^\d+$/.test(sourceId)) report.legacy_record_ids += 1
    const data = payload.data && typeof payload.data === "object" && !Array.isArray(payload.data) ? payload.data as Record<string, unknown> : {}
    for (const [key, raw] of Object.entries(data)) {
      if (FIELD_ALIASES.has(key)) report.field_aliases[key] = (report.field_aliases[key] ?? 0) + 1
      if (!REFERENCE_FIELDS.has(key) || raw == null || typeof raw === "object") continue
      const reference = String(raw)
      if (reference.includes(":")) report.namespaced_references += 1
      if (/^\d+$/.test(reference)) report.numeric_references += 1
    }
  }
  return report
}

export function mergeCompatibilityAuditReports(left: CompatibilityAuditReport, right: CompatibilityAuditReport): CompatibilityAuditReport {
  const add = (a: Record<string, number>, b: Record<string, number>) => Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].map((key) => [key, (a[key] ?? 0) + (b[key] ?? 0)]))
  return {
    records_scanned: left.records_scanned + right.records_scanned,
    family_aliases: add(left.family_aliases, right.family_aliases),
    field_aliases: add(left.field_aliases, right.field_aliases),
    namespaced_references: left.namespaced_references + right.namespaced_references,
    numeric_references: left.numeric_references + right.numeric_references,
    legacy_schema_versions: add(left.legacy_schema_versions, right.legacy_schema_versions),
    legacy_record_ids: left.legacy_record_ids + right.legacy_record_ids,
  }
}
