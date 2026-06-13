import type { ApiClientCore } from "./core"
import type {
  CreateRecurringExpenseRequest,
  RecurringExpense,
  RecurringExpensesResponse,
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

    async deleteRecurringExpense(recurringExpenseId: string): Promise<void> {
      await core.request(`/me/recurring-expenses/${recurringExpenseId}`, {
        method: "DELETE",
      })
    },
  }
}
