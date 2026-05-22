"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { BudgetAllocationForm } from "@/components/budget/budget-allocation-form"
import { IncomeBreakdownForm } from "@/components/budget/income-breakdown-form"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ApiError, apiClient } from "@/lib/api/client"
import type { BudgetSettings } from "@/lib/api/types"
import {
  budgetSettingsPayload,
  defaultBudgetAllocationFormState,
  hydrateBudgetAllocationForm,
  isBudgetAllocationValid,
  type BudgetAllocationFormState,
} from "@/lib/budget-allocation"
import {
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
    setIncomeForm(hydrateIncomeForm(settings))
    setAllocationForm(hydrateBudgetAllocationForm(settings))
  }

  const income = calculateMonthlyIncome(incomeForm)
  const hasValidIncome = isIncomeFormValid(incomeForm)
  const hasValidAllocation = isBudgetAllocationValid(allocationForm, income)

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await apiClient.updateBudgetSettings(budgetSettingsPayload(incomeForm, allocationForm))

      hydrateForm(response)
      setSuccess("Budget saved")
    } catch (err) {
      setError(err instanceof ApiError ? err.error.message : "Unable to save budget")
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
          <IncomeBreakdownForm
            value={incomeForm}
            onChange={setIncomeForm}
            disabled={isLoading || isSaving}
            idPrefix="settings-income"
          />
        </Card>

        <Card className="p-5 border-0 shadow-sm">
          <h3 className="font-semibold mb-4">Budget Allocation</h3>
          <BudgetAllocationForm
            value={allocationForm}
            income={income}
            onChange={setAllocationForm}
            disabled={isLoading || isSaving}
          />

          <Button
            className="w-full h-12 rounded-xl mt-4"
            onClick={() => void handleSave()}
            disabled={isLoading || isSaving || !hasValidIncome || !hasValidAllocation}
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
