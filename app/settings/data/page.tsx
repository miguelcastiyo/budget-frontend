"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Database, Download, Loader2, Upload } from "lucide-react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { ResponsiveConfirmDialog } from "@/components/ui/responsive-confirm-dialog"
import { ApiError } from "@/lib/api/client"
import type { Category, CsvImportAmountStrategy, CsvImportMapping, CsvImportPreviewResponse, CsvImportResponse, CsvImportTagStrategyEntry, DataRunItem, Tag } from "@/lib/api/types"
import { formatDateTimeValue } from "@/lib/date-filters"
import { cn } from "@/lib/utils"
import {
  ActivityRow,
  CategorySetup,
  DateSetup,
  ExportDateFields,
  FilePicker,
  ImportReviewNotice,
  ImportStepper,
  MappingControls,
  MobileSampleRows,
  PanelHeader,
  ResultSummary,
  SampleRows,
  TagSetup,
} from "./_components/data-settings-sections"
import { useDataRuns } from "./_hooks/use-data-runs"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"
import { commitEncryptedCsvImport, exportEncryptedTransactionsCsv, getEncryptedImportTags, planEncryptedCsvImport, repairEncryptedCsvImportLineage, rollbackEncryptedCsvImport } from "@/lib/privacy/encrypted-authority/import-operations"
import {
  bestCategorySource,
  createEmptyImportState,
  currentImportYear,
  dateProfileForHeader,
  defaultCategoryMap,
  defaultTagValueMap,
  HEADER_IMPORT_FIELDS,
  importRunIdFromDataRun,
  importStepIndex,
  nextImportStep,
  plannedImportCount,
  previousImportStep,
  pluralize,
  profileForHeader,
  type CategorySetupMode,
  type ExportDateMode,
  type HeaderImportField,
  type ImportStep,
} from "./_lib/import-export"

function parseCsvText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const rows: string[][] = []
  let row: string[] = [], cell = "", quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1 } else quoted = !quoted
    } else if (character === "," && !quoted) { row.push(cell); cell = "" } else if ((character === "\n" || character === "\r") && !quoted) { if (character === "\r" && text[index + 1] === "\n") index += 1; row.push(cell); if (row.some((value) => value.trim())) rows.push(row); row = []; cell = "" } else cell += character
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const headers = rows.shift()?.map((value) => value.trim()) ?? []
  return { headers, rows: rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))) }
}

