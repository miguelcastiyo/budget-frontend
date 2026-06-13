import type { ApiClientCore } from "./core"
import type { CreateMasterApiKeyRequest, CreateMasterApiKeyResponse, MasterApiKeyMetadata } from "./types"

export function createApiKeysApi(core: ApiClientCore) {
  return {
    async getMasterApiKeys(): Promise<{ items: MasterApiKeyMetadata[] }> {
      return core.request<{ items: MasterApiKeyMetadata[] }>("/me/master-api-keys")
    },

    async createMasterApiKey(data: CreateMasterApiKeyRequest): Promise<CreateMasterApiKeyResponse> {
      return core.request<CreateMasterApiKeyResponse>("/me/master-api-keys", {
        method: "POST",
        body: JSON.stringify(data),
      })
    },

    async deleteMasterApiKey(apiKeyId: string): Promise<void> {
      return core.request<void>(`/me/master-api-keys/${apiKeyId}`, {
        method: "DELETE",
      })
    },
  }
}
