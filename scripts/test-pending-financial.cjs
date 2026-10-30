const fs = require("node:fs")
const Module = require("node:module")
const path = require("node:path")
const { webcrypto } = require("node:crypto")
const ts = require("typescript")
const assert = require("node:assert/strict")
const root = path.resolve(__dirname, "..")
const resolve = Module._resolveFilename
Module._resolveFilename = function (request, parent, isMain, options) { return resolve(request.startsWith("@/") ? path.join(root, request.slice(2)) : request, parent, isMain, options) }
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename)
global.window = { isSecureContext: true, crypto: webcrypto }
global.crypto = webcrypto
const { EncryptedFinancialAuthority } = require("../lib/privacy/encrypted-authority/authority.ts")
const { encryptSyntheticRecord } = require("../lib/privacy/encrypted-records/crypto.ts")
const { pendingMonthSummary, pendingCloseoutConflicts } = require("../lib/privacy/encrypted-authority/pending-summary.ts")
const { encryptedCloseout, encryptedMonthOverview } = require("../lib/privacy/encrypted-authority/derived.ts")
const { commitEncryptedCloseout, reopenEncryptedCloseout } = require("../lib/privacy/encrypted-authority/closeout-mutation.ts")
const { createEncryptedMonthCloseout } = require("../lib/privacy/encrypted-authority/closeout-operations.ts")

