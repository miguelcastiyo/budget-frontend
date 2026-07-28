import type { EncryptedRecordEnvelope, EncryptedRecordSyncResponse } from "./types"
import { EncryptedRecordClientError } from "./types"
import { decryptSyntheticRecord } from "./crypto"

export interface EncryptedRecordSyncApi {
  sync(after?: string, limit?: number): Promise<EncryptedRecordSyncResponse>
}

export class InMemoryEncryptedRecordSync {
  private cursor = "0"
  private readonly records = new Map<string, { envelope: EncryptedRecordEnvelope; plaintext: unknown }>()

  constructor(private readonly runtimeKey: CryptoKey, private readonly api: EncryptedRecordSyncApi) {}
  getCursor() { return this.cursor }
  get(recordId: string) { return this.records.get(recordId) }

  async pull(limit = 50): Promise<void> {
    let cursor = this.cursor
    let hasMore = true
    while (hasMore) {
      const batch = await this.api.sync(cursor, limit)
      for (const envelope of batch.changes) {
        const plaintext = envelope.deleted ? undefined : await decryptSyntheticRecord(this.runtimeKey, envelope)
        if (envelope.deleted) this.records.delete(envelope.record_id)
        else this.records.set(envelope.record_id, { envelope, plaintext })
      }
      cursor = batch.next_cursor
      this.cursor = cursor
      hasMore = batch.has_more
    }
  }
}
