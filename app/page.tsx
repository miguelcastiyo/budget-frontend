"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { BottomNav, FloatingAddButton } from "@/components/layout/bottom-nav"
import { MonthSelector } from "@/components/budget/month-selector"
import { formatMonthValue, getCurrentMonthKey } from "@/lib/date-filters"
import { formatCurrency } from "@/lib/formatters"
import { SpendingSummary } from "@/components/budget/spending-summary"
import { MonthCloseoutTray, type MonthCloseoutTrayMode } from "@/components/budget/month-closeout-tray"
import { CategoryCard } from "@/components/budget/category-card"
import { TagBreakdown } from "@/components/budget/tag-breakdown"
import { TransactionList } from "@/components/budget/transaction-list"
import { AddTransactionSheet } from "@/components/budget/add-transaction-sheet"
import { ApiError, apiClient } from "@/lib/api/client"
import type { MonthCloseoutResponse, MonthOverviewResponse, Transaction } from "@/lib/api/types"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth/auth-provider"
import { FirstMonthActionCard, FirstMonthProgressCard } from "@/components/budget/first-run-checklist-card"
import type { SetupTask } from "@/lib/api/types"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"
import { formatMoneyCents } from "@/lib/domain/financial/money"
import { FundsCta } from "@/components/funds/funds-cta"
import { useV2Add } from "@/components/budget/v2-add-provider"
import { useInterfacePreference } from "@/components/layout/interface-preference"
import { V2Overview } from "@/components/budget/v2-overview"

const FIRST_MONTH_PROGRESS_DISMISSED_KEY = "budget-first-month-progress-dismissed"

