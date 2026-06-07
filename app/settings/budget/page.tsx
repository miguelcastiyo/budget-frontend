"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Pencil, X } from "lucide-react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { BudgetAllocationForm } from "@/components/budget/budget-allocation-form"
import { IncomeBreakdownForm } from "@/components/budget/income-breakdown-form"
import { MonthSelector } from "@/components/budget/month-selector"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { ApiError, apiClient } from "@/lib/api/client"
import type { BudgetSettings, BudgetSettingsResolvedResponse } from "@/lib/api/types"
import { formatMonthLabel, getCurrentMonthKey } from "@/lib/date-filters"
import { formatCurrency } from "@/lib/formatters"
import { mobileDrawerDialogClassName, mobileDrawerHandleClassName } from "@/lib/mobile-drawer"
import { cn } from "@/lib/utils"
import { useSwipeDismiss } from "@/hooks/use-swipe-dismiss"
import {
  totalAmount,
  totalPercent,
  budgetSettingsPayload,
  defaultBudgetAllocationFormState,
  hydrateBudgetAllocationForm,
  isBudgetAllocationValid,
  type BudgetAllocationFormState,
} from "@/lib/budget-allocation"
import {
  asNumber,
  calculateHourlyMonthlyIncome,
  calculateMonthlyIncome,
  defaultIncomeFormState,
  hydrateIncomeForm,
  isIncomeFormValid,
  type IncomeFormState,
} from "@/lib/income-breakdown"

