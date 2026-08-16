"use client"

import { useCallback, useEffect, useState } from "react"
import { ApiError, apiClient } from "@/lib/api/client"
import { sortCards } from "@/lib/cards"
import type { Card, RecurringExpensesResponse, Tag } from "@/lib/api/types"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"

function materializationErrorMessage(code: string): string {
  switch (code) {
    case "VALIDATION_FAILED":
      return "Some recurring items need attention before they can be posted. Check their amount, tag, and schedule."
    case "RECURRING_VERSION_CONFLICT":
      return "Some recurring versions overlap, so this month could not be posted safely. Edit or cancel the conflicting future version."
    case "RECURRING_EFFECTIVE_MONTH_ALREADY_MATERIALIZED":
      return "A recurring item is already posted for this month, so it was left unchanged."
    default:
      return code && !code.startsWith("RECURRING_")
        ? `Recurring items could not be fully posted: ${code}`
        : "Recurring items could not be fully posted. Retry to complete materialization."
  }
}

export function useRecurringData(month: string) {
  const [data, setData] = useState<RecurringExpensesResponse | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const authority = useFinancialAuthority()

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (authority.isLoading) {
        return
      }
      if (authority.isUnlocked) {
        // Materialization is a write-side convenience for the selected/current
        // month. It must not prevent already-decrypted recurring rules from
        // being displayed if a stale occurrence or migrated record needs a
        // later retry.
        const materialization = await authority.materializeRecurring(month)
        if (materialization.status === "failed") {
          setError(materializationErrorMessage(materialization.code))
        }
        const recurringResponse = await authority.getRecurringExpenses(month) as RecurringExpensesResponse
        setData(recurringResponse)
        setTags(await authority.getTags())
        setCards(await authority.getCards())
        return
      }
      throw new Error("ENCRYPTED_AUTHORITY_LOCKED")
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to load recurring expenses")
      }
    } finally {
      setIsLoading(false)
    }
  }, [authority, month])

  useEffect(() => {
    void loadData()
  }, [loadData])

  return {
    data,
    tags,
    cards,
    isLoading,
    error,
    setTags,
    setCards,
    setError,
    loadData,
  }
}
