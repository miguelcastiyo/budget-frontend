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

const hourlyMonthly = income.calculateHourlyMonthlyIncome("20.00", "10.00")
assertApprox(hourlyMonthly, 866.6666666667, 0.000001, "hourly income uses 52/12 monthly average")

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

console.log("Budget helper smoke test passed")

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

function formatValue(value) {
  return JSON.stringify(value)
}

function fail(message) {
  console.error(`Budget helper smoke test failed: ${message}`)
  process.exit(1)
}
