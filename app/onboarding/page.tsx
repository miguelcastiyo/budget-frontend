"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, PencilLine } from "lucide-react"
import { BudgetAllocationForm } from "@/components/budget/budget-allocation-form"
import { IncomeBreakdownForm } from "@/components/budget/income-breakdown-form"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatCurrency } from "@/lib/formatters"
import { ApiError, apiClient } from "@/lib/api/client"
import { useAuth } from "@/components/auth/auth-provider"
import { formatMonthLabel, formatMonthValue, getCurrentMonthKey } from "@/lib/date-filters"
import {
  budgetSettingsPayload,
  defaultBudgetAllocationFormState,
  isBudgetAllocationValid,
  type BudgetAllocationFormState,
} from "@/lib/budget-allocation"
import {
  calculateMonthlyIncome,
  calculateMonthlyIncomeString,
  defaultIncomeFormState,
  isIncomeFormValid,
  type IncomeFormState,
} from "@/lib/income-breakdown"
import {
  createBudgetFormState,
  getAllocationPercentDisplay,
  getAllocationTarget,
} from "@/lib/budget-form"
import type { BudgetSettings } from "@/lib/api/types"

type OnboardingStep = "income" | "allocation" | "review"

const steps: OnboardingStep[] = ["income", "allocation", "review"]

