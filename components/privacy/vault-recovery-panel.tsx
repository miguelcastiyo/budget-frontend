"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RecoveryCodeCeremony } from "./recovery-code-ceremony"
import { useFinancialAuthority } from "./financial-authority-provider"
import { validateNewPassphrase } from "@/lib/privacy/vault-crypto"

export type VaultFlow = "unlock" | "recovery" | "change-passphrase" | "replace-recovery"

function friendlyUnlockError(error: unknown) {
  const code = error instanceof Error ? error.message.split(":")[0] : ""
  if (code === "ENCRYPTED_RECORD_DECRYPT_FAILED") return "We couldn't restore one encrypted record. Your Vault remains locked."
  if (code === "ENCRYPTED_RECORD_REHYDRATION_FAILED") return "We couldn't restore your encrypted records. Your Vault remains locked."
  if (code === "ENCRYPTED_RECORD_PAYLOAD_INVALID") return "An encrypted record is invalid. Your Vault remains locked."
  return "We couldn't unlock your Vault. Check your passphrase and try again."
}

export function VaultRecoveryPanel({ flow, onComplete }: { flow: VaultFlow; onComplete?: () => void }) {
  const authority = useFinancialAuthority()
  const [passphrase, setPassphrase] = useState("")
  const [currentPassphrase, setCurrentPassphrase] = useState("")
  const [recoverySecret, setRecoverySecret] = useState("")
  const [newPassphrase, setNewPassphrase] = useState("")
  const [confirmPassphrase, setConfirmPassphrase] = useState("")
  const [recoveryStep, setRecoveryStep] = useState<"code" | "passphrase">("code")
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [newRecoveryCode, setNewRecoveryCode] = useState<string | null>(null)

  const run = async (action: () => Promise<void>, success: string, complete = true) => {
    setBusy(true); setStatus(null)
    try { await action(); if (success) setStatus(success); if (complete) onComplete?.() }
    catch (error) { setStatus(error instanceof Error && error.message === "VAULT_PASSPHRASE_TOO_WEAK" ? "Choose a longer, unique Vault passphrase that is not a common word or pattern." : flow === "unlock" ? friendlyUnlockError(error) : "We couldn't complete that Vault change. Try again.") }
    finally { setBusy(false) }
  }

  if (flow === "unlock") return <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void run(async () => { await authority.unlock(passphrase); setPassphrase("") }, "Vault unlocked.") }}>
    <div className="space-y-1"><label htmlFor="vault-passphrase" className="text-sm font-medium">Vault passphrase</label><Input id="vault-passphrase" type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} autoComplete="current-password" autoFocus /></div>
    {status && <p role="alert" className="text-sm text-muted-foreground">{status}</p>}
    <Button type="submit" className="w-full" disabled={!passphrase || busy}>{busy ? "Unlocking..." : "Unlock Vault"}</Button>
  </form>

  if (flow === "recovery") {
    if (recoveryStep === "code") return <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Use your Recovery Code to restore access, then choose a new Vault passphrase.</p>
      <div className="space-y-1"><label htmlFor="vault-recovery-code" className="text-sm font-medium">Recovery Code</label><Input id="vault-recovery-code" value={recoverySecret} onChange={(event) => setRecoverySecret(event.target.value)} autoComplete="off" autoFocus /></div>
      {status && <p role="alert" className="text-sm text-muted-foreground">{status}</p>}
      <Button type="button" className="w-full" disabled={!recoverySecret.trim()} onClick={() => { setStatus(null); setRecoveryStep("passphrase") }}>Continue</Button>
      <button type="button" className="block text-sm text-muted-foreground underline" onClick={() => setStatus("If you lose both your Vault passphrase and Recovery Code, encrypted financial data cannot be recovered.")}>I don't have my Recovery Code</button>
    </div>
    return <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const passphraseError = validateNewPassphrase(newPassphrase); if (passphraseError) { setStatus(passphraseError); return } void run(async () => { await authority.unlockWithRecovery(recoverySecret, newPassphrase); setRecoverySecret(""); setNewPassphrase(""); setConfirmPassphrase("") }, "Vault access restored. Your new passphrase is ready to use.") }}>
      <p className="text-sm text-muted-foreground">Create a new passphrase for your Vault.</p>
      <div className="space-y-1"><label htmlFor="recovery-new-passphrase" className="text-sm font-medium">New Vault passphrase</label><Input id="recovery-new-passphrase" type="password" value={newPassphrase} onChange={(event) => setNewPassphrase(event.target.value)} autoComplete="new-password" autoFocus /></div>
      <div className="space-y-1"><label htmlFor="recovery-confirm-passphrase" className="text-sm font-medium">Confirm new Vault passphrase</label><Input id="recovery-confirm-passphrase" type="password" value={confirmPassphrase} onChange={(event) => setConfirmPassphrase(event.target.value)} autoComplete="new-password" /></div>
      {status && <p role="alert" className="text-sm text-muted-foreground">{status}</p>}
      <div className="flex gap-2"><Button type="button" variant="ghost" onClick={() => setRecoveryStep("code")}>Back</Button><Button type="submit" className="flex-1" disabled={!newPassphrase || newPassphrase !== confirmPassphrase || busy}>{busy ? "Restoring..." : "Restore Vault"}</Button></div>
    </form>
  }

  if (flow === "change-passphrase") return <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const passphraseError = validateNewPassphrase(newPassphrase); if (passphraseError) { setStatus(passphraseError); return } void run(async () => { await authority.unlock(currentPassphrase); await authority.changePassphrase(newPassphrase); setCurrentPassphrase(""); setNewPassphrase(""); setConfirmPassphrase("") }, "Vault passphrase updated.") }}>
    <p className="text-sm text-muted-foreground">Your encrypted financial data stays the same.</p>
    <div className="space-y-1"><label htmlFor="current-vault-passphrase" className="text-sm font-medium">Current Vault passphrase</label><Input id="current-vault-passphrase" type="password" value={currentPassphrase} onChange={(event) => setCurrentPassphrase(event.target.value)} autoComplete="current-password" autoFocus /></div>
    <div className="space-y-1"><label htmlFor="new-vault-passphrase" className="text-sm font-medium">New Vault passphrase</label><Input id="new-vault-passphrase" type="password" value={newPassphrase} onChange={(event) => setNewPassphrase(event.target.value)} autoComplete="new-password" /></div>
    <div className="space-y-1"><label htmlFor="confirm-vault-passphrase" className="text-sm font-medium">Confirm new Vault passphrase</label><Input id="confirm-vault-passphrase" type="password" value={confirmPassphrase} onChange={(event) => setConfirmPassphrase(event.target.value)} autoComplete="new-password" /></div>
    {status && <p role="alert" className="text-sm text-muted-foreground">{status}</p>}
    <Button type="submit" className="w-full" disabled={!currentPassphrase || !newPassphrase || newPassphrase !== confirmPassphrase || busy}>{busy ? "Updating..." : "Change passphrase"}</Button>
  </form>

  if (newRecoveryCode) return <RecoveryCodeCeremony code={newRecoveryCode} onConfirmed={() => { setNewRecoveryCode(null); onComplete?.() }} onCancel={() => setNewRecoveryCode(null)} />
  return <div className="space-y-4"><p className="text-sm text-muted-foreground">Create a replacement Recovery Code. Your current code will stop working after replacement.</p><Button type="button" className="w-full" disabled={busy} onClick={() => void run(async () => setNewRecoveryCode(await authority.rotateRecoverySecret()), "", false)}>Create new Recovery Code</Button>{status && <p role="alert" className="text-sm text-muted-foreground">{status}</p>}</div>
}
