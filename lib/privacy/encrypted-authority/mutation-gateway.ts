import type { EncryptedRecordBatchRequest, EncryptedRecordBatchResponse } from "../../api/encrypted-records"
import type { EncryptedRecordEnvelope } from "../encrypted-records/types"

export interface EncryptedMutationGatewayApi { batchEncryptedRecords(payload: EncryptedRecordBatchRequest): Promise<EncryptedRecordBatchResponse> }
export interface EncryptedMutationPlan { creates: Array<{ envelope: EncryptedRecordEnvelope; idempotency_key: string }>; updates: Array<{ envelope: EncryptedRecordEnvelope; expected_revision: number; idempotency_key: string }>; tombstones: Array<{ record_id: string; expected_revision: number; idempotency_key: string }> }

/** Persists a complete domain command before the caller publishes its new local state. */
export class EncryptedMutationGateway {
  constructor(private readonly api: EncryptedMutationGatewayApi) {}

  async commit(plan: EncryptedMutationPlan, idempotencyKey = `batch_${crypto.randomUUID()}`): Promise<EncryptedRecordBatchResponse> {
    if (!plan.creates.length && !plan.updates.length && !plan.tombstones.length) throw new Error("ENCRYPTED_MUTATION_EMPTY")
    return this.api.batchEncryptedRecords({ ...plan, idempotency_key: idempotencyKey })
  }
}
