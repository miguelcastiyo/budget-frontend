"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Monitor } from "lucide-react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ResponsiveConfirmDialog } from "@/components/ui/responsive-confirm-dialog"
import { ApiError, apiClient } from "@/lib/api/client"
import type { DeviceSession } from "@/lib/api/devices"
import { useAuth } from "@/components/auth/auth-provider"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"
import { clearBudgetDeviceId } from "@/lib/auth/device-id"

function sessionLabel(device: DeviceSession) {
  const client = device.client_type.replace(/[_-]+/g, " ").trim()
  return client && client.toLowerCase() !== "web" ? client.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Browser session"
}

function formatDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? null : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function activityLabel(device: DeviceSession) {
  if (device.is_current) return "Active now"
  const date = formatDate(device.last_seen_at)
  return date ? `Last active ${date}` : "Active device"
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
  const pendingDevice = removeId ? devices.find((device) => device.id === removeId) ?? null : null

  const load = () => {
    setLoading(true)
    setError(null)
    void apiClient.getDevices()
      .then((result) => setDevices(result.items.filter((item) => !item.revoked_at)))
      .catch(() => setError("We couldn't load your devices. Try again."))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const remove = async () => {
    if (!removeId) return
    setBusy(true)
    setError(null)
    try {
      const result = await apiClient.revokeDevice(removeId)
      setDevices((current) => current.filter((item) => item.id !== removeId))
      setRemoveId(null)
      if (result.current_device) {
        authority.lock()
        clearBudgetDeviceId()
        await auth.signOut()
      }
    } catch (error) {
      if (error instanceof ApiError && error.error.code === "RECENT_AUTH_REQUIRED") {
        await auth.signOut().catch(() => undefined)
        router.push(`/sign-in?returnTo=${encodeURIComponent("/settings/vault/devices")}`)
        return
      }
      setError(error instanceof ApiError ? error.error.message : "We couldn't remove that device. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const confirmationDescription = pendingDevice?.is_current
    ? "You will need to unlock your Vault again on this device."
    : "This Vault session will be revoked. Quick Unlock on that device will stop working."

  return (
    <div className="min-h-screen bg-background pb-mobile-nav">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl pt-safe-header">
        <div className="mx-auto flex max-w-lg items-center gap-4 px-5 py-4">
          <Link href="/settings/vault">
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Back to Privacy & Vault">
              <ArrowLeft className="size-5" />
            </Button>
          </Link>
          <h1 className="flex-1 text-xl font-bold">Devices</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-5 pt-4">
        <p className="text-sm text-muted-foreground">Manage the devices with an active Vault session.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <Card className="overflow-hidden rounded-2xl border-border/70 py-0 shadow-sm">
          {loading && <div className="p-5 text-sm text-muted-foreground">Loading devices...</div>}
          {!loading && devices.length === 0 && <div className="p-5 text-sm text-muted-foreground">No active devices found.</div>}
          {!loading && devices.length > 0 && (
            <div className="divide-y divide-border/70">
              {devices.map((device) => {
                const quickUnlockEnabled = device.quick_unlock.status === "enabled"
                const started = formatDate(device.created_at)
                return (
                  <div key={device.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 px-4 py-3.5 sm:px-5">
                    <div className="row-span-2 flex size-9 items-center justify-center rounded-xl bg-secondary/70">
                      <Monitor className="size-[18px] text-muted-foreground" />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="break-words font-medium leading-snug">{device.label || "Unnamed device"}</p>
                        {device.is_current && <Badge variant="outline" className="rounded-full px-1.5 py-0 text-[10px] text-muted-foreground">This device</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{sessionLabel(device)}</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="-mr-2 mt-0.5 h-8 px-2 text-xs font-medium text-muted-foreground hover:text-destructive" onClick={() => setRemoveId(device.id)}>
                      Remove
                    </Button>
                    <div className="col-start-2 col-end-4 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground/85">
                      <span>{activityLabel(device)}</span>
                      <span aria-hidden="true">·</span>
                      <span>Quick Unlock {quickUnlockEnabled ? "enabled" : "off"}</span>
                      {started && <><span aria-hidden="true">·</span><span>Started {started}</span></>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </main>

      <ResponsiveConfirmDialog
        open={removeId !== null}
        onOpenChange={(open) => !open && !busy && setRemoveId(null)}
        title="Remove this device?"
        description={confirmationDescription}
        confirmLabel={busy ? "Removing..." : "Remove device"}
        confirmVariant="destructive"
        confirmDisabled={busy}
        closeDisabled={busy}
        onConfirm={() => void remove()}
      />
      <BottomNav />
    </div>
  )
}
