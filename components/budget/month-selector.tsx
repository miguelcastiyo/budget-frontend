"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  formatMonthLabel,
  getCurrentMonthKey,
  getNextMonthKey,
  getPreviousMonthKey,
} from "@/lib/date-filters"

interface MonthSelectorProps {
  currentMonth: string // Format: "2024-03"
  onChange: (month: string) => void
  allowFuture?: boolean
}

export function MonthSelector({ currentMonth, onChange, allowFuture = false }: MonthSelectorProps) {
  const isCurrentMonth = currentMonth === getCurrentMonthKey()
  const monthLabel = formatMonthLabel(currentMonth) ?? currentMonth

  return (
    <div className="flex items-center justify-center gap-4">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full"
        onClick={() => onChange(getPreviousMonthKey(currentMonth))}
      >
        <ChevronLeft className="h-5 w-5" />
        <span className="sr-only">Previous month</span>
      </Button>

      <h2 className="text-lg font-semibold min-w-[160px] text-center">
        {monthLabel}
      </h2>

      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full"
        onClick={() => onChange(getNextMonthKey(currentMonth))}
        disabled={!allowFuture && isCurrentMonth}
      >
        <ChevronRight className="h-5 w-5" />
        <span className="sr-only">Next month</span>
      </Button>
    </div>
  )
}
