"use client"

import { useEffect, useState } from "react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { ResponsiveConfirmDialog } from "@/components/ui/responsive-confirm-dialog"
import { Label } from "@/components/ui/label"
import type { MasterApiKeyMetadata } from "@/lib/api/types"
import { ArrowLeft, Plus, Key, Trash2, Copy, Check, Eye, EyeOff } from "lucide-react"
import Link from "next/link"
import { ApiError, apiClient } from "@/lib/api/client"
import { formatDateValue } from "@/lib/date-filters"

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never"
  return formatDateValue(dateStr, { month: "short", day: "numeric", year: "numeric" })
}

function statusLabel(status: MasterApiKeyMetadata["status"]): string {
  if (status === "active") return "Active"
  if (status === "expired") return "Expired"
  return "Revoked"
}

function statusClassName(status: MasterApiKeyMetadata["status"]): string {
  if (status === "active") return "bg-success/10 text-success"
  if (status === "expired") return "bg-warning/10 text-warning"
  return "bg-muted text-muted-foreground"
}

export default function ApiKeysSettingsPage() {
  const [apiKeys, setApiKeys] = useState<MasterApiKeyMetadata[]>([])
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadApiKeys = async () => {
      try {
        const response = await apiClient.getMasterApiKeys()
        setApiKeys(response.items)
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.error.message)
        } else {
          setError("Unable to load API keys")
        }
      } finally {
        setIsLoading(false)
      }
    }

    void loadApiKeys()
  }, [])

  const handleCreateKey = async () => {
    const name = newKeyName.trim()
    if (!name) {
      return
    }

    setIsMutating(true)
    setError(null)

    try {
      const created = await apiClient.createMasterApiKey({ name })
      setApiKeys((previous) => [...previous, created])
      setCreatedKey(created.api_key)
      setShowCreateDialog(false)
      setShowNewKeyDialog(true)
      setNewKeyName("")
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to create API key")
      }
    } finally {
      setIsMutating(false)
    }
  }

  const handleDeleteKey = async () => {
    if (!deleteKeyId) {
      return
    }

    setIsMutating(true)
    setError(null)

    try {
      await apiClient.deleteMasterApiKey(deleteKeyId)
      setApiKeys((previous) => previous.filter((key) => key.id !== deleteKeyId))
      setDeleteKeyId(null)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to revoke API key")
      }
    } finally {
      setIsMutating(false)
    }
  }

  const handleCopyKey = async () => {
    if (!createdKey) {
      return
    }

    await navigator.clipboard.writeText(createdKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-background pb-mobile-nav">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl pt-safe-header">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-4">
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold flex-1">API Keys</h1>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 pt-5 space-y-4">
        <p className="text-sm text-muted-foreground">
          API keys allow you to access the Budget API for testing and development purposes. Keep your keys secure and never share them publicly.
        </p>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!isLoading && apiKeys.length > 0 ? (
          <Card className="overflow-hidden border-0 shadow-sm divide-y divide-border">
            {apiKeys.map((key) => (
              <div key={key.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                    <Key className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{key.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClassName(key.status)}`}>
                        {statusLabel(key.status)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground font-mono">
                      {key.key_prefix}...
                    </p>
                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                      <span>Created {formatDate(key.created_at)}</span>
                      <span>Last used {formatDate(key.last_used_at)}</span>
                    </div>
                    {key.expires_at ? (
                      <p className="text-xs text-warning mt-1">
                        Expires {formatDate(key.expires_at)}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">No expiration</p>
                    )}
                  </div>
                  {key.status === "active" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded-full text-destructive hover:text-destructive"
                      onClick={() => setDeleteKeyId(key.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </Card>
        ) : (
          <Card className="p-8 border-0 shadow-sm text-center">
            <Key className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No API Keys</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create an API key to start using the Budget API.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              Create API Key
            </Button>
          </Card>
        )}
      </main>

      <ResponsiveDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        title="Create API Key"
        description="Give your API key a name to help you identify it later."
        mobileSize="compact"
        desktopClassName="sm:w-[min(calc(100dvw-2rem),32rem)] sm:max-w-[32rem]"
        headerClassName="px-5 pb-4 pt-3 sm:px-6 sm:pt-5"
        bodyClassName="space-y-4 px-5 py-5 sm:px-6"
        footerClassName="px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-4"
        footer={
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowCreateDialog(false)}
              className="h-12 rounded-xl px-4"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreateKey()}
              disabled={!newKeyName.trim() || isMutating}
              className="h-12 rounded-xl"
            >
              {isMutating ? "Creating..." : "Create Key"}
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          <Label htmlFor="keyName">Name</Label>
          <Input
            id="keyName"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="e.g., Development Key"
            className="h-12 rounded-xl"
          />
        </div>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={showNewKeyDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowNewKeyDialog(false)
            setCreatedKey(null)
            setShowKey(false)
          }
        }}
        title="API Key Created"
        description="Copy your API key now. You will not be able to see it again."
        mobileSize="compact"
        desktopClassName="sm:w-[min(calc(100dvw-2rem),34rem)] sm:max-w-[34rem]"
        headerClassName="px-5 pb-4 pt-3 sm:px-6 sm:pt-5"
        bodyClassName="px-5 py-5 sm:px-6"
        footerClassName="px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-4"
        footer={
          <Button
            type="button"
            onClick={() => {
              setShowNewKeyDialog(false)
              setCreatedKey(null)
              setShowKey(false)
            }}
            className="h-12 w-full rounded-xl"
          >
            Done
          </Button>
        }
      >
        <div className="flex items-center gap-2 rounded-xl bg-secondary p-3">
          <code className="flex-1 break-all text-sm font-mono">
            {showKey ? createdKey : createdKey?.replace(/./g, "•")}
          </code>
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full flex-shrink-0"
            onClick={() => setShowKey(!showKey)}
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full flex-shrink-0"
            onClick={() => void handleCopyKey()}
          >
            {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </ResponsiveDialog>

      <ResponsiveConfirmDialog
        open={!!deleteKeyId}
        onOpenChange={(open) => {
          if (!open && !isMutating) {
            setDeleteKeyId(null)
          }
        }}
        title="Revoke API Key?"
        description="This will permanently revoke this API key. Any applications using this key will no longer be able to authenticate."
        confirmLabel={isMutating ? "Revoking..." : "Revoke Key"}
        confirmVariant="destructive"
        confirmDisabled={isMutating}
        closeDisabled={isMutating}
        onConfirm={() => void handleDeleteKey()}
      />

      <BottomNav />
    </div>
  )
}
