import { createDeterministicEncryptedRecordId } from "../encrypted-records/crypto"
import { pendingDevelopmentEnabled } from "./pending-development"
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
export interface PreparedSourceBatch { readonly body: string }


export class EncryptedFinancialAuthority {
  readonly store = new EncryptedRecordStore()
  private compatibilityReport: CompatibilityAuditReport = emptyCompatibilityAuditReport()
  private state: RehydratedFinancialState | null = null
  private readonly listeners = new Set<() => void>()
  private stateVersion = 0
  private readonly preparedDiffs = new WeakMap<PreparedSourceBatch, { diff: SourceMutationDiff; scope: "ordinary" | "capture" | "finalize" | "undo" }>()
  private pendingCapabilities = { capture: false, recovery: false }
  setPendingCapabilities(capabilities: { capture: boolean; recovery: boolean }) { this.pendingCapabilities = { ...capabilities } }
  private pendingAllowed(scope: "capture" | "finalize" | "undo") {
    return pendingDevelopmentEnabled() || (scope === "capture" ? this.pendingCapabilities.capture && this.pendingCapabilities.recovery : this.pendingCapabilities.recovery)
  }

  constructor(private readonly api: Pick<ApiClientCore, "request">, private readonly runtimeKey: CryptoKey, private readonly vaultId: string) {}

  getState(): RehydratedFinancialState { if (!this.state) throw new Error("ENCRYPTED_AUTHORITY_NOT_BOOTSTRAPPED"); return this.state }
  getCompatibilityAudit(): CompatibilityAuditReport { return this.compatibilityReport }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  getVersion = () => this.stateVersion
  private publish(state: RehydratedFinancialState) {
    this.state = state
    this.stateVersion++
    for (const listener of this.listeners) { try { listener() } catch { /* A subscriber must not break a committed mutation. */ } }
  }

  async bootstrap(): Promise<RehydratedFinancialState> {
    const version = this.stateVersion
    const staged = new EncryptedRecordStore()
    let report = emptyCompatibilityAuditReport()
    let cursor = "0"
    let more = true
    while (more) {
      const batch = await this.api.request<{ changes: EncryptedRecordEnvelope[]; next_cursor: string; has_more: boolean }>(`/me/encrypted-records/sync?after=${encodeURIComponent(cursor)}&limit=100`)
      for (const envelope of batch.changes) {
        if (envelope.deleted) { staged.remove(envelope.record_id); continue }
        let value: unknown
        try { value = await decryptSyntheticRecord(this.runtimeKey, envelope) }
        catch (error) {
          if (error instanceof EncryptedRecordClientError) throw new Error(`${error.code}:${envelope.record_id}`, { cause: error })
          throw error
        }
        report = mergeCompatibilityAuditReports(report, auditEncryptedRecordPayloads([value]))
        staged.replace(typedRecordFromPayload(envelope, value))
      }
      cursor = batch.next_cursor; staged.setCursor(cursor); more = batch.has_more
    }
    const state = rehydrateFinancialState(staged.values())
    if (version !== this.stateVersion) throw new Error("ENCRYPTED_AUTHORITY_SYNC_CONFLICT")
    this.store.clear()
    for (const record of staged.values()) this.store.replace(record)
    this.store.setCursor(staged.getCursor())
    this.compatibilityReport = report
    this.publish(state)
    return state
  }

  async create(family: string, schemaVersion: string, sourceId: string, data: Record<string, unknown>) {
    if (family === "pending_transaction" && !pendingDevelopmentEnabled()) throw new Error("PENDING_TRANSACTION_WRITES_DISABLED")
    const payload = serializeEncryptedRecord({ family: family as DecryptedFinancialRecord["family"], schemaVersion, sourceId, data })
    const encrypted = await encryptSyntheticRecord(this.runtimeKey, this.vaultId, payload, 1)
    const envelope = await this.api.request<EncryptedRecordEnvelope>("/me/encrypted-records", { method: "POST", body: JSON.stringify({ envelope: encrypted.envelope, idempotency_key: encrypted.idempotencyKey }) })
    this.store.replace({ envelope, family: payload.record_family, schemaVersion: payload.record_schema_version, sourceId, data: payload.data }); this.publish(rehydrateFinancialState(this.store.values())); return this.getState()
  }

