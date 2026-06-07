"use client"

import { formatCurrency } from "@/lib/formatters"

interface SpendingRingProps {
  spent: number
  budget: number
  category: "needs" | "wants" | "savings"
  size?: "xs" | "sm" | "md" | "lg"
  showAmount?: boolean
}

const categoryColors = {
  needs: {
    stroke: "var(--needs)",
    track: "var(--needs)",
  },
  wants: {
    stroke: "var(--wants)", 
    track: "var(--wants)",
  },
  savings: {
    stroke: "var(--savings)",
    track: "var(--savings)",
  },
}

const sizes = {
  xs: { size: 56, strokeWidth: 5 },
  sm: { size: 80, strokeWidth: 6 },
  md: { size: 120, strokeWidth: 8 },
  lg: { size: 160, strokeWidth: 10 },
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0
}

export function SpendingRing({
  spent,
  budget,
  category,
  size = "md",
  showAmount = true,
}: SpendingRingProps) {
  const safeSpent = Math.max(0, safeNumber(spent))
  const safeBudget = Math.max(0, safeNumber(budget))
  const { size: ringSize, strokeWidth } = sizes[size]
  const radius = (ringSize - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const percentage = safeBudget > 0
    ? Math.min((safeSpent / safeBudget) * 100, 100)
    : 0
  const strokeDashoffset = circumference - (percentage / 100) * circumference
  const colors = categoryColors[category]
  const isOverBudget = safeBudget > 0 && safeSpent > safeBudget

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={ringSize}
        height={ringSize}
        viewBox={`0 0 ${ringSize} ${ringSize}`}
        className="transform -rotate-90"
      >
        {/* Background track */}
        <circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={radius}
          fill="none"
          stroke={colors.track}
          strokeWidth={strokeWidth}
          className="opacity-15"
        />
        {/* Progress arc */}
        <circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={radius}
          fill="none"
          stroke={isOverBudget ? "var(--destructive)" : colors.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {showAmount && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-semibold tracking-tight ${size === "lg" ? "text-xl" : size === "md" ? "text-base" : "text-sm"}`}>
            {formatCurrency(safeSpent)}
          </span>
          <span className={`text-muted-foreground ${size === "lg" ? "text-sm" : "text-xs"}`}>
            of {formatCurrency(safeBudget)}
          </span>
        </div>
      )}
    </div>
  )
}
