"use client"

import { useCallback, useEffect, useState } from "react"
import { ApiError } from "@/lib/api/client"
import type { FundCloseoutSummaryResponse, FundListItem } from "@/lib/api/types"
import { encryptedFundCloseoutSummary } from "@/lib/privacy/encrypted-authority/derived"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"
import type { FundsFilter } from "../fund-types"

export function useFundsOverview(filter: FundsFilter) {
  const authority = useFinancialAuthority()
  const [funds, setFunds] = useState<FundListItem[]>([])
  const [activeFundMetrics, setActiveFundMetrics] = useState<FundListItem[]>([])
  const [summary, setSummary] = useState<FundCloseoutSummaryResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (authority.isLoading || (authority.mode === "encrypted" && !authority.authority)) return
    setIsLoading(true); setError(null); setSummaryError(null)
    try {
      const metricsPromise = filter === "active" ? null : authority.getFunds({ status: "active" })
      if (authority.mode !== "encrypted" || !authority.authority) throw new Error("ENCRYPTED_AUTHORITY_REQUIRED")
      const [fundsResult, activeMetricsResult, summaryResult] = await Promise.allSettled([
        authority.getFunds({ status: filter }),
        metricsPromise ?? Promise.resolve(null),
        Promise.resolve(encryptedFundCloseoutSummary(authority.authority.getState(), new Date().getFullYear())),
      ])
      if (fundsResult.status === "rejected") throw fundsResult.reason
      setFunds(fundsResult.value.items)
      if (filter === "active") setActiveFundMetrics(fundsResult.value.items.filter((fund) => fund.status === "active"))
      else if (activeMetricsResult.status === "fulfilled" && activeMetricsResult.value) setActiveFundMetrics(activeMetricsResult.value.items.filter((fund) => fund.status === "active"))
      else { setActiveFundMetrics([]); setSummaryError("Some supporting fund totals are unavailable right now.") }
      if (summaryResult.status === "fulfilled") setSummary(summaryResult.value)
      else { setSummary(null); setSummaryError("Closeout summary is unavailable right now.") }
    } catch (err) {
      setError(err instanceof ApiError ? err.error.message : "Unable to load funds")
    } finally { setIsLoading(false) }
  }, [authority, filter])

  useEffect(() => { void reload() }, [reload])
  return { funds, activeFundMetrics, summary, isLoading, error, summaryError, reload }
}
