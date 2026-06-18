import type { ApiClientCore } from "./core"
import type {
  CloseMonthRequest,
  MonthCloseoutListResponse,
  MonthCloseoutResponse,
  UpdateMonthCloseoutRequest,
} from "./types"

export function createMonthCloseoutsApi(core: ApiClientCore) {
  return {
    async getMonthCloseout(month: string): Promise<MonthCloseoutResponse> {
      return core.request<MonthCloseoutResponse>(`/me/month-closeouts/${encodeURIComponent(month)}`)
    },

    async getMonthCloseouts(filters?: {
      date_from?: string
      date_to?: string
      status?: "closed" | "reopened"
    }): Promise<MonthCloseoutListResponse> {
      const params = new URLSearchParams()

      if (filters?.date_from) {
        params.set("date_from", filters.date_from)
      }
      if (filters?.date_to) {
        params.set("date_to", filters.date_to)
      }
      if (filters?.status) {
        params.set("status", filters.status)
      }

      const query = params.toString()

      return core.request<MonthCloseoutListResponse>(`/me/month-closeouts${query ? `?${query}` : ""}`)
    },

    async closeMonth(month: string, data: CloseMonthRequest): Promise<MonthCloseoutResponse> {
      return core.request<MonthCloseoutResponse>(`/me/month-closeouts/${encodeURIComponent(month)}/close`, {
        method: "POST",
        body: JSON.stringify(data),
      })
    },

    async updateMonthCloseout(
      month: string,
      data: UpdateMonthCloseoutRequest
    ): Promise<MonthCloseoutResponse> {
      return core.request<MonthCloseoutResponse>(`/me/month-closeouts/${encodeURIComponent(month)}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      })
    },

    async reopenMonth(month: string): Promise<MonthCloseoutResponse> {
      return core.request<MonthCloseoutResponse>(`/me/month-closeouts/${encodeURIComponent(month)}/reopen`, {
        method: "POST",
        body: JSON.stringify({}),
      })
    },
  }
}
