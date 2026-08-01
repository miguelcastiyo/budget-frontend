"use client"

import { useState } from "react"
import type { ComponentType, DragEvent, RefObject } from "react"
import { CalendarIcon, CheckCircle2, CreditCard, Download, FileUp, Loader2, Tags, Upload, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type {
  Category,
  CsvImportAmountStrategy,
  CsvImportMapping,
  CsvImportPreviewResponse,
  CsvImportResponse,
  CsvImportTagStrategyEntry,
  DataRunItem,
  Tag,
} from "@/lib/api/types"
import { formatDateTimeValue, formatDateValue, parseIsoDate, toIsoDate } from "@/lib/date-filters"
import { getTagIcon } from "@/lib/tag-icons"
import { cn } from "@/lib/utils"
import {
  activityStatusClassName,
  activityStatusLabel,
  CATEGORY_OPTIONS,
  completeSummarySentence,
  currentImportYear,
  dateProfileForHeader,
  HEADER_IMPORT_FIELDS,
  type CategorySetupMode,
  type HeaderImportField,
  NONE_VALUE,
  plannedImportCount,
  pluralize,
  profileForHeader,
  reviewSummarySentence,
} from "../_lib/import-export"

export function ResultSummary({ result, mode }: { result: CsvImportResponse; mode: "review" | "complete" }) {
  const summarySentence = mode === "review" ? reviewSummarySentence(result) : completeSummarySentence(result)

  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
      <div className="flex items-start gap-3">
        {result.status === "failed" ? (
          <XCircle className="mt-0.5 size-5 text-destructive" />
        ) : (
          <CheckCircle2 className="mt-0.5 size-5 text-success" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium">{summarySentence}</p>
          {mode === "review" && (
            <p className="mt-1 text-sm text-muted-foreground">Nothing is written until you confirm the import.</p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-6">
            <Stat label="Rows checked" value={result.total_rows} />
            <Stat label="Valid rows" value={result.valid_rows} />
            <Stat label={mode === "review" ? "Will import" : "Imported"} value={mode === "review" ? plannedImportCount(result) : result.imported_rows} />
            <Stat label="Duplicates" value={result.duplicate_rows} />
            <Stat label="Skipped" value={result.skipped_rows} />
            <Stat label="Invalid" value={result.invalid_rows} />
          </div>
          {result.skipped_blank_amount_rows > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {pluralize(result.skipped_blank_amount_rows, "row")} had no value in the mapped amount column and were skipped.
            </p>
          )}
          {result.errors.length > 0 && (
            <div className="mt-3 max-h-44 space-y-1.5 overflow-y-auto rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              {result.errors.slice(0, 8).map((errorItem, index) => (
                <p key={`${errorItem.row}-${errorItem.field}-${index}`} className="text-xs text-destructive">
                  Row {errorItem.row} ({errorItem.field}): {errorItem.message}
                </p>
              ))}
              {(result.errors_truncated || result.errors.length > 8) && (
                <p className="pt-1 text-[11px] text-muted-foreground">
                  Showing the first {pluralize(Math.min(8, result.errors.length), "error")}.
                </p>
              )}
            </div>
          )}
          {(result.new_tags.length > 0 || result.new_cards.length > 0) && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {result.new_tags.length > 0 && (
                <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Tags className="size-3.5" />
                    New tags to be created
                  </div>
                  <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                    {result.new_tags.map((tag) => {
                      const TagIcon = getTagIcon(tag.name, tag.icon_key)
                      return (
                        <span key={tag.name} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-secondary px-2 py-1 text-xs">
                          <TagIcon className="size-3.5 shrink-0" />
                          <span className="truncate">{tag.name}</span>
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
              {result.new_cards.length > 0 && (
                <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <CreditCard className="size-3.5" />
                    New cards to be created
                  </div>
                  <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                    {result.new_cards.map((card) => (
                      <span key={card.name} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-secondary px-2 py-1 text-xs">
                        <CreditCard className="size-3.5 shrink-0" />
                        <span className="truncate">{card.name}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg bg-background/70 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-base font-semibold">{value ?? "-"}</p>
    </div>
  )
}

export function ImportStepper({ stepIndex }: { stepIndex: number }) {
  const steps = ["Upload", "Map", "Dates", "Groups", "Tags", "Review", "Import"]
  const fullSteps = ["Upload", "Map columns", "Set missing years", "Budget groups", "Spending tags", "Review", "Import"]
  const progress = ((stepIndex + 1) / steps.length) * 100

  return (
    <>
      <div className="space-y-2 sm:hidden">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-medium text-muted-foreground">Step {stepIndex + 1} of {steps.length}</span>
          <span className="truncate font-semibold">{fullSteps[stepIndex]}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={stepIndex + 1} aria-label={`Import step ${stepIndex + 1} of ${steps.length}: ${fullSteps[stepIndex]}`}>
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="hidden grid-cols-7 rounded-xl border border-border/70 bg-muted/20 p-1 sm:grid" aria-label={`Import step ${stepIndex + 1} of ${steps.length}: ${fullSteps[stepIndex]}`}>
        {steps.map((label, index) => (
          <div
            key={label}
            className={cn(
              "flex h-9 min-w-0 items-center justify-center rounded-lg px-1 text-xs font-medium transition-colors",
              stepIndex === index ? "bg-background text-foreground shadow-sm" : stepIndex > index ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <span className="truncate">{label}</span>
          </div>
        ))}
      </div>
    </>
  )
}

export function PanelHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <h2 className="text-base font-semibold sm:text-lg">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

export function FilePicker({
  file,
  preview,
  isBusy,
  isPreviewing,
  inputRef,
  onSelect,
  onReset,
}: {
  file: File | null
  preview: CsvImportPreviewResponse | null
  isBusy: boolean
  isPreviewing: boolean
  inputRef: RefObject<HTMLInputElement | null>
  onSelect: (file: File | null) => void
  onReset: () => void
}) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!isBusy) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragging(false)
    }
  }

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)

    if (isBusy) {
      return
    }

    onSelect(event.dataTransfer.files?.[0] ?? null)
  }

  if (file && preview && !isPreviewing) {
    return (
      <div
        className={cn(
          "rounded-xl border p-3 transition-colors",
          isDragging ? "border-primary bg-primary/10" : "border-border/70 bg-muted/20"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background">
            <FileUp className="size-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(file.size / 1024).toFixed(1)} KB - {pluralize(preview.total_rows, "row")}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" className="h-9 shrink-0 rounded-lg px-3" onClick={onReset} disabled={isBusy}>
            Replace
          </Button>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-xl border border-dashed p-5 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:p-6",
        isDragging ? "border-primary bg-primary/10" : file ? "border-primary bg-primary/5" : "border-border bg-muted/10 hover:border-primary/50 hover:bg-muted/20"
      )}
      disabled={isBusy}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(event) => onSelect(event.target.files?.[0] ?? null)}
      />
      {isPreviewing ? (
        <div className="space-y-2">
          <Loader2 className="mx-auto size-8 animate-spin text-primary" />
          <p className="font-medium">Previewing CSV</p>
          <p className="text-sm text-muted-foreground">Reading headers and sample rows.</p>
        </div>
      ) : file ? (
        <div className="space-y-2">
          <FileUp className="mx-auto size-8 text-primary" />
          <p className="truncate font-medium">{file.name}</p>
          <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
        </div>
      ) : (
        <div className="space-y-2">
          <Upload className="mx-auto size-8 text-muted-foreground" />
          <p className="font-medium">Choose CSV file</p>
          <p className="text-sm text-muted-foreground">CSV files only</p>
          <p className="mx-auto max-w-xs text-xs text-muted-foreground">No data is written until you review and confirm the import.</p>
        </div>
      )}
    </button>
  )
}

export function MappingControls({
  preview,
  mapping,
  onChange,
  includeContext = false,
}: {
  preview: CsvImportPreviewResponse
  mapping: CsvImportMapping
  onChange: (field: HeaderImportField, header: string | null) => void
  includeContext?: boolean
}) {
  const usedHeaders = new Set(Object.values(mapping).filter(Boolean))

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-background">
      {HEADER_IMPORT_FIELDS.filter((field) => includeContext || field.key !== "context").map((field) => {
        const value = mapping[field.key] ?? ""
        return (
          <div key={field.key} className="grid gap-2 border-b border-border/70 p-3 last:border-b-0 sm:grid-cols-[minmax(8rem,0.42fr)_minmax(0,1fr)] sm:items-center">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">{field.label}</Label>
                {field.required && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Required</span>}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{field.hint}</p>
            </div>
            <Select value={value || NONE_VALUE} onValueChange={(next) => onChange(field.key, next === NONE_VALUE ? null : next)}>
              <SelectTrigger className="h-10 w-full rounded-lg border-border/70">
                <SelectValue placeholder="Choose CSV header" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Do not import</SelectItem>
                {preview.headers.map((header) => (
                  <SelectItem key={header} value={header} disabled={usedHeaders.has(header) && header !== value}>
                    {header}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )
      })}
    </div>
  )
}

export function CategorySetup({
  preview,
  mode,
  sourceHeader,
  valueMap,
  defaultCategory,
  onModeChange,
  onSourceChange,
  onValueChange,
  onDefaultCategoryChange,
}: {
  preview: CsvImportPreviewResponse
  mode: CategorySetupMode
  sourceHeader: string
  valueMap: Record<string, Category>
  defaultCategory: Category
  onModeChange: (mode: CategorySetupMode) => void
  onSourceChange: (header: string) => void
  onValueChange: (sourceValue: string, category: Category) => void
  onDefaultCategoryChange: (category: Category) => void
}) {
  const profile = profileForHeader(preview, sourceHeader)
  const values = profile?.unique_values ?? []

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-background p-3 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-sm">Budget group setup</Label>
          <Select value={mode} onValueChange={(next) => onModeChange(next as CategorySetupMode)}>
            <SelectTrigger className="h-10 rounded-lg border-border/70">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="value_map">Map imported labels</SelectItem>
              <SelectItem value="default">Use one budget group</SelectItem>
              <SelectItem value="exact_column">CSV has Budget groups</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {mode === "default" ? (
          <div className="space-y-1.5">
            <Label className="text-sm">Default budget group</Label>
            <Select value={defaultCategory} onValueChange={(next) => onDefaultCategoryChange(next as Category)}>
              <SelectTrigger className="h-10 rounded-lg border-border/70">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label className="text-sm">Source column</Label>
            <Select value={sourceHeader || NONE_VALUE} onValueChange={(next) => onSourceChange(next === NONE_VALUE ? "" : next)}>
              <SelectTrigger className="h-10 rounded-lg border-border/70">
                <SelectValue placeholder="Choose CSV header" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Choose source</SelectItem>
                {preview.headers.map((header) => (
                  <SelectItem key={header} value={header}>
                    {header}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {mode === "value_map" && (
        <div className="space-y-2">
          {profile?.unique_values_truncated ? (
            <p className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
              This source has more than 100 unique values. Choose a smaller label column or use one default budget group.
            </p>
          ) : values.length > 0 ? (
            <div className="max-h-[calc(100dvh-22rem)] space-y-2 overflow-y-auto pr-1 sm:max-h-[28rem]">
              {values.map((item) => (
                <div key={item.value} className="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 md:grid-cols-[minmax(10rem,1fr)_minmax(18rem,22rem)] md:items-center">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">{item.value}</p>
                    <p className="text-xs text-muted-foreground">{pluralize(item.count, "row")}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {CATEGORY_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={cn(
                          "h-9 rounded-lg border px-1.5 text-xs font-medium transition-colors",
                          valueMap[item.value] === option.value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border/70 bg-background text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => onValueChange(item.value, option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
              Choose a source column with labels you can map into budget groups.
            </p>
          )}
        </div>
      )}

      {mode === "exact_column" && (
        <p className="text-xs text-muted-foreground">
          Use this only when the selected column already contains Needs, Wants, or Savings.
        </p>
      )}
    </div>
  )
}

export function DateSetup({
  preview,
  dateHeader,
  selectedYear,
  onYearChange,
}: {
  preview: CsvImportPreviewResponse | null
  dateHeader: string
  selectedYear: string
  onYearChange: (year: string) => void
}) {
  const profile = dateProfileForHeader(preview, dateHeader)
  const examples = profile?.yearless_examples ?? []
  const yearlessCount = profile?.yearless_date_count ?? 0

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-background p-3 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-end">
        <div>
          <Label className="text-sm">Year for dates without a year</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            {pluralize(yearlessCount, "row")} {yearlessCount === 1 ? "needs" : "need"} a year before validation.
          </p>
        </div>
        <Select value={selectedYear} onValueChange={onYearChange}>
          <SelectTrigger className="h-10 rounded-lg border-border/70">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 8 }, (_, index) => currentImportYear() + 1 - index).map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {examples.length > 0 && selectedYear && (
        <div className="grid gap-2 sm:grid-cols-2">
          {examples.slice(0, 4).map((example) => {
            const [month, day] = example.split("/")
            const normalized = `${selectedYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
            return (
              <div key={example} className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
                <span className="text-muted-foreground">{example}</span>
                <span className="px-2 text-muted-foreground">{"->"}</span>
                <span className="font-medium">{normalized}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function TagSetup({
  preview,
  tagHeader,
  tags,
  valueMap,
  onChange,
}: {
  preview: CsvImportPreviewResponse
  tagHeader: string
  tags: Tag[]
  valueMap: Record<string, CsvImportTagStrategyEntry>
  onChange: (sourceValue: string, entry: CsvImportTagStrategyEntry) => void
}) {
  const profile = profileForHeader(preview, tagHeader)
  const values = profile?.unique_values ?? []

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-background p-3 sm:p-4">
      {values.length === 0 ? (
        <p className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
          Choose a tag column in the Map step.
        </p>
      ) : (
        <div className="max-h-[calc(100dvh-22rem)] space-y-2 overflow-y-auto pr-1 sm:max-h-[28rem]">
          {values.map((item) => {
            const entry = valueMap[item.value] ?? { mode: "new", name: item.value }
            const selectValue = entry.mode === "existing" ? `existing:${entry.tag_id}` : "__new"
            return (
              <div key={item.value} className="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 md:grid-cols-[minmax(10rem,1fr)_minmax(18rem,24rem)] md:items-center">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium">{item.value}</p>
                  <p className="text-xs text-muted-foreground">{pluralize(item.count, "row")}</p>
                </div>
                <div className="grid gap-2">
                  <Select
                    value={selectValue}
                    onValueChange={(next) => {
                      if (next === "__new") {
                        onChange(item.value, { mode: "new", name: item.value })
                        return
                      }
                      onChange(item.value, { mode: "existing", tag_id: next.replace("existing:", "") })
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-lg border-border/70">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__new">Create "{item.value}"</SelectItem>
                      {tags.map((tag) => (
                        <SelectItem key={tag.id} value={`existing:${tag.id}`}>
                          Use {tag.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function SampleRows({ preview }: { preview: CsvImportPreviewResponse }) {
  if (preview.sample_rows.length === 0) {
    return (
      <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
        This CSV has headers but no data rows.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/70">
      <div className="max-h-72 overflow-auto">
        <table className="w-full min-w-[42rem] text-left text-xs">
          <thead className="sticky top-0 bg-muted text-muted-foreground">
            <tr>
              {preview.headers.map((header) => (
                <th key={header} className="whitespace-nowrap px-3 py-2 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {preview.sample_rows.map((row, index) => (
              <tr key={index} className="bg-background">
                {preview.headers.map((header) => (
                  <td key={header} className="max-w-48 truncate px-3 py-2">
                    {row[header] || "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function MobileSampleRows({ preview, mapping }: { preview: CsvImportPreviewResponse; mapping: CsvImportMapping }) {
  if (preview.sample_rows.length === 0) {
    return (
      <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground md:hidden">
        This CSV has headers but no data rows.
      </div>
    )
  }

  const mappedFields = HEADER_IMPORT_FIELDS.filter((field) => mapping[field.key])

  return (
    <div className="space-y-2 md:hidden">
      {preview.sample_rows.slice(0, 3).map((row, index) => (
        <div key={index} className="rounded-xl border border-border/70 bg-background p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Row {index + 1}</p>
          <div className="space-y-1.5">
            {mappedFields.map((field) => {
              const header = mapping[field.key]
              return (
                <div key={field.key} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 text-sm">
                  <span className="text-muted-foreground">{field.label}</span>
                  <span className="truncate font-medium">{header ? row[header] || "-" : "-"}</span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export function ActivityRow({
  item,
  onRollback,
  isRollingBack,
}: {
  item: DataRunItem
  onRollback: (item: DataRunItem) => void
  isRollingBack: boolean
}) {
  const rangeLabel = item.type === "export"
    ? item.date_from && item.date_to
      ? `${formatDateValue(item.date_from, { month: "short", day: "numeric", year: "numeric" })} - ${formatDateValue(item.date_to, { month: "short", day: "numeric", year: "numeric" })}`
      : "All time"
    : item.source_filename || "CSV import"

  return (
    <div className="p-4 lg:px-5">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
            {item.type === "export" ? (
              <Download className="size-5 text-muted-foreground" />
            ) : (
              <Upload className="size-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{item.type === "export" ? "Export" : "Import"}</p>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", activityStatusClassName(item))}>
                {activityStatusLabel(item)}
              </span>
            </div>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{rangeLabel}</p>
            <p className="mt-1 text-xs text-muted-foreground lg:hidden">{formatDateTimeValue(item.created_at, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</p>
            {item.type === "import" && (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground lg:hidden">
                <span>{item.imported_rows ?? 0} imported</span>
                <span>{item.duplicate_rows ?? 0} duplicates</span>
                {(item.skipped_rows ?? 0) > 0 && <span>{item.skipped_rows} skipped</span>}
                <span>{item.invalid_rows ?? 0} invalid</span>
                {item.rolled_back_at && <span>{item.rolled_back_rows} rolled back</span>}
              </div>
            )}
            {item.type === "import" && item.rollback_available && (
              <Button type="button" variant="outline" size="sm" className="mt-3 h-9 w-full rounded-lg sm:w-auto" disabled={isRollingBack} onClick={() => onRollback(item)}>
                {isRollingBack ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Rolling back
                  </>
                ) : (
                  "Rollback"
                )}
              </Button>
            )}
            {item.type === "import" && item.rollback_unavailable_reason === "pre_rollback_feature" && (
              <p className="mt-2 text-xs text-muted-foreground">Rollback unavailable for imports before this feature.</p>
            )}
            {item.error_summary && (
              <p className="mt-2 text-xs text-destructive">{item.error_summary}</p>
            )}
          </div>
        </div>
        <div className="hidden text-right text-xs text-muted-foreground lg:block">
          <p>{formatDateTimeValue(item.created_at, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</p>
          {item.type === "import" && (
            <div className="mt-2 flex justify-end gap-3">
              <span>{item.imported_rows ?? 0} imported</span>
              <span>{item.duplicate_rows ?? 0} duplicates</span>
              {(item.skipped_rows ?? 0) > 0 && <span>{item.skipped_rows} skipped</span>}
              <span>{item.invalid_rows ?? 0} invalid</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ExportDateFields({
  exportCustomFrom,
  exportCustomTo,
  onFromChange,
  onToChange,
}: {
  exportCustomFrom: string
  exportCustomTo: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
}) {
  const selectedExportFromDate = parseIsoDate(exportCustomFrom)
  const selectedExportToDate = parseIsoDate(exportCustomTo)

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>From</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="h-11 w-full justify-start rounded-lg border-border/60 px-3 font-normal hover:border-foreground/20">
              <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{selectedExportFromDate ? formatDateValue(exportCustomFrom, { month: "short", day: "numeric", year: "numeric" }) : "Select start date"}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedExportFromDate ?? undefined}
              onSelect={(date) => {
                if (date) {
                  onFromChange(toIsoDate(date))
                }
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-2">
        <Label>To</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="h-11 w-full justify-start rounded-lg border-border/60 px-3 font-normal hover:border-foreground/20">
              <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{selectedExportToDate ? formatDateValue(exportCustomTo, { month: "short", day: "numeric", year: "numeric" }) : "Select end date"}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedExportToDate ?? undefined}
              onSelect={(date) => {
                if (date) {
                  onToChange(toIsoDate(date))
                }
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

export function ImportReviewNotice({
  amountProfile,
  amountStrategy,
  amountHeader,
}: {
  amountProfile: ReturnType<typeof profileForHeader>
  amountStrategy: CsvImportAmountStrategy
  amountHeader: string | undefined
}) {
  if (!amountProfile || amountProfile.blank_count <= 0 || amountStrategy.blank_mapped_amount !== "skip") {
    return null
  }

  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
      {pluralize(amountProfile.blank_count, "row")} have a blank value in {amountHeader}. Those rows will be skipped instead of treated as errors.
    </div>
  )
}
