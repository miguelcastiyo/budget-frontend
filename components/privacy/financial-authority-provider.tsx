"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { apiClient } from "@/lib/api/client"
import { EncryptedFinancialAuthority } from "@/lib/privacy/encrypted-authority"
import { VaultManager } from "@/lib/privacy/vault-manager"
import { createPassphraseWrapper, createRecoveryWrapper, generateRecoverySecret, type VaultInitializationPayload } from "@/lib/privacy/vault-crypto"
import type { TransactionFilters, Card, Context, CreateTransactionRequest, CreateFundEntryRequest, FundDetail, FundEntriesPage, FundEntry, FundsListResponse, Tag, Transaction, TransactionSuggestionsResponse, UpdateFundEntryRequest, UpdateTransactionRequest, MonthCloseoutResponse, CloseMonthRequest, UpdateMonthCloseoutRequest, ReplaceSavingsPlanRequest } from "@/lib/api/types"
import { encryptedInsights, encryptedMonthOverview, encryptedRecurring } from "@/lib/privacy/encrypted-authority/derived"
import { requireEncryptedAuthority, type EncryptedOperationDependencies } from "@/lib/privacy/encrypted-authority/authority-adapters"
import { createEncryptedTransaction, deleteEncryptedTransaction, getEncryptedTransactionSuggestions, updateEncryptedRecurringTransactionScope, updateEncryptedTransaction } from "@/lib/privacy/encrypted-authority/transaction-operations"
import { createEncryptedCard, createEncryptedContext, createEncryptedTag, deleteEncryptedCard, deleteEncryptedContext, deleteEncryptedTag, getEncryptedCards, getEncryptedContexts, getEncryptedTags, updateEncryptedCard, updateEncryptedContext, updateEncryptedTag } from "@/lib/privacy/encrypted-authority/taxonomy-operations"
import { createEncryptedFundEntry, deleteEncryptedFundEntry, getEncryptedFund, getEncryptedFundEntries, getEncryptedFunds, updateEncryptedFundEntry } from "@/lib/privacy/encrypted-authority/fund-operations"
import { createRecurringOperations } from "@/lib/privacy/encrypted-authority/recurring-operations"
import { closeEncryptedMonth, getEncryptedMonthCloseout, reopenEncryptedMonth, updateEncryptedMonthCloseout } from "@/lib/privacy/encrypted-authority/closeout-operations"
import { getEncryptedBudgetResolution, getEncryptedBudgetVersions, saveEncryptedBudget } from "@/lib/privacy/encrypted-authority/budget-operations"
import { getEncryptedSavingsPlan, replaceEncryptedSavingsPlan } from "@/lib/privacy/encrypted-authority/savings-plan-operations"
import { materializeEncryptedRecurring, type RecurringMaterializationResult } from "@/lib/privacy/encrypted-authority/recurring-mutation"
import { tagQuickPicksFromState, taxonomyFromState, transactionsPageFromState } from "@/lib/domain/financial/view-models"
import { getLocalDateKey } from "@/lib/date-filters"
import { enrollQuickUnlock as enrollQuickUnlockClient, quickUnlockCapability, unlockWithQuickUnlock as unlockWithQuickUnlockClient } from "@/lib/privacy/quick-unlock"

