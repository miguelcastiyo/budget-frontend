"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Database, Download, FileUp, Loader2, Upload, XCircle } from "lucide-react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError, apiClient } from "@/lib/api/client"
import type { CsvImportResponse, DataRunItem, DataRunStatus } from "@/lib/api/types"
import { cn } from "@/lib/utils"

type ExportDateMode = "all" | "custom"
type DataView = "activity" | "import" | "export"

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
  const [activeView, setActiveView] = useState<DataView>("activity")
  const [dataRuns, setDataRuns] = useState<DataRunItem[]>([])
  const [isLoadingRuns, setIsLoadingRuns] = useState(true)
  const [runsError, setRunsError] = useState<string | null>(null)

  const [importFile, setImportFile] = useState<File | null>(null)
  const [validationResult, setValidationResult] = useState<CsvImportResponse | null>(null)
  const [commitResult, setCommitResult] = useState<CsvImportResponse | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
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
    setValidationResult(null)
    setCommitResult(null)
    setImportError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleFileSelect = (file: File | null) => {
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
  }

  const handleValidateImport = async () => {
    if (!importFile) {
      return
    }

    setIsValidating(true)
    setImportError(null)
    setCommitResult(null)

    try {
      const result = await apiClient.importTransactions(importFile, "dry_run")
      setValidationResult(result)
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
      const result = await apiClient.importTransactions(importFile, "commit")
      setCommitResult(result)
      await loadDataRuns()
      setActiveView("activity")
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
      setActiveView("activity")
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

  const canCommitImport = Boolean(validationResult && validationResult.valid_rows > 0 && validationResult.status !== "failed")

  const pillButtonClassName = (view: DataView) =>
    cn(
      "h-10 flex-1 rounded-full border px-3 text-sm font-medium transition-colors sm:flex-none sm:px-4",
      activeView === view
        ? "border-secondary bg-secondary text-foreground shadow-sm"
        : "border-border/70 bg-background text-muted-foreground hover:border-border hover:text-foreground"
    )

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

        <div className="mx-auto max-w-lg px-5 pb-3 lg:max-w-6xl lg:px-8">
          <div className="flex gap-2 overflow-x-auto rounded-full border border-border/60 bg-muted/40 p-1 shadow-sm scrollbar-hide">
            <button
              type="button"
              className={pillButtonClassName("activity")}
              onClick={() => setActiveView("activity")}
            >
              Recent Activity
            </button>
            <button
              type="button"
              className={pillButtonClassName("import")}
              onClick={() => setActiveView("import")}
            >
              Import
            </button>
            <button
              type="button"
              className={pillButtonClassName("export")}
              onClick={() => setActiveView("export")}
            >
              Export
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-5 px-5 pt-4 lg:max-w-6xl lg:px-8">
        {activeView === "activity" && (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Recent Activity</h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-full px-3"
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
                {dataRuns.map((item) => (
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
        )}

        {activeView === "import" && (
          <Card className="border-0 p-4 shadow-sm sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
                <Upload className="size-5 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Import CSV</h2>
                <p className="text-sm text-muted-foreground">Validate a CSV before importing valid transaction rows.</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <button
                type="button"
                className={cn(
                  "w-full rounded-2xl border-2 border-dashed p-6 text-center transition-colors",
                  importFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(event) => handleFileSelect(event.target.files?.[0] ?? null)}
                />
                {importFile ? (
                  <div className="space-y-2">
                    <FileUp className="mx-auto size-9 text-primary" />
                    <p className="font-medium">{importFile.name}</p>
                    <p className="text-sm text-muted-foreground">{(importFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="mx-auto size-9 text-muted-foreground" />
                    <p className="font-medium">Choose CSV file</p>
                    <p className="text-sm text-muted-foreground">CSV files only</p>
                  </div>
                )}
              </button>

              {importFile && (
                <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={resetImportState}>
                  Choose different file
                </Button>
              )}

              {importError && <p className="text-sm text-destructive">{importError}</p>}
              {validationResult && <ResultSummary result={validationResult} />}
              {commitResult && <ResultSummary result={commitResult} />}

              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11 rounded-xl"
                  disabled={!importFile || isValidating || isImporting}
                  onClick={() => void handleValidateImport()}
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Validating
                    </>
                  ) : (
                    "Validate CSV"
                  )}
                </Button>
                <Button
                  type="button"
                  className="h-11 rounded-xl"
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
            </div>
          </Card>
        )}

        {activeView === "export" && (
          <Card className="border-0 p-4 shadow-sm sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
                <Download className="size-5 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Export CSV</h2>
                <p className="text-sm text-muted-foreground">Download all transactions or a custom date range.</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setExportDateMode("all")
                    setExportError(null)
                  }}
                  className={cn(
                    "h-11 cursor-pointer rounded-xl border px-3 text-sm font-medium transition-colors",
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
                    "h-11 cursor-pointer rounded-xl border px-3 text-sm font-medium transition-colors",
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
                    <Label htmlFor="export-from">From</Label>
                    <Input
                      id="export-from"
                      type="date"
                      value={exportCustomFrom}
                      onChange={(event) => setExportCustomFrom(event.target.value)}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="export-to">To</Label>
                    <Input
                      id="export-to"
                      type="date"
                      value={exportCustomTo}
                      onChange={(event) => setExportCustomTo(event.target.value)}
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>
              )}

              {exportError && <p className="text-sm text-destructive">{exportError}</p>}

              <Button
                type="button"
                className="h-11 w-full rounded-xl"
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
        )}
      </main>

      <BottomNav />
    </div>
  )
}
