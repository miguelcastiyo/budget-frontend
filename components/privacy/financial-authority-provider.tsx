"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { apiClient } from "@/lib/api/client"
import { setFinancialAuthorityMode, type FinancialAuthorityMode } from "@/lib/privacy/encrypted-authority/routing"
import { EncryptedFinancialAuthority } from "@/lib/privacy/encrypted-authority"
import { VaultManager } from "@/lib/privacy/vault-manager"
import { createPassphraseWrapper, createRecoveryWrapper, generateRecoverySecret, type VaultInitializationPayload } from "@/lib/privacy/vault-crypto"
import type { Card, Context, CreateTransactionRequest, CreateFundEntryRequest, FundDetail, FundEntriesPage, FundEntry, FundListItem, FundsListResponse, Tag, Transaction, TransactionSuggestionsResponse, UpdateFundEntryRequest, UpdateTransactionRequest } from "@/lib/api/types"
import { createTransaction, updateTransaction, deleteTransaction } from "@/lib/domain/financial/transactions"
import { createEncryptedRecordId } from "@/lib/privacy/encrypted-records/crypto"
import { formatMoneyCents, parseMoneyCents } from "@/lib/domain/financial/money"
import { fundVMFromState, transactionSuggestionsFromState } from "@/lib/domain/financial/view-models"
import { ledgerBalance, sourceBreakdown, type Fund, type FundLedgerEntry } from "@/lib/domain/financial/funds"
import { transactionFundDiff, transactionFundState, type SourceRecord } from "@/lib/domain/financial/transaction-fund-diff"
import { encryptedCloseout, encryptedInsights, encryptedMonthOverview, encryptedRecurring, encryptedSavingsPlan } from "@/lib/privacy/encrypted-authority/derived"
import { createEncryptedRecurringExpense, scheduleEncryptedRecurringExpenseChange, updateEncryptedRecurringExpense } from "@/lib/privacy/encrypted-authority/recurring-commands"
import { enrollQuickUnlock as enrollQuickUnlockClient, quickUnlockCapability, unlockWithQuickUnlock as unlockWithQuickUnlockClient } from "@/lib/privacy/quick-unlock"

interface FinancialAuthorityContextValue {
  mode: FinancialAuthorityMode
  isLoading: boolean
  refresh: () => Promise<void>
  authority: EncryptedFinancialAuthority | null
  unlock: (passphrase: string) => Promise<void>
  unlockWithRecovery: (recoverySecret: string, newPassphrase: string) => Promise<void>
  changePassphrase: (newPassphrase: string) => Promise<void>
  rotateRecoverySecret: () => Promise<string>
  lock: () => void
  quickUnlockCapability: "supported" | "unsupported"
  quickUnlockStatus: "unknown" | "not_enrolled" | "enrolled"
  unlockWithQuickUnlock: () => Promise<void>
  enrollQuickUnlock: () => Promise<void>
  revokeQuickUnlock: () => Promise<void>
  createTransaction: (input: CreateTransactionRequest) => Promise<Transaction>
  updateTransaction: (current: Transaction, input: UpdateTransactionRequest) => Promise<Transaction>
  deleteTransaction: (current: Transaction) => Promise<void>
  getTransactionSuggestions: (query: string, limit?: number) => Promise<TransactionSuggestionsResponse>
  getContexts: () => Promise<{ items: Context[] }>
  createTag: (input: { name: string; icon_key?: string | null }) => Promise<Tag>
  createCard: (input: { name: string }) => Promise<Card>
  createContext: (input: { name: string; icon_key?: string | null }) => Promise<Context>
  createFundEntry: (fundId: string, input: CreateFundEntryRequest) => Promise<FundEntry>
  getFunds: (filters?: { status?: "active" | "archived" | "all" }) => Promise<FundsListResponse>
  updateFundEntry: (fundId: string, entry: FundEntry, input: UpdateFundEntryRequest) => Promise<FundEntry>
  deleteFundEntry: (fundId: string, entry: FundEntry) => Promise<void>
  getFund: (fundId: string) => Promise<FundDetail>
  getFundEntries: (fundId: string) => Promise<FundEntriesPage>
  getMonthOverview: (month: string) => Promise<any>
  getInsightsMetrics: (from: string, to: string) => Promise<any>
  getRecurringExpenses: (month: string) => Promise<any>
  getSavingsPlan: (month: string) => Promise<any>
  createRecurringExpense: (input: Record<string, unknown>) => Promise<void>
  updateRecurringExpense: (id: string, input: Record<string, unknown>) => Promise<void>
  deleteRecurringExpense: (id: string) => Promise<void>
  scheduleRecurringExpenseChange: (id: string, input: Record<string, unknown>) => Promise<void>
  replaceSavingsPlan: (month: string, request: { allocations: Array<{ fund_id: string; amount: string }> }) => Promise<any>
  getMonthCloseout: (month: string) => Promise<any>
  closeMonth: (month: string, payload: Record<string, unknown>) => Promise<any>
  updateMonthCloseout: (month: string, payload: Record<string, unknown>) => Promise<any>
  reopenMonth: (month: string) => Promise<any>
}

