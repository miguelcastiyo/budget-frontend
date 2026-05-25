"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ApiError, apiClient } from "@/lib/api/client"
import { formatMonthLabel, getMonthDateRange, getPresetDateRange, parseIsoDate } from "@/lib/date-filters"
import type { DateRangeFilter } from "@/lib/date-filters"
import type {
  Card,
  Category,
  CsvImportErrorItem,
  Preset,
  SortOrder,
  SplitFilter,
  Tag,
  Transaction,
  TransactionFilters as ApiTransactionFilters,
  TransactionSummary,
} from "@/lib/api/types"

type PartialDateRange = {
  date_from?: string
  date_to?: string
}

const TRANSACTIONS_PAGE_SIZE = 50

const emptyTransactionSummary: TransactionSummary = {
  total_spent: "0.00",
  count: 0,
  avg_transaction: "0.00",
  split_count: 0,
}

function parseCategoryQuery(value: string): Category | null {
  if (value === "needs" || value === "wants" || value === "savings_debts") {
    return value
  }

  return null
}

export function useTransactionsPage() {
  const desktopFiltersStorageKey = "transactions-desktop-filters-collapsed"
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [showAddTransaction, setShowAddTransaction] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [cards, setCards] = useState<Card[]>([])

  const [preset, setPreset] = useState<Preset | "all">("all")
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedCards, setSelectedCards] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [sortOrder, setSortOrder] = useState<SortOrder>("date_desc")
  const [splitFilter, setSplitFilter] = useState<SplitFilter>("all")
  const [customDateRange, setCustomDateRange] = useState<DateRangeFilter | null>(null)
  const [desktopFiltersCollapsed, setDesktopFiltersCollapsed] = useState(false)
  const [queryFiltersInitialized, setQueryFiltersInitialized] = useState(false)
  const [hasAnyTransactions, setHasAnyTransactions] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [summary, setSummary] = useState<TransactionSummary>(emptyTransactionSummary)

  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [searchQuery])

  useEffect(() => {
    const savedState = window.localStorage.getItem(desktopFiltersStorageKey)
    if (savedState === "1") {
      setDesktopFiltersCollapsed(true)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(desktopFiltersStorageKey, desktopFiltersCollapsed ? "1" : "0")
  }, [desktopFiltersCollapsed])

  const queryTagId = searchParams.get("tag_id") ?? ""
  const queryCategory = searchParams.get("category") ?? ""
  const queryMonth = searchParams.get("month") ?? ""
  const queryOpenAdd = searchParams.get("add") === "1"
  const queryMonthLabel = useMemo(() => formatMonthLabel(queryMonth), [queryMonth])

  useEffect(() => {
    const monthRange = queryMonth ? getMonthDateRange(queryMonth) : null
    const parsedCategory = queryCategory ? parseCategoryQuery(queryCategory) : null

    if (!queryTagId && !parsedCategory && !monthRange) {
      setQueryFiltersInitialized(true)
      return
    }

    if (queryTagId) {
      setSelectedTags([queryTagId])
    }

    if (parsedCategory) {
      setSelectedCategories([parsedCategory])
    }

    if (monthRange) {
      setPreset("all")
      setCustomDateRange(monthRange)
    }

    setQueryFiltersInitialized(true)
  }, [queryCategory, queryMonth, queryTagId])

  useEffect(() => {
    if (!queryOpenAdd) {
      return
    }

    setShowAddTransaction(true)
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete("add")
    const nextQuery = nextParams.toString()
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
  }, [pathname, queryOpenAdd, router, searchParams])

  const activeTransactionFilters = useMemo<ApiTransactionFilters>(() => {
    const filters: ApiTransactionFilters = {
      sort: sortOrder,
      page_size: TRANSACTIONS_PAGE_SIZE,
    }

    const dateRange = customDateRange ?? getPresetDateRange(preset)
    if (dateRange.date_from && dateRange.date_to) {
      filters.date_from = dateRange.date_from
      filters.date_to = dateRange.date_to
    } else if (preset !== "all") {
      filters.preset = preset
    }

    if (selectedCategories.length > 0) {
      filters.categories = selectedCategories.join(",")
    }
    if (selectedTags.length > 0) {
      filters.tag_ids = selectedTags.join(",")
    }
    if (selectedCards.length > 0) {
      filters.card_ids = selectedCards.join(",")
    }
    if (splitFilter !== "all") {
      filters.is_split = splitFilter
    }

    const trimmedSearchQuery = debouncedSearchQuery.trim()
    if (trimmedSearchQuery !== "") {
      filters.q = trimmedSearchQuery
    }

    return filters
  }, [customDateRange, debouncedSearchQuery, preset, selectedCards, selectedCategories, selectedTags, sortOrder, splitFilter])

  const loadReferenceData = useCallback(async () => {
    try {
      const [tagsResponse, cardsResponse, transactionsSummary] = await Promise.all([
        apiClient.getTags(),
        apiClient.getCards(),
        apiClient.getTransactions({ page: 1, page_size: 1, sort: "date_desc" }),
      ])

      setTags(tagsResponse.items)
      setCards(cardsResponse.items)
      setHasAnyTransactions(transactionsSummary.total_items > 0)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to load transactions")
      }
    }
  }, [])

  const loadTransactionsData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await apiClient.getTransactions({
        ...activeTransactionFilters,
        page: 1,
        page_size: TRANSACTIONS_PAGE_SIZE,
      })

      setTransactions(response.items)
      setCurrentPage(response.page)
      setTotalItems(response.total_items)
      setSummary(response.summary)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to load transactions")
      }
    } finally {
      setIsLoading(false)
    }
  }, [activeTransactionFilters])

  const loadMoreTransactions = useCallback(async () => {
    if (isLoading || isLoadingMore || transactions.length >= totalItems) {
      return
    }

    setIsLoadingMore(true)
    setError(null)

    try {
      const response = await apiClient.getTransactions({
        ...activeTransactionFilters,
        page: currentPage + 1,
        page_size: TRANSACTIONS_PAGE_SIZE,
      })

      setTransactions((current) => [...current, ...response.items])
      setCurrentPage(response.page)
      setTotalItems(response.total_items)
      setSummary(response.summary)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to load more transactions")
      }
    } finally {
      setIsLoadingMore(false)
    }
  }, [activeTransactionFilters, currentPage, isLoading, isLoadingMore, totalItems, transactions.length])

  useEffect(() => {
    void loadReferenceData()
  }, [loadReferenceData])

  useEffect(() => {
    if (!queryFiltersInitialized) {
      return
    }

    void loadTransactionsData()
  }, [loadTransactionsData, queryFiltersInitialized])

  const refreshTransactionSurface = useCallback(async () => {
    await Promise.all([loadTransactionsData(), loadReferenceData()])
  }, [loadReferenceData, loadTransactionsData])

  const handlePresetChange = (nextPreset: Preset | "all") => {
    setPreset(nextPreset)
    setCustomDateRange(null)
  }

  const handleCustomDateRangeChange = useCallback(
    (range: DateRangeFilter | null) => {
      setPreset("all")
      setCustomDateRange(range)

      if (!searchParams.get("month")) {
        return
      }

      const nextParams = new URLSearchParams(searchParams.toString())
      nextParams.delete("month")
      const nextQuery = nextParams.toString()
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const clearMonthFilter = useCallback(() => {
    setCustomDateRange(null)
    setPreset("all")

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete("month")
    const nextQuery = nextParams.toString()
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  const stats = useMemo(() => {
    return {
      totalSpent: Number.parseFloat(summary.total_spent),
      avgTransaction: Number.parseFloat(summary.avg_transaction),
      count: summary.count,
      splitCount: summary.split_count,
    }
  }, [summary])

  const hasMoreTransactions = transactions.length < totalItems

  const exportTransactions = useCallback(async (dateRange: PartialDateRange) => {
    const filters: ApiTransactionFilters = {
      ...dateRange,
      sort: sortOrder,
    }

    if (selectedCategories.length > 0) {
      filters.categories = selectedCategories.join(",")
    }
    if (selectedTags.length > 0) {
      filters.tag_ids = selectedTags.join(",")
    }
    if (selectedCards.length > 0) {
      filters.card_ids = selectedCards.join(",")
    }
    if (splitFilter !== "all") {
      filters.is_split = splitFilter
    }
    if (searchQuery.trim() !== "") {
      filters.q = searchQuery.trim()
    }

    const blob = await apiClient.exportTransactions(filters)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "transactions.csv"
    anchor.click()
    URL.revokeObjectURL(url)
  }, [searchQuery, selectedCards, selectedCategories, selectedTags, sortOrder, splitFilter])

  const openExportModal = () => {
    setExportError(null)

    if (customDateRange) {
      setExportPreset("custom")
      setExportCustomFrom(customDateRange.date_from)
      setExportCustomTo(customDateRange.date_to)
      setShowExportModal(true)
      return
    }

    if (preset !== "all") {
      setExportPreset(preset)
      setExportCustomFrom("")
      setExportCustomTo("")
      setShowExportModal(true)
      return
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    setExportPreset("month_to_date")
    setExportCustomFrom(format(startOfMonth, "yyyy-MM-dd"))
    setExportCustomTo(format(now, "yyyy-MM-dd"))
    setShowExportModal(true)
  }

  const selectExportPreset = (next: Preset | "custom") => {
    setExportPreset(next)
    setExportError(null)

    if (next !== "custom") {
      return
    }

    if (exportCustomFrom && exportCustomTo) {
      return
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    setExportCustomFrom(format(startOfMonth, "yyyy-MM-dd"))
    setExportCustomTo(format(now, "yyyy-MM-dd"))
  }

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

  const handleDeleteTransaction = useCallback(async (transactionId: string) => {
    setDeletingTransactionId(transactionId)

    try {
      setError(null)
      await apiClient.deleteTransaction(transactionId)
      setSelectedTransaction((current) => (current?.id === transactionId ? null : current))
      await refreshTransactionSurface()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to delete transaction")
      }
    } finally {
      setDeletingTransactionId(null)
    }
  }, [refreshTransactionSurface])

  const handleTransactionUpdated = () => {
    setSelectedTransaction(null)
    void refreshTransactionSurface()
  }

  const handleImportFileSelect = (file: File | null) => {
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
  }

  const handleImport = useCallback(async () => {
    if (!importFile) return

    setImportStatus("uploading")
    setImportMessage("")
    setImportErrors([])

    try {
      const result = await apiClient.importTransactions(importFile, "commit")
      await refreshTransactionSurface()

      if (result.status === "failed" || result.invalid_rows > 0) {
        const partialSuccess = result.imported_rows > 0
        setImportStatus(partialSuccess ? "warning" : "error")
        setImportMessage(
          partialSuccess
            ? `Imported ${result.imported_rows} rows, but ${result.invalid_rows} row(s) failed.`
            : `Import failed: ${result.invalid_rows} invalid row(s).`
        )
        setImportErrors(result.errors.slice(0, 8))
        return
      }

      setImportStatus("success")
      setImportMessage(`Imported ${result.imported_rows} rows (${result.duplicate_rows} duplicates)`)
      setImportErrors([])

      setTimeout(() => {
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
  }, [importFile, refreshTransactionSurface])

  const resetImportModal = () => {
    setImportFile(null)
    setImportStatus("idle")
    setImportMessage("")
    setImportErrors([])
  }

  const selectedExportFromDate = parseIsoDate(exportCustomFrom)
  const selectedExportToDate = parseIsoDate(exportCustomTo)

  return {
    showAddTransaction,
    setShowAddTransaction,
    editingTransaction,
    setEditingTransaction,
    selectedTransaction,
    setSelectedTransaction,
    deletingTransactionId,
    transactions,
    tags,
    cards,
    preset,
    selectedCategories,
    selectedTags,
    selectedCards,
    searchQuery,
    sortOrder,
    setSortOrder,
    splitFilter,
    customDateRange,
    desktopFiltersCollapsed,
    setDesktopFiltersCollapsed,
    hasAnyTransactions,
    hasMoreTransactions,
    totalItems,
    isLoading,
    isLoadingMore,
    error,
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
    queryMonthLabel,
    stats,
    selectedExportFromDate,
    selectedExportToDate,
    setSelectedCategories,
    setSelectedTags,
    setSelectedCards,
    setSearchQuery,
    setSplitFilter,
    setExportCustomFrom,
    setExportCustomTo,
    handlePresetChange,
    handleCustomDateRangeChange,
    clearMonthFilter,
    openExportModal,
    selectExportPreset,
    confirmExport,
    handleDeleteTransaction,
    handleTransactionUpdated,
    handleImportFileSelect,
    handleImport,
    loadMoreTransactions,
    resetImportModal,
    refreshTransactionSurface,
  }
}
