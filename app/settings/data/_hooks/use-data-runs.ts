"use client"

import { useCallback, useEffect, useState } from "react"
import { ApiError, apiClient } from "@/lib/api/client"
import type { DataRunItem } from "@/lib/api/types"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"
import { analyzeImportLineage } from "@/lib/domain/financial/import-lineage-repair"

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
        const encryptedAuthority = authority.authority
        const runs = encryptedAuthority?.getState().importRuns ?? []
        setDataRuns(runs.slice(0, limit).map((item) => {
          const id = String(item.id ?? "")
          const analysis = encryptedAuthority ? analyzeImportLineage(encryptedAuthority, id) : null
          const rolledBack = String(item.status ?? "") === "rolled_back"
          return { id, type: "import", status: String(item.status ?? "completed"), source_filename: String(item.source_filename ?? ""), created_at: String(item.created_at ?? ""), total_rows: Number(item.total_rows ?? 0), valid_rows: Number(item.valid_rows ?? 0), imported_rows: Number(item.imported_rows ?? 0), duplicate_rows: Number(item.duplicate_rows ?? 0), invalid_rows: Number(item.invalid_rows ?? 0), error_summary: item.error_summary == null ? null : String(item.error_summary), rollback_available: !rolledBack && (analysis?.status === "not_needed" || analysis?.status === "repaired"), rolled_back_at: rolledBack ? String(item.rolled_back_at ?? item.updated_at ?? "") : null, rolled_back_rows: Number(item.rolled_back_rows ?? 0), rollback_unavailable_reason: analysis?.status === "source_file_required" || analysis?.status === "ambiguous" ? "pre_rollback_feature" : null, lineage_repair_status: analysis?.status, lineage_repair_evidence: analysis?.evidenceMethod ?? null } as DataRunItem
        }))
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
