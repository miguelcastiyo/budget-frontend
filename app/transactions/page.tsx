"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Header } from "@/components/layout/header"
import { BottomNav, FloatingAddButton } from "@/components/layout/bottom-nav"
import { TransactionFilters } from "@/components/budget/transaction-filters"
import { TransactionStatsGrid } from "@/components/budget/transaction-stats-grid"
import { TransactionList } from "@/components/budget/transaction-list"
import { AddTransactionSheet } from "@/components/budget/add-transaction-sheet"
import { TransactionDetailSheet } from "@/components/budget/transaction-detail-sheet"
import { ErrorDialog, type ErrorDialogState } from "@/components/common/error-dialog"
import { Button } from "@/components/ui/button"
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ChevronDown,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/formatters"
import { mergeTransactionPages, replaceTransaction } from "@/lib/transaction-collection"
import { ApiError, apiClient } from "@/lib/api/client"
import { formatMonthLabel, getLocalDateKey, getMonthDateRange, getPresetDateRange } from "@/lib/date-filters"
import type { DateRangeFilter } from "@/lib/date-filters"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"
import { taxonomyFromState, transactionsPageFromState } from "@/lib/domain/financial/view-models"
import { materializeEncryptedRecurring } from "@/lib/privacy/encrypted-authority/recurring-mutation"
import type {
  Card,
  Category,
  Context,
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
  if (value === "needs" || value === "wants" || value === "savings") {
    return value
  }

  return null
}

