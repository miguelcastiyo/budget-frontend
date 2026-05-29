"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Header } from "@/components/layout/header"
import { BottomNav } from "@/components/layout/bottom-nav"
import { ProfileEditDialog } from "@/components/settings/profile-edit-dialog"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatCurrency } from "@/lib/formatters"
import {
  Wallet,
  Tag,
  CreditCard,
  Repeat,
  Key,
  UserPlus,
  ChevronRight,
  Moon,
  LogOut,
  Pencil,
} from "lucide-react"
import Link from "next/link"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/components/auth/auth-provider"
import { ApiError, apiClient } from "@/lib/api/client"
import type { SettingsSummaryResponse } from "@/lib/api/types"

interface SettingsItemProps {
  icon: React.ReactNode
  label: string
  description?: string
  href?: string
  onClick?: () => void
  rightElement?: React.ReactNode
}

function SettingsItem({ icon, label, description, href, onClick, rightElement }: SettingsItemProps) {
  const isClickable = typeof onClick === "function"

  const content = (
    <div className="flex items-center gap-4 p-4">
      <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium">{label}</p>
        {description && (
          <p className="text-sm text-muted-foreground truncate">{description}</p>
        )}
      </div>
      {rightElement !== undefined ? rightElement : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block hover:bg-accent/50 transition-colors">
        {content}
      </Link>
    )
  }

  return (
    <div
      className={`w-full text-left transition-colors ${isClickable ? "hover:bg-accent/50 cursor-pointer" : ""}`}
      onClick={isClickable ? onClick : undefined}
      onKeyDown={isClickable
        ? (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              onClick()
            }
          }
        : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      {content}
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const { profile, setProfile, signOut } = useAuth()
  const { resolvedTheme } = useTheme()
  const [summary, setSummary] = useState<SettingsSummaryResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [themeReady, setThemeReady] = useState(false)
  const [isUpdatingTheme, setIsUpdatingTheme] = useState(false)
  const [showProfileEditor, setShowProfileEditor] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadSettingsData = async () => {
      try {
        const response = await apiClient.getSettingsSummary()
        if (isMounted) {
          setSummary(response)
          setError(null)
        }
      } catch (err) {
        if (!isMounted) {
          return
        }
        if (err instanceof ApiError) {
          setError(err.error.message)
        } else {
          setError("Unable to load settings summary")
        }
      }
    }

    void loadSettingsData()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    setThemeReady(true)
  }, [])

  const displayName = profile?.display_name || "Budget User"
  const avatarUrl = profile?.avatar_url || undefined
  const email = profile?.email || ""

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "BU"

  const budgetDescription = summary?.monthly_income
    ? `${formatCurrency(summary.monthly_income)}/month`
    : "Set your monthly budget"

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
      router.push("/sign-in")
    } finally {
      setIsSigningOut(false)
    }
  }

  const storedTheme = profile?.user_preferences.appearance.theme ?? "system"
  const isDarkMode = storedTheme === "dark"
  const isOwner = profile?.role === "owner"

  const handleThemeToggle = async (checked: boolean) => {
    const nextTheme = checked ? "dark" : "light"
    const previousProfile = profile

    setIsUpdatingTheme(true)
    setError(null)

    if (profile) {
      setProfile({
        ...profile,
        user_preferences: {
          ...profile.user_preferences,
          appearance: {
            ...profile.user_preferences.appearance,
            theme: nextTheme,
          },
        },
      })
    }

    try {
      const preferences = await apiClient.updatePreferences({
        appearance: {
          theme: nextTheme,
        },
      })

      if (profile) {
        setProfile({
          ...profile,
          user_preferences: preferences,
        })
      }
    } catch (err) {
      if (previousProfile) {
        setProfile(previousProfile)
      }
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to update appearance preference")
      }
    } finally {
      setIsUpdatingTheme(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-mobile-nav">
      <Header />

      <main className="max-w-lg lg:max-w-6xl mx-auto px-5 lg:px-8 pt-4 lg:pt-6 space-y-6">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <Card className="relative p-5 lg:p-6 border-0 shadow-sm">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 h-11 w-11 rounded-xl text-muted-foreground hover:text-foreground lg:right-5 lg:top-5"
            onClick={() => setShowProfileEditor(true)}
            aria-label="Edit profile"
          >
            <Pencil className="h-5 w-5" />
          </Button>
          <div className="space-y-5">
            <div className="flex items-center gap-4 pr-12">
              <Avatar className="h-16 w-16">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                <AvatarFallback className="bg-secondary text-secondary-foreground text-xl font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-xl font-bold">{displayName}</h2>
                <p className="text-muted-foreground">{email}</p>
              </div>
            </div>

            <div className="hidden lg:grid lg:grid-cols-5 gap-3">
              <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Monthly Income</p>
                <p className="mt-1 text-lg font-semibold">
                  {summary?.monthly_income ? formatCurrency(summary.monthly_income) : "--"}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Avg. Monthly Spend</p>
                <p className="mt-1 text-lg font-semibold">
                  {summary === null ? "--" : formatCurrency(summary.avg_monthly_spend)}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Tags</p>
                <p className="mt-1 text-lg font-semibold">
                  {summary === null ? "--" : summary.tags_count}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Cards</p>
                <p className="mt-1 text-lg font-semibold">
                  {summary === null ? "--" : summary.cards_count}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Recurring</p>
                <p className="mt-1 text-lg font-semibold">
                  {summary === null ? "--" : summary.recurring_count}
                </p>
                <p className="text-xs text-muted-foreground">
                  {summary === null
                    ? "--"
                    : `${formatCurrency(summary.recurring_committed_total)} committed`}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide px-1 mb-2">
              Account
            </h3>
            <Card className="overflow-hidden border-0 shadow-sm divide-y divide-border">
              <SettingsItem
                icon={<Wallet className="w-5 h-5 text-muted-foreground" />}
                label="Budget"
                description={budgetDescription}
                href="/settings/budget"
              />
              <SettingsItem
                icon={<Tag className="w-5 h-5 text-muted-foreground" />}
                label="Tags"
                description="Manage your spending tags"
                href="/settings/tags"
              />
              <SettingsItem
                icon={<CreditCard className="w-5 h-5 text-muted-foreground" />}
                label="Cards"
                description="Manage your payment cards"
                href="/settings/cards"
              />
              <SettingsItem
                icon={<Repeat className="w-5 h-5 text-muted-foreground" />}
                label="Recurring"
                description="Manage recurring monthly expenses"
                href="/settings/recurring"
              />
              <SettingsItem
                icon={<Key className="w-5 h-5 text-muted-foreground" />}
                label="API Keys"
                description="Manage API access"
                href="/settings/api-keys"
              />
              {isOwner && (
                <SettingsItem
                  icon={<UserPlus className="w-5 h-5 text-muted-foreground" />}
                  label="Invites"
                  description="Invite friends to use app"
                  href="/settings/invites"
                />
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide px-1 mb-2">
                Preferences
              </h3>
              <Card className="overflow-hidden border-0 shadow-sm divide-y divide-border">
                <SettingsItem
                  icon={<Moon className="w-5 h-5 text-muted-foreground" />}
                  label="Dark Mode"
                  description={
                    !themeReady
                      ? "Loading theme"
                      : storedTheme === "system"
                        ? `Following system appearance (${resolvedTheme === "dark" ? "dark" : "light"})`
                        : isDarkMode
                          ? "Dark appearance enabled"
                          : "Light appearance enabled"
                  }
                  rightElement={
                    <Switch
                      checked={isDarkMode}
                      disabled={!themeReady || isUpdatingTheme}
                      aria-label="Toggle dark mode"
                      onCheckedChange={(checked) => void handleThemeToggle(checked)}
                    />
                  }
                />
              </Card>
            </div>
          </div>
        </div>

        <Card className="border-0 shadow-sm p-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => void handleSignOut()}
            disabled={isSigningOut}
            className="w-full h-12 justify-center rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="w-4 h-4 mr-2" />
            {isSigningOut ? "Logging out..." : "Log out"}
          </Button>
        </Card>
      </main>

      <ProfileEditDialog open={showProfileEditor} onOpenChange={setShowProfileEditor} />
      <BottomNav />
    </div>
  )
}