  async createSource(family: string, schemaVersion: string, sourceId: string, data: Record<string, unknown>) {
    await this.create(family, schemaVersion, sourceId, data)
    return this.store.get(sourceId) ?? this.store.values().find((record) => record.sourceId === sourceId) ?? (() => { throw new Error("ENCRYPTED_AUTHORITY_STATE_INVALID") })()
  }

  async update(recordId: string, data: Record<string, unknown>) {
    const current = this.store.get(recordId); if (!current) throw new Error("ENCRYPTED_RECORD_NOT_FOUND")
    if (current.family === "pending_transaction" && !pendingDevelopmentEnabled()) throw new Error("PENDING_TRANSACTION_WRITES_DISABLED")
    const payload = serializeEncryptedRecord({ family: current.family, schemaVersion: current.schemaVersion, sourceId: current.sourceId, data })
    const encrypted = await encryptSyntheticRecord(this.runtimeKey, this.vaultId, payload, current.envelope.record_revision + 1, recordId)
    const envelope = await this.api.request<EncryptedRecordEnvelope>(`/me/encrypted-records/${encodeURIComponent(recordId)}`, { method: "PUT", body: JSON.stringify({ envelope: encrypted.envelope, expected_revision: current.envelope.record_revision, idempotency_key: encrypted.idempotencyKey }) })
    this.store.replace({ ...current, envelope, data }); this.publish(rehydrateFinancialState(this.store.values())); return this.getState()
  }

  async updateSource(recordId: string, data: Record<string, unknown>) {
    await this.update(recordId, data)
    return this.store.get(recordId) ?? (() => { throw new Error("ENCRYPTED_AUTHORITY_STATE_INVALID") })()
  }

  async remove(recordId: string) {
    const current = this.store.get(recordId); if (!current) throw new Error("ENCRYPTED_RECORD_NOT_FOUND")
    if (current.family === "pending_transaction" && !pendingDevelopmentEnabled()) throw new Error("PENDING_TRANSACTION_WRITES_DISABLED")
    const envelope = await this.api.request<EncryptedRecordEnvelope>(`/me/encrypted-records/${encodeURIComponent(recordId)}`, { method: "DELETE", body: JSON.stringify({ expected_revision: current.envelope.record_revision, idempotency_key: crypto.randomUUID() }) })
    this.store.remove(recordId); this.publish(rehydrateFinancialState(this.store.values())); return envelope
  }

  async prepareSourceDiff(diff: SourceMutationDiff, idempotencyKey = `batch_${crypto.randomUUID()}`, options: BatchCommitOptions = {}): Promise<PreparedSourceBatch> {
    if (!pendingDevelopmentEnabled() && [...diff.creates, ...diff.updates, ...diff.tombstones].some((record) => record.family === "pending_transaction" || this.store.get(record.id)?.family === "pending_transaction")) throw new Error("PENDING_TRANSACTION_WRITES_DISABLED")
    return this.prepareScopedDiff(diff, "ordinary", idempotencyKey, options)
  }

  async preparePendingCapture(diff: SourceMutationDiff): Promise<PreparedSourceBatch> {
    if (!this.pendingAllowed("capture")) throw new Error("PENDING_TRANSACTION_WRITES_DISABLED")
    if (diff.creates.length !== 1 || diff.creates[0].family !== "pending_transaction" || diff.updates.length || diff.tombstones.length) throw new Error("PENDING_BATCH_INVALID")
    return this.prepareScopedDiff(diff, "capture")
  }

  async preparePendingFinalization(diff: SourceMutationDiff, pendingId: string, expectedRevision: number): Promise<PreparedSourceBatch> {
    if (!this.pendingAllowed("finalize")) throw new Error("PENDING_TRANSACTION_WRITES_DISABLED")
    const pending = this.store.get(pendingId)
    const transactionId = await createDeterministicEncryptedRecordId(`pending-finalization:v1:${pendingId}`)
    if (pending?.family !== "pending_transaction" || diff.updates.length || diff.tombstones.length !== 1 || diff.tombstones[0].id !== pendingId || diff.creates.length !== 1 || diff.creates[0].family !== "transaction" || diff.creates[0].id !== transactionId || diff.creates[0].data.pending_transaction_id !== pendingId) throw new Error("PENDING_BATCH_INVALID")
    return this.prepareScopedDiff(diff, "finalize", undefined, { expectedRevisionOverrides: { [pendingId]: expectedRevision } })
  }

