"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ArrowLeft, CalendarIcon, CheckCircle, Clock, Mail, Plus, Shield, Trash2, UserPlus, XCircle } from "lucide-react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card } from "@/components/ui/card"
import { ResponsiveConfirmDialog } from "@/components/ui/responsive-confirm-dialog"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/components/auth/auth-provider"
import { ApiError, apiClient } from "@/lib/api/client"
import type { CreateInviteRequest, InviteResponse } from "@/lib/api/types"
import { cn } from "@/lib/utils"

type InviteRole = CreateInviteRequest["role"]
type InviteStatusFilter = "all" | InviteResponse["status"]

const DEFAULT_SUBJECT = "You are invited to Budget App"
const DEFAULT_BODY = "I sent you an invite to join Budget. Use the link below to accept the invitation before it expires."
const EXPIRY_PRESETS = [
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
] as const
const EXPIRY_TIME_OPTIONS = [
  { label: "9 AM", value: "09:00" },
  { label: "5 PM", value: "17:00" },
  { label: "End day", value: "23:59" },
] as const
const INVITE_STATUS_FILTERS: Array<{ label: string; value: InviteStatusFilter }> = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Accepted", value: "accepted" },
  { label: "Expired", value: "expired" },
  { label: "Revoked", value: "revoked" },
]

function toLocalDateTimeValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function dateTimeLocalDaysFromNow(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(17, 0, 0, 0)
  return toLocalDateTimeValue(date)
}

