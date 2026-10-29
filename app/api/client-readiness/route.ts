export const dynamic = "force-dynamic"
export async function GET() {
  const configured = Number(process.env.BUDGET_MIN_CLIENT_VERSION ?? "1")
  const minVersion = Number.isSafeInteger(configured) && configured >= 1 ? configured : 1
  return Response.json({ minVersion }, { headers: { "Cache-Control": "no-store, max-age=0" } })
}
