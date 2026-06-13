"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ComponentType, DragEvent, RefObject } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, CalendarIcon, CheckCircle2, CreditCard, Database, Download, FileUp, Loader2, Tags, Upload, XCircle } from "lucide-react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card } from "@/components/ui/card"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { ResponsiveConfirmDialog } from "@/components/ui/responsive-confirm-dialog"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ApiError, apiClient } from "@/lib/api/client"
import type { Category, CsvImportAmountStrategy, CsvImportCategoryStrategy, CsvImportDateStrategy, CsvImportField, CsvImportMapping, CsvImportPreviewResponse, CsvImportResponse, CsvImportTagStrategy, CsvImportTagStrategyEntry, DataRunItem, DataRunStatus, Tag } from "@/lib/api/types"
import { formatDateTimeValue, formatDateValue, parseIsoDate, toIsoDate } from "@/lib/date-filters"
import { getTagIcon } from "@/lib/tag-icons"
import { cn } from "@/lib/utils"

type ExportDateMode = "all" | "custom"
type ImportStep = "upload" | "map" | "dates" | "categories" | "tags" | "review" | "done"
type CategorySetupMode = "value_map" | "default" | "exact_column"
type HeaderImportField = Exclude<CsvImportField, "category">

const HEADER_IMPORT_FIELDS: Array<{ key: HeaderImportField; label: string; required: boolean; hint: string }> = [
  { key: "date", label: "Date", required: true, hint: "Transaction date" },
  { key: "expense", label: "Expense", required: true, hint: "Merchant or description" },
  { key: "amount", label: "Amount", required: true, hint: "Positive transaction amount" },
  { key: "tag", label: "Spending tag", required: true, hint: "Creates or matches spending tags" },
  { key: "card", label: "Card", required: false, hint: "Creates or matches cards" },
  { key: "is_split", label: "Split", required: false, hint: "Optional true/false flag" },
]

const NONE_VALUE = "__none"

const CATEGORY_OPTIONS: Array<{ value: Category; label: string }> = [
  { value: "needs", label: "Needs" },
  { value: "wants", label: "Wants" },
  { value: "savings", label: "Savings" },
]

const CATEGORY_SOURCE_HINTS = ["bank_category_guess", "category", "budget_category", "type", "label", "tag", "tags"]

function normalizedHeader(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
}

function inferCategory(value: string): Category {
  const normalized = value.toLowerCase().trim()
  if (normalized === "needs" || normalized.includes("need")) {
    return "needs"
  }
  if (normalized === "wants" || normalized.includes("want")) {
    return "wants"
  }
  if (["debt", "debts", "loan", "loans", "credit card payment", "credit card payments"].some((keyword) => normalized.includes(keyword))) {
    return "needs"
  }
  if (normalized.includes("savings")) {
    return "savings"
  }
  if (["savings", "saving", "investment", "investments"].some((keyword) => normalized.includes(keyword))) {
    return "savings"
  }
  if (["dining", "coffee", "entertainment", "shopping", "travel", "misc", "restaurant", "movie"].some((keyword) => normalized.includes(keyword))) {
    return "wants"
  }
  return "needs"
}

function bestCategorySource(preview: CsvImportPreviewResponse): string {
  const headersByNormalized = new Map(preview.headers.map((header) => [normalizedHeader(header), header]))
  for (const hint of CATEGORY_SOURCE_HINTS) {
    const exact = headersByNormalized.get(hint)
    if (exact) {
      return exact
    }
  }

  return preview.suggested_mapping.category ?? preview.suggested_mapping.tag ?? preview.headers[0] ?? ""
}

function profileForHeader(preview: CsvImportPreviewResponse | null, header: string) {
  return preview?.column_profiles.find((profile) => profile.header === header) ?? null
}

function dateProfileForHeader(preview: CsvImportPreviewResponse | null, header: string) {
  return preview?.date_profiles.find((profile) => profile.header === header) ?? null
}

function defaultCategoryMap(preview: CsvImportPreviewResponse, sourceHeader: string): Record<string, Category> {
  const profile = profileForHeader(preview, sourceHeader)
  if (!profile) {
    return {}
  }

  return Object.fromEntries(profile.unique_values.map((item) => [item.value, inferCategory(item.value)]))
}

function currentImportYear(): number {
  return new Date().getFullYear()
}

