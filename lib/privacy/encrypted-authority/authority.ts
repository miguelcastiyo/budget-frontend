import type { ApiClientCore } from "../../api/core"
import type { PrivacyStatus } from "../../api/privacy-status"
import type { EncryptedRecordEnvelope } from "../encrypted-records/types"
import { decryptSyntheticRecord, encryptSyntheticRecord } from "../encrypted-records/crypto"
import { EncryptedRecordClientError } from "../encrypted-records/types"
import { EncryptedRecordStore, type DecryptedFinancialRecord } from "./record-store"
import { rehydrateFinancialState, type RehydratedFinancialState } from "./rehydrate"
import type { SourceMutationDiff } from "../../domain/financial/transaction-fund-diff"

export type FinancialAuthorityMode = "legacy" | "encrypted"
export interface BatchCommitOptions { expectedRevisionOverrides?: Record<string, number> }

export class EncryptedFinancialAuthority {
  readonly store = new EncryptedRecordStore()
  private state: RehydratedFinancialState | null = null

  constructor(private readonly api: Pick<ApiClientCore, "request">, private readonly runtimeKey: CryptoKey, private readonly vaultId: string) {}

  getState(): RehydratedFinancialState { if (!this.state) throw new Error("ENCRYPTED_AUTHORITY_NOT_BOOTSTRAPPED"); return this.state }

  async bootstrap(): Promise<RehydratedFinancialState> {
    this.store.clear()
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
        if (!value || typeof value !== "object") throw new Error("ENCRYPTED_RECORD_PAYLOAD_INVALID")
        const payload = value as Record<string, unknown>
        if (typeof payload.record_family !== "string" || typeof payload.record_schema_version !== "string" || typeof payload.source_id !== "string" || !payload.data || typeof payload.data !== "object") throw new Error("ENCRYPTED_RECORD_PAYLOAD_INVALID")
        const record: DecryptedFinancialRecord = { envelope, family: payload.record_family, schemaVersion: payload.record_schema_version, sourceId: payload.source_id, data: payload.data as Record<string, unknown> }
        this.store.replace(record)
      }
      cursor = batch.next_cursor; this.store.setCursor(cursor); more = batch.has_more
    }
    this.state = rehydrateFinancialState(this.store.values())
    return this.state
  }

  async create(family: string, schemaVersion: string, sourceId: string, data: Record<string, unknown>) {
    const encrypted = await encryptSyntheticRecord(this.runtimeKey, this.vaultId, { record_family: family, record_schema_version: schemaVersion, source_id: sourceId, data }, 1)
    const envelope = await this.api.request<EncryptedRecordEnvelope>("/me/encrypted-records", { method: "POST", body: JSON.stringify({ envelope: encrypted.envelope, idempotency_key: encrypted.idempotencyKey }) })
    this.store.replace({ envelope, family, schemaVersion, sourceId, data }); this.state = rehydrateFinancialState(this.store.values()); return this.getState()
  }

  async createSource(family: string, schemaVersion: string, sourceId: string, data: Record<string, unknown>) {
    await this.create(family, schemaVersion, sourceId, data)
    return this.store.get(sourceId) ?? this.store.values().find((record) => record.sourceId === sourceId) ?? (() => { throw new Error("ENCRYPTED_AUTHORITY_STATE_INVALID") })()
  }

  async update(recordId: string, data: Record<string, unknown>) {
    const current = this.store.get(recordId); if (!current) throw new Error("ENCRYPTED_RECORD_NOT_FOUND")
    const encrypted = await encryptSyntheticRecord(this.runtimeKey, this.vaultId, { record_family: current.family, record_schema_version: current.schemaVersion, source_id: current.sourceId, data }, current.envelope.record_revision + 1, recordId)
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
      const encrypted = await encryptSyntheticRecord(this.runtimeKey, this.vaultId, { record_family: record.family, record_schema_version: `${record.family}_v1`, source_id: record.id, data: record.data }, 1, record.id)
      creates.push({ envelope: encrypted.envelope, idempotency_key: mutationIds() })
    }
    for (const record of diff.updates) {
      const current = this.store.get(record.id); if (!current) throw new Error(`ENCRYPTED_RECORD_NOT_FOUND:${record.id}`)
      const expectedRevision = options.expectedRevisionOverrides?.[record.id] ?? current.envelope.record_revision
      // `record.id` is the envelope record ID used for mutation routing. Keep
      // the decrypted source ID stable so a migrated record does not acquire
      // a second identity after its first edit.
      const encrypted = await encryptSyntheticRecord(this.runtimeKey, this.vaultId, { record_family: record.family, record_schema_version: current.schemaVersion, source_id: current.sourceId, data: record.data }, expectedRevision + 1, record.id)
      updates.push({ envelope: encrypted.envelope, expected_revision: expectedRevision, idempotency_key: mutationIds() })
    }
    for (const record of diff.tombstones) { const current = this.store.get(record.id); if (!current) throw new Error(`ENCRYPTED_RECORD_NOT_FOUND:${record.id}`); tombstones.push({ record_id: record.id, expected_revision: options.expectedRevisionOverrides?.[record.id] ?? current.envelope.record_revision, idempotency_key: mutationIds() }) }
    const result = await this.api.request<{ records: EncryptedRecordEnvelope[]; idempotent: boolean }>("/me/encrypted-records/batch", { method: "POST", body: JSON.stringify({ idempotency_key: idempotencyKey, creates, updates, tombstones }) })
    const byId = new Map(result.records.map((envelope) => [envelope.record_id, envelope]))
    for (const record of [...diff.creates, ...diff.updates]) {
      const envelope = byId.get(record.id)
      if (envelope) {
        const prior = this.store.get(record.id)
        this.store.replace({ envelope, family: record.family, schemaVersion: prior?.schemaVersion ?? `${record.family}_v1`, sourceId: prior?.sourceId ?? record.id, data: record.data })
      }
    }
    for (const record of diff.tombstones) this.store.remove(record.id)
    this.state = rehydrateFinancialState(this.store.values())
    return result
  }
}

export async function selectFinancialAuthority(api: ApiClientCore, status: PrivacyStatus, runtimeKey: CryptoKey | null, vaultId: string | null): Promise<{ mode: FinancialAuthorityMode; authority?: EncryptedFinancialAuthority }> {
  if (status.financial_privacy_state !== "encrypted") return { mode: "legacy" }
  if (!runtimeKey || !vaultId) throw new Error("ENCRYPTED_AUTHORITY_LOCKED")
  const authority = new EncryptedFinancialAuthority(api, runtimeKey, vaultId)
  await authority.bootstrap()
  return { mode: "encrypted", authority }
}
