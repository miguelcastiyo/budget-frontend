export type FinancialAuthorityMode = "setup" | "encrypted"

let mode: FinancialAuthorityMode = "setup"

export function setFinancialAuthorityMode(next: FinancialAuthorityMode) { mode = next }
export function getFinancialAuthorityMode() { return mode }
