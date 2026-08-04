import type { EncryptedRecordEnvelope } from "../encrypted-records/types"
import type { EncryptedRecordFamily, TypedEncryptedRecord } from "../encrypted-records/record-types"

export type DecryptedFinancialRecord = TypedEncryptedRecord

/** Decrypted records live only in this process. Nothing in this store is persisted. */
export class EncryptedRecordStore {
  private readonly records = new Map<string, DecryptedFinancialRecord>()
  private cursor = "0"

  getCursor() { return this.cursor }
  setCursor(cursor: string) { this.cursor = cursor }
  get(recordId: string) { return this.records.get(recordId) }
  getBySourceId(sourceId: string) { return [...this.records.values()].find((record) => record.sourceId === sourceId) }
  getByFamily(family: EncryptedRecordFamily) { return [...this.records.values()].filter((record) => record.family === family) }
  find(family: EncryptedRecordFamily, referenceId: string) { return [...this.records.values()].find((record) => record.family === family && (record.sourceId === referenceId || String(record.data.id ?? "") === referenceId)) }
  values() { return [...this.records.values()] }
  replace(record: DecryptedFinancialRecord) { this.records.set(record.envelope.record_id, record) }
  remove(recordId: string) { this.records.delete(recordId) }
  clear() { this.records.clear(); this.cursor = "0" }
}
