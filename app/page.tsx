"use client"

import { useCallback, useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import { BottomNav, FloatingAddButton } from "@/components/layout/bottom-nav"
import { MonthSelector } from "@/components/budget/month-selector"
import { getCurrentMonthKey } from "@/lib/date-filters"
import { SpendingSummary } from "@/components/budget/spending-summary"
import { CategoryCard } from "@/components/budget/category-card"
import { TagBreakdown } from "@/components/budget/tag-breakdown"
import { TransactionList } from "@/components/budget/transaction-list"
import { AddTransactionSheet } from "@/components/budget/add-transaction-sheet"
import { ApiError, apiClient } from "@/lib/api/client"
import type { MonthOverviewResponse, Transaction } from "@/lib/api/types"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useRouter } from "next/navigation"

export default function DashboardPage() {
  const router = useRouter()
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthKey())
  const [showAddTransaction, setShowAddTransaction] = useState(false)
  const [overview, setOverview] = useState<MonthOverviewResponse | null>(null)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailView, setDetailView] = useState<"tags" | "recent">("tags")

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const nextOverview = await apiClient.getMonthOverview(currentMonth)
      setOverview(nextOverview)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to load dashboard data")
      }
    } finally {
      setIsLoading(false)
    }
  }, [currentMonth])

  useEffect(() => {
    void loadDashboardData()
  }, [loadDashboardData])

  const categories = overview?.categories ?? []
  const tags = overview?.tags ?? []
  const recentTransactions = overview?.recent_transactions ?? []

  const hasMonthTransactions =
    recentTransactions.length > 0 ||
    tags.length > 0 ||
    categories.some((category) => {
      const amount = Number.parseFloat(category.actual_spend)
      return Number.isFinite(amount) && amount > 0
    })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-mobile-nav">
        <Header />
        <main className="max-w-lg lg:max-w-6xl mx-auto px-5 lg:px-8 pt-standalone-safe-top">
          <Card className="p-8 border-0 shadow-sm flex items-center justify-center gap-3">
            <Spinner className="size-5" />
            <span className="text-sm text-muted-foreground">Loading dashboard...</span>
          </Card>
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-mobile-nav">
      <Header />

      <main className="max-w-lg lg:max-w-6xl mx-auto px-5 lg:px-8 pt-standalone-safe-top">
        {error && (
          <Card className="p-4 mb-6 border-0 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void loadDashboardData()}>
                Retry
              </Button>
            </div>
          </Card>
        )}

        <div className="mb-4 lg:mb-3">
          <MonthSelector
            currentMonth={currentMonth}
            onChange={setCurrentMonth}
          />
        </div>

        <div className="space-y-6 lg:space-y-8">
          <div>
            <SpendingSummary categories={categories} />
          </div>

          <div className="grid grid-cols-3 gap-2 lg:gap-6">
            {categories.map((cat) => (
              <CategoryCard
                key={cat.category}
                metrics={cat}
                compactOnMobile
                onClick={() => {
                  const params = new URLSearchParams({
                    category: cat.category,
                    month: currentMonth,
                  })
                  router.push(`/transactions?${params.toString()}`)
                }}
              />
            ))}
          </div>

          <Tabs value={detailView} onValueChange={(value) => setDetailView(value as "tags" | "recent")} className="gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Drill Down</p>
                <h2 className="text-base font-semibold text-foreground">Where the money went</h2>
              </div>
              <TabsList className="h-9 rounded-full p-1">
                <TabsTrigger value="tags" className="rounded-full px-3 text-xs lg:text-sm">Tags</TabsTrigger>
                <TabsTrigger value="recent" className="rounded-full px-3 text-xs lg:text-sm">Recent</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="tags" className="mt-0">
              <TagBreakdown
                className="lg:h-[420px]"
                tags={tags}
                emptyTitle="No tag activity this month"
                emptyDescription="Add a transaction to see category and tag patterns."
                onEmptyAction={() => setShowAddTransaction(true)}
                onTagClick={(tagId) => {
                  const params = new URLSearchParams({
                    tag_id: tagId,
                    month: currentMonth,
                  })
                  router.push(`/transactions?${params.toString()}`)
                }}
              />
            </TabsContent>

            <TabsContent value="recent" className="mt-0">
              <TransactionList
                className="lg:h-[420px]"
                transactions={recentTransactions}
                title="Recent Transactions"
                showViewAll
                compact
                showMetadataChips
                showScrollHint
                emptyTitle="No transactions this month"
                emptyDescription="Add your first transaction to start tracking."
                onEmptyAction={() => setShowAddTransaction(true)}
                onViewAll={() => {
                  const params = new URLSearchParams({
                    month: currentMonth,
                  })
                  router.push(`/transactions?${params.toString()}`)
                }}
                onTransactionClick={setEditingTransaction}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <FloatingAddButton
        onClick={() => setShowAddTransaction(true)}
        showCoachmark={!hasMonthTransactions}
      />
      <BottomNav
        onAddClick={() => setShowAddTransaction(true)}
        showAddCoachmark={!hasMonthTransactions}
      />

      <AddTransactionSheet
        open={showAddTransaction}
        onOpenChange={setShowAddTransaction}
        onTransactionCreated={() => void loadDashboardData()}
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
        onTransactionUpdated={() => void loadDashboardData()}
      />
    </div>
  )
}
