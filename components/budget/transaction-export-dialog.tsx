"use client"

import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar as AppCalendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Preset } from "@/lib/api/types"
import { cn } from "@/lib/utils"

interface ExportDatePreset {
  value: Preset
  label: string
}

interface TransactionExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  exportDatePresets: ExportDatePreset[]
  exportPreset: Preset | "custom"
  onExportPresetChange: (value: Preset | "custom") => void
  selectedExportFromDate: Date | null
  selectedExportToDate: Date | null
  onExportCustomFromChange: (value: string) => void
  onExportCustomToChange: (value: string) => void
  exportError: string | null
  isExporting: boolean
  onConfirm: () => void
}

export function TransactionExportDialog({
  open,
  onOpenChange,
  exportDatePresets,
  exportPreset,
  onExportPresetChange,
  selectedExportFromDate,
  selectedExportToDate,
  onExportCustomFromChange,
  onExportCustomToChange,
  exportError,
  isExporting,
  onConfirm,
}: TransactionExportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Transactions</DialogTitle>
          <DialogDescription>
            Choose a date range before exporting. Current category/tag/card/split filters will also be applied.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-3">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quick Date Filters</p>
            <div className="flex flex-wrap gap-2">
              {exportDatePresets.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onExportPresetChange(option.value)}
                  className={cn(
                    "cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                    exportPreset === option.value
                      ? "border-secondary bg-secondary text-foreground"
                      : "border-border/70 bg-background text-muted-foreground hover:border-border hover:text-foreground"
                  )}
                >
                  {option.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onExportPresetChange("custom")}
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                  exportPreset === "custom"
                    ? "border-secondary bg-secondary text-foreground"
                    : "border-border/70 bg-background text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                Custom
              </button>
            </div>
          </div>

          {exportPreset === "custom" && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Custom Range</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full h-10 rounded-xl justify-start text-left font-normal",
                        !selectedExportFromDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate">
                        {selectedExportFromDate ? format(selectedExportFromDate, "MMM d, yyyy") : "Start date"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <AppCalendar
                      mode="single"
                      selected={selectedExportFromDate ?? undefined}
                      onSelect={(value) => {
                        if (!value) {
                          return
                        }
                        onExportCustomFromChange(format(value, "yyyy-MM-dd"))
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full h-10 rounded-xl justify-start text-left font-normal",
                        !selectedExportToDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate">
                        {selectedExportToDate ? format(selectedExportToDate, "MMM d, yyyy") : "End date"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <AppCalendar
                      mode="single"
                      selected={selectedExportToDate ?? undefined}
                      onSelect={(value) => {
                        if (!value) {
                          return
                        }
                        onExportCustomToChange(format(value, "yyyy-MM-dd"))
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {exportError && <p className="text-sm text-destructive">{exportError}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isExporting}>
              Cancel
            </Button>
            <Button type="button" onClick={onConfirm} disabled={isExporting}>
              {isExporting ? "Exporting..." : "Export CSV"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