export default function OnboardingPage() {
  const router = useRouter()
  const { profile, refreshProfile, needsOnboarding } = useAuth()

  const [step, setStep] = useState<OnboardingStep>("income")
  const [displayName, setDisplayName] = useState("")
  const [incomeForm, setIncomeForm] = useState<IncomeFormState>(defaultIncomeFormState)
  const [allocationForm, setAllocationForm] = useState<BudgetAllocationFormState>(defaultBudgetAllocationFormState)
  const [showAdvancedAllocation, setShowAdvancedAllocation] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const currentMonthKey = getCurrentMonthKey()
  const budgetMonthLabel = formatMonthLabel(currentMonthKey) ?? currentMonthKey
  const budgetMonthName = formatMonthValue(currentMonthKey, { month: "long" }) ?? currentMonthKey

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
    const nextState = createBudgetFormState(settings)
    setIncomeForm(nextState.incomeForm)
    setAllocationForm(nextState.allocationForm)
    setShowAdvancedAllocation(false)
  }

  const income = useMemo(() => calculateMonthlyIncome(incomeForm), [incomeForm])
  const currentStepIndex = steps.indexOf(step)
  const requiresDisplayName = (profile?.display_name.trim() ?? "") === ""
  const hasValidName = displayName.trim().length > 0
  const hasValidIncome = isIncomeFormValid(incomeForm)
  const hasValidAllocation = isBudgetAllocationValid(allocationForm, income)
  const canContinue =
    step === "income"
      ? hasValidIncome && (!requiresDisplayName || hasValidName)
      : step === "allocation"
        ? hasValidAllocation
        : true
  const canSave = (!requiresDisplayName || hasValidName) && hasValidIncome && hasValidAllocation && !isSaving

  const needsTarget = useMemo(() => getAllocationTarget(income, allocationForm, "needs"), [income, allocationForm])
  const wantsTarget = useMemo(() => getAllocationTarget(income, allocationForm, "wants"), [income, allocationForm])
  const savingsTarget = useMemo(() => getAllocationTarget(income, allocationForm, "savings"), [income, allocationForm])
  const needsPercentDisplay = useMemo(() => getAllocationPercentDisplay(income, allocationForm, "needs"), [income, allocationForm])
  const wantsPercentDisplay = useMemo(() => getAllocationPercentDisplay(income, allocationForm, "wants"), [income, allocationForm])
  const savingsPercentDisplay = useMemo(() => getAllocationPercentDisplay(income, allocationForm, "savings"), [income, allocationForm])

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
      if (displayName.trim() && displayName.trim() !== profile?.display_name) {
        await apiClient.updateProfile({ display_name: displayName.trim() })
      }

      await apiClient.updateBudgetSettings({
        ...budgetSettingsPayload(incomeForm, allocationForm),
        effective_month: currentMonthKey,
      })

      await refreshProfile()
      router.replace("/")
    } catch (err) {
      setError(err instanceof ApiError ? err.error.message : "Unable to create your first budget")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(130,148,108,0.16),transparent_55%),linear-gradient(180deg,rgba(188,157,102,0.10),transparent_75%)]" />
      <main className="relative mx-auto max-w-2xl px-5 py-8 sm:px-6 sm:py-10">
        <div className="space-y-6">
          <div className="space-y-3 text-center">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Step {currentStepIndex + 1} of {steps.length}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {titleForStep(step)}
            </h1>
            <p className="mx-auto max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              {descriptionForStep(step)}
            </p>
          </div>

          {error && (
            <p className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}

          {step === "income" && (
            <Card className="space-y-6 rounded-[1.75rem] border-border/70 bg-card/95 p-5 shadow-sm sm:p-6">
              <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">First budget page</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Start with the income your budget needs right now. You can refine this later.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <PencilLine className="size-4 text-muted-foreground" />
                  <Label htmlFor="displayName">{requiresDisplayName ? "Display name" : "Display name (optional)"}</Label>
                </div>
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

              <IncomeBreakdownForm
                value={incomeForm}
                onChange={setIncomeForm}
                disabled={isLoading || isSaving}
                idPrefix="onboarding-income"
              />
            </Card>
          )}

          {step === "allocation" && (
            <Card className="space-y-6 rounded-[1.75rem] border-border/70 bg-card/95 p-5 shadow-sm sm:p-6">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Simple budget split</p>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">We&apos;ll start with 50 / 30 / 20</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      You can adjust this anytime. {formatCurrency(income)} is ready to split across your month.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setShowAdvancedAllocation((current) => !current)}
                    disabled={isLoading || isSaving}
                  >
                    {showAdvancedAllocation ? "Hide custom controls" : "Customize split"}
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <AllocationPreviewCard
                  label="Needs"
                  percent={needsPercentDisplay}
                  amount={formatCurrency(needsTarget)}
                  toneClassName="bg-needs/10 text-needs"
                />
                <AllocationPreviewCard
                  label="Wants"
                  percent={wantsPercentDisplay}
                  amount={formatCurrency(wantsTarget)}
                  toneClassName="bg-wants/10 text-wants"
                />
                <AllocationPreviewCard
                  label="Savings"
                  percent={savingsPercentDisplay}
                  amount={formatCurrency(savingsTarget)}
                  toneClassName="bg-savings/10 text-savings"
                />
              </div>

              {showAdvancedAllocation && (
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <BudgetAllocationForm
                    value={allocationForm}
                    income={income}
                    onChange={setAllocationForm}
                    disabled={isLoading || isSaving}
                  />
                </div>
              )}
            </Card>
          )}

          {step === "review" && (
            <Card className="space-y-5 rounded-[1.75rem] border-border/70 bg-card/95 p-5 shadow-sm sm:p-6">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Review and create budget</p>
                <h2 className="text-2xl font-semibold">Your first month is ready</h2>
                <p className="text-sm text-muted-foreground">
                  This saves a budget for {budgetMonthLabel}. The dashboard will guide your next step.
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 p-4 sm:p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <ReviewBlock label="Display name" value={displayName.trim() || "Not set"} />
                  <ReviewBlock label="Monthly income" value={formatCurrency(calculateMonthlyIncomeString(incomeForm))} />
                  <ReviewBlock label="Needs target" value={`${needsPercentDisplay}% · ${formatCurrency(needsTarget)}`} />
                  <ReviewBlock label="Wants target" value={`${wantsPercentDisplay}% · ${formatCurrency(wantsTarget)}`} />
                  <ReviewBlock label="Savings target" value={`${savingsPercentDisplay}% · ${formatCurrency(savingsTarget)}`} />
                  <ReviewBlock label="Income setup" value={incomeSummary(incomeForm)} />
                </div>
              </div>
            </Card>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            {currentStepIndex > 0 && (
              <Button variant="outline" className="h-12 rounded-xl sm:flex-1" onClick={goBack} disabled={isSaving}>
                Back
              </Button>
            )}
            {step === "review" ? (
              <Button className="h-12 rounded-xl sm:flex-1" onClick={() => void handleFinish()} disabled={!canSave || isLoading}>
                {isSaving ? "Saving budget..." : `Save ${budgetMonthName} Budget`}
              </Button>
            ) : (
              <Button className="h-12 rounded-xl sm:flex-1" onClick={goNext} disabled={!canContinue || isLoading || isSaving}>
                Continue <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function titleForStep(step: OnboardingStep): string {
  if (step === "income") {
    return "Open your first budget page"
  }
  if (step === "allocation") {
    return "Split the month simply"
  }
  return "Create your budget"
}

function descriptionForStep(step: OnboardingStep): string {
  if (step === "income") {
    return "Start with your take-home income. You can refine it later."
  }
  if (step === "allocation") {
    return "Start with 50 / 30 / 20, or customize the split."
  }
  return "Review your first month before saving it."
}

function incomeSummary(incomeForm: IncomeFormState): string {
  const sideIncome = incomeForm.sideIncomeType === "none" ? "No extra income" : "Includes extra income"
  return `${incomeForm.incomeSourceType === "monthly" ? "Monthly pay" : "Hourly pay"} · ${sideIncome}`
}

function AllocationPreviewCard({
  label,
  percent,
  amount,
  toneClassName,
}: {
  label: string
  percent: string
  amount: string
  toneClassName: string
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/85 p-4">
      <div className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${toneClassName}`}>
        {percent}%
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{amount}</p>
    </div>
  )
}

function ReviewBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}
