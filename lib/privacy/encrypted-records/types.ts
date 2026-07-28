export interface EncryptedRecordEnvelope {
  vault_id: string
  record_id: string
  envelope_version: 1
  record_revision: number
  iv?: string
  ciphertext?: string
  sync_sequence: string
  deleted: boolean
}

export interface EncryptedRecordMutation {
  envelope: EncryptedRecordEnvelope
  idempotency_key: string
}

export interface EncryptedRecordSyncResponse {
  changes: EncryptedRecordEnvelope[]
  next_cursor: string
  has_more: boolean
}

export class EncryptedRecordClientError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
    this.name = "EncryptedRecordClientError"
  }
}