function parseLocalDateTime(value: string): Date | null {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never"
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function statusIcon(status: InviteResponse["status"]) {
  if (status === "accepted") {
    return <CheckCircle className="size-4" />
  }
  if (status === "expired" || status === "revoked") {
    return <XCircle className="size-4" />
  }
  return <Clock className="size-4" />
}

function statusClassName(status: InviteResponse["status"]): string {
  if (status === "accepted") {
    return "border-success/25 bg-success/10 text-success"
  }
  if (status === "expired" || status === "revoked") {
    return "border-muted bg-muted text-muted-foreground"
  }
  return "border-warning/25 bg-warning/10 text-warning"
}

export default function InvitesSettingsPage() {
  const { profile, isLoading: isAuthLoading } = useAuth()
  const [invites, setInvites] = useState<InviteResponse[]>([])
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [inviteeName, setInviteeName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<InviteRole>("member")
  const [expiresAt, setExpiresAt] = useState(() => dateTimeLocalDaysFromNow(7))
  const [emailSubject, setEmailSubject] = useState(DEFAULT_SUBJECT)
  const [emailBody, setEmailBody] = useState(DEFAULT_BODY)
  const [statusFilter, setStatusFilter] = useState<InviteStatusFilter>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)
  const [revokeInviteId, setRevokeInviteId] = useState<string | null>(null)
  const [deleteAccountInviteId, setDeleteAccountInviteId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isOwner = profile?.role === "owner"

  useEffect(() => {
    let isMounted = true

    const loadInvites = async () => {
      if (isAuthLoading || !isOwner) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const response = await apiClient.getInvites()
        if (isMounted) {
          setInvites(response.items)
        }
      } catch (err) {
        if (!isMounted) {
          return
        }
        if (err instanceof ApiError) {
          setError(err.error.message)
        } else {
          setError("Unable to load invites")
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadInvites()

    return () => {
      isMounted = false
    }
  }, [isAuthLoading, isOwner])

  const canCreate = useMemo(() => (
    inviteeName.trim() !== "" &&
    email.trim() !== "" &&
    expiresAt.trim() !== "" &&
    emailSubject.trim() !== "" &&
    emailBody.trim() !== ""
  ), [email, emailBody, emailSubject, expiresAt, inviteeName])

  const inviteStatusCounts = useMemo(() => {
    const counts: Record<InviteStatusFilter, number> = {
      all: invites.length,
      pending: 0,
      accepted: 0,
      expired: 0,
      revoked: 0,
    }

    for (const invite of invites) {
      counts[invite.status] += 1
    }

    return counts
  }, [invites])

  const filteredInvites = useMemo(() => (
    statusFilter === "all"
      ? invites
      : invites.filter((invite) => invite.status === statusFilter)
  ), [invites, statusFilter])

  const resetForm = () => {
    setInviteeName("")
    setEmail("")
    setRole("member")
    setExpiresAt(dateTimeLocalDaysFromNow(7))
    setEmailSubject(DEFAULT_SUBJECT)
    setEmailBody(DEFAULT_BODY)
  }

  const closeCreateDialog = () => {
    setShowCreateDialog(false)
    resetForm()
  }

  const selectedExpiryDate = parseLocalDateTime(expiresAt)
  const selectedExpiryTime = expiresAt.slice(11, 16) || "17:00"

  const updateExpiryDate = (date: Date) => {
    const current = parseLocalDateTime(expiresAt) ?? new Date()
    date.setHours(current.getHours(), current.getMinutes(), 0, 0)
    setExpiresAt(toLocalDateTimeValue(date))
  }

  const updateExpiryTime = (time: string) => {
    const [hoursRaw = "17", minutesRaw = "00"] = time.split(":")
    const next = parseLocalDateTime(expiresAt) ?? new Date()
    next.setHours(Number(hoursRaw), Number(minutesRaw), 0, 0)
    setExpiresAt(toLocalDateTimeValue(next))
  }

  const handleCreateInvite = async () => {
    if (!canCreate) {
      return
    }

    setIsMutating(true)
    setError(null)

    try {
      const created = await apiClient.createInvite({
        invitee_name: inviteeName.trim(),
        email: email.trim(),
        role,
        expires_at: new Date(expiresAt).toISOString(),
        email_subject: emailSubject.trim(),
        email_body: emailBody.trim(),
      })
      setInvites((previous) => [created, ...previous])
      setShowCreateDialog(false)
      resetForm()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to create invite")
      }
    } finally {
      setIsMutating(false)
    }
  }

  const invitePendingRevoke = revokeInviteId
    ? invites.find((invite) => invite.invite_id === revokeInviteId) ?? null
    : null
  const invitePendingAccountDelete = deleteAccountInviteId
    ? invites.find((invite) => invite.invite_id === deleteAccountInviteId) ?? null
    : null

  const handleRevokeInvite = async () => {
    if (!revokeInviteId) {
      return
    }

    setIsMutating(true)
    setError(null)

    try {
      await apiClient.revokeInvite(revokeInviteId)
      setInvites((previous) => previous.map((invite) => (
        invite.invite_id === revokeInviteId
          ? { ...invite, status: "revoked" }
          : invite
      )))
      setRevokeInviteId(null)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to revoke invite")
      }
    } finally {
      setIsMutating(false)
    }
  }

  const handleDeleteInvitedAccount = async () => {
    if (!deleteAccountInviteId) {
      return
    }

    setIsMutating(true)
    setError(null)

    try {
      await apiClient.deleteInvitedAccount(deleteAccountInviteId)
      setInvites((previous) => previous.map((invite) => (
        invite.invite_id === deleteAccountInviteId
          ? { ...invite, accepted_user_active: false }
          : invite
      )))
      setDeleteAccountInviteId(null)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to delete invited account")
      }
    } finally {
      setIsMutating(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-mobile-nav">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl pt-safe-header">
        <div className="mx-auto flex max-w-lg items-center gap-4 px-5 py-4">
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="size-5" />
            </Button>
          </Link>
          <h1 className="flex-1 text-xl font-bold">Invites</h1>
          {isOwner && (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="size-5" />
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-lg px-5 pt-5 space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        {!isAuthLoading && !isOwner ? (
          <Card className="border-0 p-8 text-center shadow-sm">
            <Shield className="mx-auto mb-4 size-12 text-muted-foreground" />
            <h3 className="mb-2 font-semibold">Owner access required</h3>
            <p className="text-sm text-muted-foreground">
              Only owners can create and view invites.
            </p>
          </Card>
        ) : !isLoading && invites.length > 0 ? (
          <div className="space-y-3">
            <div className="relative -mx-5 overflow-hidden px-5">
              <div className="flex gap-2 overflow-x-auto pb-1 pr-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {INVITE_STATUS_FILTERS.map((filter) => {
                  const isSelected = statusFilter === filter.value
                  const count = inviteStatusCounts[filter.value]

                  return (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setStatusFilter(filter.value)}
                      className={cn(
                        "inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border/60 bg-muted/25 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      )}
                    >
                      <span>{filter.label}</span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-xs",
                          isSelected ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>
              <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background via-background/80 to-transparent" aria-hidden="true" />
            </div>

            {filteredInvites.length > 0 ? (
              filteredInvites.map((invite) => (
                <Card key={invite.invite_id} className="border-0 p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                      <Mail className="size-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{invite.invitee_name}</p>
                        <Badge variant="outline" className={`gap-1 capitalize ${statusClassName(invite.status)}`}>
                          {statusIcon(invite.status)}
                          {invite.status}
                        </Badge>
                      </div>
                      <p className="truncate text-sm text-muted-foreground">{invite.email}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="capitalize">{invite.role}</span>
                        <span>Created {formatDate(invite.created_at)}</span>
                        <span>Expires {formatDate(invite.expires_at)}</span>
                      </div>
                      {invite.accepted_at && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Accepted {formatDate(invite.accepted_at)}
                        </p>
                      )}
                    </div>
                    {invite.status === "pending" ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="rounded-full text-destructive hover:text-destructive"
                        onClick={() => setRevokeInviteId(invite.invite_id)}
                        disabled={isMutating}
                        aria-label={`Revoke invite for ${invite.invitee_name}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : invite.status === "accepted" && invite.accepted_user_active !== false && invite.accepted_user_role !== "owner" ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="rounded-full text-destructive hover:text-destructive"
                        onClick={() => setDeleteAccountInviteId(invite.invite_id)}
                        disabled={isMutating}
                        aria-label={`Delete account for ${invite.invitee_name}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                </Card>
              ))
            ) : (
              <Card className="border-0 p-6 text-center shadow-sm">
                <p className="font-medium">No {statusFilter} invites</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try another status filter or create a new invite.
                </p>
              </Card>
            )}
          </div>
        ) : (
          <Card className="border-0 p-8 text-center shadow-sm">
            <UserPlus className="mx-auto mb-4 size-12 text-muted-foreground" />
            <h3 className="mb-2 font-semibold">No Invites</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Create an invite to give someone access to Budget.
            </p>
            <Button onClick={() => setShowCreateDialog(true)} disabled={!isOwner || isLoading}>
              Create Invite
            </Button>
          </Card>
        )}
      </main>

      <ResponsiveDialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          if (open) {
            setShowCreateDialog(true)
          } else {
            closeCreateDialog()
          }
        }}
        title="Create Invite"
        description={`${role === "admin" ? "Admin access" : "Member access"} · Expires ${selectedExpiryDate ? format(selectedExpiryDate, "MMM d, h:mm a") : "not set"}`}
        desktopClassName="sm:w-[min(calc(100dvw-2rem),38rem)] sm:max-w-[38rem]"
        headerClassName="px-4 pb-3 pt-2 sm:px-6 sm:py-4"
        bodyClassName="px-4 py-4 sm:px-6 sm:py-5"
        footerClassName="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6 sm:pt-4"
        footer={
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={closeCreateDialog}
              className="h-12 rounded-xl px-4"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!canCreate || isMutating}
              className="h-12 rounded-xl text-base font-semibold"
              onClick={() => void handleCreateInvite()}
            >
              {isMutating ? "Sending..." : "Send Invite"}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="inviteeName">Name</Label>
              <Input
                id="inviteeName"
                value={inviteeName}
                onChange={(event) => setInviteeName(event.target.value)}
                placeholder="Alex Morgan"
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteEmail">Email</Label>
              <Input
                id="inviteEmail"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="alex@example.com"
                className="h-12 rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["member", "admin"] as const).map((roleOption) => (
                <button
                  key={roleOption}
                  type="button"
                  onClick={() => setRole(roleOption)}
                  className={cn(
                    "h-11 rounded-xl text-sm font-medium capitalize transition-colors",
                    role === roleOption
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/60 text-foreground hover:bg-muted"
                  )}
                >
                  {roleOption}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label>Expiration</Label>
              <span className="truncate text-xs text-muted-foreground">
                {selectedExpiryDate ? format(selectedExpiryDate, "EEE, MMM d · h:mm a") : "Select expiry"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {EXPIRY_PRESETS.map((preset) => (
                <Button
                  key={preset.days}
                  type="button"
                  variant="secondary"
                  className="h-10 rounded-xl px-2 text-sm"
                  onClick={() => setExpiresAt(dateTimeLocalDaysFromNow(preset.days))}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 min-w-0 justify-start rounded-xl border-border/60 px-3 font-normal hover:border-foreground/20"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                      {selectedExpiryDate ? format(selectedExpiryDate, "MMMM d, yyyy") : "Pick date"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedExpiryDate ?? undefined}
                    onSelect={(date) => {
                      if (date) {
                        updateExpiryDate(date)
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <div className="grid grid-cols-3 gap-2">
                {EXPIRY_TIME_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateExpiryTime(option.value)}
                    className={cn(
                      "h-11 rounded-xl px-3 text-sm font-medium transition-colors",
                      selectedExpiryTime === option.value
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted/60 text-foreground hover:bg-muted"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="inviteSubject">Email Subject</Label>
            <Input
              id="inviteSubject"
              value={emailSubject}
              onChange={(event) => setEmailSubject(event.target.value)}
              maxLength={160}
              className="h-12 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inviteBody">Email Body</Label>
            <Textarea
              id="inviteBody"
              value={emailBody}
              onChange={(event) => setEmailBody(event.target.value)}
              maxLength={5000}
              className="min-h-32 rounded-xl"
            />
          </div>
        </div>
      </ResponsiveDialog>

      <ResponsiveConfirmDialog
        open={revokeInviteId !== null}
        onOpenChange={(open) => {
          if (!isMutating) {
            setRevokeInviteId(open ? revokeInviteId : null)
          }
        }}
        title="Revoke invite"
        description="This cannot be undone in v1. The invite link will stop working immediately."
        confirmLabel={isMutating ? "Revoking..." : "Revoke invite"}
        confirmVariant="destructive"
        confirmDisabled={!invitePendingRevoke || isMutating}
        closeDisabled={isMutating}
        onConfirm={() => void handleRevokeInvite()}
      >
        {invitePendingRevoke ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Revoke access for <span className="font-medium text-foreground">{invitePendingRevoke.invitee_name}</span>.
            </p>
            <p>{invitePendingRevoke.email}</p>
          </div>
        ) : null}
      </ResponsiveConfirmDialog>

      <ResponsiveConfirmDialog
        open={deleteAccountInviteId !== null}
        onOpenChange={(open) => {
          if (!isMutating) {
            setDeleteAccountInviteId(open ? deleteAccountInviteId : null)
          }
        }}
        title="Delete invited account"
        description="This disables the invited user’s account and signs them out of all devices. Their financial and audit records are retained."
        confirmLabel={isMutating ? "Deleting..." : "Delete account"}
        confirmVariant="destructive"
        confirmDisabled={!invitePendingAccountDelete || isMutating}
        closeDisabled={isMutating}
        onConfirm={() => void handleDeleteInvitedAccount()}
      >
        {invitePendingAccountDelete ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Delete access for <span className="font-medium text-foreground">{invitePendingAccountDelete.invitee_name}</span>?
            </p>
            <p>{invitePendingAccountDelete.email}</p>
          </div>
        ) : null}
      </ResponsiveConfirmDialog>

      <BottomNav />
    </div>
  )
}
