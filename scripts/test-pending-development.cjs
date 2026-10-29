const { execFileSync } = require("node:child_process")
const assert = require("node:assert/strict")
const scenarios = [
  [{ NODE_ENV: "production", BUDGET_ENABLE_PENDING_DEV: "1", BACKEND_ORIGIN: "http://127.0.0.1:8000" }, "0"],
  [{ NODE_ENV: "development", BUDGET_ENABLE_PENDING_DEV: "1", BACKEND_ORIGIN: "https://example.com" }, "0"],
  [{ NODE_ENV: "development", BUDGET_ENABLE_PENDING_DEV: "0", BACKEND_ORIGIN: "http://127.0.0.1:8000" }, "0"],
  [{ NODE_ENV: "development", BUDGET_ENABLE_PENDING_DEV: "1", BACKEND_ORIGIN: "http://127.0.0.1:8000" }, "1"],
]
for (const [env, expected] of scenarios) {
  const output = execFileSync(process.execPath, ["--input-type=module", "-e", "import('./next.config.mjs').then(({default:c}) => process.stdout.write(c.env.NEXT_PUBLIC_PENDING_DEVELOPMENT))"], { env: { ...process.env, ...env }, encoding: "utf8" })
  assert.equal(output, expected)
}
console.log("Pending development gate tests passed")
