"use client"

import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Calendar as AppCalendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import { parseIsoDate, toIsoDate } from "@/lib/date-filters"
import type { RangePreset } from "@/lib/insights"
import { cn } from "@/lib/utils"

interface RangeHeaderPreset {
  value: Exclude<RangePreset, "custom">
  label: string
}

interface InsightsRangeHeaderProps {
  rangePresets: RangeHeaderPreset[]
  selectedPreset: RangePreset
  onPresetSelect: (preset: Exclude<RangePreset, "custom">) => void
  customFrom: string
  customTo: string
  onCustomFromChange: (value: string) => void
  onCustomToChange: (value: string) => void
  onApplyCustomRange: () => void
  customRangeError: string | null
  error: string | null
  monthsInRange: number | null
  appliedRange: { date_from: string; date_to: string }
  isLoading: boolean
}

export function InsightsRangeHeader({
  rangePresets,
  selectedPreset,
  onPresetSelect,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  onApplyCustomRange,
  customRangeError,
  error,
  monthsInRange,
  appliedRange,
  isLoading,
}: InsightsRangeHeaderProps) {
  return (
    <Card className="p-3 lg:p-4 border-0 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {rangePresets.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => onPresetSelect(preset.value)}
            className={cn(
              "cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              selectedPreset === preset.value
                ? "border-secondary bg-secondary text-foreground"
                : "border-border/70 bg-background text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="grid gap-2 grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-start rounded-xl h-10 text-xs lg:text-sm">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {customFrom ? format(parseIsoDate(customFrom) ?? new Date(customFrom), "MMM d, yyyy") : "From"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <AppCalendar
              mode="single"
              selected={parseIsoDate(customFrom) ?? undefined}
              onSelect={(date) => {
                if (!date) {
                  return
                }
                onCustomFromChange(toIsoDate(date))
              }}
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-start rounded-xl h-10 text-xs lg:text-sm">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {customTo ? format(parseIsoDate(customTo) ?? new Date(customTo), "MMM d, yyyy") : "To"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <AppCalendar
              mode="single"
              selected={parseIsoDate(customTo) ?? undefined}
              onSelect={(date) => {
                if (!date) {
                  return
                }
                onCustomToChange(toIsoDate(date))
              }}
            />
          </PopoverContent>
        </Popover>

        <Button onClick={onApplyCustomRange} className="rounded-xl h-10 col-span-2 lg:col-span-1">
          Apply Range
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary" className="rounded-full">
          {monthsInRange !== null ? `${monthsInRange} month${monthsInRange === 1 ? "" : "s"}` : "-"}
        </Badge>
        <span>
          {appliedRange.date_from} to {appliedRange.date_to}
        </span>
        {isLoading && <Spinner className="size-4" />}
      </div>

      {customRangeError && <p className="text-xs text-destructive">{customRangeError}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </Card>
  )
}
