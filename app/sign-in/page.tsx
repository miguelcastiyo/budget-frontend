"use client"

import { Suspense, useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useRouter, useSearchParams } from "next/navigation"
import { ApiError, apiClient } from "@/lib/api/client"
import { useAuth } from "@/components/auth/auth-provider"
import { CredentialResponse, GoogleLogin } from "@react-oauth/google"
import { ArrowRight } from "lucide-react"

function SignInPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { resolvedTheme } = useTheme()
  const { setAuthenticatedUser } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [googleButtonWidth, setGoogleButtonWidth] = useState(320)
  const googleClientIdConfigured = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  const inviteToken = searchParams.get("invite_token")?.trim() || ""
  const isInviteFlow = inviteToken.length > 0
  const isDarkMode = resolvedTheme === "dark"

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
      setAuthenticatedUser(result.user)
      router.push("/")
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

  const handleGoogleSignIn = async (credentialResponse: CredentialResponse) => {
    const googleIdToken = credentialResponse.credential
    if (!googleIdToken) {
      setError("Google did not return an ID token.")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await apiClient.signInWithGoogle({
        google_id_token: googleIdToken,
        invite_token: inviteToken || undefined,
        client_type: "web",
      })
      setAuthenticatedUser(result.user)
      router.push("/")
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message || "Unable to sign in with Google")
      } else {
        setError("Unable to sign in with Google")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-[100svh] bg-background">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.04),transparent_28%),linear-gradient(to_bottom,rgba(15,23,42,0.015),transparent_30%)]" />

      <main className="mx-auto flex min-h-[100svh] max-w-6xl flex-col items-center justify-start px-4 pt-10 pb-6 sm:px-5 sm:pt-14 sm:pb-10 lg:px-8 lg:pt-20 lg:pb-16">
        <div className="w-full max-w-md">
          <Card className="gap-0 rounded-[1.5rem] border-border/70 bg-card/95 py-0 shadow-lg shadow-black/5 sm:rounded-[1.75rem]">
            <div className="space-y-5 px-4 py-5 sm:px-6 sm:py-6">
              <div className="flex justify-center pt-2 pb-2 sm:pt-3 sm:pb-3">
                <div className="text-7xl leading-none sm:text-8xl" aria-hidden="true">
                  💰
                </div>
              </div>

              {isInviteFlow && (
                <div className="rounded-2xl border border-border/70 bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
                  Use the same invited Google email address to continue.
                </div>
              )}

              {googleClientIdConfigured ? (
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={(credentialResponse) => void handleGoogleSignIn(credentialResponse)}
                    onError={() => setError("Google sign-in was canceled or failed.")}
                    theme={isDarkMode ? "filled_black" : "outline"}
                    text={isInviteFlow ? "signup_with" : "continue_with"}
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
                      <Label htmlFor="password">Password</Label>
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

              {!isInviteFlow && (
                <p className="text-center text-sm leading-6 text-muted-foreground">
                  Access is invite-only.
                </p>
              )}
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInPageContent />
    </Suspense>
  )
}
