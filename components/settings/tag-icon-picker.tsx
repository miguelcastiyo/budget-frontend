"use client"

import type { ReactNode } from "react"
import { getTagIcon, TAG_ICON_OPTIONS } from "@/lib/tag-icons"
import { cn } from "@/lib/utils"

interface TagIconPickerProps {
  tagName: string
  value: string
  onChange: (value: string) => void
  label?: ReactNode
  fadeClassName?: string
  wrapOnDesktop?: boolean
}

export function TagIconPicker({
  tagName,
  value,
  onChange,
  label = <p className="text-xs font-medium text-muted-foreground">Icon</p>,
  fadeClassName = "from-background via-background/80 to-transparent sm:hidden",
  wrapOnDesktop = true,
}: TagIconPickerProps) {
  const selectedIconOption = TAG_ICON_OPTIONS.find((option) => option.key === value)
  const AutoIcon = getTagIcon(tagName || "Tag", null)
  const PreviewIcon = selectedIconOption?.icon ?? AutoIcon
  const iconLabel = selectedIconOption?.label ?? "Auto"

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-center justify-between gap-3">
        {label}
        <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <PreviewIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{iconLabel}</span>
        </span>
      </div>
      <div className={cn("relative min-w-0 max-w-full overflow-hidden", wrapOnDesktop && "sm:overflow-visible")}>
        <div
          className={cn(
            "flex max-w-full gap-2 overflow-x-auto scroll-smooth pr-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            wrapOnDesktop && "sm:flex-wrap sm:overflow-visible sm:pr-0"
          )}
        >
          <button
            type="button"
            aria-pressed={!value}
            aria-label="Use automatic icon"
            title="Auto icon"
            onClick={() => onChange("")}
            className={cn(
              "inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
              !value
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border/60 bg-muted/25 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <AutoIcon className="h-4 w-4 shrink-0" />
            Auto
          </button>
          {TAG_ICON_OPTIONS.map((option) => {
            const Icon = option.icon
            const isSelected = value === option.key

            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={isSelected}
                aria-label={`Use ${option.label} icon`}
                title={option.label}
                onClick={() => onChange(option.key)}
                className={cn(
                  "inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border/60 bg-muted/25 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            )
          })}
        </div>
        <div className={cn("pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l", fadeClassName)} aria-hidden="true" />
      </div>
    </div>
  )
}
