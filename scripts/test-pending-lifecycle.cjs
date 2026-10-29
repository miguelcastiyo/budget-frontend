const fs = require("node:fs")
const Module = require("node:module")
const path = require("node:path")
const { webcrypto } = require("node:crypto")
const ts = require("typescript")
const root = path.resolve(__dirname, "..")
const resolve = Module._resolveFilename
Module._resolveFilename = function (request, parent, isMain, options) { return resolve(request.startsWith("@/") ? path.join(root, request.slice(2)) : request, parent, isMain, options) }
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename)
global.window = { isSecureContext: true, crypto: webcrypto }
global.crypto = webcrypto
const { PendingReviewSession, pendingFinalizedId, reconcilePendingFinalization } = require("../lib/privacy/encrypted-authority/pending-lifecycle.ts")
const { rehydrateFinancialState } = require("../lib/privacy/encrypted-authority/rehydrate.ts")
const { EncryptedFinancialAuthority } = require("../lib/privacy/encrypted-authority/authority.ts")
const assert = require("node:assert/strict")
const envelope = (id, revision = 1) => ({ record_id: id, record_revision: revision, sync_sequence: String(revision), deleted: false })
const record = (id, family, data) => ({ envelope: envelope(id), family, sourceId: id, schemaVersion: `${family}_v1`, data })
function harness() {
  const records = new Map()
  const pending = record("rec_pending", "pending_transaction", { captured_at: "2026-10-01T12:00:00.000Z", date: "2026-10-01", amount_cents: 1234, description: "Coffee", category: "wants", tag_id: "rec_tag", card_id: "rec_card", context_id: "rec_context", is_split: true, notes: "note" })
  records.set("rec_pending", pending)
  records.set("rec_tag", record("rec_tag", "taxonomy_tag", { name: "Food" }))
  const authority = {
    store: { get: (id) => records.get(id), values: () => [...records.values()] },
    bootstrap: async () => {}, getState: () => rehydrateFinancialState(records.values()),
    prepareSourceDiff: async (diff, key, options) => ({ diff: structuredClone(diff), options }),
    submitPreparedSourceDiff: async (batch) => {
      for (const [id, revision] of Object.entries(batch.options?.expectedRevisionOverrides ?? {})) if (records.get(id)?.envelope.record_revision !== revision) throw Error("CONFLICT")
      for (const item of batch.diff.creates) if (records.has(item.id)) throw Error("DUPLICATE")
      for (const item of batch.diff.tombstones) if (!records.has(item.id)) throw Error("CONFLICT")
      for (const item of batch.diff.creates) records.set(item.id, record(item.id, item.family, item.data))
      for (const item of batch.diff.tombstones) records.delete(item.id)
    },
  }
  return { authority, records, deps: { authority, isAuthenticated: true } }
}
;(async () => {
  const h = harness(), session = new PendingReviewSession(h.deps)
  const plan = await session.prepareFinalization("rec_pending")
  assert.equal(plan.transactionId, await pendingFinalizedId("rec_pending"))
  assert.notEqual(plan.transactionId, "rec_pending")
  assert.equal(plan.batch.diff.creates.length, 1)
  h.records.set("rec_ledger", record("rec_ledger", "fund_ledger_entry", { id: "rec_ledger", source_transaction_id: plan.transactionId, fund_id: "rec_fund", amount_cents: 1234 }))
  await session.finalizePendingTransaction(plan)
  assert.equal(await reconcilePendingFinalization(h.deps, "rec_pending"), "finalized")
  await assert.rejects(() => session.finalizePendingTransaction(plan), /DUPLICATE|CONFLICT/)
  const undo = await session.prepareUndo()
  await session.undo(undo)
  const restored = h.authority.getState().pendingTransactions[0]
  assert.notEqual(restored.id, "rec_pending")
  for (const key of ["capturedAt", "date", "amountCents", "description", "category", "tagId", "cardId", "contextId", "isSplit", "notes"]) assert.equal(restored[key], plan.pending[key], key)
  assert.equal(h.authority.getState().transactions.length, 0)
  assert.equal(h.records.has("rec_ledger"), false, "Undo removes linked Fund effect")
  const bad = harness(); bad.records.delete("rec_tag")
  await assert.rejects(() => new PendingReviewSession(bad.deps).prepareFinalization("rec_pending"), /Active tag/)
  for (const change of [{ amount_cents: null }, { amount_cents: 0 }, { description: null }, { category: null }]) {
    const invalid = harness()
    Object.assign(invalid.records.get("rec_pending").data, change)
    await assert.rejects(() => new PendingReviewSession(invalid.deps).prepareFinalization("rec_pending"))
  }
  const deleted = harness(); deleted.records.get("rec_tag").data.is_deleted = true
  await assert.rejects(() => new PendingReviewSession(deleted.deps).prepareFinalization("rec_pending"), /Active tag/)
  const closed = harness(); closed.records.set("close", record("close", "month_closeout", { month: "2026-10", status: "closed" }))
  await assert.rejects(() => new PendingReviewSession(closed.deps).prepareFinalization("rec_pending"), /PENDING_MONTH_CLOSED/)
  const concurrent = harness(); const other = new PendingReviewSession(concurrent.deps); const prior = await other.prepareFinalization("rec_pending")
  concurrent.records.get("rec_pending").envelope.record_revision++
  await assert.rejects(() => other.finalizePendingTransaction(prior), /CONFLICT/)
  const conflict = harness(); const third = new PendingReviewSession(conflict.deps); const done = await third.prepareFinalization("rec_pending"); await third.finalizePendingTransaction(done)
  conflict.records.get(done.transactionId).envelope.record_revision++
  await assert.rejects(() => third.prepareUndo(), /PENDING_UNDO_CONFLICT/)
  const key = await webcrypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
  const bodies = []; let failed = false
  const real = new EncryptedFinancialAuthority({ request: async (url, options) => {
    if (url.includes("/sync?")) return { changes: [], next_cursor: "0", has_more: false }
    bodies.push(options.body)
    if (!failed) { failed = true; throw Error("lost response") }
    const batch = JSON.parse(options.body)
    return { records: batch.creates.map((item) => ({ ...item.envelope, sync_sequence: "1" })), idempotent: true }
  } }, key, "vault")
  await real.bootstrap()
  const prepared = await real.prepareSourceDiff({ creates: [{ id: "rec_test12345", family: "taxonomy_tag", data: { name: "Test" } }], updates: [], tombstones: [] })
  await assert.rejects(() => real.submitPreparedSourceDiff(prepared), /lost response/)
  await real.submitPreparedSourceDiff(prepared)
  assert.equal(bodies[0], bodies[1])
  real.store.setCursor("2")
  real.store.remove("rec_test12345")
  await real.submitPreparedSourceDiff(prepared)
  assert.equal(real.store.get("rec_test12345"), undefined, "old batch response cannot restore a synced tombstone")
  await assert.rejects(() => real.submitPreparedSourceDiff({ body: prepared.body }), /ENCRYPTED_BATCH_PLAN_INVALID/)
  console.log("Pending lifecycle tests passed")
})().catch((error) => { console.error(error); process.exitCode = 1 })
