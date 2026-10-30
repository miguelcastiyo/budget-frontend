"use client"

import Link from "next/link"
import { ChevronLeft, ChevronRight, Receipt } from "lucide-react"
import { MonthCloseoutBackFace, getMonthCardFlipHint } from "./month-closeout-back-face"
import { formatCurrency, formatCategory } from "@/lib/formatters"
import { parseDisplayMoney } from "@/lib/domain/financial/money"
import { compareMonthKeys, formatMonthLabel, formatRelativeDateValue, getCurrentMonthKey, getNextMonthKey, getPreviousMonthKey } from "@/lib/date-filters"
import type { MonthCloseoutResponse, MonthOverviewResponse, Transaction } from "@/lib/api/types"
import type { PendingMonthSummary } from "@/lib/privacy/encrypted-authority/pending-summary"
import styles from "./v2-overview.module.css"

type Props = {
  month: string
  onMonthChange: (month: string) => void
  overview: MonthOverviewResponse | null
  closeout: MonthCloseoutResponse | null
  closeoutLoading: boolean
  loading: boolean
  pending: PendingMonthSummary | null
  onClose: () => void
  onViewCloseout: () => void
  onReviewCloseout: () => void
  onSetBudget: () => void
  onTransaction: (transaction: Transaction) => void
  onViewAll: () => void
}

