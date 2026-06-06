"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Mail } from "lucide-react"
import { ApiError, apiClient } from "@/lib/api/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function PasswordResetRequestPage() {
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage(null)
    setError(null)

    try {
      const response = await apiClient.requestPasswordReset({ email })
      setMessage(response.message)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to request a password reset")
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
                  <Mail className="size-7 text-muted-foreground" />
                </div>
              </div>

              <div className="space-y-2 text-center">
                <h1 className="text-2xl font-bold">Reset Password</h1>
                <p className="text-sm leading-6 text-muted-foreground">
                  Enter your account email and we will send a reset link if password sign-in is enabled for it.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-11 rounded-xl border-border/70 bg-background"
                  required
                />
              </div>

              <Button type="submit" className="h-11 w-full rounded-xl" disabled={isSubmitting || !email.trim()}>
                {isSubmitting ? "Sending..." : "Send Reset Link"}
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
