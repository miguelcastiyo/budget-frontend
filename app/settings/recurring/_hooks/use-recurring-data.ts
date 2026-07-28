"use client"

import { useCallback, useEffect, useState } from "react"
import { ApiError, apiClient } from "@/lib/api/client"
import { sortCards } from "@/lib/cards"
import type { Card, RecurringExpensesResponse, Tag } from "@/lib/api/types"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"
import { materializeEncryptedRecurring } from "@/lib/privacy/encrypted-authority/recurring-mutation"

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
      if (authority.mode === "encrypted") {
        if (!authority.authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED")
        await materializeEncryptedRecurring(authority.authority, month)
        const recurringResponse = await authority.getRecurringExpenses(month) as RecurringExpensesResponse
        const state = authority.authority?.getState()
        setData(recurringResponse)
        setTags((state?.tags ?? []).map((item) => ({ id: item.id, name: item.name, icon_key: item.iconKey })))
        setCards((state?.cards ?? []).map((item) => ({ id: item.id, name: item.name, is_favorite: item.isFavorite })))
        return
      }
      const [recurringResponse, tagsResponse, cardsResponse] = await Promise.all([apiClient.getRecurringExpenses(month), apiClient.getTags(), apiClient.getCards()])
      setData(recurringResponse)
      setTags(tagsResponse.items)
      setCards(sortCards(cardsResponse.items))
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
