const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

const resolve = Module._resolveFilename
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith('@/')) request = path.join(process.cwd(), request.slice(2))
  return resolve.call(this, request, parent, ...rest)
}
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  module._compile(js, filename)
}
require.extensions['.css'] = module => { module.exports = new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) }) }
const { V2Overview } = require('../components/budget/v2-overview.tsx')
const noop = () => {}
const overview = {
  month: '2026-10', budget: { has_budget: true },
  summary: { total_spent: '650.00', total_budget: '1000.00', left_this_month: '350.00' },
  month_progress: { status: 'past', days_remaining: 0 },
  categories: [
    { category: 'needs', budget_amount: '500.00', actual_spend: '300.00', remaining_amount: '200.00' },
    { category: 'wants', budget_amount: '300.00', actual_spend: '150.00', remaining_amount: '150.00' },
    { category: 'savings', budget_amount: '200.00', actual_spend: '200.00', remaining_amount: '0.00' },
  ], tags: [{ tag_id: 'tag1', tag_name: 'Groceries', spend: '300.00' }],
  recent_transactions: [{ id: 't1', date: '2026-10-10', expense: 'Market', amount: '35.00', category: 'needs', tag: { name: 'Groceries' }, context: null, card: null }],
}
const props = { month: '2026-10', onMonthChange: noop, overview, closeout: null, closeoutLoading: false, loading: false, pending: { count: 2, knownAmountCents: 1250, unknownAmountCount: 1 }, onboarding: null, onClose: noop, onViewCloseout: noop, onReviewCloseout: noop, onSetBudget: noop, onAdd: noop, onCategory: noop, onTag: noop, onTransaction: noop, onViewAll: noop }
const render = changes => renderToStaticMarkup(React.createElement(V2Overview, { ...props, ...changes }))
if (process.argv.includes('--html')) {
  process.stdout.write(render({}))
  process.exit(0)
}
let html = render({})
assert.match(html, /\$350\.00/)
assert.match(html, /\$650\.00 of \$1,000\.00/)
assert.match(html, /2 pending · \$12\.50 known · 1 without amount/)
assert.match(html, /Market/)
assert.match(html, /Groceries/)
assert.match(html, /Savings spent/)
assert.match(html, /href="\/insights\/funds"/)
html = render({ overview: { ...overview, budget: { has_budget: false }, summary: { ...overview.summary, total_budget: null, left_this_month: null } }, pending: null })
assert.match(html, /Set a budget to see what is left/)
assert.doesNotMatch(html, /pending ·/)
html = render({ overview: { ...overview, summary: { ...overview.summary, total_budget: '0.00', left_this_month: '-650.00' }, categories: [{ ...overview.categories[0], budget_amount: '0.00', remaining_amount: '-300.00' }] } })
assert.match(html, /Over budget/)
assert.match(html, /\$300\.00 over/)
assert.doesNotMatch(html, /NaN|Infinity/)
html = render({ closeout: { month: '2026-10', status: 'missing_budget', closeout: null, computed: null } })
assert.match(html, /Budget Needed/)
assert.match(html, /Set Budget/)
html = render({ closeout: { month: '2026-10', status: 'closed', closeout: { result_type: 'balanced', allocated_amount: '0.00', unallocated_amount: '0.00' }, computed: null } })
assert.match(html, /Month Closed/)
assert.match(html, /View Closeout/)
html = render({ overview: { ...overview, recent_transactions: [], tags: [] } })
assert.match(html, /No transactions this month/)
assert.match(html, /Your spending patterns will appear here/)
console.log('v2 Overview rendering checks passed')
