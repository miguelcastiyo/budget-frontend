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
const dateFilters = require("../lib/date-filters.ts")
const formatters = require("../lib/formatters.ts")
const insights = require("../lib/insights.ts")

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
assertEqual(dateFilters.toIsoDate(new Date(2026, 0, 5)), "2026-01-05", "toIsoDate uses local calendar date")
assertEqual(dateFilters.parseIsoDate("2026-02-29"), null, "parseIsoDate rejects invalid calendar dates")
assertEqual(dateFilters.parseIsoDate("2024-02-29").getFullYear(), 2024, "parseIsoDate accepts leap day")

assertEqual(formatters.formatCurrency("1234.5"), "$1,234.50", "currency formatter renders dollars")
assertEqual(formatters.formatCategory("savings_debts"), "Savings & Debts", "category formatter renders savings label")
assertEqual(formatters.getCategoryColorClass("unknown"), "bg-muted", "category color falls back for unknown values")
assertEqual(formatters.getCategoryTextClass("unknown"), "text-muted-foreground", "category text color falls back for unknown values")

assertEqual(insights.formatShortCurrency(1500), "$1.5k", "short currency abbreviates thousands")
assertEqual(insights.formatShortCurrency(Number.NaN), "$0", "short currency handles non-finite numbers")
assertEqual(insights.formatTooltipCurrency(["42.5"]), "$42.50", "tooltip currency reads array payloads")
assertEqual(insights.formatMonthAxisLabel("2026-05", false), "May", "month axis label renders month")
assertEqual(insights.formatMonthAxisLabel("2026-05", true), "May 26", "month axis label includes short year")
assertEqual(insights.formatMonthAxisLabel("not-a-month", true), "not-a-month", "month axis label falls back for invalid values")
assertEqual(insights.formatMonthTooltipLabel("2026-05"), "May 2026", "month tooltip label renders full month")
assertEqual(insights.tagColor(0), "#1D4ED8", "tag color uses fixed palette first")
assertEqual(insights.tagColor(20), "hsl(220, 72%, 38%)", "tag color generates deterministic overflow colors")
assertEqual(insights.dayLabel("Monday"), "MON", "day label abbreviates day names")

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
