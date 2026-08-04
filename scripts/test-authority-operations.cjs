const fs = require("node:fs")
const Module = require("node:module")
const path = require("node:path")
const { webcrypto } = require("node:crypto")
const ts = require("typescript")

const root = path.resolve(__dirname, "..")
const originalResolve = Module._resolveFilename
Module._resolveFilename = function (request, parent, isMain, options) {
  return originalResolve(request.startsWith("@/") ? path.join(root, request.slice(2)) : request, parent, isMain, options)
}
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, filename)
global.window = { isSecureContext: true, crypto: webcrypto }

const { createEncryptedTransaction, updateEncryptedTransaction } = require("../lib/privacy/encrypted-authority/transaction-operations.ts")
const { createEncryptedTag, createEncryptedCard, createEncryptedContext, getEncryptedContexts } = require("../lib/privacy/encrypted-authority/taxonomy-operations.ts")
const { createEncryptedFundEntry, getEncryptedFunds, getEncryptedFundEntries } = require("../lib/privacy/encrypted-authority/fund-operations.ts")
const assert = (condition, message) => { if (!condition) throw new Error(message) }

function makeRecord(id, family, data) {
  return { envelope: { record_id: id, record_revision: 1 }, family, schemaVersion: `${family}_v1`, sourceId: id, data: { id, ...data } }
}

function makeAuthority(initialRecords = []) {
  const records = new Map(initialRecords.map((record) => [record.envelope.record_id, record]))
  const authority = {
    store: { get: (id) => records.get(id), values: () => [...records.values()] },
    getState: () => ({
      transactions: [...records.values()].filter((record) => record.family === "transaction").map((record) => ({ id: record.sourceId, ...record.data })),
      tags: [...records.values()].filter((record) => record.family === "taxonomy_tag").map((record) => ({ id: record.sourceId, name: record.data.name, iconKey: record.data.icon_key, isDeleted: record.data.is_deleted === true })),
      cards: [...records.values()].filter((record) => record.family === "taxonomy_card").map((record) => ({ id: record.sourceId, name: record.data.name, isFavorite: record.data.is_favorite === true, isDeleted: record.data.is_deleted === true })),
      contexts: [...records.values()].filter((record) => record.family === "taxonomy_context").map((record) => ({ id: record.sourceId, name: record.data.name, iconKey: record.data.icon_key, isDeleted: record.data.is_deleted === true })),
      funds: [...records.values()].filter((record) => record.family === "fund").map((record) => record.data),
      fundLedgerEntries: [...records.values()].filter((record) => record.family === "fund_ledger_entry").map((record) => record.data),
    }),
    createSource: async (family, schemaVersion, id, data) => { records.set(id, makeRecord(id, family, data)); return records.get(id) },
    commitSourceDiff: async ({ creates, updates, tombstones }) => {
      for (const record of updates) records.set(record.id, { ...records.get(record.id), data: record.data })
      for (const record of creates) records.set(record.id, makeRecord(record.id, record.family, record.data))
      for (const record of tombstones) records.delete(record.id)
    },
  }
  return { authority, records }
}

;(async () => {
  const deps = (authority) => ({ authority, isAuthenticated: true })

  const created = makeAuthority([
    makeRecord("tag_1", "taxonomy_tag", { name: "Home", icon_key: null, is_deleted: false }),
    makeRecord("fund_1", "fund", { name: "Emergency", fund_type: "goal", goal_amount_cents: 100000, status: "active", sort_order: 0 }),
  ])
  const tag = await createEncryptedTag(deps(created.authority), { name: "Travel", icon_key: "plane" })
  const card = await createEncryptedCard(deps(created.authority), { name: "Visa" })
  const context = await createEncryptedContext(deps(created.authority), { name: "Work", icon_key: "briefcase" })
  assert(tag.name === "Travel" && card.name === "Visa" && context.name === "Work", "taxonomy operations return created references")
  assert(getEncryptedContexts(deps(created.authority)).items.some((item) => item.name === "Work"), "taxonomy adapter reads encrypted contexts")

  const transaction = await createEncryptedTransaction(deps(created.authority), { date: "2026-08-01", expense: "Coffee", amount: "5.25", category: "wants", is_split: false, tag_id: tag.id, card_id: card.id, context_id: context.id })
  assert(transaction.amount === "5.25" && transaction.tag.id === tag.id, "transaction operation maps encrypted data to UI data")
  const updated = await updateEncryptedTransaction(deps(created.authority), transaction, { date: "2026-08-02", expense: "Coffee shop", amount: "6.25", category: "wants", is_split: false, notes: "Morning", tag_id: tag.id, card_id: card.id, context_id: context.id })
  assert(updated.expense === "Coffee shop" && updated.notes === "Morning", "transaction update remains routed through the operation module")

  const entry = await createEncryptedFundEntry(deps(created.authority), "fund_1", { entry_date: "2026-08-03", entry_type: "contribution", direction: "in", amount: "25.00", source_type: "manual", note: "Seed" })
  const funds = await getEncryptedFunds(deps(created.authority), { status: "active" })
  const entries = await getEncryptedFundEntries(deps(created.authority), "fund_1")
  assert(funds.items.length === 1 && entries.items[0]?.id === entry.id, "fund operations preserve fund and ledger lookups")

  console.log("Encrypted authority operation tests passed")
})().catch((error) => { console.error(error); process.exitCode = 1 })