interface FinancialAuthorityContextValue {
  isVaultSetupRequired: boolean
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
  updateRecurringTransaction: (current: Transaction, input: UpdateTransactionRequest) => Promise<Transaction>
  deleteTransaction: (current: Transaction) => Promise<void>
  getTransactionSuggestions: (query: string, limit?: number) => Promise<TransactionSuggestionsResponse>
  getContexts: () => Promise<{ items: Context[] }>
  getTags: () => Promise<Tag[]>
  getCards: () => Promise<Card[]>
  getTransactionReferences: () => Promise<{ tags: Tag[]; quickPickTags: Tag[]; cards: Card[]; contexts: Context[] }>
  getOldestTransactionDate: () => Promise<string | null>
  getTransactionsPage: (filters: TransactionFilters, page?: number) => Promise<any>
  createTag: (input: { name: string; icon_key?: string | null }) => Promise<Tag>
  createCard: (input: { name: string }) => Promise<Card>
  createContext: (input: { name: string; icon_key?: string | null }) => Promise<Context>
  updateTag: (id: string, input: { name: string; icon_key: string | null }) => Promise<Tag>
  deleteTag: (id: string) => Promise<void>
  updateCard: (id: string, input: { name?: string; is_favorite?: boolean }) => Promise<Card>
  deleteCard: (id: string) => Promise<void>
  updateContext: (id: string, input: { name: string; icon_key: string | null }) => Promise<Context>
  deleteContext: (id: string) => Promise<void>
  createFundEntry: (fundId: string, input: CreateFundEntryRequest) => Promise<FundEntry>
  getFunds: (filters?: { status?: "active" | "archived" | "all" }) => Promise<FundsListResponse>
  updateFundEntry: (fundId: string, entry: FundEntry, input: UpdateFundEntryRequest) => Promise<FundEntry>
  deleteFundEntry: (fundId: string, entry: FundEntry) => Promise<void>
  getFund: (fundId: string) => Promise<FundDetail>
  getFundEntries: (fundId: string) => Promise<FundEntriesPage>
  getBudgetResolution: (month: string) => Promise<any>
  getBudgetVersions: () => Promise<any>
  saveBudget: (month: string, payload: Record<string, unknown>) => Promise<void>
  getMonthOverview: (month: string) => Promise<any>
  getInsightsMetrics: (from: string, to: string) => Promise<any>
  getRecurringExpenses: (month: string) => Promise<any>
  materializeRecurring: (month: string) => Promise<RecurringMaterializationResult>
  getSavingsPlan: (month: string) => Promise<any>
  createRecurringExpense: (input: Record<string, unknown>) => Promise<void>
  updateRecurringExpense: (id: string, input: Record<string, unknown>) => Promise<void>
  deleteRecurringExpense: (id: string) => Promise<void>
  scheduleRecurringExpenseChange: (id: string, input: Record<string, unknown>) => Promise<void>
  cancelRecurringExpenseChange: (currentId: string, scheduledId: string) => Promise<void>
  replaceSavingsPlan: (month: string, request: ReplaceSavingsPlanRequest) => Promise<any>
  getMonthCloseout: (month: string) => Promise<MonthCloseoutResponse>
  closeMonth: (month: string, payload: CloseMonthRequest) => Promise<MonthCloseoutResponse>
  updateMonthCloseout: (month: string, payload: UpdateMonthCloseoutRequest) => Promise<MonthCloseoutResponse>
  reopenMonth: (month: string) => Promise<MonthCloseoutResponse>
}

const FinancialAuthorityContext = createContext<FinancialAuthorityContextValue | undefined>(undefined)

function unavailableFinancialOperation(): never { throw new Error("ENCRYPTED_AUTHORITY_LOCKED") }

