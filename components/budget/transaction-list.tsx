"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import Link from "next/link"
import type { ReactNode } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency, getCategoryColorClass } from "@/lib/formatters"
import { getTagIcon } from "@/lib/tag-icons"
import { cn } from "@/lib/utils"
import type { Transaction } from "@/lib/api/types"
import { ChevronRight, ChevronsDown, Tag, CreditCard } from "lucide-react"

interface TransactionListProps {
  transactions: Transaction[]
  title?: string
  showViewAll?: boolean
  onViewAll?: () => void
  viewAllPlacement?: "header" | "bottom"
  onTransactionClick?: (transaction: Transaction) => void
  readOnly?: boolean
  className?: string
  style?: CSSProperties
  compact?: boolean
  showMetadataChips?: boolean
  showScrollHint?: boolean
  headerRight?: ReactNode
  emptyTitle?: string
  emptyDescription?: string
  emptyActionLabel?: string
  onEmptyAction?: () => void
}

function formatDate(dateStr: string): string {
  const isoDateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const date = isoDateMatch
    ? new Date(Number(isoDateMatch[1]), Number(isoDateMatch[2]) - 1, Number(isoDateMatch[3]))
    : new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  
  if (date.toDateString() === today.toDateString()) {
    return "Today"
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday"
  }
  
  return date.toLocaleDateString("en-US", { 
    weekday: "short",
    month: "short", 
    day: "numeric" 
  })
}

// Group transactions by date
function groupByDate(transactions: Transaction[]): Map<string, Transaction[]> {
  const groups = new Map<string, Transaction[]>()
  
  transactions.forEach(transaction => {
    const dateKey = transaction.date
    if (!groups.has(dateKey)) {
      groups.set(dateKey, [])
    }
    groups.get(dateKey)!.push(transaction)
  })
  
  return groups
}

