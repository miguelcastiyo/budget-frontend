"use client"

import { useEffect, useState } from "react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatCurrency } from "@/lib/formatters"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { ApiError, apiClient } from "@/lib/api/client"
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

export default function BudgetSettingsPage() {
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
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    const loadBudgetSettings = async () => {
      try {
        const data = await apiClient.getBudgetSettings()
        hydrateForm(data)
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.error.message)
        } else {
          setError("Unable to load budget settings")
        }
      } finally {
        setIsLoading(false)
      }
    }

    void loadBudgetSettings()
  }, [])

  const hydrateForm = (settings: BudgetSettings) => {
    setMonthlyIncome(settings.monthly_income)
    setAllocationMode(settings.allocation_mode)

    setNeedsPercent(settings.needs_percent || "0.00")
    setWantsPercent(settings.wants_percent || "0.00")
    setSavingsPercent(settings.savings_debts_percent || "0.00")

    setNeedsAmount(settings.needs_amount || "0.00")
    setWantsAmount(settings.wants_amount || "0.00")
    setSavingsAmount(settings.savings_debts_amount || "0.00")
  }

  const totalPercent = asNumber(needsPercent) + asNumber(wantsPercent) + asNumber(savingsPercent)
  const totalAmount = asNumber(needsAmount) + asNumber(wantsAmount) + asNumber(savingsAmount)
  const income = asNumber(monthlyIncome)
  const amountDelta = totalAmount - income

  const isPercentValid = Math.abs(totalPercent - 100) < 0.01
  const isAmountValid = Math.abs(totalAmount - income) < 0.01
  const isAmountOver = amountDelta > 0.01
  const isAmountUnder = amountDelta < -0.01

  const handleAllocationModeChange = (value: string) => {
    const nextMode = value as "percent" | "amount"

    if (allocationMode === "percent" && nextMode === "amount") {
      const incomeValue = asNumber(monthlyIncome)
      let nextNeeds = (asNumber(needsPercent) / 100) * incomeValue
      let nextWants = (asNumber(wantsPercent) / 100) * incomeValue
      let nextSavings = (asNumber(savingsPercent) / 100) * incomeValue

      if (Math.abs(totalPercent - 100) < 0.01) {
        const incomeCents = Math.round(incomeValue * 100)
        const needsCents = Math.round(nextNeeds * 100)
        const wantsCents = Math.round(nextWants * 100)
        const savingsCents = Math.round(nextSavings * 100)
        const adjustedSavingsCents = savingsCents + (incomeCents - (needsCents + wantsCents + savingsCents))

        nextNeeds = needsCents / 100
        nextWants = wantsCents / 100
        nextSavings = adjustedSavingsCents / 100
      }

      setNeedsAmount(nextNeeds.toFixed(2))
      setWantsAmount(nextWants.toFixed(2))
      setSavingsAmount(nextSavings.toFixed(2))
    }

    setAllocationMode(nextMode)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    const normalizedMonthlyIncome = toDecimalString(monthlyIncome)
    const normalizedNeedsPercent = toDecimalString(needsPercent)
    const normalizedWantsPercent = toDecimalString(wantsPercent)
    const normalizedSavingsPercent = toDecimalString(savingsPercent)
    const normalizedNeedsAmount = toDecimalString(needsAmount)
    const normalizedWantsAmount = toDecimalString(wantsAmount)
    const normalizedSavingsAmount = toDecimalString(savingsAmount)

    try {
      const response = await apiClient.updateBudgetSettings(
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

      hydrateForm(response)
      setSuccess("Budget saved")
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to save budget")
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-4">
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Budget</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 pt-4 space-y-6">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}

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
                onChange={(e) => setMonthlyIncome(e.target.value)}
                className="h-14 rounded-xl text-2xl font-bold pl-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                disabled={isLoading}
              />
            </div>
          </div>
        </Card>

        <Card className="p-5 border-0 shadow-sm">
          <h3 className="font-semibold mb-4">Budget Allocation</h3>

          <Tabs
            value={allocationMode}
            onValueChange={handleAllocationModeChange}
          >
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
              />
              <AllocationInput
                label="Wants"
                value={wantsPercent}
                onChange={setWantsPercent}
                suffix="%"
                color="bg-wants"
                subtext={formatCurrency((asNumber(wantsPercent) / 100) * income)}
              />
              <AllocationInput
                label="Savings & Debts"
                value={savingsPercent}
                onChange={setSavingsPercent}
                suffix="%"
                color="bg-savings"
                subtext={formatCurrency((asNumber(savingsPercent) / 100) * income)}
              />

              <div className={cn(
                "p-3 rounded-xl text-center",
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
              />
              <AllocationInput
                label="Wants"
                value={wantsAmount}
                onChange={setWantsAmount}
                prefix="$"
                color="bg-wants"
                subtext={`${income > 0 ? ((asNumber(wantsAmount) / income) * 100).toFixed(0) : "0"}%`}
              />
              <AllocationInput
                label="Savings & Debts"
                value={savingsAmount}
                onChange={setSavingsAmount}
                prefix="$"
                color="bg-savings"
                subtext={`${income > 0 ? ((asNumber(savingsAmount) / income) * 100).toFixed(0) : "0"}%`}
              />

              <div className={cn(
                "p-3 rounded-xl text-center",
                isAmountValid ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"
              )}>
                Total: {formatCurrency(totalAmount)}
                {!isAmountValid && (
                  isAmountOver
                    ? ` (${formatCurrency(amountDelta)} over ${formatCurrency(income)})`
                    : isAmountUnder
                      ? ` (${formatCurrency(Math.abs(amountDelta))} under ${formatCurrency(income)})`
                      : ` (must equal ${formatCurrency(income)})`
                )}
              </div>
            </TabsContent>
          </Tabs>

          <Button
            className="w-full h-12 rounded-xl mt-4"
            onClick={() => void handleSave()}
            disabled={isLoading || isSaving || (allocationMode === "percent" ? !isPercentValid : !isAmountValid)}
          >
            {isSaving ? "Saving..." : "Save Budget"}
          </Button>
        </Card>

        <p className="text-sm text-muted-foreground text-center px-4">
          The 50/30/20 rule suggests allocating 50% to needs, 30% to wants, and 20% to savings and debt repayment.
        </p>
      </main>

      <BottomNav />
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
}

function AllocationInput({ label, value, onChange, prefix, suffix, color, subtext }: AllocationInputProps) {
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
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-10 rounded-xl text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            prefix && "pl-6",
            suffix && "pr-8"
          )}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{suffix}</span>
        )}
      </div>
    </div>
  )
}
