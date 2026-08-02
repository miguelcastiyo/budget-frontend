import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const scanRoots = ["app", "components", "lib"]
const allowedLegacyCallers = new Set([
  "app/onboarding/page.tsx",
  "app/dev/privacy/migration-validation/migration-validation-client.tsx",
])
const legacyMethods = [
  "getBudgetSettings", "updateBudgetSettings", "getTags", "getTagQuickPicks", "createTag", "updateTag", "deleteTag",
  "getCards", "createCard", "updateCard", "deleteCard", "getContexts", "createContext", "updateContext", "deleteContext",
  "getRecurringExpenses", "createRecurringExpense", "updateRecurringExpense", "scheduleRecurringExpenseChange", "deleteRecurringExpense",
  "getTransactions", "getTransactionSuggestions", "createTransaction", "updateTransaction", "deleteTransaction", "getSavingsPlan", "replaceSavingsPlan",
  "getFunds", "createFund", "getFund", "getFundEntries", "createFundEntry", "updateFundEntry", "deleteFundEntry",
  "getMonthOverview", "getMonthCloseout", "getMonthCloseouts", "closeMonth", "updateMonthCloseout", "reopenMonth", "getInsightsMetrics",
  "exportTransactions", "previewImportTransactions", "importTransactions", "rollbackImport", "getDataRuns",
]
const legacyPattern = new RegExp(`apiClient\\.(${legacyMethods.join("|")})\\s*\\(`)

function filesUnder(directory) {
  const result = []
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const relative = path.join(directory, entry.name)
    if (entry.isDirectory()) result.push(...filesUnder(relative))
    else if (/\.(ts|tsx)$/.test(entry.name)) result.push(relative)
  }
  return result
}

const violations = []
for (const file of scanRoots.flatMap(filesUnder)) {
  const source = fs.readFileSync(path.join(root, file), "utf8")
  if (legacyPattern.test(source) && !allowedLegacyCallers.has(file)) violations.push(file)
}

const provider = fs.readFileSync(path.join(root, "components/privacy/financial-authority-provider.tsx"), "utf8")
if (legacyPattern.test(provider)) violations.push("components/privacy/financial-authority-provider.tsx")
for (const marker of ["ENCRYPTED_AUTHORITY_LOCKED", "ENCRYPTED_AUTHORITY_REQUIRED", "EncryptedFinancialAuthority"]) {
  if (!provider.includes(marker)) throw new Error(`financial authority provider is missing ${marker}`)
}

if (violations.length) {
  throw new Error(`legacy financial API call sites remain outside explicit setup/transition callers: ${violations.join(", ")}`)
}

console.log("Encrypted-only frontend financial boundary passed")