  async preparePendingUndo(diff: SourceMutationDiff, transactionId: string, revisions: Record<string, number>): Promise<PreparedSourceBatch> {
    if (!this.pendingAllowed("undo")) throw new Error("PENDING_TRANSACTION_WRITES_DISABLED")
    const transaction = this.store.get(transactionId)
    if (transaction?.family !== "transaction" || typeof transaction.data.pending_transaction_id !== "string" || diff.updates.length || diff.creates.length !== 1 || diff.creates[0].family !== "pending_transaction" || !diff.tombstones.some((record) => record.id === transactionId) || diff.tombstones.some((record) => record.id !== transactionId && (this.store.get(record.id)?.family !== "fund_ledger_entry" || this.store.get(record.id)?.data.source_transaction_id !== transactionId))) throw new Error("PENDING_BATCH_INVALID")
    return this.prepareScopedDiff(diff, "undo", undefined, { expectedRevisionOverrides: revisions })
  }

  private async prepareScopedDiff(diff: SourceMutationDiff, scope: "ordinary" | "capture" | "finalize" | "undo", idempotencyKey = `batch_${crypto.randomUUID()}`, options: BatchCommitOptions = {}): Promise<PreparedSourceBatch> {
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
    const prepared = Object.freeze({ body: JSON.stringify({ idempotency_key: idempotencyKey, creates, updates, tombstones }) })
    this.preparedDiffs.set(prepared, { diff: structuredClone(diff), scope })
    return prepared
  }

  async submitPreparedSourceDiff(prepared: PreparedSourceBatch) {
    const entry = this.preparedDiffs.get(prepared)
    if (!entry) throw new Error("ENCRYPTED_BATCH_PLAN_INVALID")
    const { diff, scope } = entry
    if (scope !== "ordinary" && !this.pendingAllowed(scope)) throw new Error("PENDING_TRANSACTION_WRITES_DISABLED")
    if (scope === "ordinary" && !pendingDevelopmentEnabled() && [...diff.creates, ...diff.updates, ...diff.tombstones].some((record) => record.family === "pending_transaction" || this.store.get(record.id)?.family === "pending_transaction")) throw new Error("PENDING_TRANSACTION_WRITES_DISABLED")
    const result = await this.api.request<{ records: EncryptedRecordEnvelope[]; idempotent: boolean }>("/me/encrypted-records/batch", { method: "POST", body: prepared.body })
    const byId = new Map(result.records.map((envelope) => [envelope.record_id, envelope]))
    for (const record of [...diff.creates, ...diff.updates]) {
      const envelope = byId.get(record.id)
      if (envelope && BigInt(envelope.sync_sequence) > BigInt(this.store.getCursor())) {
        const prior = this.store.get(record.id)
        if (prior && prior.envelope.record_revision > envelope.record_revision) continue
        const payload = serializeEncryptedRecord({ family: record.family as DecryptedFinancialRecord["family"], schemaVersion: prior?.schemaVersion ?? `${record.family}_v1`, sourceId: prior?.sourceId ?? record.id, data: record.data })
        this.store.replace({ envelope, family: payload.record_family, schemaVersion: payload.record_schema_version, sourceId: payload.source_id, data: payload.data })
      }
    }
    for (const record of diff.tombstones) {
      const envelope = byId.get(record.id)
      const current = this.store.get(record.id)
      if (envelope && BigInt(envelope.sync_sequence) > BigInt(this.store.getCursor()) && (!current || current.envelope.record_revision <= envelope.record_revision)) this.store.remove(record.id)
    }
    this.publish(rehydrateFinancialState(this.store.values()))
    return result
  }

  async commitSourceDiff(diff: SourceMutationDiff, idempotencyKey = `batch_${crypto.randomUUID()}`, options: BatchCommitOptions = {}) {
    return this.submitPreparedSourceDiff(await this.prepareSourceDiff(diff, idempotencyKey, options))
  }
}
