import { encryptSyntheticRecord } from "./encrypted-records/crypto"
import type { EncryptedRecordEnvelope } from "./encrypted-records/types"
import type { MigrationEnvelope, MigrationSnapshot, MigrationTarget, MigrationTargetManifest } from "../api/privacy-migration"

export const MIGRATION_SNAPSHOT_VERSION = "phase5_snapshot_v1"
const FAMILY_MAP: Record<string, string> = {
  tags: "taxonomy_tag", cards: "taxonomy_card", contexts: "taxonomy_context",
  funds: "fund", monthly_savings_allocations: "savings_plan_allocation",
  recurring_expenses: "recurring_series", recurring_expense_occurrences: "recurring_occurrence",
  budget_settings: "budget_settings", budget_settings_versions: "budget_version",
  transactions: "transaction", fund_entries: "fund_ledger_entry",
  monthly_closeouts: "month_closeout", monthly_closeout_allocations: "closeout_allocation",
  csv_import_runs: "import_run",
}
const RELATIONSHIP_KEYS = new Set(["tag_id", "card_id", "context_id", "recurring_expense_id", "transaction_id", "source_transaction_id", "fund_id", "source_closeout_id", "source_closeout_allocation_id", "closeout_id", "csv_import_run_id"])
const OWN_ID_KEYS: Record<string, string> = { funds: "fund_id", recurring_expenses: "series_id", monthly_closeouts: "closeout_id", monthly_closeout_allocations: "allocation_id", fund_entries: "fund_entry_id" }

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map(key => [key, stable((value as Record<string, unknown>)[key])]))
  return value
}

export function validateMigrationSnapshot(snapshot: MigrationSnapshot): void {
  if (!snapshot.migration_run_id || !Number.isSafeInteger(snapshot.source_financial_revision) || snapshot.source_financial_revision < 0 || snapshot.snapshot_schema_version !== MIGRATION_SNAPSHOT_VERSION || !snapshot.collections || typeof snapshot.collections !== "object") throw new Error("MIGRATION_SNAPSHOT_INVALID")
  const ids = new Set<string>()
  const plainIds = new Set<string>()
  for (const [family, rows] of Object.entries(snapshot.collections)) {
    if (!Array.isArray(rows)) throw new Error("MIGRATION_SNAPSHOT_INVALID")
    for (const row of rows) {
      if (!row || typeof row !== "object" || !("id" in row)) throw new Error("MIGRATION_SNAPSHOT_INVALID")
      const id = `${family}:${String((row as { id: unknown }).id)}`
      if (ids.has(id)) throw new Error("MIGRATION_SNAPSHOT_INVALID")
      ids.add(id)
      plainIds.add(String((row as { id: unknown }).id))
    }
  }
  for (const [family, rows] of Object.entries(snapshot.collections)) for (const row of rows) for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    if (value === null || !RELATIONSHIP_KEYS.has(key) || key === OWN_ID_KEYS[family]) continue
    if (!plainIds.has(String(value))) throw new Error(`MIGRATION_RELATIONSHIP_INVALID:${family}:${key}`)
  }
}

export function transformMigrationSnapshot(snapshot: MigrationSnapshot): { targets: MigrationTarget[]; records: Array<{ target: MigrationTarget; value: unknown }> } {
  validateMigrationSnapshot(snapshot)
  const records: Array<{ target: MigrationTarget; value: unknown }> = []
  for (const [family, rows] of Object.entries(snapshot.collections)) for (const row of rows) {
    const sourceId = String((row as { id: unknown }).id)
    const targetFamily = FAMILY_MAP[family] ?? family
    const target: MigrationTarget = { target_record_id: `mig:${targetFamily}:${sourceId}`, record_family: targetFamily, record_schema_version: `${targetFamily}_v1` }
    records.push({ target, value: stable({ record_family: targetFamily, record_schema_version: target.record_schema_version, source_id: sourceId, data: row }) })
  }
  records.sort((a, b) => a.target.target_record_id.localeCompare(b.target.target_record_id))
  return { targets: records.map(record => record.target), records }
}

export async function encryptMigrationRecords(runtimeKey: CryptoKey, vaultId: string, snapshot: MigrationSnapshot): Promise<{ manifest: MigrationTargetManifest; records: MigrationEnvelope[] }> {
  const transformed = transformMigrationSnapshot(snapshot)
  const records: MigrationEnvelope[] = []
  for (const item of transformed.records) {
    const encrypted = await encryptSyntheticRecord(runtimeKey, vaultId, item.value, 1, item.target.target_record_id)
    const envelope: EncryptedRecordEnvelope = encrypted.envelope
    records.push({ target_record_id: item.target.target_record_id, record_family: item.target.record_family, record_schema_version: item.target.record_schema_version, envelope_version: 1, iv: envelope.iv ?? "", ciphertext: envelope.ciphertext ?? "" })
  }
  return { manifest: { manifest_version: "phase5_target_manifest_v1", snapshot_schema_version: snapshot.snapshot_schema_version, source_financial_revision: snapshot.source_financial_revision, relationship_count: snapshot.source_manifest.relationship_count, targets: transformed.targets }, records }
}

export type MigrationStage = "snapshot_validating" | "transforming" | "encrypting" | "uploading" | "verifying" | "staged_ready"

/** In-memory resumable orchestration; the server's target identity makes retries safe. */
export async function runMigrationStaging(input: {
  snapshot: MigrationSnapshot
  runtimeKey: CryptoKey
  vaultId: string
  putManifest: (manifest: MigrationTargetManifest) => Promise<unknown>
  putRecord: (recordId: string, record: MigrationEnvelope) => Promise<unknown>
  verify: () => Promise<unknown>
  onStage?: (stage: MigrationStage) => void
}): Promise<MigrationTargetManifest> {
  input.onStage?.("snapshot_validating")
  validateMigrationSnapshot(input.snapshot)
  input.onStage?.("transforming")
  input.onStage?.("encrypting")
  const encrypted = await encryptMigrationRecords(input.runtimeKey, input.vaultId, input.snapshot)
  input.onStage?.("uploading")
  await input.putManifest(encrypted.manifest)
  for (const record of encrypted.records) await input.putRecord(record.target_record_id, record)
  input.onStage?.("verifying")
  await input.verify()
  input.onStage?.("staged_ready")
  return encrypted.manifest
}
