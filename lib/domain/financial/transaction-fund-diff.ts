export interface SourceRecord { id: string; family: string; data: Record<string, unknown> }
export interface TransactionFundState { transaction: SourceRecord; fundEntry: SourceRecord | null }
export interface SourceMutationDiff { creates: SourceRecord[]; updates: SourceRecord[]; tombstones: SourceRecord[] }

function equalData(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()
  return keys.every((key) => JSON.stringify(left[key] ?? null) === JSON.stringify(right[key] ?? null))
}

/** Pure source-of-truth diff for a Transaction and its optional Fund ledger effect. */
export function transactionFundDiff(previous: TransactionFundState | null, next: TransactionFundState | null): SourceMutationDiff {
  const previousRecords = new Map<string, SourceRecord>()
  const nextRecords = new Map<string, SourceRecord>()
  if (previous) { previousRecords.set(previous.transaction.id, previous.transaction); if (previous.fundEntry) previousRecords.set(previous.fundEntry.id, previous.fundEntry) }
  if (next) { nextRecords.set(next.transaction.id, next.transaction); if (next.fundEntry) nextRecords.set(next.fundEntry.id, next.fundEntry) }
  const creates: SourceRecord[] = []; const updates: SourceRecord[] = []; const tombstones: SourceRecord[] = []
  for (const [id, record] of [...nextRecords.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const prior = previousRecords.get(id)
    if (!prior) creates.push(record)
    else if (record.family === "transaction" && record.data.is_deleted === true) tombstones.push(prior)
    else if (!equalData(prior.data, record.data)) updates.push(record)
  }
  for (const [id, record] of [...previousRecords.entries()].sort(([a], [b]) => a.localeCompare(b))) if (!nextRecords.has(id)) tombstones.push(record)
  return { creates, updates, tombstones }
}

export function transactionFundState(transaction: SourceRecord, fundEntry: SourceRecord | null = null): TransactionFundState { return { transaction, fundEntry } }
