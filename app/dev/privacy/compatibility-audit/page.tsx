import { notFound } from "next/navigation"
import { CompatibilityAuditClient } from "./compatibility-audit-client"

export default function CompatibilityAuditPage() {
  if (process.env.NEXT_PUBLIC_ENABLE_COMPATIBILITY_AUDIT !== "1") notFound()
  return <CompatibilityAuditClient />
}
