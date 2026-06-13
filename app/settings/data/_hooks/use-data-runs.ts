"use client"

import { useCallback, useEffect, useState } from "react"
import { ApiError, apiClient } from "@/lib/api/client"
import type { DataRunItem } from "@/lib/api/types"

export function useDataRuns(limit = 50) {
  const [dataRuns, setDataRuns] = useState<DataRunItem[]>([])
  const [isLoadingRuns, setIsLoadingRuns] = useState(true)
  const [runsError, setRunsError] = useState<string | null>(null)

  const loadDataRuns = useCallback(async () => {
    setIsLoadingRuns(true)
    setRunsError(null)

    try {
      const response = await apiClient.getDataRuns(limit)
      setDataRuns(response.items)
    } catch (err) {
      if (err instanceof ApiError) {
        setRunsError(err.error.message)
      } else {
        setRunsError("Unable to load recent activity")
      }
    } finally {
      setIsLoadingRuns(false)
    }
  }, [limit])

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
