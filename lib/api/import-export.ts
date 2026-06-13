import type { ApiClientCore } from "./core"
import type {
  CsvImportAmountStrategy,
  CsvImportCategoryStrategy,
  CsvImportDateStrategy,
  CsvImportMapping,
  CsvImportPreviewResponse,
  CsvImportResponse,
  CsvImportTagStrategy,
  DataRunsResponse,
  ImportRollbackResponse,
} from "./types"

function createImportFormData(
  file: File,
  mode: "preview" | "dry_run" | "commit",
  mapping?: CsvImportMapping,
  categoryStrategy?: CsvImportCategoryStrategy,
  amountStrategy?: CsvImportAmountStrategy,
  dateStrategy?: CsvImportDateStrategy,
  tagStrategy?: CsvImportTagStrategy
): FormData {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("mode", mode)
  if (mapping) {
    formData.append("mapping", JSON.stringify(mapping))
  }
  if (categoryStrategy) {
    formData.append("category_strategy", JSON.stringify(categoryStrategy))
  }
  if (amountStrategy) {
    formData.append("amount_strategy", JSON.stringify(amountStrategy))
  }
  if (dateStrategy) {
    formData.append("date_strategy", JSON.stringify(dateStrategy))
  }
  if (tagStrategy) {
    formData.append("tag_strategy", JSON.stringify(tagStrategy))
  }

  return formData
}

export function createImportExportApi(core: ApiClientCore) {
  return {
    async getDataRuns(limit = 50): Promise<DataRunsResponse> {
      const params = new URLSearchParams({
        limit: String(limit),
      })

      return core.request<DataRunsResponse>(`/me/data-runs?${params.toString()}`)
    },

    async rollbackImport(importRunId: string): Promise<ImportRollbackResponse> {
      return core.request<ImportRollbackResponse>(`/me/imports/${importRunId}/transactions`, {
        method: "DELETE",
      })
    },

    async previewImportTransactions(file: File): Promise<CsvImportPreviewResponse> {
      return core.requestFormData<CsvImportPreviewResponse>("/me/transactions/import.csv", createImportFormData(file, "preview"))
    },

    async importTransactions(
      file: File,
      mode: "dry_run" | "commit",
      mapping: CsvImportMapping,
      categoryStrategy?: CsvImportCategoryStrategy,
      amountStrategy?: CsvImportAmountStrategy,
      dateStrategy?: CsvImportDateStrategy,
      tagStrategy?: CsvImportTagStrategy
    ): Promise<CsvImportResponse> {
      return core.requestFormData<CsvImportResponse>(
        "/me/transactions/import.csv",
        createImportFormData(file, mode, mapping, categoryStrategy, amountStrategy, dateStrategy, tagStrategy)
      )
    },
  }
}
