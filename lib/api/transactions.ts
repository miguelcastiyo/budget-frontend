import type { ApiClientCore } from "./core"
import type {
  CreateTransactionRequest,
  InsightsMetricsResponse,
  MonthOverviewResponse,
  Transaction,
  TransactionFilters,
  TransactionSuggestionsResponse,
  TransactionsPage,
  UpdateTransactionRequest,
} from "./types"

const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/

function queryFromFilters(filters?: TransactionFilters): string {
  const params = new URLSearchParams()
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        params.set(key, String(value))
      }
    })
  }

  const query = params.toString()
  return query ? `?${query}` : ""
}

export function createTransactionsApi(core: ApiClientCore) {
  return {
    async getTransactions(filters?: TransactionFilters): Promise<TransactionsPage> {
      return core.request<TransactionsPage>(`/me/transactions${queryFromFilters(filters)}`)
    },

    async getTransactionSuggestions(q: string, limit = 5): Promise<TransactionSuggestionsResponse> {
      const params = new URLSearchParams({
        q,
        limit: String(limit),
      })

      return core.request<TransactionSuggestionsResponse>(`/me/transactions/suggestions?${params.toString()}`)
    },

    async createTransaction(data: CreateTransactionRequest): Promise<Transaction> {
      return core.request<Transaction>("/me/transactions", {
        method: "POST",
        body: JSON.stringify(data),
      })
    },

    async updateTransaction(transactionId: string, data: UpdateTransactionRequest): Promise<Transaction> {
      return core.request<Transaction>(`/me/transactions/${transactionId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      })
    },

    async deleteTransaction(transactionId: string): Promise<void> {
      return core.request<void>(`/me/transactions/${transactionId}`, {
        method: "DELETE",
      })
    },

    async getMonthOverview(month: string): Promise<MonthOverviewResponse> {
      if (!MONTH_KEY_PATTERN.test(month)) {
        throw new Error("Month must use YYYY-MM format.")
      }

      return core.request<MonthOverviewResponse>(`/me/months/${encodeURIComponent(month)}/overview`)
    },

    async getInsightsMetrics(dateFrom: string, dateTo: string): Promise<InsightsMetricsResponse> {
      const params = new URLSearchParams({
        date_from: dateFrom,
        date_to: dateTo,
      })

      return core.request<InsightsMetricsResponse>(`/me/metrics/insights?${params.toString()}`)
    },

    async exportTransactions(filters?: TransactionFilters): Promise<Blob> {
      return core.requestBlob(`/me/transactions/export.csv${queryFromFilters(filters)}`)
    },
  }
}
