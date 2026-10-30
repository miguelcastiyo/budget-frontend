"use client"

import type { ReactNode } from "react"
import type { Transaction } from "@/lib/api/types"
import { formatRelativeDateValue } from "@/lib/date-filters"
import { formatCurrency, formatCategory } from "@/lib/formatters"
import { getTagIcon } from "@/lib/tag-icons"
import styles from "./v2-activity.module.css"

interface Props {
  transactions: Transaction[]
  title: string
  loading: boolean
  emptyTitle: string
  emptyDescription: string
  emptyActionLabel: string
  onEmptyAction: () => void
  onTransactionClick: (transaction: Transaction) => void
  headerRight: ReactNode
}

export function V2Activity({ transactions, title, loading, emptyTitle, emptyDescription, emptyActionLabel, onEmptyAction, onTransactionClick, headerRight }: Props) {
  const groups = new Map<string, Transaction[]>()
  for (const transaction of transactions) {
    const group = groups.get(transaction.date) ?? []
    group.push(transaction)
    groups.set(transaction.date, group)
  }

  return (
    <section aria-label="Activity transactions" className={styles.ledger}>
      <div className={styles.listHeading}><h2>{title}</h2>{headerRight}</div>
      {loading && transactions.length === 0 ? <p className={styles.empty} role="status">Loading transactions…</p> : transactions.length === 0 ? (
        <div className={styles.empty}><p>{emptyTitle}</p><p>{emptyDescription}</p><button type="button" onClick={onEmptyAction}>{emptyActionLabel}</button></div>
      ) : Array.from(groups, ([date, items]) => (
        <div className={styles.group} key={date}>
          <h3 className={styles.date}>{formatRelativeDateValue(date)}</h3>
          {items.map((transaction) => {
            const Icon = getTagIcon(transaction.tag.name, transaction.tag.icon_key)
            const metadata = [transaction.tag.name, transaction.context?.name, transaction.card?.name, transaction.is_split ? "Split" : null, transaction.notes ? "Notes" : null, transaction.is_projected ? "Projected recurring" : transaction.recurring_expense_id ? "Recurring" : null].filter(Boolean).join(" · ")
            return <button type="button" key={transaction.id} data-transaction-row="true" className={styles.row} onClick={() => onTransactionClick(transaction)}>
              <span className={`${styles.icon} ${styles[transaction.category]}`}><Icon aria-hidden="true" /></span>
              <span className={styles.description}><span>{transaction.expense}</span><small>{metadata}</small></span>
              <span className={styles.category}>{formatCategory(transaction.category)}</span>
              <span className={styles.amount}>−{formatCurrency(transaction.amount)}</span>
            </button>
          })}
        </div>
      ))}
    </section>
  )
}
