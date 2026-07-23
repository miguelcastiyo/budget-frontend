"use client"

import { Card } from "@/components/ui/card"
import { formatCurrency } from "@/lib/formatters"

interface TransactionStatsGridProps {
  totalSpent: number
  count: number
  avgTransaction: number
  splitCount: number
  compact?: boolean
}

function TransactionSummaryMetric({ label, value, primary = false }: { label: string; value: string; primary?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 whitespace-nowrap text-lg tracking-tight sm:text-xl ${primary ? "font-bold" : "font-semibold"}`}>
        {value}
      </p>
    </div>
  )
}

export function TransactionStatsGrid({
  totalSpent,
  count,
  avgTransaction,
  splitCount,
  compact = false,
}: TransactionStatsGridProps) {
  void count
  void splitCount
  return (
    <Card className={`${compact ? "p-4" : "p-5"} col-span-full border-0 shadow-sm`}>
      <div className="grid grid-cols-2 gap-3 sm:gap-8">
        <TransactionSummaryMetric label="Total Spent" value={formatCurrency(totalSpent)} primary />
        <TransactionSummaryMetric label="Average Transaction" value={formatCurrency(avgTransaction)} />
      </div>
    </Card>
  )
}
