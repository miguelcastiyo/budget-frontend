const { spawnSync } = require("node:child_process")

const checks = [
  ["Typecheck", "typecheck"],
  ["Budget helpers", "test:budget-helpers"],
  ["Value helpers", "test:value-helpers"],
  ["Client fixture loader", "test:client-fixture-loader"],
  ["Financial domain", "test:financial-domain"],
  ["Recurring commands", "test:recurring-commands"],
  ["Authority operations", "test:authority-operations"],
  ["Compatibility audit", "test:compatibility-audit"],
  ["Encrypted-record adapters", "test:encrypted-record-adapters"],
  ["Client parity", "test:client-parity"],
  ["Encrypted-only boundary", "test:encrypted-only-boundary"],
  ["Phase 2 security", "test:phase2-security"],
]

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm"

for (const [label, script] of checks) {
  console.log(`\n=== ${label} (${script}) ===`)
  const result = spawnSync(npmCommand, ["run", script], { stdio: "inherit", env: process.env })
  if (result.error) {
    console.error(`Failed to start ${script}: ${result.error.message}`)
    process.exit(1)
  }
  if (result.status !== 0) {
    console.error(`\n${label} failed with exit code ${result.status ?? 1}`)
    process.exit(result.status ?? 1)
  }
}

console.log(`\nAll ${checks.length} fast checks passed.`)
