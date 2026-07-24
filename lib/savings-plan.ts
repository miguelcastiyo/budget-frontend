"use client"

import { useCallback, useEffect, useState } from "react"
import { ApiError, apiClient } from "@/lib/api/client"
import type { ReplaceSavingsPlanRequest, SavingsPlanResponse } from "@/lib/api/types"

export function useSavingsPlan(month: string) {
  const [data, setData] = useState<SavingsPlanResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const next = await apiClient.getSavingsPlan(month)
      setData(next)
      return next
    } catch (err) {
      setError(err instanceof ApiError ? err.error.message : "Unable to load Savings Plan")
      return null
    } finally {
      setIsLoading(false)
    }
  }, [month])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, isLoading, error, refetch }
}

export function useReplaceSavingsPlan(month: string) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const replace = useCallback(async (request: ReplaceSavingsPlanRequest) => {
    setIsSaving(true)
    setError(null)
    try {
      return await apiClient.replaceSavingsPlan(month, request)
    } catch (err) {
      const message = err instanceof ApiError ? err.error.message : "Unable to save Savings Plan"
      setError(message)
      return null
    } finally {
      setIsSaving(false)
    }
  }, [month])

  return { replace, isSaving, error }
}