export function TransactionList({
  transactions,
  title,
  showViewAll = false,
  onViewAll,
  viewAllPlacement = "header",
  onTransactionClick,
  readOnly = false,
  className,
  style,
  compact = false,
  showMetadataChips = false,
  showScrollHint = false,
  headerRight,
  emptyTitle = "No transactions found",
  emptyDescription = "Add a transaction to start tracking your spending.",
  emptyActionLabel = "Add Transaction",
  onEmptyAction,
}: TransactionListProps) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const [canScrollDown, setCanScrollDown] = useState(false)
  const isInteractive = !readOnly && Boolean(onTransactionClick)
  const useInlineCompactMetadata = compact && !showMetadataChips
  const groupedTransactions = groupByDate(transactions)
  const showViewAllInHeader = showViewAll && viewAllPlacement === "header"
  const showViewAllInBottom = showViewAll && viewAllPlacement === "bottom"

  useEffect(() => {
    if (!showScrollHint) {
      setCanScrollDown(false)
      return
    }

    const node = listRef.current
    if (!node) {
      return
    }

    const updateScrollState = () => {
      const overflow = node.scrollHeight > node.clientHeight + 1
      const canScrollFurtherDown = node.scrollTop + node.clientHeight < node.scrollHeight - 1
      setCanScrollDown(overflow && canScrollFurtherDown)
    }

    updateScrollState()

    node.addEventListener("scroll", updateScrollState)
    const observer = new ResizeObserver(updateScrollState)
    observer.observe(node)
    window.addEventListener("resize", updateScrollState)

    return () => {
      node.removeEventListener("scroll", updateScrollState)
      observer.disconnect()
      window.removeEventListener("resize", updateScrollState)
    }
  }, [transactions.length, showScrollHint])

  const handleScrollHintClick = () => {
    const node = listRef.current
    if (!node) {
      return
    }

    const firstRow = node.querySelector("[data-transaction-row='true']")
    const rowHeight = firstRow instanceof HTMLElement ? firstRow.getBoundingClientRect().height : 72

    node.scrollBy({
      top: rowHeight * 3,
      behavior: "smooth",
    })
  }

  const viewAllControl = onViewAll ? (
    <button
      type="button"
      onClick={onViewAll}
      className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
    >
      See All
    </button>
  ) : (
    <Link
      href="/transactions"
      className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
    >
      See All
    </Link>
  )

  if (transactions.length === 0) {
    return (
      <Card className="p-8 border-0 shadow-sm text-center">
        <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
        <p className="mt-1 text-sm text-muted-foreground">{emptyDescription}</p>
        {onEmptyAction && (
          <Button
            type="button"
            size="sm"
            onClick={onEmptyAction}
            className="mt-4 rounded-full px-4"
          >
            {emptyActionLabel}
          </Button>
        )}
      </Card>
    )
  }

  return (
    <Card
      className={cn("overflow-hidden border-0 shadow-sm flex flex-col", className)}
      style={style}
    >
      {title && (
        <div className={cn("px-5 flex items-center justify-between border-b border-border/50", compact ? "py-2" : "py-3")}>
          <h3 className="font-semibold text-base">{title}</h3>
          <div className="flex items-center gap-2">
            {headerRight}
            {showViewAllInHeader && viewAllControl}
          </div>
        </div>
      )}
      
      <div className="relative flex-1 min-h-0">
        <div ref={listRef} className="h-full overflow-y-auto px-2 pb-2 sm:px-0 sm:pb-0">
          {Array.from(groupedTransactions.entries()).map(([date, txns]) => (
            <div key={date}>
              <div
                className={cn(
                  "px-2 pt-3 pb-2 sm:px-4 sm:bg-secondary/40",
                  compact && "sm:py-1",
                  !compact && "sm:py-2"
                )}
              >
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.18em]">
                  {formatDate(date)}
                </span>
              </div>
              <div className="space-y-2 sm:space-y-0 sm:divide-y sm:divide-border/50">
                {txns.map((transaction) => {
                  const TagIcon = getTagIcon(transaction.tag.name, transaction.tag.icon_key)

                  return isInteractive ? (
                    <button
                      key={transaction.id}
                      data-transaction-row="true"
                      onClick={() => onTransactionClick?.(transaction)}
                      className={cn(
                        "w-full text-left transition-colors sm:flex sm:items-center sm:gap-3 sm:hover:bg-accent/50",
                        "rounded-2xl border border-border/70 bg-background px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-border hover:bg-accent/30",
                        "sm:rounded-none sm:border-0 sm:bg-transparent sm:px-3 sm:py-3 sm:shadow-none",
                        compact ? "sm:p-2" : undefined
                      )}
                    >
                      <div className="flex items-start gap-3 sm:flex-1 sm:items-center">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${getCategoryColorClass(transaction.category)} shadow-sm sm:h-9 sm:w-9 sm:rounded-xl`}>
                          <TagIcon className="h-4 w-4 text-white" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <p className="truncate text-sm font-semibold">{transaction.expense}</p>
                                {transaction.is_split && (
                                  <span className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                    Split
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 truncate text-xs text-muted-foreground sm:hidden">
                                {transaction.tag.name}
                                {transaction.card && ` · ${transaction.card.name}`}
                              </p>
                              {useInlineCompactMetadata ? (
                                <p className="hidden truncate text-xs text-muted-foreground sm:block">
                                  {transaction.tag.name}
                                  {transaction.card && ` · ${transaction.card.name}`}
                                </p>
                              ) : (
                                <div className="mt-1 hidden flex-wrap items-center gap-1.5 sm:flex">
                                  <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/70 bg-secondary/50 px-2 py-0.5 text-[10px] font-medium text-foreground">
                                    <Tag className="w-3 h-3 text-muted-foreground shrink-0" />
                                    <span className="truncate max-w-[170px]">{transaction.tag.name}</span>
                                  </span>
                                  {transaction.card && (
                                    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/70 bg-background px-2 py-0.5 text-[10px] font-medium text-foreground">
                                      <CreditCard className="w-3 h-3 text-muted-foreground shrink-0" />
                                      <span className="truncate max-w-[170px]">{transaction.card.name}</span>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="shrink-0 text-right sm:hidden">
                              <p className="text-[15px] font-semibold whitespace-nowrap">
                                -{formatCurrency(transaction.amount)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="hidden shrink-0 text-right sm:block sm:ml-2">
                        <p className="font-semibold text-sm whitespace-nowrap">
                          -{formatCurrency(transaction.amount)}
                        </p>
                      </div>

                      <ChevronRight className="hidden w-4 h-4 text-muted-foreground/40 flex-shrink-0 sm:block" />
                    </button>
                  ) : (
                    <div
                      key={transaction.id}
                      data-transaction-row="true"
                      className={cn(
                        "w-full text-left sm:flex sm:items-center sm:gap-3",
                        "rounded-2xl border border-border/70 bg-background px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]",
                        "sm:rounded-none sm:border-0 sm:bg-transparent sm:px-3 sm:py-3 sm:shadow-none",
                        compact ? "sm:p-2" : undefined
                      )}
                    >
                      <div className="flex items-start gap-3 sm:flex-1 sm:items-center">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${getCategoryColorClass(transaction.category)} shadow-sm sm:h-9 sm:w-9 sm:rounded-xl`}>
                          <TagIcon className="h-4 w-4 text-white" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <p className="truncate text-sm font-semibold">{transaction.expense}</p>
                                {transaction.is_split && (
                                  <span className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                    Split
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 truncate text-xs text-muted-foreground sm:hidden">
                                {transaction.tag.name}
                                {transaction.card && ` · ${transaction.card.name}`}
                              </p>
                              {useInlineCompactMetadata ? (
                                <p className="hidden truncate text-xs text-muted-foreground sm:block">
                                  {transaction.tag.name}
                                  {transaction.card && ` · ${transaction.card.name}`}
                                </p>
                              ) : (
                                <div className="mt-1 hidden flex-wrap items-center gap-1.5 sm:flex">
                                  <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/70 bg-secondary/50 px-2 py-0.5 text-[10px] font-medium text-foreground">
                                    <Tag className="w-3 h-3 text-muted-foreground shrink-0" />
                                    <span className="truncate max-w-[170px]">{transaction.tag.name}</span>
                                  </span>
                                  {transaction.card && (
                                    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/70 bg-background px-2 py-0.5 text-[10px] font-medium text-foreground">
                                      <CreditCard className="w-3 h-3 text-muted-foreground shrink-0" />
                                      <span className="truncate max-w-[170px]">{transaction.card.name}</span>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="shrink-0 text-right sm:hidden">
                              <p className="text-[15px] font-semibold whitespace-nowrap">
                                -{formatCurrency(transaction.amount)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="hidden shrink-0 text-right sm:block sm:ml-2">
                        <p className="font-semibold text-sm whitespace-nowrap">
                          -{formatCurrency(transaction.amount)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        {showScrollHint && canScrollDown && (
          <button
            type="button"
            onClick={handleScrollHintClick}
            aria-label="Scroll to more recent transactions"
            className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background via-background/90 to-transparent flex items-end justify-center pb-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronsDown className="w-4 h-4 animate-pulse" />
          </button>
        )}
      </div>
      {showViewAllInBottom && (
        <div className="p-4 border-t border-border/50 flex justify-end">
          {viewAllControl}
        </div>
      )}
    </Card>
  )
}
