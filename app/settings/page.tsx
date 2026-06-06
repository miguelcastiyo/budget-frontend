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
  Database,
} from "lucide-react"
import Link from "next/link"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/components/auth/auth-provider"
import { ApiError, apiClient } from "@/lib/api/client"
import type { SettingsSummaryResponse } from "@/lib/api/types"
import { cn } from "@/lib/utils"

interface SettingsItemProps {
  icon: React.ReactNode
  label: string
  description?: string
  meta?: string
  href?: string
  onClick?: () => void
  rightElement?: React.ReactNode
}

function SettingsItem({ icon, label, description, meta, href, onClick, rightElement }: SettingsItemProps) {
  const isClickable = typeof onClick === "function"

  const content = (
    <div className="flex min-h-[76px] items-center gap-3 px-4 py-3.5 sm:gap-4">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-secondary/70">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <p className="truncate font-medium leading-tight">{label}</p>
          {meta && (
            <p className="hidden shrink-0 text-sm text-muted-foreground sm:block">
              {meta}
            </p>
          )}
        </div>
        {description && (
          <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-muted-foreground">
            {description}
          </p>
        )}
        {meta && (
          <p className="mt-1 text-sm text-muted-foreground sm:hidden">
            {meta}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center">
        {rightElement !== undefined ? rightElement : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        {content}
      </Link>
    )
  }

  return (
    <div
      className={cn(
        "w-full text-left transition-colors",
        isClickable && "cursor-pointer hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      )}
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

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <div className="px-1">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <Card className="gap-0 overflow-hidden rounded-lg border-border/70 py-0 shadow-none divide-y divide-border/70">
        {children}
      </Card>
    </section>
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

  const budgetMeta = summary?.monthly_income
    ? `${formatCurrency(summary.monthly_income)}/month`
    : undefined
  const tagsMeta = summary === null ? undefined : `${summary.tags_count} ${summary.tags_count === 1 ? "tag" : "tags"}`
  const cardsMeta = summary === null ? undefined : `${summary.cards_count} ${summary.cards_count === 1 ? "card" : "cards"}`
  const recurringMeta = summary === null
    ? undefined
    : `${summary.recurring_count} active · ${formatCurrency(summary.recurring_committed_total)} committed`

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
  const canManageApiKeys = profile?.role === "owner"

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

      <main className="mx-auto max-w-lg space-y-6 px-5 pt-standalone-safe-top lg:max-w-6xl lg:px-8 lg:pt-8">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your account, budget, and app preferences.
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.85fr)] lg:items-start">
          <div className="space-y-6 lg:order-1">
            <div className="lg:hidden">
              <SettingsSection title="Profile" description="Name, email, and sign-in">
                <button
                  type="button"
                  className="block w-full text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  onClick={() => setShowProfileEditor(true)}
                >
                  <div className="flex min-h-[84px] items-center gap-4 px-4 py-4">
                    <Avatar className="h-14 w-14">
                      {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-lg font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{displayName}</p>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">{email}</p>
                    </div>
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              </SettingsSection>
            </div>

            <SettingsSection title="Planning">
              <SettingsItem
                icon={<Wallet className="w-5 h-5 text-muted-foreground" />}
                label="Budget"
                description="Monthly plan and limits"
                meta={budgetMeta}
                href="/settings/budget"
              />
              <SettingsItem
                icon={<Repeat className="w-5 h-5 text-muted-foreground" />}
                label="Recurring"
                description="Bills and repeating expenses"
                meta={recurringMeta}
                href="/settings/recurring"
              />
            </SettingsSection>

            <SettingsSection title="Organization">
              <SettingsItem
                icon={<Tag className="w-5 h-5 text-muted-foreground" />}
                label="Tags"
                description="Categories for your spending"
                meta={tagsMeta}
                href="/settings/tags"
              />
              <SettingsItem
                icon={<CreditCard className="w-5 h-5 text-muted-foreground" />}
                label="Cards"
                description="Payment methods"
                meta={cardsMeta}
                href="/settings/cards"
              />
            </SettingsSection>

            <SettingsSection title="Data">
              <SettingsItem
                icon={<Database className="w-5 h-5 text-muted-foreground" />}
                label="Data"
                description="Import or export CSVs"
                href="/settings/data"
              />
            </SettingsSection>
          </div>

          <div className="flex flex-col gap-6 lg:order-2">
            <div className="hidden lg:order-1 lg:block">
              <SettingsSection title="Profile" description="Name, email, and sign-in">
                <button
                  type="button"
                  className="block w-full text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  onClick={() => setShowProfileEditor(true)}
                >
                  <div className="flex min-h-[92px] items-center gap-4 px-4 py-4">
                    <Avatar className="h-14 w-14">
                      {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-lg font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{displayName}</p>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">{email}</p>
                    </div>
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground"
                      aria-hidden="true"
                    >
                      <Pencil className="h-4 w-4" />
                    </div>
                  </div>
                </button>
              </SettingsSection>
            </div>

            {(isOwner || canManageApiKeys) && (
              <div className="lg:order-3">
                <SettingsSection title="Account & Access">
                  {isOwner && (
                    <SettingsItem
                      icon={<UserPlus className="w-5 h-5 text-muted-foreground" />}
                      label="Invites"
                      description="Invite others to your budget"
                      href="/settings/invites"
                    />
                  )}
                  {canManageApiKeys && (
                    <SettingsItem
                      icon={<Key className="w-5 h-5 text-muted-foreground" />}
                      label="API Keys"
                      description="Manage API access"
                      href="/settings/api-keys"
                    />
                  )}
                </SettingsSection>
              </div>
            )}

            <div className="lg:order-2">
              <SettingsSection title="Preferences">
                <SettingsItem
                  icon={<Moon className="w-5 h-5 text-muted-foreground" />}
                  label="Appearance"
                  description={
                    !themeReady
                      ? "Loading theme"
                      : storedTheme === "system"
                        ? `Following system appearance (${resolvedTheme === "dark" ? "dark" : "light"})`
                        : isDarkMode
                          ? "Dark mode enabled"
                          : "Light mode enabled"
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
              </SettingsSection>
            </div>

            <div className="lg:order-4">
              <SettingsSection title="Account">
                <div className="px-3 py-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void handleSignOut()}
                    disabled={isSigningOut}
                    className="h-11 w-full justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    {isSigningOut ? "Logging out..." : "Log out"}
                  </Button>
                </div>
              </SettingsSection>
            </div>
          </div>
        </div>

      </main>

      <ProfileEditDialog open={showProfileEditor} onOpenChange={setShowProfileEditor} />
      <BottomNav />
    </div>
  )
}
