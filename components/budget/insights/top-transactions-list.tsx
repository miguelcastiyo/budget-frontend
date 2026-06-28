"use client"

import { format } from "date-fns"
import { parseIsoDate } from "@/lib/date-filters"
import { formatCategory, formatCurrency } from "@/lib/formatters"
import { TransactionPresenceIndicators } from "@/components/budget/transaction-presence-indicators"
import type { InsightsLargestTransactionItem } from "@/lib/api/types"
import { cn } from "@/lib/utils"

interface TopTransactionsListProps {
  items: InsightsLargestTransactionItem[]
  compact?: boolean
  limit?: number
}

export function TopTransactionsList({
  items,
  compact = false,
  limit,
}: TopTransactionsListProps) {
  const visibleItems = limit ? items.slice(0, limit) : items

  return (
    <div className="divide-y divide-border/60">
      {visibleItems.map((item) => (
        <div key={item.transaction_id} className={cn("flex items-start justify-between gap-3", compact ? "py-2" : "py-3")}>
          <div className="min-w-0">
            <p className={cn("font-medium truncate", compact ? "text-xs" : "text-sm")}>{item.expense}</p>
            <div className={cn("mt-0.5 flex items-center gap-2 text-muted-foreground", compact ? "text-[11px]" : "text-xs")}>
              <p className="truncate">
                {formatCategory(item.category)} · {item.tag.name}
              </p>
              <TransactionPresenceIndicators
                hasCard={Boolean(item.card_name)}
                hasNotes={Boolean(item.notes)}
              />
            </div>
            <p className={cn("text-muted-foreground mt-0.5", compact ? "text-[10px]" : "text-xs")}>
              {format(parseIsoDate(item.date) ?? new Date(item.date), "MMM d, yyyy")}
            </p>
          </div>
          <p className={cn("font-semibold shrink-0", compact ? "text-xs" : "text-sm")}>{formatCurrency(item.amount)}</p>
        </div>
      ))}
    </div>
  )
}