function defaultTagValueMap(preview: CsvImportPreviewResponse, tagHeader: string, tags: Tag[]): Record<string, CsvImportTagStrategyEntry> {
  const profile = profileForHeader(preview, tagHeader)
  if (!profile) {
    return {}
  }
  const tagsByName = new Map(tags.map((tag) => [tag.name.trim().toLowerCase(), tag]))

  return Object.fromEntries(profile.unique_values.map((item) => {
    const existing = tagsByName.get(item.value.trim().toLowerCase())
    return [
      item.value,
      existing ? { mode: "existing", tag_id: existing.id } : { mode: "new", name: item.value },
    ]
  }))
}

function statusLabel(status: DataRunStatus): string {
  if (status === "started") return "Started"
  if (status === "completed") return "Completed"
  if (status === "partial") return "Partial"
  return "Failed"
}

function activityStatusLabel(item: DataRunItem): string {
  if (item.type === "import" && item.rolled_back_at) {
    return "Rolled back"
  }

  return statusLabel(item.status)
}

function statusClassName(status: DataRunStatus): string {
  if (status === "completed") return "bg-success/10 text-success"
  if (status === "partial") return "bg-warning/10 text-warning"
  if (status === "started") return "bg-primary/10 text-primary"
  return "bg-destructive/10 text-destructive"
}

