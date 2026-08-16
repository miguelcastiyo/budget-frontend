import type { ApiClientCore } from "../../api/core"
import type { EncryptedRecordEnvelope } from "../encrypted-records/types"
import { decryptSyntheticRecord, encryptSyntheticRecord } from "../encrypted-records/crypto"
import { EncryptedRecordClientError } from "../encrypted-records/types"
import { EncryptedRecordStore, type DecryptedFinancialRecord } from "./record-store"
import { rehydrateFinancialState, type RehydratedFinancialState } from "./rehydrate"
import type { SourceMutationDiff } from "../../domain/financial/transaction-fund-diff"
import { serializeEncryptedRecord, typedRecordFromPayload } from "../encrypted-records/adapters"
import { auditEncryptedRecordPayloads, emptyCompatibilityAuditReport, mergeCompatibilityAuditReports, type CompatibilityAuditReport } from "../encrypted-records/compatibility-audit"

export interface BatchCommitOptions { expectedRevisionOverrides?: Record<string, number> }

export class EncryptedFinancialAuthority {
  readonly store = new EncryptedRecordStore()
  private compatibilityReport: CompatibilityAuditReport = emptyCompatibilityAuditReport()
  private state: RehydratedFinancialState | null = null

  constructor(private readonly api: Pick<ApiClientCore, "request">, private readonly runtimeKey: CryptoKey, private readonly vaultId: string) {}

  getState(): RehydratedFinancialState { if (!this.state) throw new Error("ENCRYPTED_AUTHORITY_NOT_BOOTSTRAPPED"); return this.state }
  getCompatibilityAudit(): CompatibilityAuditReport { return this.compatibilityReport }

  async bootstrap(): Promise<RehydratedFinancialState> {
    this.store.clear()
    this.compatibilityReport = emptyCompatibilityAuditReport()
    let cursor = "0"
    let more = true
    while (more) {
      const batch = await this.api.request<{ changes: EncryptedRecordEnvelope[]; next_cursor: string; has_more: boolean }>(`/me/encrypted-records/sync?after=${encodeURIComponent(cursor)}&limit=100`)
      for (const envelope of batch.changes) {
        if (envelope.deleted) { this.store.remove(envelope.record_id); continue }
        let value: unknown
        try { value = await decryptSyntheticRecord(this.runtimeKey, envelope) }
        catch (error) {
          if (error instanceof EncryptedRecordClientError) throw new Error(`${error.code}:${envelope.record_id}`, { cause: error })
          throw error
        }
        this.compatibilityReport = mergeCompatibilityAuditReports(this.compatibilityReport, auditEncryptedRecordPayloads([value]))
        this.store.replace(typedRecordFromPayload(envelope, value))
      }
      cursor = batch.next_cursor; this.store.setCursor(cursor); more = batch.has_more
    }
    this.state = rehydrateFinancialState(this.store.values())
    return this.state
  }

  async create(family: string, schemaVersion: string, sourceId: string, data: Record<string, unknown>) {
    const payload = serializeEncryptedRecord({ family: family as DecryptedFinancialRecord["family"], schemaVersion, sourceId, data })
    const encrypted = await encryptSyntheticRecord(this.runtimeKey, this.vaultId, payload, 1)
    const envelope = await this.api.request<EncryptedRecordEnvelope>("/me/encrypted-records", { method: "POST", body: JSON.stringify({ envelope: encrypted.envelope, idempotency_key: encrypted.idempotencyKey }) })
    this.store.replace({ envelope, family: payload.record_family, schemaVersion: payload.record_schema_version, sourceId, data: payload.data }); this.state = rehydrateFinancialState(this.store.values()); return this.getState()
  }

  async createSource(family: string, schemaVersion: string, sourceId: string, data: Record<string, unknown>) {
    await this.create(family, schemaVersion, sourceId, data)
    return this.store.get(sourceId) ?? this.store.values().find((record) => record.sourceId === sourceId) ?? (() => { throw new Error("ENCRYPTED_AUTHORITY_STATE_INVALID") })()
  }

  async update(recordId: string, data: Record<string, unknown>) {
    const current = this.store.get(recordId); if (!current) throw new Error("ENCRYPTED_RECORD_NOT_FOUND")
    const payload = serializeEncryptedRecord({ family: current.family, schemaVersion: current.schemaVersion, sourceId: current.sourceId, data })
    const encrypted = await encryptSyntheticRecord(this.runtimeKey, this.vaultId, payload, current.envelope.record_revision + 1, recordId)
    const envelope = await this.api.request<EncryptedRecordEnvelope>(`/me/encrypted-records/${encodeURIComponent(recordId)}`, { method: "PUT", body: JSON.stringify({ envelope: encrypted.envelope, expected_revision: current.envelope.record_revision, idempotency_key: encrypted.idempotencyKey }) })
    this.store.replace({ ...current, envelope, data }); this.state = rehydrateFinancialState(this.store.values()); return this.getState()
  }

