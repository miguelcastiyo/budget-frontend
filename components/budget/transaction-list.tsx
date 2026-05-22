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
      className="cursor-pointer text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
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
        <div ref={listRef} className="h-full overflow-y-auto">
          {Array.from(groupedTransactions.entries()).map(([date, txns]) => (
            <div key={date}>
              <div className={cn("px-4 bg-secondary/40", compact ? "py-1" : "py-2")}>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {formatDate(date)}
                </span>
              </div>
              <div className="divide-y divide-border/50">
                {txns.map((transaction) => {
                  const TagIcon = getTagIcon(transaction.tag.name, transaction.tag.icon_key)

                  return isInteractive ? (
                    <button
                      key={transaction.id}
                      data-transaction-row="true"
                      onClick={() => onTransactionClick?.(transaction)}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-3 text-left transition-colors hover:bg-accent/50",
                        compact ? "p-2" : "p-3"
                      )}
                    >
                      <div className={`w-9 h-9 rounded-xl ${getCategoryColorClass(transaction.category)} flex items-center justify-center flex-shrink-0`}>
                        <TagIcon className="w-4 h-4 text-white" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-medium text-sm truncate">{transaction.expense}</p>
                          {transaction.is_split && (
                            <span className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                              Split
                            </span>
                          )}
                        </div>
                        {useInlineCompactMetadata ? (
                          <p className="text-xs text-muted-foreground truncate">
                            {transaction.tag.name}
                            {transaction.card && ` · ${transaction.card.name}`}
                          </p>
                        ) : (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
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
                      
                      <div className="text-right shrink-0 ml-2">
                        <p className="font-semibold text-sm whitespace-nowrap">
                          -{formatCurrency(transaction.amount)}
                        </p>
                      </div>
                      
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                    </button>
                  ) : (
                    <div
                      key={transaction.id}
                      data-transaction-row="true"
                      className={cn("w-full flex items-center gap-3 text-left", compact ? "p-2" : "p-3")}
                    >
                      <div className={`w-9 h-9 rounded-xl ${getCategoryColorClass(transaction.category)} flex items-center justify-center flex-shrink-0`}>
                        <TagIcon className="w-4 h-4 text-white" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-medium text-sm truncate">{transaction.expense}</p>
                          {transaction.is_split && (
                            <span className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                              Split
                            </span>
                          )}
                        </div>
                        {useInlineCompactMetadata ? (
                          <p className="text-xs text-muted-foreground truncate">
                            {transaction.tag.name}
                            {transaction.card && ` · ${transaction.card.name}`}
                          </p>
                        ) : (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
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

                      <div className="text-right shrink-0 ml-2">
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
            className="absolute inset-x-0 bottom-0 flex h-12 cursor-pointer items-end justify-center bg-gradient-to-t from-background via-background/90 to-transparent pb-1 text-muted-foreground transition-colors hover:text-foreground"
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
