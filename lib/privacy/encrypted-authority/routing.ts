import { ApiError } from "../..//api/core"

export type FinancialAuthorityMode = "setup" | "legacy" | "migration" | "encrypted"

let mode: FinancialAuthorityMode = "legacy"

export function setFinancialAuthorityMode(next: FinancialAuthorityMode) { mode = next }
export function getFinancialAuthorityMode() { return mode }

const legacyMutationPrefixes = [
  "/me/transactions",
  "/me/recurring-expenses",
  "/me/funds",
  "/me/months/",
  "/me/month-closeouts",
  "/me/imports",
  "/me/transactions/import.csv",
  "/me/budget-settings",
  "/me/tags",
  "/me/cards",
  "/me/contexts",
]

export function assertLegacyMutationAllowed(endpoint: string, method: string) {
  if ((mode !== "encrypted" && mode !== "setup") || method === "GET" || method === "HEAD") return
  const path = endpoint.split("?", 1)[0]
  if (!legacyMutationPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return
  if (mode === "setup") throw new ApiError(409, { code: "VAULT_SETUP_REQUIRED", message: "Complete Vault setup before using financial features" })
  throw new ApiError(409, { code: "ENCRYPTED_AUTHORITY_REQUIRED", message: "Encrypted financial accounts must use the encrypted authority" })
}
