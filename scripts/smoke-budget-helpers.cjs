const fs = require("node:fs")
const Module = require("node:module")
const path = require("node:path")
const ts = require("typescript")

const projectRoot = path.resolve(__dirname, "..")
const originalResolveFilename = Module._resolveFilename

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolveFilename(resolveAlias(request), parent, isMain, options)
  }

  return originalResolveFilename(request, parent, isMain, options)
}

require.extensions[".ts"] = compileTypeScript
require.extensions[".tsx"] = compileTypeScript

const income = require("../lib/income-breakdown.ts")
const allocation = require("../lib/budget-allocation.ts")
const cards = require("../lib/cards.ts")
const dateFilters = require("../lib/date-filters.ts")
const formatters = require("../lib/formatters.ts")
const insights = require("../lib/insights.ts")
const monthCloseout = require("../lib/month-closeout.ts")
const transactionCollection = require("../lib/transaction-collection.ts")
const recurringStatus = require("../app/settings/recurring/_lib/recurring-status.ts")
const recurringSeries = require("../app/settings/recurring/_lib/recurring-series.ts")
const financialViewModels = require("../lib/domain/financial/view-models.ts")
const recurringForm = require("../lib/domain/financial/recurring-form.ts")
const recurringDomain = require("../lib/domain/financial/recurring.ts")
const recurringTimeline = require("../lib/domain/financial/recurring-timeline.ts")
const tagIcons = require("../lib/tag-icons.ts")

for (const key of ["coffee", "utensils", "book_open", "shopping_bag", "shirt", "sparkles", "droplet", "scissors", "film", "cookie"]) {
  assertEqual(tagIcons.CONTEXT_ICON_OPTIONS.some((option) => option.key === key), true, `context icon palette includes ${key}`)
  assertEqual(Boolean(tagIcons.getContextIconByKey(key)), true, `context icon resolves ${key}`)
}

