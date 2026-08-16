import type { CreateFundEntryRequest, CreateFundRequest, FundDetail, FundEntriesPage, FundEntry, FundListItem, FundsListResponse, UpdateFundEntryRequest, UpdateFundRequest } from "@/lib/api/types"
import { formatMoneyCents, parseMoneyCents } from "@/lib/domain/financial/money"
import { getCurrentMonthKey } from "@/lib/date-filters"
import { fundVMFromState } from "@/lib/domain/financial/view-models"
import { ledgerBalance, sourceBreakdown, type Fund, type FundLedgerEntry } from "@/lib/domain/financial/funds"
import { createEncryptedRecordId } from "../encrypted-records/crypto"
import { fundEntryFromData, fundEntrySourceId, requireEncryptedAuthority, resolveFundEntryRecord, type EncryptedOperationDependencies } from "./authority-adapters"

function ledgerEntriesFromState(deps: EncryptedOperationDependencies): FundLedgerEntry[] {
  const authority = requireEncryptedAuthority(deps)
  return authority.getState().fundLedgerEntries.map((raw) => ({
    id: String(raw.id ?? ""),
    fundId: String(raw.fund_id ?? ""),
    entryType: String(raw.entry_type ?? "contribution"),
    direction: String(raw.direction ?? "in") as FundLedgerEntry["direction"],
    amountCents: raw.amount_cents == null ? parseMoneyCents(String(raw.amount ?? "0")) : Number(raw.amount_cents),
    sourceType: String(raw.source_type ?? "manual") as FundLedgerEntry["sourceType"],
    sourceTransactionId: raw.source_transaction_id == null ? null : String(raw.source_transaction_id),
    sourceCloseoutId: raw.source_closeout_id == null ? null : String(raw.source_closeout_id),
    entryDate: String(raw.entry_date ?? ""),
    isVoided: raw.is_voided === true,
    isDeleted: raw.is_deleted === true,
  }))
}

export async function createEncryptedFundEntry(deps: EncryptedOperationDependencies, fundId: string, input: CreateFundEntryRequest): Promise<FundEntry> {
  const authority = requireEncryptedAuthority(deps)
  const id = createEncryptedRecordId()
  const amountCents = parseMoneyCents(input.amount)
  const entryDate = input.entry_date ?? ""
  await authority.createSource("fund_ledger_entry", "fund_ledger_entry_v1", id, {
    id, fund_id: fundId, entry_date: entryDate, entry_type: input.entry_type, direction: input.direction,
    amount_cents: amountCents, source_type: input.source_type ?? "manual", source_transaction_id: input.transaction_id ?? null,
    source_closeout_id: null, note: input.note ?? null, is_voided: false, is_deleted: false,
  })
  return { id, fund_id: fundId, entry_date: entryDate, entry_type: input.entry_type, direction: input.direction, amount: formatMoneyCents(amountCents), source_type: input.source_type ?? "manual", source_month: null, source_transaction_id: input.transaction_id ?? null, source_closeout_id: null, note: input.note ?? null, created_at: "", updated_at: "" }
}

function fundRecord(authority: ReturnType<typeof requireEncryptedAuthority>, fundId: string) {
  return authority.store.values().find((record) => record.family === "fund" && String(record.data.id ?? record.sourceId) === fundId)
}

export async function createEncryptedFund(deps: EncryptedOperationDependencies, input: CreateFundRequest): Promise<FundListItem> {
  const authority = requireEncryptedAuthority(deps)
  const id = createEncryptedRecordId()
  const goalAmount = input.goal_amount ? parseMoneyCents(input.goal_amount) : null
  const creates: Array<{ id: string; family: string; data: Record<string, unknown> }> = [{
    id,
    family: "fund",
    data: { id, name: input.name.trim(), fund_type: "goal", goal_amount_cents: goalAmount, target_month: input.target_month ?? null, status: "active", sort_order: 0, notes: input.notes ?? null },
  }]
  const startingBalance = input.starting_balance ? parseMoneyCents(input.starting_balance) : 0
  if (startingBalance > 0) {
    const entryId = createEncryptedRecordId()
    creates.push({ id: entryId, family: "fund_ledger_entry", data: { id: entryId, fund_id: id, entry_date: `${getCurrentMonthKey()}-01`, entry_type: "contribution", direction: "in", amount_cents: startingBalance, source_type: "starting_balance", source_transaction_id: null, source_closeout_id: null, note: null, is_voided: false, is_deleted: false } })
  }
  await authority.commitSourceDiff({ creates, updates: [], tombstones: [] })
  const result = await getEncryptedFunds(deps, { status: "all" })
  const fund = result.items.find((item) => item.id === id)
  if (!fund) throw new Error("ENCRYPTED_AUTHORITY_STATE_INVALID")
  return fund
}

export async function updateEncryptedFund(deps: EncryptedOperationDependencies, fundId: string, input: UpdateFundRequest): Promise<FundListItem> {
  const authority = requireEncryptedAuthority(deps)
  const current = fundRecord(authority, fundId)
  if (!current) throw new Error("ENCRYPTED_RECORD_NOT_FOUND")
  const data = { ...current.data, name: input.name?.trim() || String(current.data.name ?? ""), goal_amount_cents: input.goal_amount ? parseMoneyCents(input.goal_amount) : null, target_month: input.target_month ?? null, notes: input.notes ?? null }
  await authority.commitSourceDiff({ creates: [], updates: [{ id: current.envelope.record_id, family: "fund", data }], tombstones: [] })
  const result = await getEncryptedFunds(deps, { status: "all" })
  const fund = result.items.find((item) => item.id === fundId)
  if (!fund) throw new Error("ENCRYPTED_AUTHORITY_STATE_INVALID")
  return fund
}

