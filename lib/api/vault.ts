import type { VaultMetadata } from "./types"
import type { ApiClientCore } from "./core"
import type { VaultInitializationPayload } from "../privacy/vault-crypto"

export function createVaultApi(core: ApiClientCore) {
  return {
    getVault: () => core.request<VaultMetadata>("/me/vault"),
    initializeVault: (payload: VaultInitializationPayload) => core.request<VaultMetadata>("/me/vault", { method: "POST", body: JSON.stringify(payload) }),
    replacePassphraseWrapper: (passphrase_wrap: VaultInitializationPayload["passphrase_wrap"]) => core.request<VaultMetadata>("/me/vault/passphrase", { method: "PUT", body: JSON.stringify({ passphrase_wrap }) }),
    replaceRecoveryWrapper: (recovery_wrap: VaultInitializationPayload["recovery_wrap"]) => core.request<VaultMetadata>("/me/vault/recovery", { method: "PUT", body: JSON.stringify({ recovery_wrap }) }),
  }
}
