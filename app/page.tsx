"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"
import { Header } from "@/components/layout/header"
import { BottomNav, FloatingAddButton } from "@/components/layout/bottom-nav"
import { MonthSelector } from "@/components/budget/month-selector"
import { compareMonthKeys, formatMonthLabel, formatMonthValue, getCurrentMonthKey } from "@/lib/date-filters"
import { SpendingSummary } from "@/components/budget/spending-summary"
import { MonthCloseoutTray, type MonthCloseoutTrayMode } from "@/components/budget/month-closeout-tray"
import { CategoryCard } from "@/components/budget/category-card"
import { TagBreakdown } from "@/components/budget/tag-breakdown"
import { TransactionList } from "@/components/budget/transaction-list"
import { AddTransactionSheet } from "@/components/budget/add-transaction-sheet"
import { ApiError, apiClient } from "@/lib/api/client"
import type { FundListItem, MonthCloseoutResponse, MonthOverviewResponse, Transaction } from "@/lib/api/types"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth/auth-provider"
import { FirstMonthActionCard, FirstMonthProgressCard } from "@/components/budget/first-run-checklist-card"
import type { SetupTask } from "@/lib/api/types"
import { formatCurrency } from "@/lib/formatters"
import { cn } from "@/lib/utils"

const FIRST_MONTH_PROGRESS_DISMISSED_KEY = "budget-first-month-progress-dismissed"

function parseAmount(value: string | null | undefined): number {
  const parsed = Number.parseFloat(value ?? "0")
  return Number.isFinite(parsed) ? parsed : 0
}

function getFeaturedFund(activeFunds: FundListItem[]): FundListItem | null {
  if (activeFunds.length === 0) {
    return null
  }

  const nearestTargetFund = [...activeFunds]
    .filter((fund) => Boolean(fund.target_month))
    .sort((left, right) => compareMonthKeys(left.target_month ?? "", right.target_month ?? ""))[0]

  if (nearestTargetFund) {
    return nearestTargetFund
  }

  const highestBalanceFund = [...activeFunds].sort(
    (left, right) => parseAmount(right.current_balance) - parseAmount(left.current_balance)
  )[0]

  if (highestBalanceFund) {
    return highestBalanceFund
  }

  return [...activeFunds].sort((left, right) => {
    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order
    }
    return left.name.localeCompare(right.name)
  })[0] ?? null
}

