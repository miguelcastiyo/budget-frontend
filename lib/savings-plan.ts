"use client"

import { useCallback, useEffect, useState } from "react"
import { ApiError, apiClient } from "@/lib/api/client"
import type { ReplaceSavingsPlanRequest, SavingsPlanResponse } from "@/lib/api/types"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"
import { createEncryptedRecordId } from "@/lib/privacy/encrypted-records/crypto"
import { parseMoneyCents } from "@/lib/domain/financial/money"
import { resolvedAmounts, resolvedBudget } from "@/lib/domain/financial/budgets"

export function useSavingsPlan(month: string) {
  const [data, setData] = useState<SavingsPlanResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const authority = useFinancialAuthority()

  const refetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      if (authority.isLoading) {
        return null
      }
      const next = await authority.getSavingsPlan(month)
      setData(next)
      return next
    } catch (err) {
      setError(err instanceof ApiError ? err.error.message : "Unable to load Savings Plan")
      return null
    } finally {
      setIsLoading(false)
    }
  }, [authority, month])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, isLoading, error, refetch }
}

export function useReplaceSavingsPlan(month: string) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const authority = useFinancialAuthority()

  const replace = useCallback(async (request: ReplaceSavingsPlanRequest) => {
    setIsSaving(true)
    setError(null)
    try {
      if (authority.isLoading) {
        throw new Error("ENCRYPTED_AUTHORITY_LOADING")
      }
      if (authority.authority) {
        const encryptedAuthority = authority.authority
        if (!encryptedAuthority) {
          throw new Error("ENCRYPTED_AUTHORITY_LOCKED")
        }
        const savingsBudgetCents = parseMoneyCents(String(resolvedAmounts(resolvedBudget(encryptedAuthority.getState().budgets, month).settings).savings))
        const prior = encryptedAuthority.store.values().filter((record) =>
          (record.family === "savings_plan" || record.family === "savings_plan_allocation") &&
          String(record.data.month ?? "") === month,
        )
        const planId = createEncryptedRecordId()
        const creates = [
          {
            id: planId,
            family: "savings_plan",
            data: { id: planId, month, status: "active", savings_budget_cents: savingsBudgetCents },
          },
          ...request.allocations.map((allocation) => {
            const id = createEncryptedRecordId()
            return {
              id,
              family: "savings_plan_allocation",
              data: {
                id,
                plan_id: planId,
                month,
                fund_id: allocation.fund_id,
                planned_amount_cents: parseMoneyCents(allocation.amount),
              },
            }
          }),
        ]
        await encryptedAuthority.commitSourceDiff({
          creates,
          updates: [],
          tombstones: prior.map((record) => ({ id: record.envelope.record_id, family: record.family, data: record.data })),
        })
        return authority.getSavingsPlan(month)
      }
      return await authority.replaceSavingsPlan(month, request)
    } catch (err) {
      const message = err instanceof ApiError ? err.error.message : "Unable to save Savings Plan"
      setError(message)
      return null
    } finally {
      setIsSaving(false)
    }
  }, [authority, month])

  return { replace, isSaving, error }
}
