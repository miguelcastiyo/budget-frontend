"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarIcon,
  Coins,
  FolderOpen,
  HandCoins,
  Pencil,
  PiggyBank,
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
  FundType,
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
  toIsoDate,
} from "@/lib/date-filters"
import { formatCurrency } from "@/lib/formatters"
import { cn } from "@/lib/utils"

type FundsFilter = "active" | "archived" | "all"
type FundActionMode = "create" | "edit"
type EntryActionMode = "create" | "edit"
type EntryIntent = "add" | "use"

const fundFilterOptions: Array<{ value: FundsFilter; label: string }> = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
]

const fundTypeOptions: Array<{ value: FundType; label: string }> = [
  { value: "goal", label: "Goal" },
  { value: "emergency", label: "Emergency" },
  { value: "buffer", label: "Buffer" },
  { value: "debt", label: "Debt" },
  { value: "investment", label: "Investment" },
  { value: "other", label: "Other" },
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

function parseAmount(value: string | null | undefined): number {
  const amount = Number.parseFloat(value ?? "")
  return Number.isFinite(amount) ? amount : 0
}

function numberLabel(value: number, singular: string, plural = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : plural}`
}

function fundTypeLabel(type: FundType): string {
  return fundTypeOptions.find((option) => option.value === type)?.label ?? "Fund"
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

function canEditEntry(entry: FundEntry): boolean {
  return entry.source_type === "manual" || entry.source_type === "starting_balance" || entry.source_type === "correction"
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
  fund_type: FundType
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
    fund_type: "goal",
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
    fund_type: fund.fund_type,
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
      <main className="max-w-lg lg:max-w-6xl mx-auto px-5 lg:px-8 pt-standalone-safe-top">
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
  const [summary, setSummary] = useState<FundCloseoutSummaryResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogMode, setDialogMode] = useState<FundActionMode>("create")
  const [selectedFund, setSelectedFund] = useState<FundListItem | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [fundsResponse, summaryResponse] = await Promise.all([
        apiClient.getFunds({ status: filter, include_entries_summary: true }),
        apiClient.getFundCloseoutSummary(new Date().getFullYear()),
      ])
      setFunds(fundsResponse.items)
      setSummary(summaryResponse)
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

  const activeFunds = funds.filter((fund) => fund.status === "active")
  const totalBalance = activeFunds.reduce((sum, fund) => sum + parseAmount(fund.current_balance), 0)
  const totalGoals = activeFunds.filter((fund) => fund.goal_amount !== null).length

  return renderFundShell(
    <div className="space-y-6 lg:space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Funds</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Goals, buffers, and saved progress</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="overflow-hidden border-0 bg-[linear-gradient(135deg,rgba(246,239,224,0.9),rgba(255,255,255,0.98))]">
          <CardContent className="grid gap-5 pt-6 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Saved across active funds</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{formatCurrency(totalBalance)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Active funds</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{activeFunds.length}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">With goals</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{totalGoals}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0">
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-center gap-2">
              <HandCoins className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">This year from closeouts</p>
            </div>
            <p className="text-3xl font-semibold tracking-tight text-foreground">
              {formatCurrency(summary?.total_closeout_contributed ?? 0)}
            </p>
            <p className="text-sm text-muted-foreground">
              {summary?.funds.length
                ? `Across ${numberLabel(summary.funds.length, "fund")}`
                : "No fund contributions from month closeouts yet."}
            </p>
          </CardContent>
        </Card>
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
        <Button className="sm:hidden rounded-full" onClick={() => {
          setDialogMode("create")
          setSelectedFund(null)
          setIsDialogOpen(true)
        }}>
          <Plus className="size-4" />
          New fund
        </Button>
      </div>

      {isLoading ? (
        <Card className="border-0">
          <CardContent className="flex items-center justify-center gap-3 pt-6">
            <Spinner className="size-5" />
            <span className="text-sm text-muted-foreground">Loading funds...</span>
          </CardContent>
        </Card>
      ) : funds.length === 0 ? (
        <Card className="border-0">
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-center gap-3">
              <FolderOpen className="size-5 text-muted-foreground" />
              <p className="font-medium text-foreground">No funds here yet</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Create a fund for a goal, emergency cushion, debt payoff, or anything you want to reserve money for.
            </p>
            <Button className="w-full sm:w-auto" onClick={() => {
              setDialogMode("create")
              setSelectedFund(null)
              setIsDialogOpen(true)
            }}>
              <Plus className="size-4" />
              Create your first fund
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {funds.map((fund) => (
            <Card key={fund.id} className="overflow-hidden border-0">
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold tracking-tight text-foreground">{fund.name}</h2>
                      <Badge variant="outline">{fundTypeLabel(fund.fund_type)}</Badge>
                      {fund.status === "archived" ? <Badge variant="outline">Archived</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {fund.target_month ? `Target ${formatMonthLabel(fund.target_month) ?? fund.target_month}` : "No target month"}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => {
                    setDialogMode("edit")
                    setSelectedFund(fund)
                    setIsDialogOpen(true)
                  }}>
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Saved</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{formatCurrency(fund.current_balance)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Goal</p>
                    <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                      {fund.goal_amount ? formatCurrency(fund.goal_amount) : "Open-ended"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Entries</p>
                    <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">{fund.entries_count}</p>
                  </div>
                </div>

                {fund.goal_amount ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">Funded</span>
                      <span className="font-medium text-foreground">
                        {Math.round(parseAmount(fund.percent_funded ?? "0"))}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted/70">
                      <div className="h-full rounded-full bg-foreground/80" style={{ width: fundProgressWidth(fund.percent_funded) }} />
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button asChild className="rounded-xl">
                    <Link href={`/insights/funds/${fund.id}`}>Open fund</Link>
                  </Button>
                  {fund.status === "active" ? (
                    <Button variant="outline" className="rounded-xl" onClick={() => void handleArchiveRestore(fund, "archive", loadData, setError)}>
                      Archive
                    </Button>
                  ) : (
                    <Button variant="outline" className="rounded-xl" onClick={() => void handleArchiveRestore(fund, "restore", loadData, setError)}>
                      <RotateCcw className="size-4" />
                      Restore
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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

          <Card className="overflow-hidden border-0 bg-[linear-gradient(135deg,rgba(245,238,228,0.92),rgba(255,255,255,0.99))]">
            <CardContent className="space-y-5 pt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground">{fund.name}</h1>
                    <Badge variant="outline">{fundTypeLabel(fund.fund_type)}</Badge>
                    {fund.status === "archived" ? <Badge variant="outline">Archived</Badge> : null}
                  </div>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    {fund.notes?.trim() || "Dedicated money tracked through one shared ledger."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setFundDialogOpen(true)}>
                    <Pencil className="size-4" />
                    Edit fund
                  </Button>
                  {fund.status === "active" ? (
                    <Button variant="outline" onClick={() => void handleArchiveRestore(fund, "archive", loadData, setError)}>
                      Archive
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => void handleArchiveRestore(fund, "restore", loadData, setError)}>
                      <RotateCcw className="size-4" />
                      Restore
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <DetailStat label="Saved" value={formatCurrency(fund.current_balance)} />
                <DetailStat label="Goal" value={fund.goal_amount ? formatCurrency(fund.goal_amount) : "Open-ended"} />
                <DetailStat
                  label={fund.goal_amount ? "Remaining" : "Progress"}
                  value={fund.goal_amount ? formatCurrency(fund.remaining_amount ?? 0) : `${Math.round(parseAmount(fund.percent_funded ?? "0"))}% funded`}
                />
              </div>

              {fund.goal_amount ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">Goal progress</span>
                    <span className="font-medium text-foreground">{Math.round(parseAmount(fund.percent_funded ?? "0"))}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted/70">
                    <div className="h-full rounded-full bg-foreground/80" style={{ width: fundProgressWidth(fund.percent_funded) }} />
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
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
                  variant="outline"
                  disabled={fund.status !== "active"}
                  onClick={() => {
                    setEntryDialogMode("create")
                    setEntryIntent("use")
                    setSelectedEntry(null)
                    setEntryDialogOpen(true)
                  }}
                >
                  <ArrowUpRight className="size-4" />
                  Use money
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <Card className="border-0">
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-center gap-2">
                  <PiggyBank className="size-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Where the balance came from</p>
                </div>
                <SourceBreakdownRow label="Month closeouts" amount={fund.source_breakdown.month_closeout} />
                <SourceBreakdownRow label="Savings transactions" amount={fund.source_breakdown.transaction} />
                <SourceBreakdownRow label="Manual fund moves" amount={fund.source_breakdown.manual} />
                <SourceBreakdownRow label="Starting balance" amount={fund.source_breakdown.starting_balance} />
                <SourceBreakdownRow label="Corrections" amount={fund.source_breakdown.correction} />
              </CardContent>
            </Card>

            <Card className="border-0">
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-center gap-2">
                  <Coins className="size-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Closeout summary</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Contributions from month closeouts are included in this balance and appear here as normal ledger entries.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{numberLabel(fund.entries_count, "entry")}</Badge>
                  {fund.target_month ? <Badge variant="outline">Target {formatMonthLabel(fund.target_month) ?? fund.target_month}</Badge> : null}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0">
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Ledger</p>
                  <p className="mt-1 text-sm text-muted-foreground">Every contribution, withdrawal, and closeout-linked move.</p>
                </div>
              </div>

              {entries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center">
                  <p className="font-medium text-foreground">No entries yet</p>
                  <p className="mt-2 text-sm text-muted-foreground">Add money to start tracking progress.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {entries.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-foreground">{entryTypeLabel(entry)}</p>
                            <Badge variant="outline">{entry.direction === "in" ? "In" : "Out"}</Badge>
                            {entry.source_month ? <Badge variant="outline">{formatMonthLabel(entry.source_month) ?? entry.source_month}</Badge> : null}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatDateTimeValue(entry.entry_date, { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                          {entry.note ? <p className="mt-2 text-sm text-muted-foreground">{entry.note}</p> : null}
                        </div>
                        <div className="flex flex-col items-start gap-2 sm:items-end">
                          <p className={cn("text-lg font-semibold tracking-tight", entry.direction === "in" ? "text-emerald-700" : "text-foreground")}>
                            {entry.direction === "in" ? "+" : "-"}
                            {formatCurrency(entry.amount)}
                          </p>
                          {canEditEntry(entry) ? (
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedEntry(entry)
                                  setEntryDialogMode("edit")
                                  setEntryIntent(entry.direction === "out" ? "use" : "add")
                                  setEntryDialogOpen(true)
                                }}
                              >
                                <Pencil className="size-4" />
                                Edit
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(entry)}>
                                <Trash2 className="size-4" />
                                Delete
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

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

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
    </div>
  )
}

function SourceBreakdownRow({ label, amount }: { label: string; amount: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{formatCurrency(amount)}</span>
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

    const payload: CreateFundRequest | UpdateFundRequest = {
      name: values.name.trim(),
      fund_type: values.fund_type,
      goal_amount: values.goal_amount || null,
      target_month: values.target_month || null,
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
          <div className="text-sm text-muted-foreground">{error ?? "Funds are long-lived goals or envelopes."}</div>
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

        <div className="grid gap-2">
          <Label htmlFor="fund-type">Type</Label>
          <Select
            value={values.fund_type}
            onValueChange={(value) => setValues((current) => ({ ...current, fund_type: value as FundType }))}
          >
            <SelectTrigger id="fund-type" className="h-11 w-full rounded-xl border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fundTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <AmountInput
          id="fund-goal"
          name="fund-goal"
          value={values.goal_amount}
          onValueChange={(goal_amount) => setValues((current) => ({ ...current, goal_amount }))}
          label="Goal amount"
        />

        {mode === "create" ? (
          <AmountInput
            id="fund-starting-balance"
            name="fund-starting-balance"
            value={values.starting_balance}
            onValueChange={(starting_balance) => setValues((current) => ({ ...current, starting_balance }))}
            label="Starting balance"
          />
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor="fund-target-month">Target month</Label>
          <Input
            id="fund-target-month"
            value={values.target_month}
            onChange={(event) => setValues((current) => ({ ...current, target_month: event.target.value }))}
            placeholder="YYYY-MM"
          />
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