function getRecentCloseoutHighlight(
  closeout: MonthCloseoutResponse | null,
  activeFunds: FundListItem[]
): { fund: FundListItem; amount: string; month: string } | null {
  const month = closeout?.month
  const allocations = closeout?.closeout?.allocations ?? []

  if (!month || allocations.length === 0) {
    return null
  }

  const allocation = allocations.find(
    (item) => item.allocation_type === "fund" && item.fund_id && activeFunds.some((fund) => fund.id === item.fund_id)
  )

  if (!allocation?.fund_id) {
    return null
  }

  const fund = activeFunds.find((item) => item.id === allocation.fund_id)
  if (!fund) {
    return null
  }

  return {
    fund,
    amount: allocation.amount,
    month,
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const { setupStatus, refreshProfile } = useAuth()
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthKey())
  const [showAddTransaction, setShowAddTransaction] = useState(false)
  const [overview, setOverview] = useState<MonthOverviewResponse | null>(null)
  const [closeout, setCloseout] = useState<MonthCloseoutResponse | null>(null)
  const [funds, setFunds] = useState<FundListItem[]>([])
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCloseoutLoading, setIsCloseoutLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailView, setDetailView] = useState<"tags" | "recent">("tags")
  const [isDismissingFirstRun, setIsDismissingFirstRun] = useState(false)
  const [isProgressDismissed, setIsProgressDismissed] = useState(false)
  const [isCloseoutTrayOpen, setIsCloseoutTrayOpen] = useState(false)
  const [closeoutTrayMode, setCloseoutTrayMode] = useState<MonthCloseoutTrayMode>("close")

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    setIsProgressDismissed(window.localStorage.getItem(FIRST_MONTH_PROGRESS_DISMISSED_KEY) === "1")
  }, [])

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true)
    setIsCloseoutLoading(true)
    setError(null)

    try {
      const [overviewResult, closeoutResult, fundsResult] = await Promise.allSettled([
        apiClient.getMonthOverview(currentMonth),
        apiClient.getMonthCloseout(currentMonth),
        apiClient.getFunds({ status: "active", include_entries_summary: true }),
      ])

      if (overviewResult.status === "rejected") {
        throw overviewResult.reason
      }

      setOverview(overviewResult.value)

      if (closeoutResult.status === "fulfilled") {
        setCloseout(closeoutResult.value)
      } else {
        setCloseout(null)
      }

      if (fundsResult.status === "fulfilled") {
        setFunds(fundsResult.value.items)
      } else {
        setFunds([])
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to load dashboard data")
      }
    } finally {
      setIsLoading(false)
      setIsCloseoutLoading(false)
    }
  }, [currentMonth])

  useEffect(() => {
    void loadDashboardData()
  }, [loadDashboardData])

  const categories = overview?.categories ?? []
  const tags = overview?.tags ?? []
  const recentTransactions = overview?.recent_transactions ?? []
  const activeFunds = funds.filter((fund) => fund.status === "active")
  const totalFundBalance = activeFunds.reduce((sum, fund) => sum + parseAmount(fund.current_balance), 0)
  const featuredFund = getFeaturedFund(activeFunds)
  const recentCloseoutHighlight = getRecentCloseoutHighlight(closeout, activeFunds)

  const hasMonthTransactions =
    recentTransactions.length > 0 ||
    tags.length > 0 ||
    categories.some((category) => {
      const amount = Number.parseFloat(category.actual_spend)
      return Number.isFinite(amount) && amount > 0
    })
  const shouldShowFirstRunChecklist = Boolean(
    setupStatus?.budget_profile_complete &&
    setupStatus.setup_tasks.some((task) => !task.completed)
  )
  const shouldShowFirstMonthActionCard = Boolean(
    shouldShowFirstRunChecklist &&
    setupStatus &&
    !setupStatus.onboarding_dismissed
  )

  const handleDismissFirstRun = async () => {
    setIsDismissingFirstRun(true)
    try {
      await apiClient.updateOnboardingState({ onboarding_dismissed: true })
      await refreshProfile()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to hide setup checklist")
      }
    } finally {
      setIsDismissingFirstRun(false)
    }
  }

  const handleDismissProgressCard = () => {
    setIsProgressDismissed(true)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(FIRST_MONTH_PROGRESS_DISMISSED_KEY, "1")
    }
  }

  const handleProgressTaskSelect = (taskKey: SetupTask["key"]) => {
    if (taskKey === "add_first_transaction") {
      setShowAddTransaction(true)
      return
    }

    if (taskKey === "add_recurring_expenses") {
      router.push("/settings/recurring?start=1")
      return
    }

    router.push("/settings/data?start_import=1")
  }

  const openCloseoutTray = (mode: MonthCloseoutTrayMode) => {
    setCloseoutTrayMode(mode)
    setIsCloseoutTrayOpen(true)
  }

  const handleCloseoutSaved = (nextCloseout: MonthCloseoutResponse) => {
    setCloseout(nextCloseout)
    void loadDashboardData()
  }

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
          {shouldShowFirstMonthActionCard && (
            <FirstMonthActionCard
              month={formatMonthValue(currentMonth, { month: "long" }) ?? currentMonth}
              isDismissing={isDismissingFirstRun}
              onAddTransaction={() => setShowAddTransaction(true)}
              onDismiss={() => void handleDismissFirstRun()}
            />
          )}

          {shouldShowFirstRunChecklist && setupStatus && !isProgressDismissed && (
            <FirstMonthProgressCard
              setupStatus={setupStatus}
              isDismissing={false}
              onDismiss={handleDismissProgressCard}
              onTaskSelect={handleProgressTaskSelect}
            />
          )}

          <div>
            <SpendingSummary
              categories={categories}
              overview={overview}
              closeout={closeout}
              isCloseoutLoading={isCloseoutLoading}
              onCloseMonth={() => openCloseoutTray("close")}
              onViewCloseout={() => openCloseoutTray("view")}
              onReviewCloseout={() => openCloseoutTray("review")}
              onSetBudget={() => {
                const params = new URLSearchParams({
                  month: currentMonth,
                  edit: "1",
                })
                router.push(`/settings/budget?${params.toString()}`)
              }}
            />
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

          <DashboardFundsCard
            activeFunds={activeFunds}
            totalFundBalance={totalFundBalance}
            featuredFund={featuredFund}
            recentCloseoutHighlight={recentCloseoutHighlight}
          />

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
                tags={tags}
                emptyTitle="Your spending patterns will appear here"
                emptyDescription="Add a transaction to start filling the page."
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

      <MonthCloseoutTray
        open={isCloseoutTrayOpen}
        mode={closeoutTrayMode}
        month={currentMonth}
        closeout={closeout}
        onOpenChange={setIsCloseoutTrayOpen}
        onModeChange={setCloseoutTrayMode}
        onSaved={handleCloseoutSaved}
      />
    </div>
  )
}

