import { pendingCapabilitiesForAccount } from "@/lib/pending-rollout-server"

export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "no-store, max-age=0", "Vary": "Cookie" }
export async function GET(request: Request) {
  const cookie = request.headers.get("cookie")
  if (!cookie) return Response.json({ capture: false, recovery: false }, { status: 401, headers })
  try {
    const backend = process.env.BACKEND_ORIGIN || "http://localhost:8000"
    const response = await fetch(`${backend}/api/v1/me`, { headers: { cookie }, cache: "no-store", redirect: "error" })
    if (!response.ok) return Response.json({ capture: false, recovery: false }, { status: 401, headers })
    const profile = await response.json() as { id?: unknown }
    if (typeof profile.id !== "string" && typeof profile.id !== "number") throw new Error("INVALID_ACCOUNT")
    return Response.json(pendingCapabilitiesForAccount(String(profile.id), { captureEnabled: process.env.BUDGET_PENDING_CAPTURE_ENABLED, recoveryEnabled: process.env.BUDGET_PENDING_RECOVERY_ENABLED, accountIds: process.env.BUDGET_PENDING_ACCOUNT_IDS }), { headers })
  } catch { return Response.json({ capture: false, recovery: false }, { status: 503, headers }) }
}
