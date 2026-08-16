"use client"

import { useCallback, useEffect, useState } from "react"
import { ApiError } from "@/lib/api/client"
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
      setDataRuns(await authority.getDataRuns(limit))
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
