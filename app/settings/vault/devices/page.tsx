"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Monitor } from "lucide-react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ResponsiveConfirmDialog } from "@/components/ui/responsive-confirm-dialog"
import { apiClient } from "@/lib/api/client"
import { ApiError } from "@/lib/api/client"
import type { DeviceSession } from "@/lib/api/devices"
import { useAuth } from "@/components/auth/auth-provider"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"
import { clearBudgetDeviceId } from "@/lib/auth/device-id"

function activeLabel(device: DeviceSession) {
  if (device.is_current) return "This device · Active now"
  if (!device.last_seen_at) return "Active device"
  const date = new Date(device.last_seen_at)
  return Number.isNaN(date.valueOf()) ? "Active device" : `Last active ${date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
}

function sessionLabel(device: DeviceSession) {
  const client = device.client_type.replace(/[_-]+/g, " ").trim()
  return client && client.toLowerCase() !== "web" ? client.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Browser session"
}

function sessionDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? null : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export default function VaultDevicesPage() {
  const [devices, setDevices] = useState<DeviceSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const auth = useAuth()
  const authority = useFinancialAuthority()
  const router = useRouter()
  const load = () => { setLoading(true); setError(null); void apiClient.getDevices().then((result) => setDevices(result.items.filter((item) => !item.revoked_at))).catch(() => setError("We couldn't load your devices. Try again.")).finally(() => setLoading(false)) }
  useEffect(load, [])
  const remove = async () => { if (!removeId) return; setBusy(true); setError(null); try { const result = await apiClient.revokeDevice(removeId); setDevices((current) => current.filter((item) => item.id !== removeId)); setRemoveId(null); if (result.current_device) { authority.lock(); clearBudgetDeviceId(); await auth.signOut() } } catch (error) { if (error instanceof ApiError && error.error.code === "RECENT_AUTH_REQUIRED") { await auth.signOut().catch(() => undefined); router.push(`/sign-in?returnTo=${encodeURIComponent("/settings/vault/devices")}`); return } setError(error instanceof ApiError ? error.error.message : "We couldn't remove that device. Try again.") } finally { setBusy(false) } }
  return <div className="min-h-screen bg-background pb-mobile-nav"><header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl pt-safe-header"><div className="mx-auto flex max-w-lg items-center gap-4 px-5 py-4"><Link href="/settings/vault"><Button variant="ghost" size="icon" className="rounded-full" aria-label="Back to Privacy & Vault"><ArrowLeft className="size-5" /></Button></Link><h1 className="flex-1 text-xl font-bold">Devices</h1></div></header><main className="mx-auto max-w-lg space-y-4 px-5 pt-5"><p className="text-sm text-muted-foreground">Manage the devices with an active Vault session.</p>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Card className="divide-y divide-border/70 overflow-hidden rounded-lg border-border/70 py-0 shadow-none">{loading ? <div className="p-5 text-sm text-muted-foreground">Loading devices...</div> : devices.length === 0 ? <div className="p-5 text-sm text-muted-foreground">No active devices found.</div> : devices.map((device) => <div key={device.id} className="flex items-center gap-3 px-4 py-4 sm:px-5"><div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary/70"><Monitor className="size-5 text-muted-foreground" /></div><div className="min-w-0 flex-1"><p className="truncate font-medium">{device.label || "Unnamed device"}</p><p className="mt-0.5 text-sm text-muted-foreground">{sessionLabel(device)} · {activeLabel(device)}</p><p className="mt-0.5 text-xs text-muted-foreground/80">Quick Unlock {device.quick_unlock.status === "enabled" ? "enabled" : "not enabled"}</p>{sessionDate(device.created_at) && <p className="mt-0.5 text-xs text-muted-foreground/80">Session started {sessionDate(device.created_at)}</p>}</div><Button type="button" variant="ghost" className="shrink-0" onClick={() => setRemoveId(device.id)}>{device.is_current ? "Remove this device" : "Remove"}</Button></div>)}</Card></main><ResponsiveConfirmDialog open={removeId !== null} onOpenChange={(open) => !open && !busy && setRemoveId(null)} title="Remove this device?" description="Budget will sign this device out and disable its Quick Unlock access. Your Vault and other devices will not change." confirmLabel={busy ? "Removing..." : "Remove device"} confirmVariant="destructive" confirmDisabled={busy} closeDisabled={busy} onConfirm={() => void remove()} /><BottomNav /></div>
}
