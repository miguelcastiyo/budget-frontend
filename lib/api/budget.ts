import type { ApiClientCore } from "./core"
import type {
  BudgetSettings,
  BudgetSettingsAmountInput,
  BudgetSettingsPercentInput,
  BudgetSettingsResolvedResponse,
  BudgetSettingsVersionsResponse,
} from "./types"

type GetBudgetSettings = {
  (): Promise<BudgetSettings>
  (month: string): Promise<BudgetSettingsResolvedResponse>
}

export function createBudgetApi(core: ApiClientCore) {
  const getBudgetSettings = (async (month?: string) => {
    if (month) {
      return core.request<BudgetSettingsResolvedResponse>(`/me/budget-settings?month=${encodeURIComponent(month)}`)
    }

    return core.request<BudgetSettings>("/me/budget-settings")
  }) as GetBudgetSettings

  return {
    getBudgetSettings,

    async getBudgetSettingsVersions(): Promise<BudgetSettingsVersionsResponse> {
      return core.request<BudgetSettingsVersionsResponse>("/me/budget-settings/versions")
    },

    async updateBudgetSettings(data: BudgetSettingsPercentInput | BudgetSettingsAmountInput): Promise<BudgetSettings> {
      return core.request<BudgetSettings>("/me/budget-settings", {
        method: "PUT",
        body: JSON.stringify(data),
      })
    },
  }
}
