"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, ChevronRight, Info, KeyRound, LockKeyhole, Monitor, ShieldCheck, Zap } from "lucide-react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { PrivacySetupFlow } from "@/components/privacy/privacy-setup-flow"
import { VaultRecoveryPanel, type VaultFlow } from "@/components/privacy/vault-recovery-panel"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"
import { apiClient } from "@/lib/api/client"
import { isQuickUnlockCancellation, quickUnlockErrorMessage } from "@/lib/privacy/quick-unlock-ui"

function SettingsRow({ icon, label, description, meta, onClick, href }: { icon: React.ReactNode; label: string; description: string; meta?: string; onClick?: () => void; href?: string }) {
  const content = <div className="flex min-h-[76px] items-center gap-3 px-4 py-3 text-left sm:gap-4"><div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary/70">{icon}</div><div className="min-w-0 flex-1"><p className="truncate font-medium leading-tight">{label}</p><p className="mt-1 truncate text-sm leading-tight text-muted-foreground">{description}</p></div>{meta && <span className="max-w-[4rem] shrink-0 truncate text-right text-sm leading-tight text-muted-foreground" title={meta}>{meta}</span>}<ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" /></div>
  if (href) return <Link href={href} className="block transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">{content}</Link>
  return <button type="button" onClick={onClick} className="block w-full transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">{content}</button>
}

