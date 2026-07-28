"use client"

import { useCallback, useEffect, useState } from "react"
import { ApiError, apiClient } from "@/lib/api/client"
import type { DataRunItem } from "@/lib/api/types"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"

export function useDataRuns(limit = 50) {
  const [dataRuns, setDataRuns] = useState<DataRunItem[]>([])
  const [isLoadingRuns, setIsLoadingRuns] = useState(true)
  const [runsError, setRunsError] = useState<string | null>(null)
  const authority = useFinancialAuthority()

  const loadDataRuns = useCallback(async () => {
    setIsLoadingRuns(true)
    setRunsError(null)

    try {
      if (authority.mode === "encrypted") {
        setDataRuns((authority.authority?.getState().importRuns ?? []).slice(0, limit).map((item) => ({ id: String(item.id ?? ""), type: "import", status: String(item.status ?? "completed"), source_filename: String(item.source_filename ?? ""), created_at: String(item.created_at ?? ""), total_rows: Number(item.total_rows ?? 0), valid_rows: Number(item.valid_rows ?? 0), imported_rows: Number(item.imported_rows ?? 0), duplicate_rows: Number(item.duplicate_rows ?? 0), invalid_rows: Number(item.invalid_rows ?? 0), error_summary: item.error_summary == null ? null : String(item.error_summary) } as DataRunItem)))
      } else {
        const response = await apiClient.getDataRuns(limit)
        setDataRuns(response.items)
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setRunsError(err.error.message)
      } else {
        setRunsError("Unable to load recent activity")
      }
    } finally {
      setIsLoadingRuns(false)
    }
  }, [authority, limit])

  useEffect(() => {
    void loadDataRuns()
  }, [loadDataRuns])

  return {
    dataRuns,
    isLoadingRuns,
    runsError,
    loadDataRuns,
    setDataRuns,
  }
}
