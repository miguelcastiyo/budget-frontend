"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ComponentType, DragEvent, RefObject } from "react"
import Link from "next/link"
import { ArrowLeft, CalendarIcon, CheckCircle2, CreditCard, Database, Download, FileUp, Loader2, Tags, Upload, XCircle } from "lucide-react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ApiError, apiClient } from "@/lib/api/client"
import type { CsvImportField, CsvImportMapping, CsvImportPreviewResponse, CsvImportResponse, DataRunItem, DataRunStatus } from "@/lib/api/types"
import { parseIsoDate, toIsoDate } from "@/lib/date-filters"
import { getTagIcon } from "@/lib/tag-icons"
import { cn } from "@/lib/utils"

type ExportDateMode = "all" | "custom"
type ImportStep = "upload" | "map" | "review" | "done"

const IMPORT_FIELDS: Array<{ key: CsvImportField; label: string; required: boolean; hint: string }> = [
  { key: "date", label: "Date", required: true, hint: "Transaction date" },
  { key: "expense", label: "Expense", required: true, hint: "Merchant or description" },
  { key: "amount", label: "Amount", required: true, hint: "Positive amount" },
  { key: "category", label: "Category", required: true, hint: "Needs, wants, savings/debts" },
  { key: "tag", label: "Tag", required: true, hint: "Creates missing tags on import" },
  { key: "card", label: "Card", required: false, hint: "Creates missing cards on import" },
  { key: "is_split", label: "Split", required: false, hint: "Optional true/false flag" },
]

const NONE_VALUE = "__none"

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatDateOnly(value: string | null): string {
  if (!value) {
    return "All time"
  }

  const [yearRaw, monthRaw, dayRaw] = value.split("-")
  const date = new Date(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw))
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function statusLabel(status: DataRunStatus): string {
  if (status === "started") return "Started"
  if (status === "completed") return "Completed"
  if (status === "partial") return "Partial"
  return "Failed"
}

function statusClassName(status: DataRunStatus): string {
  if (status === "completed") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  if (status === "partial") return "bg-amber-500/10 text-amber-700 dark:text-amber-300"
  if (status === "started") return "bg-blue-500/10 text-blue-700 dark:text-blue-300"
  return "bg-destructive/10 text-destructive"
}

