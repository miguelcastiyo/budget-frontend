import type { CreateFundEntryRequest, FundBudgetTracking, FundEntryType, FundListItem, FundDetail } from "@/lib/api/types"
import { toIsoDate } from "@/lib/date-filters"

export type FundsFilter = "active" | "archived"
export type FundActionMode = "create" | "edit"
export type EntryActionMode = "create" | "edit"
export type EntryIntent = "add" | "use"
export type FundPresentationState = "open_ended" | "not_started" | "in_progress" | "goal_reached"
export interface FundGroup { key: string; label: string; funds: FundListItem[] }
export interface FundFormState { name: string; goal_amount: string; target_month: string; notes: string; starting_balance: string }
export interface EntryFormState { entry_date: string; entry_type: FundEntryType; amount: string; source_type: "manual" | "transaction" | "starting_balance" | "correction"; note: string; budget_tracking: FundBudgetTracking; transaction_id: string; transaction_expense: string; transaction_tag_id: string; transaction_card_id: string; transaction_notes: string }
export const fundFilterOptions: Array<{ value: FundsFilter; label: string }> = [{ value: "active", label: "Active" }, { value: "archived", label: "Archived" }]
export const budgetTrackingOptions: Array<{ value: FundBudgetTracking; label: string; helper: string }> = [{ value: "fund_only", label: "Fund only", helper: "Moves money in the fund ledger without adding budget spend." }, { value: "create_transaction", label: "Create savings transaction", helper: "Adds the fund entry and creates a real savings transaction." }, { value: "link_existing_transaction", label: "Link existing savings transaction", helper: "Attach this fund contribution to a transaction you already entered." }]
export const NO_CARD_SELECT_VALUE = "__none__"
export const monthPickerMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
export function getDefaultFundFormState(): FundFormState { return { name: "", goal_amount: "", target_month: "", notes: "", starting_balance: "" } }
export function getFundFormState(fund?: FundListItem | FundDetail | null): FundFormState { return fund ? { name: fund.name, goal_amount: fund.goal_amount ?? "", target_month: fund.target_month ?? "", notes: fund.notes ?? "", starting_balance: "" } : getDefaultFundFormState() }
export function getEntryFormState(entry?: any, intent: EntryIntent = "add"): EntryFormState { return { entry_date: entry?.entry_date ?? toIsoDate(new Date()), entry_type: entry?.entry_type ?? (intent === "use" ? "withdrawal" : "contribution"), amount: entry?.amount ?? "", source_type: entry?.source_type === "month_closeout" ? "manual" : (entry?.source_type ?? "manual"), note: entry?.note ?? "", budget_tracking: "fund_only", transaction_id: "", transaction_expense: "", transaction_tag_id: "", transaction_card_id: "", transaction_notes: "" } }
export function buildEntryPayload(values: EntryFormState, intent: EntryIntent): CreateFundEntryRequest { const isOutflow = intent === "use"; return { entry_date: values.entry_date, entry_type: isOutflow ? "withdrawal" : values.entry_type, direction: isOutflow ? "out" : "in", amount: values.amount, source_type: values.source_type, note: values.note.trim() || null, budget_tracking: isOutflow ? "fund_only" : values.budget_tracking, transaction_id: values.budget_tracking === "link_existing_transaction" ? values.transaction_id || null : null, transaction: values.budget_tracking === "create_transaction" ? { expense: values.transaction_expense.trim(), tag_id: values.transaction_tag_id, card_id: values.transaction_card_id || null, notes: values.transaction_notes.trim() || null } : null } }
