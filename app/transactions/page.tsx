"use client"

import { useMemo } from "react"
import { Header } from "@/components/layout/header"
import { BottomNav, FloatingAddButton } from "@/components/layout/bottom-nav"
import { TransactionFilters } from "@/components/budget/transaction-filters"
import { TransactionStatsGrid } from "@/components/budget/transaction-stats-grid"
import { TransactionList } from "@/components/budget/transaction-list"
import { TransactionExportDialog } from "@/components/budget/transaction-export-dialog"
import { TransactionImportDialog } from "@/components/budget/transaction-import-dialog"
import { AddTransactionSheet } from "@/components/budget/add-transaction-sheet"
import { TransactionDetailSheet } from "@/components/budget/transaction-detail-sheet"
import type { Preset } from "@/lib/api/types"
import { useTransactionsPage } from "@/hooks/use-transactions-page"
import { Button } from "@/components/ui/button"
import { Card as UiCard } from "@/components/ui/card"
import { formatCurrency } from "@/lib/formatters"
import {
  Calendar,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"

const exportDatePresets: { value: Preset; label: string }[] = [
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "month_to_date", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "quarter_to_date", label: "This Quarter" },
]

function formatSummaryDate(dateStr: string): string {
  const isoDateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const date = isoDateMatch
    ? new Date(Number(isoDateMatch[1]), Number(isoDateMatch[2]) - 1, Number(isoDateMatch[3]))
    : new Date(dateStr)

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

export default function TransactionsPage() {
  const {
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
    isLoading,
    error,
    showImportModal,
    setShowImportModal,
    showExportModal,
    setShowExportModal,
    exportPreset,
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
    resetImportModal,
    refreshTransactionSurface,
  } = useTransactionsPage()

  const transactionFiltersProps = useMemo(
    () => ({
      preset,
      onPresetChange: handlePresetChange,
      selectedCategories,
      onCategoriesChange: setSelectedCategories,
      selectedTags,
      onTagsChange: setSelectedTags,
      selectedCards,
      onCardsChange: setSelectedCards,
      tags,
      cards,
      searchQuery,
      onSearchChange: setSearchQuery,
      splitFilter,
      onSplitFilterChange: setSplitFilter,
      sortOrder,
      onSortOrderChange: setSortOrder,
      mobileSummaryLabel: queryMonthLabel && customDateRange
        ? queryMonthLabel
        : customDateRange
          ? `${formatSummaryDate(customDateRange.date_from)} - ${formatSummaryDate(customDateRange.date_to)}`
          : preset === "all"
            ? "All time"
            : exportDatePresets.find((item) => item.value === preset)?.label ?? "All time",
      monthFilterLabel: queryMonthLabel && customDateRange ? queryMonthLabel : null,
      onClearMonthFilter: clearMonthFilter,
      customDateRange,
      onCustomDateRangeChange: handleCustomDateRangeChange,
      onExport: openExportModal,
      onImport: () => setShowImportModal(true),
      dataActionsDisabled: isLoading,
      desktopSidebarToggle: (
        <button
          type="button"
          onClick={() => setDesktopFiltersCollapsed(true)}
          className="inline-flex h-11 items-center justify-center rounded-xl border border-border/60 bg-muted/65 px-2.5 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
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
      openExportModal,
      preset,
      queryMonthLabel,
      searchQuery,
      selectedCards,
      selectedCategories,
      selectedTags,
      sortOrder,
      setSortOrder,
      setDesktopFiltersCollapsed,
      setSearchQuery,
      setSelectedCards,
      setSelectedCategories,
      setSelectedTags,
      setShowImportModal,
      setSplitFilter,
      splitFilter,
      tags,
    ]
  )

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8">
      <Header />

      <main className="max-w-lg lg:max-w-6xl mx-auto px-5 lg:px-8 pt-4 lg:pt-6">
        {error && (
          <UiCard className="p-4 mb-6 border-0 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void refreshTransactionSurface()}>
                Retry
              </Button>
            </div>
          </UiCard>
        )}

        {queryMonthLabel && customDateRange && (
          <UiCard className="p-3 mb-4 border border-primary/20 bg-primary/5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-primary" />
                <span>
                  Showing transactions for <span className="font-semibold">{queryMonthLabel}</span>
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-full px-3"
                onClick={clearMonthFilter}
              >
                Clear
              </Button>
            </div>
          </UiCard>
        )}

        <div
          className={cn(
            "lg:grid lg:gap-8",
            desktopFiltersCollapsed
              ? "lg:grid-cols-[44px_minmax(0,1fr)]"
              : "lg:grid-cols-[288px_minmax(0,1fr)]"
          )}
        >
          <div className="mb-6 lg:mb-0">
            <div className="lg:sticky lg:top-24">
              <div className="hidden lg:block">
                {desktopFiltersCollapsed ? (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => setDesktopFiltersCollapsed(false)}
                      className="inline-flex h-8 items-center justify-center rounded-full border border-border/60 bg-muted/65 px-2 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Show filters"
                      title="Show filters"
                    >
                      <PanelLeftOpen className="w-4 h-4 mx-auto" />
                    </button>
                  </div>
                ) : (
                  <TransactionFilters {...transactionFiltersProps} />
                )}
              </div>

              <div className="lg:hidden sticky top-0 z-30 -mx-5 border-b border-border/60 bg-background/95 px-5 py-3 backdrop-blur-xl">
                <TransactionFilters {...transactionFiltersProps} />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <UiCard className="overflow-hidden border-0 bg-gradient-to-br from-background via-secondary/30 to-background shadow-sm lg:hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5" />
                      Spending snapshot
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {transactionFiltersProps.mobileSummaryLabel}
                    </p>
                    <p className="mt-1 text-3xl font-semibold tracking-tight">
                      {formatCurrency(stats.totalSpent)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/85 px-3 py-2 text-right shadow-sm">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Transactions</p>
                    <p className="mt-1 text-lg font-semibold">{stats.count}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-border/70 bg-background/80 px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Average</p>
                    <p className="mt-1 text-sm font-semibold">{formatCurrency(stats.avgTransaction)}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/80 px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Split</p>
                    <p className="mt-1 text-sm font-semibold">
                      {stats.splitCount}
                      <span className="ml-1 text-xs font-medium text-muted-foreground">
                        {stats.count === 1 ? "item" : "items"}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </UiCard>

            <div className="hidden lg:grid lg:grid-cols-4 gap-3">
              <TransactionStatsGrid
                totalSpent={stats.totalSpent}
                count={stats.count}
                avgTransaction={stats.avgTransaction}
                splitCount={stats.splitCount}
              />
            </div>

            <TransactionList
              transactions={transactions}
              title={isLoading ? "Loading..." : "Transactions"}
              emptyTitle={hasAnyTransactions ? "No matching transactions" : "No transactions yet"}
              emptyDescription={
                hasAnyTransactions
                  ? "Try adjusting filters or add a new transaction."
                  : "Add your first transaction to start tracking spending."
              }
              onEmptyAction={() => setShowAddTransaction(true)}
              headerRight={
                <div className="hidden items-center gap-2 lg:flex">
                  <div className="inline-flex items-center rounded-lg border border-border/70 p-0.5 bg-background">
                    <span className="hidden lg:inline px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Sort
                    </span>
                    <button
                      type="button"
                      onClick={() => setSortOrder("date_desc")}
                      aria-label="Sort newest first"
                      title="Newest first"
                      className={`inline-flex items-center gap-1 rounded-md px-1.5 lg:px-2 py-1 text-xs font-medium transition-colors ${
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
                      className={`inline-flex items-center gap-1 rounded-md px-1.5 lg:px-2 py-1 text-xs font-medium transition-colors ${
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
          </div>
        </div>
      </main>

      <FloatingAddButton
        onClick={() => setShowAddTransaction(true)}
        showCoachmark={!isLoading && !hasAnyTransactions}
      />
      <BottomNav
        onAddClick={() => setShowAddTransaction(true)}
        showAddCoachmark={!isLoading && !hasAnyTransactions}
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

      <TransactionExportDialog
        open={showExportModal}
        onOpenChange={(open) => {
          setShowExportModal(open)
          if (!open) {
            setExportError(null)
          }
        }}
        exportDatePresets={exportDatePresets}
        exportPreset={exportPreset}
        onExportPresetChange={selectExportPreset}
        selectedExportFromDate={selectedExportFromDate}
        selectedExportToDate={selectedExportToDate}
        onExportCustomFromChange={setExportCustomFrom}
        onExportCustomToChange={setExportCustomTo}
        exportError={exportError}
        isExporting={isExporting}
        onConfirm={() => void confirmExport()}
      />

      <TransactionImportDialog
        open={showImportModal}
        onOpenChange={setShowImportModal}
        importFile={importFile}
        importStatus={importStatus}
        importMessage={importMessage}
        importErrors={importErrors}
        onFileSelect={handleImportFileSelect}
        onReset={resetImportModal}
        onImport={() => void handleImport()}
      />
    </div>
  )
}
