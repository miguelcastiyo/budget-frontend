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
import { ErrorDialog } from "@/components/common/error-dialog"
import { useTransactionsPage } from "@/hooks/use-transactions-page"
import { transactionExportPresets } from "@/lib/date-filters"
import { Button } from "@/components/ui/button"
import { Card as UiCard } from "@/components/ui/card"
import {
  Calendar,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ChevronDown,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"

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
    dismissError,
  } = useTransactionsPage()

  const remainingTransactions = Math.max(totalItems - transactions.length, 0)

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
      openExportModal,
      preset,
      queryMonthLabel,
      searchQuery,
      selectedCards,
      selectedCategories,
      selectedTags,
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

      <main className="max-w-lg lg:max-w-6xl mx-auto px-5 lg:px-8 pt-4 lg:pt-6">
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
                      className="inline-flex h-8 cursor-pointer items-center justify-center rounded-full border border-border/60 bg-muted/65 px-2 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
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

              <div className="lg:hidden">
                <TransactionFilters {...transactionFiltersProps} />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-2 lg:hidden">
              <TransactionStatsGrid
                compact
                totalSpent={stats.totalSpent}
                count={stats.count}
                avgTransaction={stats.avgTransaction}
                splitCount={stats.splitCount}
              />
            </div>

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
        exportDatePresets={transactionExportPresets}
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