export function FinancialAuthorityProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [isVaultSetupRequired, setIsVaultSetupRequired] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [authority, setAuthority] = useState<EncryptedFinancialAuthority | null>(null)
  const [quickUnlockStatus, setQuickUnlockStatus] = useState<"unknown" | "not_enrolled" | "enrolled">("unknown")
  const capability = useMemo(() => quickUnlockCapability(), [])
  const vaultManager = useMemo(() => new VaultManager(), [])

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setIsVaultSetupRequired(false)
      setAuthority(null)
      setQuickUnlockStatus("unknown")
      vaultManager.lock()
      return
    }
    setIsLoading(true)
    try {
      const status = await apiClient.getPrivacyStatus()
      const setupRequired = status.financial_privacy_state !== "encrypted"
      setIsVaultSetupRequired(setupRequired)
      if (setupRequired) {
        setAuthority(null)
        setQuickUnlockStatus("unknown")
        vaultManager.lock()
      } else {
        try { setQuickUnlockStatus((await apiClient.getQuickUnlockStatus()).status) } catch { setQuickUnlockStatus("unknown") }
      }
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated, vaultManager])

  const bootstrapAuthority = useCallback(async (runtimeKey: CryptoKey, vaultId?: string) => {
    const metadata = vaultId ? null : await apiClient.getVault()
    const nextAuthority = new EncryptedFinancialAuthority(apiClient, runtimeKey, vaultId ?? metadata!.vault_id)
    try { await nextAuthority.bootstrap() } catch (error) { vaultManager.lock(); throw error }
    setAuthority(nextAuthority)
  }, [vaultManager])

  const installAuthority = useCallback(async (runtimeKey: CryptoKey) => {
    await vaultManager.installRuntimeKey(runtimeKey)
    await bootstrapAuthority(runtimeKey)
  }, [bootstrapAuthority, vaultManager])

  const unlock = useCallback(async (passphrase: string) => {
    const status = await apiClient.getPrivacyStatus()
    if (status.financial_privacy_state !== "encrypted") throw new Error("ENCRYPTED_AUTHORITY_NOT_REQUIRED")
    const metadata = await apiClient.getVault()
    const payload: VaultInitializationPayload = { crypto_profile_version: metadata.crypto_profile_version, passphrase_wrap: metadata.passphrase, recovery_wrap: metadata.recovery }
    const runtimeKey = await vaultManager.unlockWithPassphrase(passphrase, payload)
    await bootstrapAuthority(runtimeKey, metadata.vault_id)
  }, [bootstrapAuthority, vaultManager])

  const lock = useCallback(() => { vaultManager.lock(); setAuthority(null) }, [vaultManager])

  const unlockWithQuickUnlock = useCallback(async () => {
    if (isVaultSetupRequired || !capability.supported) throw new Error("QUICK_UNLOCK_UNSUPPORTED")
    await installAuthority(await unlockWithQuickUnlockClient(apiClient))
  }, [capability.supported, installAuthority, isVaultSetupRequired])

  const enrollQuickUnlock = useCallback(async () => {
    const runtimeKey = vaultManager.getRuntimeKey()
    if (!authority || !runtimeKey) throw new Error("VAULT_LOCKED")
    if (!capability.supported) throw new Error("QUICK_UNLOCK_UNSUPPORTED")
    const wrappingKey = vaultManager.getQuickUnlockWrapKey()
    if (!wrappingKey) throw new Error("QUICK_UNLOCK_REQUIRES_PASSPHRASE_UNLOCK")
    await enrollQuickUnlockClient(apiClient, wrappingKey)
    setQuickUnlockStatus("enrolled")
  }, [authority, capability.supported, vaultManager])

  const revokeQuickUnlock = useCallback(async () => {
    const status = await apiClient.getQuickUnlockStatus()
    if (status.status === "enrolled" && status.quick_unlock_id) await apiClient.revokeQuickUnlock(status.quick_unlock_id)
    setQuickUnlockStatus("not_enrolled")
  }, [])

  const changePassphrase = useCallback(async (newPassphrase: string) => {
    const wrappingKey = vaultManager.getQuickUnlockWrapKey()
    if (!authority || !vaultManager.getRuntimeKey()) throw new Error("ENCRYPTED_AUTHORITY_LOCKED")
    if (!wrappingKey) throw new Error("VAULT_PASSPHRASE_UNLOCK_REQUIRED")
    await apiClient.replacePassphraseWrapper(await createPassphraseWrapper(wrappingKey, newPassphrase))
  }, [authority, vaultManager])

  const unlockWithRecovery = useCallback(async (recoverySecret: string, newPassphrase: string) => {
    const status = await apiClient.getPrivacyStatus()
    if (status.financial_privacy_state !== "encrypted") throw new Error("ENCRYPTED_AUTHORITY_NOT_REQUIRED")
    const metadata = await apiClient.getVault()
    const payload: VaultInitializationPayload = { crypto_profile_version: metadata.crypto_profile_version, passphrase_wrap: metadata.passphrase, recovery_wrap: metadata.recovery }
    const runtimeKey = await vaultManager.unlockWithRecoverySecret(recoverySecret.trim(), payload)
    const wrappingKey = vaultManager.getQuickUnlockWrapKey()
    if (!wrappingKey) throw new Error("VAULT_PASSPHRASE_UNLOCK_REQUIRED")
    await apiClient.replacePassphraseWrapper(await createPassphraseWrapper(wrappingKey, newPassphrase))
    await bootstrapAuthority(runtimeKey, metadata.vault_id)
  }, [bootstrapAuthority, vaultManager])

  const rotateRecoverySecret = useCallback(async () => {
    if (!authority || !vaultManager.getRuntimeKey()) throw new Error("ENCRYPTED_AUTHORITY_LOCKED")
    const wrappingKey = vaultManager.getQuickUnlockWrapKey()
    if (!wrappingKey) throw new Error("VAULT_PASSPHRASE_UNLOCK_REQUIRED")
    const secret = generateRecoverySecret()
    await apiClient.replaceRecoveryWrapper(await createRecoveryWrapper(wrappingKey, secret))
    return secret
  }, [authority, vaultManager])

  const operationDeps = useMemo<EncryptedOperationDependencies | null>(() => authority ? { authority, isAuthenticated } : null, [authority, isAuthenticated])
  const runEncrypted = useCallback(<T,>(operation: (deps: EncryptedOperationDependencies) => T): T => operationDeps ? operation(operationDeps) : unavailableFinancialOperation(), [operationDeps])
  const recurring = useMemo(() => operationDeps ? createRecurringOperations(operationDeps) : null, [operationDeps])

  const transactionOperations = useMemo(() => ({
    createTransaction: (input: CreateTransactionRequest) => runEncrypted((deps) => createEncryptedTransaction(deps, input)),
    updateTransaction: (current: Transaction, input: UpdateTransactionRequest) => runEncrypted((deps) => updateEncryptedTransaction(deps, current, input)),
    updateRecurringTransaction: (current: Transaction, input: UpdateTransactionRequest) => runEncrypted((deps) => updateEncryptedRecurringTransactionScope(deps, current, input)),
    deleteTransaction: (current: Transaction) => runEncrypted((deps) => deleteEncryptedTransaction(deps, current)),
    getTransactionSuggestions: async (query: string, limit = 5) => runEncrypted((deps) => getEncryptedTransactionSuggestions(deps, query, limit)),
  }), [runEncrypted])

  const taxonomyOperations = useMemo(() => ({
    getContexts: async () => runEncrypted((deps) => getEncryptedContexts(deps)),
    getTags: async () => runEncrypted((deps) => getEncryptedTags(deps)),
    getCards: async () => runEncrypted((deps) => getEncryptedCards(deps)),
    getTransactionReferences: async () => runEncrypted((deps) => { const state = deps.authority.getState(); const references = taxonomyFromState(state); return { tags: references.tags, quickPickTags: tagQuickPicksFromState(state, 5), cards: references.cards, contexts: references.contexts } }),
    getOldestTransactionDate: async () => runEncrypted((deps) => {
      const transactions = deps.authority.getState().transactions
      return transactions.reduce<string | null>((oldest, transaction) => oldest === null || transaction.date < oldest ? transaction.date : oldest, null)
    }),
    getTransactionsPage: async (filters: TransactionFilters, page = 1) => runEncrypted((deps) => transactionsPageFromState(deps.authority.getState(), {
      from: filters.date_from,
      to: filters.date_to,
      search: filters.q,
      categories: filters.categories?.split(",") as ("needs" | "wants" | "savings")[] | undefined,
      tagIds: filters.tag_ids?.split(","),
      contextIds: filters.context_ids?.split(","),
      cardIds: filters.card_ids?.split(","),
      isSplit: filters.is_split === "split" ? true : filters.is_split === "not_split" ? false : undefined,
      page,
      pageSize: filters.page_size ?? 50,
      sort: filters.sort === "date_asc" ? "date_asc" : "date_desc",
    }, getLocalDateKey(), true)),
    createTag: (input: { name: string; icon_key?: string | null }) => runEncrypted((deps) => createEncryptedTag(deps, input)),
    createCard: (input: { name: string }) => runEncrypted((deps) => createEncryptedCard(deps, input)),
    createContext: (input: { name: string; icon_key?: string | null }) => runEncrypted((deps) => createEncryptedContext(deps, input)),
    updateTag: (id: string, input: { name: string; icon_key: string | null }) => runEncrypted((deps) => updateEncryptedTag(deps.authority, id, input)),
    deleteTag: (id: string) => runEncrypted((deps) => deleteEncryptedTag(deps.authority, id)),
    updateCard: (id: string, input: { name?: string; is_favorite?: boolean }) => runEncrypted((deps) => updateEncryptedCard(deps.authority, id, input)),
    deleteCard: (id: string) => runEncrypted((deps) => deleteEncryptedCard(deps.authority, id)),
    updateContext: (id: string, input: { name: string; icon_key: string | null }) => runEncrypted((deps) => updateEncryptedContext(deps.authority, id, input)),
    deleteContext: (id: string) => runEncrypted((deps) => deleteEncryptedContext(deps.authority, id)),
  }), [runEncrypted])

  const fundOperations = useMemo(() => ({
    createFundEntry: (fundId: string, input: CreateFundEntryRequest) => runEncrypted((deps) => createEncryptedFundEntry(deps, fundId, input)),
    getFunds: (filters?: { status?: "active" | "archived" | "all" }) => runEncrypted((deps) => getEncryptedFunds(deps, filters)),
    updateFundEntry: (fundId: string, entry: FundEntry, input: UpdateFundEntryRequest) => runEncrypted((deps) => updateEncryptedFundEntry(deps, fundId, entry, input)),
    deleteFundEntry: (fundId: string, entry: FundEntry) => runEncrypted((deps) => deleteEncryptedFundEntry(deps, fundId, entry)),
    getFund: (fundId: string) => runEncrypted((deps) => getEncryptedFund(deps, fundId)),
    getFundEntries: (fundId: string) => runEncrypted((deps) => getEncryptedFundEntries(deps, fundId)),
  }), [runEncrypted])

  const budgetOperations = useMemo(() => ({
    getBudgetResolution: async (month: string) => runEncrypted((deps) => getEncryptedBudgetResolution(deps.authority, month)),
    getBudgetVersions: async () => runEncrypted((deps) => getEncryptedBudgetVersions(deps.authority)),
    saveBudget: (month: string, payload: Record<string, unknown>) => runEncrypted((deps) => saveEncryptedBudget(deps.authority, month, payload)),
  }), [runEncrypted])

  const derivedOperations = useMemo(() => ({
    getMonthOverview: (month: string) => runEncrypted((deps) => encryptedMonthOverview(requireEncryptedAuthority(deps).getState(), month)),
    getInsightsMetrics: (from: string, to: string) => runEncrypted((deps) => encryptedInsights(requireEncryptedAuthority(deps).getState(), from, to)),
    getRecurringExpenses: (month: string) => runEncrypted((deps) => encryptedRecurring(requireEncryptedAuthority(deps).getState(), month)),
    materializeRecurring: (month: string) => runEncrypted((deps) => materializeEncryptedRecurring(requireEncryptedAuthority(deps), month)),
    getSavingsPlan: (month: string) => runEncrypted((deps) => getEncryptedSavingsPlan(deps, month)),
  }), [runEncrypted])

  const closeoutOperations = useMemo(() => ({
    getMonthCloseout: async (month: string) => runEncrypted((deps) => getEncryptedMonthCloseout(deps, month)),
    closeMonth: (month: string, payload: CloseMonthRequest) => runEncrypted((deps) => closeEncryptedMonth(deps, month, payload)),
    updateMonthCloseout: (month: string, payload: UpdateMonthCloseoutRequest) => runEncrypted((deps) => updateEncryptedMonthCloseout(deps, month, { ...payload })),
    reopenMonth: (month: string) => runEncrypted((deps) => reopenEncryptedMonth(deps, month)),
  }), [runEncrypted])

  const value = useMemo<FinancialAuthorityContextValue>(() => ({
    isVaultSetupRequired,
    isLoading,
    refresh,
    authority,
    unlock,
    unlockWithRecovery,
    changePassphrase,
    rotateRecoverySecret,
    lock,
    quickUnlockCapability: capability.supported ? "supported" : "unsupported",
    quickUnlockStatus,
    unlockWithQuickUnlock,
    enrollQuickUnlock,
    revokeQuickUnlock,
    ...transactionOperations,
    ...taxonomyOperations,
    ...fundOperations,
    ...budgetOperations,
    ...derivedOperations,
    createRecurringExpense: (input) => recurring ? recurring.create(input) : unavailableFinancialOperation(),
    updateRecurringExpense: (id, input) => recurring ? recurring.update(id, input) : unavailableFinancialOperation(),
    deleteRecurringExpense: (id) => recurring ? recurring.delete(id) : unavailableFinancialOperation(),
    scheduleRecurringExpenseChange: (id, input) => recurring ? recurring.schedule(id, input) : unavailableFinancialOperation(),
    cancelRecurringExpenseChange: (currentId, scheduledId) => recurring ? recurring.cancel(currentId, scheduledId) : unavailableFinancialOperation(),
    replaceSavingsPlan: (month, request) => runEncrypted((deps) => replaceEncryptedSavingsPlan(deps, month, request)),
    ...closeoutOperations,
  }), [authority, budgetOperations, capability.supported, changePassphrase, closeoutOperations, derivedOperations, enrollQuickUnlock, fundOperations, isLoading, isVaultSetupRequired, lock, quickUnlockStatus, refresh, recurring, rotateRecoverySecret, taxonomyOperations, transactionOperations, unlock, unlockWithQuickUnlock, unlockWithRecovery, revokeQuickUnlock])

  useEffect(() => { void refresh(); return () => { vaultManager.lock() } }, [refresh, vaultManager])

  return <FinancialAuthorityContext.Provider value={value}>{children}</FinancialAuthorityContext.Provider>
}

export function useFinancialAuthority() {
  const value = useContext(FinancialAuthorityContext)
  if (!value) throw new Error("useFinancialAuthority must be used inside FinancialAuthorityProvider")
  return value
}