function activityStatusClassName(item: DataRunItem): string {
  if (item.type === "import" && item.rolled_back_at) {
    return "bg-muted text-muted-foreground"
  }

  return statusClassName(item.status)
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`
}

function plannedImportCount(result: CsvImportResponse): number {
  if (result.imported_rows > 0) {
    return result.imported_rows
  }

  return Math.max(result.valid_rows - result.duplicate_rows - result.skipped_rows, 0)
}

function reviewSummarySentence(result: CsvImportResponse): string {
  return `${pluralize(result.total_rows, "row")} checked. ${plannedImportCount(result).toLocaleString()} will be imported. ${pluralize(result.duplicate_rows, "duplicate")} will be skipped.`
}

function completeSummarySentence(result: CsvImportResponse): string {
  const duplicateText = result.duplicate_rows > 0 ? ` Skipped ${pluralize(result.duplicate_rows, "duplicate")}.` : ""
  const invalidText = result.invalid_rows > 0 ? ` Skipped ${pluralize(result.invalid_rows, "invalid row")}.` : ""
  return `Imported ${pluralize(result.imported_rows, "row")}.${duplicateText}${invalidText}`
}

function importRunIdFromDataRun(item: DataRunItem): string | null {
  if (item.type !== "import" || !item.id.startsWith("import_")) {
    return null
  }

  const id = item.id.slice("import_".length)
  return /^\d+$/.test(id) ? id : null
}

function ResultSummary({ result, mode }: { result: CsvImportResponse; mode: "review" | "complete" }) {
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

function ImportStepper({ stepIndex }: { stepIndex: number }) {
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
              stepIndex === index
                ? "bg-background text-foreground shadow-sm"
                : stepIndex > index
                  ? "text-foreground"
                  : "text-muted-foreground"
            )}
          >
            <span className="truncate">{label}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function PanelHeader({
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

function FilePicker({
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
        isDragging
          ? "border-primary bg-primary/10"
          : file
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/10 hover:border-primary/50 hover:bg-muted/20"
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

function MappingControls({
  preview,
  mapping,
  onChange,
}: {
  preview: CsvImportPreviewResponse
  mapping: CsvImportMapping
  onChange: (field: HeaderImportField, header: string | null) => void
}) {
  const usedHeaders = new Set(Object.values(mapping).filter(Boolean))

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-background">
      {HEADER_IMPORT_FIELDS.map((field) => {
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

function CategorySetup({
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

function DateSetup({
  profile,
  selectedYear,
  onYearChange,
}: {
  profile: ReturnType<typeof dateProfileForHeader>
  selectedYear: string
  onYearChange: (year: string) => void
}) {
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

function TagSetup({
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

function SampleRows({ preview }: { preview: CsvImportPreviewResponse }) {
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

function MobileSampleRows({ preview, mapping }: { preview: CsvImportPreviewResponse; mapping: CsvImportMapping }) {
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

function ActivityRow({
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 h-9 w-full rounded-lg sm:w-auto"
              disabled={isRollingBack}
              onClick={() => onRollback(item)}
            >
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

export default function DataSettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dataRuns, setDataRuns] = useState<DataRunItem[]>([])
  const [isLoadingRuns, setIsLoadingRuns] = useState(true)
  const [runsError, setRunsError] = useState<string | null>(null)
  const [rollbackTarget, setRollbackTarget] = useState<DataRunItem | null>(null)
  const [rollbackError, setRollbackError] = useState<string | null>(null)
  const [rollingBackImportId, setRollingBackImportId] = useState<string | null>(null)

  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importStep, setImportStep] = useState<ImportStep>("upload")
  const [importPreview, setImportPreview] = useState<CsvImportPreviewResponse | null>(null)
  const [importMapping, setImportMapping] = useState<CsvImportMapping>({})
  const [existingTags, setExistingTags] = useState<Tag[]>([])
  const [dateYear, setDateYear] = useState("")
  const [categoryMode, setCategoryMode] = useState<CategorySetupMode>("value_map")
  const [categorySourceHeader, setCategorySourceHeader] = useState("")
  const [categoryValueMap, setCategoryValueMap] = useState<Record<string, Category>>({})
  const [tagValueMap, setTagValueMap] = useState<Record<string, CsvImportTagStrategyEntry>>({})
  const [defaultCategory, setDefaultCategory] = useState<Category>("needs")
  const [amountStrategy, setAmountStrategy] = useState<CsvImportAmountStrategy>({ blank_mapped_amount: "skip" })
  const [validationResult, setValidationResult] = useState<CsvImportResponse | null>(null)
  const [commitResult, setCommitResult] = useState<CsvImportResponse | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const [exportDateMode, setExportDateMode] = useState<ExportDateMode>("all")
  const [exportCustomFrom, setExportCustomFrom] = useState("")
  const [exportCustomTo, setExportCustomTo] = useState("")
  const [exportError, setExportError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const loadDataRuns = useCallback(async () => {
    setIsLoadingRuns(true)
    setRunsError(null)

    try {
      const response = await apiClient.getDataRuns(50)
      setDataRuns(response.items)
    } catch (err) {
      if (err instanceof ApiError) {
        setRunsError(err.error.message)
      } else {
        setRunsError("Unable to load recent activity")
      }
    } finally {
      setIsLoadingRuns(false)
    }
  }, [])

  useEffect(() => {
    void loadDataRuns()
  }, [loadDataRuns])

  useEffect(() => {
    if (searchParams.get("start_import") !== "1") {
      return
    }

    openImportDialog()
    router.replace("/settings/data")
  }, [router, searchParams])

  const resetImportState = () => {
    setImportFile(null)
    setImportStep("upload")
    setImportPreview(null)
    setImportMapping({})
    setDateYear("")
    setCategoryMode("value_map")
    setCategorySourceHeader("")
    setCategoryValueMap({})
    setTagValueMap({})
    setDefaultCategory("needs")
    setAmountStrategy({ blank_mapped_amount: "skip" })
    setValidationResult(null)
    setCommitResult(null)
    setImportError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleFileSelect = async (file: File | null) => {
    setImportStep("upload")
    setImportPreview(null)
    setImportMapping({})
    setDateYear("")
    setCategoryMode("value_map")
    setCategorySourceHeader("")
    setCategoryValueMap({})
    setTagValueMap({})
    setDefaultCategory("needs")
    setAmountStrategy({ blank_mapped_amount: "skip" })
    setValidationResult(null)
    setCommitResult(null)
    setImportError(null)

    if (!file) {
      setImportFile(null)
      return
    }

    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      setImportFile(null)
      setImportError("Please select a valid CSV file.")
      return
    }

    setImportFile(file)

    setIsPreviewing(true)
    try {
      const [preview, tagsResponse] = await Promise.all([
        apiClient.previewImportTransactions(file),
        apiClient.getTags(),
      ])
      const sourceHeader = bestCategorySource(preview)
      const suggestedMapping = { ...preview.suggested_mapping }
      delete suggestedMapping.category
      setImportPreview(preview)
      setExistingTags(tagsResponse.items)
      setImportMapping(suggestedMapping)
      setDateYear(String(currentImportYear()))
      setCategoryMode("value_map")
      setCategorySourceHeader(sourceHeader)
      setCategoryValueMap(defaultCategoryMap(preview, sourceHeader))
      setTagValueMap(defaultTagValueMap(preview, suggestedMapping.tag ?? "", tagsResponse.items))
      setDefaultCategory("needs")
      setAmountStrategy({ blank_mapped_amount: "skip" })
      setImportStep("map")
    } catch (err) {
      setImportFile(null)
      if (err instanceof ApiError) {
        setImportError(err.error.message)
      } else {
        setImportError("Unable to preview CSV file.")
      }
    } finally {
      setIsPreviewing(false)
    }
  }

  const handleMappingChange = (field: HeaderImportField, header: string | null) => {
    setImportMapping((previous) => {
      const next = { ...previous }
      if (header) {
        next[field] = header
      } else {
        delete next[field]
      }
      return next
    })
    if (field === "tag") {
      setTagValueMap(importPreview && header ? defaultTagValueMap(importPreview, header, existingTags) : {})
    }
    setValidationResult(null)
    setCommitResult(null)
    setImportError(null)
    setImportStep("map")
  }

  const openImportDialog = () => {
    resetImportState()
    setIsImportDialogOpen(true)
  }

  const closeImportDialog = () => {
    if (isPreviewing || isValidating || isImporting) {
      return
    }
    setIsImportDialogOpen(false)
  }
  const goToPreviousImportStep = () => {
    setImportError(null)
    if (importStep === "done") {
      setImportStep("review")
      return
    }
    if (importStep === "review") {
      setImportStep("tags")
      return
    }
    if (importStep === "tags") {
      setImportStep("categories")
      return
    }
    if (importStep === "categories") {
      setImportStep(needsDateSetup ? "dates" : "map")
      return
    }
    if (importStep === "dates") {
      setImportStep("map")
      return
    }
    if (importStep === "map") {
      setImportStep("upload")
    }
  }

  const goToNextImportStep = () => {
    setImportError(null)
    if (importStep === "upload" && importPreview) {
      setImportStep("map")
      return
    }
    if (importStep === "map" && requiredMappingComplete && !hasDuplicateMapping) {
      setImportStep(needsDateSetup ? "dates" : "categories")
      return
    }
    if (importStep === "dates" && dateSetupComplete) {
      setImportStep("categories")
      return
    }
    if (importStep === "categories" && categorySetupComplete) {
      setImportStep("tags")
      return
    }
    if (importStep === "tags" && canValidateImport) {
      void handleValidateImport()
    }
  }

  const handleCategoryModeChange = (mode: CategorySetupMode) => {
    setCategoryMode(mode)
    setValidationResult(null)
    setCommitResult(null)
    setImportError(null)
    setImportStep("categories")
  }

  const handleCategorySourceChange = (header: string) => {
    setCategorySourceHeader(header)
    setCategoryValueMap(importPreview && header ? defaultCategoryMap(importPreview, header) : {})
    setValidationResult(null)
    setCommitResult(null)
    setImportError(null)
    setImportStep("categories")
  }

  const handleCategoryValueChange = (sourceValue: string, category: Category) => {
    setCategoryValueMap((previous) => ({ ...previous, [sourceValue]: category }))
    setValidationResult(null)
    setCommitResult(null)
    setImportError(null)
    setImportStep("categories")
  }

  const handleDefaultCategoryChange = (category: Category) => {
    setDefaultCategory(category)
    setValidationResult(null)
    setCommitResult(null)
    setImportError(null)
    setImportStep("categories")
  }

  const handleDateYearChange = (year: string) => {
    setDateYear(year)
    setValidationResult(null)
    setCommitResult(null)
    setImportError(null)
    setImportStep("dates")
  }

  const handleTagValueChange = (sourceValue: string, entry: CsvImportTagStrategyEntry) => {
    setTagValueMap((previous) => ({ ...previous, [sourceValue]: entry }))
    setValidationResult(null)
    setCommitResult(null)
    setImportError(null)
    setImportStep("tags")
  }

  const handleValidateImport = async () => {
    if (!importFile) {
      return
    }

    setIsValidating(true)
    setImportError(null)
    setCommitResult(null)

    try {
      const result = await apiClient.importTransactions(importFile, "dry_run", effectiveImportMapping, resolvedCategoryStrategy, amountStrategy, resolvedDateStrategy, resolvedTagStrategy)
      setValidationResult(result)
      setImportStep("review")
    } catch (err) {
      if (err instanceof ApiError) {
        setImportError(err.error.message)
      } else {
        setImportError("Unable to validate CSV file.")
      }
    } finally {
      setIsValidating(false)
    }
  }

  const handleCommitImport = async () => {
    if (!importFile || !validationResult || validationResult.valid_rows <= 0) {
      return
    }

    setIsImporting(true)
    setImportError(null)

    try {
      const result = await apiClient.importTransactions(importFile, "commit", effectiveImportMapping, resolvedCategoryStrategy, amountStrategy, resolvedDateStrategy, resolvedTagStrategy)
      setCommitResult(result)
      setImportStep("done")
      await loadDataRuns()
    } catch (err) {
      if (err instanceof ApiError) {
        setImportError(err.error.message)
      } else {
        setImportError("Unable to import CSV file.")
      }
    } finally {
      setIsImporting(false)
    }
  }

  const handleExport = async () => {
    setExportError(null)

    let filters: { date_from?: string; date_to?: string } = {}
    if (exportDateMode === "custom") {
      const from = exportCustomFrom.trim()
      const to = exportCustomTo.trim()

      if (!from || !to) {
        setExportError("Select both a start and end date.")
        return
      }
      if (from > to) {
        setExportError("Start date must be before or equal to end date.")
        return
      }

      filters = {
        date_from: from,
        date_to: to,
      }
    }

    setIsExporting(true)

    try {
      const blob = await apiClient.exportTransactions(filters)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = "transactions.csv"
      anchor.click()
      URL.revokeObjectURL(url)
      await loadDataRuns()
    } catch (err) {
      if (err instanceof ApiError) {
        setExportError(err.error.message)
      } else {
        setExportError("Unable to export transactions.")
      }
    } finally {
      setIsExporting(false)
    }
  }

  const handleRollbackImport = async () => {
    if (!rollbackTarget) {
      return
    }

    const importRunId = importRunIdFromDataRun(rollbackTarget)
    if (!importRunId) {
      setRollbackError("Unable to identify this import.")
      return
    }

    setRollingBackImportId(rollbackTarget.id)
    setRollbackError(null)

    try {
      await apiClient.rollbackImport(importRunId)
      setRollbackTarget(null)
      await loadDataRuns()
    } catch (err) {
      if (err instanceof ApiError) {
        setRollbackError(err.error.message)
      } else {
        setRollbackError("Unable to rollback import.")
      }
    } finally {
      setRollingBackImportId(null)
    }
  }

  const requiredMappingComplete = HEADER_IMPORT_FIELDS
    .filter((field) => field.required)
    .every((field) => Boolean(importMapping[field.key]))
  const effectiveImportMapping = useMemo<CsvImportMapping>(() => {
    const mapping = { ...importMapping }
    if (categoryMode === "exact_column" && categorySourceHeader) {
      mapping.category = categorySourceHeader
    } else {
      delete mapping.category
    }
    return mapping
  }, [categoryMode, categorySourceHeader, importMapping])
  const mappedHeaders = Object.values(effectiveImportMapping).filter(Boolean)
  const hasDuplicateMapping = new Set(mappedHeaders).size !== mappedHeaders.length
  const categoryProfile = profileForHeader(importPreview, categorySourceHeader)
  const categoryValues = categoryProfile?.unique_values ?? []
  const dateProfile = dateProfileForHeader(importPreview, importMapping.date ?? "")
  const needsDateSetup = Boolean(dateProfile && dateProfile.yearless_date_count > 0)
  const dateSetupComplete = !needsDateSetup || Boolean(dateYear)
  const categorySetupComplete =
    categoryMode === "default" ||
    (categoryMode === "exact_column" && Boolean(categorySourceHeader)) ||
    (categoryMode === "value_map" &&
      Boolean(categorySourceHeader) &&
      !categoryProfile?.unique_values_truncated &&
      categoryValues.length > 0 &&
      categoryValues.every((item) => Boolean(categoryValueMap[item.value])))
  const tagProfile = profileForHeader(importPreview, importMapping.tag ?? "")
  const tagValues = tagProfile?.unique_values ?? []
  const tagSetupComplete = tagValues.length > 0 && tagValues.every((item) => Boolean(tagValueMap[item.value]))
  const resolvedCategoryStrategy = useMemo<CsvImportCategoryStrategy>(() => {
    if (categoryMode === "default") {
      return { mode: "default", default_category: defaultCategory }
    }
    if (categoryMode === "exact_column") {
      return { mode: "exact_column" }
    }
    return { mode: "value_map", source_header: categorySourceHeader, value_map: categoryValueMap }
  }, [categoryMode, categorySourceHeader, categoryValueMap, defaultCategory])
  const resolvedDateStrategy = useMemo<CsvImportDateStrategy>(() => {
    if (needsDateSetup) {
      return { missing_year: "apply_year", year: Number(dateYear) }
    }
    return { missing_year: "reject" }
  }, [dateYear, needsDateSetup])
  const resolvedTagStrategy = useMemo<CsvImportTagStrategy>(() => ({
    mode: "value_map",
    value_map: tagValueMap,
  }), [tagValueMap])
  const amountProfile = profileForHeader(importPreview, importMapping.amount ?? "")
  const canValidateImport = Boolean(importFile && importPreview && requiredMappingComplete && dateSetupComplete && categorySetupComplete && tagSetupComplete && !hasDuplicateMapping)
  const canCommitImport = Boolean(validationResult && validationResult.valid_rows > 0 && validationResult.status !== "failed")
  const importStepIndex = useMemo(() => {
    if (importStep === "upload") return 0
    if (importStep === "map") return 1
    if (importStep === "dates") return 2
    if (importStep === "categories") return 3
    if (importStep === "tags") return 4
    if (importStep === "review") return 5
    return 6
  }, [importStep])
  const selectedExportFromDate = parseIsoDate(exportCustomFrom)
  const selectedExportToDate = parseIsoDate(exportCustomTo)

  return (
    <div className="min-h-screen bg-background pb-mobile-nav">
      <header className="sticky top-0 z-40 bg-background/80 pt-safe-header backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center gap-4 px-5 py-4 lg:max-w-6xl lg:px-8">
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Back to settings">
              <ArrowLeft className="size-5" />
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold">Data Import / Export</h1>
            <p className="hidden text-sm text-muted-foreground sm:block">Move transaction data in and out of Budget.</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-5 px-4 pt-5 sm:px-5 lg:max-w-6xl lg:px-8">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-stretch">
          <Card className="border-0 p-4 shadow-sm sm:p-5">
            <div className="flex h-full flex-col gap-5">
              <div className="flex items-start justify-between gap-4">
                <PanelHeader icon={Upload} title="Import CSV" description="Bring in transactions from your bank or spreadsheet." />
              </div>

              <div className="grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {[
                  "Upload your file",
                  "Map columns",
                  "Review before importing",
                ].map((label, index) => (
                  <div key={label} className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>

              <Button type="button" className="mt-auto h-11 w-full rounded-lg" onClick={openImportDialog}>
                <Upload className="size-4" />
                Import CSV
              </Button>
            </div>
          </Card>

          <Card className="border-0 p-4 shadow-sm sm:p-5">
            <PanelHeader icon={Download} title="Export CSV" description="Download all transactions or a custom date range." />

            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setExportDateMode("all")
                    setExportError(null)
                  }}
                  className={cn(
                    "h-11 cursor-pointer rounded-lg border px-3 text-sm font-medium transition-colors",
                    exportDateMode === "all"
                      ? "border-secondary bg-secondary text-foreground"
                      : "border-border/70 bg-background text-muted-foreground hover:border-border hover:text-foreground"
                  )}
                >
                  All Time
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExportDateMode("custom")
                    setExportError(null)
                  }}
                  className={cn(
                    "h-11 cursor-pointer rounded-lg border px-3 text-sm font-medium transition-colors",
                    exportDateMode === "custom"
                      ? "border-secondary bg-secondary text-foreground"
                      : "border-border/70 bg-background text-muted-foreground hover:border-border hover:text-foreground"
                  )}
                >
                  Custom
                </button>
              </div>

              {exportDateMode === "custom" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>From</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 w-full justify-start rounded-lg border-border/60 px-3 font-normal hover:border-foreground/20"
                        >
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
                              setExportCustomFrom(toIsoDate(date))
                              setExportError(null)
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
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 w-full justify-start rounded-lg border-border/60 px-3 font-normal hover:border-foreground/20"
                        >
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
                              setExportCustomTo(toIsoDate(date))
                              setExportError(null)
                            }
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}

              {exportError && <p className="text-sm text-destructive">{exportError}</p>}

              <Button
                type="button"
                className="h-11 w-full rounded-lg"
                disabled={isExporting}
                onClick={() => void handleExport()}
              >
                {isExporting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Exporting
                  </>
                ) : (
                  <>
                    <Download className="size-4" />
                    Export CSV
                  </>
                )}
              </Button>
            </div>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Recent Activity</h2>
              <p className="text-xs text-muted-foreground">Latest imports and exports.</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-lg px-3"
              onClick={() => void loadDataRuns()}
              disabled={isLoadingRuns}
            >
              Refresh
            </Button>
          </div>

          {runsError && <p className="px-1 text-sm text-destructive">{runsError}</p>}

          {isLoadingRuns ? (
            <Card className="border-0 p-8 text-center shadow-sm">
              <Loader2 className="mx-auto mb-3 size-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading activity...</p>
            </Card>
          ) : dataRuns.length > 0 ? (
            <Card className="overflow-hidden border-0 shadow-sm divide-y divide-border">
              {dataRuns.slice(0, 10).map((item) => (
                <ActivityRow
                  key={item.id}
                  item={item}
                  onRollback={(target) => {
                    setRollbackError(null)
                    setRollbackTarget(target)
                  }}
                  isRollingBack={rollingBackImportId === item.id}
                />
              ))}
            </Card>
          ) : (
            <Card className="border-0 p-8 text-center shadow-sm">
              <Database className="mx-auto mb-4 size-12 text-muted-foreground" />
              <h3 className="mb-2 font-semibold">No data activity yet</h3>
              <p className="text-sm text-muted-foreground">Imports and exports will appear here after they run.</p>
            </Card>
          )}
        </section>
      </main>

      <ResponsiveDialog
        open={isImportDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsImportDialogOpen(true)
          } else {
            closeImportDialog()
          }
        }}
        title="Import CSV"
        description={
          <>
            {importStep === "upload" && "Choose the CSV file to preview before anything is imported."}
            {importStep === "map" && "Match CSV headers to Budget fields."}
            {importStep === "dates" && "Choose a year for dates that do not include one."}
            {importStep === "categories" && "Map imported labels into Needs, Wants, or Savings."}
            {importStep === "tags" && "Match imported labels to existing tags or create new ones."}
            {importStep === "review" && "Review validation results before importing."}
            {importStep === "done" && "Import complete."}
          </>
        }
        headerAccessory={<div className="md:w-[26rem]"><ImportStepper stepIndex={importStepIndex} /></div>}
        showCloseButton={!isPreviewing && !isValidating && !isImporting}
        closeDisabled={isPreviewing || isValidating || isImporting}
        desktopClassName="sm:!max-w-5xl"
        contentClassName="!max-w-none rounded-2xl sm:max-h-[min(820px,calc(100dvh-2rem))]"
        headerClassName="border-border/70 p-4 sm:p-5"
        bodyClassName="p-4 pb-28 sm:p-5 sm:pb-28"
        bodyMaxWidthClassName="mx-auto max-w-4xl space-y-4"
        footerClassName="border-border/70 sm:p-5"
        footer={
          <div className="mx-auto grid max-w-4xl gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
            <Button
              type="button"
              variant="ghost"
              className="h-11 rounded-lg sm:w-auto"
              disabled={importStep === "upload" || isPreviewing || isValidating || isImporting}
              onClick={goToPreviousImportStep}
            >
              Back
            </Button>
            <p className="hidden text-xs text-muted-foreground sm:block">
              {importStep === "upload" && "No data is written during preview."}
              {importStep === "map" && (needsDateSetup ? "Date setup comes next." : "Budget group setup comes next.")}
              {importStep === "dates" && "The selected year applies only to dates missing a year."}
              {importStep === "categories" && "Spending tag review comes next."}
              {importStep === "tags" && "Validation checks your CSV without writing data."}
              {importStep === "review" && "Import writes valid rows only."}
              {importStep === "done" && "You can start another import or close this dialog."}
            </p>
            <div className="grid gap-2 sm:flex sm:justify-end">
              {importStep === "done" ? (
                <>
                  <Button type="button" className="h-11 rounded-lg" onClick={closeImportDialog}>
                    Done
                  </Button>
                  <Button type="button" variant="secondary" className="h-11 rounded-lg" onClick={resetImportState}>
                    Import another CSV
                  </Button>
                </>
              ) : importStep === "review" ? (
                <Button
                  type="button"
                  className="h-11 rounded-lg"
                  disabled={!canCommitImport || isImporting}
                  onClick={() => void handleCommitImport()}
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Importing
                    </>
                  ) : (
                    validationResult ? `Import ${plannedImportCount(validationResult).toLocaleString()} rows` : "Import valid rows"
                  )}
                </Button>
              ) : importStep === "tags" ? (
                <Button
                  type="button"
                  className="h-11 rounded-lg"
                  disabled={!canValidateImport || isValidating || isImporting}
                  onClick={() => void handleValidateImport()}
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Validating
                    </>
                  ) : (
                    "Validate"
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  className="h-11 rounded-lg"
                  disabled={
                    (importStep === "upload" && !importPreview) ||
                    (importStep === "map" && (!requiredMappingComplete || hasDuplicateMapping)) ||
                    (importStep === "dates" && !dateSetupComplete) ||
                    (importStep === "categories" && !categorySetupComplete) ||
                    isPreviewing ||
                    isValidating ||
                    isImporting
                  }
                  onClick={goToNextImportStep}
                >
                  Continue
                </Button>
              )}
            </div>
          </div>
        }
      >
              {importError && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {importError}
                </div>
              )}

              {importStep === "upload" && (
                <div className="space-y-4">
                  <FilePicker
                    file={importFile}
                    preview={importPreview}
                    isBusy={isPreviewing || isValidating || isImporting}
                    isPreviewing={isPreviewing}
                    inputRef={fileInputRef}
                    onSelect={(file) => void handleFileSelect(file)}
                    onReset={resetImportState}
                  />
                  {importPreview && (
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
                      {pluralize(importPreview.headers.length, "column")} detected across {pluralize(importPreview.total_rows, "row")}. Nothing has been imported yet.
                    </div>
                  )}
                </div>
              )}

              {importStep === "map" && importPreview && (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold">Map columns</h3>
                      <p className="text-xs text-muted-foreground">Match CSV columns to Budget fields. {pluralize(importPreview.headers.length, "column")} detected.</p>
                    </div>
                    <MappingControls preview={importPreview} mapping={importMapping} onChange={handleMappingChange} />
                    {!requiredMappingComplete && (
                      <p className="text-xs text-destructive">Map every required field before continuing.</p>
                    )}
                    {hasDuplicateMapping && (
                      <p className="text-xs text-destructive">Each CSV header can only be mapped once.</p>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold">Sample rows</h3>
                      <p className="text-xs text-muted-foreground">Use this to confirm the selected columns look right.</p>
                    </div>
                    <MobileSampleRows preview={importPreview} mapping={importMapping} />
                    <div className="hidden md:block">
                      <SampleRows preview={importPreview} />
                    </div>
                  </div>
                </div>
              )}

              {importStep === "dates" && importPreview && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold">Set missing years</h3>
                    <p className="text-xs text-muted-foreground">Some dates do not include a year. Choose the year to apply before validation.</p>
                  </div>
                  <DateSetup profile={dateProfile} selectedYear={dateYear} onYearChange={handleDateYearChange} />
                </div>
              )}

              {importStep === "categories" && importPreview && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold">Budget group setup</h3>
                    <p className="text-xs text-muted-foreground">Map imported labels into Needs, Wants, or Savings.</p>
                  </div>
                  <CategorySetup
                    preview={importPreview}
                    mode={categoryMode}
                    sourceHeader={categorySourceHeader}
                    valueMap={categoryValueMap}
                    defaultCategory={defaultCategory}
                    onModeChange={handleCategoryModeChange}
                    onSourceChange={handleCategorySourceChange}
                    onValueChange={handleCategoryValueChange}
                    onDefaultCategoryChange={handleDefaultCategoryChange}
                  />
                  {!categorySetupComplete && (
                    <p className="text-xs text-destructive">Finish budget group setup before validation.</p>
                  )}
                  {amountProfile && amountProfile.blank_count > 0 && amountStrategy.blank_mapped_amount === "skip" && (
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                      {pluralize(amountProfile.blank_count, "row")} have a blank value in {importMapping.amount}. Those rows will be skipped instead of treated as errors.
                    </div>
                  )}
                </div>
              )}

              {importStep === "tags" && importPreview && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold">Spending tags</h3>
                    <p className="text-xs text-muted-foreground">Match imported labels to existing tags or create new ones.</p>
                  </div>
                  <TagSetup
                    preview={importPreview}
                    tagHeader={importMapping.tag ?? ""}
                    tags={existingTags}
                    valueMap={tagValueMap}
                    onChange={handleTagValueChange}
                  />
                  {!tagSetupComplete && (
                    <p className="text-xs text-destructive">Review every spending tag before validation.</p>
                  )}
                </div>
              )}

              {importStep === "review" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold">Review before importing</h3>
                    <p className="text-xs text-muted-foreground">Nothing is written yet. Only valid, non-duplicate rows will be imported.</p>
                  </div>
                  {validationResult ? (
                    <ResultSummary result={validationResult} mode="review" />
                  ) : (
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                      Validate the import to see what will be imported, skipped, or created.
                    </div>
                  )}
                  {importPreview && (
                    <div className="hidden md:block">
                      <SampleRows preview={importPreview} />
                    </div>
                  )}
                </div>
              )}

              {importStep === "done" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold">Import complete</h3>
                    <p className="text-xs text-muted-foreground">Recent Activity has been refreshed.</p>
                  </div>
                  {commitResult && <ResultSummary result={commitResult} mode="complete" />}
                </div>
              )}
      </ResponsiveDialog>

      <ResponsiveConfirmDialog
        open={!!rollbackTarget}
        onOpenChange={(open) => {
          if (!open && !rollingBackImportId) {
            setRollbackTarget(null)
            setRollbackError(null)
          }
        }}
        title="Rollback import?"
        description="This will remove the transactions created by this import. Tags and cards will stay."
        confirmLabel={rollingBackImportId ? "Rolling back..." : "Rollback import"}
        confirmVariant="destructive"
        confirmDisabled={!!rollingBackImportId}
        closeDisabled={!!rollingBackImportId}
        onConfirm={() => void handleRollbackImport()}
      >
        <>
          {rollbackTarget && (
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
              <p className="truncate font-medium">{rollbackTarget.source_filename || "CSV import"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {rollbackTarget.imported_rows ?? 0} imported on {formatDateTimeValue(rollbackTarget.created_at, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
          )}
          {rollbackError && <p className="text-sm text-destructive">{rollbackError}</p>}
        </>
      </ResponsiveConfirmDialog>

      <BottomNav />
    </div>
  )
}
