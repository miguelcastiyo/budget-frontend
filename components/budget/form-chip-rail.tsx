"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface FormChipRailItem {
  value: string
  label: ReactNode
  icon?: ReactNode
  ariaLabel?: string
  title?: string
  selectedTone?: "primary" | "neutral"
  disabled?: boolean
  hideLabel?: boolean
  className?: string
}

interface FormChipRailProps {
  items: FormChipRailItem[]
  value: string
  onValueChange: (value: string) => void
  ariaLabel: string
  emptyState?: ReactNode
  fadeClassName?: string
  chipClassName?: string
  className?: string
  viewportClassName?: string
  trackClassName?: string
  wrapOnDesktop?: boolean
}

export function FormChipRail({
  items,
  value,
  onValueChange,
  ariaLabel,
  emptyState,
  fadeClassName = "from-background via-background/80 to-transparent",
  chipClassName,
  className,
  viewportClassName,
  trackClassName,
  wrapOnDesktop = false,
}: FormChipRailProps) {
  const selectedItemRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!selectedItemRef.current) {
      return
    }

    window.requestAnimationFrame(() => {
      selectedItemRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      })
    })
  }, [value, items.length])

  if (items.length === 0) {
    return emptyState ? <>{emptyState}</> : null
  }

  return (
    <div
      className={cn(
        "relative w-full min-w-0 max-w-full overflow-hidden [contain:inline-size]",
        wrapOnDesktop && "sm:overflow-visible sm:[contain:none]",
        className
      )}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      <div
        className={cn(
          "w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain scroll-smooth pb-0.5 pr-10 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden",
          wrapOnDesktop && "sm:overflow-visible sm:pr-0",
          viewportClassName
        )}
      >
        <div className={cn("flex w-max max-w-none gap-2", wrapOnDesktop && "sm:w-full sm:flex-wrap", trackClassName)}>
          {items.map((item) => {
            const isSelected = value === item.value
            const selectedTone = item.selectedTone ?? "primary"
            const ariaLabel = item.ariaLabel ?? (typeof item.label === "string" ? item.label : undefined)
            const title = item.title ?? (typeof item.label === "string" ? item.label : undefined)

            return (
              <button
                key={item.value}
                ref={isSelected ? selectedItemRef : undefined}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={ariaLabel}
                title={title}
                disabled={item.disabled}
                onClick={() => onValueChange(item.value)}
                className={cn(
                  "inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full border px-3 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-60",
                  item.hideLabel && "w-11 px-0",
                  isSelected && selectedTone === "primary" && "border-primary bg-primary text-primary-foreground shadow-sm",
                  isSelected && selectedTone === "neutral" && "border-border/70 bg-background text-foreground shadow-sm",
                  !isSelected && "border-border/60 bg-muted/25 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  chipClassName,
                  item.className
                )}
              >
                {item.icon}
                {!item.hideLabel && <span className="whitespace-nowrap">{item.label}</span>}
              </button>
            )
          })}
        </div>
      </div>
      <div className={cn("pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l", fadeClassName)} aria-hidden="true" />
    </div>
  )
}
