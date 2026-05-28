"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle, Clock, Mail, Plus, Shield, UserPlus, XCircle } from "lucide-react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/components/auth/auth-provider"
import { ApiError, apiClient } from "@/lib/api/client"
import type { CreateInviteRequest, InviteResponse } from "@/lib/api/types"

type InviteRole = CreateInviteRequest["role"]

const DEFAULT_SUBJECT = "You are invited to Budget App"
const DEFAULT_BODY = "I sent you an invite to join Budget. Use the link below to accept the invitation before it expires."

function dateTimeLocalDaysFromNow(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setMinutes(0, 0, 0)
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
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
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  }
  if (status === "expired" || status === "revoked") {
    return "border-muted bg-muted text-muted-foreground"
  }
  return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
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
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)
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

  const resetForm = () => {
    setInviteeName("")
    setEmail("")
    setRole("member")
    setExpiresAt(dateTimeLocalDaysFromNow(7))
    setEmailSubject(DEFAULT_SUBJECT)
    setEmailBody(DEFAULT_BODY)
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

      <main className="mx-auto max-w-lg px-5 pt-4 space-y-4">
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
            {invites.map((invite) => (
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
                </div>
              </Card>
            ))}
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

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-h-[90svh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Create Invite</DialogTitle>
            <DialogDescription>
              Send a one-time invite with a role and expiration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
              <Label htmlFor="inviteEmail">Email Address</Label>
              <Input
                id="inviteEmail"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="alex@example.com"
                className="h-12 rounded-xl"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="inviteRole">User Role</Label>
                <Select value={role} onValueChange={(value) => setRole(value as InviteRole)}>
                  <SelectTrigger id="inviteRole" className="h-12 w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="inviteExpiry">Invite Expiry Date</Label>
                <Input
                  id="inviteExpiry"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  className="h-12 rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteSubject">Invite Email Subject</Label>
              <Input
                id="inviteSubject"
                value={emailSubject}
                onChange={(event) => setEmailSubject(event.target.value)}
                maxLength={160}
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteBody">Email Invite Body</Label>
              <Textarea
                id="inviteBody"
                value={emailBody}
                onChange={(event) => setEmailBody(event.target.value)}
                maxLength={5000}
                className="min-h-32 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreateInvite()}
              disabled={!canCreate || isMutating}
              className="rounded-xl"
            >
              {isMutating ? "Sending..." : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  )
}