assertDeepEqual(
  recurringForm.initialRecurringSchedule(new Date(2026, 6, 27)),
  { billingType: "day_of_month", billingDay: "27" },
  "transaction date supplies the initial custom recurring day"
)
assertDeepEqual(
  recurringForm.recurringSchedulePayload("day_of_month", "22"),
  { billing_type: "day_of_month", billing_day: 22 },
  "custom recurring day remains distinct from the transaction date"
)
assertDeepEqual(
  recurringForm.recurringSchedulePayload("last_day", "22"),
  { billing_type: "last_day", billing_day: null },
  "last-day recurring payload clears billing_day"
)
assertEqual(
  recurringForm.shouldInitializeRecurringOnEnable(true, false, false),
  true,
  "enabling a fresh recurrence derives only its initial schedule"
)
assertEqual(
  recurringForm.shouldInitializeRecurringOnEnable(true, true, true),
  false,
  "manual recurrence selection is not overwritten on subsequent changes"
)
const savedRule = recurringDomain.recurringRuleFromRaw({
  id: "rule_27",
  expense: "Rent",
  amount_cents: 120000,
  category: "needs",
  billing_type: "day_of_month",
  billing_day: 27,
  starts_month: "2026-01-01",
  is_active: true,
}, "2026-07")
assertEqual(savedRule.billingDay, 27, "commitment hydration preserves its stored billing day")
const scheduledRule = { ...savedRule, id: "rule_27:v2026-08", startsMonth: "2026-08", endsMonth: null, amountCents: 130000 }
assertEqual(recurringDomain.previousMonth("2026-01"), "2025-12", "recurring version boundary handles year rollover")
assertEqual(recurringDomain.resolveRules([savedRule, scheduledRule], "2026-08")[0].id, scheduledRule.id, "scheduled recurring version wins at its effective month")
assertEqual(recurringTimeline.recurringVersionForMonth([savedRule, scheduledRule], savedRule.seriesId, "2026-07").id, savedRule.id, "timeline selector keeps the historical version for its month")
assertEqual(recurringTimeline.recurringVersionForMonth([savedRule, scheduledRule], savedRule.seriesId, "2026-09").id, scheduledRule.id, "timeline selector uses the effective scheduled version")
assertEqual(recurringTimeline.recurringVersionOverlaps([savedRule, { ...scheduledRule, endsMonth: null }]).length, 1, "overlapping recurring versions are detectable")
const futureCommitment = { ...savedRule, id: "future_rule", starts_month: "2026-09", ends_month: null }
const endedCommitment = { ...savedRule, id: "ended_rule", starts_month: "2026-01", ends_month: "2026-06" }
assertEqual(recurringSeries.getVersionForMonth([futureCommitment], "2026-08"), null, "future recurring commitment is hidden before its start month")
assertEqual(recurringSeries.getVersionForMonth([endedCommitment], "2026-07"), null, "ended recurring commitment is hidden after its end month")
assertEqual(recurringSeries.getVersionForMonth([endedCommitment], "2026-06")?.id, "ended_rule", "recurring commitment remains visible through its end month")
assertEqual(recurringSeries.hasFutureScheduledChange([{ id: "rule_27", series_id: "rule_27", starts_month: "2026-01", is_active: true }, { id: "rule_27:v2026-08", series_id: "rule_27", starts_month: "2026-08", is_active: true }], "2026-07"), true, "recurring series detects an existing future scheduled change")
const seedTransaction = { id: "seed_txn", date: "2026-07-27", expense: "Rent", amountCents: 120000, category: "needs", isSplit: false, notes: null, source: "manual", recurringExpenseId: null, importFingerprint: null, tagId: "tag_1", contextId: null, cardId: "card_1", isDeleted: false, createdSequence: 1 }
const seedOccurrence = { id: "rule_27:2026-07", recurringExpenseId: "rule_27", occurrenceMonth: "2026-07-01", dueDate: "2026-07-27", transactionId: "seed_txn" }
assertEqual(recurringDomain.existingTransactionForOccurrence([seedTransaction], seedOccurrence, savedRule)?.id, "seed_txn", "manual seed transaction is reused for its first occurrence")
assertEqual(
  recurringDomain.planMaterialization(
    [savedRule],
    "2026-07",
    [{ id: "occurrence_1", recurringExpenseId: "rule_27", occurrenceMonth: "2026-07-01", dueDate: "2026-07-27", transactionId: "txn_1" }],
    [{ id: "txn_1", date: "2026-07-27", expense: "Rent", amountCents: 120000, category: "needs", isSplit: false, notes: null, source: "recurring", recurringExpenseId: "rule_27", importFingerprint: null, tagId: null, contextId: null, cardId: null, isDeleted: false, createdSequence: 1 }],
    "2026-07",
    "2026-07-30"
  ).length,
  0,
  "existing seed-linked occurrence is not duplicated"
)
const projectedTransactions = financialViewModels.transactionsPageFromState(
  { transactions: [], tags: [], contexts: [], cards: [], budgets: [], recurringRules: [savedRule], recurringOccurrences: [], funds: [], fundLedgerEntries: [], savingsPlans: [], closeouts: [], closeoutAllocations: [], importRuns: [] },
  { from: "2026-07-01", to: "2026-07-31", page: 1, pageSize: 50, sort: "date_desc" },
  "2026-07-02",
  true
)
assertEqual(projectedTransactions.items.some((item) => item.expense === "Rent" && item.date === "2026-07-27"), true, "Transactions page includes the full month's projected recurring spend")

const hourlyMonthly = income.calculateHourlyMonthlyIncome("20.00", "10.00")
assertApprox(hourlyMonthly, 866.6666666667, 0.000001, "hourly income uses 52/12 monthly average")

assertEqual(income.asNumber("1,234.50"), 1234.5, "asNumber accepts comma-formatted values")
assertEqual(income.asNumber("not money"), 0, "asNumber falls back to zero for invalid values")
assertEqual(income.toDecimalString("1,234.5"), "1234.50", "toDecimalString normalizes formatted values")
assertEqual(income.toDecimalString("invalid"), "0.00", "toDecimalString falls back to zero for invalid values")

assertEqual(
  income.calculateMonthlyIncomeString({
    ...income.defaultIncomeFormState,
    incomeSourceType: "hourly",
    primaryHourlyRate: "20.00",
    primaryWeeklyHours: "10.00",
  }),
  "866.67",
  "hourly income rounds to a monthly decimal string"
)

