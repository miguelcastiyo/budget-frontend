export type FinancialDomainErrorCode = "VALIDATION_FAILED" | "REFERENCE_NOT_FOUND" | "DUPLICATE_RECORD" | "BUDGET_VERSION_CONFLICT"

export class FinancialDomainError extends Error {
  constructor(public readonly code: FinancialDomainErrorCode, message: string = code, public readonly details: { field: string; message: string }[] = []) {
    super(message)
    this.name = "FinancialDomainError"
  }
}
