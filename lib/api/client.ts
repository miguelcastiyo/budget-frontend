import { createApiKeysApi } from "./api-keys"
import { createAuthApi } from "./auth"
import { ApiClientCore, ApiError, GLOBAL_API_ERROR_EVENT } from "./core"
import { createFundsApi } from "./funds"
import { createImportExportApi } from "./import-export"
import { createMonthCloseoutsApi } from "./month-closeouts"
import { createSavingsPlanApi } from "./savings-plan"
import { createProfileApi } from "./profile"
import { createRecurringApi } from "./recurring"
import { createTaxonomyApi } from "./taxonomy"
import { createTransactionsApi } from "./transactions"
import { createVaultApi } from "./vault"
import { createEncryptedRecordsApi } from "./encrypted-records"
import { createDevicesApi } from "./devices"
import { createPrivacyStatusApi } from "./privacy-status"

const core = new ApiClientCore()

type ApiClient = ApiClientCore
  & ReturnType<typeof createAuthApi>
  & ReturnType<typeof createProfileApi>
  & ReturnType<typeof createTaxonomyApi>
  & ReturnType<typeof createRecurringApi>
  & ReturnType<typeof createFundsApi>
  & ReturnType<typeof createTransactionsApi>
  & ReturnType<typeof createImportExportApi>
  & ReturnType<typeof createMonthCloseoutsApi>
  & ReturnType<typeof createSavingsPlanApi>
  & ReturnType<typeof createApiKeysApi>
  & ReturnType<typeof createVaultApi>
  & ReturnType<typeof createEncryptedRecordsApi>
  & ReturnType<typeof createDevicesApi>
  & ReturnType<typeof createPrivacyStatusApi>

export const apiClient: ApiClient = Object.assign(
  core,
  createAuthApi(core),
  createProfileApi(core),
  createTaxonomyApi(core),
  createRecurringApi(core),
  createFundsApi(core),
  createTransactionsApi(core),
  createImportExportApi(core),
  createMonthCloseoutsApi(core),
  createSavingsPlanApi(core),
  createApiKeysApi(core),
  createVaultApi(core),
  createEncryptedRecordsApi(core),
  createDevicesApi(core),
  createPrivacyStatusApi(core)
)

export { ApiError, GLOBAL_API_ERROR_EVENT }
