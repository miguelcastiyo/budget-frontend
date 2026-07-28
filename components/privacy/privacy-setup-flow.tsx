"use client"

import { useEffect, useRef, useState } from "react"
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
import { runMigrationStaging, type MigrationStage } from "@/lib/privacy/migration"

type Step = "intro" | "passphrase" | "recovery" | "ready" | "migrating" | "success" | "failure" | "cancelled"

function errorMessage(error: unknown): string {
  const code = error instanceof ApiError ? error.error.code : error instanceof Error ? error.message : ""
  if (code === "RECENT_AUTH_REQUIRED") return "Please sign in again before continuing."
  if (code === "MIGRATION_ALREADY_ACTIVE") return "Privacy setup is already in progress."
  if (code === "VAULT_NOT_INITIALIZED") return "Your Vault needs to be set up first."
  if (code === "STALE_FINANCIAL_REVISION") return "Your financial data changed while setup was starting. Please try again."
  if (code === "STAGING_VERIFICATION_FAILED") return "We couldn't verify the encrypted copy. Please try again."
  if (code === "CUTOVER_CONFLICT") return "We couldn't finish the final step. Your previous financial data is still protected."
  if (code === "VAULT_UNLOCK_FAILED") return "That Vault passphrase didn't work."
  return "We couldn't finish encrypting your data. Your existing financial data has not been replaced. You can try again."
}

function payloadFromMetadata(metadata: Awaited<ReturnType<typeof apiClient.getVault>>): VaultInitializationPayload {
  return { crypto_profile_version: metadata.crypto_profile_version, passphrase_wrap: metadata.passphrase, recovery_wrap: metadata.recovery }
}

