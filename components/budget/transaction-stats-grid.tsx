"use client"

import { TrendingDown, Receipt, Users } from "lucide-react"
import { Card } from "@/components/ui/card"
import { formatCurrency } from "@/lib/formatters"

interface TransactionStatsGridProps {
  totalSpent: number
  count: number
  avgTransaction: number
  splitCount: number
  compact?: boolean
}

export function TransactionStatsGrid({
  totalSpent,
  count,
  avgTransaction,
  splitCount,
  compact = false,
}: TransactionStatsGridProps) {
  const iconSize = compact ? "w-4 h-4" : "w-5 h-5"
  const iconWrapper = compact ? "w-8 h-8 rounded-lg" : "w-10 h-10 rounded-xl"
  const valueSize = compact ? "text-sm" : "text-base lg:text-lg"
  const items = [
    {
      label: "Total Spent",
      value: formatCurrency(totalSpent),
      icon: <TrendingDown className={`${iconSize} text-needs`} />,
      iconClassName: `${iconWrapper} bg-needs/10`,
      truncate: true,
    },
    {
      label: "Transactions",
      value: String(count),
      icon: <Receipt className={`${iconSize} text-wants`} />,
      iconClassName: `${iconWrapper} bg-wants/10`,
      truncate: false,
    },
    {
      label: "Average",
      value: formatCurrency(avgTransaction),
      icon: <TrendingDown className={`${iconSize} text-savings`} />,
      iconClassName: `${iconWrapper} bg-savings/10`,
      truncate: true,
    },
    {
      label: "Split Transactions",
      value: String(splitCount),
      icon: <Users className={`${iconSize} text-primary`} />,
      iconClassName: `${iconWrapper} bg-primary/10`,
      truncate: false,
    },
  ]

  return (
    <>
      {items.map((item) => (
        <Card key={item.label} className={`${compact ? "p-3" : "p-4"} border-0 shadow-sm`}>
          <div className="flex items-center gap-3">
            <div className={`${item.iconClassName} flex items-center justify-center shrink-0`}>
              {item.icon}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className={`${valueSize} font-semibold ${item.truncate ? "truncate" : ""}`}>{item.value}</p>
            </div>
          </div>
        </Card>
      ))}
    </>
  )
}
