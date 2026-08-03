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

const commands = require("../lib/privacy/encrypted-authority/recurring-commands.ts")
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const record = (id, data) => ({ envelope: { record_id: id }, family: "recurring_series", sourceId: id, data: { id, ...data } })

const createAuthority = (initialRecords = [], recurringOccurrences = []) => {
  const records = new Map(initialRecords.map((item) => [item.envelope.record_id, item]))
  const authority = {
    store: { get: (id) => records.get(id), values: () => [...records.values()] },
    getState: () => ({ recurringRules: [...records.values()].map((item) => item.data), recurringOccurrences, tags: [{ id: "tag_1", isDeleted: false }], cards: [] }),
    createSource: async (family, schemaVersion, id, data) => records.set(id, { envelope: { record_id: id }, family, schemaVersion, sourceId: id, data }),
    update: async (id, data) => {
      const current = records.get(id)
      assert(current, `record ${id} exists for update`)
      records.set(id, { ...current, data })
    },
    commitSourceDiff: async ({ creates, updates, tombstones }) => {
      for (const update of updates) {
        const current = records.get(update.id)
        assert(current, `record ${update.id} exists for commit update`)
        records.set(update.id, { ...current, data: update.data })
      }
      for (const create of creates) records.set(create.id, { envelope: { record_id: create.id }, family: create.family, sourceId: create.id, data: create.data })
      for (const tombstone of tombstones) records.delete(tombstone.id)
    },
  }
  return { authority, records }
}

const currentData = {
  series_id: "series_1", expense: "Rent", amount: "1200.00", amount_cents: 120000, category: "needs",
  billing_type: "day_of_month", billing_day: 1, tag_id: "tag_1", starts_month: "2026-01-01", ends_month: null, is_active: true, is_deleted: false,
}

;(async () => {
  const created = createAuthority()
  await commands.createEncryptedRecurringExpense(created.authority, currentData)
  assert(created.records.size === 1, "create persists one recurring record")
  const createdRecord = [...created.records.values()][0]
  assert(createdRecord.data.expense === "Rent" && createdRecord.data.amount_cents === 120000, "create persists normalized recurring data")

  const edited = createAuthority([record("rule_1", currentData)])
  await commands.updateEncryptedRecurringExpense(edited.authority, "rule_1", { amount: "1250.00", expense: "Rent and utilities" })
  assert(edited.records.get("rule_1").data.amount_cents === 125000 && edited.records.get("rule_1").data.expense === "Rent and utilities", "edit persists updated recurring data")

  const scheduled = createAuthority([record("rule_1", currentData)])
  await commands.scheduleEncryptedRecurringExpenseChange(scheduled.authority, "rule_1", { effective_month: "2026-09", amount: "1300.00" })
  assert(scheduled.records.get("rule_1").data.ends_month === "2026-08", "schedule closes the current version before the effective month")
  const scheduledRecord = [...scheduled.records.values()].find((item) => item.envelope.record_id !== "rule_1")
  assert(scheduledRecord && scheduledRecord.data.starts_month === "2026-09" && scheduledRecord.data.amount_cents === 130000, "schedule persists a future version")

  let duplicateError = null
  try {
    await commands.scheduleEncryptedRecurringExpenseChange(scheduled.authority, "rule_1", { effective_month: "2026-10", amount: "1400.00" })
  } catch (error) {
    duplicateError = error
  }
  assert(duplicateError?.code === "RECURRING_CHANGE_ALREADY_SCHEDULED", "duplicate schedule returns its domain error code")

  const historicalSchedule = createAuthority([record("rule_1", currentData)])
  let historicalError = null
  try {
    await commands.scheduleEncryptedRecurringExpenseChange(historicalSchedule.authority, "rule_1", { effective_month: "2026-07", amount: "1300.00" })
  } catch (error) {
    historicalError = error
  }
  assert(historicalError?.code === "RECURRING_EFFECTIVE_MONTH_IN_PAST", "backdated schedule returns its domain error code")

  await commands.cancelEncryptedRecurringExpenseChange(scheduled.authority, "rule_1", scheduledRecord.sourceId)
  assert(scheduled.records.get("rule_1").data.ends_month === null && scheduled.records.size === 1, "cancel restores the current version and removes the future version")

  const protectedDelete = createAuthority([record("rule_1", { ...currentData, ends_month: "2026-08" }), scheduledRecord])
  let deleteConflict = null
  try {
    await commands.deleteEncryptedRecurringExpense(protectedDelete.authority, "rule_1")
  } catch (error) {
    deleteConflict = error
  }
  assert(deleteConflict?.code === "RECURRING_SCHEDULE_MUST_BE_CANCELED", "delete blocks a current version with a future schedule")

  const deleted = createAuthority([record("rule_1", currentData)])
  await commands.deleteEncryptedRecurringExpense(deleted.authority, "rule_1")
  assert(!deleted.records.has("rule_1"), "delete persists a tombstone")

  console.log("Encrypted recurring command tests passed")
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