;(async () => {
  const key = await webcrypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
  let seq = 0
  async function encrypted(id, family, data) {
    const result = await encryptSyntheticRecord(key, "vault", { record_family: family, record_schema_version: `${family}_v1`, source_id: id, data }, 1, id)
    return { ...result.envelope, sync_sequence: String(++seq) }
  }
  const pending = await encrypted("rec_pending1", "pending_transaction", { captured_at: "2026-01-01T12:00:00.000Z", date: "2026-01-03", amount_cents: 250, description: null })
  const unknown = await encrypted("rec_pending2", "pending_transaction", { captured_at: "2026-01-02T12:00:00.000Z", date: "2026-01-04", amount_cents: null, description: "Coffee" })
  const feb = await encrypted("rec_pending3", "pending_transaction", { captured_at: "2026-02-01T12:00:00.000Z", date: "2026-02-02", amount_cents: 500, description: "Food" })
  const close = await encrypted("rec_close001", "month_closeout", { month: "2026-01", status: "closed" })
  const closeFeb = await encrypted("rec_close002", "month_closeout", { month: "2026-02", status: "closed" })
  let changes = [pending, unknown, feb, close, closeFeb], fail = false
  const api = { request: async (url) => {
    if (!url.includes("/sync?")) throw Error("unexpected mutation")
    if (fail && url.includes("after=1")) throw Error("sync failed")
    if (fail) return { changes: [changes[0]], next_cursor: "1", has_more: true }
    return { changes, next_cursor: String(seq), has_more: false }
  } }
  const authority = new EncryptedFinancialAuthority(api, key, "vault")
  let notifications = 0; const unsubscribe = authority.subscribe(() => { notifications++ })
  await authority.bootstrap()
  assert.equal(notifications, 1)
  assert.equal(authority.getState().transactions.length, 0)
  assert.deepEqual(pendingMonthSummary(authority.getState().pendingTransactions, "2026-01"), { month: "2026-01", count: 2, knownAmountCents: 250, unknownAmountCount: 1 })
  assert.deepEqual(pendingMonthSummary(authority.getState().pendingTransactions, "2026-03"), { month: "2026-03", count: 0, knownAmountCents: 0, unknownAmountCount: 0 })
  assert.deepEqual(pendingCloseoutConflicts(authority.getState()), [{ month: "2026-01", pendingCount: 2 }, { month: "2026-02", pendingCount: 1 }])
  const prior = authority.getState(), cursor = authority.store.getCursor()
  fail = true
  await assert.rejects(() => authority.bootstrap(), /sync failed/)
  assert.equal(authority.getState(), prior); assert.equal(authority.store.getCursor(), cursor); assert.equal(notifications, 1)
  await assert.rejects(() => commitEncryptedCloseout(authority, "2026-01", {}), /sync failed/)
  fail = false
  await assert.rejects(() => commitEncryptedCloseout(authority, "2026-01", {}), (error) => error.code === "MONTH_HAS_PENDING_TRANSACTIONS")
  await assert.rejects(() => createEncryptedMonthCloseout({ authority, isAuthenticated: true }, "2026-01", {}), (error) => error.code === "MONTH_HAS_PENDING_TRANSACTIONS")
  assert.equal(encryptedCloseout(authority.getState(), "2026-01").is_closeable, false)
  assert.equal(encryptedCloseout(authority.getState(), "2026-01").pending_count, 2)
  const budget = { id: "budget", userId: "user", effectiveMonth: "2026-01", monthlyIncomeCents: 100000, incomeSourceType: "monthly", primaryMonthlyIncomeCents: 100000, primaryHourlyRateCents: null, primaryWeeklyHoursHundredths: null, sideIncomeType: "none", sideMonthlyIncomeCents: null, sideHourlyRateCents: null, sideWeeklyHoursHundredths: null, allocationMode: "percent", needsPercentHundredths: 5000, wantsPercentHundredths: 3000, savingsPercentHundredths: 2000, needsAmountCents: null, wantsAmountCents: null, savingsAmountCents: null }
  const withBudget = { ...authority.getState(), budgets: [budget] }
  const missingOverview = encryptedMonthOverview(authority.getState(), "2026-01", "2026-01-10")
  assert.equal(missingOverview.budget.has_budget, false)
  assert.equal(missingOverview.summary.total_budget, null)
  const budgetOverview = encryptedMonthOverview(withBudget, "2026-01", "2026-01-10")
  assert.equal(budgetOverview.budget.has_budget, true)
  assert.equal(budgetOverview.budget.resolved_effective_month, "2026-01")
  assert.equal(budgetOverview.budget.is_exact_match, true)
  assert.equal(budgetOverview.summary.total_budget, "1000.00")
  assert.equal(budgetOverview.summary.total_spent, "0.00")
  assert.equal(budgetOverview.categories.find(item => item.category === "needs").remaining_amount, "500.00")
  const inheritedOverview = encryptedMonthOverview(withBudget, "2026-02", "2026-02-10")
  assert.equal(inheritedOverview.budget.has_budget, true)
  assert.equal(inheritedOverview.budget.is_exact_match, false)
  assert.equal(inheritedOverview.budget.resolved_effective_month, "2026-01")
  const spending = { id: "spend", userId: "user", date: "2026-01-04", expense: "Food", amountCents: 1500, category: "needs", isSplit: false, notes: null, source: "manual", recurringExpenseId: null, importFingerprint: null, tagId: null, contextId: null, cardId: null, isDeleted: false, createdSequence: 1 }
  const spentOverview = encryptedMonthOverview({ ...withBudget, transactions: [spending] }, "2026-01", "2026-01-10")
  assert.equal(spentOverview.summary.total_spent, "15.00")
  assert.equal(spentOverview.summary.left_this_month, "985.00")
  assert.equal(spentOverview.categories.find(item => item.category === "needs").remaining_amount, "485.00")
  assert.deepEqual(budgetOverview.summary, encryptedMonthOverview({ ...withBudget, pendingTransactions: [] }, "2026-01", "2026-01-10").summary)
  const withPending = encryptedCloseout(withBudget, "2026-01")
  const withoutPending = encryptedCloseout({ ...withBudget, pendingTransactions: [] }, "2026-01")
  assert.deepEqual(withPending.computed, withoutPending.computed, "pending amounts do not change closeout math")
  assert.equal(withPending.is_closeable, false)
  assert.equal(withoutPending.is_closeable, true)
  assert.equal(pendingMonthSummary([{ ...authority.getState().pendingTransactions[0], date: "2026-03-01" }], "2026-03").count, 1)
  const reopened = await encrypted("rec_reopen1", "month_closeout", { month: "2026-01", status: "reopened", is_reopened: true })
  changes = [pending, unknown, feb, reopened]
  await authority.bootstrap()
  assert.deepEqual(pendingCloseoutConflicts(authority.getState()), [])
  assert.equal(authority.getState().pendingTransactions.length, 3, "sync does not alter pending records")
  assert.equal(notifications, 4)
  unsubscribe()
  const records = new Map([["close", { envelope: { record_id: "close" }, family: "month_closeout", sourceId: "close", data: { id: "close", month: "2026-01", status: "closed" } }], ["entry", { envelope: { record_id: "entry" }, family: "fund_ledger_entry", sourceId: "entry", data: { source_closeout_id: "close", is_voided: false } }]])
  const fake = { store: { values: () => [...records.values()] }, commitSourceDiff: async (diff) => { for (const item of diff.updates) records.get(item.id).data = item.data }, getState: () => ({ closeouts: [], closeoutAllocations: [], budgets: [], pendingTransactions: [] }) }
  await reopenEncryptedCloseout(fake, "2026-01")
  assert.equal(records.get("entry").data.is_voided, true)
  assert.equal(records.get("close").data.status, "reopened")
  console.log("Pending financial integration tests passed")
})().catch((error) => { console.error(error); process.exitCode = 1 })
