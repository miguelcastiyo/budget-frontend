"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/formatters"
import { ApiError, apiClient } from "@/lib/api/client"
import { useAuth } from "@/components/auth/auth-provider"
import type { BudgetSettings } from "@/lib/api/types"

function asNumber(value: string): number {
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toDecimalString(value: string): string {
  const parsed = parseFloat(value.replace(/,/g, "").trim())
  if (!Number.isFinite(parsed)) {
    return "0.00"
  }

  return parsed.toFixed(2)
}

export default function OnboardingPage() {
  const router = useRouter()
  const { profile, refreshProfile, needsOnboarding } = useAuth()

  const [displayName, setDisplayName] = useState("")
  const [monthlyIncome, setMonthlyIncome] = useState("0.00")
  const [allocationMode, setAllocationMode] = useState<"percent" | "amount">("percent")
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
    if (!profile) {
      return
    }

    setDisplayName(profile.display_name)
  }, [profile])

  useEffect(() => {
    let active = true

    const bootstrap = async () => {
      try {
        const settings = await apiClient.getBudgetSettings()
        if (!active) {
          return
        }

        hydrateBudgetForm(settings)
      } catch (err) {
        if (!active) {
          return
        }

        if (err instanceof ApiError) {
          setError(err.error.message)
        } else {
          setError("Unable to load onboarding details")
        }
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
    setMonthlyIncome(settings.monthly_income)
    setAllocationMode(settings.allocation_mode)
    setNeedsPercent(settings.needs_percent || "50.00")
    setWantsPercent(settings.wants_percent || "30.00")
    setSavingsPercent(settings.savings_debts_percent || "20.00")
    setNeedsAmount(settings.needs_amount || "0.00")
    setWantsAmount(settings.wants_amount || "0.00")
    setSavingsAmount(settings.savings_debts_amount || "0.00")
  }

  const income = useMemo(() => asNumber(monthlyIncome), [monthlyIncome])
  const totalPercent = useMemo(() => asNumber(needsPercent) + asNumber(wantsPercent) + asNumber(savingsPercent), [needsPercent, wantsPercent, savingsPercent])
  const totalAmount = useMemo(() => asNumber(needsAmount) + asNumber(wantsAmount) + asNumber(savingsAmount), [needsAmount, wantsAmount, savingsAmount])
  const isPercentValid = Math.abs(totalPercent - 100) < 0.01
  const isAmountValid = Math.abs(totalAmount - income) < 0.01
  const hasValidName = displayName.trim().length > 0
  const hasPositiveIncome = income > 0
  const hasValidAllocation = allocationMode === "percent" ? isPercentValid : isAmountValid
  const canSave = hasValidName && hasPositiveIncome && hasValidAllocation && !isSaving

  const handleFinish = async () => {
    if (!canSave) {
      return
    }

    setIsSaving(true)
    setError(null)

    const normalizedMonthlyIncome = toDecimalString(monthlyIncome)
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
              monthly_income: normalizedMonthlyIncome,
              allocation_mode: "percent",
              needs_percent: normalizedNeedsPercent,
              wants_percent: normalizedWantsPercent,
              savings_debts_percent: normalizedSavingsPercent,
            }
          : {
              monthly_income: normalizedMonthlyIncome,
              allocation_mode: "amount",
              needs_amount: normalizedNeedsAmount,
              wants_amount: normalizedWantsAmount,
              savings_debts_amount: normalizedSavingsAmount,
            }
      )

      await refreshProfile()
      router.replace("/")
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to complete onboarding")
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-lg mx-auto px-5 py-10 space-y-6">
        <div className="text-center space-y-2">
          <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">First-time setup</p>
          <h1 className="text-3xl font-bold tracking-tight">Set up your budget profile</h1>
          <p className="text-muted-foreground">One quick step before your dashboard.</p>
        </div>

        {error && (
          <p className="text-sm text-destructive text-center p-2 bg-destructive/10 rounded-lg">{error}</p>
        )}

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

        <Card className="p-5 border-0 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="income">Monthly Income</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="income"
                type="number"
                step="0.01"
                value={monthlyIncome}
                onChange={(event) => setMonthlyIncome(event.target.value)}
                className="h-14 rounded-xl text-2xl font-bold pl-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                disabled={isLoading || isSaving}
              />
            </div>
          </div>
        </Card>

        <Card className="p-5 border-0 shadow-sm">
          <h2 className="font-semibold mb-4">Income Split</h2>

          <Tabs value={allocationMode} onValueChange={(value) => setAllocationMode(value as "percent" | "amount")}>
            <TabsList className="w-full mb-4">
              <TabsTrigger value="percent" className="flex-1">By Percentage</TabsTrigger>
              <TabsTrigger value="amount" className="flex-1">By Amount</TabsTrigger>
            </TabsList>

            <TabsContent value="percent" className="space-y-4">
              <AllocationInput
                label="Needs"
                value={needsPercent}
                onChange={setNeedsPercent}
                suffix="%"
                color="bg-needs"
                subtext={formatCurrency((asNumber(needsPercent) / 100) * income)}
                disabled={isLoading || isSaving}
              />
              <AllocationInput
                label="Wants"
                value={wantsPercent}
                onChange={setWantsPercent}
                suffix="%"
                color="bg-wants"
                subtext={formatCurrency((asNumber(wantsPercent) / 100) * income)}
                disabled={isLoading || isSaving}
              />
              <AllocationInput
                label="Savings & Debts"
                value={savingsPercent}
                onChange={setSavingsPercent}
                suffix="%"
                color="bg-savings"
                subtext={formatCurrency((asNumber(savingsPercent) / 100) * income)}
                disabled={isLoading || isSaving}
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
                disabled={isLoading || isSaving}
              />
              <AllocationInput
                label="Wants"
                value={wantsAmount}
                onChange={setWantsAmount}
                prefix="$"
                color="bg-wants"
                subtext={`${income > 0 ? ((asNumber(wantsAmount) / income) * 100).toFixed(0) : "0"}%`}
                disabled={isLoading || isSaving}
              />
              <AllocationInput
                label="Savings & Debts"
                value={savingsAmount}
                onChange={setSavingsAmount}
                prefix="$"
                color="bg-savings"
                subtext={`${income > 0 ? ((asNumber(savingsAmount) / income) * 100).toFixed(0) : "0"}%`}
                disabled={isLoading || isSaving}
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
        </Card>

        <Button
          className="w-full h-12 rounded-xl"
          onClick={() => void handleFinish()}
          disabled={!canSave || isLoading}
        >
          {isSaving ? "Saving..." : "Finish Setup"}
        </Button>
      </main>
    </div>
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
