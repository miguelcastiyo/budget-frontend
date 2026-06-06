"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, X } from "lucide-react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { BudgetAllocationForm } from "@/components/budget/budget-allocation-form"
import { IncomeBreakdownForm } from "@/components/budget/income-breakdown-form"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { ApiError, apiClient } from "@/lib/api/client"
import type { BudgetSettings } from "@/lib/api/types"
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
  calculateMonthlyIncome,
  defaultIncomeFormState,
  hydrateIncomeForm,
  isIncomeFormValid,
  type IncomeFormState,
} from "@/lib/income-breakdown"

export default function BudgetSettingsPage() {
  const [incomeForm, setIncomeForm] = useState<IncomeFormState>(defaultIncomeFormState)
  const [allocationForm, setAllocationForm] = useState<BudgetAllocationFormState>(defaultBudgetAllocationFormState)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loadedPayloadKey, setLoadedPayloadKey] = useState<string | null>(null)
  const [showMobileEditor, setShowMobileEditor] = useState(false)
  const mobileEditorScrollRef = useRef<HTMLDivElement>(null)
  const mobileEditorSwipeDismiss = useSwipeDismiss({
    open: showMobileEditor,
    onDismiss: () => setShowMobileEditor(false),
    scrollRef: mobileEditorScrollRef,
  })

  useEffect(() => {
    const loadBudgetSettings = async () => {
      try {
        const data = await apiClient.getBudgetSettings()
        hydrateForm(data)
      } catch (err) {
        setError(err instanceof ApiError ? err.error.message : "Unable to load budget settings")
      } finally {
        setIsLoading(false)
      }
    }

    void loadBudgetSettings()
  }, [])

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
  const canSaveBudget = !isLoading && !isSaving && hasValidIncome && hasValidAllocation && hasBudgetChanges
  const saveLabel = isSaving
    ? "Saving..."
    : !hasValidIncome || !hasValidAllocation
      ? "Fix issues before saving"
      : hasBudgetChanges
        ? "Save Budget"
        : "Saved"
  const headerSubtitle = isLoading
    ? "Loading settings"
    : `${formatCurrency(income)}/month · Used by dashboard targets`

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await apiClient.updateBudgetSettings(budgetSettingsPayload(incomeForm, allocationForm))

      hydrateForm(response)
      setSuccess("Budget saved")
      setShowMobileEditor(false)
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
    <div className="space-y-5">
      <Card className="border-0 p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="font-semibold">Income</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Estimate your monthly take-home income.
          </p>
        </div>
        <IncomeBreakdownForm
          value={incomeForm}
          onChange={setIncomeForm}
          disabled={isLoading || isSaving}
          idPrefix={`${idPrefix}-income`}
        />
      </Card>

      <Card className="border-0 p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="font-semibold">Budget Allocation</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Split your monthly income into category targets.
          </p>
        </div>
        <BudgetAllocationForm
          value={allocationForm}
          income={income}
          onChange={setAllocationForm}
          disabled={isLoading || isSaving}
        />

        {showInlineSave && <div className="mt-4">{saveBudgetButton}</div>}
      </Card>

      <p className="px-4 text-center text-sm text-muted-foreground">
        The 50/30/20 rule suggests allocating 50% to needs, 30% to wants, and 20% to savings and debt repayment.
      </p>
    </div>
  )

  return (
    <div className="min-h-screen bg-background pb-mobile-nav">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl pt-safe-header">
        <div className="mx-auto flex max-w-lg items-center gap-4 px-5 py-4">
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-bold">Budget</h1>
            <p className="truncate text-sm text-muted-foreground">
              {headerSubtitle}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-6 px-5 pt-5">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-success">{success}</p>}

        <Card className="border-0 p-5 shadow-sm sm:hidden">
          <p className="text-sm font-medium text-muted-foreground">Monthly budget basis</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">
            {isLoading ? "--" : formatCurrency(income)}
            {!isLoading && <span className="text-base font-medium text-muted-foreground"> / month</span>}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Used by dashboard targets and insights.</p>
          <MobileAllocationSummary allocationForm={allocationForm} income={income} />
          <Button
            className="mt-4 h-12 w-full rounded-xl"
            onClick={() => setShowMobileEditor(true)}
            disabled={isLoading}
          >
            Edit Budget
          </Button>
        </Card>

        <div className="hidden sm:block">
          {budgetEditor("settings")}
        </div>
      </main>

      <Dialog open={showMobileEditor} onOpenChange={setShowMobileEditor}>
        <DialogContent
          {...mobileEditorSwipeDismiss}
          showCloseButton={false}
          className={cn(
            "flex h-[min(calc(100dvh-env(safe-area-inset-top)-0.75rem),44rem)] w-full grid-rows-none gap-0 overflow-hidden p-0 sm:bottom-auto sm:h-auto sm:max-h-[min(90dvh,44rem)] sm:w-[min(calc(100dvw-2rem),36rem)] sm:max-w-[36rem] sm:rounded-2xl sm:border",
            mobileDrawerDialogClassName
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-border/50 bg-background/95 px-4 pb-3 pt-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6 sm:py-4">
              <div data-swipe-handle="true" className={cn(mobileDrawerHandleClassName, "mb-3 sm:hidden")} aria-hidden="true" />
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <DialogTitle className="truncate text-lg font-semibold sm:text-xl">Edit Budget</DialogTitle>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {headerSubtitle}
                  </p>
                </div>
                <DialogClose className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </DialogClose>
              </div>
            </div>

            <div ref={mobileEditorScrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
              {budgetEditor("mobile-settings", false)}
            </div>

            <div className="shrink-0 border-t border-border/50 bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:p-6 sm:pt-4">
              {saveBudgetButton}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  )
}

function MobileAllocationSummary({
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
      label: "Savings & Debts",
      value: savingsPercent,
      target: isPercentMode
        ? formatCurrency((savingsPercent / 100) * income)
        : formatCurrency(asNumber(allocationForm.savingsAmount)),
      className: "bg-savings",
    },
  ]
  const barTotal = segments.reduce((sum, segment) => sum + segment.value, 0)

  return (
    <div className="mt-4 rounded-2xl border border-border/70 bg-muted/30 p-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-muted">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className={cn(segment.className, "transition-all")}
            style={{ width: `${barTotal > 0 ? (segment.value / barTotal) * 100 : 0}%` }}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {segments.map((segment) => (
          <div key={segment.label} className="min-w-0 rounded-xl bg-background/60 p-2">
            <p className="truncate text-[11px] text-muted-foreground">{segment.label}</p>
            <p className="mt-1 text-sm font-semibold">{segment.target}</p>
            <p className="text-[11px] text-muted-foreground">target</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        {isPercentMode ? `Total: ${total.toFixed(0)}%` : `Total: ${formatCurrency(total)}`}
      </p>
    </div>
  )
}
