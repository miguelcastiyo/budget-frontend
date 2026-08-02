import type { ApiClientCore } from "./core"

export interface PrivacyStatus {
  financial_privacy_state: "vault_setup_required" | "encrypted"
  financial_revision: number
}

export function createPrivacyStatusApi(core: ApiClientCore) {
  return { getPrivacyStatus: () => core.request<PrivacyStatus>("/me/privacy") }
}