export default function VaultSettingsPage() {
  const authority = useFinancialAuthority()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [flow, setFlow] = useState<VaultFlow | null>(null)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [quickUnlockOpen, setQuickUnlockOpen] = useState(false)
  const [quickUnlockBusy, setQuickUnlockBusy] = useState(false)
  const [quickUnlockMessage, setQuickUnlockMessage] = useState("")
  const [deviceCount, setDeviceCount] = useState<number | null>(null)
  const returnTo = searchParams.get("returnTo")
  const safeReturnTo = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") && !returnTo.startsWith("/settings/vault") ? returnTo : null
  const finishFlow = () => { setFlow(null); if (safeReturnTo && authority.authority) router.push(safeReturnTo) }
  const enableQuickUnlock = async () => { setQuickUnlockBusy(true); setQuickUnlockMessage(""); try { await authority.enrollQuickUnlock(); setQuickUnlockOpen(false) } catch (error) { if (!isQuickUnlockCancellation(error)) setQuickUnlockMessage(quickUnlockErrorMessage(error)) } finally { setQuickUnlockBusy(false) } }
  const disableQuickUnlock = async () => { if (!window.confirm("Disable Quick Unlock?\n\nYou'll need your Vault passphrase the next time this device needs to unlock your Vault.\n\nYour Vault and Recovery Code will not change.")) return; setQuickUnlockBusy(true); setQuickUnlockMessage(""); try { await authority.revokeQuickUnlock(); setQuickUnlockOpen(false) } catch (error) { setQuickUnlockMessage(quickUnlockErrorMessage(error)) } finally { setQuickUnlockBusy(false) } }

  useEffect(() => { void apiClient.getDevices().then((result) => setDeviceCount(result.items.filter((item) => !item.revoked_at).length)).catch(() => setDeviceCount(null)) }, [])

  if (authority.isLoading) return <div className="min-h-screen bg-background pb-mobile-nav" />
  if (authority.isVaultSetupRequired) return <div className="min-h-screen bg-background pb-mobile-nav"><header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl pt-safe-header"><div className="mx-auto flex max-w-lg items-center gap-4 px-5 py-4"><Link href="/settings"><Button variant="ghost" size="icon" className="rounded-full" aria-label="Back to Settings"><ArrowLeft className="size-5" /></Button></Link><LockKeyhole className="size-5 text-muted-foreground" aria-hidden="true" /><h1 className="flex-1 text-xl font-bold">Privacy &amp; Vault</h1></div></header><main className="mx-auto max-w-lg space-y-4 px-5 pt-5"><PrivacySetupFlow /></main><BottomNav /></div>

  return <div className="min-h-screen bg-background pb-mobile-nav">
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl pt-safe-header"><div className="mx-auto flex max-w-lg items-center gap-4 px-5 py-4"><Link href="/settings"><Button variant="ghost" size="icon" className="rounded-full" aria-label="Back to Settings"><ArrowLeft className="size-5" /></Button></Link><LockKeyhole className="size-5 text-muted-foreground" aria-hidden="true" /><h1 className="flex-1 text-xl font-bold">Privacy &amp; Vault</h1></div></header>
    <main className="mx-auto max-w-lg space-y-5 px-5 pb-6 pt-5">
      <p className="text-sm text-muted-foreground">Your financial data is protected by your Vault.</p>
      <section className="space-y-2"><h2 className="px-1 text-sm font-semibold">Vault status</h2><Card className="overflow-hidden rounded-lg border-border/70 py-0 shadow-none"><SettingsRow icon={<LockKeyhole className="size-5 text-muted-foreground" />} label="Vault" description={authority.authority ? "Unlocked on this device" : "Locked"} meta={authority.quickUnlockStatus === "enrolled" ? "On" : "Off"} onClick={() => setFlow("unlock")} /></Card></section>
      <section className="space-y-2"><h2 className="px-1 text-sm font-semibold">Security</h2><Card className="divide-y divide-border/70 overflow-hidden rounded-lg border-border/70 py-0 shadow-none"><SettingsRow icon={<KeyRound className="size-5 text-muted-foreground" />} label="Vault passphrase" description="Change how you unlock your Vault" onClick={() => setFlow("change-passphrase")} /><SettingsRow icon={<ShieldCheck className="size-5 text-muted-foreground" />} label="Recovery code" description="Use it if you lose access" meta="Active" onClick={() => setFlow("replace-recovery")} /><SettingsRow icon={<Zap className="size-5 text-muted-foreground" />} label="Quick Unlock" description={authority.quickUnlockCapability === "unsupported" ? "Not available on this device" : "Unlock your Vault faster"} meta={authority.quickUnlockCapability === "supported" ? (authority.quickUnlockStatus === "enrolled" ? "On" : "Off") : "Off"} onClick={authority.quickUnlockCapability === "unsupported" ? undefined : () => { setQuickUnlockMessage(""); setQuickUnlockOpen(true) }} /><SettingsRow icon={<Monitor className="size-5 text-muted-foreground" />} label="Devices" description="Manage Vault access" meta={deviceCount === null ? undefined : String(deviceCount)} href="/settings/vault/devices" /></Card></section>
      <section className="space-y-2"><h2 className="px-1 text-sm font-semibold">About</h2><Card className="divide-y divide-border/70 overflow-hidden rounded-lg border-border/70 py-0 shadow-none"><SettingsRow icon={<Info className="size-5 text-muted-foreground" />} label="How your privacy works" description="Encryption, recovery & devices" onClick={() => setAboutOpen(true)} /></Card></section>
    </main>
    <ResponsiveDialog open={flow !== null} onOpenChange={(open) => !open && setFlow(null)} title={flow === "unlock" ? "Unlock your Vault" : flow === "recovery" ? "Recover your Vault" : flow === "change-passphrase" ? "Change Vault passphrase" : "Replace Recovery Code"} description={flow === "unlock" ? "Use your Vault passphrase to continue." : undefined} mobileSize="compact" preventInitialFocus bodyClassName="px-4 py-5 sm:px-6"><VaultRecoveryPanel flow={flow ?? "unlock"} onComplete={finishFlow} /><>{flow === "unlock" && <button type="button" className="mt-4 text-sm text-muted-foreground underline" onClick={() => setFlow("recovery")}>Forgot passphrase? Use Recovery Code</button>}</></ResponsiveDialog>
    <ResponsiveDialog open={aboutOpen} onOpenChange={setAboutOpen} title="How your privacy works" mobileSize="compact"><div className="space-y-5 text-sm"><div><h2 className="font-semibold">Encrypted on your device</h2><p className="mt-1 text-muted-foreground">Your financial information is encrypted before it is stored.</p></div><div><h2 className="font-semibold">Your Vault stays yours</h2><p className="mt-1 text-muted-foreground">Your Vault passphrase and Recovery Code are not stored in a form we can use to unlock your data.</p></div><div><h2 className="font-semibold">Recovery is yours</h2><p className="mt-1 text-muted-foreground">If you forget your passphrase, your Recovery Code can restore access. If you lose both, we can&apos;t recover the encrypted data.</p></div></div></ResponsiveDialog>
    <ResponsiveDialog open={quickUnlockOpen} onOpenChange={setQuickUnlockOpen} title="Quick Unlock" mobileSize="compact" bodyClassName="px-4 py-5 sm:px-6"><div className="space-y-5 text-sm"><div><h2 className="font-semibold">{authority.quickUnlockStatus === "enrolled" ? "Enabled on this device" : "Unlock your Vault faster"}</h2><p className="mt-1 text-muted-foreground">Quick Unlock uses this device&apos;s built-in security. Your Vault passphrase and Recovery Code will continue to work.</p></div>{quickUnlockMessage && <p role="status" className="text-destructive">{quickUnlockMessage}</p>}{authority.quickUnlockStatus === "enrolled" ? <Button type="button" variant="destructive" className="min-h-11 w-full" disabled={quickUnlockBusy} onClick={() => void disableQuickUnlock()}>{quickUnlockBusy ? "Disabling…" : "Disable Quick Unlock"}</Button> : <Button type="button" className="min-h-11 w-full" disabled={quickUnlockBusy} onClick={() => void enableQuickUnlock()}>{quickUnlockBusy ? "Setting up…" : "Enable Quick Unlock"}</Button>}<button type="button" className="min-h-11 w-full text-muted-foreground underline underline-offset-4" onClick={() => setQuickUnlockOpen(false)}>Not now</button></div></ResponsiveDialog>
    <BottomNav />
  </div>
}
