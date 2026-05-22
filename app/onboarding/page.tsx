"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { BudgetAllocationForm } from "@/components/budget/budget-allocation-form"
import { IncomeBreakdownForm } from "@/components/budget/income-breakdown-form"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatCurrency } from "@/lib/formatters"
import { ApiError, apiClient } from "@/lib/api/client"
import { useAuth } from "@/components/auth/auth-provider"
import {
  budgetSettingsPayload,
  defaultBudgetAllocationFormState,
  hydrateBudgetAllocationForm,
  isBudgetAllocationValid,
  type BudgetAllocationFormState,
} from "@/lib/budget-allocation"
import {
  calculateHourlyMonthlyIncome,
  calculateMonthlyIncome,
  calculateMonthlyIncomeString,
  defaultIncomeFormState,
  hydrateIncomeForm,
  isIncomeFormValid,
  toDecimalString,
  type IncomeFormState,
} from "@/lib/income-breakdown"
import type { BudgetSettings } from "@/lib/api/types"

type OnboardingStep = "profile" | "income" | "allocation" | "review"

const steps: OnboardingStep[] = ["profile", "income", "allocation", "review"]

export default function OnboardingPage() {
  const router = useRouter()
  const { profile, refreshProfile, needsOnboarding } = useAuth()

  const [step, setStep] = useState<OnboardingStep>("profile")
  const [displayName, setDisplayName] = useState("")
  const [incomeForm, setIncomeForm] = useState<IncomeFormState>(defaultIncomeFormState)
  const [allocationForm, setAllocationForm] = useState<BudgetAllocationFormState>(defaultBudgetAllocationFormState)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name)
    }
  }, [profile])

  useEffect(() => {
    let active = true

    const bootstrap = async () => {
      try {
        const settings = await apiClient.getBudgetSettings()
        if (active) {
          hydrateBudgetForm(settings)
        }
      } catch (err) {
        if (!active) {
          return
        }

        setError(err instanceof ApiError ? err.error.message : "Unable to load onboarding details")
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void bootstrap()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!needsOnboarding) {
      router.replace("/")
    }
  }, [needsOnboarding, router])

  const hydrateBudgetForm = (settings: BudgetSettings) => {
    setIncomeForm(hydrateIncomeForm(settings))
    setAllocationForm(hydrateBudgetAllocationForm(settings))
  }

  const income = useMemo(() => calculateMonthlyIncome(incomeForm), [incomeForm])
  const currentStepIndex = steps.indexOf(step)
  const hasValidName = displayName.trim().length > 0
  const hasValidIncome = isIncomeFormValid(incomeForm)
  const hasValidAllocation = isBudgetAllocationValid(allocationForm, income)
  const canContinue =
    step === "profile" ? hasValidName : step === "income" ? hasValidIncome : step === "allocation" ? hasValidAllocation : true
  const canSave = hasValidName && hasValidIncome && hasValidAllocation && !isSaving

  const goNext = () => {
    if (!canContinue) {
      return
    }

    setError(null)
    setStep(steps[Math.min(currentStepIndex + 1, steps.length - 1)])
  }

  const goBack = () => {
    setError(null)
    setStep(steps[Math.max(currentStepIndex - 1, 0)])
  }

  const handleFinish = async () => {
    if (!canSave) {
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await apiClient.updateProfile({ display_name: displayName.trim() })
      await apiClient.updateBudgetSettings(budgetSettingsPayload(incomeForm, allocationForm))

      await refreshProfile()
      router.replace("/")
    } catch (err) {
      setError(err instanceof ApiError ? err.error.message : "Unable to complete onboarding")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-lg mx-auto px-5 py-10 space-y-6">
        <div className="text-center space-y-2">
          <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
            Step {currentStepIndex + 1} of {steps.length}
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Set up your budget profile</h1>
          <p className="text-muted-foreground">{stepLabel(step)}</p>
        </div>

        {error && (
          <p className="text-sm text-destructive text-center p-2 bg-destructive/10 rounded-lg">{error}</p>
        )}

        {step === "profile" && (
          <Card className="p-5 border-0 shadow-sm">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="h-12 rounded-xl"
                placeholder="How should we call you?"
                disabled={isLoading || isSaving}
              />
            </div>
          </Card>
        )}

        {step === "income" && (
          <Card className="p-5 border-0 shadow-sm">
            <IncomeBreakdownForm
              value={incomeForm}
              onChange={setIncomeForm}
              disabled={isLoading || isSaving}
              idPrefix="onboarding-income"
            />
          </Card>
        )}

        {step === "allocation" && (
          <Card className="p-5 border-0 shadow-sm">
            <div className="mb-4">
              <h2 className="font-semibold">Budget Allocation</h2>
              <p className="text-sm text-muted-foreground">{formatCurrency(income)} per month</p>
            </div>
            <BudgetAllocationForm
              value={allocationForm}
              income={income}
              onChange={setAllocationForm}
              disabled={isLoading || isSaving}
            />
          </Card>
        )}

        {step === "review" && (
          <Card className="p-5 border-0 shadow-sm space-y-4">
            <ReviewRow label="Name" value={displayName.trim()} />
            <div className="space-y-3">
              <p className="text-sm font-medium">Income</p>
              <ReviewRow label="Primary" value={primaryIncomeReviewLabel(incomeForm)} />
              {incomeForm.sideIncomeType !== "none" && (
                <ReviewRow label={sideIncomeReviewTitle(incomeForm)} value={sideIncomeReviewLabel(incomeForm)} />
              )}
              <ReviewRow label="Monthly total" value={formatCurrency(calculateMonthlyIncomeString(incomeForm))} />
            </div>
            <ReviewRow label="Budget split" value={budgetSplitLabel(allocationForm)} />
          </Card>
        )}

        <div className="flex gap-3">
          {currentStepIndex > 0 && (
            <Button variant="outline" className="h-12 flex-1 rounded-xl" onClick={goBack} disabled={isSaving}>
              Back
            </Button>
          )}
          {step === "review" ? (
            <Button className="h-12 flex-1 rounded-xl" onClick={() => void handleFinish()} disabled={!canSave || isLoading}>
              {isSaving ? "Saving..." : "Finish Setup"}
            </Button>
          ) : (
            <Button className="h-12 flex-1 rounded-xl" onClick={goNext} disabled={!canContinue || isLoading || isSaving}>
              Continue
            </Button>
          )}
        </div>
      </main>
    </div>
  )
}

function stepLabel(step: OnboardingStep): string {
  if (step === "profile") {
    return "Start with your name."
  }
  if (step === "income") {
    return "Estimate your average monthly income."
  }
  if (step === "allocation") {
    return "Split your income into budget categories."
  }
  return "Review your setup."
}

function budgetSplitLabel(allocationForm: BudgetAllocationFormState): string {
  if (allocationForm.allocationMode === "percent") {
    return `${toDecimalString(allocationForm.needsPercent)}% / ${toDecimalString(allocationForm.wantsPercent)}% / ${toDecimalString(allocationForm.savingsPercent)}%`
  }

  return `${formatCurrency(allocationForm.needsAmount)} / ${formatCurrency(allocationForm.wantsAmount)} / ${formatCurrency(allocationForm.savingsAmount)}`
}

function primaryIncomeReviewLabel(incomeForm: IncomeFormState): string {
  if (incomeForm.incomeSourceType === "monthly") {
    return `${formatCurrency(incomeForm.primaryMonthlyIncome)} monthly`
  }

  return hourlyReviewLabel(
    incomeForm.primaryHourlyRate,
    incomeForm.primaryWeeklyHours,
    calculateHourlyMonthlyIncome(incomeForm.primaryHourlyRate, incomeForm.primaryWeeklyHours)
  )
}

function sideIncomeReviewTitle(incomeForm: IncomeFormState): string {
  const label = incomeForm.sideIncomeLabel.trim()
  return label || "Side income"
}

function sideIncomeReviewLabel(incomeForm: IncomeFormState): string {
  if (incomeForm.sideIncomeType === "monthly") {
    return `${formatCurrency(incomeForm.sideMonthlyIncome)} monthly`
  }

  return hourlyReviewLabel(
    incomeForm.sideHourlyRate,
    incomeForm.sideWeeklyHours,
    calculateHourlyMonthlyIncome(incomeForm.sideHourlyRate, incomeForm.sideWeeklyHours)
  )
}

function hourlyReviewLabel(hourlyRate: string, weeklyHours: string, monthlyIncome: number): string {
  return `${formatCurrency(hourlyRate)}/hr x ${toDecimalString(weeklyHours)} hrs/week = ${formatCurrency(monthlyIncome)}/mo`
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-right">{value}</p>
    </div>
  )
}
