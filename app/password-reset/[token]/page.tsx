"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, LockKeyhole } from "lucide-react"
import { ApiError, apiClient } from "@/lib/api/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function PasswordResetConfirmPage() {
  const router = useRouter()
  const params = useParams<{ token: string }>()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage(null)
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await apiClient.confirmPasswordReset({
        reset_token: params.token,
        password,
      })
      setMessage(response.message)
      setTimeout(() => router.push("/sign-in"), 1200)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to reset password")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-light min-h-[100svh] bg-background text-foreground">
      <main className="mx-auto flex min-h-[100svh] max-w-6xl flex-col items-center justify-start px-4 pt-auth-safe-top pb-6 sm:px-5 sm:pb-10 lg:px-8 lg:pb-16">
        <div className="w-full max-w-md">
          <Card className="gap-0 rounded-[1.5rem] border-border/70 bg-card/95 py-0 shadow-lg sm:rounded-[1.75rem]">
            <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5 px-4 py-5 sm:px-6 sm:py-6">
              <Link href="/sign-in" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-4" />
                Sign in
              </Link>

              <div className="flex justify-center py-2">
                <div className="flex size-16 items-center justify-center rounded-3xl bg-secondary">
                  <LockKeyhole className="size-7 text-muted-foreground" />
                </div>
              </div>

              <div className="space-y-2 text-center">
                <h1 className="text-2xl font-bold">Choose New Password</h1>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 rounded-xl border-border/70 bg-background"
                  minLength={8}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="h-11 rounded-xl border-border/70 bg-background"
                  minLength={8}
                  required
                />
              </div>

              <Button
                type="submit"
                className="h-11 w-full rounded-xl"
                disabled={isSubmitting || !password || !confirmPassword}
              >
                {isSubmitting ? "Resetting..." : "Reset Password"}
              </Button>

              {message && (
                <p className="rounded-2xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
                  {message}
                </p>
              )}

              {error && (
                <p className="rounded-2xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                  {error}
                </p>
              )}
            </form>
          </Card>
        </div>
      </main>
    </div>
  )
}