assertEqual(
  income.calculateMonthlyIncomeString({
    ...income.defaultIncomeFormState,
    incomeSourceType: "hourly",
    primaryHourlyRate: "15.00",
    primaryWeeklyHours: "10.00",
    sideIncomeType: "monthly",
    sideIncomeLabel: "Tutoring",
    sideMonthlyIncome: "120.00",
  }),
  "770.00",
  "hourly primary plus monthly side income computes a monthly total"
)

assertEqual(
  income.calculateMonthlyIncomeString({
    ...income.defaultIncomeFormState,
    incomeSourceType: "hourly",
    primaryHourlyRate: "12.00",
    primaryWeeklyHours: "10.00",
    sideIncomeType: "hourly",
    sideIncomeLabel: "Babysitting",
    sideHourlyRate: "25.00",
    sideWeeklyHours: "1.00",
  }),
  "628.33",
  "hourly primary plus hourly side income computes a monthly total"
)

const inactiveSidePayload = income.incomeBreakdownPayload({
  ...income.defaultIncomeFormState,
  primaryMonthlyIncome: "1000.00",
  sideIncomeLabel: "Should not persist",
})
assertEqual(inactiveSidePayload.side_income_label, null, "inactive side income clears the side label")

assertEqual(
  income.isIncomeFormValid({
    ...income.defaultIncomeFormState,
    primaryMonthlyIncome: "0.00",
  }),
  false,
  "monthly income form rejects zero primary income"
)

assertEqual(
  income.isIncomeFormValid({
    ...income.defaultIncomeFormState,
    incomeSourceType: "hourly",
    primaryHourlyRate: "25.00",
    primaryWeeklyHours: "0.00",
  }),
  false,
  "hourly income form requires hours"
)

const transactionOne = { id: "txn_1", expense: "One" }
const transactionTwo = { id: "txn_2", expense: "Two" }
const updatedTransactionOne = { id: "txn_1", expense: "Updated One" }
assertDeepEqual(
  transactionCollection.replaceTransaction([transactionOne, transactionTwo], updatedTransactionOne),
  [updatedTransactionOne, transactionTwo],
  "transaction replacement updates only the matching loaded row"
)
assertDeepEqual(
  transactionCollection.mergeTransactionPages([
    [transactionOne, transactionTwo],
    [updatedTransactionOne, { id: "txn_3", expense: "Three" }],
  ]),
  [transactionOne, transactionTwo, { id: "txn_3", expense: "Three" }],
  "transaction page merge preserves order and removes duplicate IDs"
)

const suggestionState = {
  transactions: [
    { id: "txn_1", date: "2026-07-01", expense: "Coffee Shop", amountCents: 500, category: "needs", isSplit: false, notes: null, source: "manual", recurringExpenseId: null, importFingerprint: null, tagId: "tag_food", contextId: null, cardId: "card_1", isDeleted: false, createdSequence: 1 },
    { id: "txn_2", date: "2026-07-15", expense: "Coffee Shop", amountCents: 600, category: "needs", isSplit: false, notes: null, source: "manual", recurringExpenseId: null, importFingerprint: null, tagId: "tag_food", contextId: null, cardId: "card_1", isDeleted: false, createdSequence: 2 },
    { id: "txn_3", date: "2026-07-20", expense: "Coffee Roaster", amountCents: 900, category: "wants", isSplit: false, notes: null, source: "manual", recurringExpenseId: null, importFingerprint: null, tagId: "tag_food", contextId: null, cardId: null, isDeleted: false, createdSequence: 3 },
  ],
  tags: [{ id: "tag_food", userId: "u", name: "Food", iconKey: "food", isFavorite: false, isDeleted: false, createdSequence: 1 }],
  contexts: [], cards: [{ id: "card_1", userId: "u", name: "Everyday", iconKey: null, isFavorite: true, isDeleted: false, createdSequence: 1 }], budgets: [],
}
const suggestions = financialViewModels.transactionSuggestionsFromState(suggestionState, "coffee", 5).items
assertEqual(suggestions[0].expense, "Coffee Shop", "encrypted suggestions prefer the higher-frequency exact setup")
assertEqual(suggestions[0].usage_count, 2, "encrypted suggestions retain setup frequency")
assertEqual(suggestions[1].expense, "Coffee Roaster", "encrypted suggestions include prefix matches")

