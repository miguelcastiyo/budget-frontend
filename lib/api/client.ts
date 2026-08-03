import { createAuthApi } from "./auth"
import { ApiClientCore, ApiError, GLOBAL_API_ERROR_EVENT, GLOBAL_AUTH_ERROR_EVENT } from "./core"
import { createProfileApi } from "./profile"
import { createVaultApi } from "./vault"
import { createEncryptedRecordsApi } from "./encrypted-records"
import { createDevicesApi } from "./devices"
import { createPrivacyStatusApi } from "./privacy-status"

const core = new ApiClientCore()

type ApiClient = ApiClientCore
  & ReturnType<typeof createAuthApi>
  & ReturnType<typeof createProfileApi>
  & ReturnType<typeof createVaultApi>
  & ReturnType<typeof createEncryptedRecordsApi>
  & ReturnType<typeof createDevicesApi>
  & ReturnType<typeof createPrivacyStatusApi>

export const apiClient: ApiClient = Object.assign(
  core,
  createAuthApi(core),
  createProfileApi(core),
  createVaultApi(core),
  createEncryptedRecordsApi(core),
  createDevicesApi(core),
  createPrivacyStatusApi(core)
)

export { ApiError, GLOBAL_API_ERROR_EVENT, GLOBAL_AUTH_ERROR_EVENT }
