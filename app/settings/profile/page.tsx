"use client"

import { useEffect, useState } from "react"
import { CredentialResponse, GoogleLogin } from "@react-oauth/google"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Mail, Check } from "lucide-react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { useAuth } from "@/components/auth/auth-provider"
import { ApiError, apiClient } from "@/lib/api/client"

export default function ProfileSettingsPage() {
  const { profile, setProfile } = useAuth()
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [showConvertDialog, setShowConvertDialog] = useState(false)
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [showVerificationDialog, setShowVerificationDialog] = useState(false)
  const [verificationCode, setVerificationCode] = useState("")
  const [pendingEmailChangeId, setPendingEmailChangeId] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isRequestingCode, setIsRequestingCode] = useState(false)
  const [isVerifyingCode, setIsVerifyingCode] = useState(false)
  const [isConvertingToGoogle, setIsConvertingToGoogle] = useState(false)
  const [googleButtonWidth, setGoogleButtonWidth] = useState(320)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const hasGoogleClientId = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)

  useEffect(() => {
    if (!profile) {
      return
    }

    setDisplayName(profile.display_name)
    setEmail(profile.email)
  }, [profile])

  useEffect(() => {
    const updateGoogleButtonWidth = () => {
      const viewportWidth = window.innerWidth
      const contentWidth = Math.min(360, viewportWidth - 96)
      setGoogleButtonWidth(Math.max(220, Math.floor(contentWidth)))
    }

    updateGoogleButtonWidth()
    window.addEventListener("resize", updateGoogleButtonWidth)

    return () => {
      window.removeEventListener("resize", updateGoogleButtonWidth)
    }
  }, [])

  const canEditEmail = profile?.auth_provider === "password"

  const handleSaveProfile = async () => {
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const updated = await apiClient.updateProfile({ display_name: displayName.trim() })
      setProfile(updated)
      setSuccess("Profile updated")
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to update profile")
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleRequestEmailChange = async () => {
    setIsRequestingCode(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await apiClient.requestEmailChange({ new_email: newEmail.trim() })
      setPendingEmailChangeId(response.email_change_id)
      setShowEmailDialog(false)
      setShowVerificationDialog(true)
      setSuccess("Verification code sent")
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to request email change")
      }
    } finally {
      setIsRequestingCode(false)
    }
  }

  const handleVerifyEmail = async () => {
    if (verificationCode.length !== 6 || !pendingEmailChangeId) {
      return
    }

    setIsVerifyingCode(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await apiClient.verifyEmailChange({
        email_change_id: pendingEmailChangeId,
        verification_code: verificationCode,
      })

      setEmail(response.email)
      if (profile) {
        setProfile({
          ...profile,
          email: response.email,
          email_verified: response.email_verified,
        })
      }

      setShowVerificationDialog(false)
      setNewEmail("")
      setVerificationCode("")
      setPendingEmailChangeId("")
      setSuccess("Email updated")
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to verify code")
      }
    } finally {
      setIsVerifyingCode(false)
    }
  }

  const handleConvertToGoogle = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      setError("Google did not return an ID token.")
      return
    }

    setIsConvertingToGoogle(true)
    setError(null)
    setSuccess(null)

    try {
      const updated = await apiClient.convertAccountToGoogle({
        google_id_token: credentialResponse.credential,
      })

      setProfile(updated)
      setEmail(updated.email)
      setShowConvertDialog(false)
      setSuccess("Account now uses Google sign-in.")
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to switch this account to Google sign-in")
      }
    } finally {
      setIsConvertingToGoogle(false)
    }
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
          <h1 className="text-xl font-bold">Profile</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 pt-4 space-y-6">
        <Card className="p-5 border-0 shadow-sm space-y-5">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="flex gap-2">
              <Input
                id="email"
                value={email}
                disabled
                className="h-12 rounded-xl flex-1"
              />
              {canEditEmail && (
                <Button
                  variant="outline"
                  className="h-12 rounded-xl"
                  onClick={() => setShowEmailDialog(true)}
                >
                  Change
                </Button>
              )}
            </div>
            {!canEditEmail && (
              <p className="text-sm text-muted-foreground">
                Email cannot be changed for Google sign-in accounts
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-xl">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">
              Signed in with {profile?.auth_provider === "google" ? "Google" : "Email"}
            </span>
            {profile?.email_verified && (
              <span className="ml-auto flex items-center gap-1 text-sm text-green-600">
                <Check className="w-4 h-4" />
                Verified
              </span>
            )}
          </div>

          {canEditEmail && (
            <div className="rounded-2xl border border-border/70 bg-background p-4 space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Switch this account to Google</p>
                <p className="text-sm text-muted-foreground">
                  Use the same email already on this account. Password sign-in will stop working after the switch.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full h-12 rounded-xl"
                onClick={() => setShowConvertDialog(true)}
              >
                Continue with Google
              </Button>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}

          <Button
            className="w-full h-12 rounded-xl"
            onClick={() => void handleSaveProfile()}
            disabled={isSaving || !displayName.trim()}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </Card>
      </main>

      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Change Email</DialogTitle>
            <DialogDescription>
              Enter your new email address. We will send a verification code to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newEmail">New Email</Label>
              <Input
                id="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-12 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEmailDialog(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleRequestEmailChange()}
              disabled={!newEmail || isRequestingCode}
              className="rounded-xl"
            >
              {isRequestingCode ? "Sending..." : "Send Code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showVerificationDialog} onOpenChange={setShowVerificationDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Verify Email</DialogTitle>
            <DialogDescription>
              Enter the 6-digit code sent to {newEmail}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-6">
            <InputOTP
              maxLength={6}
              value={verificationCode}
              onChange={setVerificationCode}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} className="rounded-xl" />
                <InputOTPSlot index={1} className="rounded-xl" />
                <InputOTPSlot index={2} className="rounded-xl" />
                <InputOTPSlot index={3} className="rounded-xl" />
                <InputOTPSlot index={4} className="rounded-xl" />
                <InputOTPSlot index={5} className="rounded-xl" />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowVerificationDialog(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleVerifyEmail()}
              disabled={verificationCode.length !== 6 || isVerifyingCode}
              className="rounded-xl"
            >
              {isVerifyingCode ? "Verifying..." : "Verify"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Switch To Google</DialogTitle>
            <DialogDescription>
              Continue with the Google account that matches {email}. This keeps your existing data and switches future sign-in to Google.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-2xl border border-border/70 bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
              After this change, email/password sign-in will no longer work for this account.
            </div>
            <div className="flex justify-center overflow-hidden rounded-xl">
              {hasGoogleClientId ? (
                <GoogleLogin
                  onSuccess={(credentialResponse) => void handleConvertToGoogle(credentialResponse)}
                  onError={() => setError("Google sign-in was canceled or failed.")}
                  theme="outline"
                  size="large"
                  text="continue_with"
                  shape="pill"
                  width={`${googleButtonWidth}`}
                />
              ) : (
                <Button
                  className="w-full rounded-xl"
                  onClick={() => setError("Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable Google sign-in.")}
                >
                  Continue with Google
                </Button>
              )}
            </div>
            {isConvertingToGoogle && (
              <p className="text-sm text-muted-foreground text-center">Finishing account switch...</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConvertDialog(false)}
              className="rounded-xl"
              disabled={isConvertingToGoogle}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  )
}
