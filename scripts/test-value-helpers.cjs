const fs = require("node:fs")
const Module = require("node:module")
const path = require("node:path")
const ts = require("typescript")
const root = path.resolve(__dirname, "..")
const originalResolve = Module._resolveFilename
Module._resolveFilename = function (request, parent, isMain, options) { return originalResolve(request.startsWith("@/") ? path.join(root, request.slice(2)) : request, parent, isMain, options) }
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename)
const money = require("../lib/domain/financial/money.ts")
const dates = require("../lib/date-filters.ts")
const snapshots = require("../lib/form-state/canonical-snapshot.ts")
const assert = (condition, message) => { if (!condition) throw new Error(message) }

assert(money.parseMoneyCents("1,234.50") === 123450, "strict money parsing")
assert(money.tryParseMoneyCents("bad") === null && money.parseDisplayMoney("$1,234.50") === 1234.5, "strict and display money policies")
assert(dates.parseIsoDate("2026-02-30") === null && dates.getNextMonthKey("2026-12") === "2027-01", "date validation and month rollover")
assert(dates.formatRelativeDateValue("2026-08-02", new Date(2026, 7, 3)) === "Yesterday", "local relative date formatting")
assert(snapshots.equalCanonicalSnapshots({ amount: snapshots.canonicalMoney("12.50"), id: snapshots.canonicalNullableId("") }, { amount: snapshots.canonicalMoney(12.5), id: null }), "canonical snapshots normalize equivalent values")
assert(!snapshots.equalCanonicalSnapshots({ enabled: true }, { enabled: false }), "canonical snapshots detect boolean changes")
console.log("Money, date, and canonical snapshot helper tests passed")
