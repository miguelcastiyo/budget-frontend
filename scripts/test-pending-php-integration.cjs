// Isolated parity test only. The guard is removed from the in-memory test module;
// production source and builds are unchanged. Never point this harness at real data.
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module"), assert = require("node:assert/strict")
const { webcrypto, randomBytes } = require("node:crypto")
const { execFileSync } = require("node:child_process")
const ts = require("typescript")
const root = path.resolve(__dirname, ".."), backend = path.resolve(root, "../budget-backend")
const dsn = process.env.DB_DSN || ""
if (process.env.PRIVACY_PARITY_TEST !== "1" || !/host=127\.0\.0\.1;port=33317;dbname=budget_privacy_parity_test(?:;|$)/.test(dsn) || process.env.PENDING_TEST_URL !== "http://127.0.0.1:18137") throw Error("isolated test database and local API required")
const resolution = Module._resolveFilename
Module._resolveFilename = function (request, parent, isMain, options) { return resolution(request.startsWith("@/") ? path.join(root, request.slice(2)) : request, parent, isMain, options) }
require.extensions[".ts"] = (module, filename) => {
  let source = fs.readFileSync(filename, "utf8")
  if (filename.endsWith("/encrypted-authority/authority.ts")) {
    const guard = / {4}if \(!pendingDevelopmentEnabled\(\) && \[\.\.\.diff\.creates, \.\.\.diff\.updates, \.\.\.diff\.tombstones\]\.some\(\(record\) => record\.family === "pending_transaction" \|\| this\.store\.get\(record\.id\)\?\.family === "pending_transaction"\)\) throw new Error\("PENDING_TRANSACTION_WRITES_DISABLED"\)\n/g
    const matches = source.match(guard) || []
    assert.equal(matches.length, 2, "expected guarded production implementation")
    source = source.replace(guard, "")
  }
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename)
}
global.window = { isSecureContext: true, crypto: webcrypto }; global.crypto = webcrypto
const { EncryptedFinancialAuthority } = require("../lib/privacy/encrypted-authority/authority.ts")
const { PendingReviewSession, reconcilePendingFinalization } = require("../lib/privacy/encrypted-authority/pending-lifecycle.ts")
const { createEncryptedRecordId } = require("../lib/privacy/encrypted-records/crypto.ts")
const { pendingCloseoutConflicts } = require("../lib/privacy/encrypted-authority/pending-summary.ts")
const { commitEncryptedCloseout } = require("../lib/privacy/encrypted-authority/closeout-mutation.ts")
const { createEncryptedTransaction, updateEncryptedTransaction, deleteEncryptedTransaction } = require("../lib/privacy/encrypted-authority/transaction-operations.ts")
const env = { ...process.env, ENCRYPTED_DEFAULT_BROWSER_SUFFIX: randomBytes(10).toString("hex") }
const account = JSON.parse(execFileSync("php", ["scripts/seed_encrypted_default_browser_account.php"], { cwd: backend, env, encoding: "utf8" }))
execFileSync("php", ["scripts/pending-php-test-helper.php"], { cwd: root, env: { ...env, TEST_USER_ID: String(account.user_id) } })
const bodies = [], batchResults = []; let dropNext = false
const api = { request: async (route, options = {}) => {
  const response = await fetch(`${process.env.PENDING_TEST_URL}/api/v1${route}`, { ...options, headers: { "Content-Type": "application/json", Cookie: `sid=${account.session_token}`, "X-CSRF-Token": account.csrf_token } })
  const result = await response.json()
  if (!response.ok) throw Error(`${response.status}:${JSON.stringify(result)}`)
  if (route.endsWith("/batch")) { bodies.push(options.body); batchResults.push(result); if (dropNext) { dropNext = false; throw Error("simulated lost response") } }
  return result
} }
function pendingData(p) { return { id: p.id, captured_at: p.capturedAt, date: p.date, amount_cents: p.amountCents, description: p.description, category: p.category, tag_id: p.tagId, card_id: p.cardId, context_id: p.contextId, is_split: p.isSplit, notes: p.notes } }
;(async () => {
  const key = await webcrypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
  const a = new EncryptedFinancialAuthority(api, key, `vault_phase35_${account.user_id}`), b = new EncryptedFinancialAuthority(api, key, `vault_phase35_${account.user_id}`)
  const dep = (authority) => ({ authority, isAuthenticated: true })
  await a.bootstrap(); await b.bootstrap()
  const tag = createEncryptedRecordId()
  await a.commitSourceDiff({ creates: [{ id: tag, family: "taxonomy_tag", data: { id: tag, name: "PHASE35_SECRET_TAG" } }], updates: [], tombstones: [] })
  const id = createEncryptedRecordId(), id2 = createEncryptedRecordId(), capturedAt = "2026-01-01T12:00:00.000Z"
  const base = { capturedAt, date: "2025-01-03", category: null, tagId: null, cardId: null, contextId: null, isSplit: null, notes: null }
  const amount = { ...base, id, amountCents: 1250, description: null }, description = { ...base, id: id2, amountCents: null, description: "PHASE35_SECRET_DESCRIPTION" }
  const prepared = await a.prepareSourceDiff({ creates: [amount, description].map((p) => ({ id: p.id, family: "pending_transaction", data: pendingData(p) })), updates: [], tombstones: [] })
  dropNext = true; await assert.rejects(() => a.submitPreparedSourceDiff(prepared), /simulated lost response/)
  await a.submitPreparedSourceDiff(prepared); assert.equal(bodies.at(-1), bodies.at(-2)); assert.equal(batchResults.at(-1).idempotent, true)
  await b.bootstrap(); assert.equal(b.getState().pendingTransactions.length, 2)
  assert.equal(b.getState().pendingTransactions.find((p) => p.id === id).amountCents, 1250)
  assert.equal(b.getState().pendingTransactions.find((p) => p.id === id2).amountCents, null)
  const prior = b.store.get(id); await a.bootstrap()
  const completed = { ...amount, description: "PHASE35_SECRET_MERCHANT", category: "wants", tagId: tag, notes: "PHASE35_SECRET_NOTE" }
  await a.commitSourceDiff({ creates: [], updates: [{ id, family: "pending_transaction", data: pendingData(completed) }], tombstones: [] })
  const stale = await b.prepareSourceDiff({ creates: [], updates: [{ id, family: "pending_transaction", data: pendingData(completed) }], tombstones: [] }, undefined, { expectedRevisionOverrides: { [id]: prior.envelope.record_revision } })
  await assert.rejects(() => b.submitPreparedSourceDiff(stale), /409/)
  await b.bootstrap(); assert.equal(b.getState().pendingTransactions.find((p) => p.id === id).description, "PHASE35_SECRET_MERCHANT")
  const session = new PendingReviewSession(dep(a)); const plan = await session.prepareFinalization(id)
  const competingSession = new PendingReviewSession(dep(b)); const competingPlan = await competingSession.prepareFinalization(id)
  const fund = createEncryptedRecordId(), ledger = createEncryptedRecordId()
  await b.commitSourceDiff({ creates: [{ id: fund, family: "fund", data: { id: fund, name: "PHASE35_SECRET_FUND", fund_type: "goal", status: "active" } }, { id: ledger, family: "fund_ledger_entry", data: { id: ledger, fund_id: fund, source_transaction_id: plan.transactionId, source_type: "transaction", amount_cents: 1250, direction: "in", entry_type: "contribution", entry_date: "2025-01-03" } }], updates: [], tombstones: [] })
  await a.bootstrap()
  dropNext = true; await assert.rejects(() => session.finalizePendingTransaction(plan), /simulated lost response/)
  await session.finalizePendingTransaction(plan); assert.equal(bodies.at(-1), bodies.at(-2)); assert.equal(batchResults.at(-1).idempotent, true)
  await assert.rejects(() => competingSession.finalizePendingTransaction(competingPlan), /409/)
  await b.bootstrap(); assert.equal(b.store.get(id), undefined); assert.equal(b.store.get(plan.transactionId).sourceId, plan.transactionId)
  assert.equal(await reconcilePendingFinalization(dep(b), id), "finalized")
  await assert.rejects(() => new PendingReviewSession(dep(b)).prepareFinalization(id), /PENDING_TRANSACTION_NOT_FOUND/)
  const undo = await session.prepareUndo(); await session.undo(undo); await b.bootstrap()
  assert.equal(b.store.get(plan.transactionId), undefined)
  assert.equal(b.store.get(ledger), undefined, "Undo atomically removes linked Fund entry")
  const restored = b.getState().pendingTransactions.find((p) => p.description === "PHASE35_SECRET_MERCHANT")
  assert.ok(restored && restored.id !== id && restored.capturedAt === capturedAt && restored.notes === completed.notes)
  await assert.rejects(() => commitEncryptedCloseout(a, "2025-01", {}), (error) => error.code === "MONTH_HAS_PENDING_TRANSACTIONS")
  const closeId = createEncryptedRecordId(); await a.commitSourceDiff({ creates: [{ id: closeId, family: "month_closeout", data: { id: closeId, month: "2025-01", status: "closed" } }], updates: [], tombstones: [] })
  await b.bootstrap(); assert.deepEqual(pendingCloseoutConflicts(b.getState()), [{ month: "2025-01", pendingCount: 2 }])
  const normal = await createEncryptedTransaction(dep(a), { date: "2025-02-01", expense: "Normal test", amount: "3.00", category: "needs", tag_id: tag })
  const updated = await updateEncryptedTransaction(dep(a), normal, { expense: "Normal updated" }); await deleteEncryptedTransaction(dep(a), updated); await b.bootstrap(); assert.ok(!b.store.get(normal.id))
  execFileSync("php", ["scripts/pending-php-test-helper.php"], { cwd: root, env: { ...env, TEST_USER_ID: String(account.user_id), TEST_ACTION: "audit", TEST_PENDING_ID: id, TEST_TRANSACTION_ID: plan.transactionId, TEST_LEDGER_ID: ledger, TEST_RESTORED_ID: restored.id } })
  console.log("PASS: storage audit found no synthetic plaintext markers and verified persisted tombstones")
  console.log("PASS: real PHP batch, lost response retry, encrypted sync, amount-only and description-only, stale revision, cross-device, atomic finalize/undo, closeout conflict, normal transaction operations")
})().catch((error) => { console.error(error); process.exitCode = 1 })
