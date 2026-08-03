export type FinancialDomainErrorCode = "VALIDATION_FAILED" | "REFERENCE_NOT_FOUND" | "DUPLICATE_RECORD" | "BUDGET_VERSION_CONFLICT" | "RECURRING_EFFECTIVE_MONTH_ALREADY_MATERIALIZED" | "RECURRING_VERSION_CONFLICT" | "RECURRING_CHANGE_ALREADY_SCHEDULED" | "RECURRING_AUTHORITY_INVALID"

export class FinancialDomainError extends Error {
  constructor(public readonly code: FinancialDomainErrorCode, message: string = code, public readonly details: { field: string; message: string }[] = []) {
    super(message)
    this.name = "FinancialDomainError"
  }
}