  async updateSource(recordId: string, data: Record<string, unknown>) {
    await this.update(recordId, data)
    return this.store.get(recordId) ?? (() => { throw new Error("ENCRYPTED_AUTHORITY_STATE_INVALID") })()
  }

  async remove(recordId: string) {
    const current = this.store.get(recordId); if (!current) throw new Error("ENCRYPTED_RECORD_NOT_FOUND")
    const envelope = await this.api.request<EncryptedRecordEnvelope>(`/me/encrypted-records/${encodeURIComponent(recordId)}`, { method: "DELETE", body: JSON.stringify({ expected_revision: current.envelope.record_revision, idempotency_key: crypto.randomUUID() }) })
    this.store.remove(recordId); this.state = rehydrateFinancialState(this.store.values()); return envelope
  }

  async commitSourceDiff(diff: SourceMutationDiff, idempotencyKey = `batch_${crypto.randomUUID()}`, options: BatchCommitOptions = {}) {
    const creates: Array<{ envelope: EncryptedRecordEnvelope; idempotency_key: string }> = []
    const updates: Array<{ envelope: EncryptedRecordEnvelope; expected_revision: number; idempotency_key: string }> = []
    const tombstones: Array<{ record_id: string; expected_revision: number; idempotency_key: string }> = []
    const mutationIds = () => `mut_${crypto.randomUUID()}`
    for (const record of diff.creates) {
      const payload = serializeEncryptedRecord({ family: record.family as DecryptedFinancialRecord["family"], schemaVersion: `${record.family}_v1`, sourceId: record.id, data: record.data })
      const encrypted = await encryptSyntheticRecord(this.runtimeKey, this.vaultId, payload, 1, record.id)
      creates.push({ envelope: encrypted.envelope, idempotency_key: mutationIds() })
    }
    for (const record of diff.updates) {
      const current = this.store.get(record.id); if (!current) throw new Error(`ENCRYPTED_RECORD_NOT_FOUND:${record.id}`)
      const expectedRevision = options.expectedRevisionOverrides?.[record.id] ?? current.envelope.record_revision
      // `record.id` is the envelope record ID used for mutation routing. Keep
      // the decrypted source ID stable so a migrated record does not acquire
      // a second identity after its first edit.
      const payload = serializeEncryptedRecord({ family: record.family as DecryptedFinancialRecord["family"], schemaVersion: current.schemaVersion, sourceId: current.sourceId, data: record.data })
      const encrypted = await encryptSyntheticRecord(this.runtimeKey, this.vaultId, payload, expectedRevision + 1, record.id)
      updates.push({ envelope: encrypted.envelope, expected_revision: expectedRevision, idempotency_key: mutationIds() })
    }
    for (const record of diff.tombstones) { const current = this.store.get(record.id); if (!current) throw new Error(`ENCRYPTED_RECORD_NOT_FOUND:${record.id}`); tombstones.push({ record_id: record.id, expected_revision: options.expectedRevisionOverrides?.[record.id] ?? current.envelope.record_revision, idempotency_key: mutationIds() }) }
    const result = await this.api.request<{ records: EncryptedRecordEnvelope[]; idempotent: boolean }>("/me/encrypted-records/batch", { method: "POST", body: JSON.stringify({ idempotency_key: idempotencyKey, creates, updates, tombstones }) })
    const byId = new Map(result.records.map((envelope) => [envelope.record_id, envelope]))
    for (const record of [...diff.creates, ...diff.updates]) {
      const envelope = byId.get(record.id)
      if (envelope) {
        const prior = this.store.get(record.id)
        const payload = serializeEncryptedRecord({ family: record.family as DecryptedFinancialRecord["family"], schemaVersion: prior?.schemaVersion ?? `${record.family}_v1`, sourceId: prior?.sourceId ?? record.id, data: record.data })
        this.store.replace({ envelope, family: payload.record_family, schemaVersion: payload.record_schema_version, sourceId: payload.source_id, data: payload.data })
      }
    }
    for (const record of diff.tombstones) this.store.remove(record.id)
    this.state = rehydrateFinancialState(this.store.values())
    return result
  }
}
