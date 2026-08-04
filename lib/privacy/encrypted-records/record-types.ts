import type { EncryptedRecordEnvelope } from "./types"

export type EncryptedRecordFamily =
  | "transaction"
  | "taxonomy_tag"
  | "taxonomy_card"
  | "taxonomy_context"
  | "budget_version"
  | "recurring_series"
  | "recurring_occurrence"
  | "fund"
  | "fund_ledger_entry"
  | "savings_plan"
  | "savings_plan_allocation"
  | "month_closeout"
  | "closeout_allocation"
  | "import_run"

export type RecordData = Record<string, unknown>

type CommonRecordData = RecordData & { id?: string; user_id?: string; is_deleted?: boolean }
export type TransactionRecordData = CommonRecordData & { date?: string; expense?: string; amount_cents?: number; category?: string; is_split?: boolean; notes?: string | null; source?: string; recurring_expense_id?: string | null; tag_id?: string | null; context_id?: string | null; card_id?: string | null }
export type TaxonomyRecordData = CommonRecordData & { name?: string; icon_key?: string | null; is_favorite?: boolean }
export type BudgetRecordData = CommonRecordData & { effective_month?: string; monthly_income_cents?: number }
export type RecurringSeriesRecordData = CommonRecordData & { series_id?: string; expense?: string; amount_cents?: number; category?: string; billing_type?: string; billing_day?: number | null; starts_month?: string; ends_month?: string | null; is_active?: boolean }
export type RecurringOccurrenceRecordData = CommonRecordData & { recurring_expense_id?: string | null; occurrence_month?: string; due_date?: string; transaction_id?: string | null }
export type FundRecordData = CommonRecordData & { name?: string; fund_type?: string; goal_amount_cents?: number | null; status?: string; sort_order?: number }
export type FundLedgerRecordData = CommonRecordData & { fund_id?: string; entry_type?: string; direction?: string; amount_cents?: number; source_type?: string; source_transaction_id?: string | null; source_closeout_id?: string | null; entry_date?: string; is_voided?: boolean }
export type SavingsPlanRecordData = CommonRecordData & { month?: string; status?: string; savings_budget_cents?: number }
export type SavingsAllocationRecordData = CommonRecordData & { plan_id?: string; month?: string; fund_id?: string; planned_amount_cents?: number }
export type CloseoutRecordData = CommonRecordData & { month?: string; status?: string }
export type CloseoutAllocationRecordData = CommonRecordData & { closeout_id?: string; fund_id?: string; amount_cents?: number }
export type ImportRunRecordData = CommonRecordData & { status?: string; source_filename?: string; total_rows?: number }

export interface RecordDataByFamily {
  transaction: TransactionRecordData
  taxonomy_tag: TaxonomyRecordData
  taxonomy_card: TaxonomyRecordData
  taxonomy_context: TaxonomyRecordData
  budget_version: BudgetRecordData
  recurring_series: RecurringSeriesRecordData
  recurring_occurrence: RecurringOccurrenceRecordData
  fund: FundRecordData
  fund_ledger_entry: FundLedgerRecordData
  savings_plan: SavingsPlanRecordData
  savings_plan_allocation: SavingsAllocationRecordData
  month_closeout: CloseoutRecordData
  closeout_allocation: CloseoutAllocationRecordData
  import_run: ImportRunRecordData
}

export type TypedRecordData<F extends EncryptedRecordFamily = EncryptedRecordFamily> = RecordDataByFamily[F]

export type TypedEncryptedRecord<F extends EncryptedRecordFamily = EncryptedRecordFamily> = {
  envelope: EncryptedRecordEnvelope
  family: F
  schemaVersion: string
  sourceId: string
  data: TypedRecordData<F>
}

export type TypedEncryptedRecordPayload<F extends EncryptedRecordFamily = EncryptedRecordFamily> = {
  record_family: F
  record_schema_version: string
  source_id: string
  data: TypedRecordData<F>
}

export type EncryptedRecordMutationData = {
  family: EncryptedRecordFamily
  id: string
  data: RecordData
}
