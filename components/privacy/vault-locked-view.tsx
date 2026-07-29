"use client"

import { useRef, useState } from "react"
import { LockKeyhole } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { VaultRecoveryPanel } from "./vault-recovery-panel"
import { useFinancialAuthority } from "./financial-authority-provider"
import { isQuickUnlockCancellation, quickUnlockErrorMessage } from "@/lib/privacy/quick-unlock-ui"

export function VaultLockedView() {
  const authority = useFinancialAuthority()
  const [passphraseOpen, setPassphraseOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const quickButtonRef = useRef<HTMLButtonElement>(null)
  const quickAvailable = authority.quickUnlockCapability === "supported" && authority.quickUnlockStatus === "enrolled"

  async function quickUnlock() {
    if (busy) return
    setBusy(true); setMessage("")
    try { await authority.unlockWithQuickUnlock() }
    catch (error) { if (!isQuickUnlockCancellation(error)) setMessage(quickUnlockErrorMessage(error)); requestAnimationFrame(() => quickButtonRef.current?.focus()) }
    finally { setBusy(false) }
  }

  return <div className="min-h-screen bg-background pb-mobile-nav">
    <main className="mx-auto flex min-h-[calc(100svh-5rem)] max-w-lg items-center px-5 py-8">
      <Card className="w-full space-y-5 p-6 text-center shadow-sm" data-testid="encrypted-vault-locked-boundary">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground"><LockKeyhole className="size-6" aria-hidden="true" /></div>
        <div><h1 className="text-lg font-semibold">Your Vault is locked</h1><p className="mt-2 text-sm text-muted-foreground">Unlock to view and update your financial data.</p></div>
        {message && <p role="status" className="text-sm text-destructive">{message}</p>}
        {quickAvailable && <Button ref={quickButtonRef} type="button" className="min-h-11 w-full" disabled={busy} onClick={() => void quickUnlock()}>{busy ? "Unlocking…" : "Quick Unlock"}</Button>}
        <button type="button" className="min-h-11 px-3 text-sm font-medium text-muted-foreground underline underline-offset-4" onClick={() => setPassphraseOpen(true)}>Use Vault passphrase</button>
      </Card>
    </main>
    <ResponsiveDialog open={passphraseOpen} onOpenChange={setPassphraseOpen} title="Unlock your Vault" description="Use your Vault passphrase to continue." mobileSize="compact" preventInitialFocus bodyClassName="px-4 py-5 sm:px-6"><VaultRecoveryPanel flow="unlock" onComplete={() => setPassphraseOpen(false)} /></ResponsiveDialog>
  </div>
}
