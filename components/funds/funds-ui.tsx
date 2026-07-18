"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  HandCoins,
  Minus,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react"
import { Header } from "@/components/layout/header"
import { BottomNav } from "@/components/layout/bottom-nav"
import { AmountInput } from "@/components/budget/amount-input"
import { ResponsiveConfirmDialog } from "@/components/ui/responsive-confirm-dialog"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar as AppCalendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, apiClient } from "@/lib/api/client"
import type {
  Card as BudgetCard,
  CreateFundEntryRequest,
  CreateFundRequest,
  FundBudgetTracking,
  FundCloseoutSummaryResponse,
  FundDetail,
  FundEntry,
  FundEntryDirection,
  FundEntryType,
  FundListItem,
  FundStatus,
  Tag,
  Transaction,
  UpdateFundEntryRequest,
  UpdateFundRequest,
} from "@/lib/api/types"
import {
  formatDateValue,
  formatDateTimeValue,
  formatMonthLabel,
  getCurrentMonthKey,
  getMonthDateRange,
  parseIsoDate,
  parseMonthKey,
  toIsoDate,
} from "@/lib/date-filters"
import { formatCurrency } from "@/lib/formatters"
import { cn } from "@/lib/utils"

type FundsFilter = "active" | "archived"
type FundActionMode = "create" | "edit"
type EntryActionMode = "create" | "edit"
type EntryIntent = "add" | "use"

const fundFilterOptions: Array<{ value: FundsFilter; label: string }> = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
]

const budgetTrackingOptions: Array<{ value: FundBudgetTracking; label: string; helper: string }> = [
  {
    value: "fund_only",
    label: "Fund only",
    helper: "Moves money in the fund ledger without adding budget spend.",
  },
  {
    value: "create_transaction",
    label: "Create savings transaction",
    helper: "Adds the fund entry and creates a real savings transaction.",
  },
  {
    value: "link_existing_transaction",
    label: "Link existing savings transaction",
    helper: "Attach this fund contribution to a transaction you already entered.",
  },
]

const NO_CARD_SELECT_VALUE = "__none__"
const monthPickerMonths = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

function parseAmount(value: string | null | undefined): number {
  const amount = Number.parseFloat(value ?? "")
  return Number.isFinite(amount) ? amount : 0
}

