import { createApiKeysApi } from "./api-keys"
import { createAuthApi } from "./auth"
import { createBudgetApi } from "./budget"
import { ApiClientCore, ApiError, GLOBAL_API_ERROR_EVENT } from "./core"
import { createFundsApi } from "./funds"
import { createImportExportApi } from "./import-export"
import { createMonthCloseoutsApi } from "./month-closeouts"
import { createProfileApi } from "./profile"
import { createRecurringApi } from "./recurring"
import { createTaxonomyApi } from "./taxonomy"
import { createTransactionsApi } from "./transactions"

const core = new ApiClientCore()

type ApiClient = ApiClientCore
  & ReturnType<typeof createAuthApi>
  & ReturnType<typeof createProfileApi>
  & ReturnType<typeof createTaxonomyApi>
  & ReturnType<typeof createRecurringApi>
  & ReturnType<typeof createBudgetApi>
  & ReturnType<typeof createFundsApi>
  & ReturnType<typeof createTransactionsApi>
  & ReturnType<typeof createImportExportApi>
  & ReturnType<typeof createMonthCloseoutsApi>
  & ReturnType<typeof createApiKeysApi>

export const apiClient: ApiClient = Object.assign(
  core,
  createAuthApi(core),
  createProfileApi(core),
  createTaxonomyApi(core),
  createRecurringApi(core),
  createBudgetApi(core),
  createFundsApi(core),
  createTransactionsApi(core),
  createImportExportApi(core),
  createMonthCloseoutsApi(core),
  createApiKeysApi(core)
)

export { ApiError, GLOBAL_API_ERROR_EVENT }
