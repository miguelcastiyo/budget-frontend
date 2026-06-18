"use client"

import { useState } from "react"
import { RotateCw } from "lucide-react"
import { Card } from "@/components/ui/card"
import { formatCurrency } from "@/lib/formatters"
import type { MonthCloseoutResponse, MonthOverviewCategoryItem, MonthOverviewResponse } from "@/lib/api/types"
import { MonthCloseoutBackFace, getMonthCardAriaLabel, getMonthCardFlipHint } from "@/components/budget/month-closeout-back-face"

interface SpendingSummaryProps {
  categories: MonthOverviewCategoryItem[]
  overview?: MonthOverviewResponse | null
  closeout?: MonthCloseoutResponse | null
  isCloseoutLoading?: boolean
  onCloseMonth?: () => void
  onViewCloseout?: () => void
  onReviewCloseout?: () => void
  onSetBudget?: () => void
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0
}

export function SpendingSummary({
  categories,
  overview = null,
  closeout = null,
  isCloseoutLoading = false,
  onCloseMonth,
  onViewCloseout,
  onReviewCloseout,
  onSetBudget,
}: SpendingSummaryProps) {
  const [isFlipped, setIsFlipped] = useState(false)
  const totalSpent = categories.reduce(
    (sum, cat) => sum + safeNumber(parseFloat(cat.actual_spend)),
    0
  )
  const totalBudget = categories.reduce(
    (sum, cat) => sum + safeNumber(parseFloat(cat.budget_amount)),
    0
  )
  const safeTotalBudget = totalBudget > 0 ? totalBudget : 1
  const spentLabel = formatCurrency(totalSpent)
  const budgetLabel = formatCurrency(totalBudget)
  const spentTextClass =
    spentLabel.length >= 10
      ? "text-[1.65rem] sm:text-[2.15rem]"
      : spentLabel.length >= 9
        ? "text-[1.85rem] sm:text-[2.35rem]"
        : "text-[2.05rem] sm:text-[2.6rem]"
  const ringSize = 220
  const strokeWidth = 14
  const radius = (ringSize - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const frontHint = getMonthCardFlipHint({
    month: overview?.month ?? closeout?.month,
    overview,
    closeout,
  })

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={getMonthCardAriaLabel({
        month: overview?.month ?? closeout?.month,
        closeout,
        isFlipped,
      })}
      aria-pressed={isFlipped}
      className="group block w-full cursor-pointer appearance-none rounded-xl border-0 bg-transparent p-0 text-left text-current [perspective:1400px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      onClick={() => setIsFlipped((current) => !current)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          setIsFlipped((current) => !current)
        }
      }}
    >
      <div
        className={`relative transition-transform duration-500 ease-out [transform-style:preserve-3d] group-active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none ${
          isFlipped ? "motion-reduce:[transform:none] [transform:rotateY(180deg)]" : ""
        }`}
      >
        <Card className="min-h-[312px] p-6 border-0 shadow-sm transition-all duration-200 [backface-visibility:hidden] group-hover:shadow-lg">
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

                  return categories.map((cat, index) => {
                    const catSpend = safeNumber(parseFloat(cat.actual_spend))
                    const catBudget = safeNumber(parseFloat(cat.budget_amount))
                    const catPercentage = (catSpend / safeTotalBudget) * 100
                    const dashLength = (catPercentage / 100) * circumference
                    const offset = circumference - currentOffset
                    currentOffset += dashLength
                    const isCategoryOverBudget = catBudget > 0 && catSpend > catBudget

                    const colors = {
                      needs: "var(--needs)",
                      wants: "var(--wants)",
                      savings: "var(--savings)",
                    }

                    return (
                      <circle
                        key={cat.category}
                        cx={ringSize / 2}
                        cy={ringSize / 2}
                        r={radius}
                        fill="none"
                        stroke={isCategoryOverBudget ? "var(--destructive)" : colors[cat.category]}
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
              <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Spent</span>
                <span className={`max-w-[156px] sm:max-w-[188px] mt-1 ${spentTextClass} font-bold tracking-tight leading-none tabular-nums whitespace-nowrap`}>
                  {spentLabel}
                </span>
                <span className="mt-1 text-[0.95rem] sm:text-base text-muted-foreground leading-none tabular-nums whitespace-nowrap">
                  of {budgetLabel}
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-5 mt-6">
              {categories.map((cat) => {
                const catSpend = safeNumber(parseFloat(cat.actual_spend))
                const catBudget = safeNumber(parseFloat(cat.budget_amount))
                const isCategoryOverBudget = catBudget > 0 && catSpend > catBudget
                const colorClasses = {
                  needs: "bg-needs",
                  wants: "bg-wants",
                  savings: "bg-savings",
                }
                const labels = {
                  needs: "Needs",
                  wants: "Wants",
                  savings: "Savings",
                }

                return (
                  <div key={cat.category} className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${isCategoryOverBudget ? "bg-destructive" : colorClasses[cat.category]}`} />
                    <span className="text-xs text-muted-foreground font-medium">{labels[cat.category]}</span>
                  </div>
                )
              })}
            </div>

            {frontHint ? (
              <div
                className={`mt-5 flex items-center justify-center gap-2 text-sm ${
                  frontHint.tone === "warning" ? "text-amber-800" : "text-muted-foreground"
                }`}
              >
                <span>{frontHint.label}</span>
                <RotateCw className="size-3.5 opacity-70" />
              </div>
            ) : null}
          </div>
        </Card>

        <Card
          aria-hidden={!isFlipped}
          className="absolute inset-0 min-h-[312px] justify-center overflow-hidden border-0 p-6 shadow-sm transition-all duration-200 [backface-visibility:hidden] [transform:rotateY(180deg)] group-hover:shadow-lg"
        >
          <MonthCloseoutBackFace
            overview={overview}
            closeout={closeout}
            isLoading={isCloseoutLoading}
            onCloseMonth={onCloseMonth ?? (() => undefined)}
            onViewCloseout={onViewCloseout ?? (() => undefined)}
            onReviewCloseout={onReviewCloseout ?? (() => undefined)}
            onSetBudget={onSetBudget ?? (() => undefined)}
          />
        </Card>
      </div>
    </div>
  )
}