export default function BudgetSettingsPage() {
  const [incomeForm, setIncomeForm] = useState<IncomeFormState>(defaultIncomeFormState)
  const [allocationForm, setAllocationForm] = useState<BudgetAllocationFormState>(defaultBudgetAllocationFormState)
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey())
  const [budgetResolution, setBudgetResolution] = useState<BudgetSettingsResolvedResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loadedPayloadKey, setLoadedPayloadKey] = useState<string | null>(null)
  const [showBudgetEditor, setShowBudgetEditor] = useState(false)
  const editorScrollRef = useRef<HTMLDivElement>(null)
  const editorSwipeDismiss = useSwipeDismiss({
    open: showBudgetEditor,
    onDismiss: () => setShowBudgetEditor(false),
    scrollRef: editorScrollRef,
  })

  useEffect(() => {
    const loadBudgetSettings = async () => {
      setIsLoading(true)
      setError(null)
      setSuccess(null)
      setBudgetResolution(null)
      try {
        const data = await apiClient.getBudgetSettings(selectedMonth)
        setBudgetResolution(data)
        hydrateForm(data.settings)
      } catch (err) {
        setError(err instanceof ApiError ? err.error.message : "Unable to load budget settings")
      } finally {
        setIsLoading(false)
      }
    }

    void loadBudgetSettings()
  }, [selectedMonth])

  const hydrateForm = (settings: BudgetSettings) => {
    const hydratedIncome = hydrateIncomeForm(settings)
    const hydratedAllocation = hydrateBudgetAllocationForm(settings)
    setIncomeForm(hydratedIncome)
    setAllocationForm(hydratedAllocation)
    setLoadedPayloadKey(JSON.stringify(budgetSettingsPayload(hydratedIncome, hydratedAllocation)))
  }

  const income = calculateMonthlyIncome(incomeForm)
  const hasValidIncome = isIncomeFormValid(incomeForm)
  const hasValidAllocation = isBudgetAllocationValid(allocationForm, income)
  const currentPayloadKey = useMemo(
    () => JSON.stringify(budgetSettingsPayload(incomeForm, allocationForm)),
    [incomeForm, allocationForm]
  )
  const hasBudgetChanges = loadedPayloadKey !== null && currentPayloadKey !== loadedPayloadKey
  const canCreateInheritedVersion = budgetResolution !== null && !budgetResolution.is_exact_match
  const selectedMonthLabel = formatMonthLabel(selectedMonth) ?? selectedMonth
  const resolvedMonthLabel = budgetResolution?.resolved_effective_month
    ? formatMonthLabel(budgetResolution.resolved_effective_month) ?? budgetResolution.resolved_effective_month
    : null
  const canSaveBudget = !isLoading && !isSaving && hasValidIncome && hasValidAllocation && (hasBudgetChanges || canCreateInheritedVersion)
  const saveLabel = isSaving
    ? "Saving..."
    : !hasValidIncome || !hasValidAllocation
      ? "Fix issues before saving"
      : canCreateInheritedVersion
        ? `Save Budget Starting ${selectedMonthLabel}`
        : hasBudgetChanges
          ? `Update ${selectedMonthLabel} Budget`
        : "Saved"
  const headerSubtitle = isLoading
    ? "Loading settings"
    : `${formatCurrency(income)}/month · ${selectedMonthLabel}`
  const budgetStatusCopy = isLoading && budgetResolution === null
    ? {
        current: `Loading budget for ${selectedMonthLabel}.`,
        consequence: "Targets will update after this month loads.",
      }
    : budgetResolution?.resolved_effective_month
      ? budgetResolution.is_exact_match
        ? {
            current: `Editing your ${selectedMonthLabel} budget.`,
            consequence: `Changes apply from ${selectedMonthLabel} forward until another budget starts.`,
          }
        : {
            current: `Using your ${resolvedMonthLabel} budget.`,
            consequence: `Saving changes will create a new budget starting ${selectedMonthLabel}.`,
          }
      : {
          current: `No saved budget applies to ${selectedMonthLabel} yet.`,
          consequence: `Saving will create a new budget starting ${selectedMonthLabel}.`,
        }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await apiClient.updateBudgetSettings({
        effective_month: selectedMonth,
        ...budgetSettingsPayload(incomeForm, allocationForm),
      })

      hydrateForm(response)
      setBudgetResolution({
        requested_month: selectedMonth,
        resolved_effective_month: selectedMonth,
        is_exact_match: true,
        settings: response,
      })
      setSuccess("Budget saved")
      setShowBudgetEditor(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.error.message : "Unable to save budget")
    } finally {
      setIsSaving(false)
    }
  }

  const saveBudgetButton = (
    <Button
      className={cn(
        "h-12 w-full rounded-xl disabled:opacity-100",
        canSaveBudget
          ? "shadow-sm"
          : "bg-muted text-muted-foreground hover:bg-muted"
      )}
      onClick={() => void handleSave()}
      disabled={!canSaveBudget}
    >
      {saveLabel}
    </Button>
  )

  const budgetEditor = (idPrefix: string, showInlineSave = true) => (
    <div className="space-y-4 sm:space-y-5">
      <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
        <div className="mb-4 sm:mb-5">
          <h2 className="font-semibold">Budget for {selectedMonthLabel}</h2>
          <BudgetStatusCopy copy={budgetStatusCopy} className="mt-1" />
        </div>
        <IncomeBreakdownForm
          value={incomeForm}
          onChange={setIncomeForm}
          disabled={isLoading || isSaving}
          idPrefix={`${idPrefix}-income`}
        />
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
        <div className="mb-4 sm:mb-5">
          <h2 className="font-semibold">Allocation</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Split your monthly budget into category targets.
          </p>
        </div>
        <BudgetAllocationForm
          value={allocationForm}
          income={income}
          onChange={setAllocationForm}
          disabled={isLoading || isSaving}
        />

        {showInlineSave && <div className="mt-4">{saveBudgetButton}</div>}
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="font-semibold">Preview</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Estimated budget and category targets before saving.
          </p>
        </div>
        <BudgetAllocationSummary allocationForm={allocationForm} income={income} />
      </section>

      <p className="px-4 text-center text-sm text-muted-foreground">
        The 50/30/20 rule suggests allocating 50% to needs, 30% to wants, and 20% to savings and debt repayment.
      </p>
    </div>
  )

  return (
    <div className="min-h-screen bg-background pb-mobile-nav">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl pt-safe-header">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4 lg:max-w-6xl lg:px-8">
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Back to settings">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">Budget</h1>
            <p className="truncate text-sm text-muted-foreground">
              {headerSubtitle}
            </p>
          </div>
        </div>
      </header>

      {/* Extra mobile bottom padding keeps the final card scrollable above the fixed nav and iOS home indicator. */}
      <main className="mx-auto max-w-lg space-y-3 px-4 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pt-3 sm:space-y-4 sm:px-5 sm:pt-5 lg:max-w-6xl lg:px-8 lg:pb-0 lg:pt-8">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-success">{success}</p>}

        <section className="rounded-2xl border border-border/60 bg-card px-3 py-3 shadow-sm sm:p-5">
          <MonthSelector currentMonth={selectedMonth} onChange={setSelectedMonth} allowFuture />
          <BudgetStatusCopy copy={budgetStatusCopy} className="mx-auto mt-2 max-w-sm text-center sm:mt-3" />
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
          <div className="space-y-3 sm:space-y-4">
            <BudgetSummaryCard
              income={income}
              isLoading={isLoading}
              onEdit={() => setShowBudgetEditor(true)}
            />
            <BudgetAllocationCard allocationForm={allocationForm} income={income} />
          </div>

          <aside className="space-y-4">
            <BudgetUsageCard />
            <BudgetDetailsCard incomeForm={incomeForm} allocationForm={allocationForm} income={income} />
          </aside>
        </div>
      </main>

      <Dialog open={showBudgetEditor} onOpenChange={setShowBudgetEditor}>
        <DialogContent
          {...editorSwipeDismiss}
          showCloseButton={false}
          className={cn(
            "flex h-[min(calc(100dvh-env(safe-area-inset-top)-0.75rem),44rem)] w-full grid-rows-none gap-0 overflow-hidden p-0 sm:bottom-auto sm:h-auto sm:max-h-[min(90dvh,44rem)] sm:w-[min(calc(100dvw-2rem),42rem)] sm:max-w-[42rem] sm:rounded-2xl sm:border",
            mobileDrawerDialogClassName
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-border/50 bg-background/95 px-4 pb-3 pt-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6 sm:py-4">
              <div data-swipe-handle="true" className={cn(mobileDrawerHandleClassName, "mb-3 sm:hidden")} aria-hidden="true" />
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <DialogTitle className="truncate text-lg font-semibold sm:text-xl">Edit Budget</DialogTitle>
                  <DialogDescription className="mt-0.5 truncate text-xs text-muted-foreground">
                    Update your monthly budget basis and category targets.
                  </DialogDescription>
                </div>
                <DialogClose className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </DialogClose>
              </div>
            </div>

            <div ref={editorScrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-4 sm:px-6 sm:pb-24 sm:pt-5">
              {budgetEditor("settings-edit", false)}
            </div>

            {/* Safe-area padding keeps the tray footer clear of the iOS home indicator while the scroll body has matching bottom breathing room. */}
            <div className="shrink-0 border-t border-border/50 bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:p-6 sm:pt-4">
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="h-12 flex-1 rounded-xl"
                  onClick={() => setShowBudgetEditor(false)}
                >
                  Cancel
                </Button>
                <div className="flex-1">{saveBudgetButton}</div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  )
}

function BudgetStatusCopy({
  copy,
  className,
}: {
  copy: { current: string; consequence: string }
  className?: string
}) {
  return (
    <div className={cn("space-y-0.5 text-sm leading-5 text-muted-foreground", className)}>
      <p className="font-medium text-foreground/85">{copy.current}</p>
      <p>{copy.consequence}</p>
    </div>
  )
}

function BudgetSummaryCard({
  income,
  isLoading,
  onEdit,
}: {
  income: number
  isLoading: boolean
  onEdit: () => void
}) {
  return (
    <Card className="border-0 p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">Monthly budget basis</p>
          <p className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {isLoading ? "--" : formatCurrency(income)}
            {!isLoading && <span className="text-base font-medium text-muted-foreground"> / month</span>}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Used by dashboard targets and insights.</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 -mt-2 rounded-full text-muted-foreground hover:text-foreground"
          onClick={onEdit}
          disabled={isLoading}
          aria-label="Edit budget"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  )
}

function BudgetAllocationCard({
  allocationForm,
  income,
}: {
  allocationForm: BudgetAllocationFormState
  income: number
}) {
  return (
    <Card className="border-0 p-4 shadow-sm sm:p-5">
      <div className="mb-3 sm:mb-4">
        <h2 className="font-semibold">Budget allocation</h2>
        <p className="mt-1 text-sm text-muted-foreground">Category targets for the selected budget basis.</p>
      </div>
      <BudgetAllocationSummary allocationForm={allocationForm} income={income} />
    </Card>
  )
}

function BudgetUsageCard() {
  return (
    <Card className="border-0 p-5 shadow-sm">
      <h2 className="text-sm font-semibold">How this budget is used</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Your monthly budget powers dashboard targets, spending progress, and insights. Changes apply from the selected month forward until another budget starts.
      </p>
    </Card>
  )
}

function BudgetDetailsCard({
  incomeForm,
  allocationForm,
  income,
}: {
  incomeForm: IncomeFormState
  allocationForm: BudgetAllocationFormState
  income: number
}) {
  const primaryIncome = incomeForm.incomeSourceType === "monthly"
    ? asNumber(incomeForm.primaryMonthlyIncome)
    : calculateHourlyMonthlyIncome(incomeForm.primaryHourlyRate, incomeForm.primaryWeeklyHours)
  const extraIncome = income - primaryIncome
  const allocationDetail = allocationForm.allocationMode === "percent"
    ? `${asNumber(allocationForm.needsPercent).toFixed(0)} / ${asNumber(allocationForm.wantsPercent).toFixed(0)} / ${asNumber(allocationForm.savingsPercent).toFixed(0)}`
    : "By amount"

  return (
    <Card className="border-0 p-5 shadow-sm">
      <h2 className="text-sm font-semibold">Budget details</h2>
      <div className="mt-4 space-y-3 text-sm">
        <DetailRow label="Budget basis" value={incomeForm.incomeSourceType === "monthly" ? "Monthly" : "Hourly"} />
        <DetailRow label="Main income" value={formatCurrency(primaryIncome)} />
        <DetailRow label="Extra income" value={incomeForm.sideIncomeType === "none" ? "None" : formatCurrency(extraIncome)} />
        <DetailRow label="Allocation" value={allocationDetail} />
      </div>
    </Card>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function BudgetAllocationSummary({
  allocationForm,
  income,
}: {
  allocationForm: BudgetAllocationFormState
  income: number
}) {
  const isPercentMode = allocationForm.allocationMode === "percent"
  const needsPercent = isPercentMode
    ? asNumber(allocationForm.needsPercent)
    : income > 0
      ? (asNumber(allocationForm.needsAmount) / income) * 100
      : 0
  const wantsPercent = isPercentMode
    ? asNumber(allocationForm.wantsPercent)
    : income > 0
      ? (asNumber(allocationForm.wantsAmount) / income) * 100
      : 0
  const savingsPercent = isPercentMode
    ? asNumber(allocationForm.savingsPercent)
    : income > 0
      ? (asNumber(allocationForm.savingsAmount) / income) * 100
      : 0
  const total = isPercentMode ? totalPercent(allocationForm) : totalAmount(allocationForm)
  const segments = [
    {
      label: "Needs",
      value: needsPercent,
      target: isPercentMode
        ? formatCurrency((needsPercent / 100) * income)
        : formatCurrency(asNumber(allocationForm.needsAmount)),
      className: "bg-needs",
    },
    {
      label: "Wants",
      value: wantsPercent,
      target: isPercentMode
        ? formatCurrency((wantsPercent / 100) * income)
        : formatCurrency(asNumber(allocationForm.wantsAmount)),
      className: "bg-wants",
    },
    {
      label: "Savings",
      value: savingsPercent,
      target: isPercentMode
        ? formatCurrency((savingsPercent / 100) * income)
        : formatCurrency(asNumber(allocationForm.savingsAmount)),
      className: "bg-savings",
    },
  ]
  const barTotal = segments.reduce((sum, segment) => sum + segment.value, 0)

  return (
    <div className="mt-3 rounded-2xl border border-border/70 bg-muted/30 p-3 sm:mt-4">
      <div className="flex h-3 overflow-hidden rounded-full bg-muted">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className={cn(segment.className, "transition-all")}
            style={{ width: `${barTotal > 0 ? (segment.value / barTotal) * 100 : 0}%` }}
          />
        ))}
      </div>
      <div className="mt-3 space-y-1.5 sm:grid sm:grid-cols-3 sm:gap-2 sm:space-y-0 sm:text-center">
        {segments.map((segment) => (
          <div key={segment.label} className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-background/60 px-3 py-2 sm:block sm:p-2">
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground sm:text-[11px]">{segment.label}</p>
              <p className="text-[11px] text-muted-foreground sm:hidden">target</p>
            </div>
            <div className="shrink-0 text-right sm:text-center">
              <p className="text-sm font-semibold">{segment.target}</p>
              <p className="hidden text-[11px] text-muted-foreground sm:block">target</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        {isPercentMode ? `Total: ${total.toFixed(0)}%` : `Total: ${formatCurrency(total)}`}
      </p>
    </div>
  )
}