const allocationState = {
  ...allocation.defaultBudgetAllocationFormState,
  needsPercent: "50.00",
  wantsPercent: "30.00",
  savingsPercent: "20.00",
}
const amountState = allocation.withAllocationMode(allocationState, "amount", 1000.01)
assertEqual(amountState.needsAmount, "500.01", "amount conversion balances needs in cents")
assertEqual(amountState.wantsAmount, "300.00", "amount conversion balances wants in cents")
assertEqual(amountState.savingsAmount, "200.00", "amount conversion puts remainder in savings")
assertEqual(allocation.totalAmount(amountState).toFixed(2), "1000.01", "amount conversion totals the income")
assertEqual(allocation.isPercentAllocationValid(allocationState), true, "50/30/20 percent allocation is valid")
assertEqual(
  allocation.isPercentAllocationValid({
    ...allocationState,
    savingsPercent: "19.99",
  }),
  false,
  "percent allocation rejects totals below 100"
)
assertEqual(allocation.isAmountAllocationValid(amountState, 1000.01), true, "amount allocation matches income")

const fullPayload = allocation.budgetSettingsPayload(
  {
    ...income.defaultIncomeFormState,
    incomeSourceType: "hourly",
    primaryHourlyRate: "20.00",
    primaryWeeklyHours: "10.00",
  },
  allocationState
)
assertEqual(fullPayload.monthly_income, "866.67", "full payload includes computed monthly income")
assertEqual(fullPayload.primary_hourly_rate, "20.00", "full payload includes primary hourly rate")
assertEqual(fullPayload.side_income_label, null, "full payload clears inactive side income label")
assertEqual(fullPayload.allocation_mode, "percent", "full payload includes allocation mode")
assertEqual(fullPayload.needs_percent, "50.00", "full payload includes percent allocation")

const leapMonth = dateFilters.getMonthDateRange("2024-02")
assertDeepEqual(leapMonth, { date_from: "2024-02-01", date_to: "2024-02-29" }, "month range handles leap years")
assertEqual(dateFilters.getMonthDateRange("2024-13"), null, "month range rejects invalid months")
assertEqual(dateFilters.formatMonthLabel("2026-05"), "May 2026", "month label formats valid months")
assertEqual(dateFilters.formatMonthLabel("2026-99"), null, "month label rejects invalid months")
assertEqual(dateFilters.formatMonthValue("2026-05", { month: "short" }), "May", "month value formatter renders month keys")
assertEqual(dateFilters.toIsoDate(new Date(2026, 0, 5)), "2026-01-05", "toIsoDate uses local calendar date")
assertEqual(dateFilters.getLocalDateKey(new Date(2026, 6, 26, 23, 59)), "2026-07-26", "local date key uses the local calendar day")
assertEqual(dateFilters.parseIsoDate("2026-02-29"), null, "parseIsoDate rejects invalid calendar dates")
assertEqual(dateFilters.parseIsoDate("2024-02-29").getFullYear(), 2024, "parseIsoDate accepts leap day")
assertEqual(dateFilters.parseMonthKey("2026-05").getMonth(), 4, "parseMonthKey parses valid month keys")
assertEqual(dateFilters.parseMonthKey("2026-15"), null, "parseMonthKey rejects invalid month keys")
assertEqual(dateFilters.parseDateValue("2026-01-05").getDate(), 5, "parseDateValue preserves local calendar dates")
assertEqual(dateFilters.formatDateValue("2026-01-05", { month: "short", day: "numeric", year: "numeric" }), "Jan 5, 2026", "date value formatter renders date-only values")

