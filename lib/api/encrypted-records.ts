import type { ApiClientCore } from "./core"
import type { EncryptedRecordEnvelope, EncryptedRecordSyncResponse } from "../privacy/encrypted-records/types"

export interface EncryptedRecordBatchRequest {
  idempotency_key: string
  creates: Array<{ envelope: EncryptedRecordEnvelope; idempotency_key: string }>
  updates: Array<{ envelope: EncryptedRecordEnvelope; expected_revision: number; idempotency_key: string }>
  tombstones: Array<{ record_id: string; expected_revision: number; idempotency_key: string }>
}

export interface EncryptedRecordBatchResponse { records: EncryptedRecordEnvelope[]; idempotent: boolean }

export function createEncryptedRecordsApi(core: ApiClientCore) {
  return {
    createEncryptedRecord: (envelope: EncryptedRecordEnvelope, idempotencyKey: string) => core.request<EncryptedRecordEnvelope>("/me/encrypted-records", { method: "POST", body: JSON.stringify({ envelope, idempotency_key: idempotencyKey }) }),
    getEncryptedRecord: (recordId: string) => core.request<EncryptedRecordEnvelope>(`/me/encrypted-records/${encodeURIComponent(recordId)}`),
    updateEncryptedRecord: (recordId: string, envelope: EncryptedRecordEnvelope, expectedRevision: number, idempotencyKey: string) => core.request<EncryptedRecordEnvelope>(`/me/encrypted-records/${encodeURIComponent(recordId)}`, { method: "PUT", body: JSON.stringify({ envelope, expected_revision: expectedRevision, idempotency_key: idempotencyKey }) }),
    deleteEncryptedRecord: (recordId: string, expectedRevision: number, idempotencyKey: string) => core.request<EncryptedRecordEnvelope>(`/me/encrypted-records/${encodeURIComponent(recordId)}`, { method: "DELETE", body: JSON.stringify({ expected_revision: expectedRevision, idempotency_key: idempotencyKey }) }),
    syncEncryptedRecords: (after = "0", limit = 50) => core.request<EncryptedRecordSyncResponse>(`/me/encrypted-records/sync?after=${encodeURIComponent(after)}&limit=${limit}`),
    batchEncryptedRecords: (payload: EncryptedRecordBatchRequest) => core.request<EncryptedRecordBatchResponse>("/me/encrypted-records/batch", { method: "POST", body: JSON.stringify(payload) }),
  }
}
