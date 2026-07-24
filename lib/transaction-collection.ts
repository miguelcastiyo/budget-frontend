import type { Transaction } from "@/lib/api/types"

export function replaceTransaction(transactions: Transaction[], updated: Transaction): Transaction[] {
  return transactions.map((transaction) => transaction.id === updated.id ? updated : transaction)
}

export function mergeTransactionPages(pages: Transaction[][]): Transaction[] {
  const byId = new Map<string, Transaction>()

  pages.flat().forEach((transaction) => {
    if (!byId.has(transaction.id)) {
      byId.set(transaction.id, transaction)
    }
  })

  return [...byId.values()]
}
