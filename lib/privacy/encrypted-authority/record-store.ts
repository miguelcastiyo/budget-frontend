import type { EncryptedRecordEnvelope } from "../encrypted-records/types"

export interface DecryptedFinancialRecord {
  envelope: EncryptedRecordEnvelope
  family: string
  schemaVersion: string
  sourceId: string
  data: Record<string, unknown>
}

/** Decrypted records live only in this process. Nothing in this store is persisted. */
export class EncryptedRecordStore {
  private readonly records = new Map<string, DecryptedFinancialRecord>()
  private cursor = "0"

  getCursor() { return this.cursor }
  setCursor(cursor: string) { this.cursor = cursor }
  get(recordId: string) { return this.records.get(recordId) }
  values() { return [...this.records.values()] }
  replace(record: DecryptedFinancialRecord) { this.records.set(record.envelope.record_id, record) }
  remove(recordId: string) { this.records.delete(recordId) }
  clear() { this.records.clear(); this.cursor = "0" }
}