export default function DataSettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { dataRuns, isLoadingRuns, runsError, loadDataRuns } = useDataRuns(50)
  const authority = useFinancialAuthority()
  const [rollbackTarget, setRollbackTarget] = useState<DataRunItem | null>(null)
  const [rollbackError, setRollbackError] = useState<string | null>(null)
  const [rollingBackImportId, setRollingBackImportId] = useState<string | null>(null)
  const [repairTarget, setRepairTarget] = useState<DataRunItem | null>(null)
  const [repairError, setRepairError] = useState<string | null>(null)
  const [repairingImportId, setRepairingImportId] = useState<string | null>(null)

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

  useEffect(() => {
    if (searchParams.get("start_import") !== "1") {
      return
    }

    openImportDialog()
    router.replace("/settings/data")
  }, [router, searchParams])

  const resetImportState = () => {
    const nextState = createEmptyImportState()
    setImportFile(nextState.importFile)
    setImportStep(nextState.importStep)
    setImportPreview(nextState.importPreview)
    setImportMapping(nextState.importMapping)
    setDateYear(nextState.dateYear)
    setCategoryMode(nextState.categoryMode)
    setCategorySourceHeader(nextState.categorySourceHeader)
    setCategoryValueMap(nextState.categoryValueMap)
    setTagValueMap(nextState.tagValueMap)
    setDefaultCategory(nextState.defaultCategory)
    setAmountStrategy({ blank_mapped_amount: "skip" })
    setValidationResult(null)
    setCommitResult(null)
    setImportError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleFileSelect = async (file: File | null) => {
    const nextState = createEmptyImportState()
    setImportStep(nextState.importStep)
    setImportPreview(nextState.importPreview)
    setImportMapping(nextState.importMapping)
    setDateYear(nextState.dateYear)
    setCategoryMode(nextState.categoryMode)
    setCategorySourceHeader(nextState.categorySourceHeader)
    setCategoryValueMap(nextState.categoryValueMap)
    setTagValueMap(nextState.tagValueMap)
    setDefaultCategory(nextState.defaultCategory)
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
      if (authority.authority) {
        const parsed = parseCsvText(await file.text())
        const lower = new Map(parsed.headers.map((header) => [header.toLowerCase(), header]))
        const suggestedMapping: CsvImportMapping = {}
        for (const field of ["date", "expense", "amount", "category", "tag", "card", "context", "is_split", "notes"] as const) {
          const header = lower.get(field) ?? lower.get(field.replace("is_split", "is split"))
          if (header) suggestedMapping[field] = header
        }
        const preview: CsvImportPreviewResponse = { mode: "preview", headers: parsed.headers, sample_rows: parsed.rows.slice(0, 5), column_profiles: parsed.headers.map((header) => ({ header, blank_count: parsed.rows.filter((item) => !item[header]?.trim()).length, unique_values_truncated: false, unique_values: [...new Set(parsed.rows.map((item) => item[header] ?? ""))].filter(Boolean).slice(0, 100).map((value) => ({ value, count: parsed.rows.filter((item) => item[header] === value).length })) })), date_profiles: [], suggested_mapping: suggestedMapping, total_rows: parsed.rows.length, limits: { max_bytes: 10_000_000, max_rows: 100_000, max_returned_errors: 100 } }
        const tagsResponse = getEncryptedImportTags(authority.authority)
        setImportPreview(preview); setExistingTags(tagsResponse); setImportMapping(suggestedMapping); setDateYear(String(currentImportYear())); setCategoryMode(suggestedMapping.category ? "exact_column" : "default"); setCategorySourceHeader(suggestedMapping.category ?? ""); setCategoryValueMap({}); setTagValueMap({}); setImportStep("map")
        return
      }
      throw new Error("ENCRYPTED_AUTHORITY_REQUIRED")
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
    const previousStep = previousImportStep(importStep, needsDateSetup)
    if (previousStep) {
      setImportStep(previousStep)
    }
  }

  const goToNextImportStep = () => {
    setImportError(null)
    const nextStep = nextImportStep(importStep, {
      importPreview,
      requiredMappingComplete,
      hasDuplicateMapping,
      needsDateSetup,
      dateSetupComplete,
      categorySetupComplete,
      canValidateImport,
    })
    if (nextStep === "review") {
      void handleValidateImport()
      return
    }
    if (nextStep) {
      setImportStep(nextStep)
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
      if (authority.authority) {
        const plan = await buildEncryptedPlan()
        setValidationResult({ status: plan.errors.length ? "partial" : "completed", message: "CSV validated locally", mode: "dry_run", total_rows: plan.accepted.length + plan.errors.length + plan.duplicates.length, valid_rows: plan.accepted.length, imported_rows: 0, duplicate_rows: plan.duplicates.length, invalid_rows: plan.errors.length, skipped_rows: plan.skippedBlankAmountRows, skipped_blank_amount_rows: plan.skippedBlankAmountRows, errors_truncated: false, max_returned_errors: 100, errors: plan.errors, new_tags: plan.newTags.map((name) => ({ name, icon_key: "" })), new_cards: plan.newCards.map((name) => ({ name })) })
        setImportStep("review")
        return
      }
      throw new Error("ENCRYPTED_AUTHORITY_REQUIRED")
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
      if (authority.authority) {
        const plan = await buildEncryptedPlan()
        await commitEncryptedCsvImport(authority.authority, plan, importFile.name)
        setCommitResult({ status: plan.errors.length ? "partial" : "completed", message: "CSV imported into encrypted authority", mode: "commit", total_rows: plan.accepted.length + plan.errors.length + plan.duplicates.length, valid_rows: plan.accepted.length, imported_rows: plan.accepted.length, duplicate_rows: plan.duplicates.length, invalid_rows: plan.errors.length, skipped_rows: plan.skippedBlankAmountRows, skipped_blank_amount_rows: plan.skippedBlankAmountRows, errors_truncated: false, max_returned_errors: 100, errors: plan.errors, new_tags: plan.newTags.map((name) => ({ name, icon_key: "" })), new_cards: plan.newCards.map((name) => ({ name })) })
        setImportStep("done")
        await loadDataRuns()
        return
      }
      throw new Error("ENCRYPTED_AUTHORITY_REQUIRED")
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
      if (authority.authority) {
        const csv = exportEncryptedTransactionsCsv(authority.authority, filters)
        const blob = new Blob([csv], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement("a")
        anchor.href = url
        anchor.download = "transactions.csv"
        anchor.click()
        URL.revokeObjectURL(url)
        setIsExporting(false)
        return
      }
      throw new Error("ENCRYPTED_AUTHORITY_REQUIRED")
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
      if (authority.authority) {
        await rollbackEncryptedCsvImport(authority.authority, importRunId)
      } else {
        throw new Error("ENCRYPTED_AUTHORITY_REQUIRED")
      }
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

  const handleRepairImport = async () => {
    if (!repairTarget || !authority.authority) return
    setRepairingImportId(repairTarget.id)
    setRepairError(null)
    try {
      await repairEncryptedCsvImportLineage(authority.authority, repairTarget.id)
      setRepairTarget(null)
      await loadDataRuns()
    } catch (err) {
      setRepairError(err instanceof Error ? err.message : "Unable to repair import rollback history.")
    } finally {
      setRepairingImportId(null)
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
  const needsDateSetup = Boolean(dateProfile?.yearless_date_count)
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
  const buildEncryptedPlan = async () => {
    if (!importFile || !authority.authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED")
    const parsed = parseCsvText(await importFile.text())
    const contextHeader = effectiveImportMapping.context ?? parsed.headers.find((header) => header.trim().toLowerCase() === "context")
    const rows = parsed.rows.map((item, index) => ({ row: index + 2, date: item[effectiveImportMapping.date ?? ""] ?? "", expense: item[effectiveImportMapping.expense ?? ""] ?? "", amount: item[effectiveImportMapping.amount ?? ""] ?? "", externalCategory: item[effectiveImportMapping.category ?? categorySourceHeader] ?? defaultCategory, tag: item[effectiveImportMapping.tag ?? ""] ?? "", card: item[effectiveImportMapping.card ?? ""] ?? "", context: contextHeader ? item[contextHeader] ?? "" : "", notes: item[effectiveImportMapping.notes ?? ""] ?? "", isSplit: (item[effectiveImportMapping.is_split ?? ""] ?? "").toLowerCase() === "true" }))
    return planEncryptedCsvImport(authority.authority, rows, { year: Number(dateYear) || currentImportYear(), tagValueMap })
  }
  const amountProfile = profileForHeader(importPreview, importMapping.amount ?? "")
  const canValidateImport = Boolean(importFile && importPreview && requiredMappingComplete && dateSetupComplete && categorySetupComplete && (Boolean(authority.authority) || tagSetupComplete) && !hasDuplicateMapping)
  const canCommitImport = Boolean(validationResult && validationResult.valid_rows > 0 && validationResult.status !== "failed")
  const currentImportStepIndex = useMemo(() => importStepIndex(importStep), [importStep])

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
                <ExportDateFields
                  exportCustomFrom={exportCustomFrom}
                  exportCustomTo={exportCustomTo}
                  onFromChange={(value) => {
                    setExportCustomFrom(value)
                    setExportError(null)
                  }}
                  onToChange={(value) => {
                    setExportCustomTo(value)
                    setExportError(null)
                  }}
                />
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
                  onRepair={(target) => {
                    setRepairError(null)
                    setRepairTarget(target)
                  }}
                  isRollingBack={rollingBackImportId === item.id}
                  isRepairing={repairingImportId === item.id}
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
        headerAccessory={<div className="md:w-[26rem]"><ImportStepper stepIndex={currentImportStepIndex} /></div>}
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
                    <MappingControls preview={importPreview} mapping={importMapping} onChange={handleMappingChange} includeContext={Boolean(authority.authority)} />
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
                  <DateSetup preview={importPreview} dateHeader={importMapping.date ?? ""} selectedYear={dateYear} onYearChange={handleDateYearChange} />
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
                  <ImportReviewNotice amountProfile={amountProfile} amountStrategy={amountStrategy} amountHeader={importMapping.amount} />
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

      <ResponsiveConfirmDialog
        open={!!repairTarget}
        onOpenChange={(open) => {
          if (!open && !repairingImportId) {
            setRepairTarget(null)
            setRepairError(null)
          }
        }}
        title="Repair rollback history?"
        description="This will restore the encrypted import markers needed to roll back this historical import. No transaction or taxonomy content will be changed."
        confirmLabel={repairingImportId ? "Repairing..." : "Repair history"}
        confirmDisabled={!!repairingImportId}
        closeDisabled={!!repairingImportId}
        onConfirm={() => void handleRepairImport()}
      >
        <>
          {repairTarget && (
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
              <p className="truncate font-medium">{repairTarget.source_filename || "CSV import"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{repairTarget.imported_rows ?? 0} imported transactions will be linked to this import.</p>
            </div>
          )}
          {repairError && <p className="text-sm text-destructive">Unable to repair this import automatically. Refresh and try again.</p>}
        </>
      </ResponsiveConfirmDialog>

      <BottomNav />
    </div>
  )
}
