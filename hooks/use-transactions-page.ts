"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ApiError, apiClient } from "@/lib/api/client"
import type { ErrorDialogState } from "@/components/common/error-dialog"
import { formatMonthLabel, getMonthDateRange, getPresetDateRange } from "@/lib/date-filters"
import type { DateRangeFilter } from "@/lib/date-filters"
import type {
  Card,
  Category,
  Preset,
  SortOrder,
  SplitFilter,
  Tag,
  Transaction,
  TransactionFilters as ApiTransactionFilters,
  TransactionSummary,
} from "@/lib/api/types"

const TRANSACTIONS_PAGE_SIZE = 50

const emptyTransactionSummary: TransactionSummary = {
  total_spent: "0.00",
  count: 0,
  avg_transaction: "0.00",
  split_count: 0,
}

function transactionError(err: unknown, fallbackMessage: string): ErrorDialogState | null {
  if (err instanceof ApiError) {
    if (err.status >= 500) {
      return null
    }

    return {
      title: "Transaction request failed",
      message: err.error.message,
      requestId: err.requestId,
      status: err.status,
      code: err.error.code,
    }
  }

  return {
    title: "Transaction request failed",
    message: fallbackMessage,
  }
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
  const [error, setError] = useState<ErrorDialogState | null>(null)

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
      setError(transactionError(err, "Unable to load transactions"))
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
      setError(transactionError(err, "Unable to load transactions"))
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
      setError(transactionError(err, "Unable to load more transactions"))
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

  const dismissError = useCallback(() => {
    setError(null)
  }, [])

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

  const handleDeleteTransaction = useCallback(async (transactionId: string) => {
    setDeletingTransactionId(transactionId)

    try {
      setError(null)
      await apiClient.deleteTransaction(transactionId)
      setSelectedTransaction((current) => (current?.id === transactionId ? null : current))
      await refreshTransactionSurface()
    } catch (err) {
      setError(transactionError(err, "Unable to delete transaction"))
    } finally {
      setDeletingTransactionId(null)
    }
  }, [refreshTransactionSurface])

  const handleTransactionUpdated = () => {
    setSelectedTransaction(null)
    void refreshTransactionSurface()
  }

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
    queryMonthLabel,
    stats,
    setSelectedCategories,
    setSelectedTags,
    setSelectedCards,
    setSearchQuery,
    setSplitFilter,
    handlePresetChange,
    handleCustomDateRangeChange,
    clearMonthFilter,
    handleDeleteTransaction,
    handleTransactionUpdated,
    loadMoreTransactions,
    refreshTransactionSurface,
    dismissError,
  }
}
