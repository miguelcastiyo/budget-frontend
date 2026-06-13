"use client"

import { useEffect, useState } from "react"
import { CredentialResponse, GoogleLogin } from "@react-oauth/google"
import { Check, Mail } from "lucide-react"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/components/auth/auth-provider"
import { ApiError, apiClient } from "@/lib/api/client"

interface ProfileEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProfileEditDialog({ open, onOpenChange }: ProfileEditDialogProps) {
  const { profile, setProfile } = useAuth()
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [showEmailChange, setShowEmailChange] = useState(false)
  const [showVerification, setShowVerification] = useState(false)
  const [showGoogleConvert, setShowGoogleConvert] = useState(false)
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
  const canEditEmail = profile?.auth_provider === "password"
  const canSwitchToGoogle = canEditEmail && emailQualifiesForGoogle(email)

  useEffect(() => {
    if (!profile || !open) {
      return
    }

    setDisplayName(profile.display_name)
    setEmail(profile.email)
    setError(null)
    setSuccess(null)
  }, [open, profile])

  const hasProfileChanges = displayName.trim() !== (profile?.display_name.trim() ?? "")

  useEffect(() => {
    if (!open) {
      return
    }

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
  }, [open])

  const resetSecondaryFlows = () => {
    setShowEmailChange(false)
    setShowVerification(false)
    setShowGoogleConvert(false)
    setNewEmail("")
    setVerificationCode("")
    setPendingEmailChangeId("")
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetSecondaryFlows()
      setError(null)
      setSuccess(null)
    }
    onOpenChange(nextOpen)
  }

  const handleSaveProfile = async () => {
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const updated = await apiClient.updateProfile({ display_name: displayName.trim() })
      setProfile(updated)
      setEmail(updated.email)
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
      setShowEmailChange(false)
      setShowVerification(true)
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

      setShowVerification(false)
      setShowGoogleConvert(false)
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
      setShowGoogleConvert(false)
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
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Edit Profile"
      description="Update your account details and sign-in options."
      mobileSize="compact"
      desktopClassName="sm:w-[min(calc(100dvw-2rem),34rem)] sm:max-w-[34rem]"
      contentClassName="sm:max-h-[min(90dvh,42rem)]"
      headerClassName="px-5 pb-5 pt-3 sm:px-6 sm:pt-5"
      bodyClassName="space-y-7 px-5 py-6 sm:space-y-7 sm:px-6"
      footerClassName="px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom)+0.5rem)] sm:px-6 sm:pt-4"
      footer={
        <Button
          className="h-12 w-full rounded-xl"
          onClick={() => void handleSaveProfile()}
          disabled={isSaving || !displayName.trim() || !hasProfileChanges}
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      }
    >
      <div className="space-y-6 sm:space-y-7">
        <div className="space-y-4">
          <div className="space-y-2.5">
            <Label htmlFor="settings-display-name">Display Name</Label>
            <Input
              id="settings-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="h-12 rounded-xl"
            />
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="settings-email">Email</Label>
            <div className="space-y-3">
              <Input id="settings-email" value={email} disabled className="h-12 rounded-xl" />
              {canEditEmail && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full rounded-xl"
                  onClick={() => {
                    setShowEmailChange((current) => !current)
                    setShowVerification(false)
                    setShowGoogleConvert(false)
                  }}
                >
                  Change
                </Button>
              )}
            </div>
            {!canEditEmail && (
              <p className="text-sm text-muted-foreground">Email cannot be changed for Google sign-in accounts.</p>
            )}
          </div>
        </div>

        {showEmailChange && (
          <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Change email</p>
              <p className="text-sm text-muted-foreground">We will send a verification code to the new address.</p>
            </div>
            <Input
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              placeholder="you@example.com"
              className="h-12 rounded-xl"
            />
            <Button
              type="button"
              className="h-11 w-full rounded-xl"
              onClick={() => void handleRequestEmailChange()}
              disabled={!newEmail.trim() || isRequestingCode}
            >
              {isRequestingCode ? "Sending..." : "Send Code"}
            </Button>
          </div>
        )}

        {showVerification && (
          <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Verify email</p>
              <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to {newEmail}.</p>
            </div>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={verificationCode} onChange={setVerificationCode}>
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
            <Button
              type="button"
              className="h-11 w-full rounded-xl"
              onClick={() => void handleVerifyEmail()}
              disabled={verificationCode.length !== 6 || isVerifyingCode}
            >
              {isVerifyingCode ? "Verifying..." : "Verify"}
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-secondary/50 px-3 py-3.5">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Signed in with {profile?.auth_provider === "google" ? "Google" : "Email"}</span>
          {profile?.email_verified && (
            <span className="ml-auto flex items-center gap-1 text-sm text-success">
              <Check className="h-4 w-4" />
              Verified
            </span>
          )}
        </div>

        {canSwitchToGoogle && (
          <div className="space-y-3 rounded-2xl border border-border/70 bg-background p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Switch this account to Google</p>
              <p className="text-sm text-muted-foreground">
                Use the same email already on this account. Password sign-in will stop working after the switch.
              </p>
            </div>
            {!showGoogleConvert ? (
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full rounded-xl"
                onClick={() => {
                  setShowGoogleConvert(true)
                  setShowEmailChange(false)
                  setShowVerification(false)
                }}
              >
                Continue with Google
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-border/70 bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
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
                      type="button"
                      className="w-full rounded-xl"
                      onClick={() => setError("Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable Google sign-in.")}
                    >
                      Continue with Google
                    </Button>
                  )}
                </div>
                {isConvertingToGoogle && (
                  <p className="text-center text-sm text-muted-foreground">Finishing account switch...</p>
                )}
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-success">{success}</p>}
      </div>
    </ResponsiveDialog>
  )
}

function emailQualifiesForGoogle(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  const domain = normalized.split("@")[1] ?? ""

  return domain === "gmail.com" || domain === "googlemail.com"
}
