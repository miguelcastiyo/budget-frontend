"use client"

import { useMemo, useState } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"

export function CompatibilityAuditClient() {
  const { profile, isLoading: isAuthLoading } = useAuth()
  const { authority, isLoading: isAuthorityLoading } = useFinancialAuthority()
  const [copied, setCopied] = useState(false)
  const report = useMemo(() => authority?.getCompatibilityAudit() ?? null, [authority])

  if (isAuthLoading || isAuthorityLoading) return <main style={{ maxWidth: 720, margin: "3rem auto", padding: "0 1rem", fontFamily: "system-ui" }}><p>Loading owner diagnostics…</p></main>
  if (profile?.role !== "owner") return <main style={{ maxWidth: 720, margin: "3rem auto", padding: "0 1rem", fontFamily: "system-ui" }}><h1>Not available</h1><p>Owner access is required.</p></main>
  if (!authority || !report) return <main style={{ maxWidth: 720, margin: "3rem auto", padding: "0 1rem", fontFamily: "system-ui" }}><h1>Vault locked</h1><p>Unlock the financial vault, then reload this page.</p></main>

  const output = JSON.stringify(report, null, 2)
  const copyReport = async () => {
    await navigator.clipboard.writeText(output)
    setCopied(true)
  }

  return (
    <main style={{ maxWidth: 720, margin: "3rem auto", padding: "0 1rem", fontFamily: "system-ui" }}>
      <h1>Encrypted compatibility audit</h1>
      <p>This temporary owner-only diagnostic contains aggregate compatibility counts and shape names only. It does not read or output financial values, identifiers, ciphertext, or keys.</p>
      <button type="button" onClick={() => void copyReport()}>{copied ? "Copied" : "Copy report"}</button>
      <pre style={{ marginTop: "1rem", overflowX: "auto", padding: "1rem", background: "#f4f4f5", borderRadius: 8 }}>{output}</pre>
    </main>
  )
}
