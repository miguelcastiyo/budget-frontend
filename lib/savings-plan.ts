"use client"

import { useCallback, useEffect, useState } from "react"
import { ApiError, apiClient } from "@/lib/api/client"
import type { ReplaceSavingsPlanRequest, SavingsPlanResponse } from "@/lib/api/types"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"

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
