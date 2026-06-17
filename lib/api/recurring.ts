import type { ApiClientCore } from "./core"
import type {
  CreateRecurringExpenseRequest,
  RecurringExpense,
  RecurringExpensesResponse,
  RecurringExpenseSeriesResponse,
  ScheduleRecurringExpenseChangeRequest,
  ScheduleRecurringExpenseChangeResponse,
  UpdateRecurringExpenseRequest,
} from "./types"

export function createRecurringApi(core: ApiClientCore) {
  return {
    async getRecurringExpenses(month?: string): Promise<RecurringExpensesResponse> {
      const params = new URLSearchParams()
      if (month) {
        params.set("month", month)
      }
      const query = params.toString()
      return core.request<RecurringExpensesResponse>(`/me/recurring-expenses${query ? `?${query}` : ""}`)
    },

    async createRecurringExpense(data: CreateRecurringExpenseRequest): Promise<RecurringExpense> {
      return core.request<RecurringExpense>("/me/recurring-expenses", {
        method: "POST",
        body: JSON.stringify(data),
      })
    },

    async updateRecurringExpense(recurringExpenseId: string, data: UpdateRecurringExpenseRequest): Promise<RecurringExpense> {
      return core.request<RecurringExpense>(`/me/recurring-expenses/${recurringExpenseId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      })
    },

    async scheduleRecurringExpenseChange(
      recurringExpenseId: string,
      data: ScheduleRecurringExpenseChangeRequest
    ): Promise<ScheduleRecurringExpenseChangeResponse> {
      return core.request<ScheduleRecurringExpenseChangeResponse>(`/me/recurring-expenses/${recurringExpenseId}/schedule-change`, {
        method: "POST",
        body: JSON.stringify(data),
      })
    },

    async getRecurringExpenseSeries(recurringExpenseId: string): Promise<RecurringExpenseSeriesResponse> {
      return core.request<RecurringExpenseSeriesResponse>(`/me/recurring-expenses/${recurringExpenseId}/series`)
    },

    async deleteRecurringExpense(recurringExpenseId: string): Promise<void> {
      await core.request(`/me/recurring-expenses/${recurringExpenseId}`, {
        method: "DELETE",
      })
    },
  }
}
