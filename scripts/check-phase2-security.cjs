const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const sourceFiles = []
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".next-playwright", ".next-migration-playwright", ".git"].includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (full.endsWith(path.join("scripts", "check-phase2-security.cjs"))) continue
    if (entry.isDirectory()) walk(full)
  else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name) && full !== __filename) sourceFiles.push(full)
  }
}
walk(root)
const text = sourceFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n")
const forbidden = [
  /dangerouslySetInnerHTML/,
  /\.innerHTML\s*=/,
  /\.outerHTML\s*=/,
  /insertAdjacentHTML/,
  /document\.write/,
  /\beval\s*\(/,
  /new Function\s*\(/,
  /postMessage\s*\(/,
  /serviceWorker/,
  /localStorage\.(setItem|getItem)\([^)]*(?:passphrase|recovery|vault|crypto|wrapped)/i,
]
const findings = forbidden.filter((pattern) => pattern.test(text)).map(String)
if (findings.length) {
  console.error(`Phase 2 security boundary check failed: ${findings.join(", ")}`)
  process.exit(1)
}
const config = fs.readFileSync(path.join(root, "next.config.mjs"), "utf8")
for (const directive of ["default-src 'self'", "script-src 'self'", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'"]) {
  if (!config.includes(directive)) throw new Error(`Missing CSP directive: ${directive}`)
}
for (const header of ["X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy"]) {
  if (!config.includes(header)) throw new Error(`Missing security header: ${header}`)
}
console.log("Phase 2 static security boundary checks passed")
