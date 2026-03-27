"use client"

import { Card } from "@/components/ui/card"
import { SpendingRing } from "./spending-ring"
import { formatCurrency, formatCategory } from "@/lib/formatters"
import type { CategoryMetricsItem } from "@/lib/api/types"
import { cn } from "@/lib/utils"

interface CategoryCardProps {
  metrics: CategoryMetricsItem
  onClick?: () => void
  compactOnMobile?: boolean
}

export function CategoryCard({ metrics, onClick, compactOnMobile = false }: CategoryCardProps) {
  const spentRaw = parseFloat(metrics.actual_spend)
  const budgetRaw = parseFloat(metrics.budget_amount)
  const spent = Number.isFinite(spentRaw) ? spentRaw : 0
  const budget = Number.isFinite(budgetRaw) ? budgetRaw : 0
  const remaining = budget - spent
  const isOverBudget = remaining < 0

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-lg active:scale-[0.98] border-0 shadow-sm bg-card",
        compactOnMobile ? "p-3 lg:p-5" : "p-5"
      )}
      onClick={onClick}
    >
      <div className={cn("flex items-center gap-5", compactOnMobile && "flex-col gap-2 text-center lg:flex-row lg:text-left")}>
        {compactOnMobile ? (
          <>
            <div className="lg:hidden">
              <SpendingRing
                spent={spent}
                budget={budget}
                category={metrics.category}
                size="xs"
                showAmount={false}
              />
            </div>
            <div className="hidden lg:block">
              <SpendingRing
                spent={spent}
                budget={budget}
                category={metrics.category}
                size="sm"
                showAmount={false}
              />
            </div>
          </>
        ) : (
          <SpendingRing
            spent={spent}
            budget={budget}
            category={metrics.category}
            size="sm"
            showAmount={false}
          />
        )}
        <div className={cn("flex-1 min-w-0 overflow-hidden", compactOnMobile && "w-full")}>
          <h3 className={cn("font-semibold text-card-foreground truncate", compactOnMobile && "text-xs lg:text-base")}>
            {formatCategory(metrics.category)}
          </h3>
          <p className={cn("font-bold tracking-tight text-card-foreground mt-0.5 truncate", compactOnMobile ? "text-sm lg:text-2xl" : "text-xl sm:text-2xl")}>
            {formatCurrency(spent)}
          </p>
          <p className={cn("text-sm mt-0.5 truncate", compactOnMobile && "hidden lg:block", isOverBudget ? "text-destructive" : "text-muted-foreground")}>
            {isOverBudget 
              ? `${formatCurrency(Math.abs(remaining))} over budget`
              : `${formatCurrency(remaining)} left`
            }
          </p>
        </div>
      </div>
    </Card>
  )
}