export function V2Overview({ month, onMonthChange, overview, closeout, closeoutLoading, loading, pending, onClose, onViewCloseout, onReviewCloseout, onSetBudget, onTransaction, onViewAll }: Props) {
  const hasBudget = Boolean(overview?.budget.has_budget)
  const left = overview?.summary.left_this_month == null ? null : parseDisplayMoney(overview.summary.left_this_month)
  const totalBudget = overview?.summary.total_budget == null ? null : parseDisplayMoney(overview.summary.total_budget)
  const spent = overview?.summary.total_spent == null ? null : parseDisplayMoney(overview.summary.total_spent)
  const categories = overview?.categories ?? []
  const nextMonth = getNextMonthKey(month)
  const canNext = compareMonthKeys(nextMonth, getCurrentMonthKey()) <= 0
  const hint = getMonthCardFlipHint({ month, overview, closeout })
  const grouped = new Map<string, Transaction[]>()
  for (const transaction of overview?.recent_transactions ?? []) {
    const group = grouped.get(transaction.date) ?? []
    group.push(transaction)
    grouped.set(transaction.date, group)
  }

  return <div className={styles.root} data-testid="v2-overview">
    <header className={styles.heading}>
      <div className={styles.month}>
        <button type="button" aria-label="Previous month" onClick={() => onMonthChange(getPreviousMonthKey(month))}><ChevronLeft size={18} /></button>
        <h1>{formatMonthLabel(month) ?? month}</h1>
        <button type="button" aria-label="Next month" disabled={!canNext} onClick={() => onMonthChange(nextMonth)}><ChevronRight size={18} /></button>
      </div>
      {closeout?.status === "closed" && <span className={styles.muted}>Closed</span>}
    </header>
    {loading && <p role="status" className={styles.muted}>Loading {formatMonthLabel(month) ?? month}...</p>}

    <div className={styles.grid}>
      <div className={styles.column}>
        <section aria-label="Month summary">
          <p className={styles.muted}>{left != null && left < 0 ? "Over budget" : "Left to spend"}</p>
          {!overview ? <p className={styles.noBudget}>Summary unavailable.</p> : hasBudget && left != null ? <p className={`${styles.total} ${left < 0 ? styles.over : ""}`}>{formatCurrency(Math.abs(left))}</p> : !hasBudget ? <div className={styles.noBudget}><p>Set a budget to see what is left.</p><button type="button" onClick={onSetBudget}>Set budget</button></div> : <p className={styles.noBudget}>Amount left unavailable.</p>}
          {hasBudget && totalBudget != null && spent != null && <>
            <div className={styles.overallTrack} role="img" aria-label={`${formatCurrency(spent)} spent of ${formatCurrency(totalBudget)}`}>
              {categories.map(category => {
                const amount = Math.max(0, parseDisplayMoney(category.actual_spend))
                const width = totalBudget > 0 ? Math.min(100, amount / totalBudget * 100) : 0
                return <span key={category.category} className={styles[category.category]} style={{ width: `${width}%` }} />
              })}
            </div>
            <p className={styles.summaryLine}><span>{formatCurrency(spent)} of {formatCurrency(totalBudget)}</span>{overview?.month_progress.status === "current" && <span>{overview.month_progress.days_remaining} days left</span>}</p>
          </>}
        </section>
        <section aria-label="Categories" className={styles.categories}>
          {categories.map(category => {
            const amount = parseDisplayMoney(category.actual_spend)
            const target = parseDisplayMoney(category.budget_amount)
            const remaining = parseDisplayMoney(category.remaining_amount)
            const percent = target > 0 ? Math.max(0, Math.min(100, amount / target * 100)) : 0
            return <div key={category.category} className={styles.category}>
              <span className={styles.categoryTop}><span><i className={styles[category.category]} />{formatCategory(category.category)}</span><span className={remaining < 0 && category.category !== "savings" ? styles.over : ""}>{hasBudget ? category.category === "savings" ? remaining > 0 ? `${formatCurrency(remaining)} to go` : "Done" : remaining < 0 ? `${formatCurrency(Math.abs(remaining))} over` : `${formatCurrency(remaining)} left` : "No budget"}</span></span>
              <span className={styles.categoryAmount}>{formatCurrency(amount)}{hasBudget ? ` of ${formatCurrency(target)}` : " spent"}</span>
              <span className={styles.track} role="progressbar" aria-label={`${formatCategory(category.category)} spent`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} aria-valuetext={`${formatCurrency(amount)} spent${hasBudget ? ` of ${formatCurrency(target)}` : "; no budget"}`}><span className={remaining < 0 && category.category !== "savings" ? styles.overBar : styles[category.category]} style={{ width: `${percent}%` }} /></span>
            </div>
          })}
        </section>
        {pending && pending.count > 0 && <section className={styles.links} aria-label="Month actions">
          <Link href="/review"><span>Review</span><span>{pending.count} to sort</span><ChevronRight size={16} /></Link>
        </section>}
        {(hasBudget || closeout) && <details className={styles.closeout}>
          <summary>{closeoutLoading ? "Loading month status..." : hint?.label ?? "Month details"}<ChevronRight size={16} /></summary>
          <MonthCloseoutBackFace overview={overview} closeout={closeout} isLoading={closeoutLoading} onCloseMonth={onClose} onViewCloseout={onViewCloseout} onReviewCloseout={onReviewCloseout} onSetBudget={onSetBudget} />
        </details>}
      </div>
      <div className={styles.column}>
        <section aria-label="Recent transactions">
          <div className={styles.sectionHeading}><h2>Recent</h2><button type="button" onClick={onViewAll}>See all</button></div>
          {grouped.size === 0 ? <div className={styles.empty}><p>No transactions this month.</p></div> : [...grouped].map(([date, transactions]) => <div key={date} className={styles.group}>
            <p className={styles.date}>{formatRelativeDateValue(date)}</p>
            {transactions.map(transaction => <button type="button" key={transaction.id} className={styles.transaction} onClick={() => onTransaction(transaction)}>
              <Receipt className={styles.transactionIcon} size={18} strokeWidth={1.5} aria-hidden="true" />
              <span className={styles.transactionText}><span>{transaction.expense}</span><small>{[transaction.tag?.name, transaction.context?.name].filter(Boolean).join(" · ")}</small></span>
              <span>{formatCurrency(transaction.amount)}</span>
            </button>)}
          </div>)}
        </section>
      </div>
    </div>
  </div>
}
