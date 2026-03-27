"use client"

import { Card } from "@/components/ui/card"
import { formatCurrency } from "@/lib/formatters"
import type { CategoryMetricsResponse } from "@/lib/api/types"

interface SpendingSummaryProps {
  metrics: CategoryMetricsResponse
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0
}

export function SpendingSummary({ metrics }: SpendingSummaryProps) {
  const totalSpent = metrics.categories.reduce(
    (sum, cat) => sum + safeNumber(parseFloat(cat.actual_spend)),
    0
  )
  const totalBudget = metrics.categories.reduce(
    (sum, cat) => sum + safeNumber(parseFloat(cat.budget_amount)),
    0
  )
  const safeTotalBudget = totalBudget > 0 ? totalBudget : 1
  const spentLabel = formatCurrency(totalSpent)
  const budgetLabel = formatCurrency(totalBudget)
  const spentTextClass =
    spentLabel.length >= 10
      ? "text-[1.9rem] sm:text-[2.15rem]"
      : spentLabel.length >= 9
        ? "text-[2.1rem] sm:text-[2.35rem]"
        : "text-[2.3rem] sm:text-[2.6rem]"
  const ringSize = 220
  const strokeWidth = 14
  const radius = (ringSize - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <Card className="p-6 border-0 shadow-sm">
      <div className="text-center">
        <div className="relative inline-flex items-center justify-center">
          {/* Large progress ring */}
          <svg
            viewBox={`0 0 ${ringSize} ${ringSize}`}
            className="w-[190px] h-[190px] sm:w-[220px] sm:h-[220px] transform -rotate-90"
          >
            {/* Background track */}
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-muted opacity-20"
            />
            {/* Progress segments for each category */}
            {(() => {
              let currentOffset = 0
              
              return metrics.categories.map((cat, index) => {
                const catSpend = safeNumber(parseFloat(cat.actual_spend))
                const catPercentage = (catSpend / safeTotalBudget) * 100
                const dashLength = (catPercentage / 100) * circumference
                const offset = circumference - currentOffset
                currentOffset += dashLength
                
                const colors = {
                  needs: "var(--needs)",
                  wants: "var(--wants)",
                  savings_debts: "var(--savings)",
                }
                
                return (
                  <circle
                    key={cat.category}
                    cx={ringSize / 2}
                    cy={ringSize / 2}
                    r={radius}
                    fill="none"
                    stroke={colors[cat.category]}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                    strokeDashoffset={offset}
                    className="transition-all duration-700 ease-out"
                    style={{ animationDelay: `${index * 100}ms` }}
                  />
                )
              })
            })()}
          </svg>
          
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Spent</span>
            <span className={`max-w-[168px] sm:max-w-[188px] mt-1 ${spentTextClass} font-bold tracking-tight leading-none tabular-nums whitespace-nowrap`}>
              {spentLabel}
            </span>
            <span className="mt-1 text-base text-muted-foreground leading-none tabular-nums whitespace-nowrap">
              of {budgetLabel}
            </span>
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-center gap-5 mt-6">
          {metrics.categories.map((cat) => {
            const colorClasses = {
              needs: "bg-needs",
              wants: "bg-wants",
              savings_debts: "bg-savings",
            }
            const labels = {
              needs: "Needs",
              wants: "Wants",
              savings_debts: "Savings",
            }
            
            return (
              <div key={cat.category} className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${colorClasses[cat.category]}`} />
                <span className="text-xs text-muted-foreground font-medium">{labels[cat.category]}</span>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