function DashboardFundsCard({
  activeFunds,
  totalFundBalance,
  featuredFund,
  recentCloseoutHighlight,
}: {
  activeFunds: FundListItem[]
  totalFundBalance: number
  featuredFund: FundListItem | null
  recentCloseoutHighlight: { fund: FundListItem; amount: string; month: string } | null
}) {
  const hasFunds = activeFunds.length > 0
  const ctaHref = hasFunds ? "/insights/funds" : "/insights/funds?create=1"
  const ctaLabel = hasFunds ? "Open" : "Create fund"
  const hasGoal = Boolean(featuredFund?.goal_amount)
  const percentFunded = Math.max(0, Math.min(Math.round(parseAmount(featuredFund?.percent_funded)), 100))

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4 px-1 lg:hidden">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Funds</p>
          <h2 className="mt-1 text-base font-semibold text-foreground">Dedicated money</h2>
        </div>
        <Button variant={hasFunds ? "ghost" : "outline"} size="sm" className="rounded-full" asChild>
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      </div>
      <Card className="overflow-hidden border-0 shadow-sm">
        <div className="hidden items-start justify-between gap-4 px-6 pt-6 lg:flex">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Funds</p>
            <h2 className="mt-1 text-base font-semibold text-foreground">Dedicated money</h2>
          </div>
          <Button variant={hasFunds ? "ghost" : "outline"} size="sm" className="rounded-full" asChild>
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
        </div>

        {!hasFunds ? (
          <div className="space-y-4 px-6 pb-6 pt-6 lg:pt-4">
            <p className="max-w-md text-sm text-muted-foreground">
              Create a place for money you are setting aside.
            </p>
            <p className="text-sm text-muted-foreground">Japan 2026 · Moving Fund · Emergency Fund</p>
          </div>
        ) : (
          <div className="space-y-4 px-6 pb-6 pt-6 lg:pt-4">
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Saved</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {formatCurrency(totalFundBalance)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Active funds</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{activeFunds.length}</p>
              </div>
            </div>

            {recentCloseoutHighlight ? (
              <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 px-4 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <Sparkles className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {(formatMonthLabel(recentCloseoutHighlight.month) ?? recentCloseoutHighlight.month).split(" ")[0]} added{" "}
                      {formatCurrency(recentCloseoutHighlight.amount)} to {recentCloseoutHighlight.fund.name}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Closing under budget turned into real progress.
                    </p>
                  </div>
                </div>
              </div>
            ) : featuredFund ? (
              <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{featuredFund.name}</p>
                    {hasGoal ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatCurrency(featuredFund.current_balance)} of {formatCurrency(featuredFund.goal_amount ?? 0)}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatCurrency(featuredFund.current_balance)} saved
                        {featuredFund.target_month ? ` · Target ${formatMonthLabel(featuredFund.target_month) ?? featuredFund.target_month}` : ""}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                </div>
                {hasGoal ? (
                  <div className="mt-3">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium text-foreground">{percentFunded}% funded</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted/70">
                      <div
                        className={cn("h-full rounded-full bg-foreground/80", percentFunded === 0 && "min-w-0")}
                        style={{ width: `${percentFunded}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline">Open-ended</Badge>
                    <Badge variant="outline">{featuredFund.entries_count} entries</Badge>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  )
}