const stageCopy: Record<MigrationStage, string> = {
  snapshot_validating: "Preparing your data",
  transforming: "Preparing your data",
  encrypting: "Encrypting your data",
  uploading: "Encrypting your data",
  verifying: "Verifying",
  staged_ready: "Finishing up",
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
  const [migrationId, setMigrationId] = useState<string | null>(null)
  const [statusText, setStatusText] = useState("Preparing your data")
  const [error, setError] = useState<string | null>(null)
  const [activeMigration, setActiveMigration] = useState(false)
  const [vaultReady, setVaultReady] = useState(false)
  const [requiresRecentAuth, setRequiresRecentAuth] = useState(false)
  const [accountPassword, setAccountPassword] = useState("")

  useEffect(() => {
    let mounted = true
    void apiClient.getPrivacyStatus().then((status) => {
      if (!mounted || status.financial_privacy_state === "encrypted") return
      if (status.active_migration) {
        setMigrationId(status.active_migration.migration_id)
        setActiveMigration(true)
        setStep("passphrase")
      }
      void apiClient.getVault().then(() => { if (mounted) setVaultReady(true) }).catch(() => undefined)
    }).catch(() => undefined)
    return () => { mounted = false }
  }, [])

  const begin = () => { setError(null); setStep("passphrase") }

  const initialize = async () => {
    setError(null)
    setRequiresRecentAuth(false)
    const passphraseError = validateNewPassphrase(passphrase)
    if (passphraseError) { setError(passphraseError); return }
    if (passphrase !== confirmPassphrase) { setError("The passphrases do not match."); return }
    try {
      const result = await manager.initialize(passphrase)
      createdRef.current = result
      setStep("recovery")
    } catch (cause) {
      const recentAuth = cause instanceof ApiError && cause.error.code === "RECENT_AUTH_REQUIRED"
      setRequiresRecentAuth(recentAuth)
      setError(errorMessage(cause))
    }
  }

  const confirmRecovery = async () => {
    const created = createdRef.current
    if (!created) return
    setError(null)
    try {
      if (authority.mode === "setup") {
        await apiClient.initializeVault(created.payload)
        await authority.refresh()
        setStep("success")
      } else {
        await apiClient.initializeVault(created.payload)
        setVaultReady(true)
        setStep("ready")
      }
    } catch (cause) {
      setError(authority.mode === "setup" ? "We couldn't finish setting up your Vault. Nothing financial has been created yet. Try again." : errorMessage(cause))
    }
  }

  const finishMigration = async (id: string, runtimeKey: CryptoKey, vaultId: string) => {
    const snapshot = await apiClient.getMigrationSnapshot(id)
    await runMigrationStaging({
      snapshot,
      runtimeKey,
      vaultId,
      putManifest: (manifest) => apiClient.putMigrationManifest(id, manifest),
      putRecord: (recordId, record) => apiClient.putMigrationRecord(id, recordId, record),
      verify: () => apiClient.verifyMigration(id),
      onStage: (stage) => setStatusText(stageCopy[stage]),
    })
    const result = await apiClient.cutoverMigration(id)
    if (result.financial_privacy_state !== "encrypted") throw new Error("CUTOVER_CONFLICT")
    setStep("success")
  }

  const start = async () => {
    setError(null)
    setStep("migrating")
    try {
      const created = createdRef.current
      let id = migrationId
      let runtimeKey = created?.runtimeKey
      if (!id) {
        const started = await apiClient.startMigration()
        id = started.migration.migration_id
        setMigrationId(id)
      }
      if (!runtimeKey) {
        const metadata = await apiClient.getVault()
        runtimeKey = await manager.unlockWithPassphrase(passphrase, payloadFromMetadata(metadata))
      }
      const metadata = await apiClient.getVault()
      await finishMigration(id, runtimeKey, metadata.vault_id)
    } catch (cause) {
      setError(errorMessage(cause))
      setStep("failure")
    }
  }

  const resumeExistingVault = async () => {
    setError(null)
    setRequiresRecentAuth(false)
    try {
      const metadata = await apiClient.getVault()
      await manager.unlockWithPassphrase(passphrase, payloadFromMetadata(metadata))
      setStep("ready")
    } catch (cause) { setError(errorMessage(cause)) }
  }

  const cancel = async () => {
    if (!migrationId) { setStep("intro"); return }
    try { await apiClient.cancelMigration(migrationId); manager.lock(); setMigrationId(null); setActiveMigration(false); setStep("cancelled") }
    catch (cause) { setError(errorMessage(cause)) }
  }

  const continueAfterCutover = async () => {
    try {
      await authority.refresh()
      await authority.unlock(passphrase)
      manager.lock()
      createdRef.current = null
      setVaultReady(false)
      setPassphrase("")
      setConfirmPassphrase("")
      router.push("/settings")
    } catch (cause) { setError(errorMessage(cause)) }
  }

  const reauthenticate = async () => {
    await signOut()
    router.push("/sign-in?returnTo=%2Fsettings%2Fvault")
  }

  const reauthenticateWithPassword = async () => {
    if (!profile || profile.auth_provider !== "password" || !accountPassword) return
    try {
      await apiClient.signInWithPassword({ email: profile.email, password: accountPassword, client_type: "web" })
      setAccountPassword("")
      setRequiresRecentAuth(false)
      await initialize()
    } catch (cause) {
      setAccountPassword("")
      setError(cause instanceof ApiError && cause.error.code === "UNAUTHENTICATED" ? "That account password was not accepted." : errorMessage(cause))
    }
  }

  if (authority.mode === "encrypted") return null

  return <Card className="space-y-4 p-4" data-testid="privacy-setup-flow">
    {step === "intro" && <>
      <div><h2 className="font-semibold">Protect your financial data</h2><p className="mt-1 text-sm text-muted-foreground">{authority.mode === "setup" ? "Your financial data is encrypted before it is stored. Create your Vault passphrase and save your Recovery Code before you start budgeting." : "Your financial data is currently stored using the standard account format. You can protect it with your private Vault."}</p></div>
      <Button type="button" onClick={begin} data-testid="privacy-setup-start">{vaultReady ? "Continue privacy setup" : authority.mode === "setup" ? "Create your Vault" : "Protect my financial data"}</Button>
    </>}

    {step === "passphrase" && <>
      <div><h2 className="font-semibold">{activeMigration || vaultReady ? "Privacy setup in progress" : "Create your Vault passphrase"}</h2><p className="mt-1 text-sm text-muted-foreground">{activeMigration || vaultReady ? "Unlock your Vault passphrase to continue protecting your financial data." : "This passphrase unlocks your financial data. It is separate from how you sign in to your account."}</p></div>
      <div className="space-y-2"><Input aria-label="Vault passphrase" placeholder="Vault passphrase" type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} autoComplete="new-password" /><p className="text-xs text-muted-foreground">Use at least 12 characters. Keep it somewhere safe.</p>{!activeMigration && !vaultReady && <Input aria-label="Confirm Vault passphrase" placeholder="Confirm Vault passphrase" type="password" value={confirmPassphrase} onChange={(event) => setConfirmPassphrase(event.target.value)} autoComplete="new-password" />}</div>
      <div className="flex gap-2"><Button type="button" onClick={() => void (activeMigration ? start() : vaultReady ? resumeExistingVault() : initialize())} disabled={!passphrase}>{activeMigration ? "Resume encryption" : vaultReady ? "Continue" : "Continue"}</Button>{!activeMigration && !vaultReady && <Button type="button" variant="ghost" onClick={() => setStep("intro")}>Back</Button>}{activeMigration && <Button type="button" variant="outline" onClick={() => void cancel()}>Cancel setup</Button>}</div>
    </>}

    {step === "recovery" && createdRef.current && <RecoveryCodeCeremony code={createdRef.current.recoverySecret} onConfirmed={() => void confirmRecovery()} onCancel={() => { manager.lock(); createdRef.current = null; setStep("intro") }} />}

    {step === "ready" && <>
      <div><h2 className="font-semibold">You're ready to protect your financial data</h2><p className="mt-1 text-sm text-muted-foreground">Your Vault passphrase and Recovery Code are ready. If you lose both, we can't recover your encrypted financial data for you.</p></div>
      <div className="space-y-2 rounded-md bg-secondary/30 p-3 text-sm"><div className="flex justify-between"><span>Vault passphrase</span><span>Ready</span></div><div className="flex justify-between"><span>Recovery Code</span><span>Saved</span></div></div>
      <div className="flex gap-2"><Button type="button" onClick={() => void start()} data-testid="privacy-setup-encrypt">Encrypt my financial data</Button><Button type="button" variant="ghost" onClick={() => setStep("recovery")}>Back</Button></div>
    </>}

    {step === "migrating" && <div className="space-y-3" data-testid="privacy-migration-progress"><div><h2 className="font-semibold">Protecting your financial data</h2><p className="mt-1 text-sm text-muted-foreground">{statusText}</p></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full w-2/3 animate-pulse rounded-full bg-primary" /></div><Button type="button" variant="outline" onClick={() => void cancel()}>Cancel setup</Button></div>}

    {step === "success" && <div className="space-y-3"><h2 className="font-semibold">You&apos;re ready</h2><p className="text-sm text-muted-foreground">Your financial data will be protected by your Vault.</p><Button type="button" onClick={() => void continueAfterCutover()}>Start budgeting</Button></div>}

    {(step === "failure" || step === "cancelled") && <div className="space-y-3"><h2 className="font-semibold">{step === "cancelled" ? "Privacy setup cancelled" : "We couldn't finish encrypting your data"}</h2><p className="text-sm text-muted-foreground">{step === "cancelled" ? "Your existing financial data remains available in its previous format." : "Your existing financial data has not been replaced."}</p><div className="flex gap-2"><Button type="button" onClick={() => { setError(null); setActiveMigration(Boolean(migrationId)); setStep(migrationId ? "passphrase" : vaultReady ? "passphrase" : "intro") }}>{step === "cancelled" ? "Continue setup" : "Try again"}</Button>{step === "failure" && migrationId && <Button type="button" variant="outline" onClick={() => void cancel()}>Cancel setup</Button>}</div></div>}
    {error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{error}</p>{requiresRecentAuth && <div className="space-y-2"><p className="text-muted-foreground">For this security step, confirm your account sign-in again.</p>{profile?.auth_provider === "password" && <div className="flex gap-2"><Input aria-label="Account password for re-authentication" placeholder="Account password" type="password" value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} autoComplete="current-password" /><Button type="button" variant="outline" onClick={() => void reauthenticateWithPassword()} disabled={!accountPassword}>Re-authenticate</Button></div>}<Button type="button" variant="outline" onClick={() => void reauthenticate()}>Sign out and sign in again</Button></div>}</div>}
  </Card>
}