export default function TransactionsPage() {
  const financialAuthority = useFinancialAuthority()
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
  const [quickPickTags, setQuickPickTags] = useState<Tag[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [contexts, setContexts] = useState<Context[]>([])

  const [preset, setPreset] = useState<Preset | "all">("all")
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedCards, setSelectedCards] = useState<string[]>([])
  const [selectedContexts, setSelectedContexts] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [sortOrder, setSortOrder] = useState<SortOrder>("date_desc")
  const [splitFilter, setSplitFilter] = useState<SplitFilter>("all")
  const [customDateRange, setCustomDateRange] = useState<DateRangeFilter | null>(null)
  const [desktopFiltersCollapsed, setDesktopFiltersCollapsed] = useState(false)
  const [queryFiltersInitialized, setQueryFiltersInitialized] = useState(false)
  const [hasAnyTransactions, setHasAnyTransactions] = useState<boolean | null>(null)
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
    if (selectedContexts.length > 0) {
      filters.context_ids = selectedContexts.join(",")
    }
    if (splitFilter !== "all") {
      filters.is_split = splitFilter
    }

    const trimmedSearchQuery = debouncedSearchQuery.trim()
    if (trimmedSearchQuery !== "") {
      filters.q = trimmedSearchQuery
    }

    return filters
  }, [customDateRange, debouncedSearchQuery, preset, selectedCards, selectedCategories, selectedContexts, selectedTags, sortOrder, splitFilter])

  const loadReferenceData = useCallback(async () => {
    if (financialAuthority.isLoading) {
      return
    }
    try {
      if (financialAuthority.mode === "encrypted") {
        const state = financialAuthority.authority?.getState()
        if (!state) throw new Error("ENCRYPTED_AUTHORITY_LOCKED")
        const references = taxonomyFromState(state)
        setTags(references.tags)
        setQuickPickTags(references.tags.slice(0, 5))
        setCards(references.cards)
        setContexts(references.contexts)
        return
      }
      const [tagsResponse, quickPicksResponse, cardsResponse, contextsResponse] = await Promise.all([
        apiClient.getTags(),
        apiClient.getTagQuickPicks(5),
        apiClient.getCards(),
        apiClient.getContexts(),
      ])

      setTags(tagsResponse.items)
      setQuickPickTags(quickPicksResponse.items)
      setCards(cardsResponse.items)
      setContexts(contextsResponse.items)
    } catch (err) {
      setError(transactionError(err, "Unable to load transactions"))
    }
  }, [financialAuthority])

  const loadTransactionsData = useCallback(async () => {
    if (financialAuthority.isLoading) {
      return
    }
    setIsLoading(true)
    setError(null)

    try {
      if (financialAuthority.mode === "encrypted") {
        if (!financialAuthority.authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED")
        // Transactions must be self-sufficient: opening Settings > Recurring
        // first must not be required for a due recurring occurrence to appear.
        // Materialization remains idempotent and only creates eligible
        // occurrences for the current/selected month.
        try {
          await materializeEncryptedRecurring(financialAuthority.authority, activeTransactionFilters.date_from?.slice(0, 7) ?? getLocalDateKey().slice(0, 7))
        } catch {
          // Existing decrypted transactions should remain visible even if a
          // best-effort occurrence write is temporarily unavailable.
        }
        const state = financialAuthority.authority?.getState()
        if (!state) throw new Error("ENCRYPTED_AUTHORITY_LOCKED")
        const response = transactionsPageFromState(state, { from: activeTransactionFilters.date_from, to: activeTransactionFilters.date_to, search: activeTransactionFilters.q, categories: activeTransactionFilters.categories?.split(",") as ("needs" | "wants" | "savings")[] | undefined, tagIds: activeTransactionFilters.tag_ids?.split(","), contextIds: activeTransactionFilters.context_ids?.split(","), cardIds: activeTransactionFilters.card_ids?.split(","), isSplit: activeTransactionFilters.is_split === "split" ? true : activeTransactionFilters.is_split === "not_split" ? false : undefined, page: 1, pageSize: TRANSACTIONS_PAGE_SIZE, sort: activeTransactionFilters.sort === "date_asc" ? "date_asc" : "date_desc" }, getLocalDateKey())
        setTransactions(response.items); setCurrentPage(response.page); setTotalItems(response.total_items); setSummary(response.summary); setHasAnyTransactions(response.total_items > 0); return
      }
      const response = await apiClient.getTransactions({
        ...activeTransactionFilters,
        page: 1,
        page_size: TRANSACTIONS_PAGE_SIZE,
      })

      setTransactions(response.items)
      setCurrentPage(response.page)
      setTotalItems(response.total_items)
      setSummary(response.summary)

      const hasExplicitFilters = Object.entries(activeTransactionFilters).some(([key, value]) => {
        if (key === "sort" || key === "page_size") {
          return false
        }
        return value !== undefined && value !== "" && value !== "all"
      })

      if (!hasExplicitFilters) {
        setHasAnyTransactions(response.total_items > 0)
      }
    } catch (err) {
      setError(transactionError(err, "Unable to load transactions"))
    } finally {
      setIsLoading(false)
    }
  }, [activeTransactionFilters, financialAuthority])

  const loadMoreTransactions = useCallback(async () => {
    if (isLoading || isLoadingMore || transactions.length >= totalItems) {
      return
    }

    setIsLoadingMore(true)
    setError(null)

    try {
      if (financialAuthority.mode === "encrypted") {
        const state = financialAuthority.authority?.getState()
        if (!state) throw new Error("ENCRYPTED_AUTHORITY_LOCKED")
        const response = transactionsPageFromState(state, { from: activeTransactionFilters.date_from, to: activeTransactionFilters.date_to, search: activeTransactionFilters.q, categories: activeTransactionFilters.categories?.split(",") as ("needs" | "wants" | "savings")[] | undefined, tagIds: activeTransactionFilters.tag_ids?.split(","), contextIds: activeTransactionFilters.context_ids?.split(","), cardIds: activeTransactionFilters.card_ids?.split(","), isSplit: activeTransactionFilters.is_split === "split" ? true : activeTransactionFilters.is_split === "not_split" ? false : undefined, page: currentPage + 1, pageSize: TRANSACTIONS_PAGE_SIZE, sort: activeTransactionFilters.sort === "date_asc" ? "date_asc" : "date_desc" }, getLocalDateKey())
        setTransactions((current) => [...current, ...response.items]); setCurrentPage(response.page); setTotalItems(response.total_items); setSummary(response.summary); return
      }
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
  }, [activeTransactionFilters, currentPage, financialAuthority, isLoading, isLoadingMore, totalItems, transactions.length])

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

  // Collection mutation invariant: mutating an item must preserve filters, sort,
  // search, loaded pagination depth, and the user's current scroll context.
  const revalidateLoadedTransactions = useCallback(async (loadedPageCount: number) => {
    try {
      if (financialAuthority.mode === "encrypted") {
        await loadTransactionsData()
        return
      }
      const responses = await Promise.all(
        Array.from({ length: loadedPageCount }, (_, index) => apiClient.getTransactions({
          ...activeTransactionFilters,
          page: index + 1,
          page_size: TRANSACTIONS_PAGE_SIZE,
        }))
      )

      const firstResponse = responses[0]
      if (!firstResponse) {
        return
      }

      setTransactions(mergeTransactionPages(responses.map((response) => response.items)))
      setTotalItems(firstResponse.total_items)
      setSummary(firstResponse.summary)
    } catch (err) {
      setError(transactionError(err, "Unable to refresh transactions"))
    }
  }, [activeTransactionFilters, financialAuthority, loadTransactionsData])

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

  const hasActiveFilters = Boolean(
    debouncedSearchQuery.trim() || preset !== "all" || customDateRange || selectedCategories.length ||
    selectedTags.length || selectedContexts.length || selectedCards.length || splitFilter !== "all" || queryMonthLabel
  )
  const showFilteredEmptyState = hasActiveFilters && (hasAnyTransactions === true || hasAnyTransactions === null)

  const clearAllFilters = useCallback(() => {
    setPreset("all")
    setCustomDateRange(null)
    setSelectedCategories([])
    setSelectedTags([])
    setSelectedContexts([])
    setSelectedCards([])
    setSplitFilter("all")
    if (searchParams.get("month")) {
      clearMonthFilter()
    }
  }, [clearMonthFilter, searchParams])

  const transactionTitle = isLoading
    ? "Loading..."
    : hasActiveFilters
      ? `Transactions · ${totalItems.toLocaleString()} ${totalItems === 1 ? "match" : "matches"}`
      : `Transactions · ${totalItems.toLocaleString()}`

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
      const current = transactions.find((item) => item.id === transactionId)
      if (!current) throw new Error("TRANSACTION_NOT_FOUND")
      await financialAuthority.deleteTransaction(current)
      setTransactions((current) => current.filter((transaction) => transaction.id !== transactionId))
      setSelectedTransaction((current) => (current?.id === transactionId ? null : current))
      void revalidateLoadedTransactions(currentPage)
    } catch (err) {
      setError(transactionError(err, "Unable to delete transaction"))
    } finally {
      setDeletingTransactionId(null)
    }
  }, [currentPage, financialAuthority, revalidateLoadedTransactions, transactions])

  const handleTransactionUpdated = (updatedTransaction: Transaction) => {
    setTransactions((current) => replaceTransaction(current, updatedTransaction))
    setEditingTransaction(null)
    setSelectedTransaction(null)
    void revalidateLoadedTransactions(currentPage)
  }

  const remainingTransactions = Math.max(totalItems - transactions.length, 0)

  const transactionFiltersProps = useMemo(
    () => ({
      preset,
      onPresetChange: handlePresetChange,
      selectedCategories,
      onCategoriesChange: setSelectedCategories,
      selectedTags,
      onTagsChange: setSelectedTags,
      selectedContexts,
      onContextsChange: setSelectedContexts,
      selectedCards,
      onCardsChange: setSelectedCards,
      tags,
      contexts,
      quickPickTags,
      cards,
      searchQuery,
      onSearchChange: setSearchQuery,
      splitFilter,
      onSplitFilterChange: setSplitFilter,
      monthFilterLabel: queryMonthLabel && customDateRange ? queryMonthLabel : null,
      onClearMonthFilter: clearMonthFilter,
      customDateRange,
      onCustomDateRangeChange: handleCustomDateRangeChange,
      desktopSidebarToggle: (
        <button
          type="button"
          onClick={() => setDesktopFiltersCollapsed(true)}
          className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl border border-border/60 bg-muted/65 px-2.5 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Hide filters"
          title="Hide filters"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      ),
    }),
    [
      cards,
      clearMonthFilter,
      customDateRange,
      handleCustomDateRangeChange,
      handlePresetChange,
      isLoading,
      preset,
      queryMonthLabel,
      searchQuery,
      selectedCards,
      selectedCategories,
      selectedTags,
      selectedContexts,
      setDesktopFiltersCollapsed,
      setSearchQuery,
      setSelectedCards,
      setSelectedCategories,
      setSelectedTags,
      setSelectedContexts,
      setSplitFilter,
      splitFilter,
      tags,
      quickPickTags,
    ]
  )

  return (
    <div className="min-h-screen bg-background pb-mobile-nav">
      <Header />
      <ErrorDialog
        error={error}
        onOpenChange={(open) => {
          if (!open) {
            dismissError()
          }
        }}
        onRetry={() => void refreshTransactionSurface()}
      />

      <main className="max-w-lg lg:max-w-6xl mx-auto px-5 lg:px-8 pt-standalone-safe-top">
        <div
          className={cn(
            "lg:grid lg:gap-8",
            desktopFiltersCollapsed
              ? "lg:grid-cols-[44px_minmax(0,1fr)]"
              : "lg:grid-cols-[288px_minmax(0,1fr)]"
          )}
        >
          <div className="mb-6 lg:mb-0">
            <div className="lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1 [scrollbar-width:thin]">
              <div className="hidden lg:block">
                {desktopFiltersCollapsed ? (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => setDesktopFiltersCollapsed(false)}
                      className="inline-flex h-8 cursor-pointer items-center justify-center rounded-full border border-border/60 bg-muted/65 px-2 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Show filters"
                      title="Show filters"
                    >
                      <PanelLeftOpen className="w-4 h-4 mx-auto" />
                    </button>
                  </div>
                ) : (
                  <>
                    <TransactionFilters {...transactionFiltersProps} desktopMode />
                    {totalItems > 0 && (
                      <section className="mt-8 border-t border-border/60 px-2 pt-5">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Current view</p>
                        <div className="mt-4 grid gap-4">
                          <div>
                            <p className="text-xl font-semibold tracking-tight">{formatCurrency(stats.totalSpent.toFixed(2))}</p>
                            <p className="text-xs text-muted-foreground">Total spent</p>
                          </div>
                          <div>
                            <p className="text-xl font-semibold tracking-tight">{formatCurrency(stats.avgTransaction.toFixed(2))}</p>
                            <p className="text-xs text-muted-foreground">Average transaction</p>
                          </div>
                        </div>
                      </section>
                    )}
                  </>
                )}
              </div>

              <div className="lg:hidden">
                <TransactionFilters {...transactionFiltersProps} desktopMode={false} />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {totalItems > 0 && (
              <>
                <div className="grid grid-cols-1 gap-2 lg:hidden">
                  <TransactionStatsGrid compact totalSpent={stats.totalSpent} count={stats.count} avgTransaction={stats.avgTransaction} splitCount={stats.splitCount} />
                </div>
              </>
            )}

            <TransactionList
              transactions={transactions}
              title={transactionTitle}
              activeContextIds={selectedContexts}
              emptyTitle={showFilteredEmptyState ? "No matching transactions" : "No transactions yet"}
              emptyDescription={
                showFilteredEmptyState
                  ? "Try removing or adjusting some filters."
                  : "Add your first transaction to start tracking spending."
              }
              emptyActionLabel={showFilteredEmptyState ? "Clear filters" : "Add Transaction"}
              onEmptyAction={showFilteredEmptyState ? clearAllFilters : () => setShowAddTransaction(true)}
              headerRight={
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center rounded-lg border border-border/70 p-0.5 bg-background">
                    <span className="hidden lg:inline px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Sort
                    </span>
                    <button
                      type="button"
                      onClick={() => setSortOrder("date_desc")}
                      aria-label="Sort newest first"
                      title="Newest first"
                      className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 lg:px-2 py-1 text-xs font-medium transition-colors ${
                        sortOrder === "date_desc"
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <ArrowDownWideNarrow className="w-3.5 h-3.5" />
                      <span className="hidden lg:inline">Newest</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSortOrder("date_asc")}
                      aria-label="Sort oldest first"
                      title="Oldest first"
                      className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 lg:px-2 py-1 text-xs font-medium transition-colors ${
                        sortOrder === "date_asc"
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <ArrowUpNarrowWide className="w-3.5 h-3.5" />
                      <span className="hidden lg:inline">Oldest</span>
                    </button>
                  </div>
                </div>
              }
              onTransactionClick={setSelectedTransaction}
            />

            {transactions.length > 0 && (
              <div className="flex flex-col items-stretch gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="text-center text-sm text-muted-foreground sm:text-left">
                  Showing <span className="font-medium text-foreground">{transactions.length.toLocaleString()}</span>{" "}
                  of <span className="font-medium text-foreground">{totalItems.toLocaleString()}</span>
                </p>

                {hasMoreTransactions && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-9 rounded-lg px-4"
                    onClick={() => void loadMoreTransactions()}
                    disabled={isLoading || isLoadingMore}
                    aria-label={`Load ${Math.min(50, remainingTransactions)} more transactions`}
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Loading
                      </>
                    ) : (
                      <>
                        Load more
                        <ChevronDown className="size-4" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <FloatingAddButton
        onClick={() => setShowAddTransaction(true)}
        showCoachmark={!isLoading && hasAnyTransactions === false}
      />
      <BottomNav
        onAddClick={() => setShowAddTransaction(true)}
        showAddCoachmark={!isLoading && hasAnyTransactions === false}
      />

      <AddTransactionSheet
        open={showAddTransaction}
        onOpenChange={setShowAddTransaction}
        onTransactionCreated={() => void refreshTransactionSurface()}
      />

      <TransactionDetailSheet
        transaction={selectedTransaction}
        open={!!selectedTransaction}
        onOpenChange={(open) => !open && setSelectedTransaction(null)}
        onEdit={(transaction) => {
          setSelectedTransaction(null)
          setEditingTransaction(transaction)
        }}
        onDelete={(transactionId) => {
          void handleDeleteTransaction(transactionId)
        }}
        isDeleting={deletingTransactionId === selectedTransaction?.id}
      />

      <AddTransactionSheet
        open={!!editingTransaction}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTransaction(null)
          }
        }}
        mode="edit"
        transaction={editingTransaction}
        onTransactionUpdated={handleTransactionUpdated}
      />
    </div>
  )
}