function ResultSummary({ result }: { result: CsvImportResponse }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
      <div className="flex items-start gap-3">
        {result.status === "failed" ? (
          <XCircle className="mt-0.5 size-5 text-destructive" />
        ) : (
          <CheckCircle2 className="mt-0.5 size-5 text-emerald-600" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium">{result.message}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
            <Stat label="Rows" value={result.total_rows} />
            <Stat label="Valid" value={result.valid_rows} />
            <Stat label="Imported" value={result.imported_rows} />
            <Stat label="Duplicates" value={result.duplicate_rows} />
            <Stat label="Invalid" value={result.invalid_rows} />
          </div>
          {result.errors.length > 0 && (
            <div className="mt-3 max-h-44 space-y-1.5 overflow-y-auto rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              {result.errors.slice(0, 8).map((errorItem, index) => (
                <p key={`${errorItem.row}-${errorItem.field}-${index}`} className="text-xs text-destructive">
                  Row {errorItem.row} ({errorItem.field}): {errorItem.message}
                </p>
              ))}
              {(result.errors_truncated || result.errors.length > 8) && (
                <p className="pt-1 text-[11px] text-muted-foreground">
                  Showing the first {Math.min(8, result.errors.length)} error(s).
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
                    New Tags
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
                    New Cards
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
  const steps = ["Upload", "Map", "Review", "Import"]

  return (
    <div className="grid grid-cols-4 rounded-xl border border-border/70 bg-muted/20 p-1">
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
              {(file.size / 1024).toFixed(1)} KB - {preview.total_rows} row(s)
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
  onChange: (field: CsvImportField, header: string | null) => void
}) {
  const usedHeaders = new Set(Object.values(mapping).filter(Boolean))

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-background">
      {IMPORT_FIELDS.map((field) => {
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

  const mappedFields = IMPORT_FIELDS.filter((field) => mapping[field.key])

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

function ActivityRow({ item }: { item: DataRunItem }) {
  const rangeLabel = item.type === "export"
    ? item.date_from && item.date_to
      ? `${formatDateOnly(item.date_from)} - ${formatDateOnly(item.date_to)}`
      : "All time"
    : item.source_filename || "CSV import"

  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
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
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", statusClassName(item.status))}>
              {statusLabel(item.status)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{rangeLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.created_at)}</p>
          {item.type === "import" && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{item.imported_rows ?? 0} imported</span>
              <span>{item.duplicate_rows ?? 0} duplicates</span>
              <span>{item.invalid_rows ?? 0} invalid</span>
            </div>
          )}
          {item.error_summary && (
            <p className="mt-2 text-xs text-destructive">{item.error_summary}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DataSettingsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dataRuns, setDataRuns] = useState<DataRunItem[]>([])
  const [isLoadingRuns, setIsLoadingRuns] = useState(true)
  const [runsError, setRunsError] = useState<string | null>(null)

  const [importFile, setImportFile] = useState<File | null>(null)
  const [importStep, setImportStep] = useState<ImportStep>("upload")
  const [importPreview, setImportPreview] = useState<CsvImportPreviewResponse | null>(null)
  const [importMapping, setImportMapping] = useState<CsvImportMapping>({})
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

  const resetImportState = () => {
    setImportFile(null)
    setImportStep("upload")
    setImportPreview(null)
    setImportMapping({})
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
      const preview = await apiClient.previewImportTransactions(file)
      setImportPreview(preview)
      setImportMapping(preview.suggested_mapping)
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

  const handleMappingChange = (field: CsvImportField, header: string | null) => {
    setImportMapping((previous) => {
      const next = { ...previous }
      if (header) {
        next[field] = header
      } else {
        delete next[field]
      }
      return next
    })
    setValidationResult(null)
    setCommitResult(null)
    setImportError(null)
    setImportStep("map")
  }

  const handleValidateImport = async () => {
    if (!importFile) {
      return
    }

    setIsValidating(true)
    setImportError(null)
    setCommitResult(null)

    try {
      const result = await apiClient.importTransactions(importFile, "dry_run", importMapping)
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
      const result = await apiClient.importTransactions(importFile, "commit", importMapping)
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

  const requiredMappingComplete = IMPORT_FIELDS
    .filter((field) => field.required)
    .every((field) => Boolean(importMapping[field.key]))
  const mappedHeaders = Object.values(importMapping).filter(Boolean)
  const hasDuplicateMapping = new Set(mappedHeaders).size !== mappedHeaders.length
  const canValidateImport = Boolean(importFile && importPreview && requiredMappingComplete && !hasDuplicateMapping)
  const canCommitImport = Boolean(validationResult && validationResult.valid_rows > 0 && validationResult.status !== "failed")
  const importStepIndex = useMemo(() => {
    if (importStep === "upload") return 0
    if (importStep === "map") return 1
    if (importStep === "review") return 2
    return 3
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

      <main className="mx-auto grid max-w-lg gap-5 px-4 pt-4 sm:px-5 lg:max-w-7xl lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:px-8">
        <section className="space-y-4">
          <Card className="overflow-hidden border-0 shadow-sm">
            <div className="border-b border-border/70 p-4 sm:p-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center">
                <PanelHeader icon={Upload} title="Import CSV" description="Map uploaded columns, review validation, then import valid rows." />
                <ImportStepper stepIndex={importStepIndex} />
              </div>
            </div>

            <div className="space-y-5 p-4 sm:p-5">
              <FilePicker
                file={importFile}
                preview={importPreview}
                isBusy={isPreviewing || isValidating || isImporting}
                isPreviewing={isPreviewing}
                inputRef={fileInputRef}
                onSelect={(file) => void handleFileSelect(file)}
                onReset={resetImportState}
              />

              {importError && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {importError}
                </div>
              )}

              {importPreview && (
                <div className="grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                  <div className="space-y-3">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold">Map headers</h3>
                        <p className="text-xs text-muted-foreground">{importPreview.headers.length} column(s) detected.</p>
                      </div>
                      {validationResult && (
                        <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg px-2 text-xs" onClick={() => setImportStep("map")}>
                          Edit mapping
                        </Button>
                      )}
                    </div>
                    <MappingControls preview={importPreview} mapping={importMapping} onChange={handleMappingChange} />
                    {!requiredMappingComplete && (
                      <p className="text-xs text-destructive">Map every required field before validation.</p>
                    )}
                    {hasDuplicateMapping && (
                      <p className="text-xs text-destructive">Each CSV header can only be mapped once.</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold">Review</h3>
                      <p className="text-xs text-muted-foreground">
                        {validationResult ? "Validation results and planned new items." : "Sample values from the selected mapping."}
                      </p>
                    </div>
                    <MobileSampleRows preview={importPreview} mapping={importMapping} />
                    <div className="hidden md:block">
                      <SampleRows preview={importPreview} />
                    </div>
                    {validationResult && <ResultSummary result={validationResult} />}
                    {commitResult && <ResultSummary result={commitResult} />}
                  </div>
                </div>
              )}

              {importPreview && (
                <div className="grid gap-2 border-t border-border/70 pt-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                  <p className="text-xs text-muted-foreground">
                    {canCommitImport ? "Validated rows are ready to import." : "Validate the mapping before importing."}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
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
                      "Validate Mapping"
                    )}
                  </Button>
                  <Button
                    type="button"
                    className="h-11 rounded-lg"
                    disabled={!canCommitImport || isValidating || isImporting}
                    onClick={() => void handleCommitImport()}
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Importing
                      </>
                    ) : (
                      "Import Valid Rows"
                    )}
                  </Button>
                </div>
              )}
            </div>
          </Card>

          <Card className="border-0 p-4 shadow-sm sm:p-5 lg:hidden">
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
                          <span className="truncate">{selectedExportFromDate ? formatDateOnly(exportCustomFrom) : "Select start date"}</span>
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
                          <span className="truncate">{selectedExportToDate ? formatDateOnly(exportCustomTo) : "Select end date"}</span>
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

        <section className="space-y-4 lg:sticky lg:top-24">
          <Card className="hidden border-0 p-4 shadow-sm lg:block">
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
                    "h-10 cursor-pointer rounded-lg border px-3 text-sm font-medium transition-colors",
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
                    "h-10 cursor-pointer rounded-lg border px-3 text-sm font-medium transition-colors",
                    exportDateMode === "custom"
                      ? "border-secondary bg-secondary text-foreground"
                      : "border-border/70 bg-background text-muted-foreground hover:border-border hover:text-foreground"
                  )}
                >
                  Custom
                </button>
              </div>

              {exportDateMode === "custom" && (
                <div className="grid gap-3">
                  <div className="space-y-2">
                    <Label>From</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 w-full justify-start rounded-lg border-border/60 px-3 font-normal hover:border-foreground/20"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{selectedExportFromDate ? formatDateOnly(exportCustomFrom) : "Select start date"}</span>
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
                          className="h-10 w-full justify-start rounded-lg border-border/60 px-3 font-normal hover:border-foreground/20"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{selectedExportToDate ? formatDateOnly(exportCustomTo) : "Select end date"}</span>
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
                className="h-10 w-full rounded-lg"
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
                <ActivityRow key={item.id} item={item} />
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

      <BottomNav />
    </div>
  )
}