function numberLabel(value: number, singular: string, plural = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : plural}`
}

function entryTypeLabel(entry: FundEntry): string {
  if (entry.source_type === "month_closeout") {
    return "Month closeout"
  }
  if (entry.source_type === "transaction") {
    return entry.direction === "in" ? "Savings transaction" : "Transaction-linked use"
  }
  if (entry.entry_type === "starting_balance") {
    return "Starting balance"
  }
  if (entry.entry_type === "adjustment") {
    return "Adjustment"
  }
  return entry.direction === "in" ? "Added money" : "Used money"
}

function fundProgressWidth(percent: string | null): string {
  const numeric = parseAmount(percent)
  return `${Math.max(0, Math.min(numeric, 100))}%`
}

function hasPositiveAmount(value: string | number | null | undefined): boolean {
  return parseAmount(String(value ?? "")) > 0
}

function activeCountLabel(value: number): string {
  return `${value} active`
}

function goalCountLabel(value: number): string {
  return `${value} ${value === 1 ? "goal" : "goals"}`
}

function canEditEntry(entry: FundEntry): boolean {
  return entry.source_type === "manual" || entry.source_type === "starting_balance" || entry.source_type === "correction"
}

function buildBalanceBreakdownRows(fund: FundDetail, entries: FundEntry[]) {
  const manualContributionTotal = entries
    .filter((entry) => entry.source_type === "manual" && entry.direction === "in")
    .reduce((sum, entry) => sum + parseAmount(entry.amount), 0)
  const linkedContributionTotal = parseAmount(fund.source_breakdown.transaction)
  const contributionTotal = manualContributionTotal + linkedContributionTotal
  const withdrawalTotal = entries
    .filter((entry) => entry.direction === "out")
    .reduce((sum, entry) => sum + parseAmount(entry.amount), 0)

  return [
    { label: "Starting balance", amount: parseAmount(fund.source_breakdown.starting_balance) },
    { label: "Contributions", amount: contributionTotal },
    { label: "Withdrawals", amount: -withdrawalTotal },
    { label: "Month closeouts", amount: parseAmount(fund.source_breakdown.month_closeout) },
    { label: "Corrections", amount: parseAmount(fund.source_breakdown.correction) },
  ].filter((row) => row.amount !== 0)
}

function startOfCurrentMonth(): string {
  const range = getMonthDateRange(getCurrentMonthKey())
  return range?.date_from ?? toIsoDate(new Date())
}

function endOfCurrentMonth(): string {
  const range = getMonthDateRange(getCurrentMonthKey())
  return range?.date_to ?? toIsoDate(new Date())
}

function buildEntryPayload(values: EntryFormState, intent: EntryIntent): CreateFundEntryRequest {
  const isOutflow = intent === "use"
  const entryType: FundEntryType = isOutflow ? "withdrawal" : values.entry_type
  const direction: FundEntryDirection = isOutflow ? "out" : "in"

  return {
    entry_date: values.entry_date,
    entry_type: entryType,
    direction,
    amount: values.amount,
    source_type: values.source_type,
    note: values.note.trim() || null,
    budget_tracking: isOutflow ? "fund_only" : values.budget_tracking,
    transaction_id: values.budget_tracking === "link_existing_transaction" ? values.transaction_id || null : null,
    transaction:
      values.budget_tracking === "create_transaction"
        ? {
            expense: values.transaction_expense.trim(),
            tag_id: values.transaction_tag_id,
            card_id: values.transaction_card_id || null,
            notes: values.transaction_notes.trim() || null,
          }
        : null,
  }
}

interface FundFormState {
  name: string
  goal_enabled: boolean
  goal_amount: string
  target_month: string
  notes: string
  starting_balance: string
}

interface EntryFormState {
  entry_date: string
  entry_type: FundEntryType
  amount: string
  source_type: "manual" | "transaction" | "starting_balance" | "correction"
  note: string
  budget_tracking: FundBudgetTracking
  transaction_id: string
  transaction_expense: string
  transaction_tag_id: string
  transaction_card_id: string
  transaction_notes: string
}

function getDefaultFundFormState(): FundFormState {
  return {
    name: "",
    goal_enabled: false,
    goal_amount: "",
    target_month: "",
    notes: "",
    starting_balance: "",
  }
}

function getFundFormState(fund?: FundListItem | FundDetail | null): FundFormState {
  if (!fund) {
    return getDefaultFundFormState()
  }

  return {
    name: fund.name,
    goal_enabled: fund.goal_amount !== null,
    goal_amount: fund.goal_amount ?? "",
    target_month: fund.target_month ?? "",
    notes: fund.notes ?? "",
    starting_balance: "",
  }
}

function getEntryFormState(entry?: FundEntry | null, intent: EntryIntent = "add"): EntryFormState {
  return {
    entry_date: entry?.entry_date ?? toIsoDate(new Date()),
    entry_type: entry?.entry_type ?? (intent === "use" ? "withdrawal" : "contribution"),
    amount: entry?.amount ?? "",
    source_type:
      entry?.source_type === "month_closeout"
        ? "manual"
        : (entry?.source_type ?? (intent === "use" ? "manual" : "manual")),
    note: entry?.note ?? "",
    budget_tracking: "fund_only",
    transaction_id: "",
    transaction_expense: "",
    transaction_tag_id: "",
    transaction_card_id: "",
    transaction_notes: "",
  }
}

function renderFundShell(children: React.ReactNode) {
  return (
    <div className="min-h-screen bg-background pb-mobile-nav">
      <Header />
      <main className="mx-auto max-w-lg px-5 pb-[calc(var(--bottom-nav-height)+var(--bottom-nav-page-gap)+env(safe-area-inset-bottom,0px)+3rem)] pt-standalone-safe-top lg:max-w-6xl lg:px-8 lg:pb-0">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}

export function FundsOverviewPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [filter, setFilter] = useState<FundsFilter>("active")
  const [funds, setFunds] = useState<FundListItem[]>([])
  const [activeFundMetrics, setActiveFundMetrics] = useState<FundListItem[]>([])
  const [summary, setSummary] = useState<FundCloseoutSummaryResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [dialogMode, setDialogMode] = useState<FundActionMode>("create")
  const [selectedFund, setSelectedFund] = useState<FundListItem | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setSummaryError(null)

    try {
      const metricsPromise =
        filter === "active"
          ? null
          : apiClient.getFunds({ status: "active", include_entries_summary: true })

      const [fundsResult, activeMetricsResult, summaryResult] = await Promise.allSettled([
        apiClient.getFunds({ status: filter, include_entries_summary: true }),
        metricsPromise ?? Promise.resolve(null),
        apiClient.getFundCloseoutSummary(new Date().getFullYear()),
      ])

      if (fundsResult.status === "rejected") {
        throw fundsResult.reason
      }

      setFunds(fundsResult.value.items)

      if (filter === "active") {
        setActiveFundMetrics(fundsResult.value.items.filter((fund) => fund.status === "active"))
      } else if (activeMetricsResult.status === "fulfilled" && activeMetricsResult.value) {
        setActiveFundMetrics(activeMetricsResult.value.items.filter((fund) => fund.status === "active"))
      } else {
        setActiveFundMetrics([])
        setSummaryError("Some supporting fund totals are unavailable right now.")
      }

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value)
      } else {
        setSummary(null)
        setSummaryError("Closeout summary is unavailable right now.")
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to load funds")
      }
    } finally {
      setIsLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setDialogMode("create")
      setSelectedFund(null)
      setIsDialogOpen(true)
    }
  }, [searchParams])

  const totalBalance = activeFundMetrics.reduce((sum, fund) => sum + parseAmount(fund.current_balance), 0)
  const totalGoals = activeFundMetrics.filter((fund) => fund.goal_amount !== null).length
  const closeoutTotal = summary?.total_closeout_contributed ?? 0
  const hasCloseoutContributions = hasPositiveAmount(closeoutTotal)

  return renderFundShell(
    <div className="space-y-5 lg:space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Funds</p>
          <h1 className="mt-1.5 text-2xl font-semibold leading-tight tracking-tight text-foreground lg:mt-2 lg:text-3xl">
            Goals, buffers, and saved progress
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground lg:mt-2">
            Track dedicated money without losing the monthly budget view.
          </p>
        </div>
        <Button className="hidden sm:inline-flex" onClick={() => {
          setDialogMode("create")
          setSelectedFund(null)
          setIsDialogOpen(true)
        }}>
          <Plus className="size-4" />
          New fund
        </Button>
      </div>

      {error ? (
        <Card className="border-0">
          <CardContent className="flex items-center justify-between gap-4 pt-6">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" onClick={() => void loadData()}>Retry</Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)] lg:gap-8">
        <div className="space-y-4 lg:space-y-5">
          <div className="space-y-1 lg:hidden">
            <p className="text-lg font-semibold tracking-tight text-foreground">
              {formatCurrency(totalBalance)} <span className="text-sm font-normal text-muted-foreground">total saved</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {activeCountLabel(activeFundMetrics.length)} <span aria-hidden="true">·</span> {goalCountLabel(totalGoals)}
            </p>
          </div>

          <section className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Your funds</p>
                </div>
                <Button className="h-11 rounded-full px-3 text-sm sm:hidden" onClick={() => {
                  setDialogMode("create")
                  setSelectedFund(null)
                  setIsDialogOpen(true)
                }}>
                  <Plus className="size-4" />
                  New fund
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {fundFilterOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={filter === option.value ? "default" : "outline"}
                    className="rounded-full"
                    onClick={() => setFilter(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <FundsOverviewLoadingState />
            ) : funds.length === 0 ? (
              <FundsEmptyState
                filter={filter}
                onCreate={() => {
                  setDialogMode("create")
                  setSelectedFund(null)
                  setIsDialogOpen(true)
                }}
              />
            ) : (
              <div className="space-y-3.5 lg:space-y-4">
                {funds.map((fund) => (
                  <FundListCard
                    key={fund.id}
                    fund={fund}
                    onEdit={() => {
                      setDialogMode("edit")
                      setSelectedFund(fund)
                      setIsDialogOpen(true)
                    }}
                    onArchiveRestore={() =>
                      void handleArchiveRestore(
                        fund,
                        fund.status === "active" ? "archive" : "restore",
                        loadData,
                        setError
                      )
                    }
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3 border-t border-border/70 pt-5 lg:hidden">
            <div className="flex items-center gap-2">
              <HandCoins className="size-4 text-muted-foreground" />
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">From month closeouts</p>
            </div>
            <p className="text-lg font-semibold tracking-tight text-foreground">
              {formatCurrency(closeoutTotal)} this year
            </p>
            <p className="text-sm text-muted-foreground">
              {hasCloseoutContributions
                ? "Moved into funds from closed months."
                : "No contributions from month closeouts yet."}
            </p>
          </section>
        </div>

        <aside className="hidden lg:block">
          <FundsSidebar
            totalBalance={totalBalance}
            activeCount={activeFundMetrics.length}
            totalGoals={totalGoals}
            closeoutTotal={closeoutTotal}
            summaryError={summaryError}
          />
        </aside>
      </div>

      <FundDialog
        open={isDialogOpen}
        mode={dialogMode}
        fund={selectedFund}
        onOpenChange={setIsDialogOpen}
        onSaved={() => {
          setIsDialogOpen(false)
          void loadData()
          router.replace("/insights/funds")
        }}
      />
    </div>
  )
}

function FundsOverviewLoadingState() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)]">
      <Card className="border-0">
        <CardContent className="space-y-5 pt-6">
          <div className="h-6 w-40 rounded-full bg-muted/70" />
          <div className="space-y-2">
            <div className="h-10 w-32 rounded-full bg-muted/70" />
            <div className="h-5 w-28 rounded-full bg-muted/60" />
          </div>
          <div className="h-2 w-full rounded-full bg-muted/70" />
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="h-5 w-32 rounded-full bg-muted/60" />
            <div className="h-5 w-28 rounded-full bg-muted/60" />
          </div>
          <div className="h-5 w-36 rounded-full bg-muted/60" />
        </CardContent>
      </Card>
      <Card className="hidden border-0 lg:block">
        <CardContent className="space-y-4 pt-6">
          <div className="h-4 w-24 rounded-full bg-muted/60" />
          <div className="h-10 w-28 rounded-full bg-muted/70" />
          <div className="h-px w-full bg-border/70" />
          <div className="h-4 w-32 rounded-full bg-muted/60" />
          <div className="h-4 w-36 rounded-full bg-muted/60" />
        </CardContent>
      </Card>
    </div>
  )
}

function FundsEmptyState({
  filter,
  onCreate,
}: {
  filter: FundsFilter
  onCreate: () => void
}) {
  if (filter === "archived") {
    return (
      <Card className="border-0">
        <CardContent className="space-y-3 pt-6">
          <div className="flex items-center gap-3">
            <FolderOpen className="size-5 text-muted-foreground" />
            <p className="font-medium text-foreground">No archived funds</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0">
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-center gap-3">
          <FolderOpen className="size-5 text-muted-foreground" />
          <p className="font-medium text-foreground">No active funds yet</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Create a fund to start setting money aside for a goal, buffer, or future expense.
        </p>
        <Button className="w-full sm:w-auto" onClick={onCreate}>
          <Plus className="size-4" />
          New fund
        </Button>
      </CardContent>
    </Card>
  )
}

function FundsSidebar({
  totalBalance,
  activeCount,
  totalGoals,
  closeoutTotal,
  summaryError,
}: {
  totalBalance: number
  activeCount: number
  totalGoals: number
  closeoutTotal: string | number
  summaryError: string | null
}) {
  const hasCloseoutContributions = hasPositiveAmount(closeoutTotal)

  return (
    <div className="space-y-6 pt-1">
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">At a glance</p>
        <div className="space-y-1">
          <p className="text-xl font-semibold tracking-tight text-foreground">
            {formatCurrency(totalBalance)} <span className="text-sm font-normal text-muted-foreground">total saved</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {activeCountLabel(activeCount)} <span aria-hidden="true">·</span> {goalCountLabel(totalGoals)}
          </p>
        </div>
      </div>

      <div className="h-px bg-border/70" />

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <HandCoins className="size-4 text-muted-foreground" />
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">From month closeouts</p>
        </div>
        <p className="text-xl font-semibold tracking-tight text-foreground">{formatCurrency(closeoutTotal)} this year</p>
        <p className="text-sm text-muted-foreground">
          {hasCloseoutContributions
            ? "Moved into funds from closed months."
            : "No contributions from month closeouts yet."}
        </p>
        {summaryError ? <p className="text-sm text-muted-foreground">{summaryError}</p> : null}
      </div>
    </div>
  )
}

function FundListCard({
  fund,
  onEdit,
  onArchiveRestore,
}: {
  fund: FundListItem
  onEdit: () => void
  onArchiveRestore: () => void
}) {
  const savedAmount = parseAmount(fund.current_balance)
  const goalAmount = parseAmount(fund.goal_amount)
  const hasGoal = goalAmount > 0
  const percentFunded = Math.max(0, Math.min(Math.round(parseAmount(fund.percent_funded ?? "0")), 100))
  const remainingAmount = Math.max(goalAmount - savedAmount, 0)
  const targetLabel = fund.target_month ? formatMonthLabel(fund.target_month) ?? fund.target_month : null

  return (
    <Card className="overflow-hidden border border-border/50 shadow-sm transition-colors hover:border-border hover:bg-muted/20">
      <CardContent className="relative p-4 lg:p-5">
        <div className="absolute right-4 top-3 z-10 lg:right-5 lg:top-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="rounded-full text-muted-foreground hover:text-foreground"
                aria-label={`Fund actions for ${fund.name}`}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="size-4" />
                Edit fund
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onArchiveRestore}>
                {fund.status === "active" ? (
                  <>
                    <Trash2 className="size-4" />
                    Archive fund
                  </>
                ) : (
                  <>
                    <RotateCcw className="size-4" />
                    Restore fund
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Link
          href={`/insights/funds/${fund.id}`}
          aria-label={`Open ${fund.name}`}
          className="block space-y-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:space-y-3.5"
        >
          <div className="pr-12">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">{fund.name}</h2>
              {hasGoal ? <Badge variant="outline">Goal</Badge> : null}
              {fund.status === "archived" ? <Badge variant="outline">Archived</Badge> : null}
            </div>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">{formatCurrency(savedAmount)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasGoal ? `saved of ${formatCurrency(goalAmount)}` : "saved"}
              </p>
            </div>
            {hasGoal ? (
              <p className="pt-1 text-sm font-medium text-foreground">{percentFunded}%</p>
            ) : null}
          </div>

          {hasGoal ? (
            <div className="space-y-2.5 lg:space-y-3">
              <div
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label={`${fund.name}: ${percentFunded} percent funded`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percentFunded}
              >
                <div className="h-full rounded-full bg-primary" style={{ width: fundProgressWidth(fund.percent_funded) }} />
              </div>
              <div className="space-y-0.5 text-sm lg:space-y-1">
                <span className="font-medium text-foreground">
                  {remainingAmount === 0 ? "Goal reached" : `${formatCurrency(remainingAmount)} remaining`}
                </span>
                {targetLabel ? <p className="text-muted-foreground">{`Target ${targetLabel}`}</p> : null}
              </div>
            </div>
          ) : targetLabel ? (
            <p className="text-sm text-muted-foreground">{`Target ${targetLabel}`}</p>
          ) : null}

          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{numberLabel(fund.entries_count, "contribution")}</span>
            <span className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground" aria-hidden="true">
              <ChevronRight className="size-4" />
            </span>
          </div>
        </Link>
      </CardContent>
    </Card>
  )
}

export function FundDetailPage() {
  const router = useRouter()
  const params = useParams<{ fundId: string }>()
  const fundId = typeof params?.fundId === "string" ? params.fundId : ""
  const [fund, setFund] = useState<FundDetail | null>(null)
  const [entries, setEntries] = useState<FundEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fundDialogOpen, setFundDialogOpen] = useState(false)
  const [entryDialogOpen, setEntryDialogOpen] = useState(false)
  const [entryDialogMode, setEntryDialogMode] = useState<EntryActionMode>("create")
  const [entryIntent, setEntryIntent] = useState<EntryIntent>("add")
  const [selectedEntry, setSelectedEntry] = useState<FundEntry | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FundEntry | null>(null)

  const loadData = useCallback(async () => {
    if (!fundId) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const [fundResponse, entriesResponse] = await Promise.all([
        apiClient.getFund(fundId),
        apiClient.getFundEntries(fundId, {
          page: 1,
          page_size: 100,
          date_from: "2020-01-01",
          date_to: endOfCurrentMonth(),
        }),
      ])
      setFund(fundResponse)
      setEntries(entriesResponse.items)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to load fund")
      }
    } finally {
      setIsLoading(false)
    }
  }, [fundId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const savedAmount = fund ? parseAmount(fund.current_balance) : 0
  const goalAmount = fund ? parseAmount(fund.goal_amount) : 0
  const hasGoal = goalAmount > 0
  const percentFunded = fund ? Math.max(0, Math.min(Math.round(parseAmount(fund.percent_funded ?? "0")), 100)) : 0
  const remainingAmount = fund ? Math.max(goalAmount - savedAmount, 0) : 0
  const targetLabel = fund?.target_month ? formatMonthLabel(fund.target_month) ?? fund.target_month : null
  const notesPreview = fund?.notes?.trim()
  const balanceBreakdownRows = fund ? buildBalanceBreakdownRows(fund, entries) : []

  return renderFundShell(
    <div className="space-y-6 lg:space-y-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="rounded-full px-3" asChild>
          <Link href="/insights/funds">
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <Card className="border-0">
          <CardContent className="flex items-center justify-center gap-3 pt-6">
            <Spinner className="size-5" />
            <span className="text-sm text-muted-foreground">Loading fund...</span>
          </CardContent>
        </Card>
      ) : !fund ? (
        <Card className="border-0">
          <CardContent className="space-y-3 pt-6">
            <p className="font-medium text-foreground">Fund not found</p>
            <p className="text-sm text-muted-foreground">{error ?? "This fund could not be loaded."}</p>
            <Button asChild><Link href="/insights/funds">Return to funds</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {error ? (
            <Card className="border-0">
              <CardContent className="flex items-center justify-between gap-4 pt-6">
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" onClick={() => void loadData()}>Retry</Button>
              </CardContent>
            </Card>
          ) : null}

          <Card className="overflow-hidden border border-border/40 bg-card [background-image:radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--primary)_18%,transparent),transparent_42%),linear-gradient(135deg,var(--card),var(--secondary))]">
            <CardContent className="space-y-5 p-5 lg:space-y-6 lg:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground lg:text-4xl">{fund.name}</h1>
                    {hasGoal ? <Badge variant="outline">Goal</Badge> : null}
                    {fund.status === "archived" ? <Badge variant="outline">Archived</Badge> : null}
                  </div>
                  {notesPreview ? <p className="max-w-2xl text-sm text-muted-foreground">{notesPreview}</p> : null}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="-mr-2 rounded-full text-muted-foreground hover:text-foreground"
                      aria-label={`Fund actions for ${fund.name}`}
                    >
                      <MoreHorizontal className="size-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl">
                    <DropdownMenuItem onClick={() => setFundDialogOpen(true)}>
                      <Pencil className="size-4" />
                      Edit fund
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => void handleArchiveRestore(fund, fund.status === "active" ? "archive" : "restore", loadData, setError)}
                    >
                      {fund.status === "active" ? (
                        <>
                          <Trash2 className="size-4" />
                          Archive fund
                        </>
                      ) : (
                        <>
                          <RotateCcw className="size-4" />
                          Restore fund
                        </>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-4xl font-semibold tracking-tight text-foreground lg:text-5xl">
                      {formatCurrency(savedAmount)} <span className="text-base font-medium tracking-normal text-muted-foreground">saved</span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {hasGoal ? `of ${formatCurrency(goalAmount)} goal` : "No fixed goal"}
                    </p>
                  </div>
                  {hasGoal ? <p className="pt-2 text-lg font-semibold text-foreground">{percentFunded}%</p> : null}
                </div>

                {hasGoal ? (
                  <div className="space-y-3">
                    <div
                      className="h-2 overflow-hidden rounded-full bg-muted/70"
                      role="progressbar"
                      aria-label={`${fund.name}: ${percentFunded} percent funded`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={percentFunded}
                    >
                      <div className="h-full rounded-full bg-foreground/80" style={{ width: fundProgressWidth(fund.percent_funded) }} />
                    </div>
                    <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-medium text-foreground">
                        {remainingAmount === 0 ? "Goal reached" : `${formatCurrency(remainingAmount)} remaining`}
                      </span>
                      {targetLabel ? <span className="text-muted-foreground">{`Target ${targetLabel}`}</span> : null}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  className="h-12 rounded-full"
                  disabled={fund.status !== "active"}
                  onClick={() => {
                    setEntryDialogMode("create")
                    setEntryIntent("add")
                    setSelectedEntry(null)
                    setEntryDialogOpen(true)
                  }}
                >
                  <Plus className="size-4" />
                  Add money
                </Button>
                <Button
                  className="h-12 rounded-full"
                  variant="outline"
                  disabled={fund.status !== "active"}
                  onClick={() => {
                    setEntryDialogMode("create")
                    setEntryIntent("use")
                    setSelectedEntry(null)
                    setEntryDialogOpen(true)
                  }}
                >
                  <Minus className="size-4" />
                  Use money
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-transparent shadow-none lg:bg-card lg:shadow-sm">
            <CardContent className="space-y-3 px-0 pt-0 lg:p-6">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Balance breakdown</p>
              <div className="divide-y divide-border/70 rounded-3xl border border-border/60 bg-card lg:rounded-2xl">
                {balanceBreakdownRows.map((row) => (
                  <SourceBreakdownRow key={row.label} label={row.label} amount={row.amount} />
                ))}
                <SourceBreakdownRow label="Current balance" amount={savedAmount} emphasis />
              </div>
            </CardContent>
          </Card>

          <section className="space-y-4 lg:rounded-3xl lg:bg-card lg:p-6 lg:shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Ledger</p>
                <span className="text-sm text-muted-foreground">{numberLabel(fund.entries_count, "entry")}</span>
              </div>
              <p className="text-sm text-muted-foreground">Every contribution and withdrawal from this fund.</p>
            </div>

            {entries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center">
                <p className="font-medium text-foreground">No entries yet</p>
                <p className="mt-2 text-sm text-muted-foreground">Add money to start tracking progress.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/70">
                {entries.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate font-medium text-foreground">{entry.note?.trim() || entryTypeLabel(entry)}</p>
                        {entry.source_month ? (
                          <Badge variant="outline" className="shrink-0">
                            {formatMonthLabel(entry.source_month) ?? entry.source_month}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDateTimeValue(entry.entry_date, { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <p className={cn("text-base font-semibold tracking-tight", entry.direction === "in" ? "text-success" : "text-foreground")}>
                        {entry.direction === "in" ? "+" : "-"}
                        {formatCurrency(entry.amount)}
                      </p>
                      {canEditEntry(entry) ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="rounded-full text-muted-foreground hover:text-foreground"
                              aria-label={`Entry actions for ${entryTypeLabel(entry)}`}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedEntry(entry)
                                setEntryDialogMode("edit")
                                setEntryIntent(entry.direction === "out" ? "use" : "add")
                                setEntryDialogOpen(true)
                              }}
                            >
                              <Pencil className="size-4" />
                              Edit entry
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDeleteTarget(entry)}>
                              <Trash2 className="size-4" />
                              Delete entry
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <FundDialog
            open={fundDialogOpen}
            mode="edit"
            fund={fund}
            onOpenChange={setFundDialogOpen}
            onSaved={() => {
              setFundDialogOpen(false)
              void loadData()
            }}
          />

          <FundEntryDialog
            open={entryDialogOpen}
            mode={entryDialogMode}
            intent={entryIntent}
            fund={fund}
            entry={selectedEntry}
            onOpenChange={setEntryDialogOpen}
            onSaved={() => {
              setEntryDialogOpen(false)
              void loadData()
            }}
          />

          <ResponsiveConfirmDialog
            open={Boolean(deleteTarget)}
            onOpenChange={(open) => {
              if (!open) {
                setDeleteTarget(null)
              }
            }}
            title="Delete this entry?"
            description="This only works for manual, starting-balance, and correction entries."
            confirmLabel="Delete entry"
            confirmVariant="destructive"
            onConfirm={() => void handleDeleteEntry(fund.id, deleteTarget, loadData, setDeleteTarget, setError)}
          >
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
              Linked transaction and closeout entries need to be changed from their original workflow.
            </div>
          </ResponsiveConfirmDialog>
        </>
      )}
    </div>
  )
}

function SourceBreakdownRow({ label, amount, emphasis = false }: { label: string; amount: number; emphasis?: boolean }) {
  const isNegative = amount < 0

  return (
    <div className={cn("flex items-center justify-between gap-3 px-4 py-3", emphasis ? "bg-muted/30" : null)}>
      <span className={cn("text-sm", emphasis ? "font-medium text-foreground" : "text-muted-foreground")}>{label}</span>
      <span className="font-medium text-foreground">
        {isNegative ? "-" : ""}
        {formatCurrency(Math.abs(amount))}
      </span>
    </div>
  )
}

function FundDialog({
  open,
  mode,
  fund,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  mode: FundActionMode
  fund: FundListItem | FundDetail | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [values, setValues] = useState<FundFormState>(getDefaultFundFormState())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setValues(getFundFormState(fund))
      setError(null)
    }
  }, [open, fund])

  const submit = async () => {
    if (!values.name.trim()) {
      setError("Fund name is required.")
      return
    }

    if (values.goal_enabled && parseAmount(values.goal_amount) <= 0) {
      setError("Enter a goal amount or remove the savings goal.")
      return
    }

    const goalAmount = values.goal_enabled ? values.goal_amount : null
    const targetMonth = values.goal_enabled ? values.target_month || null : null

    const payload: CreateFundRequest | UpdateFundRequest = {
      name: values.name.trim(),
      goal_amount: goalAmount,
      target_month: targetMonth,
      notes: values.notes.trim() || null,
      ...(mode === "create" ? { starting_balance: values.starting_balance || null } : {}),
    }

    setIsSubmitting(true)
    setError(null)

    try {
      if (mode === "create") {
        await apiClient.createFund(payload as CreateFundRequest)
      } else if (fund) {
        await apiClient.updateFund(fund.id, payload as UpdateFundRequest)
      }
      onSaved()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to save fund")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "Create fund" : "Edit fund"}
      description={mode === "create" ? "Track dedicated money without creating a new budget bucket." : fund?.name ?? "Fund details"}
      footer={
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="text-sm text-muted-foreground">{error ?? ""}</div>
          <Button className="h-12 rounded-xl px-6" onClick={() => void submit()} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : mode === "create" ? "Create fund" : "Save changes"}
          </Button>
        </div>
      }
      bodyClassName="space-y-5"
    >
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="fund-name">Name</Label>
          <Input
            id="fund-name"
            value={values.name}
            onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
            placeholder="Vacation, emergency, down payment..."
          />
        </div>

        {mode === "create" ? (
          <div className="grid gap-2">
            <AmountInput
              id="fund-starting-balance"
              name="fund-starting-balance"
              value={values.starting_balance}
              onValueChange={(starting_balance) => setValues((current) => ({ ...current, starting_balance }))}
              label="Starting balance"
            />
            <p className="text-sm text-muted-foreground">Money you've already set aside.</p>
          </div>
        ) : null}

        <div className="grid gap-3">
          {values.goal_enabled ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Goal</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full text-muted-foreground"
                onClick={() =>
                  setValues((current) => ({
                    ...current,
                    goal_enabled: false,
                    goal_amount: "",
                    target_month: "",
                  }))
                }
              >
                Remove
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="h-11 justify-start rounded-xl border-border/60"
              onClick={() => setValues((current) => ({ ...current, goal_enabled: true }))}
            >
              <Plus className="size-4" />
              Add a savings goal
            </Button>
          )}

          {values.goal_enabled ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <AmountInput
                  id="fund-goal"
                  name="fund-goal"
                  value={values.goal_amount}
                  onValueChange={(goal_amount) => setValues((current) => ({ ...current, goal_amount }))}
                  label="Goal amount"
                />
                <p className="text-sm text-muted-foreground">How much do you want to save?</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="fund-target-month">Target month</Label>
                <FundTargetMonthPicker
                  value={values.target_month}
                  onChange={(target_month) => setValues((current) => ({ ...current, target_month }))}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="fund-notes">Notes</Label>
          <Textarea
            id="fund-notes"
            rows={3}
            value={values.notes}
            onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Why this fund exists or how you want to use it."
          />
        </div>
      </div>
    </ResponsiveDialog>
  )
}

function FundTargetMonthPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const currentMonth = getCurrentMonthKey()
  const selectedMonth = value || currentMonth
  const parsedMonth = parseMonthKey(selectedMonth) ?? parseMonthKey(currentMonth) ?? new Date()
  const selectedYear = parsedMonth.getFullYear()
  const [viewYear, setViewYear] = useState(selectedYear)
  const selectedLabel = value ? formatMonthLabel(value) ?? value : "No target month"

  useEffect(() => {
    if (open) {
      setViewYear(selectedYear)
    }
  }, [open, selectedYear])

  const selectMonth = (monthIndex: number) => {
    onChange(`${viewYear}-${String(monthIndex + 1).padStart(2, "0")}`)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id="fund-target-month"
          type="button"
          variant="outline"
          className="h-11 w-full justify-start rounded-xl border-border/60 px-3 font-normal hover:border-foreground/20"
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <span className={cn("truncate", !value && "text-muted-foreground")}>{selectedLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(calc(100svw-2rem),24rem)] rounded-2xl p-4" align="start" avoidCollisions>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 rounded-full"
              onClick={() => setViewYear((year) => year - 1)}
              aria-label="Previous year"
            >
              <ChevronLeft className="size-5" />
            </Button>
            <p className="text-lg font-semibold text-foreground">{viewYear}</p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 rounded-full"
              onClick={() => setViewYear((year) => year + 1)}
              aria-label="Next year"
            >
              <ChevronRight className="size-5" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {monthPickerMonths.map((month, monthIndex) => {
              const monthKey = `${viewYear}-${String(monthIndex + 1).padStart(2, "0")}`
              const isSelected = value === monthKey
              const isCurrent = currentMonth === monthKey

              return (
                <Button
                  key={month}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  className={cn(
                    "h-11 rounded-xl px-2 font-medium",
                    !isSelected && "border-border/60 bg-background hover:bg-muted/30",
                    isCurrent && !isSelected && "border-primary/40 text-foreground"
                  )}
                  aria-pressed={isSelected}
                  onClick={() => selectMonth(monthIndex)}
                >
                  {month}
                </Button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
            <p className="text-sm text-muted-foreground">
              {value ? `Target ${formatMonthLabel(value) ?? value}` : "Optional goal timing"}
            </p>
            <div className="flex shrink-0 flex-wrap items-center gap-1">
              <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => onChange(currentMonth)}>
                This month
              </Button>
              <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => onChange("")}>
                Clear
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function FundEntryDialog({
  open,
  mode,
  intent,
  fund,
  entry,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  mode: EntryActionMode
  intent: EntryIntent
  fund: FundDetail
  entry: FundEntry | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [values, setValues] = useState<EntryFormState>(getEntryFormState())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [cards, setCards] = useState<BudgetCard[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])

  useEffect(() => {
    if (!open) {
      return
    }

    setValues(getEntryFormState(entry, intent))
    setError(null)
  }, [open, entry, intent])

  useEffect(() => {
    if (!open || mode !== "create" || intent === "use") {
      return
    }

    let isActive = true

    void Promise.all([
      apiClient.getTags(),
      apiClient.getCards(),
      apiClient.getTransactions({
        categories: "savings",
        page: 1,
        page_size: 50,
        sort: "date_desc",
        date_from: startOfCurrentMonth(),
        date_to: endOfCurrentMonth(),
      }),
    ]).then(([tagsResponse, cardsResponse, transactionsResponse]) => {
      if (!isActive) {
        return
      }
      setTags(tagsResponse.items)
      setCards(cardsResponse.items)
      setTransactions(transactionsResponse.items)
      setValues((current) => ({
        ...current,
        transaction_tag_id: current.transaction_tag_id || tagsResponse.items[0]?.id || "",
      }))
    }).catch(() => {
      if (!isActive) {
        return
      }
      setTags([])
      setCards([])
      setTransactions([])
    })

    return () => {
      isActive = false
    }
  }, [open, mode, intent])

  const isLinkMode = values.budget_tracking === "link_existing_transaction"
  const isCreateTransactionMode = values.budget_tracking === "create_transaction"
  const selectedEntryDate = parseIsoDate(values.entry_date)

  const submit = async () => {
    if (!values.amount) {
      setError("Amount is required.")
      return
    }

    if (mode === "create" && intent === "add" && isLinkMode && !values.transaction_id) {
      setError("Choose a savings transaction to link.")
      return
    }

    if (mode === "create" && intent === "add" && isCreateTransactionMode) {
      if (!values.transaction_expense.trim()) {
        setError("Expense name is required for the savings transaction.")
        return
      }
      if (!values.transaction_tag_id) {
        setError("Choose a tag for the savings transaction.")
        return
      }
    }

    setIsSubmitting(true)
    setError(null)

    try {
      if (mode === "create") {
        await apiClient.createFundEntry(fund.id, buildEntryPayload(values, intent))
      } else if (entry) {
        const payload: UpdateFundEntryRequest = {
          entry_date: values.entry_date,
          entry_type: values.entry_type,
          direction: intent === "use" ? "out" : "in",
          amount: values.amount,
          note: values.note.trim() || null,
        }
        await apiClient.updateFundEntry(fund.id, entry.id, payload)
      }
      onSaved()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to save fund entry")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? (intent === "add" ? "Add money" : "Use money") : "Edit fund entry"}
      description={fund.name}
      footer={
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="text-sm text-muted-foreground">{error ?? "Every fund move goes through the ledger."}</div>
          <Button className="h-12 rounded-xl px-6" onClick={() => void submit()} disabled={isSubmitting || fund.status !== "active"}>
            {isSubmitting ? "Saving..." : mode === "create" ? "Save entry" : "Save changes"}
          </Button>
        </div>
      }
      bodyClassName="space-y-5"
    >
      <div className="grid min-w-0 gap-4">
        <AmountInput
          id="fund-entry-amount"
          name="fund-entry-amount"
          value={values.amount}
          onValueChange={(amount) => setValues((current) => ({ ...current, amount }))}
          label={intent === "add" ? "Amount to add" : "Amount to use"}
        />

        <div className="grid gap-2">
          <Label>Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="fund-entry-date"
                type="button"
                variant="outline"
                className="h-11 w-full justify-start rounded-xl border-border/60 px-3 font-normal hover:border-foreground/20"
              >
                <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">
                  {selectedEntryDate
                    ? formatDateValue(values.entry_date, { month: "short", day: "numeric", year: "numeric" })
                    : "Select date"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <AppCalendar
                mode="single"
                selected={selectedEntryDate ?? undefined}
                onSelect={(date) => {
                  if (date) {
                    setValues((current) => ({ ...current, entry_date: toIsoDate(date) }))
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {mode === "create" && intent === "add" ? (
          <div className="grid gap-3">
            <Label>Budget tracking</Label>
            <div className="grid gap-3">
              {budgetTrackingOptions.map((option) => {
                const isSelected = values.budget_tracking === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      "min-w-0 overflow-hidden rounded-2xl border px-4 py-4 text-left transition-colors",
                      isSelected
                        ? "border-foreground/20 bg-muted/40"
                        : "border-border/60 bg-background hover:bg-muted/20"
                    )}
                    onClick={() => setValues((current) => ({ ...current, budget_tracking: option.value }))}
                  >
                    <p className="text-balance font-medium leading-tight text-foreground">{option.label}</p>
                    <p className="mt-1 text-pretty text-sm leading-snug text-muted-foreground">{option.helper}</p>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {mode === "create" && intent === "add" && isCreateTransactionMode ? (
          <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
            <div className="grid gap-2">
              <Label htmlFor="fund-transaction-expense">Savings transaction label</Label>
              <Input
                id="fund-transaction-expense"
                value={values.transaction_expense}
                onChange={(event) => setValues((current) => ({ ...current, transaction_expense: event.target.value }))}
                placeholder="Emergency fund transfer"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fund-transaction-tag">Tag</Label>
              <Select
                value={values.transaction_tag_id}
                onValueChange={(value) => setValues((current) => ({ ...current, transaction_tag_id: value }))}
              >
                <SelectTrigger id="fund-transaction-tag" className="h-11 w-full rounded-xl border-border/60">
                  <SelectValue placeholder="Choose a tag" />
                </SelectTrigger>
                <SelectContent>
                  {tags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      {tag.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fund-transaction-card">Card</Label>
              <Select
                value={values.transaction_card_id || NO_CARD_SELECT_VALUE}
                onValueChange={(value) =>
                  setValues((current) => ({
                    ...current,
                    transaction_card_id: value === NO_CARD_SELECT_VALUE ? "" : value,
                  }))
                }
              >
                <SelectTrigger id="fund-transaction-card" className="h-11 w-full rounded-xl border-border/60">
                  <SelectValue placeholder="No card" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CARD_SELECT_VALUE}>No card</SelectItem>
                  {cards.map((card) => (
                    <SelectItem key={card.id} value={card.id}>
                      {card.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fund-transaction-notes">Transaction note</Label>
              <Textarea
                id="fund-transaction-notes"
                rows={2}
                value={values.transaction_notes}
                onChange={(event) => setValues((current) => ({ ...current, transaction_notes: event.target.value }))}
                placeholder="Optional transaction note"
              />
            </div>
          </div>
        ) : null}

        {mode === "create" && intent === "add" && isLinkMode ? (
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="fund-transaction-link">Savings transaction</Label>
            <Select
              value={values.transaction_id}
              onValueChange={(transactionId) => {
                const selectedTransaction = transactions.find((transaction) => transaction.id === transactionId)

                setValues((current) => ({
                  ...current,
                  transaction_id: transactionId,
                  amount: selectedTransaction?.amount ?? current.amount,
                }))
              }}
            >
              <SelectTrigger id="fund-transaction-link" className="h-11 w-full rounded-xl border-border/60">
                <SelectValue placeholder="Choose a transaction" />
              </SelectTrigger>
              <SelectContent>
                {transactions.map((transaction) => (
                  <SelectItem key={transaction.id} value={transaction.id}>
                    {`${transaction.expense} • ${formatCurrency(transaction.amount)} • ${transaction.date}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor="fund-entry-note">Fund note</Label>
          <Textarea
            id="fund-entry-note"
            rows={3}
            value={values.note}
            onChange={(event) => setValues((current) => ({ ...current, note: event.target.value }))}
            placeholder={intent === "add" ? "Why you added this money." : "What this money was used for."}
          />
        </div>
      </div>
    </ResponsiveDialog>
  )
}

async function handleArchiveRestore(
  fund: FundListItem | FundDetail,
  action: "archive" | "restore",
  onDone: () => void | Promise<void>,
  setError: (value: string | null) => void
) {
  try {
    setError(null)
    if (action === "archive") {
      await apiClient.archiveFund(fund.id)
    } else {
      await apiClient.restoreFund(fund.id)
    }
    await onDone()
  } catch (err) {
    if (err instanceof ApiError) {
      setError(err.error.message)
    } else {
      setError(`Unable to ${action} fund`)
    }
  }
}

async function handleDeleteEntry(
  fundId: string,
  entry: FundEntry | null,
  onDone: () => void | Promise<void>,
  clearTarget: (entry: FundEntry | null) => void,
  setError: (value: string | null) => void
) {
  if (!entry) {
    return
  }

  try {
    setError(null)
    await apiClient.deleteFundEntry(fundId, entry.id)
    clearTarget(null)
    await onDone()
  } catch (err) {
    if (err instanceof ApiError) {
      setError(err.error.message)
    } else {
      setError("Unable to delete entry")
    }
  }
}