export default function DashboardPage() {
  const router = useRouter()
  const { version } = useInterfacePreference()
  const { openAdd } = useV2Add()
  const { setupStatus, refreshProfile } = useAuth()
  const authority = useFinancialAuthority()
  const reviewEnabled = authority.pendingCaptureEnabled || (authority.isUnlocked && authority.pendingGlobalCount > 0)
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthKey())
  const [showAddTransaction, setShowAddTransaction] = useState(false)
  const [overview, setOverview] = useState<MonthOverviewResponse | null>(null)
  const [closeout, setCloseout] = useState<MonthCloseoutResponse | null>(null)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCloseoutLoading, setIsCloseoutLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recurringWarning, setRecurringWarning] = useState<string | null>(null)
  const [detailView, setDetailView] = useState<"tags" | "recent">("tags")
  const [isDismissingFirstRun, setIsDismissingFirstRun] = useState(false)
  const [isProgressDismissed, setIsProgressDismissed] = useState(false)
  const [isCloseoutTrayOpen, setIsCloseoutTrayOpen] = useState(false)
  const [closeoutTrayMode, setCloseoutTrayMode] = useState<MonthCloseoutTrayMode>("close")
  const dashboardRequestRef = useRef(0)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    setIsProgressDismissed(window.localStorage.getItem(FIRST_MONTH_PROGRESS_DISMISSED_KEY) === "1")
  }, [])

  const loadDashboardData = useCallback(async () => {
    if (authority.isLoading) {
      return
    }
    const requestId = ++dashboardRequestRef.current
    setIsLoading(true)
    setIsCloseoutLoading(true)
    setError(null)

    try {
      const overviewRequest = authority.materializeRecurring(currentMonth).then(async (result) => ({
        overview: await authority.getMonthOverview(currentMonth),
        recurringWarning: result.status === "failed"
          ? "Recurring items could not be fully posted. Overview is showing the last committed state."
          : null,
      }))
      const [overviewResult, closeoutResult] = await Promise.allSettled([
        overviewRequest,
        authority.getMonthCloseout(currentMonth),
      ])

      if (requestId !== dashboardRequestRef.current) {
        return
      }

      if (overviewResult.status === "rejected") {
        throw overviewResult.reason
      }

      setOverview(overviewResult.value.overview)
      setRecurringWarning(overviewResult.value.recurringWarning)

      if (closeoutResult.status === "fulfilled" && closeoutResult.value) {
        setCloseout(closeoutResult.value)
      } else {
        setCloseout(null)
      }

    } catch (err) {
      if (requestId !== dashboardRequestRef.current) {
        return
      }
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to load dashboard data")
      }
    } finally {
      if (requestId === dashboardRequestRef.current) {
        setIsLoading(false)
        setIsCloseoutLoading(false)
      }
    }
  }, [authority, currentMonth])

  useEffect(() => {
    void loadDashboardData()
  }, [loadDashboardData])

  useEffect(() => {
    const refresh = () => void loadDashboardData()
    window.addEventListener("budget:v2-transaction-created", refresh)
    return () => window.removeEventListener("budget:v2-transaction-created", refresh)
  }, [loadDashboardData])

  const openCreate = () => { if (version === "v2") openAdd("full"); else setShowAddTransaction(true) }
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
      openCreate()
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

  if (isLoading && !overview) {
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
        {recurringWarning && (
          <Card className="p-4 mb-6 border-0 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">{recurringWarning}</p>
              <Button variant="outline" size="sm" onClick={() => void loadDashboardData()}>Retry</Button>
            </div>
          </Card>
        )}

        {version === "v2" ? <V2Overview
          month={currentMonth}
          onMonthChange={setCurrentMonth}
          overview={overview}
          closeout={closeout}
          closeoutLoading={isCloseoutLoading}
          loading={isLoading}
          pending={reviewEnabled && authority.isUnlocked && !authority.isLoading ? authority.getPendingMonthSummary(currentMonth) : null}
          onboarding={(shouldShowFirstMonthActionCard || (shouldShowFirstRunChecklist && setupStatus && !isProgressDismissed)) ? <>
            {shouldShowFirstMonthActionCard && <FirstMonthActionCard month={formatMonthValue(currentMonth, { month: "long" }) ?? currentMonth} isDismissing={isDismissingFirstRun} onAddTransaction={() => openCreate()} onDismiss={() => void handleDismissFirstRun()} />}
            {shouldShowFirstRunChecklist && setupStatus && !isProgressDismissed && <FirstMonthProgressCard setupStatus={setupStatus} isDismissing={false} onDismiss={handleDismissProgressCard} onTaskSelect={handleProgressTaskSelect} />}
          </> : null}
          onClose={() => openCloseoutTray("close")}
          onViewCloseout={() => openCloseoutTray("view")}
          onReviewCloseout={() => openCloseoutTray("review")}
          onSetBudget={() => router.push(`/settings/budget?${new URLSearchParams({ month: currentMonth, edit: "1" })}`)}
          onAdd={() => openCreate()}
          onCategory={(category) => router.push(`/transactions?${new URLSearchParams({ category, month: currentMonth })}`)}
          onTag={(tagId) => router.push(`/transactions?${new URLSearchParams({ tag_id: tagId, month: currentMonth })}`)}
          onTransaction={setEditingTransaction}
          onViewAll={() => router.push(`/transactions?${new URLSearchParams({ month: currentMonth })}`)}
        /> : <>
        <div className="mb-4 lg:mb-3">
          <MonthSelector
            currentMonth={currentMonth}
            onChange={setCurrentMonth}
          />
          {isLoading && (
            <div className="mt-2 flex items-center justify-end gap-2 text-xs text-muted-foreground" role="status" aria-live="polite">
              <Spinner className="size-3.5" />
              <span>Loading {formatMonthValue(currentMonth, { month: "long" }) ?? currentMonth}...</span>
            </div>
          )}
        </div>

        {reviewEnabled && authority.isUnlocked && !authority.isLoading && (() => {
          const pending = authority.getPendingMonthSummary(currentMonth)
          return pending.count > 0 ? <Link href="/review" className="mb-5 flex items-center justify-between gap-3 rounded-xl bg-secondary/50 px-4 py-3 text-sm"><span>{pending.count} pending · {formatCurrency(Number(formatMoneyCents(pending.knownAmountCents)))} known{pending.unknownAmountCount > 0 ? ` · ${pending.unknownAmountCount} without amount` : ""}</span><span className="font-semibold">Review →</span></Link> : null
        })()}
        <div className="space-y-6 lg:space-y-8">
          {shouldShowFirstMonthActionCard && (
            <FirstMonthActionCard
              month={formatMonthValue(currentMonth, { month: "long" }) ?? currentMonth}
              isDismissing={isDismissingFirstRun}
              onAddTransaction={() => openCreate()}
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

          <FundsCta />

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
                onEmptyAction={() => openCreate()}
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
                showScrollHint
                emptyTitle="No transactions this month"
                emptyDescription="Add your first transaction to start tracking."
                onEmptyAction={() => openCreate()}
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
        </>}
      </main>

      <FloatingAddButton
        onClick={() => openCreate()}
        showCoachmark={!hasMonthTransactions}
      />
      <BottomNav
        onAddClick={() => openCreate()}
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
        onTransactionUpdated={(updatedTransaction) => {
          setEditingTransaction(null)
          setOverview((current) => current
            ? {
                ...current,
                recent_transactions: current.recent_transactions.map((currentTransaction) =>
                  currentTransaction.id === updatedTransaction.id ? updatedTransaction : currentTransaction
                ),
              }
            : current
          )
          void loadDashboardData()
        }}
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
