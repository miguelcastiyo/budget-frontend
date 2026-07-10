import type { ApiClientCore } from "./core"
import type {
  CreateFundEntryRequest,
  CreateFundRequest,
  FundCloseoutSummaryResponse,
  FundDetail,
  FundEntriesPage,
  FundEntry,
  FundsListResponse,
  UpdateFundEntryRequest,
  UpdateFundRequest,
} from "./types"

export function createFundsApi(core: ApiClientCore) {
  return {
    async getFunds(filters?: {
      status?: "active" | "archived" | "all"
      include_entries_summary?: boolean
    }): Promise<FundsListResponse> {
      const params = new URLSearchParams()

      if (filters?.status) {
        params.set("status", filters.status)
      }
      if (typeof filters?.include_entries_summary === "boolean") {
        params.set("include_entries_summary", String(filters.include_entries_summary))
      }

      const query = params.toString()
      return core.request<FundsListResponse>(`/me/funds${query ? `?${query}` : ""}`)
    },

    async createFund(data: CreateFundRequest): Promise<FundDetail> {
      return core.request<FundDetail>("/me/funds", {
        method: "POST",
        body: JSON.stringify(data),
      })
    },

    async getFund(fundId: string): Promise<FundDetail> {
      return core.request<FundDetail>(`/me/funds/${encodeURIComponent(fundId)}`)
    },

    async updateFund(fundId: string, data: UpdateFundRequest): Promise<FundDetail> {
      return core.request<FundDetail>(`/me/funds/${encodeURIComponent(fundId)}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      })
    },

    async archiveFund(fundId: string): Promise<FundDetail> {
      return core.request<FundDetail>(`/me/funds/${encodeURIComponent(fundId)}/archive`, {
        method: "POST",
        body: JSON.stringify({}),
      })
    },

    async restoreFund(fundId: string): Promise<FundDetail> {
      return core.request<FundDetail>(`/me/funds/${encodeURIComponent(fundId)}/restore`, {
        method: "POST",
        body: JSON.stringify({}),
      })
    },

    async getFundEntries(
      fundId: string,
      filters?: {
        page?: number
        page_size?: number
        source_type?: "manual" | "transaction" | "month_closeout" | "starting_balance" | "correction"
        entry_type?: "contribution" | "withdrawal" | "adjustment" | "starting_balance"
        date_from?: string
        date_to?: string
      }
    ): Promise<FundEntriesPage> {
      const params = new URLSearchParams()

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) {
            params.set(key, String(value))
          }
        })
      }

      const query = params.toString()
      return core.request<FundEntriesPage>(
        `/me/funds/${encodeURIComponent(fundId)}/entries${query ? `?${query}` : ""}`
      )
    },

    async createFundEntry(fundId: string, data: CreateFundEntryRequest): Promise<FundEntry> {
      return core.request<FundEntry>(`/me/funds/${encodeURIComponent(fundId)}/entries`, {
        method: "POST",
        body: JSON.stringify(data),
      })
    },

    async updateFundEntry(
      fundId: string,
      entryId: string,
      data: UpdateFundEntryRequest
    ): Promise<FundEntry> {
      return core.request<FundEntry>(
        `/me/funds/${encodeURIComponent(fundId)}/entries/${encodeURIComponent(entryId)}`,
        {
          method: "PATCH",
          body: JSON.stringify(data),
        }
      )
    },

    async deleteFundEntry(fundId: string, entryId: string): Promise<void> {
      return core.request<void>(
        `/me/funds/${encodeURIComponent(fundId)}/entries/${encodeURIComponent(entryId)}`,
        {
          method: "DELETE",
        }
      )
    },

    async getFundCloseoutSummary(year: number): Promise<FundCloseoutSummaryResponse> {
      const params = new URLSearchParams({
        year: String(year),
      })

      return core.request<FundCloseoutSummaryResponse>(`/me/funds/closeout-summary?${params.toString()}`)
    },
  }
}