const commitment = (projectedDate, generated) => ({
  projected_date_for_month: projectedDate,
  generated_for_month: generated,
})
const july23 = "2026-07-23"
assertEqual(
  recurringStatus.getCommitmentDisplayStatus(commitment("2026-07-27", true), july23),
  "upcoming",
  "generated future commitment remains upcoming"
)
assertEqual(
  recurringStatus.getCommitmentDisplayStatus(commitment("2026-07-17", true), july23),
  "logged",
  "generated past commitment is logged"
)
assertEqual(
  recurringStatus.getCommitmentDisplayStatus(commitment("2026-07-27", true), "2026-07-27"),
  "logged",
  "generated commitment due today is logged"
)
assertEqual(
  recurringStatus.getCommitmentDisplayStatus(commitment("2026-07-27", false), july23),
  "upcoming",
  "future ungenerated commitment is upcoming"
)
assertEqual(
  recurringStatus.getCommitmentDisplayStatus(commitment("2026-07-21", false), july23),
  "due",
  "past ungenerated commitment is due"
)
const recurringStatusItem = { projected_date_for_month: "2026-06-27", generated_for_month: false }
assertEqual(
  recurringSeries.getRecurringOccurrenceStatus(recurringStatusItem, "2026-06", new Date(2026, 6, 23)),
  "due",
  "historical ungenerated month is not shown as upcoming"
)
assertEqual(
  recurringSeries.getRecurringOccurrenceStatus({ ...recurringStatusItem, projected_date_for_month: "2026-08-27" }, "2026-08", new Date(2026, 6, 23)),
  "upcoming",
  "future month is upcoming regardless of its day number"
)

const upcomingCommitments = [
  { expense: "Spotify", projected_date_for_month: "2026-07-17", generated_for_month: true },
  { expense: "Car Insurance", projected_date_for_month: "2026-07-21", generated_for_month: true },
  { expense: "Rent", projected_date_for_month: "2026-07-27", generated_for_month: true },
].filter((item) => recurringStatus.getCommitmentDisplayStatus(item, july23) === "upcoming")
assertDeepEqual(
  upcomingCommitments.map((item) => item.expense),
  ["Rent"],
  "upcoming commitments use billing date rather than generation state"
)
assertEqual(
  dateFilters.formatDateTimeValue("2026-01-05T14:30:00Z", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }),
  "Jan 5, 2026, 2:30 PM",
  "date time formatter renders timestamps"
)

assertEqual(formatters.formatCurrency("1234.5"), "$1,234.50", "currency formatter renders dollars")
assertEqual(formatters.formatCategory("savings"), "Savings", "category formatter renders savings label")
assertEqual(formatters.getCategoryColorClass("unknown"), "bg-muted", "category color falls back for unknown values")
assertEqual(formatters.getCategoryTextClass("unknown"), "text-muted-foreground", "category text color falls back for unknown values")

assertEqual(insights.formatShortCurrency(1500), "$1.5k", "short currency abbreviates thousands")
assertEqual(insights.formatShortCurrency(Number.NaN), "$0", "short currency handles non-finite numbers")
assertEqual(insights.formatTooltipCurrency(["42.5"]), "$42.50", "tooltip currency reads array payloads")
assertEqual(insights.formatMonthAxisLabel("2026-05", false), "May", "month axis label renders month")
assertEqual(insights.formatMonthAxisLabel("2026-05", true), "May 26", "month axis label includes short year")
assertEqual(insights.formatMonthAxisLabel("not-a-month", true), "not-a-month", "month axis label falls back for invalid values")
assertEqual(insights.formatMonthTooltipLabel("2026-05"), "May 2026", "month tooltip label renders full month")
assertEqual(insights.tagColor(0), "var(--color-chart-1)", "tag color uses theme chart palette first")
assertEqual(insights.tagColor(20), "color-mix(in srgb, var(--color-chart-1) 58%, var(--color-foreground))", "tag color generates deterministic overflow colors")
assertEqual(insights.dayLabel("Monday"), "MON", "day label abbreviates day names")

