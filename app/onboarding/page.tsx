"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { IncomeBreakdownForm } from "@/components/budget/income-breakdown-form"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/formatters"
import { ApiError, apiClient } from "@/lib/api/client"
import { useAuth } from "@/components/auth/auth-provider"
import {
  asNumber,
  calculateMonthlyIncome,
  calculateMonthlyIncomeString,
  defaultIncomeFormState,
  hydrateIncomeForm,
  incomeBreakdownPayload,
  isIncomeFormValid,
  toDecimalString,
  type IncomeFormState,
} from "@/lib/income-breakdown"
import type { BudgetSettings } from "@/lib/api/types"

type AllocationMode = "percent" | "amount"
type OnboardingStep = "profile" | "income" | "allocation" | "review"

const steps: OnboardingStep[] = ["profile", "income", "allocation", "review"]

export default function OnboardingPage() {
  const router = useRouter()
  const { profile, refreshProfile, needsOnboarding } = useAuth()

  const [step, setStep] = useState<OnboardingStep>("profile")
  const [displayName, setDisplayName] = useState("")
  const [incomeForm, setIncomeForm] = useState<IncomeFormState>(defaultIncomeFormState)
  const [allocationMode, setAllocationMode] = useState<AllocationMode>("percent")
  const [needsPercent, setNeedsPercent] = useState("50.00")
  const [wantsPercent, setWantsPercent] = useState("30.00")
  const [savingsPercent, setSavingsPercent] = useState("20.00")
  const [needsAmount, setNeedsAmount] = useState("0.00")
  const [wantsAmount, setWantsAmount] = useState("0.00")
  const [savingsAmount, setSavingsAmount] = useState("0.00")
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
    setAllocationMode(settings.allocation_mode)
    setNeedsPercent(settings.needs_percent || "50.00")
    setWantsPercent(settings.wants_percent || "30.00")
    setSavingsPercent(settings.savings_debts_percent || "20.00")
    setNeedsAmount(settings.needs_amount || "0.00")
    setWantsAmount(settings.wants_amount || "0.00")
    setSavingsAmount(settings.savings_debts_amount || "0.00")
  }

  const income = useMemo(() => calculateMonthlyIncome(incomeForm), [incomeForm])
  const totalPercent = useMemo(
    () => asNumber(needsPercent) + asNumber(wantsPercent) + asNumber(savingsPercent),
    [needsPercent, wantsPercent, savingsPercent]
  )
  const totalAmount = useMemo(
    () => asNumber(needsAmount) + asNumber(wantsAmount) + asNumber(savingsAmount),
    [needsAmount, wantsAmount, savingsAmount]
  )
  const currentStepIndex = steps.indexOf(step)
  const isPercentValid = Math.abs(totalPercent - 100) < 0.01
  const isAmountValid = Math.abs(totalAmount - income) < 0.01
  const hasValidName = displayName.trim().length > 0
  const hasValidIncome = isIncomeFormValid(incomeForm)
  const hasValidAllocation = allocationMode === "percent" ? isPercentValid : isAmountValid
  const canContinue =
    step === "profile" ? hasValidName : step === "income" ? hasValidIncome : step === "allocation" ? hasValidAllocation : true
  const canSave = hasValidName && hasValidIncome && hasValidAllocation && !isSaving

  const handleAllocationModeChange = (value: string) => {
    const nextMode = value as AllocationMode

    if (allocationMode === "percent" && nextMode === "amount") {
      const nextNeeds = (asNumber(needsPercent) / 100) * income
      const nextWants = (asNumber(wantsPercent) / 100) * income
      const nextSavings = income - nextNeeds - nextWants

      setNeedsAmount(nextNeeds.toFixed(2))
      setWantsAmount(nextWants.toFixed(2))
      setSavingsAmount(nextSavings.toFixed(2))
    }

    setAllocationMode(nextMode)
  }

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

    const incomePayload = incomeBreakdownPayload(incomeForm)
    const normalizedNeedsPercent = toDecimalString(needsPercent)
    const normalizedWantsPercent = toDecimalString(wantsPercent)
    const normalizedSavingsPercent = toDecimalString(savingsPercent)
    const normalizedNeedsAmount = toDecimalString(needsAmount)
    const normalizedWantsAmount = toDecimalString(wantsAmount)
    const normalizedSavingsAmount = toDecimalString(savingsAmount)

    try {
      await apiClient.updateProfile({ display_name: displayName.trim() })
      await apiClient.updateBudgetSettings(
        allocationMode === "percent"
          ? {
              ...incomePayload,
              allocation_mode: "percent",
              needs_percent: normalizedNeedsPercent,
              wants_percent: normalizedWantsPercent,
              savings_debts_percent: normalizedSavingsPercent,
            }
          : {
              ...incomePayload,
              allocation_mode: "amount",
              needs_amount: normalizedNeedsAmount,
              wants_amount: normalizedWantsAmount,
              savings_debts_amount: normalizedSavingsAmount,
            }
      )

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
            <AllocationTabs
              allocationMode={allocationMode}
              onAllocationModeChange={handleAllocationModeChange}
              income={income}
              needsPercent={needsPercent}
              wantsPercent={wantsPercent}
              savingsPercent={savingsPercent}
              needsAmount={needsAmount}
              wantsAmount={wantsAmount}
              savingsAmount={savingsAmount}
              setNeedsPercent={setNeedsPercent}
              setWantsPercent={setWantsPercent}
              setSavingsPercent={setSavingsPercent}
              setNeedsAmount={setNeedsAmount}
              setWantsAmount={setWantsAmount}
              setSavingsAmount={setSavingsAmount}
              isPercentValid={isPercentValid}
              isAmountValid={isAmountValid}
              totalPercent={totalPercent}
              totalAmount={totalAmount}
              disabled={isLoading || isSaving}
            />
          </Card>
        )}

        {step === "review" && (
          <Card className="p-5 border-0 shadow-sm space-y-4">
            <ReviewRow label="Name" value={displayName.trim()} />
            <ReviewRow label="Monthly income" value={formatCurrency(calculateMonthlyIncomeString(incomeForm))} />
            <ReviewRow
              label="Budget split"
              value={
                allocationMode === "percent"
                  ? `${toDecimalString(needsPercent)}% / ${toDecimalString(wantsPercent)}% / ${toDecimalString(savingsPercent)}%`
                  : `${formatCurrency(needsAmount)} / ${formatCurrency(wantsAmount)} / ${formatCurrency(savingsAmount)}`
              }
            />
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

interface AllocationTabsProps {
  allocationMode: AllocationMode
  onAllocationModeChange: (value: string) => void
  income: number
  needsPercent: string
  wantsPercent: string
  savingsPercent: string
  needsAmount: string
  wantsAmount: string
  savingsAmount: string
  setNeedsPercent: (value: string) => void
  setWantsPercent: (value: string) => void
  setSavingsPercent: (value: string) => void
  setNeedsAmount: (value: string) => void
  setWantsAmount: (value: string) => void
  setSavingsAmount: (value: string) => void
  isPercentValid: boolean
  isAmountValid: boolean
  totalPercent: number
  totalAmount: number
  disabled?: boolean
}

function AllocationTabs({
  allocationMode,
  onAllocationModeChange,
  income,
  needsPercent,
  wantsPercent,
  savingsPercent,
  needsAmount,
  wantsAmount,
  savingsAmount,
  setNeedsPercent,
  setWantsPercent,
  setSavingsPercent,
  setNeedsAmount,
  setWantsAmount,
  setSavingsAmount,
  isPercentValid,
  isAmountValid,
  totalPercent,
  totalAmount,
  disabled = false,
}: AllocationTabsProps) {
  return (
    <Tabs value={allocationMode} onValueChange={onAllocationModeChange}>
      <TabsList className="w-full mb-4">
        <TabsTrigger value="percent" className="flex-1" disabled={disabled}>By Percentage</TabsTrigger>
        <TabsTrigger value="amount" className="flex-1" disabled={disabled}>By Amount</TabsTrigger>
      </TabsList>

      <TabsContent value="percent" className="space-y-4">
        <AllocationInput
          label="Needs"
          value={needsPercent}
          onChange={setNeedsPercent}
          suffix="%"
          color="bg-needs"
          subtext={formatCurrency((asNumber(needsPercent) / 100) * income)}
          disabled={disabled}
        />
        <AllocationInput
          label="Wants"
          value={wantsPercent}
          onChange={setWantsPercent}
          suffix="%"
          color="bg-wants"
          subtext={formatCurrency((asNumber(wantsPercent) / 100) * income)}
          disabled={disabled}
        />
        <AllocationInput
          label="Savings & Debts"
          value={savingsPercent}
          onChange={setSavingsPercent}
          suffix="%"
          color="bg-savings"
          subtext={formatCurrency((asNumber(savingsPercent) / 100) * income)}
          disabled={disabled}
        />

        <div className={cn(
          "p-3 rounded-xl text-center text-sm",
          isPercentValid ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"
        )}>
          Total: {totalPercent.toFixed(0)}%
          {!isPercentValid && " (must equal 100%)"}
        </div>
      </TabsContent>

      <TabsContent value="amount" className="space-y-4">
        <AllocationInput
          label="Needs"
          value={needsAmount}
          onChange={setNeedsAmount}
          prefix="$"
          color="bg-needs"
          subtext={`${income > 0 ? ((asNumber(needsAmount) / income) * 100).toFixed(0) : "0"}%`}
          disabled={disabled}
        />
        <AllocationInput
          label="Wants"
          value={wantsAmount}
          onChange={setWantsAmount}
          prefix="$"
          color="bg-wants"
          subtext={`${income > 0 ? ((asNumber(wantsAmount) / income) * 100).toFixed(0) : "0"}%`}
          disabled={disabled}
        />
        <AllocationInput
          label="Savings & Debts"
          value={savingsAmount}
          onChange={setSavingsAmount}
          prefix="$"
          color="bg-savings"
          subtext={`${income > 0 ? ((asNumber(savingsAmount) / income) * 100).toFixed(0) : "0"}%`}
          disabled={disabled}
        />

        <div className={cn(
          "p-3 rounded-xl text-center text-sm",
          isAmountValid ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"
        )}>
          Total: {formatCurrency(totalAmount)}
          {!isAmountValid && ` (must equal ${formatCurrency(income)})`}
        </div>
      </TabsContent>
    </Tabs>
  )
}

interface AllocationInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  prefix?: string
  suffix?: string
  color: string
  subtext: string
  disabled?: boolean
}

function AllocationInput({
  label,
  value,
  onChange,
  prefix,
  suffix,
  color,
  subtext,
  disabled = false,
}: AllocationInputProps) {
  return (
    <div className="flex items-center gap-4">
      <div className={`w-4 h-4 rounded-full ${color}`} />
      <div className="flex-1">
        <Label className="text-sm text-muted-foreground">{label}</Label>
        <p className="text-xs text-muted-foreground">{subtext}</p>
      </div>
      <div className="relative w-28">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{prefix}</span>
        )}
        <Input
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            "h-10 rounded-xl text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            prefix && "pl-6",
            suffix && "pr-8"
          )}
          disabled={disabled}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{suffix}</span>
        )}
      </div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-right">{value}</p>
    </div>
  )
}
