import type { ApiClientCore } from "./core"
import type { ReplaceSavingsPlanRequest, SavingsPlanResponse } from "./types"

export function createSavingsPlanApi(core: ApiClientCore) {
  return {
    async getSavingsPlan(month: string): Promise<SavingsPlanResponse> {
      return core.request<SavingsPlanResponse>(`/me/months/${encodeURIComponent(month)}/savings-plan`)
    },

    async replaceSavingsPlan(month: string, data: ReplaceSavingsPlanRequest): Promise<SavingsPlanResponse> {
      return core.request<SavingsPlanResponse>(`/me/months/${encodeURIComponent(month)}/savings-plan`, {
        method: "PUT",
        body: JSON.stringify(data),
      })
    },
  }
}