const FinancialAuthorityContext = createContext<FinancialAuthorityContextValue | undefined>(undefined)

export function FinancialAuthorityProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [mode, setMode] = useState<FinancialAuthorityMode>("legacy")
  const [isLoading, setIsLoading] = useState(true)
  const [authority, setAuthority] = useState<EncryptedFinancialAuthority | null>(null)
  const [quickUnlockStatus, setQuickUnlockStatus] = useState<"unknown" | "not_enrolled" | "enrolled">("unknown")
  const capability = useMemo(() => quickUnlockCapability(), [])
  const vaultManager = useMemo(() => new VaultManager(), [])

  const refresh = async () => {
    if (!isAuthenticated) { setMode("legacy"); setAuthority(null); setQuickUnlockStatus("unknown"); vaultManager.lock(); setFinancialAuthorityMode("legacy"); return }
    setIsLoading(true)
    try {
      const status = await apiClient.getPrivacyStatus()
      const next: FinancialAuthorityMode = status.financial_privacy_state === "encrypted" ? "encrypted" : status.financial_privacy_state === "vault_setup_required" ? "setup" : status.financial_privacy_state === "migration_in_progress" ? "migration" : "legacy"
      setMode(next); if (next !== "encrypted") { setAuthority(null); setQuickUnlockStatus("unknown"); vaultManager.lock() } else { try { const quick = await apiClient.getQuickUnlockStatus(); setQuickUnlockStatus(quick.status) } catch { setQuickUnlockStatus("unknown") } }; setFinancialAuthorityMode(next)
    } finally { setIsLoading(false) }
  }

  const unlock = async (passphrase: string) => {
    const status = await apiClient.getPrivacyStatus()
    if (status.financial_privacy_state !== "encrypted") throw new Error("ENCRYPTED_AUTHORITY_NOT_REQUIRED")
    const metadata = await apiClient.getVault()
    const payload: VaultInitializationPayload = { crypto_profile_version: metadata.crypto_profile_version, passphrase_wrap: metadata.passphrase, recovery_wrap: metadata.recovery }
    const runtimeKey = await vaultManager.unlockWithPassphrase(passphrase, payload)
    const nextAuthority = new EncryptedFinancialAuthority(apiClient, runtimeKey, status.financial_privacy_state === "encrypted" ? metadata.vault_id : "")
    try { await nextAuthority.bootstrap() } catch (error) { vaultManager.lock(); throw error }
    setAuthority(nextAuthority)
  }
  const lock = () => { vaultManager.lock(); setAuthority(null) }
  const installAuthority = async (runtimeKey: CryptoKey) => {
    await vaultManager.installRuntimeKey(runtimeKey)
    const metadata = await apiClient.getVault()
    const nextAuthority = new EncryptedFinancialAuthority(apiClient, runtimeKey, metadata.vault_id)
    try { await nextAuthority.bootstrap() } catch (error) { vaultManager.lock(); throw error }
    setAuthority(nextAuthority)
  }
  const unlockWithQuickUnlock = async () => {
    if (mode !== "encrypted" || !capability.supported) throw new Error("QUICK_UNLOCK_UNSUPPORTED")
    await installAuthority(await unlockWithQuickUnlockClient(apiClient))
  }
  const enrollQuickUnlock = async () => {
    const runtimeKey = vaultManager.getRuntimeKey()
    if (!authority || !runtimeKey) throw new Error("VAULT_LOCKED")
    if (!capability.supported) throw new Error("QUICK_UNLOCK_UNSUPPORTED")
    const wrappingKey = vaultManager.getQuickUnlockWrapKey()
    if (!wrappingKey) throw new Error("QUICK_UNLOCK_REQUIRES_PASSPHRASE_UNLOCK")
    await enrollQuickUnlockClient(apiClient, wrappingKey)
    setQuickUnlockStatus("enrolled")
  }
  const revokeQuickUnlock = async () => {
    const status = await apiClient.getQuickUnlockStatus()
    if (status.status === "enrolled" && status.quick_unlock_id) await apiClient.revokeQuickUnlock(status.quick_unlock_id)
    setQuickUnlockStatus("not_enrolled")
  }
  const changePassphrase = async (newPassphrase: string) => {
    const runtimeKey = vaultManager.getRuntimeKey()
    if (!authority || !runtimeKey) throw new Error("ENCRYPTED_AUTHORITY_LOCKED")
    const wrappingKey = vaultManager.getQuickUnlockWrapKey()
    if (!wrappingKey) throw new Error("VAULT_PASSPHRASE_UNLOCK_REQUIRED")
    await apiClient.replacePassphraseWrapper(await createPassphraseWrapper(wrappingKey, newPassphrase))
  }
  const unlockWithRecovery = async (recoverySecret: string, newPassphrase: string) => {
    const status = await apiClient.getPrivacyStatus()
    if (status.financial_privacy_state !== "encrypted") throw new Error("ENCRYPTED_AUTHORITY_NOT_REQUIRED")
    const metadata = await apiClient.getVault()
    const payload: VaultInitializationPayload = { crypto_profile_version: metadata.crypto_profile_version, passphrase_wrap: metadata.passphrase, recovery_wrap: metadata.recovery }
    const runtimeKey = await vaultManager.unlockWithRecoverySecret(recoverySecret.trim(), payload)
    const wrappingKey = vaultManager.getQuickUnlockWrapKey()
    if (!wrappingKey) throw new Error("VAULT_PASSPHRASE_UNLOCK_REQUIRED")
    await apiClient.replacePassphraseWrapper(await createPassphraseWrapper(wrappingKey, newPassphrase))
    const nextAuthority = new EncryptedFinancialAuthority(apiClient, runtimeKey, metadata.vault_id)
    try { await nextAuthority.bootstrap() } catch (error) { vaultManager.lock(); throw error }
    setAuthority(nextAuthority)
  }
  const rotateRecoverySecret = async () => {
    const runtimeKey = vaultManager.getRuntimeKey()
    if (!authority || !runtimeKey) throw new Error("ENCRYPTED_AUTHORITY_LOCKED")
    const wrappingKey = vaultManager.getQuickUnlockWrapKey()
    if (!wrappingKey) throw new Error("VAULT_PASSPHRASE_UNLOCK_REQUIRED")
    const secret = generateRecoverySecret()
    await apiClient.replaceRecoveryWrapper(await createRecoveryWrapper(wrappingKey, secret))
    return secret
  }
  const uiTransaction = (record: { sourceId: string; data: Record<string, unknown> }): Transaction => {
    const state = authority?.getState()
    const sameReferenceId = (left: string, right: string) => left.trim() === right.trim() || (left.split(":").pop() ?? left) === (right.split(":").pop() ?? right)
    const tagId = record.data.tag_id == null ? "" : String(record.data.tag_id)
    const contextId = record.data.context_id == null ? null : String(record.data.context_id)
    const cardId = record.data.card_id == null ? null : String(record.data.card_id)
    const tag = state?.tags.find((item) => sameReferenceId(item.id, tagId) || item.name.trim().toLocaleLowerCase() === tagId.trim().toLocaleLowerCase())
    const context = contextId == null ? null : state?.contexts.find((item) => sameReferenceId(item.id, contextId) || item.name.trim().toLocaleLowerCase() === contextId.trim().toLocaleLowerCase())
    const card = cardId == null ? null : state?.cards.find((item) => sameReferenceId(item.id, cardId) || item.name.trim().toLocaleLowerCase() === cardId.trim().toLocaleLowerCase())
    return { id: record.sourceId, date: String(record.data.date ?? record.data.transaction_date ?? ""), expense: String(record.data.expense ?? ""), amount: formatMoneyCents(Number(record.data.amount_cents ?? 0)), category: String(record.data.category ?? "needs") as Transaction["category"], is_split: record.data.is_split === true, notes: record.data.notes == null ? null : String(record.data.notes), source: String(record.data.source ?? "manual") === "import" ? "import" : "manual", recurring_expense_id: record.data.recurring_expense_id == null ? null : String(record.data.recurring_expense_id), tag: { id: tagId, name: tag?.name ?? "", icon_key: tag?.iconKey ?? null }, context: contextId == null ? null : { id: contextId, name: context?.name ?? "", icon_key: context?.iconKey ?? null }, card: cardId == null ? null : { id: cardId, name: card?.name ?? "", is_favorite: card?.isFavorite ?? false }, created_at: "", updated_at: "" }
  }
  const encryptedUserId = () => { if (!authority || !isAuthenticated) throw new Error("ENCRYPTED_AUTHORITY_LOCKED"); return "authority-user" }
  const resolveEncryptedTransactionRecord = (transaction: Transaction) => {
    if (!authority) return undefined
    return authority.store.get(transaction.id) ?? authority.store.values().find((record) => record.family === "transaction" && (
      record.sourceId === transaction.id ||
      String(record.data.id ?? "") === transaction.id ||
      record.sourceId.endsWith(`:${transaction.id}`) ||
      String(record.data.id ?? "").endsWith(`:${transaction.id}`)
    ))
  }
  const createEncryptedTransaction = async (input: CreateTransactionRequest) => {
    encryptedUserId(); const id = createEncryptedRecordId(); const record = createTransaction({ id, userId: "authority-user", date: input.date, expense: input.expense, amount: input.amount, category: input.category, isSplit: input.is_split, notes: input.notes, tagId: input.tag_id ?? null, contextId: input.context_id ?? null, cardId: input.card_id ?? null }); const data = { ...record, amount_cents: record.amountCents, is_split: record.isSplit, tag_id: record.tagId, context_id: record.contextId, card_id: record.cardId, recurring_expense_id: record.recurringExpenseId, import_fingerprint: record.importFingerprint, is_deleted: record.isDeleted }
    await authority!.commitSourceDiff(transactionFundDiff(null, transactionFundState({ id, family: "transaction", data })))
    const saved = authority!.store.get(id)!
    return uiTransaction(saved)
  }
  const updateEncryptedTransaction = async (current: Transaction, input: UpdateTransactionRequest) => {
    encryptedUserId(); const currentRecord = resolveEncryptedTransactionRecord(current); if (!currentRecord) throw new Error("ENCRYPTED_RECORD_NOT_FOUND")
    const recordId = currentRecord.envelope.record_id
    const next = updateTransaction({ id: currentRecord.sourceId, userId: "authority-user", date: current.date, expense: current.expense, amountCents: parseMoneyCents(current.amount), category: current.category, isSplit: current.is_split, notes: current.notes, source: current.source, recurringExpenseId: current.recurring_expense_id, importFingerprint: null, tagId: current.tag.id || null, contextId: current.context?.id ?? null, cardId: current.card?.id ?? null, isDeleted: false, createdSequence: 0 }, { date: input.date, expense: input.expense, amount: input.amount, category: input.category, isSplit: input.is_split, notes: input.notes, tagId: input.tag_id, contextId: input.context_id, cardId: input.card_id })
    const nextData = { ...next, amount_cents: next.amountCents, is_split: next.isSplit, tag_id: next.tagId, context_id: next.contextId, card_id: next.cardId, recurring_expense_id: next.recurringExpenseId, import_fingerprint: next.importFingerprint, is_deleted: next.isDeleted }
    await authority!.commitSourceDiff(transactionFundDiff(transactionFundState({ id: recordId, family: "transaction", data: currentRecord.data }), transactionFundState({ id: recordId, family: "transaction", data: nextData })))
    const saved = authority!.store.get(recordId)
    if (!saved) throw new Error("ENCRYPTED_AUTHORITY_STATE_INVALID")
    return uiTransaction(saved)
  }
  const deleteEncryptedTransaction = async (current: Transaction) => { encryptedUserId(); const existing = resolveEncryptedTransactionRecord(current); if (!existing) throw new Error("ENCRYPTED_RECORD_NOT_FOUND"); const recordId = existing.envelope.record_id; const ledger = authority!.getState().fundLedgerEntries.find((item) => { const source = String(item.source_transaction_id ?? ""); return source === current.id || source === existing.sourceId || source.endsWith(`:${current.id}`) || source.endsWith(`:${existing.sourceId}`) }); const ledgerRecord = ledger ? authority!.store.values().find((record) => record.family === "fund_ledger_entry" && (String(record.data.id ?? "") === String(ledger.id) || record.sourceId === String(ledger.id))) : undefined; const priorEntry: SourceRecord | null = ledgerRecord ? { id: ledgerRecord.envelope.record_id, family: "fund_ledger_entry", data: ledgerRecord.data } : null; await authority!.commitSourceDiff(transactionFundDiff(transactionFundState({ id: recordId, family: "transaction", data: existing.data }, priorEntry), transactionFundState({ id: recordId, family: "transaction", data: { ...existing.data, is_deleted: true } }, null))) }
  const createEncryptedFundEntry = async (fundId: string, input: CreateFundEntryRequest): Promise<FundEntry> => { encryptedUserId(); const id = createEncryptedRecordId(); const amountCents = parseMoneyCents(input.amount); const entryDate = input.entry_date ?? ""; const saved = await authority!.createSource("fund_ledger_entry", "fund_ledger_entry_v1", id, { id, fund_id: fundId, entry_date: entryDate, entry_type: input.entry_type, direction: input.direction, amount_cents: amountCents, source_type: input.source_type ?? "manual", source_transaction_id: input.transaction_id ?? null, source_closeout_id: null, note: input.note ?? null, is_voided: false, is_deleted: false }); return { id, fund_id: fundId, entry_date: entryDate, entry_type: input.entry_type, direction: input.direction, amount: formatMoneyCents(amountCents), source_type: input.source_type ?? "manual", source_month: null, source_transaction_id: input.transaction_id ?? null, source_closeout_id: null, note: input.note ?? null, created_at: "", updated_at: "" } }
  const getEncryptedFunds = async (filters?: { status?: "active" | "archived" | "all" }): Promise<FundsListResponse> => { encryptedUserId(); const state = authority!.getState(); const entries: FundLedgerEntry[] = state.fundLedgerEntries.map((item) => ({ id: String(item.id ?? ""), fundId: String(item.fund_id ?? ""), entryType: String(item.entry_type ?? "contribution"), direction: String(item.direction ?? "in") as FundLedgerEntry["direction"], amountCents: item.amount_cents == null ? parseMoneyCents(String(item.amount ?? "0")) : Number(item.amount_cents), sourceType: String(item.source_type ?? "manual") as FundLedgerEntry["sourceType"], sourceTransactionId: item.source_transaction_id == null ? null : String(item.source_transaction_id), sourceCloseoutId: item.source_closeout_id == null ? null : String(item.source_closeout_id), entryDate: String(item.entry_date ?? ""), isVoided: item.is_voided === true, isDeleted: item.is_deleted === true })); const funds: Fund[] = state.funds.map((item) => ({ id: String(item.id ?? ""), name: String(item.name ?? ""), fundType: String(item.fund_type ?? "other"), goalAmountCents: item.goal_amount_cents == null ? (item.goal_amount == null ? null : parseMoneyCents(String(item.goal_amount))) : Number(item.goal_amount_cents), status: String(item.status ?? "active") as Fund["status"], sortOrder: Number(item.sort_order ?? 0) })); const items: FundListItem[] = funds.filter((fund) => !filters?.status || filters.status === "all" || fund.status === filters.status).map((fund) => { const view = fundVMFromState(fund, entries); const breakdown = sourceBreakdown(entries, fund.id); const balanceCents = ledgerBalance(entries, fund.id); return { id: view.id, name: view.name, fund_type: view.fundType as FundListItem["fund_type"], goal_amount: view.goalAmount, target_month: null, notes: null, status: view.status, sort_order: view.sortOrder, current_balance: view.balance, remaining_amount: view.remaining, percent_funded: view.goalAmount === null ? null : formatMoneyCents(Math.round((balanceCents * 10000) / (fund.goalAmountCents ?? 1))), is_goal_met: view.isGoalMet, created_at: "", updated_at: "", archived_at: null, entries_count: entries.filter((entry) => entry.fundId === fund.id).length, ...breakdown } }); return { items } }
  const encryptedFundEntry = (data: Record<string, unknown>, id: string, fundId: string): FundEntry => ({ id, fund_id: fundId, entry_date: String(data.entry_date ?? ""), entry_type: String(data.entry_type ?? "contribution") as FundEntry["entry_type"], direction: String(data.direction ?? "in") as FundEntry["direction"], amount: formatMoneyCents(data.amount_cents == null ? parseMoneyCents(String(data.amount ?? "0")) : Number(data.amount_cents)), source_type: String(data.source_type ?? "manual") as FundEntry["source_type"], source_month: null, source_transaction_id: data.source_transaction_id == null ? null : String(data.source_transaction_id), source_closeout_id: data.source_closeout_id == null ? null : String(data.source_closeout_id), note: data.note == null ? null : String(data.note), created_at: "", updated_at: "" })
  const encryptedFundEntrySourceId = (data: Record<string, unknown>) => {
    const rawId = String(data.id ?? "")
    return authority!.store.values().find((record) => record.family === "fund_ledger_entry" && String(record.data.id ?? "") === rawId)?.envelope.record_id ?? rawId
  }
  const resolveFundEntryRecord = (entry: FundEntry) => authority!.store.get(entry.id) ?? authority!.store.values().find((record) => record.family === "fund_ledger_entry" && (String(record.data.id ?? "") === entry.id || record.sourceId.endsWith(`:${entry.id}`)))
  const updateEncryptedFundEntry = async (fundId: string, entry: FundEntry, input: UpdateFundEntryRequest) => { encryptedUserId(); const current = resolveFundEntryRecord(entry); if (!current) throw new Error("ENCRYPTED_RECORD_NOT_FOUND"); const data = { ...current.data, entry_date: input.entry_date ?? current.data.entry_date, entry_type: input.entry_type ?? current.data.entry_type, direction: input.direction ?? current.data.direction, amount_cents: input.amount === undefined ? current.data.amount_cents : parseMoneyCents(input.amount), note: input.note === undefined ? current.data.note : input.note }; const recordId = current.envelope.record_id; await authority!.commitSourceDiff({ creates: [], updates: [{ id: recordId, family: "fund_ledger_entry", data }], tombstones: [] }); const saved = authority!.store.get(recordId); if (!saved) throw new Error("ENCRYPTED_AUTHORITY_STATE_INVALID"); return encryptedFundEntry(saved.data, recordId, fundId) }
  const deleteEncryptedFundEntry = async (_fundId: string, entry: FundEntry) => { encryptedUserId(); const current = resolveFundEntryRecord(entry); if (!current) throw new Error("ENCRYPTED_RECORD_NOT_FOUND"); await authority!.commitSourceDiff({ creates: [], updates: [], tombstones: [{ id: current.envelope.record_id, family: "fund_ledger_entry", data: current.data }] }) }
  const getEncryptedFund = async (fundId: string): Promise<FundDetail> => { const list = await getEncryptedFunds({ status: "all" }); const item = list.items.find((fund) => fund.id === fundId); if (!item) throw new Error("FUND_NOT_FOUND"); const state = authority!.getState(); const ledgerEntries: FundLedgerEntry[] = state.fundLedgerEntries.map((raw) => ({ id: String(raw.id ?? ""), fundId: String(raw.fund_id ?? ""), entryType: String(raw.entry_type ?? "contribution"), direction: String(raw.direction ?? "in") as FundLedgerEntry["direction"], amountCents: raw.amount_cents == null ? parseMoneyCents(String(raw.amount ?? "0")) : Number(raw.amount_cents), sourceType: String(raw.source_type ?? "manual") as FundLedgerEntry["sourceType"], sourceTransactionId: raw.source_transaction_id == null ? null : String(raw.source_transaction_id), sourceCloseoutId: raw.source_closeout_id == null ? null : String(raw.source_closeout_id), entryDate: String(raw.entry_date ?? ""), isVoided: raw.is_voided === true, isDeleted: raw.is_deleted === true })); const entries = state.fundLedgerEntries.filter((raw) => String(raw.fund_id ?? "") === fundId).map((raw) => encryptedFundEntry(raw, encryptedFundEntrySourceId(raw), fundId)); return { ...item, source_breakdown: sourceBreakdown(ledgerEntries, fundId), entries_count: entries.length, recent_entries: entries } }
  const getEncryptedFundEntries = async (fundId: string): Promise<FundEntriesPage> => { const entries = authority!.getState().fundLedgerEntries.filter((raw) => String(raw.fund_id ?? "") === fundId).map((raw) => encryptedFundEntry(raw, encryptedFundEntrySourceId(raw), fundId)); return { items: entries, page: 1, page_size: entries.length, total_items: entries.length } }
  const getEncryptedContexts = async (): Promise<{ items: Context[] }> => { encryptedUserId(); return { items: authority!.getState().contexts.filter((item) => !item.isDeleted).map((item) => ({ id: item.id, name: item.name, icon_key: item.iconKey })) } }
  const createEncryptedTag = async (input: { name: string; icon_key?: string | null }): Promise<Tag> => { encryptedUserId(); const id = createEncryptedRecordId(); await authority!.createSource("taxonomy_tag", "taxonomy_tag_v1", id, { id, name: input.name, icon_key: input.icon_key ?? null, is_deleted: false }); return { id, name: input.name, icon_key: input.icon_key ?? null } }
  const createEncryptedCard = async (input: { name: string }): Promise<Card> => { encryptedUserId(); const id = createEncryptedRecordId(); await authority!.createSource("taxonomy_card", "taxonomy_card_v1", id, { id, name: input.name, is_favorite: false, is_deleted: false }); return { id, name: input.name, is_favorite: false } }
  const createEncryptedContext = async (input: { name: string; icon_key?: string | null }): Promise<Context> => { encryptedUserId(); const id = createEncryptedRecordId(); await authority!.createSource("taxonomy_context", "taxonomy_context_v1", id, { id, name: input.name, icon_key: input.icon_key ?? null, is_deleted: false }); return { id, name: input.name, icon_key: input.icon_key ?? null } }
  useEffect(() => { void refresh(); return () => { vaultManager.lock(); setFinancialAuthorityMode("legacy") } }, [isAuthenticated, vaultManager])
  const encryptedRecurringRecord = (id: string) => authority?.store.get(id) ?? authority?.store.values().find((record) => record.family === "recurring_series" && (record.sourceId === id || String(record.data.id ?? "") === id))
  const value = useMemo(() => ({ mode, isLoading, refresh, authority, unlock, lock, createTransaction: async (input: CreateTransactionRequest) => mode === "encrypted" ? createEncryptedTransaction(input) : apiClient.createTransaction(input), updateTransaction: async (current: Transaction, input: UpdateTransactionRequest) => mode === "encrypted" ? updateEncryptedTransaction(current, input) : apiClient.updateTransaction(current.id, input), deleteTransaction: async (current: Transaction) => { if (mode === "encrypted") return deleteEncryptedTransaction(current); await apiClient.deleteTransaction(current.id) }, getTransactionSuggestions: async (query: string, limit = 5) => { if (mode === "encrypted") { if (!authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED"); return transactionSuggestionsFromState(authority.getState(), query, limit) } return apiClient.getTransactionSuggestions(query, limit) }, getContexts: async () => mode === "encrypted" ? getEncryptedContexts() : apiClient.getContexts(), createTag: async (input: { name: string; icon_key?: string | null }) => mode === "encrypted" ? createEncryptedTag(input) : apiClient.createTag(input), createCard: async (input: { name: string }) => mode === "encrypted" ? createEncryptedCard(input) : apiClient.createCard(input), createContext: async (input: { name: string; icon_key?: string | null }) => mode === "encrypted" ? createEncryptedContext(input) : apiClient.createContext(input), createFundEntry: async (fundId: string, input: CreateFundEntryRequest) => mode === "encrypted" ? createEncryptedFundEntry(fundId, input) : apiClient.createFundEntry(fundId, input), getFunds: async (filters?: { status?: "active" | "archived" | "all" }) => mode === "encrypted" ? getEncryptedFunds(filters) : apiClient.getFunds(filters), getFund: async (fundId: string) => mode === "encrypted" ? getEncryptedFund(fundId) : apiClient.getFund(fundId), getFundEntries: async (fundId: string) => mode === "encrypted" ? getEncryptedFundEntries(fundId) : apiClient.getFundEntries(fundId, { page: 1, page_size: 100 }), updateFundEntry: async (fundId: string, entry: FundEntry, input: UpdateFundEntryRequest) => mode === "encrypted" ? updateEncryptedFundEntry(fundId, entry, input) : apiClient.updateFundEntry(fundId, entry.id, input), deleteFundEntry: async (fundId: string, entry: FundEntry, ) => mode === "encrypted" ? deleteEncryptedFundEntry(fundId, entry) : apiClient.deleteFundEntry(fundId, entry.id), getMonthOverview: async (month: string) => { if (mode === "encrypted") { if (!authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED"); return encryptedMonthOverview(authority.getState(), month) } return apiClient.getMonthOverview(month) }, getMonthCloseout: async (month: string) => { if (mode === "encrypted") { if (!authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED"); return encryptedCloseout(authority.getState(), month) } return apiClient.getMonthCloseout(month) }, closeMonth: async (month: string, payload: Record<string, unknown>) => { if (mode !== "encrypted") return apiClient.closeMonth(month, payload as never); if (!authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED"); const id = createEncryptedRecordId(); await authority.createSource("month_closeout", "month_closeout_v1", id, { id, month, status: "closed", ...payload }); return encryptedCloseout(authority.getState(), month) }, updateMonthCloseout: async (month: string, payload: Record<string, unknown>) => { if (mode !== "encrypted") return apiClient.updateMonthCloseout(month, payload as never); return value.closeMonth(month, payload) }, reopenMonth: async (month: string) => { if (mode !== "encrypted") return apiClient.reopenMonth(month); const saved = authority?.getState().closeouts.find((item) => String(item.month ?? "") === month); if (!saved) return encryptedCloseout(authority!.getState(), month); const record = authority!.store.values().find((item) => item.family === "month_closeout" && String(item.data.month ?? "") === month); if (record) await authority!.update(record.envelope.record_id, { ...record.data, is_reopened: true }); return encryptedCloseout(authority!.getState(), month) }, getInsightsMetrics: async (from: string, to: string) => { if (mode === "encrypted") { if (!authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED"); return encryptedInsights(authority.getState(), from, to) } return apiClient.getInsightsMetrics(from, to) }, getRecurringExpenses: async (month: string) => { if (mode === "encrypted") { if (!authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED"); return encryptedRecurring(authority.getState(), month) } return apiClient.getRecurringExpenses(month) }, getSavingsPlan: async (month: string) => { if (mode === "encrypted") { if (!authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED"); return encryptedSavingsPlan(authority.getState(), month) } return apiClient.getSavingsPlan(month) }, createRecurringExpense: async (input: Record<string, unknown>) => { if (mode !== "encrypted") return apiClient.createRecurringExpense(input as never).then(() => undefined); if (!authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED"); const id = createEncryptedRecordId(); await authority.createSource("recurring_series", "recurring_series_v1", id, { id, series_id: id, ...input, amount_cents: parseMoneyCents(String(input.amount ?? "0")), is_deleted: false }) }, updateRecurringExpense: async (id: string, input: Record<string, unknown>) => { if (mode !== "encrypted") return apiClient.updateRecurringExpense(id, input as never).then(() => undefined); const current = encryptedRecurringRecord(id); if (!current) throw new Error("ENCRYPTED_RECORD_NOT_FOUND"); await authority!.update(current.envelope.record_id, { ...current.data, ...input, amount_cents: input.amount == null ? current.data.amount_cents : parseMoneyCents(String(input.amount)) }) }, deleteRecurringExpense: async (id: string) => { if (mode !== "encrypted") return apiClient.deleteRecurringExpense(id); const current = encryptedRecurringRecord(id); if (!current) throw new Error("ENCRYPTED_RECORD_NOT_FOUND"); await authority!.commitSourceDiff({ creates: [], updates: [], tombstones: [{ id: current.envelope.record_id, family: "recurring_series", data: current.data }] }) }, scheduleRecurringExpenseChange: async (id: string, input: Record<string, unknown>) => { if (mode !== "encrypted") return apiClient.scheduleRecurringExpenseChange(id, input as never).then(() => undefined); const current = encryptedRecurringRecord(id); if (!current) throw new Error("ENCRYPTED_RECORD_NOT_FOUND"); const effective = String(input.effective_month); const nextId = createEncryptedRecordId(); const prior = { ...current.data, ends_month: effective }; const next = { ...current.data, ...input, id: nextId, series_id: current.data.series_id ?? current.data.id, starts_month: effective, ends_month: null, amount_cents: input.amount == null ? current.data.amount_cents : parseMoneyCents(String(input.amount)) }; await authority!.commitSourceDiff({ creates: [{ id: nextId, family: "recurring_series", data: next }], updates: [{ id: current.envelope.record_id, family: "recurring_series", data: prior }], tombstones: [] }) }, replaceSavingsPlan: async (month: string, request: { allocations: Array<{ fund_id: string; amount: string }> }) => { if (mode !== "encrypted") return apiClient.replaceSavingsPlan(month, request); if (!authority) throw new Error("ENCRYPTED_AUTHORITY_LOCKED"); const planId = createEncryptedRecordId(); await authority.createSource("savings_plan", "savings_plan_v1", planId, { id: planId, month, status: "active", savings_budget_cents: 0 }); for (const allocation of request.allocations) { const allocationId = createEncryptedRecordId(); await authority.createSource("savings_plan_allocation", "savings_plan_allocation_v1", allocationId, { id: allocationId, month, fund_id: allocation.fund_id, plan_id: planId, planned_amount_cents: parseMoneyCents(allocation.amount) }) } return encryptedSavingsPlan(authority.getState(), month) } }), [mode, isLoading, authority])
  const phase7Value = { ...value, createRecurringExpense: async (input: Record<string, unknown>) => mode === "encrypted" && authority ? createEncryptedRecurringExpense(authority, input) : value.createRecurringExpense(input), updateRecurringExpense: async (id: string, input: Record<string, unknown>) => mode === "encrypted" && authority ? updateEncryptedRecurringExpense(authority, id, input) : value.updateRecurringExpense(id, input), scheduleRecurringExpenseChange: async (id: string, input: Record<string, unknown>) => mode === "encrypted" && authority ? scheduleEncryptedRecurringExpenseChange(authority, id, input) : value.scheduleRecurringExpenseChange(id, input), unlockWithRecovery, changePassphrase, rotateRecoverySecret, quickUnlockCapability: capability.supported ? "supported" as const : "unsupported" as const, quickUnlockStatus, unlockWithQuickUnlock, enrollQuickUnlock, revokeQuickUnlock }
  return <FinancialAuthorityContext.Provider value={phase7Value}>{children}</FinancialAuthorityContext.Provider>
}

export function useFinancialAuthority() {
  const value = useContext(FinancialAuthorityContext)
  if (!value) throw new Error("useFinancialAuthority must be used inside FinancialAuthorityProvider")
  return value
}
