"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { RecoveryCodeCeremony } from "./recovery-code-ceremony"
import { useFinancialAuthority } from "./financial-authority-provider"
import { useAuth } from "@/components/auth/auth-provider"
import { ApiError, apiClient } from "@/lib/api/client"
import { createVault, type CreatedVault, type VaultInitializationPayload, validateNewPassphrase } from "@/lib/privacy/vault-crypto"
import { VaultManager } from "@/lib/privacy/vault-manager"

type Step = "intro" | "passphrase" | "recovery" | "success" | "failure"

function errorMessage(error: unknown): string {
  const code = error instanceof ApiError ? error.error.code : error instanceof Error ? error.message : ""
  if (code === "RECENT_AUTH_REQUIRED") return "Please sign in again before continuing."
  if (code === "VAULT_ALREADY_INITIALIZED") return "Your Vault is already initialized. Refresh and try again."
  return "We couldn't finish setting up your Vault. Nothing financial has been created yet. You can try again."
}

function payloadFromMetadata(metadata: Awaited<ReturnType<typeof apiClient.getVault>>): VaultInitializationPayload {
  return { crypto_profile_version: metadata.crypto_profile_version, passphrase_wrap: metadata.passphrase, recovery_wrap: metadata.recovery }
}

export function PrivacySetupFlow() {
  const authority = useFinancialAuthority()
  const { profile, signOut } = useAuth()
  const router = useRouter()
  const manager = useRef(new VaultManager()).current
  const createdRef = useRef<CreatedVault | null>(null)
  const [step, setStep] = useState<Step>("intro")
  const [passphrase, setPassphrase] = useState("")
  const [confirmPassphrase, setConfirmPassphrase] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [requiresRecentAuth, setRequiresRecentAuth] = useState(false)
  const [accountPassword, setAccountPassword] = useState("")

  if (authority.mode === "encrypted") return null

  const begin = () => { setError(null); setStep("passphrase") }

  const initialize = async () => {
    setError(null)
    setRequiresRecentAuth(false)
    const passphraseError = validateNewPassphrase(passphrase)
    if (passphraseError) { setError(passphraseError); return }
    if (passphrase !== confirmPassphrase) { setError("The passphrases do not match."); return }
    try {
      createdRef.current = await createVault(passphrase)
      setStep("recovery")
    } catch (cause) {
      setRequiresRecentAuth(cause instanceof ApiError && cause.error.code === "RECENT_AUTH_REQUIRED")
      setError(errorMessage(cause))
    }
  }

  const confirmRecovery = async () => {
    const created = createdRef.current
    if (!created) return
    setError(null)
    try {
      await apiClient.initializeVault(created.payload)
      await authority.refresh()
      setStep("success")
    } catch (cause) {
      setRequiresRecentAuth(cause instanceof ApiError && cause.error.code === "RECENT_AUTH_REQUIRED")
      setError(errorMessage(cause))
    }
  }

  const reauthenticate = async () => { await signOut(); router.push("/sign-in?returnTo=%2Fsettings%2Fvault") }
  const reauthenticateWithPassword = async () => {
    if (!profile || profile.auth_provider !== "password" || !accountPassword) return
    try {
      await apiClient.signInWithPassword({ email: profile.email, password: accountPassword, client_type: "web" })
      setAccountPassword(""); setRequiresRecentAuth(false); await initialize()
    } catch (cause) {
      setAccountPassword("")
      setError(cause instanceof ApiError && cause.error.code === "UNAUTHENTICATED" ? "That account password was not accepted." : errorMessage(cause))
    }
  }

  return <Card className="space-y-4 p-4" data-testid="privacy-setup-flow">
    {step === "intro" && <>
      <div><h2 className="font-semibold">Protect your financial data</h2><p className="mt-1 text-sm text-muted-foreground">Your financial data is encrypted before it is stored. Create your Vault passphrase and save your Recovery Code before you start budgeting.</p></div>
      <Button type="button" onClick={begin} data-testid="privacy-setup-start">Create your Vault</Button>
    </>}
    {step === "passphrase" && <>
      <div><h2 className="font-semibold">Create your Vault passphrase</h2><p className="mt-1 text-sm text-muted-foreground">This passphrase unlocks your financial data. It is separate from how you sign in to your account.</p></div>
      <div className="space-y-2"><Input aria-label="Vault passphrase" placeholder="Vault passphrase" type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} autoComplete="new-password" /><p className="text-xs text-muted-foreground">Use at least 12 characters. Keep it somewhere safe.</p><Input aria-label="Confirm Vault passphrase" placeholder="Confirm Vault passphrase" type="password" value={confirmPassphrase} onChange={(event) => setConfirmPassphrase(event.target.value)} autoComplete="new-password" /></div>
      <div className="flex gap-2"><Button type="button" onClick={() => void initialize()} disabled={!passphrase}>Continue</Button><Button type="button" variant="ghost" onClick={() => setStep("intro")}>Back</Button></div>
    </>}
    {step === "recovery" && createdRef.current && <RecoveryCodeCeremony code={createdRef.current.recoverySecret} onConfirmed={() => void confirmRecovery()} onCancel={() => { manager.lock(); createdRef.current = null; setStep("intro") }} />}
    {step === "success" && <div className="space-y-3"><h2 className="font-semibold">You&apos;re ready</h2><p className="text-sm text-muted-foreground">Your financial data is now protected by your Vault.</p><Button type="button" onClick={() => router.push("/settings")}>Start budgeting</Button></div>}
    {step === "failure" && <div className="space-y-3"><h2 className="font-semibold">We couldn&apos;t finish setting up your Vault</h2><Button type="button" onClick={() => { setError(null); setStep("intro") }}>Try again</Button></div>}
    {error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{error}</p>{requiresRecentAuth && <div className="space-y-2"><p className="text-muted-foreground">For this security step, confirm your account sign-in again.</p>{profile?.auth_provider === "password" && <div className="flex gap-2"><Input aria-label="Account password for re-authentication" placeholder="Account password" type="password" value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} autoComplete="current-password" /><Button type="button" variant="outline" onClick={() => void reauthenticateWithPassword()} disabled={!accountPassword}>Re-authenticate</Button></div>}<Button type="button" variant="outline" onClick={() => void reauthenticate()}>Sign out and sign in again</Button></div>}</div>}
  </Card>
}
