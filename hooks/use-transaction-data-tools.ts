"use client"

import { useCallback, useState } from "react"
import { format } from "date-fns"
import { ApiError, apiClient } from "@/lib/api/client"
import { getPresetDateRange, parseIsoDate } from "@/lib/date-filters"
import type { CsvImportErrorItem, Preset, TransactionFilters as ApiTransactionFilters } from "@/lib/api/types"

type PartialDateRange = {
  date_from?: string
  date_to?: string
}

function monthToDateRange() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  return {
    date_from: format(startOfMonth, "yyyy-MM-dd"),
    date_to: format(now, "yyyy-MM-dd"),
  }
}

export function useTransactionDataTools() {
  const [showImportModal, setShowImportModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportPreset, setExportPreset] = useState<Preset | "custom">("month_to_date")
  const [exportCustomFrom, setExportCustomFrom] = useState("")
  const [exportCustomTo, setExportCustomTo] = useState("")
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importStatus, setImportStatus] = useState<"idle" | "uploading" | "success" | "warning" | "error">("idle")
  const [importMessage, setImportMessage] = useState("")
  const [importErrors, setImportErrors] = useState<CsvImportErrorItem[]>([])

  const exportTransactions = useCallback(async (dateRange: PartialDateRange) => {
    const filters: ApiTransactionFilters = {
      ...dateRange,
      sort: "date_desc",
    }
    const blob = await apiClient.exportTransactions(filters)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "transactions.csv"
    anchor.click()
    URL.revokeObjectURL(url)
  }, [])

  const openExportModal = useCallback(() => {
    const defaultRange = monthToDateRange()

    setExportError(null)
    setExportPreset("month_to_date")
    setExportCustomFrom(defaultRange.date_from)
    setExportCustomTo(defaultRange.date_to)
    setShowExportModal(true)
  }, [])

  const selectExportPreset = useCallback((next: Preset | "custom") => {
    setExportPreset(next)
    setExportError(null)

    if (next !== "custom" || (exportCustomFrom && exportCustomTo)) {
      return
    }

    const defaultRange = monthToDateRange()
    setExportCustomFrom(defaultRange.date_from)
    setExportCustomTo(defaultRange.date_to)
  }, [exportCustomFrom, exportCustomTo])

  const confirmExport = useCallback(async () => {
    try {
      setExportError(null)
      setIsExporting(true)

      let range: PartialDateRange
      if (exportPreset === "custom") {
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

        range = {
          date_from: from,
          date_to: to,
        }
      } else {
        range = getPresetDateRange(exportPreset)
      }

      await exportTransactions(range)
      setShowExportModal(false)
    } catch (err) {
      if (err instanceof ApiError) {
        setExportError(err.error.message)
      } else {
        setExportError("Unable to export transactions")
      }
    } finally {
      setIsExporting(false)
    }
  }, [exportCustomFrom, exportCustomTo, exportPreset, exportTransactions])

  const handleImportFileSelect = useCallback((file: File | null) => {
    if (file) {
      if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
        setImportStatus("error")
        setImportMessage("Please select a valid CSV file")
        return
      }

      setImportFile(file)
      setImportStatus("idle")
      setImportMessage("")
      setImportErrors([])
      return
    }

    setImportFile(null)
    setImportStatus("idle")
    setImportMessage("")
    setImportErrors([])
  }, [])

  const handleImport = useCallback(async () => {
    if (!importFile) {
      return
    }

    setImportStatus("uploading")
    setImportMessage("")
    setImportErrors([])

    try {
      const result = await apiClient.importTransactions(importFile, "commit")

      if (result.status === "failed" || result.status === "partial") {
        setImportStatus(result.status === "partial" ? "warning" : "error")
        setImportMessage(result.message)
        setImportErrors(result.errors.slice(0, 8))
        return
      }

      setImportStatus("success")
      setImportMessage(result.message)
      setImportErrors([])

      window.setTimeout(() => {
        setShowImportModal(false)
        setImportFile(null)
        setImportStatus("idle")
        setImportMessage("")
        setImportErrors([])
      }, 1200)
    } catch (err) {
      setImportStatus("error")
      if (err instanceof ApiError) {
        setImportMessage(err.error.message)
      } else {
        setImportMessage("Failed to import transactions. Please check your file format.")
      }
    }
  }, [importFile])

  const resetImportModal = useCallback(() => {
    setImportFile(null)
    setImportStatus("idle")
    setImportMessage("")
    setImportErrors([])
  }, [])

  return {
    showImportModal,
    setShowImportModal,
    showExportModal,
    setShowExportModal,
    exportPreset,
    exportCustomFrom,
    exportCustomTo,
    isExporting,
    exportError,
    setExportError,
    importFile,
    importStatus,
    importMessage,
    importErrors,
    selectedExportFromDate: parseIsoDate(exportCustomFrom),
    selectedExportToDate: parseIsoDate(exportCustomTo),
    setExportCustomFrom,
    setExportCustomTo,
    openExportModal,
    selectExportPreset,
    confirmExport,
    handleImportFileSelect,
    handleImport,
    resetImportModal,
  }
}
