const fs = require("node:fs")
const path = require("node:path")

const source = fs.readFileSync(path.join(__dirname, "..", "app/settings/vault/page.tsx"), "utf8")

const checks = [
  ["reuses RecentAuthDialog", source.includes('import { RecentAuthDialog } from "@/components/auth/recent-auth-dialog"') && source.includes("<RecentAuthDialog")],
  ["tracks both pending actions", source.includes('type PendingQuickUnlockAction = "enroll" | "revoke"')],
  ["opens recent auth only for the expected response", source.includes('error.error.code === "RECENT_AUTH_REQUIRED"') && source.includes("setRecentAuthOpen(true)")],
  ["preserves the pending action", source.includes("setPendingQuickUnlockAction(action)")],
  ["retries enrollment and revocation", source.includes('runQuickUnlockAction("enroll", true)') && source.includes('runQuickUnlockAction("revoke", true)')],
  ["retries at most once after reauthentication", source.includes("runQuickUnlockAction(action, false)")],
  ["cancelling clears the pending action", source.includes("if (!open) setPendingQuickUnlockAction(null)")],
  ["refreshes and closes after success", source.includes("await authority.refresh()") && source.includes("setQuickUnlockOpen(false)")],
  ["keeps non-auth errors on the normal path", source.includes("quickUnlockErrorMessage(error)")],
]

for (const [label, passed] of checks) {
  if (!passed) throw new Error(`Quick Unlock recent-auth contract failed: ${label}`)
}

console.log(`Quick Unlock recent-auth contract passed: ${checks.length}/${checks.length} checks`)
