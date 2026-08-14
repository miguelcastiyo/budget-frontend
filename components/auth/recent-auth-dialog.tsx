"use client"

import { useEffect, useState } from "react"
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google"
import { ApiError, apiClient } from "@/lib/api/client"
import { useAuth } from "@/components/auth/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"

interface RecentAuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => Promise<void> | void
  onFallback?: () => Promise<void> | void
  fallbackLabel?: string
  title?: string
  description?: string
}

export function RecentAuthDialog({
  open,
  onOpenChange,
  onSuccess,
  title = "Confirm your sign-in",
  description = "For your security, confirm your account sign-in before continuing.",
  onFallback,
  fallbackLabel = "Sign out and sign in again",
}: RecentAuthDialogProps) {
  const { authMethods } = useAuth()
  const hasPasswordMethod = authMethods.some((method) => method.type === "password")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const googleClientIdConfigured = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  useEffect(() => {
    if (!open) {
      setPassword("")
      setError(null)
      setBusy(false)
    }
  }, [open])

  const complete = async (credential: { method: "password"; password: string } | { method: "google"; google_id_token: string }) => {
    setBusy(true)
    setError(null)
    try {
      await apiClient.reauthenticate(credential)
      await onSuccess()
      onOpenChange(false)
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.error.message || "We couldn't verify your sign-in.")
      } else if (cause instanceof Error && cause.message) {
        setError(cause.message)
      } else {
        setError("We couldn't verify your sign-in. Try again.")
      }
    } finally {
      setBusy(false)
    }
  }

  const submitPassword = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!password || busy) return
    void complete({ method: "password", password })
  }

  const handleGoogleSuccess = (response: CredentialResponse) => {
    if (busy) return
    const token = response.credential
    if (!token) {
      setError("Google did not return an ID token.")
      return
    }
    void complete({ method: "google", google_id_token: token })
  }

  const runFallback = async () => {
    if (!onFallback || busy) return
    setBusy(true)
    setError(null)
    try {
      await onFallback()
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "We couldn't return to sign-in. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}
      title={title}
      description={description}
      mobileSize="compact"
      closeDisabled={busy}
      bodyClassName="px-4 py-5 sm:px-6"
    >
      <div className="space-y-5">
        {hasPasswordMethod && (
          <form className="space-y-4" onSubmit={submitPassword}>
            <div className="space-y-2">
              <Label htmlFor="recent-auth-password">Account password</Label>
              <Input
                id="recent-auth-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                disabled={busy}
                autoFocus
              />
            </div>
            <Button type="submit" className="min-h-11 w-full" disabled={!password || busy}>
              {busy ? "Verifying…" : "Continue"}
            </Button>
          </form>
        )}
        {authMethods.some((method) => method.type === "google") && googleClientIdConfigured ? (
          <div className="space-y-3">
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError("Google sign-in was canceled or failed.")}
                theme="outline"
                text="signin_with"
                shape="pill"
                size="large"
                width="100%"
              />
            </div>
            <p className="text-center text-xs text-muted-foreground">Use the same Google account as this Budget account.</p>
          </div>
        ) : !hasPasswordMethod && (
          <p className="text-sm text-destructive">Google sign-in is not available on this device. Sign in again from the main sign-in screen.</p>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {onFallback && <Button type="button" variant="outline" className="min-h-11 w-full" disabled={busy} onClick={() => void runFallback()}>{fallbackLabel}</Button>}
        <Button type="button" variant="ghost" className="min-h-11 w-full" disabled={busy} onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
      </div>
    </ResponsiveDialog>
  )
}
