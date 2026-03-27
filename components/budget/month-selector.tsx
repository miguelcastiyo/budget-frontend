"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface MonthSelectorProps {
  currentMonth: string // Format: "2024-03"
  onChange: (month: string) => void
}

function formatMonthDisplay(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number)
  const date = new Date(year, month - 1)
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

function getPreviousMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number)
  const date = new Date(year, month - 2) // -1 for 0-indexed, -1 for previous
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function getNextMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number)
  const date = new Date(year, month) // -1 for 0-indexed, +1 for next = net 0
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export function MonthSelector({ currentMonth, onChange }: MonthSelectorProps) {
  const isCurrentMonth = currentMonth === getCurrentMonth()
  
  return (
    <div className="flex items-center justify-center gap-4">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full"
        onClick={() => onChange(getPreviousMonth(currentMonth))}
      >
        <ChevronLeft className="h-5 w-5" />
        <span className="sr-only">Previous month</span>
      </Button>
      
      <h2 className="text-lg font-semibold min-w-[160px] text-center">
        {formatMonthDisplay(currentMonth)}
      </h2>
      
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full"
        onClick={() => onChange(getNextMonth(currentMonth))}
        disabled={isCurrentMonth}
      >
        <ChevronRight className="h-5 w-5" />
        <span className="sr-only">Next month</span>
      </Button>
    </div>
  )
}

export { getCurrentMonth }
