"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { TagMetricsResponse } from "@/lib/api/types"
import { formatCurrency } from "@/lib/formatters"
import { getTagIcon } from "@/lib/tag-icons"
import { cn } from "@/lib/utils"
import { ChevronRight, ChevronsDown } from "lucide-react"

interface TagBreakdownProps {
  metrics: TagMetricsResponse
  onTagClick?: (tagId: string) => void
  className?: string
  style?: CSSProperties
  emptyTitle?: string
  emptyDescription?: string
  emptyActionLabel?: string
  onEmptyAction?: () => void
}

// Generate consistent colors for tags
const tagColors = [
  "bg-chart-1",
  "bg-chart-2", 
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
]

export function TagBreakdown({
  metrics,
  onTagClick,
  className,
  style,
  emptyTitle = "No tag activity yet",
  emptyDescription = "Add transactions to see spending by tag.",
  emptyActionLabel = "Add Transaction",
  onEmptyAction,
}: TagBreakdownProps) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const [canScrollDown, setCanScrollDown] = useState(false)
  const maxSpend = Math.max(1, ...metrics.tags.map(t => parseFloat(t.spend)))
  const visibleTags = metrics.tags

  useEffect(() => {
    const node = listRef.current
    if (!node) {
      return
    }

    const updateScrollState = () => {
      const overflow = node.scrollHeight > node.clientHeight + 1
      const canScrollFurtherDown = node.scrollTop + node.clientHeight < node.scrollHeight - 1
      setCanScrollDown(overflow && canScrollFurtherDown)
    }

    updateScrollState()

    node.addEventListener("scroll", updateScrollState)
    const observer = new ResizeObserver(updateScrollState)
    observer.observe(node)
    window.addEventListener("resize", updateScrollState)

    return () => {
      node.removeEventListener("scroll", updateScrollState)
      observer.disconnect()
      window.removeEventListener("resize", updateScrollState)
    }
  }, [metrics.tags.length])

  const handleScrollHintClick = () => {
    const node = listRef.current
    if (!node) {
      return
    }

    const firstRow = node.querySelector("button")
    const rowHeight = firstRow instanceof HTMLElement ? firstRow.getBoundingClientRect().height : 88

    node.scrollBy({
      top: rowHeight * 3,
      behavior: "smooth",
    })
  }

  return (
    <Card
      className={cn("overflow-hidden border-0 shadow-sm flex flex-col", className)}
      style={style}
    >
      <div className="px-5 py-2 border-b border-border/50">
        <h3 className="font-semibold text-base">Spending by Tag</h3>
      </div>

      {visibleTags.length === 0 ? (
        <div className="flex-1 px-6 py-8 text-center">
          <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{emptyDescription}</p>
          {onEmptyAction && (
            <Button type="button" size="sm" onClick={onEmptyAction} className="mt-4 rounded-full px-4">
              {emptyActionLabel}
            </Button>
          )}
        </div>
      ) : (
        <div className="relative flex-1 min-h-0 flex">
          <div ref={listRef} className="divide-y divide-border/50 flex-1 min-h-0 overflow-y-auto">
            {visibleTags.map((tag, index) => {
              const percentage = (parseFloat(tag.spend) / maxSpend) * 100
              const TagIcon = getTagIcon(tag.tag_name, tag.icon_key)

              return (
                <button
                  key={tag.tag_id}
                  onClick={() => onTagClick?.(tag.tag_id)}
                  className="group w-full px-3 py-2 flex items-center gap-3 text-left cursor-pointer transition-all duration-200 hover:bg-accent/60 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset"
                >
                  <div className={`w-9 h-9 rounded-xl ${tagColors[index % tagColors.length]} flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105`}>
                    <TagIcon className="w-4 h-4 text-white" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="mb-0.5 flex items-baseline justify-between gap-2">
                      <span className="font-medium text-sm truncate">{tag.tag_name}</span>
                      <div className="shrink-0 text-right whitespace-nowrap">
                        <span className="text-[11px] font-semibold text-foreground">
                          {formatCurrency(tag.spend)}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-1">
                          {parseFloat(tag.percent_of_monthly_spend).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${tagColors[index % tagColors.length]} transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0 transition-all duration-200 group-hover:text-muted-foreground/70 group-hover:translate-x-0.5" />
                </button>
              )
            })}
          </div>
          {canScrollDown && (
            <button
              type="button"
              onClick={handleScrollHintClick}
              aria-label="Scroll to more tags"
              className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background via-background/90 to-transparent flex items-end justify-center pb-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronsDown className="w-4 h-4 animate-pulse" />
            </button>
          )}
        </div>
      )}
    </Card>
  )
}