assertEqual(monthCloseout.parseMoneyToCents("12.34"), 1234, "closeout money parser converts to cents")
assertEqual(monthCloseout.getCloseoutOutcome("surplus"), "under", "closeout outcome maps surplus to under-plan language")
assertEqual(
  monthCloseout.buildFooterStatus({
    outcome: "under",
    availableCents: 31560,
    allocatedCents: 0,
  }),
  "$315.60 ready to place",
  "closeout footer status shows unassigned surplus"
)
assertEqual(
  monthCloseout.buildFooterStatus({
    outcome: "under",
    availableCents: 31560,
    allocatedCents: 21560,
  }),
  "$100.00 left to place",
  "closeout footer status shows partial assignment"
)
assertEqual(
  monthCloseout.inferCloseoutDecision(
    [{ allocation_type: "savings", amount: "315.60" }],
    31560
  ),
  "savings",
  "closeout decision infers single full savings allocation"
)
assertEqual(
  monthCloseout.inferCloseoutDecision([], 31560, 31560),
  "buffer",
  "closeout decision infers explicit buffer when all surplus stays unassigned"
)
assertDeepEqual(
  monthCloseout.buildFooterState({
    monthLabel: "June",
    outcome: "under",
    decision: null,
    availableCents: 31560,
    allocatedCents: 0,
    isSubmitting: false,
    hasError: false,
  }),
  {
    helperText: "Choose where the $315.60 should go",
    buttonText: "Choose an option",
    disabled: true,
  },
  "closeout footer requires an explicit surplus decision"
)
assertDeepEqual(
  monthCloseout.buildFooterState({
    monthLabel: "June",
    outcome: "under",
    decision: "buffer",
    availableCents: 31560,
    allocatedCents: 0,
    isSubmitting: false,
    hasError: false,
  }),
  {
    helperText: "$315.60 kept as buffer",
    buttonText: "Close with buffer",
    disabled: false,
  },
  "closeout footer describes keeping surplus as buffer"
)
assertDeepEqual(
  monthCloseout.buildClosedSummary({
    monthLabel: "June",
    outcome: "under",
    varianceCents: 31560,
    allocatedCents: 31560,
    unallocatedCents: 0,
    allocations: [{ allocation_type: "savings" }],
  }),
  {
    title: "June is closed",
    amountLine: "$315.60 moved to savings",
    detailLine: "You finished the month under plan.",
  },
  "closed closeout summary describes single savings transfer"
)
assertDeepEqual(
  monthCloseout.buildClosedSummary({
    monthLabel: "June",
    outcome: "under",
    varianceCents: 31560,
    allocatedCents: 0,
    unallocatedCents: 31560,
    allocations: [],
  }),
  {
    title: "June is closed",
    amountLine: "$315.60 kept as buffer",
    detailLine: "You finished the month under plan.",
  },
  "closed closeout summary describes kept buffer state"
)

assertDeepEqual(
  cards.sortCards([
    { id: "12", name: "zeta", is_favorite: false },
    { id: "2", name: "Alpha", is_favorite: false },
    { id: "9", name: "beta", is_favorite: true },
    { id: "3", name: "Beta", is_favorite: false },
  ]),
  [
    { id: "9", name: "beta", is_favorite: true },
    { id: "2", name: "Alpha", is_favorite: false },
    { id: "3", name: "Beta", is_favorite: false },
    { id: "12", name: "zeta", is_favorite: false },
  ],
  "card sorting keeps favorite first and falls back to case-insensitive name"
)

console.log("Frontend helper tests passed")

function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8")
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  })

  module._compile(transpiled.outputText, filename)
}

function resolveAlias(request) {
  const aliasPath = path.join(projectRoot, request.slice(2))
  const candidates = [
    aliasPath,
    `${aliasPath}.ts`,
    `${aliasPath}.tsx`,
    `${aliasPath}.js`,
    `${aliasPath}.jsx`,
    path.join(aliasPath, "index.ts"),
    path.join(aliasPath, "index.tsx"),
  ]

  const resolved = candidates.find((candidate) => fs.existsSync(candidate))
  if (!resolved) {
    throw new Error(`Unable to resolve alias ${request}`)
  }

  return resolved
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label}: expected ${formatValue(expected)}, got ${formatValue(actual)}`)
  }
}

function assertApprox(actual, expected, tolerance, label) {
  if (Math.abs(actual - expected) > tolerance) {
    fail(`${label}: expected ${expected}, got ${actual}`)
  }
}

function assertDeepEqual(actual, expected, label) {
  const actualJson = JSON.stringify(actual)
  const expectedJson = JSON.stringify(expected)
  if (actualJson !== expectedJson) {
    fail(`${label}: expected ${expectedJson}, got ${actualJson}`)
  }
}

function formatValue(value) {
  return JSON.stringify(value)
}

function fail(message) {
  console.error(`Frontend helper tests failed: ${message}`)
  process.exit(1)
}
