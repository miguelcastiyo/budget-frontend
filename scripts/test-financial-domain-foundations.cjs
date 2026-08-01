const fs = require("node:fs")
const Module = require("node:module")
const path = require("node:path")
const ts = require("typescript")
const root = path.resolve(__dirname, "..")
const originalResolve = Module._resolveFilename
Module._resolveFilename = function (request, parent, isMain, options) { return originalResolve(request.startsWith("@/") ? path.join(root, request.slice(2)) : request, parent, isMain, options) }
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename)
const money = require("../lib/domain/financial/money.ts")
const clock = require("../lib/domain/financial/clock.ts")
const transactions = require("../lib/domain/financial/transactions.ts")
const budgets = require("../lib/domain/financial/budgets.ts")
const viewModels = require("../lib/domain/financial/view-models.ts")
const fundDiff = require("../lib/domain/financial/transaction-fund-diff.ts")
const lineageRepair = require("../lib/domain/financial/import-lineage-repair.ts")
const assert = (condition, message) => { if (!condition) throw new Error(message) }
assert(money.parseMoneyCents("1,234.50") === 123450, "money parsing")
assert(money.formatMoneyCents(123450) === "1234.50", "money formatting")
assert(clock.daysInMonth("2024-02") === 29 && clock.daysInMonth("2026-02") === 28, "calendar month lengths")
const transaction = transactions.createTransaction({ id: "txn_1", userId: "user_1", date: "2026-01-15", expense: " Coffee ", amount: "12.50", category: "needs", notes: " note " })
assert(transaction.expense === "Coffee" && transaction.notes === "note" && transaction.amountCents === 1250, "transaction normalization")
assert(transactions.transactionSummary([transaction], {}).totalSpent === "12.50", "transaction summary")
const budget = { id: "budget_1", userId: "user_1", effectiveMonth: "2026-01", monthlyIncomeCents: 500000, incomeSourceType: "monthly", primaryMonthlyIncomeCents: 500000, primaryHourlyRateCents: null, primaryWeeklyHoursHundredths: null, sideIncomeType: "none", sideMonthlyIncomeCents: null, sideHourlyRateCents: null, sideWeeklyHoursHundredths: null, allocationMode: "percent", needsPercentHundredths: 5000, wantsPercentHundredths: 3000, savingsPercentHundredths: 2000, needsAmountCents: null, wantsAmountCents: null, savingsAmountCents: null }
assert(JSON.stringify(budgets.resolvedAmounts(budget)) === JSON.stringify({ needs: "2500.00", wants: "1500.00", savings: "1000.00" }), "budget allocation")
const transactionView = viewModels.transactionsVMFromState({ transactions: [transaction], tags: [], contexts: [], cards: [], budgets: [], recurringRules: [], recurringOccurrences: [], funds: [], fundLedgerEntries: [], savingsPlans: [], closeouts: [], closeoutAllocations: [], importRuns: [] })
assert(transactionView.items[0].amount === "12.50" && transactionView.summary.totalSpent === "12.50", "transaction view-model bridge")
const fund = { id: "fund_1", name: "Emergency", fundType: "goal", goalAmountCents: 10000, status: "active", sortOrder: 0 }
assert(viewModels.fundVMFromState(fund, [{ id: "entry_1", fundId: "fund_1", entryType: "contribution", direction: "in", amountCents: 5000, sourceType: "manual", sourceTransactionId: null, sourceCloseoutId: null, entryDate: "2026-01-01", isVoided: false, isDeleted: false }]).balance === "50.00", "fund view-model bridge")
const txSource = { id: "tx_1", family: "transaction", data: { amount_cents: 10000, fund_id: "fund_a" } }
const entryA = { id: "entry_a", family: "fund_ledger_entry", data: { fund_id: "fund_a", amount_cents: 10000 } }
const entryB = { id: "entry_b", family: "fund_ledger_entry", data: { fund_id: "fund_b", amount_cents: 10000 } }
assert(fundDiff.transactionFundDiff(null, fundDiff.transactionFundState(txSource, entryA)).creates.length === 2, "fund-linked create diff")
const moved = fundDiff.transactionFundDiff(fundDiff.transactionFundState(txSource, entryA), fundDiff.transactionFundState({ ...txSource, data: { amount_cents: 10000, fund_id: "fund_b" } }, entryB))
assert(moved.updates.length === 1 && moved.creates.length === 1 && moved.tombstones.length === 1, "fund transition diff")
assert(fundDiff.transactionFundDiff(fundDiff.transactionFundState(txSource, entryA), fundDiff.transactionFundState(txSource, null)).tombstones.length === 1, "fund unlink diff")
const envelope = (id, revision = 1) => ({ vault_id: "vault_1", record_id: id, envelope_version: 1, record_revision: revision, sync_sequence: "1", deleted: false })
const legacyRun = { envelope: envelope("run_legacy"), family: "import_run", schemaVersion: "import_run_v1", sourceId: "run_legacy", data: { id: "run_legacy", imported_rows: 1, status: "completed" } }
const legacyTransaction = { envelope: envelope("txn_legacy"), family: "transaction", schemaVersion: "transaction_v1", sourceId: "run_legacy:2", data: { id: "run_legacy:2", date: "2026-01-15", expense: "Imported", amount_cents: 1000, category: "needs", source: "import", is_deleted: false } }
const repairAuthority = { store: { values: () => [legacyRun, legacyTransaction] } }
const legacyAnalysis = lineageRepair.analyzeImportLineage(repairAuthority, "run_legacy")
assert(legacyAnalysis.status === "repairable_automatically" && legacyAnalysis.evidenceMethod === "legacy_row_id" && legacyAnalysis.canCommit, "legacy import lineage is repairable from exact row identity")
const stableRun = { ...legacyRun, envelope: envelope("run_stable"), sourceId: "run_stable", data: { ...legacyRun.data, id: "run_stable" } }
const stableTransaction = { ...legacyTransaction, envelope: envelope("txn_stable"), sourceId: "txn_stable", data: { ...legacyTransaction.data, id: "txn_stable", import_run_id: "run_stable" } }
const stableAnalysis = lineageRepair.analyzeImportLineage({ store: { values: () => [stableRun, stableTransaction] } }, "run_stable")
assert(stableAnalysis.status === "not_needed" && stableAnalysis.alreadyMarkedTransactionCount === 1, "stable import lineage is not re-repairable")
const ambiguousTransaction = { ...legacyTransaction, envelope: envelope("run_legacy:3"), sourceId: "run_legacy:3", data: { ...legacyTransaction.data, id: "run_legacy:3" } }
const ambiguousAnalysis = lineageRepair.analyzeImportLineage({ store: { values: () => [legacyRun, legacyTransaction, ambiguousTransaction] } }, "run_legacy")
assert(ambiguousAnalysis.status === "ambiguous", "duplicate legacy row identity remains unavailable")
console.log("Phase 4 financial-domain foundation tests passed")