export async function setEncryptedFundStatus(deps: EncryptedOperationDependencies, fundId: string, status: "active" | "archived"): Promise<void> {
  const authority = requireEncryptedAuthority(deps)
  const current = fundRecord(authority, fundId)
  if (!current) throw new Error("ENCRYPTED_RECORD_NOT_FOUND")
  await authority.commitSourceDiff({ creates: [], updates: [{ id: current.envelope.record_id, family: "fund", data: { ...current.data, status } }], tombstones: [] })
}

export async function getEncryptedFunds(deps: EncryptedOperationDependencies, filters?: { status?: "active" | "archived" | "all" }): Promise<FundsListResponse> {
  const authority = requireEncryptedAuthority(deps)
  const state = authority.getState()
  const entries = ledgerEntriesFromState(deps)
  const funds: Fund[] = state.funds.map((item) => ({ id: String(item.id ?? ""), name: String(item.name ?? ""), fundType: String(item.fund_type ?? "other"), goalAmountCents: item.goal_amount_cents == null ? (item.goal_amount == null ? null : parseMoneyCents(String(item.goal_amount))) : Number(item.goal_amount_cents), status: String(item.status ?? "active") as Fund["status"], sortOrder: Number(item.sort_order ?? 0) }))
  const items: FundListItem[] = funds.filter((fund) => !filters?.status || filters.status === "all" || fund.status === filters.status).map((fund) => {
    const view = fundVMFromState(fund, entries)
    const breakdown = sourceBreakdown(entries, fund.id)
    const balanceCents = ledgerBalance(entries, fund.id)
    return { id: view.id, name: view.name, fund_type: view.fundType as FundListItem["fund_type"], goal_amount: view.goalAmount, target_month: null, notes: null, status: view.status, sort_order: view.sortOrder, current_balance: view.balance, remaining_amount: view.remaining, percent_funded: view.goalAmount === null ? null : formatMoneyCents(Math.round((balanceCents * 10000) / (fund.goalAmountCents ?? 1))), is_goal_met: view.isGoalMet, created_at: "", updated_at: "", archived_at: null, entries_count: entries.filter((entry) => entry.fundId === fund.id).length, ...breakdown }
  })
  return { items }
}

export async function updateEncryptedFundEntry(deps: EncryptedOperationDependencies, fundId: string, entry: FundEntry, input: UpdateFundEntryRequest): Promise<FundEntry> {
  const authority = requireEncryptedAuthority(deps)
  const current = resolveFundEntryRecord(authority, entry)
  if (!current) throw new Error("ENCRYPTED_RECORD_NOT_FOUND")
  const data = { ...current.data, entry_date: input.entry_date ?? current.data.entry_date, entry_type: input.entry_type ?? current.data.entry_type, direction: input.direction ?? current.data.direction, amount_cents: input.amount === undefined ? current.data.amount_cents : parseMoneyCents(input.amount), note: input.note === undefined ? current.data.note : input.note }
  const recordId = current.envelope.record_id
  await authority.commitSourceDiff({ creates: [], updates: [{ id: recordId, family: "fund_ledger_entry", data }], tombstones: [] })
  const saved = authority.store.get(recordId)
  if (!saved) throw new Error("ENCRYPTED_AUTHORITY_STATE_INVALID")
  return fundEntryFromData(saved.data, recordId, fundId)
}

export async function deleteEncryptedFundEntry(deps: EncryptedOperationDependencies, _fundId: string, entry: FundEntry): Promise<void> {
  const authority = requireEncryptedAuthority(deps)
  const current = resolveFundEntryRecord(authority, entry)
  if (!current) throw new Error("ENCRYPTED_RECORD_NOT_FOUND")
  await authority.commitSourceDiff({ creates: [], updates: [], tombstones: [{ id: current.envelope.record_id, family: "fund_ledger_entry", data: current.data }] })
}

export async function getEncryptedFund(deps: EncryptedOperationDependencies, fundId: string): Promise<FundDetail> {
  const authority = requireEncryptedAuthority(deps)
  const list = await getEncryptedFunds(deps, { status: "all" })
  const item = list.items.find((fund) => fund.id === fundId)
  if (!item) throw new Error("FUND_NOT_FOUND")
  const state = authority.getState()
  const ledgerEntries = ledgerEntriesFromState(deps)
  const entries = state.fundLedgerEntries.filter((raw) => String(raw.fund_id ?? "") === fundId).map((raw) => fundEntryFromData(raw, fundEntrySourceId(authority, raw), fundId))
  return { ...item, source_breakdown: sourceBreakdown(ledgerEntries, fundId), entries_count: entries.length, recent_entries: entries }
}

export async function getEncryptedFundEntries(deps: EncryptedOperationDependencies, fundId: string): Promise<FundEntriesPage> {
  const authority = requireEncryptedAuthority(deps)
  const entries = authority.getState().fundLedgerEntries.filter((raw) => String(raw.fund_id ?? "") === fundId).map((raw) => fundEntryFromData(raw, fundEntrySourceId(authority, raw), fundId))
  return { items: entries, page: 1, page_size: entries.length, total_items: entries.length }
}
