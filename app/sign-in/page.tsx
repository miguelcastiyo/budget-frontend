"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { CredentialResponse, GoogleLogin } from "@react-oauth/google"
import { AlertCircle, ArrowRight, LockKeyhole } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { ApiError, apiClient } from "@/lib/api/client"

type InviteErrorState = "invalid" | "expired" | "accepted" | "mismatched-google" | "generic" | null

function AuthScreenShell({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="auth-light min-h-[100svh] overflow-x-hidden bg-background text-foreground">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(111,128,100,0.08),transparent_28%),linear-gradient(to_bottom,rgba(184,141,74,0.035),transparent_30%)]" />

      <main className="mx-auto flex min-h-[100svh] max-w-6xl flex-col items-center justify-start px-4 pt-auth-safe-top pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] sm:px-5 sm:pb-10 lg:px-8 lg:pb-16">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  )
}

function AuthCard({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Card className="gap-0 rounded-[1.5rem] border-border/70 bg-card/95 py-0 shadow-lg sm:rounded-[1.75rem]">
      <div className="space-y-5 px-4 py-5 sm:px-6 sm:py-6">{children}</div>
    </Card>
  )
}

function AuthBrand() {
  return (
    <div className="flex justify-center pt-2 pb-2 sm:pt-3 sm:pb-3">
      <Image
        src="/brand-icon.png"
        alt="Budget"
        width={96}
        height={96}
        priority
        className="size-20 rounded-[1.35rem] object-cover shadow-sm sm:size-24 sm:rounded-[1.65rem]"
      />
    </div>
  )
}

function getInviteErrorState(error: ApiError | Error): InviteErrorState {
  if (!(error instanceof ApiError)) {
    return "generic"
  }

  const message = error.error.message.toLowerCase()
  if (message.includes("expired")) {
    return "expired"
  }
  if (message.includes("already") && message.includes("accept")) {
    return "accepted"
  }
  if (message.includes("google") && message.includes("email")) {
    return "mismatched-google"
  }
  if (message.includes("invalid") || message.includes("not found") || message.includes("invite")) {
    return "invalid"
  }

  return "generic"
}

function inviteErrorCopy(errorState: InviteErrorState, fallback: string | null) {
  switch (errorState) {
    case "expired":
      return {
        title: "This invite has expired",
        body: "Ask the person who invited you to send a new invitation link.",
      }
    case "accepted":
      return {
        title: "This invite was already accepted",
        body: "If you already finished setup, use your existing account to sign in.",
      }
    case "mismatched-google":
      return {
        title: "Use the invited Google account",
        body: "Continue with the same Google email address that received the invite.",
      }
    case "invalid":
      return {
        title: "This invite link is invalid",
        body: "The invitation link is missing, malformed, or no longer available.",
      }
    case "generic":
      return {
        title: "We could not complete invite setup",
        body: fallback || "Try again in a moment. If the problem continues, ask for a new invite.",
      }
    default:
      return null
  }
}

function SignInPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setAuthenticatedUser } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [invitePassword, setInvitePassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<InviteErrorState>(null)
  const [googleButtonWidth, setGoogleButtonWidth] = useState(320)
  const googleClientIdConfigured = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  const inviteToken = searchParams.get("invite_token")?.trim() || ""
  const invitedEmail = searchParams.get("invited_email")?.trim() || searchParams.get("email")?.trim() || ""
  const isInviteFlow = inviteToken.length > 0

  useEffect(() => {
    const updateGoogleButtonWidth = () => {
      const viewportWidth = window.innerWidth
      const cardWidth = Math.min(448, viewportWidth - 32)
      const contentWidth = cardWidth - 32
      setGoogleButtonWidth(Math.max(220, Math.floor(contentWidth)))
    }

    updateGoogleButtonWidth()
    window.addEventListener("resize", updateGoogleButtonWidth)

    return () => {
      window.removeEventListener("resize", updateGoogleButtonWidth)
    }
  }, [])

  const inviteErrorMessage = useMemo(
    () => inviteErrorCopy(inviteError, error),
    [error, inviteError]
  )

  const completeAuth = (result: Awaited<ReturnType<typeof apiClient.signInWithPassword>>) => {
    setAuthenticatedUser(result.user)
    router.push(result.user.onboarding_complete ? "/" : "/onboarding")
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const result = await apiClient.signInWithPassword({
        email,
        password,
        client_type: "web",
      })
      completeAuth(result)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message || "Unable to sign in")
      } else {
        setError("Unable to sign in")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleInvitePasswordAccept = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setInviteError(null)

    try {
      const result = await apiClient.acceptInvitePassword({
        invite_token: inviteToken,
        display_name: displayName.trim(),
        password: invitePassword,
        client_type: "web",
      })
      completeAuth(result)
    } catch (err) {
      if (err instanceof ApiError) {
        setInviteError(getInviteErrorState(err))
        setError(err.error.message || "Unable to finish account setup")
      } else {
        setInviteError("generic")
        setError("Unable to finish account setup")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async (credentialResponse: CredentialResponse) => {
    const googleIdToken = credentialResponse.credential
    if (!googleIdToken) {
      setError("Google did not return an ID token.")
      setInviteError(isInviteFlow ? "generic" : null)
      return
    }

    if (isInviteFlow && displayName.trim() === "") {
      setError("Enter your name before continuing with Google.")
      return
    }

    setIsLoading(true)
    setError(null)
    setInviteError(null)

    try {
      const result = isInviteFlow
        ? await apiClient.acceptInviteGoogle({
            invite_token: inviteToken,
            google_id_token: googleIdToken,
            display_name: displayName.trim(),
            client_type: "web",
          })
        : await apiClient.signInWithGoogle({
            google_id_token: googleIdToken,
            client_type: "web",
          })

      completeAuth(result)
    } catch (err) {
      if (err instanceof ApiError) {
        if (isInviteFlow) {
          setInviteError(getInviteErrorState(err))
        }
        setError(err.error.message || "Unable to continue with Google")
      } else {
        if (isInviteFlow) {
          setInviteError("generic")
        }
        setError("Unable to continue with Google")
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (isInviteFlow) {
    return (
      <AuthScreenShell>
        <AuthCard>
          <AuthBrand />

          <div className="space-y-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Account setup</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
              You&apos;ve been invited
            </h1>
            <p className="text-sm leading-6 text-muted-foreground sm:text-[15px]">
              Create your Budget account to continue. Invited users can continue with Google or create a password,
              and password setup signs you in immediately.
            </p>
          </div>

          {invitedEmail ? (
            <div className="rounded-2xl border border-border/70 bg-muted/25 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Invited email</p>
              <p className="mt-1 break-all text-sm font-medium text-foreground">{invitedEmail}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border/70 bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
              This invite link contains the account email. Continue with Google or create a password to finish setup.
            </div>
          )}

          {inviteErrorMessage && (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/8 px-4 py-4 text-sm text-destructive">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium">{inviteErrorMessage.title}</p>
                  <p className="leading-6">{inviteErrorMessage.body}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="invite-display-name">Your name</Label>
            <Input
              id="invite-display-name"
              type="text"
              placeholder="Enter your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="h-12 rounded-xl border-border/70 bg-background text-base"
              autoComplete="name"
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-3">
            {googleClientIdConfigured && displayName.trim() !== "" ? (
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={(credentialResponse) => void handleGoogleSignIn(credentialResponse)}
                  onError={() => {
                    setInviteError("generic")
                    setError("Google sign-in was canceled or failed.")
                  }}
                  theme="outline"
                  text="signup_with"
                  shape="pill"
                  size="large"
                  width={googleButtonWidth}
                  containerProps={{
                    className: "flex w-full justify-center",
                  }}
                />
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full rounded-2xl text-base"
                onClick={() => {
                  if (!googleClientIdConfigured) {
                    setInviteError("generic")
                    setError("Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable Google sign-in.")
                    return
                  }
                  setError("Enter your name before continuing with Google.")
                }}
                disabled={isLoading}
              >
                Continue with Google
              </Button>
            )}

            <p className="px-1 text-center text-xs leading-5 text-muted-foreground">
              Use the same Google email address that received the invitation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Or set a password
            </span>
            <Separator className="flex-1" />
          </div>

          <form onSubmit={handleInvitePasswordAccept} className="space-y-4">
            {invitedEmail && (
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="invite-email"
                    type="email"
                    value={invitedEmail}
                    readOnly
                    aria-readonly="true"
                    className="h-12 rounded-xl border-border/70 bg-muted/30 pr-3 pl-9 text-base text-muted-foreground"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="invite-password">Create password</Label>
              <Input
                id="invite-password"
                type="password"
                placeholder="Create a strong password"
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
                className="h-12 rounded-xl border-border/70 bg-background text-base"
                autoComplete="new-password"
                disabled={isLoading}
                required
              />
            </div>

            <div className="sticky bottom-0 -mx-4 border-t border-border/70 bg-card/95 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.25rem)] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0 sm:pb-0 sm:backdrop-blur-none">
              <Button
                type="submit"
                className="h-12 w-full rounded-xl text-base"
                disabled={isLoading || displayName.trim() === "" || invitePassword.length === 0}
              >
                {isLoading ? "Creating account..." : "Set password"}
              </Button>
            </div>
          </form>
        </AuthCard>
      </AuthScreenShell>
    )
  }

  return (
    <AuthScreenShell>
      <AuthCard>
        <AuthBrand />

        {googleClientIdConfigured ? (
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={(credentialResponse) => void handleGoogleSignIn(credentialResponse)}
              onError={() => setError("Google sign-in was canceled or failed.")}
              theme="outline"
              text="continue_with"
              shape="pill"
              size="large"
              width={googleButtonWidth}
              containerProps={{
                className: "flex w-full justify-center",
              }}
            />
          </div>
        ) : (
          <Button
            variant="outline"
            className="h-12 w-full rounded-2xl text-base"
            onClick={() => setError("Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable Google sign-in.")}
            disabled={isLoading}
          >
            Continue with Google
          </Button>
        )}

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Or
          </span>
          <Separator className="flex-1" />
        </div>

        <div className="space-y-4">
          <Button
            type="button"
            variant={showEmailForm ? "secondary" : "ghost"}
            className="h-11 w-full justify-between rounded-2xl px-4 text-sm"
            onClick={() => setShowEmailForm((previous) => !previous)}
          >
            <span>{showEmailForm ? "Hide email sign in" : "Sign in with email and password"}</span>
            <ArrowRight className={`size-4 transition-transform ${showEmailForm ? "rotate-90" : ""}`} />
          </Button>

          <div
            aria-hidden={!showEmailForm}
            className={`grid overflow-hidden transition-all duration-300 ease-out ${
              showEmailForm ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <form
              onSubmit={handleEmailSignIn}
              className={`min-h-0 rounded-2xl transition-all duration-300 ease-out ${
                showEmailForm
                  ? "translate-y-0 space-y-4 border border-border/70 bg-muted/20 p-4"
                  : "-translate-y-2 space-y-0 border border-transparent bg-transparent p-0"
              }`}
            >
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl border-border/70 bg-background"
                  disabled={!showEmailForm}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/password-reset" className="text-xs font-medium text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-xl border-border/70 bg-background"
                  disabled={!showEmailForm}
                  required
                />
              </div>

              <Button
                type="submit"
                className="h-11 w-full rounded-xl"
                disabled={isLoading || !showEmailForm}
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </div>
        </div>

        {error && (
          <p className="rounded-2xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <p className="text-center text-sm leading-6 text-muted-foreground">
          Access is invite-only.
        </p>
      </AuthCard>
    </AuthScreenShell>
  )
}

function SignInLoadingFallback() {
  return (
    <AuthScreenShell>
      <AuthCard>
        <AuthBrand />
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <Spinner className="size-6 text-primary" />
          <div className="space-y-1">
            <p className="text-base font-medium text-foreground">Preparing your sign-in flow</p>
            <p className="text-sm text-muted-foreground">Checking your link and loading the right account setup path.</p>
          </div>
        </div>
      </AuthCard>
    </AuthScreenShell>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInLoadingFallback />}>
      <SignInPageContent />
    </Suspense>
  )
}
