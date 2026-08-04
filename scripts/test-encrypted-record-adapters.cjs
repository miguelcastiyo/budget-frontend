const fs = require("node:fs")
const Module = require("node:module")
const path = require("node:path")
const ts = require("typescript")

const root = path.resolve(__dirname, "..")
const originalResolve = Module._resolveFilename
Module._resolveFilename = function (request, parent, isMain, options) {
  return originalResolve(request.startsWith("@/") ? path.join(root, request.slice(2)) : request, parent, isMain, options)
}
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename)

const { canonicalRecordFamily, parseEncryptedRecordPayload, serializeEncryptedRecord, sameEncryptedReference } = require("../lib/privacy/encrypted-records/adapters.ts")
const assert = (condition, message) => { if (!condition) throw new Error(message) }

assert(canonicalRecordFamily("funds") === "fund", "legacy fund family alias")
const parsed = parseEncryptedRecordPayload({ record_family: "transactions", record_schema_version: "v1", source_id: "import_1:2", data: { id: "import_1:2", amountCents: 1250, recurringExpenseId: "series:1" } })
assert(parsed.record_family === "transaction" && parsed.record_schema_version === "transaction_v1", "canonical family and schema")
assert(parsed.data.amount_cents === 1250 && parsed.data.recurring_expense_id === "series:1", "legacy field aliases")
assert(sameEncryptedReference("series:1", "1"), "namespaced references")
const serialized = serializeEncryptedRecord({ family: "fund", schemaVersion: "fund_v1", sourceId: "fund_1", data: { id: "fund_1", name: "Emergency" } })
assert(serialized.record_family === "fund" && serialized.data.name === "Emergency", "canonical serialization")
for (const payload of [null, {}, { record_family: "unknown", record_schema_version: "unknown_v1", source_id: "x", data: {} }, { record_family: "fund", record_schema_version: "fund_v2", source_id: "x", data: {} }]) {
  let failed = false
  try { parseEncryptedRecordPayload(payload) } catch (error) { failed = String(error.message).includes("ENCRYPTED_RECORD_") }
  assert(failed, "malformed and unsupported records fail explicitly")
}
console.log("Encrypted record adapter tests passed")
