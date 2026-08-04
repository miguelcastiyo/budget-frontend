"use client"

import { useCallback, useEffect, useState } from "react"
import { ApiError } from "@/lib/api/client"
import type { FundDetail, FundEntry } from "@/lib/api/types"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"

export function useFundDetail(fundId: string) {
  const authority = useFinancialAuthority()
  const [fund, setFund] = useState<FundDetail | null>(null)
  const [entries, setEntries] = useState<FundEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(async () => {
    if (!fundId || authority.isLoading || (authority.mode === "encrypted" && !authority.authority)) return
    setIsLoading(true); setError(null)
    try {
      if (authority.mode !== "encrypted") throw new Error("ENCRYPTED_AUTHORITY_REQUIRED")
      const [fundResponse, entriesResponse] = await Promise.all([authority.getFund(fundId), authority.getFundEntries(fundId)])
      setFund(fundResponse); setEntries(entriesResponse.items)
    } catch (err) { setError(err instanceof ApiError ? err.error.message : "Unable to load fund") }
    finally { setIsLoading(false) }
  }, [authority, fundId])
  useEffect(() => { void reload() }, [reload])
  return { fund, entries, isLoading, error, reload }
}
