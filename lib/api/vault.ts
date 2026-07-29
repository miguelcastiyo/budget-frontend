import type { VaultMetadata } from "./types"
import type { ApiClientCore } from "./core"
import type { VaultInitializationPayload } from "../privacy/vault-crypto"

export function createVaultApi(core: ApiClientCore) {
  return {
    getVault: () => core.request<VaultMetadata>("/me/vault"),
    initializeVault: (payload: VaultInitializationPayload) => core.request<VaultMetadata>("/me/vault", { method: "POST", body: JSON.stringify(payload) }),
    replacePassphraseWrapper: (passphrase_wrap: VaultInitializationPayload["passphrase_wrap"]) => core.request<VaultMetadata>("/me/vault/passphrase", { method: "PUT", body: JSON.stringify({ passphrase_wrap }) }),
    replaceRecoveryWrapper: (recovery_wrap: VaultInitializationPayload["recovery_wrap"]) => core.request<VaultMetadata>("/me/vault/recovery", { method: "PUT", body: JSON.stringify({ recovery_wrap }) }),
    getQuickUnlockRegistrationOptions: (prf_input: string) => core.request<Record<string, unknown>>("/me/vault/quick-unlock/registration/options", { method: "POST", body: JSON.stringify({ prf_input }) }),
    completeQuickUnlockRegistration: (payload: Record<string, unknown>) => core.request<Record<string, unknown>>("/me/vault/quick-unlock/registration/complete", { method: "POST", body: JSON.stringify(payload) }),
    getQuickUnlockAssertionOptions: () => core.request<Record<string, unknown>>("/me/vault/quick-unlock/assertion/options", { method: "POST", body: "{}" }),
    getQuickUnlockStatus: () => core.request<{ status: "enrolled" | "not_enrolled"; quick_unlock_id: string | null; profile_version: 1 }>("/me/vault/quick-unlock"),
    completeQuickUnlockAssertion: (payload: Record<string, unknown>) => core.request<Record<string, unknown>>("/me/vault/quick-unlock/assertion/complete", { method: "POST", body: JSON.stringify(payload) }),
    revokeQuickUnlock: (quickUnlockId: string) => core.request<void>(`/me/vault/quick-unlock/${encodeURIComponent(quickUnlockId)}`, { method: "DELETE" }),
  }
}
